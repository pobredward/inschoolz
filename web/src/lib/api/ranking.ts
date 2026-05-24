import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter,
  getDocs,
  DocumentSnapshot,
  QueryConstraint
} from 'firebase/firestore';
import { db } from '../firebase';
import { z } from 'zod';

// 랭킹 타입 정의
export const RankingTypeSchema = z.enum(['national', 'regional', 'school', 'regional_aggregated', 'school_aggregated']);
export type RankingType = z.infer<typeof RankingTypeSchema>;

// 랭킹 사용자 스키마
export const RankingUserSchema = z.object({
  id: z.string(),
  userName: z.string(),
  rank: z.number().optional(), // 실제 랭킹 순위
  stats: z.object({
    totalExperience: z.number(),
    level: z.number(),
    currentExp: z.number(),
  }),
  school: z.object({
    id: z.string(),
    name: z.string(),
  }).optional(),
  regions: z.object({
    sido: z.string(),
    sigungu: z.string(),
  }).optional(),
  profile: z.object({
    avatar: z.string().optional(),
    displayName: z.string().optional(),
  }).optional(),
});

export type RankingUser = z.infer<typeof RankingUserSchema>;

// 랭킹 응답 스키마
export const RankingResponseSchema = z.object({
  users: z.array(RankingUserSchema),
  hasMore: z.boolean(),
  lastDoc: z.any().optional(),
});

export type RankingResponse = z.infer<typeof RankingResponseSchema>;

// 집계된 지역 랭킹 스키마
export const AggregatedRegionSchema = z.object({
  id: z.string(), // "sido-sigungu" 형태
  sido: z.string(),
  sigungu: z.string(),
  totalExperience: z.number(),
  userCount: z.number(),
  averageExperience: z.number(),
});

export type AggregatedRegion = z.infer<typeof AggregatedRegionSchema>;

// 집계된 학교 랭킹 스키마
export const AggregatedSchoolSchema = z.object({
  id: z.string(),
  name: z.string(),
  totalExperience: z.number(),
  userCount: z.number(),
  averageExperience: z.number(),
  regions: z.object({
    sido: z.string(),
    sigungu: z.string(),
  }).optional(),
});

export type AggregatedSchool = z.infer<typeof AggregatedSchoolSchema>;

// 집계된 랭킹 응답 스키마
export const AggregatedRankingResponseSchema = z.object({
  regions: z.array(AggregatedRegionSchema).optional(),
  schools: z.array(AggregatedSchoolSchema).optional(),
  hasMore: z.boolean(),
});

export type AggregatedRankingResponse = z.infer<typeof AggregatedRankingResponseSchema>;

// 랭킹 쿼리 옵션
export interface RankingQueryOptions {
  type: RankingType;
  schoolId?: string;
  sido?: string;
  sigungu?: string;
  limit?: number;
  lastDoc?: DocumentSnapshot;
  searchQuery?: string;
}

/**
 * 랭킹 데이터를 조회합니다.
 */
export async function getRankings(options: RankingQueryOptions): Promise<RankingResponse> {
  try {
    const {
      type,
      schoolId,
      sido,
      sigungu,
      limit: queryLimit = 10,
      lastDoc,
      searchQuery
    } = options;

    const constraints: QueryConstraint[] = [];

    // 검색 쿼리가 있는 경우 userName으로 검색
    if (searchQuery) {
      constraints.push(
        where('profile.userName', '>=', searchQuery),
        where('profile.userName', '<=', searchQuery + '\uf8ff')
      );
    }

    // 타입별 필터링
    switch (type) {
      case 'school':
        if (!schoolId) {
          throw new Error('School ID is required for school ranking');
        }
        constraints.push(where('school.id', '==', schoolId));
        break;
      
      case 'regional':
        if (!sido || !sigungu) {
          throw new Error('Sido and Sigungu are required for regional ranking');
        }
        constraints.push(
          where('regions.sido', '==', sido),
          where('regions.sigungu', '==', sigungu)
        );
        break;
      
      case 'national':
        // 전국 랭킹은 추가 필터 없음
        break;
    }

    // 검색이 아닌 경우에만 경험치 순으로 정렬
    if (!searchQuery) {
      constraints.push(orderBy('stats.totalExperience', 'desc'));
    } else {
      // 검색 시에는 userName으로만 정렬 (복합 인덱스 회피)
      constraints.push(orderBy('profile.userName', 'asc'));
    }

    // 페이지네이션
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    constraints.push(limit(queryLimit));

    const q = query(collection(db, 'users'), ...constraints);
    const querySnapshot = await getDocs(q);

    const usersData = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return RankingUserSchema.parse({
        id: doc.id,
        userName: data.profile?.userName || data.userName || '',
        stats: {
          totalExperience: data.stats?.totalExperience || 0,
          level: data.stats?.level || 1,
          currentExp: data.stats?.currentExp || 0,
        },
        school: data.school ? {
          id: data.school.id,
          name: data.school.name,
        } : undefined,
        regions: data.regions ? {
          sido: data.regions.sido,
          sigungu: data.regions.sigungu,
        } : undefined,
        profile: data.profile ? {
          avatar: data.profile.profileImageUrl,
          displayName: data.profile.realName || data.profile.userName,
        } : undefined,
      });
    });

    // 각 사용자의 실제 랭킹 계산
    let users: RankingUser[];
    if (searchQuery) {
      // 검색 시: 각 사용자의 실제 전체 랭킹 계산
      console.log('검색 결과에 대한 실제 랭킹 계산 시작');
      users = await Promise.all(
        usersData.map(async (user) => {
          try {
            const rank = await getUserRank(user.id, { type, schoolId, sido, sigungu });
            return { ...user, rank };
          } catch (error) {
            console.error(`사용자 ${user.id} 랭킹 계산 실패:`, error);
            return { ...user, rank: 999 };
          }
        })
      );
      // 랭킹 순으로 재정렬
      users.sort((a, b) => (a.rank || 999) - (b.rank || 999));
    } else {
      // 일반 리스트: 각 사용자의 실제 랭킹을 경험치 기반으로 계산
      users = await Promise.all(
        usersData.map(async (user) => {
          try {
            const rank = await getUserRank(user.id, { type, schoolId, sido, sigungu });
            return { ...user, rank };
          } catch (error) {
            console.error(`사용자 ${user.id} 랭킹 계산 실패:`, error);
            return { ...user, rank: 999 };
          }
        })
      );
    }

    const hasMore = querySnapshot.docs.length === queryLimit;
    const newLastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];

    console.log('getRankings 결과:', { userCount: users.length, hasMore, isSearch: !!searchQuery });

    return {
      users,
      hasMore,
      lastDoc: newLastDoc,
    };
  } catch (error) {
    console.error('Error fetching rankings:', error);
    throw error;
  }
}

/**
 * 특정 사용자의 랭킹 위치를 조회합니다.
 */
export async function getUserRank(userId: string, options: Omit<RankingQueryOptions, 'limit' | 'lastDoc' | 'searchQuery'>): Promise<number> {
  try {
    const { type, schoolId, sido, sigungu } = options;

    const constraints: QueryConstraint[] = [];

    // 타입별 필터링
    switch (type) {
      case 'school':
        if (!schoolId) {
          throw new Error('School ID is required for school ranking');
        }
        constraints.push(where('school.id', '==', schoolId));
        break;
      
      case 'regional':
        if (!sido || !sigungu) {
          throw new Error('Sido and Sigungu are required for regional ranking');
        }
        constraints.push(
          where('regions.sido', '==', sido),
          where('regions.sigungu', '==', sigungu)
        );
        break;
      
      case 'national':
        // 전국 랭킹은 추가 필터 없음
        break;
    }

    // 사용자 정보 조회
    const userDoc = await getDocs(query(
      collection(db, 'users'),
      where('__name__', '==', userId)
    ));

    if (userDoc.empty) {
      throw new Error('User not found');
    }

    const userData = userDoc.docs[0].data();
    const userXp = userData.stats?.totalExperience || 0;

    // 해당 사용자보다 높은 경험치를 가진 사용자 수 조회
    const higherXpQuery = query(
      collection(db, 'users'),
      ...constraints,
      where('stats.totalExperience', '>', userXp)
    );

    const higherXpSnapshot = await getDocs(higherXpQuery);
    
    return higherXpSnapshot.size + 1; // 1-based ranking
  } catch (error) {
    console.error('Error fetching user rank:', error);
    throw error;
  }
}

/**
 * 랭킹 통계를 조회합니다.
 */
export async function getRankingStats(options: Omit<RankingQueryOptions, 'limit' | 'lastDoc' | 'searchQuery'>) {
  try {
    const { type, schoolId, sido, sigungu } = options;

    const constraints: QueryConstraint[] = [];

    // 타입별 필터링
    switch (type) {
      case 'school':
        if (!schoolId) {
          throw new Error('School ID is required for school ranking');
        }
        constraints.push(where('school.id', '==', schoolId));
        break;
      
      case 'regional':
        if (!sido || !sigungu) {
          throw new Error('Sido and Sigungu are required for regional ranking');
        }
        constraints.push(
          where('regions.sido', '==', sido),
          where('regions.sigungu', '==', sigungu)
        );
        break;
      
      case 'national':
        // 전국 랭킹은 추가 필터 없음
        break;
    }

    const q = query(collection(db, 'users'), ...constraints);
    const querySnapshot = await getDocs(q);

    const totalUsers = querySnapshot.size;
    const totalXp = querySnapshot.docs.reduce((sum, doc) => {
      const data = doc.data();
      return sum + (data.stats?.totalExperience || 0);
    }, 0);

    const averageXp = totalUsers > 0 ? Math.round(totalXp / totalUsers) : 0;

    return {
      totalUsers,
      totalXp,
      averageXp,
    };
  } catch (error) {
    console.error('Error fetching ranking stats:', error);
    throw error;
  }
} 

/**
 * 홈 화면용 랭킹 미리보기 (5등까지)
 */
export async function getRankingPreview(
  userId?: string,
  schoolId?: string,
  sido?: string,
  sigungu?: string
): Promise<{
  national: RankingUser[];
  regional: RankingUser[];
  school: RankingUser[];
}> {
  try {
    // 전국 랭킹 (5등까지)
    const nationalRanking = await getRankings({
      type: 'national',
      limit: 5
    });

    // 지역 랭킹 (5등까지)
    let regionalRanking = { users: [] as RankingUser[] };
    if (sido && sigungu) {
      regionalRanking = await getRankings({
        type: 'regional',
        sido,
        sigungu,
        limit: 5
      });
    }

    // 학교 랭킹 (5등까지)
    let schoolRanking = { users: [] as RankingUser[] };
    if (schoolId) {
      schoolRanking = await getRankings({
        type: 'school',
        schoolId,
        limit: 5
      });
    }

    return {
      national: nationalRanking.users,
      regional: regionalRanking.users,
      school: schoolRanking.users,
    };
  } catch (error) {
    console.error('Error fetching ranking preview:', error);
    throw error;
  }
}

/**
 * 지역별 집계 랭킹을 조회합니다.
 */
export async function getAggregatedRegionalRankings(limit: number = 20, offset: number = 0): Promise<AggregatedRegion[]> {
  try {
    // Firebase의 '!=' 제한을 피하기 위해 모든 사용자를 가져온 후 클라이언트에서 필터링
    // 필요한 필드만 선택하여 네트워크 사용량 최적화
    const usersQuery = query(collection(db, 'users'));
    
    const querySnapshot = await getDocs(usersQuery);
    const regionMap = new Map<string, {
      sido: string;
      sigungu: string;
      totalExperience: number;
      userCount: number;
    }>();

    querySnapshot.docs.forEach(doc => {
      const data = doc.data();
      const regions = data.regions;
      const experience = data.stats?.totalExperience || 0;
      
      // 클라이언트에서 지역 정보가 있는 사용자만 필터링
      if (regions?.sido && regions?.sigungu) {
        const regionKey = `${regions.sido}-${regions.sigungu}`;
        
        if (regionMap.has(regionKey)) {
          const existing = regionMap.get(regionKey)!;
          existing.totalExperience += experience;
          existing.userCount += 1;
        } else {
          regionMap.set(regionKey, {
            sido: regions.sido,
            sigungu: regions.sigungu,
            totalExperience: experience,
            userCount: 1,
          });
        }
      }
    });

    // 지역별 데이터를 배열로 변환하고 총 경험치 순으로 정렬
    const aggregatedRegions: AggregatedRegion[] = Array.from(regionMap.entries()).map(([key, data]) => ({
      id: key,
      sido: data.sido,
      sigungu: data.sigungu,
      totalExperience: data.totalExperience,
      userCount: data.userCount,
      averageExperience: Math.round(data.totalExperience / data.userCount),
    })).sort((a, b) => b.totalExperience - a.totalExperience);

    const result = aggregatedRegions.slice(offset, offset + limit);
    console.log('getAggregatedRegionalRankings 결과:', { 
      count: result.length, 
      total: aggregatedRegions.length,
      offset,
      limit 
    });
    
    return result;
  } catch (error) {
    console.error('Error fetching aggregated regional rankings:', error);
    throw error;
  }
}

/**
 * 학교별 집계 랭킹을 조회합니다.
 */
export async function getAggregatedSchoolRankings(limit: number = 20, offset: number = 0): Promise<AggregatedSchool[]> {
  try {
    // 모든 사용자 데이터를 가져온 후 클라이언트에서 학교 정보가 있는 사용자만 필터링
    const usersQuery = query(collection(db, 'users'));
    
    const querySnapshot = await getDocs(usersQuery);
    const schoolMap = new Map<string, {
      name: string;
      totalExperience: number;
      userCount: number;
      regions?: {
        sido: string;
        sigungu: string;
      };
    }>();

    querySnapshot.docs.forEach(doc => {
      const data = doc.data();
      const school = data.school;
      const experience = data.stats?.totalExperience || 0;
      
      // 클라이언트에서 학교 정보가 있는 사용자만 필터링
      if (school?.id && school?.name) {
        if (schoolMap.has(school.id)) {
          const existing = schoolMap.get(school.id)!;
          existing.totalExperience += experience;
          existing.userCount += 1;
        } else {
          schoolMap.set(school.id, {
            name: school.name,
            totalExperience: experience,
            userCount: 1,
            regions: data.regions ? {
              sido: data.regions.sido,
              sigungu: data.regions.sigungu,
            } : undefined,
          });
        }
      }
    });

    // 학교별 데이터를 배열로 변환하고 총 경험치 순으로 정렬
    const aggregatedSchools: AggregatedSchool[] = Array.from(schoolMap.entries()).map(([id, data]) => ({
      id,
      name: data.name,
      totalExperience: data.totalExperience,
      userCount: data.userCount,
      averageExperience: Math.round(data.totalExperience / data.userCount),
      regions: data.regions,
    })).sort((a, b) => b.totalExperience - a.totalExperience);

    const result = aggregatedSchools.slice(offset, offset + limit);
    console.log('getAggregatedSchoolRankings 결과:', { 
      count: result.length,
      total: aggregatedSchools.length,
      offset,
      limit
    });
    
    return result;
  } catch (error) {
    console.error('Error fetching aggregated school rankings:', error);
    throw error;
  }
}

/**
 * 집계된 랭킹 데이터를 조회합니다.
 */
export async function getAggregatedRankings(type: 'regional_aggregated' | 'school_aggregated', limit: number = 20, offset: number = 0): Promise<AggregatedRankingResponse> {
  try {
    console.log('getAggregatedRankings 호출:', { type, limit, offset });
    
    if (type === 'regional_aggregated') {
      const regions = await getAggregatedRegionalRankings(limit, offset);
      return {
        regions,
        hasMore: regions.length === limit,
      };
    } else {
      const schools = await getAggregatedSchoolRankings(limit, offset);
      return {
        schools,
        hasMore: schools.length === limit,
      };
    }
  } catch (error) {
    console.error('Error fetching aggregated rankings:', error);
    throw error;
  }
}

/**
 * 지역을 검색합니다.
 */
export async function searchRegions(keyword: string, limit: number = 20): Promise<AggregatedRegion[]> {
  try {
    console.log('지역 검색 시작:', { keyword, limit });
    
    // 전체 지역 랭킹을 가져온 후 키워드로 필터링
    const allRegions = await getAggregatedRegionalRankings(1000); // 충분히 큰 수로 설정
    
    if (!keyword.trim()) {
      return allRegions.slice(0, limit);
    }
    
    const searchKeyword = keyword.toLowerCase().trim();
    
    const filteredRegions = allRegions.filter(region => {
      const sidoMatch = region.sido.toLowerCase().includes(searchKeyword);
      const sigunguMatch = region.sigungu.toLowerCase().includes(searchKeyword);
      const fullNameMatch = `${region.sido} ${region.sigungu}`.toLowerCase().includes(searchKeyword);
      
      return sidoMatch || sigunguMatch || fullNameMatch;
    });
    
    console.log('지역 검색 완료:', { 
      keyword, 
      totalRegions: allRegions.length, 
      filteredCount: filteredRegions.length 
    });
    
    return filteredRegions.slice(0, limit);
  } catch (error) {
    console.error('지역 검색 오류:', error);
    throw error;
  }
}

/**
 * 학교를 검색합니다.
 */
export async function searchSchools(keyword: string, limit: number = 20): Promise<AggregatedSchool[]> {
  try {
    console.log('학교 검색 시작:', { keyword, limit });
    
    // 전체 학교 랭킹을 가져온 후 키워드로 필터링
    const allSchools = await getAggregatedSchoolRankings(1000); // 충분히 큰 수로 설정
    
    if (!keyword.trim()) {
      return allSchools.slice(0, limit);
    }
    
    const searchKeyword = keyword.toLowerCase().trim();
    
    const filteredSchools = allSchools.filter(school => {
      return school.name.toLowerCase().includes(searchKeyword);
    });
    
    console.log('학교 검색 완료:', { 
      keyword, 
      totalSchools: allSchools.length, 
      filteredCount: filteredSchools.length 
    });
    
    return filteredSchools.slice(0, limit);
  } catch (error) {
    console.error('학교 검색 오류:', error);
    throw error;
  }
}
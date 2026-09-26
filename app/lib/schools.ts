import { communityCommand } from './community-client';
import { db } from './firebase';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  addDoc,
  deleteDoc,
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  startAfter,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';

export interface School {
  id: string;
  KOR_NAME: string;
  ADDRESS: string;
  REGION?: string;
  HOMEPAGE?: string;
  memberCount?: number;
  favoriteCount?: number;
}

/**
 * 학교 즐겨찾기 토글
 */
export const toggleFavoriteSchool = async (
  userId: string,
  schoolId: string
): Promise<{
  success: boolean;
  isFavorite: boolean;
  message?: string;
  favoriteCount?: number;
}> => {
  return communityCommand('school.favorite', { schoolId }, userId);
};

/**
 * 사용자가 특정 학교 커뮤니티에 접근할 수 있는지 확인
 */
export const checkSchoolAccess = async (
  userId: string,
  schoolId: string
): Promise<{
  hasAccess: boolean;
  reason?: string;
}> => {
  try {
    // 사용자 문서 참조
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return {
        hasAccess: false,
        reason: '사용자 정보를 찾을 수 없습니다.'
      };
    }
    
    const userData = userDoc.data();
    const favorites = userData.favorites || {};
    const favoriteSchools = favorites.schools || [];
    
    // 즐겨찾기에 해당 학교가 있는지 확인
    const hasSchoolInFavorites = favoriteSchools.includes(schoolId);
    
    if (!hasSchoolInFavorites) {
      return {
        hasAccess: false,
        reason: '이 학교 커뮤니티에 접근하려면 먼저 즐겨찾기에 추가해주세요.'
      };
    }
    
    return {
      hasAccess: true
    };
  } catch (error) {
    console.error('학교 접근 권한 확인 오류:', error);
    return {
      hasAccess: false,
      reason: '접근 권한을 확인하는 중 오류가 발생했습니다.'
    };
  }
};

/**
 * 사용자의 즐겨찾기 학교 목록 가져오기 (메인 학교 자동 추가 포함, 비활성화된 학교 제외)
 */
export const getUserFavoriteSchools = async (userId: string): Promise<School[]> => {
  try {
    // 사용자 문서에서 즐겨찾기 학교 ID 목록 조회
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }
    
    const userData = userDoc.data();
    const favorites = userData.favorites || {};
    let favoriteSchoolIds = favorites.schools || [];
    
    // 메인 학교가 설정되어 있는데 즐겨찾기에 없는 경우 자동으로 추가
    const mainSchoolId = userData.school?.id;
    if (mainSchoolId && !favoriteSchoolIds.includes(mainSchoolId)) {
      console.log('메인 학교가 즐겨찾기에 없어서 자동 추가:', mainSchoolId);
      
      favoriteSchoolIds = [...favoriteSchoolIds, mainSchoolId];
      
      // Firestore에 업데이트
      await updateDoc(userRef, {
        'favorites.schools': favoriteSchoolIds,
        updatedAt: serverTimestamp()
      });
      
      // 학교의 즐겨찾기 카운트도 증가
      try {
        const schoolRef = doc(db, 'schools', mainSchoolId);
        const schoolDoc = await getDoc(schoolRef);
        
        if (schoolDoc.exists()) {
          const schoolData = schoolDoc.data();
          const currentFavoriteCount = schoolData.favoriteCount || 0;
          
          await updateDoc(schoolRef, {
            favoriteCount: currentFavoriteCount + 1
          });
        }
      } catch (schoolUpdateError) {
        console.error('학교 즐겨찾기 카운트 업데이트 오류:', schoolUpdateError);
      }
    }
    
    if (favoriteSchoolIds.length === 0) {
      return [];
    }
    
    // 즐겨찾기 학교 정보 조회 (활성화된 학교만)
    const favoriteSchools: School[] = [];
    
    for (const schoolId of favoriteSchoolIds) {
      const school = await getSchoolById(schoolId);
      // isActive가 false가 아닌 경우만 포함 (undefined는 활성화로 간주)
      if (school && school.isActive !== false) {
        favoriteSchools.push(school);
      } else if (school && school.isActive === false) {
        console.log('비활성화된 즐겨찾기 학교 필터링:', school.KOR_NAME);
      }
    }
    
    return favoriteSchools;
  } catch (error) {
    console.error('즐겨찾기 학교 목록 조회 오류:', error);
    throw new Error('즐겨찾기 학교 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 학교 상세 정보 조회
 */
export const getSchoolById = async (schoolId: string): Promise<School | null> => {
  try {
    const schoolRef = doc(db, 'schools', schoolId);
    const schoolDoc = await getDoc(schoolRef);
    
    if (schoolDoc.exists()) {
      const schoolData = schoolDoc.data();
      
      return {
        id: schoolDoc.id,
        KOR_NAME: schoolData.KOR_NAME,
        ADDRESS: schoolData.ADDRESS,
        REGION: schoolData.REGION,
        HOMEPAGE: schoolData.HOMEPAGE,
        memberCount: schoolData.memberCount || 0,
        favoriteCount: schoolData.favoriteCount || 0,
        isActive: schoolData.isActive
      } as School;
    } else {
      return null;
    }
  } catch (error) {
    console.error('학교 정보 조회 오류:', error);
    throw new Error('학교 정보를 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 학교 검색
 */
export const searchSchools = async (searchTerm: string): Promise<School[]> => {
  try {
    const q = query(
      collection(db, 'schools'),
      where('KOR_NAME', '>=', searchTerm),
      where('KOR_NAME', '<=', searchTerm + '\uf8ff'),
      orderBy('KOR_NAME'),
      limit(20)
    );
    
    const querySnapshot = await getDocs(q);
    const schools: School[] = [];
    
    querySnapshot.forEach((doc) => {
      const schoolData = doc.data();
      schools.push({
        id: doc.id,
        KOR_NAME: schoolData.KOR_NAME,
        ADDRESS: schoolData.ADDRESS,
        REGION: schoolData.REGION,
        HOMEPAGE: schoolData.HOMEPAGE,
        memberCount: schoolData.memberCount || 0,
        favoriteCount: schoolData.favoriteCount || 0
      });
    });
    
    return schools;
  } catch (error) {
    console.error('학교 검색 오류:', error);
    throw new Error('학교를 검색하는 중 오류가 발생했습니다.');
  }
};

/**
 * 메인 학교 설정
 */
export const setMainSchool = async (userId: string, schoolId: string): Promise<{
  success: boolean;
  updatedUser?: any;
}> => {
  await communityCommand('school.set', { schoolId }, userId);
  return { success: true, updatedUser: (await getDoc(doc(db, 'users', userId))).data() };
};

/**
 * 사용자의 메인 학교 정보 가져오기
 */
export const getMainSchool = async (userId: string): Promise<School | null> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return null;
    }
    
    const userData = userDoc.data();
    const schoolId = userData.school?.id; // 올바른 경로로 수정
    
    if (!schoolId) {
      return null;
    }
    
    // 메인 학교 정보 조회
    const school = await getSchoolById(schoolId);
    return school;
  } catch (error) {
    console.error('메인 학교 정보 조회 오류:', error);
    return null;
  }
}; 

/**
 * 게시글 수 기준으로 인기 학교 목록 가져오기 (비활성화된 학교 제외)
 */
export const getPopularSchools = async (limitCount = 10): Promise<School[]> => {
  try {
    // posts 컬렉션에서 학교별 게시글 수 집계
    const postsRef = collection(db, 'posts');
    const postsQuery = query(postsRef, where('type', '==', 'school'));
    const postsSnapshot = await getDocs(postsQuery);
    
    // 학교별 게시글 수 카운트
    const schoolPostCounts = new Map<string, number>();
    
    postsSnapshot.forEach((doc) => {
      const postData = doc.data();
      const schoolId = postData.schoolId;
      
      if (schoolId) {
        const currentCount = schoolPostCounts.get(schoolId) || 0;
        schoolPostCounts.set(schoolId, currentCount + 1);
      }
    });
    
    // 게시글 수 기준으로 정렬 (내림차순)
    const sortedSchoolIds = Array.from(schoolPostCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limitCount * 2) // 더 많이 가져와서 비활성화 제외 후 충분한 수를 확보
      .map(([schoolId]) => schoolId);
    
    // 학교 정보 조회 (활성화된 학교만)
    const popularSchools: School[] = [];
    
    for (const schoolId of sortedSchoolIds) {
      if (popularSchools.length >= limitCount) break;
      
      const school = await getSchoolById(schoolId);
      // isActive가 false가 아닌 경우만 포함 (undefined는 활성화로 간주)
      if (school && school.isActive !== false) {
        // 앱의 School 타입에 맞게 변환
        popularSchools.push({
          id: school.id,
          KOR_NAME: school.KOR_NAME,
          ADDRESS: school.ADDRESS,
          REGION: school.REGION,
          HOMEPAGE: school.HOMEPAGE,
          memberCount: school.memberCount,
          favoriteCount: school.favoriteCount,
          isActive: school.isActive
        });
      }
    }
    
    // 게시글 수 기준으로 충분하지 않다면 memberCount 기준으로 보완
    if (popularSchools.length < limitCount) {
      const remainingLimit = limitCount - popularSchools.length;
      const existingIds = new Set(popularSchools.map(s => s.id));
      
      const schoolsRef = collection(db, 'schools');
      const q = query(
        schoolsRef,
        orderBy('memberCount', 'desc'),
        limit(remainingLimit * 2) // 비활성화 제외를 고려하여 더 많이 가져오기
      );
      const querySnapshot = await getDocs(q);
      
      querySnapshot.forEach((doc) => {
        if (popularSchools.length >= limitCount) return;
        
        const schoolData = doc.data();
        // 이미 포함된 학교가 아니고, 활성화된 학교이며, 멤버가 있는 경우만 추가
        if (!existingIds.has(doc.id) && 
            schoolData.isActive !== false && 
            schoolData.memberCount > 0) {
          popularSchools.push({
            id: doc.id,
            KOR_NAME: schoolData.KOR_NAME,
            ADDRESS: schoolData.ADDRESS,
            REGION: schoolData.REGION,
            HOMEPAGE: schoolData.HOMEPAGE,
            memberCount: schoolData.memberCount || 0,
            favoriteCount: schoolData.favoriteCount || 0,
            isActive: schoolData.isActive
          });
        }
      });
    }
    
    return popularSchools;
  } catch (error) {
    console.error('인기 학교 목록 조회 오류:', error);
    // 오류 발생 시 memberCount 기준으로 활성화된 인기 학교 반환
    try {
      const schoolsRef = collection(db, 'schools');
      const q = query(
        schoolsRef,
        orderBy('memberCount', 'desc'),
        limit(limitCount * 2) // 비활성화 제외를 고려하여 더 많이 가져오기
      );
      const querySnapshot = await getDocs(q);
      const schools: School[] = [];
      
      querySnapshot.forEach((doc) => {
        if (schools.length >= limitCount) return;
        
        const schoolData = doc.data();
        // 활성화된 학교이며 멤버가 있는 경우만 추가
        if (schoolData.isActive !== false && schoolData.memberCount > 0) {
          schools.push({
            id: doc.id,
            KOR_NAME: schoolData.KOR_NAME,
            ADDRESS: schoolData.ADDRESS,
            REGION: schoolData.REGION,
            HOMEPAGE: schoolData.HOMEPAGE,
            memberCount: schoolData.memberCount || 0,
            favoriteCount: schoolData.favoriteCount || 0,
            isActive: schoolData.isActive
          });
        }
      });
      
      return schools;
    } catch (fallbackError) {
      console.error('인기 학교 fallback 조회 오류:', fallbackError);
      return [];
    }
  }
};

/**
 * 게시글 수 기준으로 인기 지역 목록 가져오기
 */
export interface RegionInfo {
  sido: string;
  sigungu: string;
  postCount: number;
}

export const getPopularRegions = async (limitCount = 12): Promise<RegionInfo[]> => {
  try {
    // posts 컬렉션에서 지역별 게시글 수 집계
    const postsRef = collection(db, 'posts');
    const postsQuery = query(postsRef, where('type', '==', 'regional'));
    const postsSnapshot = await getDocs(postsQuery);
    
    // 지역별 게시글 수 카운트
    const regionPostCounts = new Map<string, RegionInfo>();
    
    postsSnapshot.forEach((doc) => {
      const postData = doc.data();
      const regions = postData.regions;
      
      if (regions?.sido && regions?.sigungu) {
        const regionKey = `${regions.sido}-${regions.sigungu}`;
        const currentInfo = regionPostCounts.get(regionKey);
        
        if (currentInfo) {
          currentInfo.postCount += 1;
        } else {
          regionPostCounts.set(regionKey, {
            sido: regions.sido,
            sigungu: regions.sigungu,
            postCount: 1
          });
        }
      }
    });
    
    // 게시글 수 기준으로 정렬 (내림차순)
    const sortedRegions = Array.from(regionPostCounts.values())
      .sort((a, b) => b.postCount - a.postCount)
      .slice(0, limitCount);
    
    return sortedRegions;
  } catch (error) {
    console.error('인기 지역 목록 조회 오류:', error);
    return [];
  }
};

// 관리자용 학교 관리 함수들
export const adminGetAllSchools = async (): Promise<School[]> => {
  try {
    const schoolsRef = collection(db, 'schools');
    
    // 인덱스 기반 최적화된 쿼리: favoriteCount desc, memberCount desc 순으로 정렬
    const q = query(
      schoolsRef,
      orderBy('favoriteCount', 'desc'),
      orderBy('memberCount', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const schools: School[] = [];
    
    querySnapshot.forEach((doc) => {
      const schoolData = doc.data();
      const memberCount = schoolData.memberCount || 0;
      const favoriteCount = schoolData.favoriteCount || 0;
      
      // memberCount >= 1 또는 favoriteCount >= 1인 학교만 추가
      if (memberCount >= 1 || favoriteCount >= 1) {
        schools.push({
          id: doc.id,
          KOR_NAME: schoolData.KOR_NAME || schoolData.name,
          ADDRESS: schoolData.ADDRESS || schoolData.address,
          REGION: schoolData.REGION || schoolData.district,
          HOMEPAGE: schoolData.HOMEPAGE || schoolData.websiteUrl,
          memberCount,
          favoriteCount
        });
      }
    });
    
    // 이미 Firestore에서 정렬된 상태로 가져오므로 추가 정렬 불필요
    return schools;
  } catch (error) {
    console.error('관리자 학교 목록 조회 오류:', error);
    throw new Error('학교 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

export const adminSearchSchools = async (searchTerm: string): Promise<School[]> => {
  try {
    if (!searchTerm.trim()) {
      return adminGetAllSchools();
    }

    const schoolsRef = collection(db, 'schools');
    
    // KOR_NAME으로 시작하는 학교들만 Firebase에서 직접 검색
    const q = query(
      schoolsRef,
      where('KOR_NAME', '>=', searchTerm),
      where('KOR_NAME', '<', searchTerm + '\uf8ff'),
      orderBy('KOR_NAME'),
      limit(100) // 결과 수 제한으로 성능 최적화
    );

    const snapshot = await getDocs(q);
    const schools: School[] = [];

    snapshot.forEach((doc) => {
      const schoolData = doc.data();
      const schoolName = schoolData.KOR_NAME || schoolData.name || '';
      
      schools.push({
        id: doc.id,
        KOR_NAME: schoolName,
        ADDRESS: schoolData.ADDRESS || schoolData.address || '',
        REGION: schoolData.REGION || schoolData.district || '',
        HOMEPAGE: schoolData.HOMEPAGE || schoolData.websiteUrl || '',
        memberCount: schoolData.memberCount || 0,
        favoriteCount: schoolData.favoriteCount || 0
      });
    });

    // 학교명 기준으로 정확도 정렬
    return schools.sort((a, b) => {
      const aName = a.KOR_NAME || '';
      const bName = b.KOR_NAME || '';
      
      // 완전 매칭 우선
      const aExactMatch = aName === searchTerm ? 1 : 0;
      const bExactMatch = bName === searchTerm ? 1 : 0;
      if (aExactMatch !== bExactMatch) return bExactMatch - aExactMatch;
      
      // 즐겨찾기 수로 정렬
      const aFavorites = a.favoriteCount || 0;
      const bFavorites = b.favoriteCount || 0;
      if (aFavorites !== bFavorites) return bFavorites - aFavorites;
      
      // 멤버 수로 정렬
      return (b.memberCount || 0) - (a.memberCount || 0);
    });
  } catch (error) {
    console.error('학교 검색 오류:', error);
    throw new Error('학교 검색 중 오류가 발생했습니다.');
  }
};

export const adminCreateSchool = async (schoolData: Omit<School, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'schools'), {
      ...schoolData,
      memberCount: schoolData.memberCount || 0,
      favoriteCount: schoolData.favoriteCount || 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    return docRef.id;
  } catch (error) {
    console.error('학교 생성 오류:', error);
    throw new Error('학교 생성 중 오류가 발생했습니다.');
  }
};

export const adminUpdateSchool = async (schoolId: string, schoolData: Partial<School>): Promise<void> => {
  try {
    const schoolRef = doc(db, 'schools', schoolId);
    await updateDoc(schoolRef, {
      ...schoolData,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('학교 수정 오류:', error);
    throw new Error('학교 수정 중 오류가 발생했습니다.');
  }
};

export const adminDeleteSchool = async (schoolId: string): Promise<void> => {
  try {
    const schoolRef = doc(db, 'schools', schoolId);
    await deleteDoc(schoolRef);
  } catch (error) {
    console.error('학교 삭제 오류:', error);
    throw new Error('학교 삭제 중 오류가 발생했습니다.');
  }
}; 
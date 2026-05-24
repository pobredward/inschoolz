import { doc, getDoc, updateDoc, setDoc, collection, getDocs, addDoc, deleteDoc, query, where, getCountFromServer, orderBy, limit, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Board } from '@/types/board';
import { School } from '@/types';
import { invalidateSystemSettingsCache } from '../experience';

// 경험치 설정 타입 정의
export interface ExperienceSettings {
  community: {
    postXP: number;
    commentXP: number;
    likeXP: number;
    dailyPostLimit: number;
    dailyCommentLimit: number;
    dailyLikeLimit: number;
  };
  games: {
    reactionGame: {
      enabled: boolean;
      dailyLimit: number;
      thresholds: Array<{
        minScore: number;
        xpReward: number;
      }>;
    };
    tileGame: {
      enabled: boolean;
      dailyLimit: number;
      thresholds: Array<{
        minScore: number;
        xpReward: number;
      }>;
    };
  };

  attendance: {
    dailyXP: number;
    streakBonus: number;
    weeklyBonusXP: number;
  };
  
  referral: {
    referrerXP: number;    // 추천인(A)이 받는 경험치
    refereeXP: number;     // 추천받은 사람(B)이 받는 경험치
    enabled: boolean;      // 추천인 시스템 활성화 여부
  };
  
  ads: {
    rewardedVideo: {
      experienceReward: number;
      dailyLimit: number;
      cooldownMinutes: number;
    };
  };
}

/**
 * 관리자용 경험치 설정 조회
 */
export const getExperienceSettings = async (): Promise<ExperienceSettings> => {
  try {
    const settingsDoc = await getDoc(doc(db, 'system', 'experienceSettings'));
    
    if (settingsDoc.exists()) {
      return settingsDoc.data() as ExperienceSettings;
    } else {
      // 기본 설정 반환
      const defaultSettings: ExperienceSettings = {
        community: {
          postXP: 10,
          commentXP: 5,
          likeXP: 1,
          dailyPostLimit: 3,
          dailyCommentLimit: 5,
          dailyLikeLimit: 50,
        },
        games: {
          reactionGame: {
            enabled: true,
            dailyLimit: 5,
            thresholds: [
              { minScore: 100, xpReward: 15 },
              { minScore: 200, xpReward: 10 },
              { minScore: 300, xpReward: 5 },
            ],
          },
          tileGame: {
            enabled: true,
            dailyLimit: 3,
            thresholds: [
              { minScore: 7, xpReward: 15 },
              { minScore: 10, xpReward: 10 },
              { minScore: 13, xpReward: 5 },
            ],
          },
        },

        attendance: {
          dailyXP: 10,
          streakBonus: 5,
          weeklyBonusXP: 50,
        },
        
        referral: {
          referrerXP: 30,     // 추천인이 받는 경험치 (기본값)
          refereeXP: 30,      // 추천받은 사람이 받는 경험치 (기본값)
          enabled: true,      // 추천인 시스템 활성화
        },
        
        ads: {
          rewardedVideo: {
            experienceReward: 30,
            dailyLimit: 5,
            cooldownMinutes: 30,
          },
        },
      };
      
      // 기본 설정을 Firestore에 저장 (문서가 없으면 생성)
      await setDoc(doc(db, 'system', 'experienceSettings'), defaultSettings);
      return defaultSettings;
    }
  } catch (error) {
    console.error('경험치 설정 조회 오류:', error);
    throw new Error('경험치 설정을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 관리자용 경험치 설정 업데이트
 */
export const updateExperienceSettings = async (settings: ExperienceSettings): Promise<void> => {
  try {
    // setDoc을 사용하여 문서가 없으면 생성, 있으면 업데이트
    await setDoc(doc(db, 'system', 'experienceSettings'), {
      ...settings,
      updatedAt: serverTimestamp(),
    });
    await invalidateSystemSettingsCache(); // 캐시 무효화
  } catch (error) {
    console.error('경험치 설정 업데이트 오류:', error);
    throw new Error('경험치 설정 업데이트 중 오류가 발생했습니다.');
  }
};

/**
 * 모든 게시판 조회 (관리자용)
 */
export const getAllBoards = async (): Promise<Board[]> => {
  try {
    console.log('getAllBoards 함수 호출됨'); // 디버깅용
    const querySnapshot = await getDocs(collection(db, 'boards'));
    const boards: Board[] = [];
    
    console.log('Firestore에서 가져온 문서 수:', querySnapshot.size); // 디버깅용
    
    querySnapshot.forEach((doc) => {
      const boardData = doc.data();
      console.log('원본 boardData:', boardData); // 디버깅용
      
      const board: Board = {
        id: doc.id,
        name: boardData.name || '',
        code: boardData.code || boardData.boardCode || '', // code 또는 boardCode 필드 모두 지원
        description: boardData.description || '',
        type: boardData.type || boardData.boardType || 'common', // type 또는 boardType 필드 모두 지원
        order: boardData.order || 0,
        isActive: boardData.isActive !== undefined ? boardData.isActive : true,
        isPublic: boardData.isPublic !== undefined ? boardData.isPublic : true,
        createdAt: boardData.createdAt || serverTimestamp(),
        updatedAt: boardData.updatedAt || serverTimestamp(),
        stats: {
          postCount: boardData.stats?.postCount || 0,
          viewCount: boardData.stats?.viewCount || 0,
          activeUserCount: boardData.stats?.activeUserCount || 0
        },
        allowAnonymous: boardData.allowAnonymous !== undefined ? boardData.allowAnonymous : true,
        allowPolls: boardData.allowPolls !== undefined ? boardData.allowPolls : true,
        icon: boardData.icon || '💬'
      };
      
      console.log('변환된 board:', board); // 디버깅용
      boards.push(board);
    });
    
    console.log('최종 boards 배열:', boards); // 디버깅용
    
    // 클라이언트에서 정렬: type -> order 순
    return boards.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }
      return (a.order || 0) - (b.order || 0);
    });
  } catch (error) {
    console.error('전체 게시판 조회 오류:', error);
    throw new Error('게시판 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 게시판 생성 (관리자용)
 */
export const createBoard = async (boardData: Omit<Board, 'id' | 'createdAt' | 'updatedAt'>): Promise<Board> => {
  try {
    console.log('createBoard 함수 호출됨, boardData:', boardData); // 디버깅용
    
    // Firebase에 저장할 때 필드명 매핑
    const firebaseData = {
      name: boardData.name,
      code: boardData.code, // Firebase에서 code 필드 사용
      description: boardData.description,
      type: boardData.type, // Firebase에서 type 필드 사용
      order: boardData.order,
      isActive: boardData.isActive,
      isPublic: boardData.isPublic,
      allowAnonymous: boardData.allowAnonymous,
      allowPolls: boardData.allowPolls,
      icon: boardData.icon,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      stats: boardData.stats || { postCount: 0, viewCount: 0, activeUserCount: 0 }
    };
    
    console.log('Firebase에 저장할 데이터:', firebaseData); // 디버깅용
    
    const docRef = await addDoc(collection(db, 'boards'), firebaseData);
    
    console.log('생성된 문서 ID:', docRef.id); // 디버깅용
    
    return {
      id: docRef.id,
      ...boardData,
      createdAt: firebaseData.createdAt,
      updatedAt: firebaseData.updatedAt
    } as Board;
  } catch (error) {
    console.error('게시판 생성 오류:', error);
    throw new Error('게시판 생성 중 오류가 발생했습니다.');
  }
};

/**
 * 게시판 수정 (관리자용)
 */
export const updateBoard = async (boardId: string, boardData: Partial<Board>): Promise<void> => {
  try {
    const boardRef = doc(db, 'boards', boardId);
    await updateDoc(boardRef, {
      ...boardData,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('게시판 수정 오류:', error);
    throw new Error('게시판 수정 중 오류가 발생했습니다.');
  }
};

/**
 * 게시판 삭제 (관리자용)
 */
export const deleteBoard = async (boardId: string): Promise<void> => {
  try {
    const boardRef = doc(db, 'boards', boardId);
    await deleteDoc(boardRef);
  } catch (error) {
    console.error('게시판 삭제 오류:', error);
    throw new Error('게시판 삭제 중 오류가 발생했습니다.');
  }
};

/**
 * 게시판 활성화/비활성화 (관리자용)
 */
export const toggleBoardStatus = async (boardId: string, isActive: boolean): Promise<void> => {
  try {
    const boardRef = doc(db, 'boards', boardId);
    await updateDoc(boardRef, {
      isActive,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('게시판 상태 변경 오류:', error);
    throw new Error('게시판 상태 변경 중 오류가 발생했습니다.');
  }
};

/**
 * 관리자용 통계 데이터 조회
 */
export const getAdminStats = async (): Promise<{
  totalUsers: number;
  activeUsers: number;
  totalPosts: number;
  totalComments: number;
  pendingReports: number;
  totalExperience: number;
}> => {
  try {
    // 사용자 수 계산
    const usersSnapshot = await getCountFromServer(collection(db, 'users'));
    const totalUsers = usersSnapshot.data().count;

    // 활성 사용자 수 계산 (최근 30일 내 활동)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const activeUsersQuery = query(
      collection(db, 'users'),
      where('lastActiveAt', '>=', thirtyDaysAgo)
    );
    const activeUsersSnapshot = await getCountFromServer(activeUsersQuery);
    const activeUsers = activeUsersSnapshot.data().count;

    // 게시글 수 계산
    const postsSnapshot = await getCountFromServer(collection(db, 'posts'));
    const totalPosts = postsSnapshot.data().count;

    // 댓글 수 계산 (모든 게시글의 comments 서브컬렉션 합계)
    let totalComments = 0;
    const postsQuerySnapshot = await getDocs(collection(db, 'posts'));
    for (const postDoc of postsQuerySnapshot.docs) {
      const commentsSnapshot = await getCountFromServer(collection(db, 'posts', postDoc.id, 'comments'));
      totalComments += commentsSnapshot.data().count;
    }

    // 신고 건수 계산 (처리되지 않은 신고)
    let pendingReports = 0;
    for (const postDoc of postsQuerySnapshot.docs) {
      const reportsQuery = query(
        collection(db, 'posts', postDoc.id, 'reports'),
        where('status', '==', 'pending')
      );
      const reportsSnapshot = await getCountFromServer(reportsQuery);
      pendingReports += reportsSnapshot.data().count;
    }

    // 총 경험치 계산 (모든 사용자의 누적 경험치 합계)
    const usersQuerySnapshot = await getDocs(collection(db, 'users'));
    let totalExperience = 0;
    usersQuerySnapshot.forEach((userDoc) => {
      const userData = userDoc.data();
      const userXP = userData.stats?.xp?.total || 0;
      totalExperience += userXP;
    });

    return {
      totalUsers,
      activeUsers,
      totalPosts,
      totalComments,
      pendingReports,
      totalExperience,
    };
  } catch (error) {
    console.error('관리자 통계 조회 오류:', error);
    throw new Error('통계 데이터를 가져오는 중 오류가 발생했습니다.');
  }
}; 

/**
 * 홈 화면용 통계 데이터 조회
 */
export const getHomeStats = async (): Promise<{
  totalUsers: number;
  todayPosts: number;
  onlineUsers: number;
  totalPosts: number;
}> => {
  try {
    // 사용자 수 계산
    const usersSnapshot = await getCountFromServer(collection(db, 'users'));
    const totalUsers = usersSnapshot.data().count;

    // 오늘 작성된 게시글 수 계산
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayPostsQuery = query(
      collection(db, 'posts'),
      where('createdAt', '>=', today.getTime()),
      where('status.isDeleted', '==', false)
    );
    const todayPostsSnapshot = await getCountFromServer(todayPostsQuery);
    const todayPosts = todayPostsSnapshot.data().count;

    // 온라인 사용자 수 계산 (최근 5분 내 활동)
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const onlineUsersQuery = query(
      collection(db, 'users'),
      where('lastActiveAt', '>=', fiveMinutesAgo)
    );
    const onlineUsersSnapshot = await getCountFromServer(onlineUsersQuery);
    const onlineUsers = onlineUsersSnapshot.data().count;

    // 전체 게시글 수 계산
    const postsSnapshot = await getCountFromServer(collection(db, 'posts'));
    const totalPosts = postsSnapshot.data().count;

    return {
      totalUsers,
      todayPosts,
      onlineUsers,
      totalPosts,
    };
  } catch (error) {
    console.error('홈 통계 조회 오류:', error);
    throw new Error('홈 통계 데이터를 가져오는 중 오류가 발생했습니다.');
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
          name: schoolData.KOR_NAME || schoolData.name,
          address: schoolData.ADDRESS || schoolData.address,
          district: schoolData.REGION || schoolData.district,
          type: getSchoolType(schoolData.KOR_NAME || schoolData.name),
          logoUrl: schoolData.logoUrl,
          websiteUrl: schoolData.HOMEPAGE || schoolData.websiteUrl,
          regions: {
            sido: schoolData.REGION || schoolData.regions?.sido,
            sigungu: getDistrict(schoolData.ADDRESS || schoolData.address)
          },
          gameStats: schoolData.gameStats,
          isActive: schoolData.isActive !== undefined ? schoolData.isActive : true,
          createdAt: schoolData.createdAt || serverTimestamp(),
          updatedAt: schoolData.updatedAt || serverTimestamp(),
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
        name: schoolName,
        address: schoolData.ADDRESS || schoolData.address || '',
        district: schoolData.REGION || schoolData.district || '',
        type: getSchoolType(schoolName),
        logoUrl: schoolData.logoUrl || '',
        websiteUrl: schoolData.HOMEPAGE || schoolData.websiteUrl || '',
        regions: {
          sido: schoolData.REGION || schoolData.regions?.sido || '',
          sigungu: getDistrict(schoolData.ADDRESS || schoolData.address || '')
        },
        gameStats: schoolData.gameStats || {},
        isActive: schoolData.isActive !== undefined ? schoolData.isActive : true,
        createdAt: schoolData.createdAt || serverTimestamp(),
        updatedAt: schoolData.updatedAt || serverTimestamp(),
        memberCount: schoolData.memberCount || 0,
        favoriteCount: schoolData.favoriteCount || 0
      });
    });

    // 학교명 기준으로 정확도 정렬
    return schools.sort((a, b) => {
      const aName = a.name || '';
      const bName = b.name || '';
      
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
    console.error('관리자 학교 검색 오류:', error);
    throw new Error('학교 검색 중 오류가 발생했습니다.');
  }
};

export const adminCreateSchool = async (schoolData: Omit<School, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const schoolsRef = collection(db, 'schools');
    const newSchoolRef = doc(schoolsRef);
    
    const createData = {
      KOR_NAME: schoolData.name,
      ADDRESS: schoolData.address,
      REGION: schoolData.district,
      HOMEPAGE: schoolData.websiteUrl || '',
      logoUrl: schoolData.logoUrl || '',
      memberCount: schoolData.memberCount || 0,
      favoriteCount: schoolData.favoriteCount || 0,
      gameStats: schoolData.gameStats || {},
      isActive: schoolData.isActive !== undefined ? schoolData.isActive : true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    await setDoc(newSchoolRef, createData);
    return newSchoolRef.id;
  } catch (error) {
    console.error('관리자 학교 생성 오류:', error);
    throw new Error('학교 생성 중 오류가 발생했습니다.');
  }
};

export const adminUpdateSchool = async (schoolId: string, schoolData: Partial<School>): Promise<void> => {
  try {
    const schoolRef = doc(db, 'schools', schoolId);
    
    const updateData: Record<string, string | number | object> = {
      updatedAt: serverTimestamp()
    };
    
    if (schoolData.name !== undefined) updateData.KOR_NAME = schoolData.name;
    if (schoolData.address !== undefined) updateData.ADDRESS = schoolData.address;
    if (schoolData.district !== undefined) updateData.REGION = schoolData.district;
    if (schoolData.websiteUrl !== undefined) updateData.HOMEPAGE = schoolData.websiteUrl;
    if (schoolData.logoUrl !== undefined) updateData.logoUrl = schoolData.logoUrl;
    if (schoolData.memberCount !== undefined) updateData.memberCount = schoolData.memberCount;
    if (schoolData.favoriteCount !== undefined) updateData.favoriteCount = schoolData.favoriteCount;
    if (schoolData.gameStats !== undefined) updateData.gameStats = schoolData.gameStats;
    if (schoolData.isActive !== undefined) updateData.isActive = schoolData.isActive;
    
    // schools 컬렉션 업데이트
    await updateDoc(schoolRef, updateData);
    
    // 학교 이름이 변경된 경우, 해당 학교를 선택한 모든 사용자의 데이터도 업데이트
    if (schoolData.name !== undefined) {
      await updateUsersSchoolName(schoolId, schoolData.name);
    }
  } catch (error) {
    console.error('관리자 학교 수정 오류:', error);
    throw new Error('학교 정보 수정 중 오류가 발생했습니다.');
  }
};

export const adminDeleteSchool = async (schoolId: string): Promise<void> => {
  try {
    const schoolRef = doc(db, 'schools', schoolId);
    await deleteDoc(schoolRef);
  } catch (error) {
    console.error('관리자 학교 삭제 오류:', error);
    throw new Error('학교 삭제 중 오류가 발생했습니다.');
  }
};

/**
 * 학교 활성화/비활성화 토글 (관리자용)
 */
export const adminToggleSchoolStatus = async (schoolId: string, isActive: boolean): Promise<void> => {
  try {
    const schoolRef = doc(db, 'schools', schoolId);
    await updateDoc(schoolRef, {
      isActive,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('학교 상태 변경 오류:', error);
    throw new Error('학교 상태 변경 중 오류가 발생했습니다.');
  }
};

/**
 * 특정 학교를 선택한 모든 사용자의 학교 이름을 업데이트합니다.
 * 배치 처리를 통해 효율적으로 대량 업데이트를 수행합니다.
 */
async function updateUsersSchoolName(schoolId: string, newSchoolName: string): Promise<void> {
  try {
    console.log(`학교 이름 업데이트 시작: ${schoolId} -> ${newSchoolName}`);
    
    // 해당 학교를 선택한 모든 사용자 조회
    const usersQuery = query(
      collection(db, 'users'),
      where('school.id', '==', schoolId)
    );
    
    const usersSnapshot = await getDocs(usersQuery);
    console.log(`업데이트 대상 사용자 수: ${usersSnapshot.size}명`);
    
    if (usersSnapshot.empty) {
      console.log('업데이트할 사용자가 없습니다.');
      return;
    }
    
    // 배치 처리 (Firestore는 배치당 최대 500개 작업 제한)
    let batch = writeBatch(db);
    let batchCount = 0;
    let totalUpdated = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      // school.name 필드 업데이트
      batch.update(userDoc.ref, {
        'school.name': newSchoolName,
        'updatedAt': serverTimestamp()
      });
      
      batchCount++;
      totalUpdated++;
      
      // 500개마다 배치 커밋
      if (batchCount === 500) {
        await batch.commit();
        console.log(`배치 커밋 완료: ${totalUpdated}명 업데이트됨`);
        batch = writeBatch(db);
        batchCount = 0;
      }
    }
    
    // 남은 배치 커밋
    if (batchCount > 0) {
      await batch.commit();
      console.log(`최종 배치 커밋 완료`);
    }
    
    console.log(`✅ 총 ${totalUpdated}명의 사용자 학교 이름 업데이트 완료`);
  } catch (error) {
    console.error('사용자 학교 이름 업데이트 오류:', error);
    // 에러가 발생해도 학교 정보는 업데이트되었으므로 경고만 출력
    console.warn('⚠️ 사용자 데이터 업데이트 중 일부 오류가 발생했습니다.');
  }
}

// 헬퍼 함수들
function getSchoolType(schoolName: string): '초등학교' | '중학교' | '고등학교' | '대학교' {
  if (schoolName.includes('초등학교')) return '초등학교';
  if (schoolName.includes('중학교')) return '중학교';
  if (schoolName.includes('고등학교')) return '고등학교';
  if (schoolName.includes('대학교')) return '대학교';
  return '고등학교';
}

function getDistrict(address: string): string {
  if (!address) return '';
  
  const addressParts = address.split(' ');
  if (addressParts.length >= 2) {
    return addressParts[1];
  }
  return '';
} 
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  QueryDocumentSnapshot,
  updateDoc,
  increment,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { School, FirebaseTimestamp } from '@/types';

/**
 * 학교 목록 검색 (사용자 즐겨찾기 고려)
 */
export const searchSchools = async (
  searchTerm: string = '',
  region?: string,
  page = 1,
  pageSize = 20,
  userId?: string // 사용자 ID를 받아서 즐겨찾기 확인
): Promise<{ schools: School[], totalCount: number, hasMore: boolean }> => {
  try {
    const schoolsRef = collection(db, 'schools');
    let q;

    // 사용자의 즐겨찾기 학교 목록 가져오기
    let favoriteSchoolIds: string[] = [];
    if (userId) {
      try {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          favoriteSchoolIds = userData.favorites?.schools || [];
        }
      } catch (error) {
        console.error('즐겨찾기 학교 목록 조회 오류:', error);
      }
    }

    // 검색어 유무에 따른 쿼리 설정
    if (searchTerm) {
      // 검색어가 있는 경우 - Firestore의 where를 사용해 시작 문자열 일치 검색
      // startAt 및 endAt을 사용하여 검색어로 시작하는 이름 찾기
      const endSearchTerm = searchTerm + '\uf8ff'; // '\uf8ff'는 유니코드 범위에서 매우 높은 값
      
      q = query(
        schoolsRef,
        orderBy('KOR_NAME'),
        where('KOR_NAME', '>=', searchTerm),
        where('KOR_NAME', '<=', endSearchTerm),
        limit(pageSize * 2) // 충분한 결과를 확보하기 위해 요청 페이지 크기의 2배
      );
      
      console.log('Searching with term:', searchTerm);
    } else if (region && region !== 'all') {
      // 지역 필터링
      q = query(
        schoolsRef,
        where('REGION', '==', region),
        orderBy('KOR_NAME'),
        limit(pageSize)
      );
    } else {
      // 검색어가 없는 경우 - 빈 결과 반환 (사용자가 검색어를 입력해야 함)
      return {
        schools: [],
        totalCount: 0,
        hasMore: false
      };
    }

    console.log('Executing school search query');
    const querySnapshot = await getDocs(q);
    console.log('Found schools count:', querySnapshot.size);
    
    const schools: School[] = [];
    
    querySnapshot.forEach((doc: QueryDocumentSnapshot) => {
      const schoolData = doc.data();
      const isActive = schoolData.isActive !== undefined ? schoolData.isActive : true;
      const isFavorited = favoriteSchoolIds.includes(doc.id);
      
      // 활성화되었거나 즐겨찾기한 학교만 포함
      if (isActive || isFavorited) {
        // 검색어가 있으면 includes로 한번 더 필터링하여 '각리초등학교'와 같이 중간에 검색어가 포함된 경우도 찾음
        if (searchTerm && !schoolData.KOR_NAME.toLowerCase().includes(searchTerm.toLowerCase())) {
          return;
        }
        
        schools.push({
          id: doc.id,
          name: schoolData.KOR_NAME,
          address: schoolData.ADDRESS,
          district: schoolData.REGION,
          type: getSchoolType(schoolData.KOR_NAME),
          websiteUrl: schoolData.HOMEPAGE,
          regions: {
            sido: schoolData.REGION,
            sigungu: getDistrict(schoolData.ADDRESS)
          },
          isActive,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          memberCount: schoolData.memberCount || 0,
          favoriteCount: schoolData.favoriteCount || 0
        } as School);
      }
    });
    
    // 전체 결과 수
    const totalCount = schools.length;
    
    // 페이징 처리
    const startIndex = (page - 1) * pageSize;
    const paginatedSchools = schools.slice(startIndex, startIndex + pageSize);
    
    return {
      schools: paginatedSchools,
      totalCount,
      hasMore: totalCount > page * pageSize
    };
  } catch (error) {
    console.error('학교 검색 오류:', error);
    throw new Error('학교를 검색하는 중 오류가 발생했습니다.');
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
        name: schoolData.KOR_NAME,
        address: schoolData.ADDRESS,
        district: schoolData.REGION,
        type: getSchoolType(schoolData.KOR_NAME),
        websiteUrl: schoolData.HOMEPAGE,
        regions: {
          sido: schoolData.REGION,
          sigungu: getDistrict(schoolData.ADDRESS)
        },
        isActive: schoolData.isActive !== undefined ? schoolData.isActive : true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        memberCount: schoolData.memberCount || 0,
        favoriteCount: schoolData.favoriteCount || 0
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
 * 모든 지역(시/도) 목록 가져오기
 */
export const getAllRegions = async (): Promise<string[]> => {
  try {
    const regionsRef = collection(db, 'regions');
    const querySnapshot = await getDocs(regionsRef);
    
    const regions: string[] = [];
    querySnapshot.forEach((doc) => {
      regions.push(doc.id);
    });
    
    return regions.sort();
  } catch (error) {
    console.error('지역 목록 조회 오류:', error);
    throw new Error('지역 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 특정 시/도의 시/군/구 목록 가져오기
 */
export const getDistrictsByRegion = async (region: string): Promise<string[]> => {
  try {
    const regionRef = doc(db, 'regions', region);
    const regionDoc = await getDoc(regionRef);
    
    if (regionDoc.exists()) {
      const regionData = regionDoc.data();
      const sigunguData = regionData.sigungu || {};
      
      // sigungu 객체에서 값만 추출하여 반환
      return Object.values(sigunguData);
    } else {
      return [];
    }
  } catch (error) {
    console.error('시/군/구 목록 조회 오류:', error);
    throw new Error('시/군/구 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

// 학교 이름에서 학교 타입 추출 헬퍼 함수
function getSchoolType(schoolName: string): '초등학교' | '중학교' | '고등학교' | '대학교' {
  if (schoolName.includes('초등학교')) return '초등학교';
  if (schoolName.includes('중학교')) return '중학교';
  if (schoolName.includes('고등학교')) return '고등학교';
  if (schoolName.includes('대학교')) return '대학교';
  
  // 기본값
  return '고등학교';
}

// 주소에서 시/군/구 추출 헬퍼 함수
function getDistrict(address: string): string {
  // 주소 형식: "서울특별시 강남구 xxx" 또는 "경기도 수원시 xxx"
  const parts = address.split(' ');
  
  if (parts.length >= 2) {
    return parts[1]; // 두 번째 요소가 일반적으로 시/군/구
  }
  
  return '';
}

/**
 * 게시글 수 기준으로 인기 학교 목록 가져오기
 */
export const getPopularSchools = async (limit = 10): Promise<School[]> => {
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
      .slice(0, limit)
      .map(([schoolId]) => schoolId);
    
    // 학교 정보 조회 (활성화된 학교만)
    const popularSchools: School[] = [];
    
    for (const schoolId of sortedSchoolIds) {
      const school = await getSchoolById(schoolId);
      // 활성화된 학교만 추가
      if (school && school.isActive !== false) {
        popularSchools.push(school);
      }
    }
    
    return popularSchools;
  } catch (error) {
    console.error('인기 학교 목록 조회 오류:', error);
    // 오류 발생 시 기본 학교 목록 반환 (활성화된 학교만)
    return await getAllSchools();
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

export const getPopularRegions = async (limit = 12): Promise<RegionInfo[]> => {
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
      .slice(0, limit);
    
    return sortedRegions;
  } catch (error) {
    console.error('인기 지역 목록 조회 오류:', error);
    return [];
  }
};

/**
 * 모든 학교 목록 가져오기 (활성화된 학교만)
 */
export const getAllSchools = async (): Promise<School[]> => {
  try {
    const schoolsRef = collection(db, 'schools');
    const q = query(schoolsRef, orderBy('KOR_NAME'), limit(100));
    const querySnapshot = await getDocs(q);
    
    const schools: School[] = [];
    
    querySnapshot.forEach((doc) => {
      const schoolData = doc.data();
      const isActive = schoolData.isActive !== undefined ? schoolData.isActive : true;
      
      // 활성화된 학교만 추가
      if (isActive) {
        schools.push({
          id: doc.id,
          name: schoolData.KOR_NAME,
          address: schoolData.ADDRESS,
          district: schoolData.REGION,
          type: getSchoolType(schoolData.KOR_NAME),
          websiteUrl: schoolData.HOMEPAGE,
          regions: {
            sido: schoolData.REGION,
            sigungu: getDistrict(schoolData.ADDRESS)
          },
          isActive,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          memberCount: schoolData.memberCount || 0,
          favoriteCount: schoolData.favoriteCount || 0
        } as School);
      }
    });
    
    return schools;
  } catch (error) {
    console.error('학교 목록 조회 오류:', error);
    throw new Error('학교 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

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
  try {
    // 사용자 문서 참조
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }
    
    const userData = userDoc.data();
    const favorites = userData.favorites || {};
    const favoriteSchools = favorites.schools || [];
    
    // 학교가 이미 즐겨찾기에 있는지 확인
    const isAlreadyFavorite = favoriteSchools.includes(schoolId);
    
    let updatedFavoriteSchools;
    let message: string;
    
    if (isAlreadyFavorite) {
      // 즐겨찾기 제거
      updatedFavoriteSchools = favoriteSchools.filter((id: string) => id !== schoolId);
      message = '즐겨찾기에서 제거되었습니다.';
    } else {
      // 즐겨찾기 추가 - 5개 제한 체크
      if (favoriteSchools.length >= 5) {
        return {
          success: false,
          isFavorite: false,
          message: '즐겨찾기는 최대 5개 학교까지만 추가할 수 있습니다. 다른 학교를 제거한 후 다시 시도해주세요.',
          favoriteCount: favoriteSchools.length
        };
      }
      
      updatedFavoriteSchools = [...favoriteSchools, schoolId];
      message = '즐겨찾기에 추가되었습니다.';
    }
    
    // 사용자 문서 업데이트
    await updateDoc(userRef, {
      'favorites.schools': updatedFavoriteSchools,
      updatedAt: serverTimestamp()
    });
    
    // 학교 문서의 즐겨찾기 카운트 업데이트
    const schoolRef = doc(db, 'schools', schoolId);
    const schoolDoc = await getDoc(schoolRef);
    
    if (schoolDoc.exists()) {
      const schoolData = schoolDoc.data();
      const currentFavoriteCount = schoolData.favoriteCount || 0;
      
      await updateDoc(schoolRef, {
        favoriteCount: isAlreadyFavorite ? Math.max(0, currentFavoriteCount - 1) : currentFavoriteCount + 1
      });
    }
    
    return {
      success: true,
      isFavorite: !isAlreadyFavorite,
      message,
      favoriteCount: updatedFavoriteSchools.length
    };
  } catch (error) {
    console.error('학교 즐겨찾기 토글 오류:', error);
    return {
      success: false,
      isFavorite: false,
      message: '즐겨찾기를 변경하는 중 오류가 발생했습니다.'
    };
  }
};

/**
 * 학교 선택 함수 (메인 학교로 설정)
 */
export const selectSchool = async (
  userId: string,
  schoolId: string,
  schoolName: string,
  schoolInfo: {
    grade?: string;
    classNumber?: string;
    studentNumber?: string;
    isGraduate?: boolean;
  }
): Promise<boolean> => {
  try {
    // 사용자 참조
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }
    
    const userData = userDoc.data();
    const previousSchool = userData.school ? userData.school.id : null;
    
    // 검색 토큰 업데이트 (학교명이 변경되므로)
    const { generateUserSearchTokens } = await import('@/utils/search-tokens');
    const newSearchTokens = generateUserSearchTokens(
      userData?.profile?.userName,
      userData?.profile?.realName,
      schoolName
    );
    
    // 학교 정보 업데이트
    const schoolUpdate: {
      school: {
        id: string;
        name: string;
        grade: string | null;
        classNumber: string | null;
        studentNumber: string | null;
        isGraduate: boolean;
      };
      searchTokens: string[];
      updatedAt: FirebaseTimestamp;
    } = {
      school: {
        id: schoolId,
        name: schoolName,
        // 졸업생인 경우 학년, 반, 번호 정보를 null로 설정
        grade: schoolInfo.isGraduate ? null : schoolInfo.grade || null,
        classNumber: schoolInfo.isGraduate ? null : schoolInfo.classNumber || null,
        studentNumber: schoolInfo.isGraduate ? null : schoolInfo.studentNumber || null,
        isGraduate: schoolInfo.isGraduate || false
      },
      searchTokens: newSearchTokens,
      updatedAt: serverTimestamp()
    };
    
    await updateDoc(userRef, schoolUpdate);
    
    // 이전 학교와 현재 선택한 학교가 다른 경우
    if (previousSchool && previousSchool !== schoolId) {
      // 이전 학교의 회원 수 감소
      const prevSchoolRef = doc(db, 'schools', previousSchool);
      const prevSchoolDoc = await getDoc(prevSchoolRef);
      
      if (prevSchoolDoc.exists()) {
        const prevSchoolData = prevSchoolDoc.data();
        const currentMemberCount = prevSchoolData.memberCount || 0;
        
        await updateDoc(prevSchoolRef, {
          memberCount: Math.max(0, currentMemberCount - 1),
          updatedAt: serverTimestamp()
        });
      }
      
      // 새 학교의 회원 수 증가
      const newSchoolRef = doc(db, 'schools', schoolId);
      await updateDoc(newSchoolRef, {
        memberCount: increment(1),
        updatedAt: serverTimestamp()
      });
    } else if (!previousSchool) {
      // 처음으로 학교를 선택하는 경우, 해당 학교의 회원 수만 증가
      const schoolRef = doc(db, 'schools', schoolId);
      await updateDoc(schoolRef, {
        memberCount: increment(1),
        updatedAt: serverTimestamp()
      });
    }
    
    return true;
  } catch (error) {
    console.error('학교 선택 오류:', error);
    throw new Error('학교 선택 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자의 즐겨찾기 학교 목록 가져오기
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
    const favoriteSchoolIds = favorites.schools || [];
    
    if (favoriteSchoolIds.length === 0) {
      return [];
    }
    
    // 즐겨찾기 학교 정보 조회
    const favoriteSchools: School[] = [];
    
    for (const schoolId of favoriteSchoolIds) {
      const school = await getSchoolById(schoolId);
      if (school) {
        favoriteSchools.push(school);
      }
    }
    
    return favoriteSchools;
  } catch (error) {
    console.error('즐겨찾기 학교 목록 조회 오류:', error);
    throw new Error('즐겨찾기 학교 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

// 추천 아이디 검증 및 경험치 지급
export const validateReferralAndReward = async (
  newUserId: string,
  referralUserName: string
): Promise<{ success: boolean; message: string; referrerId?: string }> => {
  try {
    if (!referralUserName || referralUserName.trim() === '') {
      return { success: false, message: '추천 아이디를 입력해주세요.' };
    }

    // 추천인 검색 (userName으로 검색)
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('profile.userName', '==', referralUserName.trim()),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return { success: false, message: '존재하지 않는 사용자입니다.' };
    }

    const referrerDoc = querySnapshot.docs[0];
    const referrerId = referrerDoc.id;
    const referrerData = referrerDoc.data();

    // 자기 자신 추천 방지
    if (referrerId === newUserId) {
      return { success: false, message: '자기 자신을 추천할 수 없습니다.' };
    }

    // 시스템 설정에서 추천인 경험치 값 가져오기
    const { getExperienceSettings } = await import('./admin');
    const expSettings = await getExperienceSettings();
    
    const referrerExp = expSettings.referral?.referrerXP || 30; // 추천인이 받는 경험치
    const refereeExp = expSettings.referral?.refereeXP || 30;   // 추천받은 사람이 받는 경험치

    // 추천인 경험치 업데이트 (레벨업 계산 포함)
    const { updateUserExperience } = await import('../experience');
    await updateUserExperience(referrerId, referrerExp);

    // 신규 사용자 경험치 업데이트 (레벨업 계산 포함)
    await updateUserExperience(newUserId, refereeExp);

    // 신규 사용자에게 추천인 정보 저장
    await updateDoc(doc(db, 'users', newUserId), {
      referrerId: referrerId,
      updatedAt: serverTimestamp()
    });

    return { 
      success: true, 
      message: `${referrerData.profile.userName}님을 추천했습니다! ${referrerData.profile.userName}님은 ${referrerExp}XP, 회원님은 ${refereeExp}XP를 받았습니다.`,
      referrerId: referrerId
    };
  } catch (error) {
    console.error('추천 처리 오류:', error);
    return { success: false, message: '추천 처리 중 오류가 발생했습니다.' };
  }
};

// 추천 아이디 중복 확인
export const checkReferralExists = async (userName: string): Promise<{ exists: boolean; displayName?: string }> => {
  try {
    if (!userName || userName.trim() === '') {
      return { exists: false };
    }

    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('profile.userName', '==', userName.trim()),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const userData = querySnapshot.docs[0].data();
      return { 
        exists: true, 
        displayName: userData.profile.userName || '사용자'
      };
    }

    return { exists: false };
  } catch (error) {
    console.error('추천 아이디 확인 오류:', error);
    return { exists: false };
  }
};

/**
 * 사용자가 특정 학교 커뮤니티에 접근할 수 있는지 확인
 * 로그인 여부와 관계없이 모든 사용자가 학교 커뮤니티에 접근 가능 (읽기 전용)
 */
export const checkSchoolAccess = async (
  userId: string | null,
  schoolId: string
): Promise<{
  hasAccess: boolean;
  reason?: string;
  isGuest?: boolean;
}> => {
  try {
    // 학교 문서 존재 여부 확인
    const schoolRef = doc(db, 'schools', schoolId);
    const schoolDoc = await getDoc(schoolRef);
    
    if (!schoolDoc.exists()) {
      return {
        hasAccess: false,
        reason: '존재하지 않는 학교입니다.'
      };
    }
    
    // 로그인하지 않은 사용자 (게스트)
    if (!userId) {
      return {
        hasAccess: true,
        isGuest: true
      };
    }
    
    // 로그인된 사용자 확인
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      // 사용자 정보가 없어도 게스트로 접근 허용
      return {
        hasAccess: true,
        isGuest: true
      };
    }
    
    // 로그인된 사용자는 모든 학교 커뮤니티에 접근 가능
    return {
      hasAccess: true,
      isGuest: false
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
 * 사용자의 접근 가능한 학교 목록 가져오기 (즐겨찾기 기반)
 */
export const getAccessibleSchools = async (userId: string): Promise<School[]> => {
  try {
    return await getUserFavoriteSchools(userId);
  } catch (error) {
    console.error('접근 가능한 학교 목록 조회 오류:', error);
    return [];
  }
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
    const schoolId = userData.school?.id;
    
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
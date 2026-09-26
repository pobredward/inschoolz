import { ensureUserProfile } from './community-client';
import { User } from '../types';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { signInWithCustomToken, updateProfile } from 'firebase/auth';
import { db, auth } from './firebase';
import { logger } from '../utils/logger';
import { login, logout, unlink } from '@react-native-kakao/user';
import { generateUserSearchTokens } from '../utils/search-tokens';
import { fetchJsonWithRetry } from '../utils/network-utils';

// 카카오 사용자 정보 인터페이스
export interface KakaoUserInfo {
  id: number;
  kakao_account: {
    email?: string;
    profile?: {
      nickname?: string;
      profile_image_url?: string;
      thumbnail_image_url?: string;
    };
    phone_number?: string;
    birthday?: string;
    birthyear?: string;
    gender?: 'female' | 'male';
  };
}

// 카카오 로그인 응답 인터페이스 (최신 API 사용)
export interface KakaoAuthResponse {
  accessToken: string;
  refreshToken: string;
  idToken?: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  scopes?: string[];
}

/**
 * 카카오 액세스 토큰으로 사용자 정보 가져오기
 */
export const getKakaoUserInfo = async (accessToken: string): Promise<KakaoUserInfo> => {
  try {
    const response = await fetch('https://kapi.kakao.com/v2/user/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('카카오 사용자 정보 조회 실패:', response.status, errorText);
      throw new Error(`카카오 사용자 정보 조회 실패: ${response.status}`);
    }

    const userData: KakaoUserInfo = await response.json();
    logger.debug('카카오 사용자 정보 조회 성공:', userData);
    return userData;
  } catch (error) {
    logger.error('카카오 사용자 정보 조회 오류:', error);
    throw error;
  }
};

/**
 * 카카오 액세스 토큰으로 서버에서 Firebase 커스텀 토큰 받기
 * ✅ 재시도 로직 및 타임아웃 추가
 */
export const getFirebaseTokenFromKakao = async (accessToken: string): Promise<string> => {
  try {
    logger.debug('🔗 Firebase 커스텀 토큰 요청 시작');
    logger.debug('🔑 액세스 토큰 길이:', accessToken?.length || 0);
    
    // ✅ 재시도 로직이 포함된 fetch 사용
    const data = await fetchJsonWithRetry<{ customToken: string }>(
      'https://www.inschoolz.com/api/auth/kakao/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accessToken }),
        maxRetries: 3,        // 최대 3회 재시도
        timeoutMs: 10000,     // 10초 타임아웃
        retryDelay: 1000,     // 1초 기본 지연 (지수 백오프)
      }
    );

    logger.debug('✅ 서버 응답 데이터 키:', Object.keys(data));
    
    if (!data.customToken) {
      logger.error('❌ 커스텀 토큰이 응답에 없음:', data);
      throw new Error('커스텀 토큰이 서버 응답에 포함되지 않음');
    }
    
    logger.debug('🎟️ Firebase 커스텀 토큰 생성 완료');
    return data.customToken;
  } catch (error) {
    logger.error('❌ Firebase 토큰 생성 실패:', error);
    
    // 사용자 친화적인 에러 메시지
    if (error instanceof Error) {
      if (error.message.includes('abort')) {
        throw new Error('서버 연결 시간이 초과되었습니다. 네트워크 상태를 확인해주세요.');
      } else if (error.message.includes('Network')) {
        throw new Error('네트워크 연결을 확인해주세요.');
      } else if (error.message.includes('HTTP 5')) {
        throw new Error('서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
      }
    }
    
    throw new Error('카카오 로그인 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
  }
};

/**
 * 카카오 사용자 정보를 Firebase User 형식으로 변환
 */
export const convertKakaoUserToFirebaseUser = (kakaoUser: KakaoUserInfo, uid: string): User => {
  const profile = kakaoUser.kakao_account.profile;
  const birthday = kakaoUser.kakao_account.birthday;
  const birthyear = kakaoUser.kakao_account.birthyear;
  const userName = profile?.nickname || `카카오사용자${kakaoUser.id}`;
  
  // 카카오 HTTP URL을 HTTPS로 변환
  const convertKakaoUrlToHttps = (url?: string): string => {
    if (!url) return '';
    
    // 카카오 CDN HTTP URL을 HTTPS로 변환
    if (url.startsWith('http://k.kakaocdn.net/')) {
      return url.replace('http://', 'https://');
    }
    
    return url;
  };

  // 프로필 이미지 URL 로그 추가
  const originalImageUrl = profile?.profile_image_url || '';
  const profileImageUrl = convertKakaoUrlToHttps(originalImageUrl);
  
  logger.debug('🖼️ 프로필 이미지 URL 설정:', {
    original: originalImageUrl,
    thumbnail: profile?.thumbnail_image_url,
    converted: profileImageUrl,
    wasConverted: originalImageUrl !== profileImageUrl
  });

  // 검색 토큰 생성
  const searchTokens = generateUserSearchTokens(userName);

  return {
    uid,
    email: kakaoUser.kakao_account.email || '',
    role: 'student',
    status: 'active',
    isVerified: true,
    fake: false, // 실제 사용자 표시
    searchTokens, // 검색 토큰 추가
    profile: {
      userName,
      realName: '',
      gender: kakaoUser.kakao_account.gender === 'female' ? '여성' : 
              kakaoUser.kakao_account.gender === 'male' ? '남성' : '',
      birthYear: birthyear ? parseInt(birthyear) : 0,
      birthMonth: birthday ? parseInt(birthday.substring(0, 2)) : 0,
      birthDay: birthday ? parseInt(birthday.substring(2, 4)) : 0,
      phoneNumber: kakaoUser.kakao_account.phone_number || '',
      profileImageUrl: profileImageUrl,
      createdAt: Timestamp.now(),
      isAdmin: false
    },
    stats: {
      level: 1,
      currentExp: 0,
      totalExperience: 0,
      currentLevelRequiredXp: 10,
      postCount: 0,
      commentCount: 0,
      likeCount: 0,
      streak: 0
    },
    agreements: {
      terms: true,
      privacy: true,
      location: false,
      marketing: false
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
};

/**
 * 카카오 로그인 (앱용) - React Native Kakao
 */
export const loginWithKakao = async (): Promise<User> => {
  try {
    logger.debug('카카오 로그인 시작');

    // 1. 카카오 로그인 수행 (@react-native-kakao/user)
    const loginResult = await login();
    logger.debug('카카오 로그인 성공:', {
      hasAccessToken: !!loginResult.accessToken,
      accessTokenLength: loginResult.accessToken?.length || 0
    });

    // 2. 카카오 사용자 정보 가져오기 (getProfile 사용)
    const kakaoUser = await getKakaoUserInfo(loginResult.accessToken);
    logger.debug('카카오 사용자 정보 조회 완료:', kakaoUser.kakao_account.profile?.nickname);

    // 3. 서버에서 Firebase 커스텀 토큰 받기
    const customToken = await getFirebaseTokenFromKakao(loginResult.accessToken);
    logger.debug('Firebase 커스텀 토큰 생성 완료');

    // 4. Firebase 로그인
    const userCredential = await signInWithCustomToken(auth, customToken);
    const firebaseUser = userCredential.user;
    logger.debug('Firebase 로그인 완료:', firebaseUser.uid);

    // 5. Firebase Auth 프로필 업데이트
    try {
      await updateProfile(firebaseUser, {
        displayName: kakaoUser.kakao_account.profile?.nickname || `카카오사용자${kakaoUser.id}`,
        photoURL: kakaoUser.kakao_account.profile?.profile_image_url || null,
      });
      logger.debug('Firebase Auth 프로필 업데이트 성공');
    } catch (profileError) {
      logger.warn('Firebase Auth 프로필 업데이트 실패 (무시하고 계속):', profileError);
    }

    // 6. Firestore에서 사용자 정보 확인/생성
    return ensureUserProfile();

  } catch (error) {
    logger.error('카카오 로그인 실패:', error);
    throw error;
  }
};

/**
 * 카카오 로그아웃 - @react-native-kakao/user
 */
export const logoutFromKakao = async (): Promise<void> => {
  try {
    await logout();
    logger.debug('카카오 로그아웃 완료');
  } catch (error) {
    logger.error('카카오 로그아웃 오류:', error);
    // 로그아웃 실패해도 앱 로그아웃은 진행
  }
};

/**
 * 카카오 연동 해제 - @react-native-kakao/user
 */
export const unlinkKakao = async (): Promise<void> => {
  try {
    await unlink();
    logger.debug('카카오 연동 해제 완료');
  } catch (error) {
    logger.error('카카오 연동 해제 실패:', error);
    throw error;
  }
};

/**
 * 최적화된 카카오 로그인 - @react-native-kakao/user
 */
export const loginWithKakaoOptimized = async (): Promise<User> => {
  try {
    logger.debug('카카오 로그인 시작');
    logger.debug('카카오 SDK 사용 가능 여부:', typeof login);

    // 카카오 SDK 사용 가능 여부 확인
    if (typeof login !== 'function') {
      logger.error('❌ 카카오 SDK를 사용할 수 없습니다!');
      throw new Error('카카오 로그인을 사용할 수 없습니다. Development Build가 필요합니다.');
    }

    logger.debug('✅ 카카오 SDK 사용 가능 - login() 호출 시작');
    
    // 1. 카카오 로그인 수행 (@react-native-kakao/user - 자동으로 최적 방식 선택)
    const loginResult = await login();
    logger.debug('✅ login() 호출 완료');
    logger.debug('카카오 로그인 성공:', {
      hasAccessToken: !!loginResult.accessToken,
      accessTokenLength: loginResult.accessToken?.length || 0
    });

    // 2. 카카오 사용자 정보 가져오기 (getProfile 사용)
    const kakaoUser = await getKakaoUserInfo(loginResult.accessToken);
    logger.debug('카카오 사용자 정보 조회 완료:', {
      nickname: kakaoUser.kakao_account.profile?.nickname,
      profile_image_url: kakaoUser.kakao_account.profile?.profile_image_url,
      thumbnail_image_url: kakaoUser.kakao_account.profile?.thumbnail_image_url
    });

    // 3. 서버에서 Firebase 커스텀 토큰 받기
    const customToken = await getFirebaseTokenFromKakao(loginResult.accessToken);
    logger.debug('Firebase 커스텀 토큰 생성 완료');

    // 4. Firebase 로그인
    const userCredential = await signInWithCustomToken(auth, customToken);
    const firebaseUser = userCredential.user;
    logger.debug('Firebase 로그인 완료:', firebaseUser.uid);

    // 5. Firebase Auth 프로필 업데이트
    try {
      await updateProfile(firebaseUser, {
        displayName: kakaoUser.kakao_account.profile?.nickname || `카카오사용자${kakaoUser.id}`,
        photoURL: kakaoUser.kakao_account.profile?.profile_image_url || null,
      });
      logger.debug('Firebase Auth 프로필 업데이트 성공');
    } catch (profileError) {
      logger.warn('Firebase Auth 프로필 업데이트 실패 (무시하고 계속):', profileError);
    }

    // 6. Firestore에서 사용자 정보 확인/생성
    return ensureUserProfile();

  } catch (error) {
    logger.error('카카오 로그인 실패:', error);
    throw error;
  }
};

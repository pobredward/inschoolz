'use client';

import { User } from '@/types';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { signInWithCustomToken } from 'firebase/auth';
import { db, auth } from './firebase';
import { generateUserSearchTokens } from '@/utils/search-tokens';

// 카카오 SDK 타입 정의
declare global {
  interface Window {
    Kakao: any;
  }
}

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

// 카카오 로그인 응답 인터페이스
export interface KakaoAuthResponse {
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  refresh_token_expires_in: number;
}

/**
 * 카카오 SDK 초기화
 */
export const initializeKakao = (): Promise<boolean> => {
  return new Promise((resolve) => {
    // 이미 초기화되어 있으면 바로 반환
    if (window.Kakao && window.Kakao.isInitialized()) {
      resolve(true);
      return;
    }

    // 카카오 SDK 스크립트 로드
    if (!document.getElementById('kakao-sdk')) {
      const script = document.createElement('script');
      script.id = 'kakao-sdk';
      script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js';
      script.integrity = 'sha384-TiCUE00h649CAMonG018J2ujOgDKW/kVWlChEuu4jK2vxfAAD0eZxzCKakxg55G4';
      script.crossOrigin = 'anonymous';
      
      script.onload = () => {
        if (window.Kakao) {
          const appKey = process.env.NEXT_PUBLIC_KAKAO_APP_KEY;
          if (appKey) {
            window.Kakao.init(appKey);
            console.log('✅ 카카오 SDK 초기화 완료');
            resolve(true);
          } else {
            console.error('❌ KAKAO_APP_KEY가 설정되지 않았습니다.');
            resolve(false);
          }
        } else {
          console.error('❌ 카카오 SDK 로드 실패');
          resolve(false);
        }
      };
      
      script.onerror = () => {
        console.error('❌ 카카오 SDK 스크립트 로드 실패');
        resolve(false);
      };
      
      document.head.appendChild(script);
    } else {
      // 스크립트는 이미 로드되었지만 초기화되지 않은 경우
      if (window.Kakao && !window.Kakao.isInitialized()) {
        const appKey = process.env.NEXT_PUBLIC_KAKAO_APP_KEY;
        if (appKey) {
          window.Kakao.init(appKey);
          console.log('✅ 카카오 SDK 재초기화 완료');
          resolve(true);
        } else {
          console.error('❌ KAKAO_APP_KEY가 설정되지 않았습니다.');
          resolve(false);
        }
      } else {
        resolve(true);
      }
    }
  });
};

/**
 * 카카오 로그인 (팝업 방식)
 */
export const loginWithKakaoPopup = (): Promise<KakaoAuthResponse> => {
  return new Promise((resolve, reject) => {
    if (!window.Kakao || !window.Kakao.isInitialized()) {
      reject(new Error('카카오 SDK가 초기화되지 않았습니다.'));
      return;
    }

    window.Kakao.Auth.login({
      success: (authObj: KakaoAuthResponse) => {
        console.log('✅ 카카오 로그인 성공:', authObj);
        resolve(authObj);
      },
      fail: (err: any) => {
        console.error('❌ 카카오 로그인 실패:', err);
        reject(new Error('카카오 로그인에 실패했습니다.'));
      },
    });
  });
};

/**
 * 카카오 로그인 (리다이렉트 방식) - 프로덕션 환경 권장
 */
export const loginWithKakaoRedirect = () => {
  const appKey = process.env.NEXT_PUBLIC_KAKAO_APP_KEY;
  
  if (!appKey) {
    throw new Error('KAKAO_APP_KEY가 설정되지 않았습니다.');
  }

  // 환경별 리다이렉트 URI 설정
  const getRedirectUri = () => {
    if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI;
    
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const port = window.location.port;
    
    // 개발 환경 (localhost)
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//${hostname}${port ? `:${port}` : ''}/api/auth/callback/kakao`;
    }
    
    // 프로덕션 환경
    return process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI || 'https://inschoolz.com/api/auth/callback/kakao';
  };

  const redirectUri = getRedirectUri();
  const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${appKey}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
  
  console.log('🔍 카카오 로그인 설정:', {
    appKey: appKey?.substring(0, 8) + '...',
    redirectUri,
    environment: typeof window !== 'undefined' ? window.location.hostname : 'server'
  });
  
  // 현재 페이지 URL을 저장하여 로그인 후 리다이렉트
  if (typeof window !== 'undefined') {
    const currentPath = window.location.pathname;
    // 로그인/회원가입 페이지에서 카카오 로그인하면 메인 페이지로 이동
    const shouldRedirectToHome = currentPath === '/login' || currentPath === '/signup' || currentPath.startsWith('/auth');
    const redirectUrl = shouldRedirectToHome ? '/' : window.location.href;
    
    console.log('🔗 카카오 로그인 리다이렉트 설정:', {
      currentPath,
      shouldRedirectToHome,
      redirectUrl
    });
    
    sessionStorage.setItem('kakao_login_redirect', redirectUrl);
  }
  
  window.location.href = kakaoAuthUrl;
};

/**
 * 카카오 사용자 정보 가져오기
 */
export const getKakaoUserInfo = (): Promise<KakaoUserInfo> => {
  return new Promise((resolve, reject) => {
    if (!window.Kakao || !window.Kakao.isInitialized()) {
      reject(new Error('카카오 SDK가 초기화되지 않았습니다.'));
      return;
    }

    window.Kakao.API.request({
      url: '/v2/user/me',
      success: (res: KakaoUserInfo) => {
        console.log('✅ 카카오 사용자 정보 조회 성공:', res);
        resolve(res);
      },
      fail: (err: any) => {
        console.error('❌ 카카오 사용자 정보 조회 실패:', err);
        reject(new Error('사용자 정보를 가져올 수 없습니다.'));
      },
    });
  });
};

/**
 * 카카오 액세스 토큰으로 서버에서 Firebase 커스텀 토큰 받기
 */
export const getFirebaseTokenFromKakao = async (accessToken: string): Promise<string> => {
  try {
    const response = await fetch('/api/auth/kakao/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accessToken }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Firebase 토큰 생성 실패');
    }

    const data = await response.json();
    return data.customToken;
  } catch (error) {
    console.error('❌ Firebase 토큰 생성 실패:', error);
    throw error;
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

  // 검색 토큰 생성
  const searchTokens = generateUserSearchTokens(userName);

  return {
    uid,
    email: kakaoUser.kakao_account.email || '',
    role: 'student',
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
      profileImageUrl: profile?.profile_image_url || '',
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
 * 통합 카카오 로그인 함수
 */
export const loginWithKakao = async (): Promise<User> => {
  try {
    // 1. 카카오 SDK 초기화
    const isInitialized = await initializeKakao();
    if (!isInitialized) {
      throw new Error('카카오 SDK 초기화에 실패했습니다.');
    }

    // 2. 카카오 로그인 (팝업 방식)
    const authResponse = await loginWithKakaoPopup();
    
    // 3. 카카오 사용자 정보 가져오기
    const kakaoUser = await getKakaoUserInfo();
    
    // 4. 서버에서 Firebase 커스텀 토큰 받기
    const customToken = await getFirebaseTokenFromKakao(authResponse.access_token);
    
    // 5. Firebase 로그인
    const userCredential = await signInWithCustomToken(auth, customToken);
    const firebaseUser = userCredential.user;
    
    // 5.5. Firebase Auth 프로필 업데이트 (이메일과 displayName 설정)
    try {
      const { updateProfile } = await import('firebase/auth');
      await updateProfile(firebaseUser, {
        displayName: kakaoUser.kakao_account.profile?.nickname || `카카오사용자${kakaoUser.id}`,
        photoURL: kakaoUser.kakao_account.profile?.profile_image_url || null,
      });
      console.log('✅ Firebase Auth 프로필 업데이트 성공:', {
        displayName: firebaseUser.displayName,
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL
      });
    } catch (profileError) {
      console.warn('⚠️ Firebase Auth 프로필 업데이트 실패 (무시하고 계속):', profileError);
    }
    
    // 6. Firestore에서 사용자 정보 확인/생성
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    
    if (userDoc.exists()) {
      // 기존 사용자: 마지막 로그인 시간 업데이트
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      return userDoc.data() as User;
    } else {
      // 신규 사용자: Firestore에 정보 저장
      const newUser = convertKakaoUserToFirebaseUser(kakaoUser, firebaseUser.uid);
      await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
      
      return newUser;
    }
  } catch (error) {
    console.error('❌ 카카오 로그인 실패:', error);
    throw error;
  }
};

/**
 * 카카오 로그아웃
 */
export const logoutFromKakao = (): Promise<void> => {
  return new Promise((resolve) => {
    if (!window.Kakao || !window.Kakao.isInitialized()) {
      resolve();
      return;
    }

    window.Kakao.Auth.logout(() => {
      console.log('✅ 카카오 로그아웃 완료');
      resolve();
    });
  });
};

/**
 * 카카오 연동 해제
 */
export const unlinkKakao = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!window.Kakao || !window.Kakao.isInitialized()) {
      reject(new Error('카카오 SDK가 초기화되지 않았습니다.'));
      return;
    }

    window.Kakao.API.request({
      url: '/v1/user/unlink',
      success: () => {
        console.log('✅ 카카오 연동 해제 완료');
        resolve();
      },
      fail: (err: any) => {
        console.error('❌ 카카오 연동 해제 실패:', err);
        reject(new Error('카카오 연동 해제에 실패했습니다.'));
      },
    });
  });
};

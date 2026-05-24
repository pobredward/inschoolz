'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  onAuthStateChanged, 
  signOut as firebaseSignOut,
  User as FirebaseUser 
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserById } from '@/lib/api/users';
import { loginWithEmail, loginWithGoogle, registerWithEmail } from '@/lib/auth';
import { signUp as signUpAPI } from '@/lib/api/auth';
import { User, FormDataType } from '@/types';
import { checkSuspensionStatus, SuspensionStatus } from '@/lib/auth/suspension-check';
import { toast } from 'sonner';
import { logAuthPersistenceStatus, testAuthPersistence } from '@/lib/auth-persistence';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  error: string | null;
  suspensionStatus: SuspensionStatus | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (emailOrFormData: string | FormDataType, password?: string, userName?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  checkSuspension: () => void;
  resetError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// 쿠키 설정 함수 (기본 30일 지속)
const setCookie = (name: string, value: string, days = 30) => {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  
  // 프로덕션 환경에서는 secure 옵션 포함, SameSite=Lax로 변경하여 클라이언트 라우팅 허용
  const isProduction = process.env.NODE_ENV === 'production';
  const secureOption = isProduction ? '; secure' : '';
  const sameSiteOption = '; samesite=lax'; // strict에서 lax로 변경
  
  const cookieString = `${name}=${value}; expires=${expires.toUTCString()}; path=/${secureOption}${sameSiteOption}`;
  document.cookie = cookieString;
  
  // 프로덕션에서도 중요한 쿠키 로그는 유지 (에러 추적용)
  if (typeof window !== 'undefined') {
    (window as any).__authDebug = (window as any).__authDebug || [];
    (window as any).__authDebug.push(`🍪 쿠키 설정: ${name} (${days}일 지속) at ${new Date().toISOString()}`);
  }
  
  console.log(`🍪 쿠키 설정: ${name} (${days}일 지속)`);
};

// 쿠키 삭제 함수
const deleteCookie = (name: string) => {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
};

// 토큰 자동 갱신 타이머 저장
let tokenRefreshTimer: NodeJS.Timeout | null = null;

// 토큰 자동 갱신 설정
const setupTokenRefresh = (firebaseUser: FirebaseUser) => {
  // 기존 타이머 정리
  if (tokenRefreshTimer) {
    clearInterval(tokenRefreshTimer);
  }
  
  // 50분마다 토큰 갱신 (Firebase ID 토큰은 1시간 만료)
  tokenRefreshTimer = setInterval(async () => {
    try {
      console.log('🔄 토큰 자동 갱신 시작');
      const newToken = await firebaseUser.getIdToken(true);
      setCookie('authToken', newToken, 1);
      console.log('✅ 토큰 자동 갱신 완료');
    } catch (error) {
      console.error('❌ 토큰 자동 갱신 실패:', error);
      // 갱신 실패 시 로그아웃 처리할 수도 있음
    }
  }, 50 * 60 * 1000); // 50분
  
  console.log('⏰ 토큰 자동 갱신 타이머 설정 완료 (50분 간격)');
};

// 토큰 갱신 타이머 정리
const clearTokenRefresh = () => {
  if (tokenRefreshTimer) {
    clearInterval(tokenRefreshTimer);
    tokenRefreshTimer = null;
    console.log('🛑 토큰 자동 갱신 타이머 정리 완료');
  }
};

interface AuthProviderProps {
  children: ReactNode;
}

// 프로덕션 환경에서 디버깅을 위한 전역 함수
if (typeof window !== 'undefined') {
  (window as any).__getAuthDebug = () => {
    return (window as any).__authDebug || [];
  };
  
  (window as any).__clearAuthDebug = () => {
    (window as any).__authDebug = [];
  };
  
  (window as any).__checkCookies = () => {
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [name, value] = cookie.trim().split('=');
      acc[name] = value;
      return acc;
    }, {} as Record<string, string>);
    
    return {
      authToken: !!cookies.authToken,
      uid: !!cookies.uid,
      userId: !!cookies.userId,
      userRole: !!cookies.userRole,
      raw: cookies
    };
  };
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suspensionStatus, setSuspensionStatus] = useState<SuspensionStatus | null>(null);

  const resetError = () => {
    setError(null);
  };

  // 사용자 정보와 쿠키 설정
  const setUserAndCookies = async (userData: User, firebaseUser: FirebaseUser) => {
    try {
      console.log('🍪 AuthProvider: 사용자 상태 및 쿠키 설정 시작', { 
        uid: userData.uid, 
        userName: userData.profile?.userName 
      });
      
      // 쿠키를 먼저 설정하여 미들웨어와의 동기화 문제 해결
      try {
        // Firebase ID 토큰 가져오기 (강제 새로고침)
        const idToken = await firebaseUser.getIdToken(true);
        console.log('🔑 AuthProvider: Firebase ID 토큰 획득 완료');
        
        // 쿠키 즉시 설정 (미들웨어 동기화를 위해)
        setCookie('authToken', idToken, 1); // 1일
        setCookie('uid', userData.uid, 30); // 30일
        setCookie('userId', userData.uid, 30); // 백업용, 30일
        setCookie('userRole', userData.role, 30); // 30일
        
        console.log('✅ AuthProvider: 모든 쿠키 설정 완료 (상태 설정 전)', {
          authToken: '설정됨 (1일)',
          uid: userData.uid,
          userRole: userData.role
        });

        // 쿠키 설정 완료 후 상태 업데이트
        setUser(userData);
        
        // 프로덕션 환경에서 쿠키 설정이 완료될 때까지 더 오래 대기
        const isProduction = process.env.NODE_ENV === 'production';
        const waitTime = isProduction ? 500 : 100; // 프로덕션에서는 500ms
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // 토큰 자동 갱신 설정 (50분마다 갱신)
        setupTokenRefresh(firebaseUser);
        
        // 사용자 정지 상태 확인
        const suspensionStatus = checkSuspensionStatus(userData);
        setSuspensionStatus(suspensionStatus);
        
        if (suspensionStatus.isSuspended) {
          console.log('⚠️ 정지된 사용자 감지:', suspensionStatus);
        } else {
          console.log('✅ 정지되지 않은 사용자');
        }
      } catch (tokenError) {
        console.error('❌ AuthProvider: 토큰 및 쿠키 설정 실패:', tokenError);
        // 토큰 획득 실패 시에도 최소한의 정보 설정
        setCookie('uid', userData.uid, 30);
        setCookie('userRole', userData.role, 30);
        setUser(userData);
        throw tokenError;
      }
    } catch (error) {
      console.error('❌ AuthProvider: 쿠키 설정 오류:', error);
    }
  };

  // 인증 정보 초기화 및 쿠키 삭제
  const clearAuthAndCookies = () => {
    setUser(null);
    setFirebaseUser(null);
    setSuspensionStatus(null);
    setError(null);
    
    // 토큰 갱신 타이머 정리
    clearTokenRefresh();
    
    // 쿠키 삭제
    deleteCookie('authToken');
    deleteCookie('uid');
    deleteCookie('userId');
    deleteCookie('userRole');
    
    console.log('🧹 AuthProvider: 모든 인증 정보 및 타이머 정리 완료');
  };

  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      console.log('🚀 AuthProvider: signIn 시작');
      await loginWithEmail(email, password);
      console.log('✅ AuthProvider: loginWithEmail 완료, onAuthStateChanged 대기 중...');
      
      // Firebase Auth의 onAuthStateChanged가 트리거되어 사용자 상태가 업데이트될 때까지 대기
      // 이는 로그인 직후 즉시 라우팅할 때 사용자 상태가 확실히 설정되도록 함
      await new Promise<void>((resolve) => {
        const checkAuth = () => {
          if (auth.currentUser && !isLoading) {
            console.log('✅ AuthProvider: 인증 상태 확인 완료');
            resolve();
          } else {
            setTimeout(checkAuth, 100);
          }
        };
        checkAuth();
      });
      
      console.log('🎉 AuthProvider: 로그인 프로세스 완전히 완료');
      toast.success('로그인되었습니다.');
    } catch (error) {
      console.error('❌ AuthProvider: 로그인 오류:', error);
      setError(error instanceof Error ? error.message : '로그인 중 오류가 발생했습니다.');
      throw error; // 에러를 다시 throw하여 LoginPageClient에서 처리할 수 있도록 함
    }
  };

  const signUp = async (emailOrFormData: string | FormDataType, password?: string, userName?: string) => {
    try {
      setError(null);
      console.log('🚀 AuthProvider: 회원가입 시작', { 
        type: typeof emailOrFormData === 'object' ? 'FormData' : 'Simple',
        email: typeof emailOrFormData === 'object' ? emailOrFormData.email : emailOrFormData 
      });
      
      // 복잡한 FormDataType이 전달된 경우
      if (typeof emailOrFormData === 'object') {
        console.log('📝 AuthProvider: 복잡한 회원가입 처리 중...');
        await signUpAPI(emailOrFormData);
        console.log('✅ AuthProvider: signUpAPI 완료, Firebase Auth 상태 변화 대기 중...');
        // signUpAPI는 Firebase Auth에 계정을 생성하고 Firestore에 사용자 정보를 저장
        // Firebase Auth의 onAuthStateChanged가 자동으로 트리거되어 사용자 상태가 업데이트됨
      } else {
        // 간단한 이메일/비밀번호/이름이 전달된 경우
        if (!password || !userName) {
          throw new Error('비밀번호와 사용자명이 필요합니다.');
        }
        console.log('📝 AuthProvider: 간단한 회원가입 처리 중...');
        await registerWithEmail(emailOrFormData, password, userName);
        console.log('✅ AuthProvider: registerWithEmail 완료, Firebase Auth 상태 변화 대기 중...');
      }
      
      // 잠시 대기하여 Firebase Auth 상태 변화가 제대로 처리되도록 함
      console.log('⏳ AuthProvider: Firebase Auth 상태 업데이트 대기 중...');
      
      toast.success('회원가입이 완료되었습니다. 환영합니다!');
    } catch (error) {
      console.error('❌ AuthProvider: 회원가입 오류:', error);
      setError(error instanceof Error ? error.message : '회원가입 중 오류가 발생했습니다.');
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    try {
      setError(null);
      console.log('🚀 AuthProvider: Google signIn 시작');
      await loginWithGoogle();
      console.log('✅ AuthProvider: loginWithGoogle 완료, onAuthStateChanged 대기 중...');
      
      // Firebase Auth의 onAuthStateChanged가 트리거되어 사용자 상태가 업데이트될 때까지 대기
      await new Promise<void>((resolve) => {
        const checkAuth = () => {
          if (auth.currentUser && !isLoading) {
            console.log('✅ AuthProvider: Google 인증 상태 확인 완료');
            resolve();
          } else {
            setTimeout(checkAuth, 100);
          }
        };
        checkAuth();
      });
      
      console.log('🎉 AuthProvider: Google 로그인 프로세스 완전히 완료');
      toast.success('Google 로그인되었습니다.');
    } catch (error) {
      console.error('❌ AuthProvider: Google 로그인 오류:', error);
      setError(error instanceof Error ? error.message : 'Google 로그인 중 오류가 발생했습니다.');
      throw error; // 에러를 다시 throw하여 호출하는 곳에서 처리할 수 있도록 함
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      clearAuthAndCookies();
      toast.success('로그아웃되었습니다.');
    } catch (error) {
      console.error('로그아웃 오류:', error);
      toast.error('로그아웃 중 오류가 발생했습니다.');
    }
  };

  const refreshUser = async () => {
    if (!firebaseUser) return;
    
    try {
      const userData = await getUserById(firebaseUser.uid);
      if (userData) {
        await setUserAndCookies(userData, firebaseUser);
      }
    } catch (error) {
      console.error('사용자 정보 새로고침 오류:', error);
    }
  };

  const checkSuspension = () => {
    if (user) {
      const suspensionStatus = checkSuspensionStatus(user);
      setSuspensionStatus(suspensionStatus);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('🔄 AuthProvider: onAuthStateChanged 트리거됨', {
        user: firebaseUser ? `${firebaseUser.uid} (${firebaseUser.email})` : null,
        timestamp: new Date().toISOString()
      });
      
      setIsLoading(true);
      setFirebaseUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          console.log('👤 AuthProvider: Firebase 사용자 로그인됨, Firestore에서 사용자 정보 조회 중...');
          
          // 회원가입 직후에는 Firestore 데이터 저장이 약간의 지연이 있을 수 있으므로 재시도 로직 추가
          let userData = null;
          let retryCount = 0;
          const maxRetries = 3;
          
          while (!userData && retryCount < maxRetries) {
            userData = await getUserById(firebaseUser.uid);
            
            if (!userData && retryCount < maxRetries - 1) {
              console.log(`⏳ AuthProvider: 사용자 정보 조회 실패, 재시도 중... (${retryCount + 1}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
              retryCount++;
            } else {
              break;
            }
          }
          
          if (userData) {
            console.log('✅ AuthProvider: 사용자 정보 조회 성공, 쿠키 설정 중...');
            await setUserAndCookies(userData, firebaseUser);
            
            // 상태 동기화를 위한 추가 검증 (프로덕션 환경에서 더 오래 대기)
            const isProduction = process.env.NODE_ENV === 'production';
            const verifyWaitTime = isProduction ? 800 : 200; // 프로덕션에서는 800ms
            await new Promise(resolve => setTimeout(resolve, verifyWaitTime));
            
            // 쿠키가 제대로 설정되었는지 확인
            if (typeof window !== 'undefined') {
              const authCookieCheck = document.cookie.includes('authToken=');
              const uidCookieCheck = document.cookie.includes('uid=');
              
              // 프로덕션에서도 확인 가능한 디버그 정보 저장
              if (typeof window !== 'undefined') {
                (window as any).__authDebug = (window as any).__authDebug || [];
                (window as any).__authDebug.push(`🔍 쿠키 설정 검증: authToken=${authCookieCheck}, uid=${uidCookieCheck} at ${new Date().toISOString()}`);
              }
              
              console.log('🔍 AuthProvider: 쿠키 설정 검증', { 
                authToken: authCookieCheck, 
                uid: uidCookieCheck 
              });
              
              if (!authCookieCheck || !uidCookieCheck) {
                console.warn('⚠️ AuthProvider: 쿠키 설정 실패, 재시도...');
                // 쿠키 재설정 시도 (프로덕션에서는 더 강력하게)
                try {
                  const idToken = await firebaseUser.getIdToken(true);
                  setCookie('authToken', idToken, 1);
                  setCookie('uid', userData.uid, 30);
                  setCookie('userRole', userData.role, 30);
                  
                  // 재설정 후 한 번 더 검증
                  if (isProduction) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                    const reCheckAuth = document.cookie.includes('authToken=');
                    const reCheckUid = document.cookie.includes('uid=');
                    
                    if (typeof window !== 'undefined') {
                      (window as any).__authDebug.push(`🔄 재설정 후 검증: authToken=${reCheckAuth}, uid=${reCheckUid} at ${new Date().toISOString()}`);
                    }
                  }
                } catch (retryError) {
                  console.error('❌ AuthProvider: 쿠키 재설정 실패:', retryError);
                  if (typeof window !== 'undefined') {
                    (window as any).__authDebug.push(`❌ 쿠키 재설정 실패: ${retryError} at ${new Date().toISOString()}`);
                  }
                }
              }
            }
            
            console.log('✅ AuthProvider: 인증 완료', { userName: userData.profile?.userName });
          } else {
            console.warn('⚠️ AuthProvider: Firestore에서 사용자 정보를 찾을 수 없음 (재시도 완료)');
            clearAuthAndCookies();
          }
        } catch (error) {
          console.error('❌ AuthProvider: 사용자 정보 조회 오류:', error);
          clearAuthAndCookies();
        }
      } else {
        console.log('🚪 AuthProvider: 사용자 로그아웃됨');
        clearAuthAndCookies();
      }
      
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 개발 환경에서 인증 지속성 테스트 도구 활성화
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      console.log('🛠️ 개발 모드: 인증 지속성 테스트 도구 활성화');
      testAuthPersistence();
      
      // 인증 상태 변경 시 로그
      const interval = setInterval(() => {
        if (user) {
          logAuthPersistenceStatus();
        }
      }, 5 * 60 * 1000); // 5분마다
      
      return () => clearInterval(interval);
    }
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        isLoading,
        error,
        suspensionStatus,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        refreshUser,
        checkSuspension,
        resetError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
} 
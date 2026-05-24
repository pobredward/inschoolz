/**
 * 인증 지속성 관련 유틸리티 함수들
 */

/**
 * 브라우저 저장소 상태 확인
 */
export const checkBrowserStorageStatus = () => {
  const status = {
    localStorage: {
      available: false,
      firebaseKeys: [] as string[],
      totalSize: 0
    },
    sessionStorage: {
      available: false,
      firebaseKeys: [] as string[],
      totalSize: 0
    },
    cookies: {
      authToken: false,
      uid: false,
      userRole: false,
      count: 0
    }
  };

  try {
    // localStorage 확인
    if (typeof window !== 'undefined' && window.localStorage) {
      status.localStorage.available = true;
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('firebase:')) {
          status.localStorage.firebaseKeys.push(key);
          const value = localStorage.getItem(key);
          if (value) {
            status.localStorage.totalSize += key.length + value.length;
          }
        }
      }
    }
  } catch (error) {
    console.warn('localStorage 접근 실패:', error);
  }

  try {
    // sessionStorage 확인
    if (typeof window !== 'undefined' && window.sessionStorage) {
      status.sessionStorage.available = true;
      
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('firebase:')) {
          status.sessionStorage.firebaseKeys.push(key);
          const value = sessionStorage.getItem(key);
          if (value) {
            status.sessionStorage.totalSize += key.length + value.length;
          }
        }
      }
    }
  } catch (error) {
    console.warn('sessionStorage 접근 실패:', error);
  }

  try {
    // 쿠키 확인
    if (typeof document !== 'undefined') {
      const cookies = document.cookie.split(';');
      status.cookies.count = cookies.length;
      
      cookies.forEach(cookie => {
        const [name] = cookie.trim().split('=');
        if (name === 'authToken') status.cookies.authToken = true;
        if (name === 'uid') status.cookies.uid = true;
        if (name === 'userRole') status.cookies.userRole = true;
      });
    }
  } catch (error) {
    console.warn('쿠키 접근 실패:', error);
  }

  return status;
};

/**
 * 인증 토큰 정보 확인
 */
export const checkAuthTokenInfo = async () => {
  try {
    const { getAuth } = await import('firebase/auth');
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      return {
        hasUser: false,
        tokenInfo: null
      };
    }

    try {
      // ID 토큰 정보 확인
      const token = await user.getIdToken(false);
      const tokenResult = await user.getIdTokenResult(false);
      
      return {
        hasUser: true,
        tokenInfo: {
          token: token.substring(0, 20) + '...', // 보안상 일부만 표시
          issuedAt: new Date(tokenResult.issuedAtTime).toISOString(),
          expirationTime: new Date(tokenResult.expirationTime).toISOString(),
          authTime: new Date(tokenResult.authTime).toISOString(),
          claims: {
            ...tokenResult.claims
          }
        }
      };
    } catch (tokenError) {
      console.error('토큰 정보 확인 실패:', tokenError);
      return {
        hasUser: true,
        tokenInfo: null,
        tokenError: tokenError instanceof Error ? tokenError.message : String(tokenError)
      };
    }
  } catch (error) {
    console.error('인증 상태 확인 실패:', error);
    return {
      hasUser: false,
      tokenInfo: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

/**
 * Firebase Auth 지속성 상태 로그
 */
export const logAuthPersistenceStatus = async () => {
  console.group('🔍 인증 지속성 상태 확인');
  
  // 브라우저 저장소 상태
  const storageStatus = checkBrowserStorageStatus();
  console.log('📦 브라우저 저장소 상태:', storageStatus);
  
  // 인증 토큰 정보
  const tokenInfo = await checkAuthTokenInfo();
  console.log('🔑 인증 토큰 정보:', tokenInfo);
  
  // Firebase 설정 정보
  try {
    const { getAuth } = await import('firebase/auth');
    const auth = getAuth();
    console.log('⚙️ Firebase Auth 설정:', {
      currentUser: auth.currentUser ? {
        uid: auth.currentUser.uid,
        email: auth.currentUser.email,
        emailVerified: auth.currentUser.emailVerified,
        phoneNumber: auth.currentUser.phoneNumber,
        providerData: auth.currentUser.providerData.map(p => ({
          providerId: p.providerId,
          uid: p.uid
        }))
      } : null,
      config: {
        apiKey: auth.config.apiKey?.substring(0, 10) + '...',
        authDomain: auth.config.authDomain
      }
    });
  } catch (error) {
    console.error('Firebase Auth 정보 조회 실패:', error);
  }
  
  console.groupEnd();
  
  return {
    storage: storageStatus,
    token: tokenInfo,
    timestamp: new Date().toISOString()
  };
};

/**
 * 인증 상태 지속성 테스트
 */
export const testAuthPersistence = () => {
  console.group('🧪 인증 상태 지속성 테스트');
  
  // 페이지 새로고침 시뮬레이션 테스트
  const testPageReload = () => {
    console.log('🔄 페이지 새로고침 시뮬레이션...');
    logAuthPersistenceStatus();
  };
  
  // 브라우저 탭 닫기/열기 시뮬레이션
  const testTabReopen = () => {
    console.log('🪟 브라우저 탭 재오픈 시뮬레이션...');
    setTimeout(() => {
      logAuthPersistenceStatus();
    }, 1000);
  };
  
  console.log('테스트 함수들을 콘솔에서 호출해보세요:');
  console.log('- testPageReload() : 페이지 새로고침 테스트');
  console.log('- testTabReopen() : 탭 재오픈 테스트');
  console.log('- logAuthPersistenceStatus() : 현재 상태 확인');
  
  // 전역 함수로 등록
  if (typeof window !== 'undefined') {
    (window as any).testPageReload = testPageReload;
    (window as any).testTabReopen = testTabReopen;
    (window as any).logAuthPersistenceStatus = logAuthPersistenceStatus;
  }
  
  console.groupEnd();
};

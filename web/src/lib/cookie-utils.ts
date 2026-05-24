/**
 * 쿠키 동기화 유틸리티
 * 로그인 후 쿠키가 실제로 설정될 때까지 대기
 */

/**
 * 쿠키가 설정될 때까지 폴링 방식으로 대기
 * @param maxWaitMs 최대 대기 시간 (밀리초)
 * @returns 쿠키가 설정되었는지 여부
 */
export const waitForCookies = async (maxWaitMs = 3000): Promise<boolean> => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    const cookies = document.cookie;
    
    // authToken과 uid 쿠키가 모두 설정되었는지 확인
    const hasAuthToken = cookies.includes('authToken=');
    const hasUid = cookies.includes('uid=') || cookies.includes('userId=');
    
    if (hasAuthToken && hasUid) {
      console.log('✅ 쿠키 설정 확인됨:', {
        elapsed: Date.now() - startTime,
        cookies: cookies.split(';').map(c => c.trim().split('=')[0])
      });
      return true;
    }
    
    // 100ms 대기 후 다시 확인
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.warn('⚠️ 쿠키 설정 타임아웃:', {
    elapsed: Date.now() - startTime,
    maxWaitMs,
    currentCookies: document.cookie
  });
  
  return false;
};

/**
 * Safari 브라우저 감지
 * Safari는 쿠키 설정이 더 느릴 수 있음 (ITP)
 */
export const isSafariBrowser = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
};

/**
 * 브라우저에 따른 권장 대기 시간 반환
 */
export const getRecommendedWaitTime = (): number => {
  if (isSafariBrowser()) {
    return 4000; // Safari는 4초
  }
  return 3000; // 기타 브라우저는 3초
};


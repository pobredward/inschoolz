'use client';

import { useEffect } from 'react';

export default function GetAppPage() {
  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor;
    
    // iOS 디바이스 감지
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    // Android 디바이스 감지
    const isAndroid = /android/i.test(userAgent);
    
    // 리다이렉트 URL
    const appStoreUrl = 'https://apps.apple.com/kr/app/%EC%9D%B8%EC%8A%A4%EC%BF%A8%EC%A6%88-inschoolz/id6748880507?l=en-GB';
    const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.onmindlab.inschoolz';
    
    if (isIOS) {
      window.location.href = appStoreUrl;
    } else if (isAndroid) {
      window.location.href = playStoreUrl;
    } else {
      // 데스크톱이나 기타 디바이스는 Play Store로 리다이렉트
      window.location.href = playStoreUrl;
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">리다이렉트 중...</p>
      </div>
    </div>
  );
}








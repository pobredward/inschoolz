'use client';

import { useEffect } from 'react';

export default function AppDownloadPage() {
  useEffect(() => {
    const redirect = () => {
      const userAgent = navigator.userAgent || navigator.vendor;
      
      // iOS 디바이스 (iPhone, iPad, iPod)
      if (/iPad|iPhone|iPod/.test(userAgent)) {
        window.location.href = 'https://apps.apple.com/kr/app/%EC%9D%B8%EC%8A%A4%EC%BF%A8%EC%A6%88-inschoolz/id6748880507?l=en-GB';
      } 
      // Android 디바이스
      else if (/android/i.test(userAgent)) {
        window.location.href = 'https://play.google.com/store/apps/details?id=com.onmindlab.inschoolz';
      }
      // 기타 디바이스 (데스크톱 등)
      else {
        window.location.href = 'https://play.google.com/store/apps/details?id=com.onmindlab.inschoolz';
      }
    };

    // 즉시 리다이렉트
    redirect();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
      <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 md:p-12 max-w-lg w-full mx-4">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4 shadow-lg">
            <svg 
              className="w-12 h-12 text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" 
              />
            </svg>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            인스쿨즈
          </h1>
          <p className="text-gray-600 text-base md:text-lg">
            대한민국 초중고 학생 커뮤니티
          </p>
        </div>

        {/* 로딩 상태 */}
        <div className="flex flex-col items-center space-y-6 mb-8">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-purple-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-purple-600 rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-600 text-center">
            앱 스토어로 이동 중입니다...
          </p>
        </div>

        {/* 구분선 */}
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500">
              자동 이동되지 않나요?
            </span>
          </div>
        </div>

        {/* 수동 다운로드 버튼 */}
        <div className="space-y-3">
          <a
            href="https://apps.apple.com/kr/app/%EC%9D%B8%EC%8A%A4%EC%BF%A8%EC%A6%88-inschoolz/id6748880507?l=en-GB"
            className="flex items-center justify-center gap-3 bg-gray-900 hover:bg-gray-800 text-white px-6 py-4 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            rel="noopener noreferrer"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            <span>App Store에서 다운로드</span>
          </a>
          
          <a
            href="https://play.google.com/store/apps/details?id=com.onmindlab.inschoolz"
            className="flex items-center justify-center gap-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-6 py-4 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            rel="noopener noreferrer"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
            </svg>
            <span>Google Play에서 다운로드</span>
          </a>
        </div>

        {/* 하단 정보 */}
        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            학교별 커뮤니티 · 랭킹 시스템 · 미니게임
          </p>
        </div>
      </div>
    </div>
  );
}







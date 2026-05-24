'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import MyPageClient from './MyPageClient';

export default function MyPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // 로딩 완료 후 인증되지 않은 경우에만 리다이렉트
  useEffect(() => {
    if (!isLoading && !user) {
      console.log('🚪 MyPage: 인증되지 않은 상태, 로그인 페이지로 이동');
      router.push('/login?redirect=/my');
    }
  }, [user, isLoading, router]);

  console.log('🔍 MyPage 렌더링:', { 
    isLoading, 
    hasUser: !!user,
    userUid: user?.uid 
  });

  // 로딩 중이면 로딩 화면
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">사용자 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 사용자가 있으면 마이페이지 렌더링
  if (user) {
    console.log('✅ MyPage: 인증된 사용자, 마이페이지 렌더링');
    return <MyPageClient userData={user} />;
  }

  // 사용자가 없으면 로딩 화면 (리다이렉트 대기)
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
        <p className="text-gray-600">로그인 페이지로 이동 중...</p>
      </div>
    </div>
  );
} 
import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function UserProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ userName: string }>;
}) {
  // 서버 측에서 인증 확인
  const cookieStore = await cookies();
  const authToken = cookieStore.get('authToken')?.value;
  const { userName } = await params;
  
  // 로그인되지 않은 경우 로그인 페이지로 리디렉션
  if (!authToken) {
    // URL에 리디렉트 경로를 포함하여 로그인 후 복귀할 수 있도록 함
    redirect(`/auth?redirect=/${userName}`);
  }
  
  return (
    <div>
      {children}
    </div>
  );
} 
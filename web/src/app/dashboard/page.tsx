'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  // 인증되지 않은 사용자 리디렉션
  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  // 로그아웃 처리
  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  // 로딩 중이거나 인증되지 않은 경우
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b py-4">
        <div className="container flex items-center justify-between">
          <Link href="/dashboard">
            <h1 className="text-2xl font-bold">인스쿨즈</h1>
          </Link>
          <div className="flex items-center gap-4">
            <p className="text-sm">
              <span className="text-muted-foreground">안녕하세요,</span>{' '}
              <span className="font-medium">{user.profile.userName}</span>님
            </p>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              로그아웃
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight">대시보드</h2>
          <p className="text-muted-foreground mt-2">
            인스쿨즈 서비스를 이용해보세요.
          </p>
        </div>

        {!user.isVerified && (
          <div className="mb-8 rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950">
            <h3 className="mb-2 text-lg font-semibold text-yellow-800 dark:text-yellow-300">
              학교 인증이 필요합니다
            </h3>
            <p className="text-yellow-700 dark:text-yellow-400">
              학교 인증을 완료하면 더 많은 기능을 이용할 수 있습니다.
            </p>
            <Button 
              className="mt-4" 
              variant="outline" 
              onClick={() => router.push('/verify-school')}
            >
              학교 인증하기
            </Button>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border p-6 shadow-sm">
            <h3 className="mb-2 text-xl font-semibold">학교 게시판</h3>
            <p className="text-muted-foreground mb-4">
              학교 소식과 공지를 확인하고 참여하세요.
            </p>
            <Button variant="secondary" className="w-full" asChild>
              <Link href="/boards">바로가기</Link>
            </Button>
          </div>
          
          <div className="rounded-lg border p-6 shadow-sm">
            <h3 className="mb-2 text-xl font-semibold">학교 목록</h3>
            <p className="text-muted-foreground mb-4">
              다양한 학교 정보를 확인해보세요.
            </p>
            <Button variant="secondary" className="w-full" asChild>
              <Link href="/schools">바로가기</Link>
            </Button>
          </div>
          
          <div className="rounded-lg border p-6 shadow-sm">
            <h3 className="mb-2 text-xl font-semibold">내 프로필</h3>
            <p className="text-muted-foreground mb-4">
              개인 정보 및 설정을 관리합니다.
            </p>
            <Button variant="secondary" className="w-full" asChild>
              <Link href="/profile">바로가기</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
} 
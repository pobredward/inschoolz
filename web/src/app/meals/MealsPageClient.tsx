'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import WeeklyMealPlan from '@/components/meals/WeeklyMealPlan';
import { useAuth } from '@/providers/AuthProvider';
import { Settings, AlertCircle, Utensils } from 'lucide-react';
import Link from 'next/link';

export default function MealsPageClient() {
  const { user, isLoading: authLoading } = useAuth();

  // 인증 로딩 중일 때 로딩 화면 표시
  if (authLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <h2 className="text-lg font-semibold mb-2">급식 정보 준비 중...</h2>
            <p className="text-muted-foreground text-sm">
              사용자 정보를 확인하고 있습니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 로그인하지 않은 경우
  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
            <Utensils className="w-16 h-16 text-muted-foreground" />
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">급식 정보 서비스</h2>
              <p className="text-muted-foreground mb-4">
                로그인하시면 학교별 급식 정보를 확인할 수 있습니다.
              </p>
              <Link href="/login">
                <Button>로그인하기</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 학교 정보가 없는 경우
  if (!user.school?.id) {
    return (
      <div className="container mx-auto py-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            급식 정보를 확인하려면 먼저 학교를 설정해주세요.{' '}
            <Link href="/my" className="underline">
              마이페이지에서 학교 설정하기
            </Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">급식 정보</h1>
          <p className="text-muted-foreground mt-2">
            {user.school.name}의 급식 정보를 확인하세요
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/my">
            <Settings className="w-4 h-4 mr-2" />
            설정
          </Link>
        </Button>
      </div>

      {/* 메인 컨텐츠 - 주간 급식표만 표시 */}
      <WeeklyMealPlan 
        schoolId={user.school.id}
        schoolName={user.school.name}
      />

      {/* 안내 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">급식 정보 안내</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>• 급식 정보는 교육부 NEIS 시스템에서 제공받습니다.</p>
          <p>• 급식 정보는 매일 자동으로 업데이트됩니다.</p>
          <p>• 알레르기 정보는 숫자로 표시되며, 해당 알레르기 유발 요소를 나타냅니다.</p>
          <p>• 급식이 제공되지 않는 날(주말, 공휴일 등)에는 정보가 표시되지 않습니다.</p>
          <p>• 정보가 정확하지 않거나 문제가 있는 경우 학교에 직접 문의해주세요.</p>
        </CardContent>
      </Card>
    </div>
  );
}

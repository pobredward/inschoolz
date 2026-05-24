import { Metadata } from 'next';
import { Suspense } from 'react';
import MealsPageClient from './MealsPageClient';

export const metadata: Metadata = {
  title: '급식 정보 - 인스쿨즈',
  description: '학교별 급식 정보를 확인하세요. 오늘의 급식, 주간 급식표, 영양 정보 등을 제공합니다.',
  keywords: ['급식', '학교급식', '메뉴', '영양정보', '학교', '교육'],
  openGraph: {
    title: '급식 정보 - 인스쿨즈',
    description: '학교별 급식 정보를 확인하세요. 오늘의 급식, 주간 급식표, 영양 정보 등을 제공합니다.',
    type: 'website',
  }
};

export default function MealsPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto py-8">
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <h2 className="text-lg font-semibold mb-2">급식 정보</h2>
            <p className="text-muted-foreground text-sm">
              로딩 중...
            </p>
          </div>
        </div>
      </div>
    }>
      <MealsPageClient />
    </Suspense>
  );
}

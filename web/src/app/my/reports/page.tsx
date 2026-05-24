import { Suspense } from 'react';
import { Metadata } from 'next';
import { ReportsPageClient } from './ReportsPageClient';

export const metadata: Metadata = {
  title: '신고 기록 - Inschoolz',
  description: '내가 신고한 내역과 나를 신고한 내역을 확인할 수 있습니다.',
};

export default function ReportsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">신고 기록</h1>
          <p className="text-gray-600">
            내가 신고한 내역과 나를 신고한 내역을 확인할 수 있습니다.
          </p>
        </div>

        <Suspense fallback={<div>로딩 중...</div>}>
          <ReportsPageClient />
        </Suspense>
      </div>
    </div>
  );
} 
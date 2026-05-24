import { Suspense } from 'react';
import { Metadata } from 'next';
import { AdminReportsClient } from './AdminReportsClient';

export const metadata: Metadata = {
  title: '신고 관리 - 관리자 대시보드',
  description: '사용자 신고를 관리하고 처리할 수 있습니다.',
};

export default function AdminReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">신고 관리</h1>
          <p className="text-gray-600 mt-1">
            사용자 신고를 검토하고 처리할 수 있습니다.
          </p>
        </div>
      </div>

      <Suspense fallback={<div>로딩 중...</div>}>
        <AdminReportsClient />
      </Suspense>
    </div>
  );
} 
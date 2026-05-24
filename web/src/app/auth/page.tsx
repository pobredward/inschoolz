import { Suspense } from 'react';
import AuthPageClient from '@/components/auth/AuthPageClient';

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-100">
        <div className="flex flex-col items-center justify-center min-h-screen py-12 px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-700 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">인</span>
              </div>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">
              인스쿨즈
            </h1>
            <p className="mt-2 text-gray-600">로딩 중...</p>
          </div>
        </div>
      </div>
    }>
      <AuthPageClient />
    </Suspense>
  );
} 
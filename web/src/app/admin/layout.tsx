import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '관리자 페이지 | 인스쿨즈',
  description: '인스쿨즈 관리자 시스템',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto py-6 max-w-6xl">
        {children}
      </main>
    </div>
  );
} 
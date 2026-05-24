import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import UserProfileContainer from './components/UserProfileContainer';
import { getUserById } from '@/lib/api/users';
import { User } from '@/types';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { serializeUserForClient } from '@/lib/utils';

interface UserProfilePageProps {
  params: Promise<{ userId: string }>;
}

// 메타데이터 생성 함수
export async function generateMetadata({ params }: UserProfilePageProps): Promise<Metadata> {
  try {
    const { userId } = await params;
    const user = await getUserById(userId);
    
    if (!user) {
      return {
        title: '사용자를 찾을 수 없음 | InSchoolz',
        description: '요청하신 사용자를 찾을 수 없습니다.',
      };
    }

    return {
      title: `${user.profile?.userName || '사용자'} 프로필 | InSchoolz`,
      description: `${user.profile?.userName || '사용자'}님의 프로필을 확인하세요.`,
    };
  } catch {
    return {
      title: '프로필 | InSchoolz',
      description: '사용자 프로필 페이지',
    };
  }
}



export default async function UserProfilePage({ params }: UserProfilePageProps) {
  try {
    const { userId } = await params;
    
    // userId 유효성 검증
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      console.error('유효하지 않은 userId:', userId);
      return notFound();
    }
    
    // 사용자 정보 조회
    const user = await getUserById(userId);
    
    if (!user) {
      console.log(`사용자를 찾을 수 없음: ${userId}`);
      return notFound();
    }

    // 필수 필드 검증
    if (!user.profile || !user.profile.userName) {
      console.error('사용자 프로필 정보가 불완전함:', user.uid);
      return notFound();
    }
    
    // 클라이언트 컴포넌트에 전달하기 위한 안전한 직렬화
    const serializedUser = serializeUserForClient(user);
    
    return (
      <ErrorBoundary>
        <UserProfileContainer user={serializedUser} />
      </ErrorBoundary>
    );
  } catch (error) {
    console.error('사용자 프로필 페이지 오류:', error);
    
    // 개발 환경에서는 더 자세한 오류 정보 제공
    if (process.env.NODE_ENV === 'development') {
      throw error;
    }
    
    return notFound();
  }
} 
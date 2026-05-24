import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { getUserByUserName, getUserById } from '@/lib/api/users';
import { Toaster } from '@/components/ui/sonner';
import ProfileEditClient from './ProfileEditClient';
import { serializeUserForClient } from '@/lib/utils';

export const metadata: Metadata = {
  title: '프로필 수정 | InSchoolz',
  description: '내 프로필, 학교 정보, 관심사를 수정하세요.',
};

export default async function ProfileEditPage({ params }: { params: Promise<{ userName: string }> }) {
  // Next.js 15에서는 params를 await 해야 함
  const { userName } = await params;
  
  // 쿠키에서 로그인된 사용자 정보 확인
  const cookieStore = await cookies();
  const authToken = cookieStore.get('authToken')?.value;
  
  // 로그인되지 않은 경우 로그인 페이지로 리디렉션
  if (!authToken) {
    return redirect('/login?redirect=/' + userName + '/edit');
  }

  try {
    // userName으로 사용자 조회
    const profileUser = await getUserByUserName(userName);
    
    if (!profileUser) {
      return notFound();
    }

    // userId 또는 uid 쿠키 찾기
    let currentUserId = cookieStore.get('userId')?.value;
    if (!currentUserId) {
      currentUserId = cookieStore.get('uid')?.value;
    }
    
    // 쿠키에서 사용자 ID를 찾을 수 없는 경우
    if (!currentUserId) {
      console.log('사용자 ID를 쿠키에서 찾을 수 없음');
      return redirect('/login?redirect=/' + userName + '/edit');
    }
    
    // 사용자 정보 조회
    const currentUser = await getUserById(currentUserId);
    
    if (!currentUser) {
      return redirect('/login?redirect=/' + userName + '/edit');
    }
    
    // 본인 프로필인지 확인 - 본인 프로필만 수정 가능
    const isOwnProfile = currentUser.uid === profileUser.uid;
    
    if (!isOwnProfile) {
      // 다른 사용자의 프로필은 수정 불가능
      return redirect('/' + userName);
    } 

    // Firebase 타임스탬프를 포함한 객체를 직렬화
    const serializedUserData = serializeUserForClient(profileUser);

    // serializedUserData가 null이면 에러 (이론적으로는 발생하지 않아야 함)
    if (!serializedUserData) {
      console.error('사용자 데이터 직렬화 실패');
      return redirect('/login?redirect=/' + userName + '/edit');
    }

    // 프로필 수정 컴포넌트 렌더링
    return (
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 sm:pb-6">
        <Toaster />
        <ProfileEditClient userData={serializedUserData} />
      </div>
    );
  } catch (error) {
    console.error('사용자 정보 조회 오류:', error);
    return redirect('/login?redirect=/' + userName + '/edit');
  }
} 
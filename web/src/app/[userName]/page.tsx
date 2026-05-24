import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { getUserByUserName, getUserById } from '@/lib/api/users';
import MyPageClient from '../my/MyPageClient';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import AttendanceCalendar from './components/AttendanceCalendar';
import { Toaster } from '@/components/ui/sonner';
import { serializeUserForClient } from '@/lib/utils';

export const metadata: Metadata = {
  title: '프로필 | InSchoolz',
  description: '프로필, 학교 정보, 관심사를 확인하세요.',
};

export default async function UserProfilePage({ params }: { params: Promise<{ userName: string }> }) {
  // Next.js 15에서는 params를 await 해야 함
  const { userName } = await params;
  
  // 쿠키에서 로그인된 사용자 정보 확인
  const cookieStore = await cookies();
  const authToken = cookieStore.get('authToken')?.value;
  
  // 로그인되지 않은 경우 로그인 페이지로 리디렉션
  if (!authToken) {
    return redirect('/login?redirect=/' + userName);
  }

  try {
    // userName으로 사용자 조회
    const profileUser = await getUserByUserName(userName);
    
    if (!profileUser) {
      return notFound();
    }

    // uid 쿠키 우선 확인 (AuthProvider에서 설정하는 쿠키명)
    let currentUserId = cookieStore.get('uid')?.value;
    if (!currentUserId) {
      // 백업으로 userId 쿠키도 확인
      currentUserId = cookieStore.get('userId')?.value;
    }
    
    // 쿠키에서 사용자 ID를 찾을 수 없는 경우 로그인 페이지로 리디렉션
    if (!currentUserId) {
      return redirect('/login?redirect=/' + userName);
    }
    
    // 사용자 정보 조회
    const currentUser = await getUserById(currentUserId);
    
    if (!currentUser) {
      return redirect('/login?redirect=/' + userName);
    }

    // Firebase 타임스탬프를 포함한 객체를 직렬화
    const serializedProfileUser = profileUser ? serializeUserForClient(profileUser) : null;
    const serializedCurrentUser = currentUser ? serializeUserForClient(currentUser) : null;
    
    // 본인 프로필인지 확인
    const isOwnProfile = serializedCurrentUser?.uid === serializedProfileUser?.uid;
    
    // 본인 프로필이면 MyPageClient 컴포넌트 렌더링
    if (isOwnProfile) {
      return <MyPageClient userData={serializedCurrentUser} />;
    } 
    // 다른 사용자의 프로필이면 제한된 정보 표시
    else {
      return (
        <div className="container mx-auto py-6">
          <Toaster />
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>프로필</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row items-center gap-6">
                <Avatar className="w-24 h-24">
                  <AvatarImage 
                    src={serializedProfileUser?.profile?.profileImageUrl || '/images/default-profile.png'} 
                    alt={serializedProfileUser?.profile?.userName || '사용자'} 
                  />
                  <AvatarFallback>
                    {serializedProfileUser?.profile?.userName?.substring(0, 2) || '사용자'}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1">
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-2">
                    <h1 className="text-2xl font-bold">{serializedProfileUser?.profile?.userName}</h1>
                    {serializedProfileUser?.profile?.isAdmin && (
                      <Badge variant="secondary" className="ml-2">관리자</Badge>
                    )}
                  </div>
                  
                  <p className="mt-2 text-muted-foreground">
                    이 사용자와 소통하려면 로그인 후 상호작용이 필요합니다.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* 출석체크 현황 카드 */}
          <AttendanceCalendar userId={serializedProfileUser?.uid || ''} isProfileOwner={false} />
          
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>소셜 네트워크</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center py-4">
                현재 다른 사용자의 소셜 정보를 보려면 클라이언트 기능이 필요합니다.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }
  } catch (error) {
    console.error('프로필 페이지 사용자 정보 조회 오류:', error);
    return redirect('/login?redirect=/' + userName);
  }
} 
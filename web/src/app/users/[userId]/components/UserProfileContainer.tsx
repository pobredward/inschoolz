'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { User } from '@/types';
import {
  checkFollowStatus,
  checkBlockStatus,
  getFollowersCount,
  getFollowingCount,
  toggleFollow
} from '@/lib/api/users';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Users, MapPin, School, Trophy, MessageSquare, FileText, Star } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import FollowersModal from '@/components/FollowersModal';
import ProfileHeader from './ProfileHeader';
import { 
  isValidUser, 
  getSchoolInfo, 
  getLevelInfo, 
  getUserRole, 
  safeTimestampToDate
} from '@/lib/type-guards';

interface UserProfileContainerProps {
  user: User;
}

// 로딩 컴포넌트
function ProfileSkeleton() {
  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// 에러 컴포넌트
function ProfileError({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="max-w-md mx-auto p-4">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>{error}</span>
          {onRetry && (
            <Button size="sm" onClick={onRetry}>
              다시 시도
            </Button>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}

export default function UserProfileContainer({ user }: UserProfileContainerProps) {
  const { user: currentUser } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [followersModalType, setFollowersModalType] = useState<'followers' | 'following'>('followers');

  // 사용자 관계 정보 조회
  const fetchUserRelationship = async () => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      setIsLoading(true);

      const [followStatus, blockStatus, followerCount, followingCount] = await Promise.all([
        checkFollowStatus(currentUser.uid, user.uid).catch(() => false),
        checkBlockStatus(currentUser.uid, user.uid).catch(() => false),
        getFollowersCount(user.uid).catch(() => 0),
        getFollowingCount(user.uid).catch(() => 0)
      ]);

      setIsFollowing(followStatus);
      setIsBlocked(blockStatus);
      setFollowersCount(followerCount);
      setFollowingCount(followingCount);
    } catch (error) {
      console.error('사용자 관계 정보 조회 오류:', error);
      setError('사용자 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 팔로우 토글 처리
  const handleToggleFollow = async () => {
    if (!currentUser) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    try {
      await toggleFollow(currentUser.uid, user.uid);
      // 상태 즉시 업데이트
      setIsFollowing(!isFollowing);
      setFollowersCount(prev => isFollowing ? prev - 1 : prev + 1);
      
      toast.success(isFollowing ? '팔로우를 취소했습니다.' : '팔로우했습니다.');
      
      // 서버 데이터와 동기화
      await fetchUserRelationship();
    } catch (error) {
      console.error('팔로우 토글 오류:', error);
      toast.error('팔로우 상태 변경 중 오류가 발생했습니다.');
    }
  };

  useEffect(() => {
    // user prop 유효성 검증
    if (!isValidUser(user)) {
      setError('유효하지 않은 사용자 정보입니다.');
      setIsLoading(false);
      return;
    }

    fetchUserRelationship();
  }, [currentUser, user.uid]);

  // 자신의 프로필인지 확인
  const isOwnProfile = !!(currentUser && currentUser.uid === user.uid);

  // 안전한 데이터 접근
  const schoolInfo = getSchoolInfo(user);
  const levelInfo = getLevelInfo(user);
  const roleInfo = getUserRole(user);

  // 가입일 계산
  const joinDate = (() => {
    try {
      const date = safeTimestampToDate(user.createdAt);
      return formatDistanceToNow(date, { addSuffix: true, locale: ko });
    } catch {
      return '알 수 없음';
    }
  })();

  // 에러 상태일 때
  if (error) {
    return (
      <ProfileError 
        error={error} 
        onRetry={() => {
          setError(null);
          fetchUserRelationship();
        }} 
      />
    );
  }

  // 로딩 상태일 때
  if (isLoading && !currentUser) {
    return <ProfileSkeleton />;
  }

  const handleFollowersClick = (type: 'followers' | 'following') => {
    setFollowersModalType(type);
    setShowFollowersModal(true);
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 space-y-4">
      {/* 헤더 (뒤로가기, 더보기 메뉴) */}
      <ProfileHeader 
        user={user} 
        isOwnProfile={isOwnProfile} 
        isBlocked={isBlocked}
        onBlockStatusChange={fetchUserRelationship}
      />
      
      {/* 0. 기본 정보 (프로필 이미지, 유저네임) */}
      <Card>
        <CardContent className="p-6 text-center">
          <Avatar className="w-24 h-24 mx-auto mb-4">
            <AvatarImage 
              src={user.profile?.profileImageUrl} 
              alt={`${user.profile.userName}님의 프로필`}
            />
            <AvatarFallback className="text-2xl bg-gradient-to-br from-blue-400 to-purple-500 text-white">
              {user.profile.userName?.substring(0, 2)?.toUpperCase() || '👤'}
            </AvatarFallback>
          </Avatar>
          
          <h1 className="text-2xl font-bold mb-2 truncate px-2">{user.profile.userName}</h1>
          
          {/* 역할 배지 */}
          <div className="flex justify-center gap-2 mb-4">
            {roleInfo.isAdmin && (
              <Badge variant="secondary" className="bg-red-100 text-red-800">
                관리자
              </Badge>
            )}
            {roleInfo.isTeacher && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                선생님
              </Badge>
            )}
            {roleInfo.isVerified && (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                인증 회원
              </Badge>
            )}
          </div>

          {/* 팔로우 버튼 */}
          {!isOwnProfile && currentUser && (
            <Button
              onClick={handleToggleFollow}
              variant={isFollowing ? "outline" : "default"}
              className="w-full"
            >
              {isFollowing ? '팔로잉' : '팔로우'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 1. 팔로워와 팔로잉 */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => handleFollowersClick('followers')}
              className="text-center p-4 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Users className="w-6 h-6 mx-auto mb-2 text-blue-500" />
              <div className="font-bold text-lg">{followersCount.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">팔로워</div>
            </button>
            
            <button 
              onClick={() => handleFollowersClick('following')}
              className="text-center p-4 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Users className="w-6 h-6 mx-auto mb-2 text-green-500" />
              <div className="font-bold text-lg">{followingCount.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">팔로잉</div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* 2. 레벨 및 경험치 */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <Trophy className="w-6 h-6 text-yellow-500" />
            <div>
              <div className="font-bold text-lg">레벨 {levelInfo.level}</div>
              <div className="text-sm text-muted-foreground">
                {levelInfo.currentExp} / {levelInfo.requiredExp} XP
              </div>
            </div>
          </div>
          
          {/* 경험치 프로그레스 바 */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${levelInfo.percentage}%` }}
            />
          </div>
          
        </CardContent>
      </Card>

      {/* 3. 학교 및 주소 */}
      <Card>
        <CardContent className="p-6 space-y-3">
          {schoolInfo.name !== '소속 학교 없음' && (
            <div className="flex items-center gap-3">
              <School className="w-5 h-5 text-blue-500 flex-shrink-0" />
              <span className="truncate">{schoolInfo.fullInfo}</span>
            </div>
          )}
          
          {user.regions && (
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-red-500 flex-shrink-0" />
              <span className="truncate">{user.regions.sido} {user.regions.sigungu}</span>
            </div>
          )}
          
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Star className="w-4 h-4" />
            <span>{joinDate} 가입</span>
          </div>
        </CardContent>
      </Card>

      {/* 4. 활동 통계 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📊 활동 통계</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Link 
              href={`/users/${user.uid}/posts`}
              className="p-4 border rounded-lg hover:bg-gray-50 transition-colors flex flex-col items-center justify-center space-y-2"
            >
              <FileText className="w-6 h-6 text-blue-500" />
              <span className="text-sm font-medium text-center">유저가 쓴 글</span>
            </Link>
            
            <Link 
              href={`/users/${user.uid}/comments`}
              className="p-4 border rounded-lg hover:bg-gray-50 transition-colors flex flex-col items-center justify-center space-y-2"
            >
              <MessageSquare className="w-6 h-6 text-green-500" />
              <span className="text-sm font-medium text-center">유저 댓글</span>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* 팔로워/팔로잉 모달 */}
      <FollowersModal
        isOpen={showFollowersModal}
        onClose={() => setShowFollowersModal(false)}
        userId={user.uid}
        type={followersModalType}
        title={followersModalType === 'followers' ? '팔로워' : '팔로잉'}
      />
    </div>
  );
} 
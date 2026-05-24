'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { User } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CalendarDays, School, Users, Shield, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { 
  isValidUser, 
  getSchoolInfo, 
  getLevelInfo, 
  getUserRole, 
  getSafeImageUrl,
  safeTimestampToDate
} from '@/lib/type-guards';

interface ProfileSectionProps {
  user: User;
  isOwnProfile: boolean;
  isFollowing: boolean;
  isLoading: boolean;
  followersCount: number;
  followingCount: number;
  onToggleFollow?: () => Promise<void>;
}

export default function ProfileSection({
  user,
  isOwnProfile,
  isFollowing,
  isLoading,
  followersCount,
  followingCount,
  onToggleFollow,
}: ProfileSectionProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  // 사용자 데이터 안전성 검증
  if (!isValidUser(user)) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            유효하지 않은 사용자 정보입니다.
          </div>
        </CardContent>
      </Card>
    );
  }

  // 안전한 데이터 접근을 위한 헬퍼 사용 (메모이제이션)
  const schoolInfo = useMemo(() => getSchoolInfo(user), [user.school]);
  const levelInfo = useMemo(() => getLevelInfo(user), [user.stats]);
  const roleInfo = useMemo(() => getUserRole(user), [user.role, user.isVerified]);
  
  // 가입일 계산 (안전한 날짜 처리, 메모이제이션)
  const joinDate = useMemo(() => {
    try {
      const date = safeTimestampToDate(user.createdAt);
      return formatDistanceToNow(date, { addSuffix: true, locale: ko });
    } catch (error) {
      console.error('가입일 처리 오류:', error);
      return '알 수 없음';
    }
  }, [user.createdAt]);

  const handleToggleFollow = useCallback(async () => {
    if (isSubmitting || isLoading || !onToggleFollow) return;
    
    setIsSubmitting(true);
    try {
      await onToggleFollow();
      toast.success(isFollowing ? '팔로우를 취소했습니다.' : '팔로우했습니다.');
    } catch (error) {
      console.error('팔로우 상태 변경 오류:', error);
      toast.error('팔로우 상태 변경 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, isLoading, onToggleFollow, isFollowing]);

  // 사용자 역할에 따른 배지 렌더링
  const renderRoleBadges = () => {
    const badges = [];
    
    if (roleInfo.isAdmin) {
      badges.push(
        <Badge key="admin" variant="secondary" className="bg-red-100 text-red-800">
          <Shield className="w-3 h-3 mr-1" />
          관리자
        </Badge>
      );
    }
    
    if (roleInfo.isTeacher) {
      badges.push(
        <Badge key="teacher" variant="secondary" className="bg-blue-100 text-blue-800">
          <School className="w-3 h-3 mr-1" />
          선생님
        </Badge>
      );
    }
    
    if (roleInfo.isVerified) {
      badges.push(
        <Badge key="verified" variant="secondary" className="bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          인증 회원
        </Badge>
      );
    }
    
    return badges;
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          {/* 프로필 이미지 - Avatar 컴포넌트 사용 */}
          <Avatar className="w-24 h-24">
            <AvatarImage 
              src={user.profile?.profileImageUrl} 
              alt={`${user.profile.userName}님의 프로필`}
            />
            <AvatarFallback className="text-2xl bg-gradient-to-br from-blue-400 to-purple-500 text-white">
              {user.profile.userName?.substring(0, 2)?.toUpperCase() || '👤'}
            </AvatarFallback>
          </Avatar>
          
          {/* 사용자 정보 */}
          <div className="flex-1">
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-3">
              <h1 className="text-2xl font-bold">{user.profile.userName}</h1>
              
              {/* 역할 배지들 */}
              <div className="flex flex-wrap gap-2">
                {renderRoleBadges()}
              </div>
            </div>
            
            {/* 팔로우 버튼 */}
            {!isOwnProfile && (
              <div className="mb-4">
                <Button
                  onClick={handleToggleFollow}
                  disabled={isLoading || isSubmitting}
                  variant={isFollowing ? "outline" : "default"}
                  size="sm"
                >
                  {isSubmitting ? (
                    '처리 중...'
                  ) : isLoading ? (
                    '로딩 중...'
                  ) : isFollowing ? (
                    '팔로잉'
                  ) : (
                    '팔로우'
                  )}
                </Button>
              </div>
            )}
            
            {/* 사용자 통계 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="font-semibold text-lg">{followersCount.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">팔로워</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg">{followingCount.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">팔로잉</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg">{user.stats?.postCount || 0}</div>
                <div className="text-sm text-muted-foreground">게시글</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg">{user.stats?.level || 1}</div>
                <div className="text-sm text-muted-foreground">레벨</div>
              </div>
            </div>
            
            {/* 추가 정보 */}
            <div className="space-y-2 text-sm text-muted-foreground">
              {schoolInfo.name !== '소속 학교 없음' && (
                <div className="flex items-center gap-2">
                  <School className="w-4 h-4" />
                  <span>{schoolInfo.fullInfo}</span>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4" />
                <span>{joinDate} 가입</span>
              </div>
              
              {user.stats?.streak && user.stats.streak > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-orange-500">🔥</span>
                  <span>{user.stats.streak}일 연속 출석</span>
                </div>
              )}
            </div>
            
            {/* 프로필 수정 버튼 */}
            {isOwnProfile && (
              <div className="mt-4">
                <Link href="/my/edit">
                  <Button variant="outline" size="sm">
                    프로필 수정
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 
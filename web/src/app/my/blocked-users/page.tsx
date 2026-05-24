'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { getBlockedUsers, toggleBlock } from '@/lib/api/users';
import { User } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ShieldOff, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toDate } from '@/lib/utils';
import Link from 'next/link';

interface BlockedUser extends User {
  blockedAt?: any;
}

export default function BlockedUsersPage() {
  const { user } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockingUser, setUnblockingUser] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (user) {
      loadBlockedUsers();
    }
  }, [user]);

  const loadBlockedUsers = async (pageNum = 1) => {
    if (!user) return;

    try {
      setLoading(true);
      const response = await getBlockedUsers(user.uid, pageNum, 20);
      
      if (pageNum === 1) {
        setBlockedUsers(response.users);
      } else {
        setBlockedUsers(prev => [...prev, ...response.users]);
      }
      
      setTotalCount(response.totalCount);
      setHasMore(response.hasMore);
      setPage(pageNum);
    } catch (error) {
      console.error('차단된 사용자 목록 조회 실패:', error);
      toast.error('차단된 사용자 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (targetUserId: string, targetUserName: string) => {
    if (!user) return;

    setUnblockingUser(targetUserId);
    try {
      await toggleBlock(user.uid, targetUserId);
      setBlockedUsers(prev => prev.filter(u => u.uid !== targetUserId));
      setTotalCount(prev => prev - 1);
      toast.success(`${targetUserName}님을 차단 해제했습니다.`);
    } catch (error) {
      console.error('차단 해제 실패:', error);
      toast.error('차단 해제에 실패했습니다.');
    } finally {
      setUnblockingUser(null);
    }
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      loadBlockedUsers(page + 1);
    }
  };

  if (loading && blockedUsers.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center mb-6">
              <Link href="/my">
                <Button variant="ghost" size="sm" className="mr-4">
                  <ChevronLeft className="h-4 w-4" />
                  뒤로가기
                </Button>
              </Link>
              <h1 className="text-2xl font-bold">차단된 사용자</h1>
            </div>
            
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">차단된 사용자 목록을 불러오는 중...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Link href="/my">
                <Button variant="ghost" size="sm" className="mr-4">
                  <ChevronLeft className="h-4 w-4" />
                  뒤로가기
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">차단된 사용자</h1>
                <p className="text-sm text-gray-600 mt-1">
                  총 {totalCount}명의 사용자를 차단했습니다
                </p>
              </div>
            </div>
          </div>

          {/* 안내 메시지 */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <ShieldOff className="h-5 w-5 text-blue-500 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 mb-1">차단 기능 안내</h3>
                  <p className="text-sm text-gray-600">
                    차단된 사용자의 게시글과 댓글은 "차단한 사용자입니다"로 표시되며, 
                    필요시 내용을 확인하거나 차단을 해제할 수 있습니다.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 차단된 사용자 목록 */}
          {blockedUsers.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <ShieldOff className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  차단된 사용자가 없습니다
                </h3>
                <p className="text-gray-600">
                  아직 차단한 사용자가 없습니다.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {blockedUsers.map((blockedUser) => (
                <Card key={blockedUser.uid}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage 
                            src={blockedUser.profile?.profileImageUrl} 
                            alt={blockedUser.profile?.userName} 
                          />
                          <AvatarFallback>
                            <UserIcon className="h-6 w-6" />
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h3 className="font-medium text-gray-900">
                              {blockedUser.profile?.userName || '사용자'}
                            </h3>
                            <Badge variant="secondary" className="text-xs">
                              차단됨
                            </Badge>
                          </div>
                          
                          <div className="flex items-center space-x-4 mt-1">
                            <p className="text-sm text-gray-600">
                              Lv.{blockedUser.stats?.level || 1}
                            </p>
                            {blockedUser.school?.name && (
                              <p className="text-sm text-gray-600">
                                {blockedUser.school.name}
                              </p>
                            )}
                          </div>
                          
                          {blockedUser.blockedAt && (
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDistanceToNow(toDate(blockedUser.blockedAt), { 
                                addSuffix: true, 
                                locale: ko 
                              })} 차단
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Link href={`/users/${blockedUser.uid}`}>
                          <Button variant="outline" size="sm">
                            프로필 보기
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUnblock(blockedUser.uid, blockedUser.profile?.userName || '사용자')}
                          disabled={unblockingUser === blockedUser.uid}
                        >
                          {unblockingUser === blockedUser.uid ? '해제 중...' : '차단 해제'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* 더 보기 버튼 */}
              {hasMore && (
                <div className="text-center py-4">
                  <Button 
                    variant="outline" 
                    onClick={handleLoadMore}
                    disabled={loading}
                  >
                    {loading ? '로딩 중...' : '더 보기'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 
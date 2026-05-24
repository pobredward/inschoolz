'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Users, School, MapPin } from 'lucide-react';
import { getFollowers, getFollowings } from '@/lib/api/users';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { User } from '@/types';

interface FollowersModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  type: 'followers' | 'following';
  title: string;
}

export default function FollowersModal({ isOpen, onClose, userId, type, title }: FollowersModalProps) {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 사용자 목록 조회
  const fetchUsers = async () => {
    if (!isOpen || !userId) return;

    setIsLoading(true);
    setError(null);
    
    try {
      let result;
      if (type === 'followers') {
        result = await getFollowers(userId, 1, 50);
      } else {
        result = await getFollowings(userId, 1, 50);
      }
      
      console.log('팔로워/팔로잉 데이터 로드 완료:', result.users?.length || 0, '명');
      console.log('첫 번째 사용자 프로필:', result.users?.[0]?.profile);
      
      setUsers(result.users || []);
      setFilteredUsers(result.users || []);
    } catch (error) {
      console.error(`${type} 목록 조회 오류:`, error);
      setError(`${title} 목록을 불러오는 중 오류가 발생했습니다.`);
    } finally {
      setIsLoading(false);
    }
  };

  // 검색 필터링
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(user => {
        const userName = user.profile?.userName?.toLowerCase() || '';
        const schoolName = user.school?.name?.toLowerCase() || '';
        const region = `${user.regions?.sido || ''} ${user.regions?.sigungu || ''}`.toLowerCase();
        
        return userName.includes(searchQuery.toLowerCase()) ||
               schoolName.includes(searchQuery.toLowerCase()) ||
               region.includes(searchQuery.toLowerCase());
      });
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  // 모달이 열릴 때 데이터 로드
  useEffect(() => {
    fetchUsers();
  }, [isOpen, userId, type]);

  // 모달이 닫힐 때 상태 초기화
  const handleClose = () => {
    setSearchQuery('');
    setUsers([]);
    setFilteredUsers([]);
    setError(null);
    onClose();
  };

  const handleUserClick = (user: User) => {
    handleClose();
    // Next.js 라우터를 사용하여 프로필 페이지로 이동
    router.push(`/users/${user.uid}`);
  };

  // 안전한 데이터 접근 함수들
  const getSchoolInfo = (user: User) => {
    if (!user.school?.name) return null;
    
    let schoolInfo = user.school.name;
    if (user.school.grade && user.school.classNumber) {
      schoolInfo += ` (${user.school.grade}학년 ${user.school.classNumber}반)`;
    }
    return schoolInfo;
  };

  const getRegionInfo = (user: User) => {
    if (!user.regions?.sido) return null;
    return `${user.regions.sido} ${user.regions.sigungu || ''}`.trim();
  };

  const getUserRole = (user: User) => {
    return {
      isAdmin: user.role === 'admin',
      isTeacher: user.role === 'teacher',
      isVerified: user.isVerified || false
    };
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {/* 검색창 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="이름, 학교, 지역으로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* 사용자 목록 */}
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {isLoading ? (
              // 로딩 스켈레톤
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-4 rounded-lg">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))
            ) : error ? (
              // 오류 상태
              <div className="text-center py-8">
                <div className="text-red-500 mb-2">{error}</div>
                <Button size="sm" onClick={fetchUsers}>
                  다시 시도
                </Button>
              </div>
            ) : filteredUsers.length > 0 ? (
              // 사용자 목록
              filteredUsers.map((user) => {
                const schoolInfo = getSchoolInfo(user);
                const regionInfo = getRegionInfo(user);
                const roleInfo = getUserRole(user);

                return (
                  <button
                    key={user.uid}
                    onClick={() => handleUserClick(user)}
                    className="w-full flex items-center gap-3 p-4 rounded-lg hover:bg-gray-50 transition-colors text-left border border-gray-100 hover:border-gray-200"
                  >
                                         {/* 프로필 이미지 */}
                     <Avatar className="w-12 h-12 flex-shrink-0">
                       <AvatarImage 
                         src={user.profile?.profileImageUrl} 
                         alt={`${user.profile?.userName}님의 프로필`}
                         onError={() => {
                           console.warn('프로필 이미지 로드 실패:', user.profile?.profileImageUrl);
                         }}
                       />
                       <AvatarFallback className="bg-gradient-to-br from-blue-400 to-purple-500 text-white text-sm font-medium">
                         {user.profile?.userName?.substring(0, 2)?.toUpperCase() || '👤'}
                       </AvatarFallback>
                     </Avatar>
                    
                    {/* 사용자 정보 */}
                    <div className="flex-1 min-w-0">
                      {/* 유저네임과 배지 */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate text-gray-900">
                          {user.profile?.userName || '익명'}
                        </span>
                        {roleInfo.isAdmin && (
                          <Badge variant="secondary" className="bg-red-100 text-red-800 text-xs px-1.5 py-0.5">
                            관리자
                          </Badge>
                        )}
                        {roleInfo.isTeacher && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs px-1.5 py-0.5">
                            선생님
                          </Badge>
                        )}
                        {roleInfo.isVerified && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs px-1.5 py-0.5">
                            인증
                          </Badge>
                        )}
                      </div>
                      
                      {/* 학교 정보 */}
                      {schoolInfo && (
                        <div className="flex items-center gap-1 mb-1">
                          <School className="w-3 h-3 text-blue-500 flex-shrink-0" />
                          <span className="text-xs text-gray-600 truncate">
                            {schoolInfo}
                          </span>
                        </div>
                      )}
                      
                      {/* 지역 정보 */}
                      {regionInfo && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-red-500 flex-shrink-0" />
                          <span className="text-xs text-gray-500">
                            {regionInfo}
                          </span>
                        </div>
                      )}
                      
                      {/* 학교나 지역 정보가 없는 경우 */}
                      {!schoolInfo && !regionInfo && (
                        <div className="text-xs text-gray-400">
                          정보 없음
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              // 빈 상태
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                {searchQuery ? (
                  <div>
                    <p className="text-lg font-medium mb-1">검색 결과가 없습니다</p>
                    <p className="text-sm">"{searchQuery}"에 대한 결과를 찾을 수 없습니다.</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-lg font-medium mb-1">{title}가 없습니다</p>
                    <p className="text-sm">아직 {title}가 없습니다.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 
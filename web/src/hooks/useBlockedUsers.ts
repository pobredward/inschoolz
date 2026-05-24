import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { checkMultipleBlockStatus } from '@/lib/api/users';

export function useBlockedUsers() {
  const { user } = useAuth();
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // 여러 사용자의 차단 상태를 한번에 확인
  const checkBlockedUsers = async (userIds: string[]) => {
    if (!user || userIds.length === 0) return;

    setIsLoading(true);
    try {
      const blockStatus = await checkMultipleBlockStatus(user.uid, userIds);
      const blockedIds = Object.entries(blockStatus)
        .filter(([_, isBlocked]) => isBlocked)
        .map(([userId, _]) => userId);
      
      setBlockedUserIds(new Set(blockedIds));
    } catch (error) {
      console.error('차단 사용자 확인 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 사용자가 차단되었는지 확인
  const isUserBlocked = (userId: string): boolean => {
    return blockedUserIds.has(userId);
  };

  // 차단 해제 시 상태 업데이트
  const unblockUser = (userId: string) => {
    setBlockedUserIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(userId);
      return newSet;
    });
  };

  return {
    blockedUserIds,
    isLoading,
    checkBlockedUsers,
    isUserBlocked,
    unblockUser
  };
} 
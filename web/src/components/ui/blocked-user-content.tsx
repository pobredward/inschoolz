'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldOff, Eye, EyeOff } from 'lucide-react';
import { toggleBlock } from '@/lib/api/users';
import { useAuth } from '@/providers/AuthProvider';
import { toast } from 'sonner';

interface BlockedUserContentProps {
  blockedUserId: string;
  blockedUserName: string;
  contentType: 'post' | 'comment';
  children: React.ReactNode;
  onUnblock?: () => void;
}

export function BlockedUserContent({ 
  blockedUserId, 
  blockedUserName, 
  contentType,
  children,
  onUnblock 
}: BlockedUserContentProps) {
  const { user } = useAuth();
  const [showContent, setShowContent] = useState(false);
  const [isUnblocking, setIsUnblocking] = useState(false);

  const handleUnblock = async () => {
    if (!user) return;
    
    setIsUnblocking(true);
    try {
      await toggleBlock(user.uid, blockedUserId);
      toast.success(`${blockedUserName}님을 차단 해제했습니다.`);
      onUnblock?.();
    } catch (error) {
      console.error('차단 해제 실패:', error);
      toast.error('차단 해제에 실패했습니다.');
    } finally {
      setIsUnblocking(false);
    }
  };

  const handleToggleContent = () => {
    setShowContent(!showContent);
  };

  if (showContent) {
    return (
      <div className="relative">
        {children}
        <div className="absolute top-2 right-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleContent}
            className="h-6 px-2 text-xs bg-gray-100 hover:bg-gray-200"
          >
            <EyeOff className="h-3 w-3 mr-1" />
            숨기기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card className="border-dashed border-gray-300 bg-gray-50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-gray-200 rounded-full">
              <ShieldOff className="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">
                차단한 사용자의 {contentType === 'post' ? '게시글' : '댓글'}입니다
              </p>
              <p className="text-xs text-gray-500">
                @{blockedUserName}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleContent}
              className="h-8 px-3 text-xs"
            >
              <Eye className="h-3 w-3 mr-1" />
              보기
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleUnblock}
              disabled={isUnblocking}
              className="h-8 px-3 text-xs"
            >
              차단 해제
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 
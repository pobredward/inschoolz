'use client';

import React, { useState } from 'react';
import { User } from '@/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronLeft, MoreHorizontal, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toggleBlock } from '@/lib/api/users';
import { useAuth } from '@/providers/AuthProvider';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ProfileHeaderProps {
  user: User;
  isOwnProfile: boolean;
  isBlocked: boolean;
  onBlockStatusChange?: () => void;
}

export default function ProfileHeader({ user, isOwnProfile, isBlocked, onBlockStatusChange }: ProfileHeaderProps) {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleToggleBlock = async () => {
    if (!currentUser) return;
    
    setIsSubmitting(true);
    try {
      const result = await toggleBlock(currentUser.uid, user.uid);
      onBlockStatusChange?.();
      toast.success(result.isBlocked ? '사용자를 차단했습니다.' : '차단을 해제했습니다.');
    } catch (error) {
      console.error('차단 상태 변경 오류:', error);
      toast.error('차단 상태 변경에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReport = () => {
    setShowReportDialog(false);
    // 여기에 신고 처리 로직 구현
    alert('신고가 접수되었습니다.');
  };

  return (
    <header className="flex items-center justify-between">
      <Button 
        variant="ghost" 
        size="sm"
        onClick={() => router.back()}
        className="flex items-center text-muted-foreground"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        이전으로
      </Button>

      {!isOwnProfile && currentUser && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setShowReportDialog(true)}>
              <AlertTriangle className="h-4 w-4 mr-2" />
              <span>신고하기</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleToggleBlock} disabled={isSubmitting}>
              <ShieldAlert className="h-4 w-4 mr-2" />
              <span>{isBlocked ? '차단 해제하기' : '차단하기'}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <AlertDialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>사용자 신고</AlertDialogTitle>
            <AlertDialogDescription>
              &apos;{user.profile.userName}&apos; 사용자를 신고하시겠습니까? 
              신고 후 관리자 검토를 거쳐 적절한 조치가 취해집니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleReport}>신고하기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
} 
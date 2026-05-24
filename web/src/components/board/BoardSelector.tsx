"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { getBoardsByType } from '@/lib/api/board';
import { Board } from '@/types';
import { useAuth } from '@/providers/AuthProvider';

interface BoardSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'national' | 'regional' | 'school';
  schoolId?: string;
  regions?: {
    sido: string;
    sigungu: string;
  };
}

export default function BoardSelector({ 
  isOpen, 
  onClose, 
  type, 
  schoolId, 
  regions 
}: BoardSelectorProps) {
  const router = useRouter();
  const { user, suspensionStatus } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadBoards();
    }
  }, [isOpen, type]);

  const loadBoards = async () => {
    setLoading(true);
    try {
      const boardList = await getBoardsByType(type);
      setBoards(boardList as Board[]);
    } catch (error) {
      console.error('게시판 목록 로딩 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBoardSelect = (board: Board) => {
    // 정지된 사용자 차단
    if (suspensionStatus?.isSuspended) {
      const message = suspensionStatus.isPermanent
        ? "계정이 영구 정지되어 게시글을 작성할 수 없습니다."
        : `계정이 정지되어 게시글을 작성할 수 없습니다. (남은 기간: ${suspensionStatus.remainingDays}일)`;
      
      alert(message + `\n사유: ${suspensionStatus.reason || '정책 위반'}`);
      onClose();
      return;
    }
    
    onClose();
    
    // 게시판 타입에 따라 적절한 URL로 이동
    let writeUrl = '';
    
    switch (type) {
      case 'national':
        writeUrl = `/community/national/${board.code}/write`;
        break;
      case 'regional':
        // props로 전달받은 지역 정보 우선 사용, 없으면 세션 스토리지나 유저 정보에서 가져오기
        const selectedSido = regions?.sido || sessionStorage?.getItem('community-selected-sido') || user?.regions?.sido;
        const selectedSigungu = regions?.sigungu || sessionStorage?.getItem('community-selected-sigungu') || user?.regions?.sigungu;
        if (selectedSido && selectedSigungu) {
          writeUrl = `/community/region/${encodeURIComponent(selectedSido)}/${encodeURIComponent(selectedSigungu)}/${board.code}/write`;
        }
        break;
      case 'school':
        // props로 전달받은 학교 ID 우선 사용, 없으면 세션 스토리지나 유저 정보에서 가져오기
        const selectedSchoolId = schoolId || sessionStorage?.getItem('community-selected-school') || user?.school?.id;
        if (selectedSchoolId) {
          writeUrl = `/community/school/${selectedSchoolId}/${board.code}/write`;
        }
        break;
    }
    
    if (writeUrl) {
      router.push(writeUrl);
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'national':
        return '전국 게시판 선택';
      case 'regional':
        return '지역 게시판 선택';
      case 'school':
        return '학교 게시판 선택';
      default:
        return '게시판 선택';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[70vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-lg">{getTitle()}</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2 text-sm">게시판 목록을 불러오는 중...</span>
            </div>
          ) : (
            <ScrollArea className="h-full max-h-[40vh]">
              <div className="flex flex-wrap gap-2 p-2">
                {boards.map((board) => (
                  <Badge
                    key={board.id}
                    variant="outline"
                    className="cursor-pointer hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-all duration-200 text-xs font-medium px-3 py-2 whitespace-nowrap"
                    onClick={() => handleBoardSelect(board)}
                  >
                    {board.name}
                  </Badge>
                ))}
              </div>
            </ScrollArea>
          )}
          
          {boards.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500 text-sm">
              사용 가능한 게시판이 없습니다.
            </div>
          )}
        </div>
        
        <div className="flex justify-end pt-3 border-t flex-shrink-0">
          <Button variant="outline" onClick={onClose} size="sm">
            취소
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 
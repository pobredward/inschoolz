'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Plus, Edit, Trash2, Eye, EyeOff, MessageSquare } from 'lucide-react';
import { Board, BoardType } from '@/types/board';
import { getAllBoards, createBoard, updateBoard, deleteBoard, toggleBoardStatus } from '@/lib/api/admin';
import { cleanupInvalidPollFields } from '@/lib/api/board';
import { useToast } from '@/components/ui/use-toast';

interface BoardFormData {
  name: string;
  description: string;
  icon: string;
  type: BoardType;
  code: string;
  isActive: boolean;
  order: number;
  isPublic: boolean;
  allowAnonymous: boolean;
  allowPolls: boolean;
}

const defaultBoardForm: BoardFormData = {
  name: '',
  description: '',
  icon: 'forum',
  type: 'national',
  code: '',
  isActive: true,
  order: 0,
  isPublic: true,
  allowAnonymous: true,
  allowPolls: true,
};

export default function CommunityManagementPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [boards, setBoards] = useState<Board[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBoard, setEditingBoard] = useState<Board | null>(null);
  const [formData, setFormData] = useState<BoardFormData>(defaultBoardForm);
  const [selectedBoardType, setSelectedBoardType] = useState<BoardType>('national');
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  useEffect(() => {
    loadBoards();
  }, []);

  const loadBoards = async () => {
    try {
      setIsLoading(true);
      const boards = await getAllBoards();
      setBoards(boards);
    } catch (error) {
      console.error('게시판 로드 실패:', error);
      toast.error('게시판 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const openAddModal = () => {
    setFormData({ ...defaultBoardForm, type: selectedBoardType });
    setEditingBoard(null);
    setShowAddModal(true);
  };

  const openEditModal = (board: Board) => {
    setFormData({
      name: board.name,
      description: board.description || '',
      icon: board.icon || 'forum',
      type: board.type,
      code: board.code,
      isActive: board.isActive,
      order: board.order,
      isPublic: board.isPublic,
      allowAnonymous: board.allowAnonymous,
      allowPolls: board.allowPolls,
    });
    setEditingBoard(board);
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingBoard(null);
    setFormData(defaultBoardForm);
  };

  const saveBoard = async () => {
    if (!formData.name.trim() || !formData.code.trim()) {
      toast.error('게시판 이름과 코드를 입력해주세요.');
      return;
    }

    try {
      setIsLoading(true);
      
      if (editingBoard) {
        // 실제 Firebase API 호출
        await updateBoard(editingBoard.id, formData);
        toast.success('게시판이 수정되었습니다.');
      } else {
        // 실제 Firebase API 호출
        const boardData = {
          name: formData.name,
          description: formData.description,
          icon: formData.icon,
          type: formData.type,
          code: formData.code,
          isActive: formData.isActive,
          order: formData.order,
          isPublic: formData.isPublic,
          allowAnonymous: formData.allowAnonymous,
          allowPolls: formData.allowPolls,
          stats: { postCount: 0, viewCount: 0, activeUserCount: 0 }
        };
        
        await createBoard(boardData);
        toast.success('게시판이 생성되었습니다.');
      }
      
      // 게시판 목록 새로고침
      await loadBoards();
      closeModal();
    } catch (error) {
      console.error('게시판 저장 실패:', error);
      toast.error('게시판 저장에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBoard = async (board: Board) => {
    if (!confirm(`"${board.name}" 게시판을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      setIsLoading(true);
      // 실제 Firebase API 호출
      await deleteBoard(board.id);
      toast.success('게시판이 삭제되었습니다.');
      // 게시판 목록 새로고침
      await loadBoards();
    } catch (error) {
      console.error('게시판 삭제 실패:', error);
      toast.error('게시판 삭제에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleBoardStatus = async (board: Board) => {
    try {
      setIsLoading(true);
      // 실제 Firebase API 호출
      await toggleBoardStatus(board.id, !board.isActive);
      toast.success(`게시판이 ${board.isActive ? '비활성화' : '활성화'}되었습니다.`);
      // 게시판 목록 새로고침
      await loadBoards();
    } catch (error) {
      console.error('게시판 상태 변경 실패:', error);
      toast.error('게시판 상태 변경에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCleanupPollFields = async () => {
    try {
      setIsCleaningUp(true);
      await cleanupInvalidPollFields();
      toast({
        title: "정리 완료",
        description: "잘못된 poll 필드가 정리되었습니다.",
      });
    } catch (error) {
      console.error('Poll 필드 정리 실패:', error);
      toast({
        title: "정리 실패",
        description: "Poll 필드 정리 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsCleaningUp(false);
    }
  };

  const getBoardTypeLabel = (type: BoardType) => {
    switch (type) {
      case 'national': return '전국';
      case 'regional': return '지역';
      case 'school': return '학교';
      default: return type;
    }
  };

  const filteredBoards = boards.filter(board => {
    console.log(`필터링 중: board.type=${board.type}, selectedBoardType=${selectedBoardType}, 매치=${board.type === selectedBoardType}`);
    return board.type === selectedBoardType;
  });

  console.log('전체 boards:', boards);
  console.log('selectedBoardType:', selectedBoardType);
  console.log('filteredBoards:', filteredBoards);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-green-600" />
            <h1 className="text-2xl font-bold text-green-800">커뮤니티 관리</h1>
          </div>
        </div>
        <Button
          onClick={openAddModal}
          className="bg-green-500 hover:bg-green-600"
        >
          <Plus className="h-4 w-4 mr-2" />
          게시판 추가
        </Button>
      </div>

      {/* 게시판 타입별 탭 */}
      <Tabs value={selectedBoardType} onValueChange={(value) => setSelectedBoardType(value as BoardType)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="national">전국 커뮤니티</TabsTrigger>
          <TabsTrigger value="regional">지역 커뮤니티</TabsTrigger>
          <TabsTrigger value="school">학교 커뮤니티</TabsTrigger>
        </TabsList>

        {(['national', 'regional', 'school'] as BoardType[]).map((boardType) => (
          <TabsContent key={boardType} value={boardType} className="mt-6">
            <div className="grid gap-4">
              {filteredBoards.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <MessageSquare className="h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-500 text-center">
                      {getBoardTypeLabel(boardType)} 게시판이 없습니다.
                      <br />
                      새 게시판을 추가해보세요.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredBoards.map((board) => (
                  <Card key={board.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <CardTitle className="flex items-center gap-2">
                              <span>{board.name}</span>
                              <Badge variant={board.isActive ? 'default' : 'secondary'}>
                                {board.isActive ? '활성' : '비활성'}
                              </Badge>
                            </CardTitle>
                          </div>
                          <CardDescription className="mb-2">
                            {board.description}
                          </CardDescription>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span>코드: <code className="bg-gray-100 px-1 rounded">{board.code}</code></span>
                            <span>타입: {getBoardTypeLabel(board.type)}</span>
                            <span>순서: {board.order}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleBoardStatus(board)}
                            title={board.isActive ? '비활성화' : '활성화'}
                          >
                            {board.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(board)}
                            title="수정"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteBoard(board)}
                            title="삭제"
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* 통계 */}
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">{board.stats?.postCount || 0}</div>
                          <div className="text-sm text-gray-600">총 게시글</div>
                        </div>
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">{board.stats?.viewCount || 0}</div>
                          <div className="text-sm text-gray-600">총 조회수</div>
                        </div>
                        <div className="text-center p-3 bg-orange-50 rounded-lg">
                          <div className="text-2xl font-bold text-orange-600">{board.stats?.activeUserCount || 0}</div>
                          <div className="text-sm text-gray-600">활성 사용자</div>
                        </div>
                      </div>

                      <Separator className="my-4" />

                      {/* 설정 정보 */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">공개 설정:</span>
                          <div className="mt-1">
                            {board.isPublic ? '공개 게시판' : '비공개 게시판'}
                          </div>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">게시판 설정:</span>
                          <div className="mt-1">
                            익명: {board.allowAnonymous ? '허용' : '금지'} | 
                            투표: {board.allowPolls ? '허용' : '금지'}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* 게시판 추가/수정 모달 */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBoard ? '게시판 수정' : '게시판 추가'}
            </DialogTitle>
            <DialogDescription>
              게시판 정보를 입력하고 설정을 구성하세요.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* 기본 정보 */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-700">기본 정보</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">게시판 이름 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="게시판 이름을 입력하세요"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">게시판 코드 *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toLowerCase() }))}
                    placeholder="영문 소문자 (예: free, study)"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">설명</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="게시판 설명을 입력하세요"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">게시판 타입</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: BoardType) => setFormData(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="national">전국</SelectItem>
                      <SelectItem value="regional">지역</SelectItem>
                      <SelectItem value="school">학교</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="order">순서</Label>
                  <Input
                    id="order"
                    type="number"
                    value={formData.order}
                    onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-8">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                  />
                  <Label htmlFor="isActive">활성화</Label>
                </div>
              </div>
            </div>

            <Separator />

            {/* 게시판 설정 */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-700">게시판 설정</h4>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="isPublic">공개 게시판</Label>
                  <Switch
                    id="isPublic"
                    checked={formData.isPublic}
                    onCheckedChange={(checked) => setFormData(prev => ({
                      ...prev,
                      isPublic: checked
                    }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="allowAnonymous">익명 글 허용</Label>
                  <Switch
                    id="allowAnonymous"
                    checked={formData.allowAnonymous}
                    onCheckedChange={(checked) => setFormData(prev => ({
                      ...prev,
                      allowAnonymous: checked
                    }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="allowPolls">투표 허용</Label>
                  <Switch
                    id="allowPolls"
                    checked={formData.allowPolls}
                    onCheckedChange={(checked) => setFormData(prev => ({
                      ...prev,
                      allowPolls: checked
                    }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>
              취소
            </Button>
            <Button onClick={saveBoard} disabled={isLoading}>
              {editingBoard ? '수정' : '생성'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 데이터 정리 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle>데이터 정리</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Poll 필드 정리</h3>
              <p className="text-sm text-muted-foreground mb-4">
                게시글 수정 시 생성된 잘못된 poll._methodName 필드를 정리합니다.
              </p>
              <Button 
                onClick={handleCleanupPollFields}
                disabled={isCleaningUp}
                variant="outline"
              >
                {isCleaningUp ? '정리 중...' : '잘못된 Poll 필드 정리'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 
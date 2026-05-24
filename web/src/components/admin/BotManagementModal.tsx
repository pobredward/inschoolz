"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  Users, Plus, Trash2, RefreshCw, Bot, AlertTriangle,
  UserPlus, UserMinus, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

interface Bot {
  id: string;
  nickname: string;
  schoolType: string;
  createdAt: string;
  postCount: number;
  commentCount: number;
}

interface BotManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  school: {
    id: string;
    name: string;
    type: 'elementary' | 'middle' | 'high';
    botCount: number;
  };
  onBotCountUpdate: (newCount: number) => void;
}

export function BotManagementModal({ 
  isOpen, 
  onClose, 
  school, 
  onBotCountUpdate 
}: BotManagementModalProps) {
  const [bots, setBots] = useState<Bot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newBotCount, setNewBotCount] = useState(1);
  const [selectedBots, setSelectedBots] = useState<Set<string>>(new Set());

  // 봇 목록 조회
  const fetchBots = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/schools/${school.id}/bots`);
      const result = await response.json();
      
      if (result.success) {
        setBots(result.data || []);
      } else {
        throw new Error(result.error || '봇 목록 조회 실패');
      }
    } catch (error) {
      console.error('봇 목록 조회 오류:', error);
      toast.error('봇 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 봇 생성
  const createBots = async () => {
    try {
      setIsCreating(true);
      const response = await fetch('/api/admin/bulk-operations/single-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'create_bots',
          schoolCount: 1,
          botsPerSchool: newBotCount,
          schoolId: school.id,
          schoolName: school.name
        })
      });
      
      const result = await response.json();
      if (result.success) {
        toast.success(`${newBotCount}개의 봇이 생성되었습니다.`);
        await fetchBots();
        onBotCountUpdate(bots.length + newBotCount);
        setNewBotCount(1);
      } else {
        throw new Error(result.error || '봇 생성 실패');
      }
    } catch (error) {
      console.error('봇 생성 오류:', error);
      toast.error('봇 생성 중 오류가 발생했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  // 선택된 봇들 삭제
  const deleteSelectedBots = async () => {
    if (selectedBots.size === 0) {
      toast.warning('삭제할 봇을 선택해주세요.');
      return;
    }

    const confirmed = confirm(`선택된 ${selectedBots.size}개의 봇을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`);
    if (!confirmed) return;

    try {
      setIsDeleting(true);
      const response = await fetch('/api/admin/schools/bots/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botIds: Array.from(selectedBots),
          schoolId: school.id
        })
      });
      
      const result = await response.json();
      if (result.success) {
        toast.success(`${selectedBots.size}개의 봇이 삭제되었습니다.`);
        await fetchBots();
        onBotCountUpdate(bots.length - selectedBots.size);
        setSelectedBots(new Set());
      } else {
        throw new Error(result.error || '봇 삭제 실패');
      }
    } catch (error) {
      console.error('봇 삭제 오류:', error);
      toast.error('봇 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 모달이 열릴 때 봇 목록 조회
  useEffect(() => {
    if (isOpen) {
      fetchBots();
      setSelectedBots(new Set());
    }
  }, [isOpen, school.id]);

  // 전체 선택/해제
  const toggleSelectAll = () => {
    if (selectedBots.size === bots.length) {
      setSelectedBots(new Set());
    } else {
      setSelectedBots(new Set(bots.map(bot => bot.id)));
    }
  };

  // 개별 봇 선택/해제
  const toggleBotSelection = (botId: string) => {
    const newSelected = new Set(selectedBots);
    if (newSelected.has(botId)) {
      newSelected.delete(botId);
    } else {
      newSelected.add(botId);
    }
    setSelectedBots(newSelected);
  };

  const getSchoolTypeLabel = (type: string) => {
    switch (type) {
      case 'elementary': return '초등학교';
      case 'middle': return '중학교';
      case 'high': return '고등학교';
      default: return type;
    }
  };

  // 유저 프로필로 이동
  const navigateToUserProfile = (botId: string) => {
    window.open(`/users/${botId}`, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            {school.name} - 봇 관리
            <Badge variant="outline">
              {getSchoolTypeLabel(school.type)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 봇 생성 섹션 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              <h3 className="font-medium">봇 생성</h3>
            </div>
            
            <div className="flex items-end gap-4">
              <div>
                <Label htmlFor="bot-count">생성할 봇 수</Label>
                <Input
                  id="bot-count"
                  type="number"
                  min="1"
                  max="10"
                  value={newBotCount}
                  onChange={(e) => setNewBotCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                  className="w-32"
                />
              </div>
              <Button 
                onClick={createBots} 
                disabled={isCreating || newBotCount < 1}
                className="flex items-center gap-2"
              >
                {isCreating ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                봇 생성
              </Button>
            </div>
          </div>

          <Separator />

          {/* 봇 목록 섹션 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <h3 className="font-medium">현재 봇 목록</h3>
                <Badge variant="outline">
                  {bots.length}개
                </Badge>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchBots}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
                
                {bots.length > 0 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleSelectAll}
                    >
                      {selectedBots.size === bots.length ? '전체 해제' : '전체 선택'}
                    </Button>
                    
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={deleteSelectedBots}
                      disabled={selectedBots.size === 0 || isDeleting}
                    >
                      {isDeleting ? (
                        <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-1" />
                      )}
                      선택 삭제 ({selectedBots.size})
                    </Button>
                  </>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                봇 목록을 불러오는 중...
              </div>
            ) : bots.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>생성된 봇이 없습니다.</p>
                <p className="text-sm">위에서 봇을 생성해보세요.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {bots.map((bot) => (
                  <div
                    key={bot.id}
                    className={`border rounded-lg p-3 transition-colors ${
                      selectedBots.has(bot.id) ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedBots.has(bot.id)}
                          onChange={() => toggleBotSelection(bot.id)}
                          className="rounded"
                        />
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => navigateToUserProfile(bot.id)}
                              className="font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                            >
                              {bot.nickname}
                            </button>
                            <Badge variant="secondary" className="text-xs">
                              {getSchoolTypeLabel(bot.schoolType)}
                            </Badge>
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          </div>
                          
                          <div className="text-sm text-muted-foreground">
                            게시글 {bot.postCount}개 · 댓글 {bot.commentCount}개 · {bot.createdAt}
                          </div>
                        </div>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleBotSelection(bot.id)}
                      >
                        <Bot className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 경고 메시지 */}
          {bots.length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">주의사항</p>
                <ul className="mt-1 space-y-1 text-xs">
                  <li>• 봇을 삭제하면 해당 봇이 작성한 게시글과 댓글도 함께 삭제됩니다.</li>
                  <li>• 학교의 memberCount와 favoriteCount가 자동으로 업데이트됩니다.</li>
                  <li>• 삭제된 데이터는 복구할 수 없습니다.</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

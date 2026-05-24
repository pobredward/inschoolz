"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Bot, RefreshCw, Search, Plus, Trash2, Edit, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/AuthProvider';

interface BotAccount {
  uid: string;
  nickname: string;
  email?: string;
  schoolId: string;
  schoolName: string;
  schoolType?: string;
  profileImageUrl?: string;
  createdAt: string;
  stats: {
    level: number;
    totalExperience: number;
    postCount: number;
    commentCount: number;
  };
}

export default function FakeBotsPage() {
  const { user } = useAuth();
  const [bots, setBots] = useState<BotAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  
  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [totalBots, setTotalBots] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const pageSize = 50;
  
  // 편집 관련 상태
  const [editingBot, setEditingBot] = useState<BotAccount | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    userName: '',
    realName: '',
    profileImageUrl: '',
    level: 1,
    postCount: 0,
    commentCount: 0
  });

  // 봇 계정 목록 가져오기 (검색 포함, 페이지네이션)
  const fetchBots = async (search?: string, page: number = 1) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.append('limit', pageSize.toString());
      params.append('page', page.toString());
      
      if (search && search.trim()) {
        params.append('search', search.trim());
      }
      
      const response = await fetch(`/api/admin/bot-accounts?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      const result = await response.json();
      
      if (result.success) {
        setBots(result.data || []);
        setTotalBots(result.total || 0);
        setHasNextPage(result.hasNextPage || false);
        
        const message = result.isSearchMode 
          ? `검색 완료: 전체 ${result.totalScanned}개 중 ${result.data.length}개 결과 (${page}페이지)`
          : `${result.data.length}개의 봇 계정을 조회했습니다. (${page}페이지, 총 ${result.total}개)`;
        toast.success(message);
      } else {
        throw new Error(result.error || '알 수 없는 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('봇 계정 조회 오류:', error);
      toast.error('봇 계정을 불러오는데 실패했습니다.');
      setBots([]);
      setTotalBots(0);
      setHasNextPage(false);
    } finally {
      setIsLoading(false);
    }
  };

  // 새 봇 계정 생성
  const createBot = async () => {
    try {
      setIsCreating(true);
      const response = await fetch('/api/admin/bot-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolLimit: 10
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success('새 봇 계정이 생성되었습니다.');
        await fetchBots(searchTerm, currentPage);
      } else {
        throw new Error(result.error || '봇 계정 생성 실패');
      }
    } catch (error) {
      console.error('봇 계정 생성 오류:', error);
      toast.error('봇 계정 생성에 실패했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  // 봇 계정 삭제
  const deleteBot = async (botUid: string) => {
    if (!confirm('정말로 이 봇 계정을 삭제하시겠습니까?')) return;

    console.log(`🗑️ [DELETE-BOT] 봇 삭제 시작: ${botUid}`);

    try {
      console.log(`📡 [DELETE-BOT] API 호출: /api/admin/bot-accounts/${botUid}`);
      
      const response = await fetch(`/api/admin/bot-accounts/${botUid}`, {
        method: 'DELETE'
      });

      console.log(`📊 [DELETE-BOT] 응답 상태:`, response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`📋 [DELETE-BOT] 응답 데이터:`, result);

      if (result.success) {
        console.log(`✅ [DELETE-BOT] 성공: ${result.deletedBotId}`);
        toast.success('봇 계정이 삭제되었습니다.');
        await fetchBots(searchTerm, currentPage);
      } else {
        console.error(`❌ [DELETE-BOT] 실패:`, result.error);
        throw new Error(result.error || '봇 계정 삭제 실패');
      }
    } catch (error) {
      console.error(`💥 [DELETE-BOT] 오류:`, error);
      toast.error(`봇 계정 삭제에 실패했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // 봇 편집 시작
  const startEditBot = (bot: BotAccount) => {
    setEditingBot(bot);
    setEditForm({
      userName: bot.nickname || '',
      realName: bot.realName || '',
      profileImageUrl: bot.profileImageUrl || '',
      level: bot.stats?.level || 1,
      postCount: bot.stats?.postCount || 0,
      commentCount: bot.stats?.commentCount || 0
    });
    setIsEditing(true);
  };

  // 봇 편집 취소
  const cancelEditBot = () => {
    setEditingBot(null);
    setIsEditing(false);
    setEditForm({
      userName: '',
      realName: '',
      profileImageUrl: '',
      level: 1,
      postCount: 0,
      commentCount: 0
    });
  };

  // 봇 정보 업데이트
  const updateBot = async () => {
    if (!editingBot) return;

    console.log(`✏️ [UPDATE-BOT] 봇 업데이트 시작: ${editingBot.uid}`);

    try {
      console.log(`📡 [UPDATE-BOT] API 호출: /api/admin/bot-accounts/${editingBot.uid}`);
      
      const updateData = {
        userName: editForm.userName,
        realName: editForm.realName,
        profileImageUrl: editForm.profileImageUrl,
        stats: {
          level: editForm.level,
          postCount: editForm.postCount,
          commentCount: editForm.commentCount
        }
      };
      
      console.log(`📊 [UPDATE-BOT] 업데이트 데이터:`, updateData);
      
      const response = await fetch(`/api/admin/bot-accounts/${editingBot.uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      console.log(`📊 [UPDATE-BOT] 응답 상태:`, response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`📋 [UPDATE-BOT] 응답 데이터:`, result);

      if (result.success) {
        console.log(`✅ [UPDATE-BOT] 성공: ${result.updatedBot.uid}`);
        toast.success('봇 계정이 수정되었습니다.');
        cancelEditBot();
        await fetchBots(searchTerm, currentPage);
      } else {
        console.error(`❌ [UPDATE-BOT] 실패:`, result.error);
        throw new Error(result.error || '봇 계정 수정 실패');
      }
    } catch (error) {
      console.error(`💥 [UPDATE-BOT] 오류:`, error);
      toast.error(`봇 계정 수정에 실패했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // 검색 토큰 마이그레이션
  const migrateSearchTokens = async () => {
    if (!confirm('모든 봇 계정에 검색 토큰을 추가하시겠습니까? (시간이 걸릴 수 있습니다)')) return;

    try {
      setIsMigrating(true);
      const response = await fetch('/api/admin/bot-accounts', {
        method: 'PATCH'
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`마이그레이션 완료: ${result.updatedBots}개 봇 계정 업데이트`);
        await fetchBots(searchTerm, currentPage);
      } else {
        throw new Error(result.error || '마이그레이션 실패');
      }
    } catch (error) {
      console.error('마이그레이션 오류:', error);
      toast.error('검색 토큰 마이그레이션에 실패했습니다.');
    } finally {
      setIsMigrating(false);
    }
  };


  useEffect(() => {
    fetchBots('', 1);
  }, []);

  // 검색어 변경 시 디바운스 적용 (첫 페이지로 리셋)
  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      setCurrentPage(1);
      fetchBots(searchTerm, 1);
    }, 500);

    return () => clearTimeout(delayedSearch);
  }, [searchTerm]);

  // 페이지 변경 시
  useEffect(() => {
    if (currentPage > 1) {
      fetchBots(searchTerm, currentPage);
    }
  }, [currentPage]);

  if (!user?.profile?.isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">접근 권한이 없습니다</h1>
          <p className="text-muted-foreground">관리자만 접근할 수 있는 페이지입니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/admin" className="text-muted-foreground hover:text-foreground">
              관리자
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">봇 계정 관리</span>
          </div>
          <h1 className="text-3xl font-bold">🤖 봇 계정 관리</h1>
          <p className="text-muted-foreground">AI 봇 계정을 생성하고 관리하세요.</p>
        </div>
               <div className="flex gap-2">
               <Button onClick={() => fetchBots(searchTerm, currentPage)} disabled={isLoading} variant="outline">
                 <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                 새로고침
               </Button>
                 <Button onClick={migrateSearchTokens} disabled={isMigrating} variant="outline">
                   <RefreshCw className={`h-4 w-4 mr-2 ${isMigrating ? 'animate-spin' : ''}`} />
                   {isMigrating ? '마이그레이션 중...' : '데이터 마이그레이션'}
                 </Button>
                 <Button onClick={createBot} disabled={isCreating}>
                   <Plus className="h-4 w-4 mr-2" />
                   {isCreating ? '생성 중...' : '새 봇 생성'}
                 </Button>
               </div>
      </div>


      {/* 검색 */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                   <Input
                     placeholder="봇 이름, 학교명으로 검색..."
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     className="pl-10"
                   />
          </div>
        </CardContent>
      </Card>

      {/* 봇 계정 목록 */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>AI 봇 계정 ({totalBots}개)</CardTitle>
            <div className="text-sm text-muted-foreground">
              {currentPage}페이지 / 총 {Math.ceil(totalBots / pageSize)}페이지 (페이지당 {pageSize}개)
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>봇 계정을 불러오는 중...</p>
            </div>
          ) : bots.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">봇 계정이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bots.map((bot, index) => (
                <Link 
                  key={bot.uid || `bot-${index}`} 
                  href={`/users/${bot.uid}`}
                  className="block"
                >
                  <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                          {bot.profileImageUrl ? (
                            <img 
                              src={bot.profileImageUrl} 
                              alt={bot.nickname || '봇 프로필'} 
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <Bot className="h-6 w-6 text-purple-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{bot.nickname || '이름 없음'}</h3>
                            <Badge variant="outline">{bot.schoolName}</Badge>
                            <Badge variant="secondary">AI 봇</Badge>
                          </div>
                          {bot.email && (
                            <p className="text-sm text-muted-foreground mb-1">{bot.email}</p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>게시글 {bot.stats?.postCount || 0}개</span>
                            <span>댓글 {bot.stats?.commentCount || 0}개</span>
                            <span>레벨 {bot.stats?.level || 1}</span>
                            <span>가입일: {new Date(bot.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2" onClick={(e) => e.preventDefault()}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            startEditBot(bot);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            deleteBot(bot.uid);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          
          {/* 페이지네이션 */}
          {!isLoading && totalBots > 0 && (
            <div className="flex justify-between items-center mt-6 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalBots)} / {totalBots}개 표시
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  이전
                </Button>
                <div className="flex items-center gap-2 px-3 py-1 text-sm">
                  {currentPage} / {Math.ceil(totalBots / pageSize)}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  disabled={!hasNextPage || currentPage >= Math.ceil(totalBots / pageSize)}
                >
                  다음
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 봇 편집 모달 */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>봇 계정 편집</DialogTitle>
            <DialogDescription>
              {editingBot?.nickname}의 정보를 수정합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="userName" className="text-right">
                닉네임
              </Label>
              <Input
                id="userName"
                value={editForm.userName}
                onChange={(e) => setEditForm(prev => ({ ...prev, userName: e.target.value }))}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="realName" className="text-right">
                실명
              </Label>
              <Input
                id="realName"
                value={editForm.realName}
                onChange={(e) => setEditForm(prev => ({ ...prev, realName: e.target.value }))}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="profileImageUrl" className="text-right">
                프로필 이미지
              </Label>
              <Input
                id="profileImageUrl"
                value={editForm.profileImageUrl}
                onChange={(e) => setEditForm(prev => ({ ...prev, profileImageUrl: e.target.value }))}
                className="col-span-3"
                placeholder="이미지 URL"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="level" className="text-right">
                레벨
              </Label>
              <Input
                id="level"
                type="number"
                min="1"
                max="100"
                value={editForm.level}
                onChange={(e) => setEditForm(prev => ({ ...prev, level: parseInt(e.target.value) || 1 }))}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="postCount" className="text-right">
                게시글 수
              </Label>
              <Input
                id="postCount"
                type="number"
                min="0"
                value={editForm.postCount}
                onChange={(e) => setEditForm(prev => ({ ...prev, postCount: parseInt(e.target.value) || 0 }))}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="commentCount" className="text-right">
                댓글 수
              </Label>
              <Input
                id="commentCount"
                type="number"
                min="0"
                value={editForm.commentCount}
                onChange={(e) => setEditForm(prev => ({ ...prev, commentCount: parseInt(e.target.value) || 0 }))}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancelEditBot}>
              취소
            </Button>
            <Button onClick={updateBot} disabled={!editForm.userName.trim()}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

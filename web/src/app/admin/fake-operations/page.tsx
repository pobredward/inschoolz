"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Zap, RefreshCw, Play, Pause, Trash2, AlertTriangle, CheckCircle, Clock, Database, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/AuthProvider';

interface BulkOperation {
  id: string;
  type: 'generate_posts' | 'generate_bots' | 'generate_comments' | 'cleanup_posts' | 'cleanup_bots' | 'cleanup_comments' | 'cleanup_all_bots' | 'cleanup_all_posts' | 'cleanup_all_comments';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 현재 처리된 항목 수
  total: number;    // 전체 항목 수
  message: string;  // 상태 메시지
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  parameters?: any;
  params?: any;
}

export default function FakeOperationsPage() {
  const { user } = useAuth();
  const [operations, setOperations] = useState<BulkOperation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 대량 작업 목록 가져오기
  const fetchOperations = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/bulk-operations');
      const result = await response.json();
      
      if (result.success) {
        setOperations(result.data || []);
      } else {
        throw new Error(result.error || '알 수 없는 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('대량 작업 조회 오류:', error);
      toast.error('대량 작업 목록을 불러오는데 실패했습니다.');
      setOperations([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 게시글 대량 생성
  const startPostGeneration = async (schoolLimit: number, postsPerSchool: number) => {
    try {
      const response = await fetch('/api/admin/bulk-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'generate_posts',
          parameters: { schoolLimit, postsPerSchool }
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success('게시글 대량 생성이 시작되었습니다.');
        await fetchOperations();
      } else {
        throw new Error(result.error || '대량 작업 시작 실패');
      }
    } catch (error) {
      console.error('게시글 대량 생성 오류:', error);
      toast.error('게시글 대량 생성을 시작할 수 없습니다.');
    }
  };

  // 봇 계정 대량 생성
  const startBotGeneration = async (schoolLimit: number) => {
    console.log(`🚀 [BOT-GEN] 봇 생성 시작`);
    console.log(`📊 [BOT-GEN] 파라미터:`, { schoolLimit, randomBotsPerSchool: '2-4개 랜덤' });
    
    try {
      console.log(`📡 [BOT-GEN] API 호출: /api/admin/bulk-operations`);
      
      const requestData = {
        type: 'generate_bots',
        parameters: { 
          schoolCount: schoolLimit, // 백엔드에서 기대하는 파라미터명
          randomBotsPerSchool: true // 학교당 2~4개 랜덤 생성 플래그
        }
      };
      
      console.log(`📋 [BOT-GEN] 요청 데이터:`, requestData);
      
      const response = await fetch('/api/admin/bulk-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });
      
      console.log(`📊 [BOT-GEN] 응답 상태:`, response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log(`📋 [BOT-GEN] 응답 데이터:`, result);
      
      if (result.success) {
        console.log(`✅ [BOT-GEN] 성공: 작업 ID ${result.operationId}`);
        toast.success('봇 계정 대량 생성이 시작되었습니다. (학교당 2~4개 랜덤 생성)');
        await fetchOperations();
      } else {
        console.error(`❌ [BOT-GEN] 실패:`, result.error);
        throw new Error(result.error || '대량 작업 시작 실패');
      }
    } catch (error) {
      console.error(`💥 [BOT-GEN] 오류:`, error);
      toast.error(`봇 계정 대량 생성을 시작할 수 없습니다: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // 댓글 대량 생성
  const startCommentGeneration = async (commentCount: number) => {
    try {
      console.log(`💬 [COMMENT-GEN] ${commentCount}개 댓글 생성 시작`);
      
      const response = await fetch('/api/admin/bulk-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'generate_comments',
          parameters: { 
            targetCommentCount: commentCount, // 정확히 이 개수만큼 댓글 생성
            useRandomPosts: true // 랜덤 게시글에 댓글 생성 모드
          }
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success(`${commentCount}개 댓글 대량 생성이 시작되었습니다.`);
        await fetchOperations();
      } else {
        throw new Error(result.error || '대량 작업 시작 실패');
      }
    } catch (error) {
      console.error('댓글 대량 생성 오류:', error);
      toast.error('댓글 대량 생성을 시작할 수 없습니다.');
    }
  };

  // 데이터 정리 작업
  const startCleanupOperation = async (type: 'cleanup_posts' | 'cleanup_bots' | 'cleanup_comments' | 'cleanup_all_bots' | 'cleanup_all_posts' | 'cleanup_all_comments', daysOld?: number) => {
    try {
      const response = await fetch('/api/admin/bulk-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          parameters: { daysOld }
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success('데이터 정리 작업이 시작되었습니다.');
        await fetchOperations();
      } else {
        throw new Error(result.error || '대량 작업 시작 실패');
      }
    } catch (error) {
      console.error('데이터 정리 작업 오류:', error);
      toast.error('데이터 정리 작업을 시작할 수 없습니다.');
    }
  };

  // 간단한 AI 데이터 삭제 (새로운 API 사용)
  const deleteAllFakeData = async (dataType: 'bots' | 'posts' | 'comments') => {
    console.log(`🚀 [DELETE] ${dataType} 삭제 시작`);
    
    try {
      console.log(`📡 [DELETE] API 호출: /api/admin/cleanup-fake-data`);
      console.log(`📋 [DELETE] 요청 데이터:`, { type: dataType });
      
      const response = await fetch('/api/admin/cleanup-fake-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: dataType })
      });
      
      console.log(`📊 [DELETE] 응답 상태:`, response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log(`📋 [DELETE] 응답 데이터:`, result);
      
      if (result.success) {
        console.log(`✅ [DELETE] 성공: ${result.deletedCount}개 삭제됨`);
        toast.success(`${result.deletedCount}개의 AI ${dataType}이 삭제되었습니다.`);
        
        // 작업 목록 새로고침
        await fetchOperations();
        
        // 캐시 무효화 및 관련 페이지 새로고침
        await invalidateCache(dataType);
      } else {
        console.error(`❌ [DELETE] 실패:`, result.error);
        throw new Error(result.error || 'AI 데이터 삭제 실패');
      }
    } catch (error) {
      console.error(`💥 [DELETE] 오류:`, error);
      toast.error(`AI 데이터 삭제에 실패했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // 캐시 무효화 및 관련 페이지 새로고침
  const invalidateCache = async (dataType: 'bots' | 'posts' | 'comments') => {
    console.log(`🔄 [CACHE] ${dataType} 캐시 무효화 시작`);
    
    try {
      // 1. 브라우저 캐시 무효화
      if ('caches' in window) {
        console.log('🗑️ [CACHE] 브라우저 캐시 삭제 중...');
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => {
            console.log(`   - 캐시 삭제: ${cacheName}`);
            return caches.delete(cacheName);
          })
        );
        console.log('✅ [CACHE] 브라우저 캐시 삭제 완료');
      }

      // 2. 관련 API 엔드포인트 캐시 무효화
      const endpointsToInvalidate = [];
      
      if (dataType === 'bots') {
        endpointsToInvalidate.push(
          '/api/admin/bot-accounts',
          '/api/admin/bot-accounts?search='
        );
      } else if (dataType === 'posts') {
        endpointsToInvalidate.push(
          '/api/admin/fake-posts'
        );
      } else if (dataType === 'comments') {
        endpointsToInvalidate.push(
          '/api/admin/fake-comments'
        );
      }

      console.log('🔄 [CACHE] API 캐시 무효화 중...', endpointsToInvalidate);
      
      // 각 엔드포인트에 캐시 무효화 요청
      await Promise.all(
        endpointsToInvalidate.map(async (endpoint) => {
          try {
            console.log(`   - API 캐시 무효화: ${endpoint}`);
            const response = await fetch(endpoint, {
              method: 'GET',
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
              }
            });
            
            if (!response.ok) {
              console.warn(`⚠️ [CACHE] ${endpoint} 응답 오류: ${response.status} ${response.statusText}`);
            } else {
              console.log(`✅ [CACHE] ${endpoint} 캐시 무효화 성공`);
            }
          } catch (error) {
            console.warn(`⚠️ [CACHE] ${endpoint} 캐시 무효화 실패:`, error);
          }
        })
      );

      // 3. 로컬 스토리지 정리 (관련 데이터만)
      console.log('🧹 [CACHE] 로컬 스토리지 정리 중...');
      const keysToRemove = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.includes('bot') || 
          key.includes('fake') || 
          key.includes('admin') ||
          key.includes(dataType)
        )) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        console.log(`   - 로컬 스토리지 삭제: ${key}`);
        localStorage.removeItem(key);
      });

      // 4. 세션 스토리지 정리
      console.log('🧹 [CACHE] 세션 스토리지 정리 중...');
      const sessionKeysToRemove = [];
      
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (
          key.includes('bot') || 
          key.includes('fake') || 
          key.includes('admin') ||
          key.includes(dataType)
        )) {
          sessionKeysToRemove.push(key);
        }
      }
      
      sessionKeysToRemove.forEach(key => {
        console.log(`   - 세션 스토리지 삭제: ${key}`);
        sessionStorage.removeItem(key);
      });

      // 5. Next.js 라우터 캐시 무효화 (부드럽게)
      console.log('🔄 [CACHE] Next.js 라우터 캐시 새로고침...');
      try {
        // 현재 페이지 상태만 새로고침 (전체 페이지 리로드 없이)
        if (typeof window !== 'undefined') {
          console.log('   - 라우터 캐시 새로고침 (소프트)');
          // 캐시 무효화만 하고 페이지 리로드는 하지 않음
        }
      } catch (error) {
        console.warn('⚠️ [CACHE] 라우터 캐시 새로고침 실패:', error);
      }

      console.log('✅ [CACHE] 캐시 무효화 완료');
      
      // 6. 사용자에게 새로고침 권장 (선택적)
      if (dataType === 'bots') {
        console.log('💡 [CACHE] 봇 관련 페이지 새로고침 권장');
        toast.info('봇 목록이 업데이트되었습니다. 다른 탭에서 봇 관련 페이지를 새로고침해주세요.', {
          duration: 5000
        });
      }
      
    } catch (error) {
      console.error('💥 [CACHE] 캐시 무효화 오류:', error);
      // 캐시 무효화 실패해도 메인 작업은 성공으로 처리
    }
  };

  // 작업 취소
  const cancelOperation = async (operationId: string) => {
    if (!confirm('정말로 이 작업을 취소하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/admin/bulk-operations/${operationId}/cancel`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success('작업이 취소되었습니다.');
        await fetchOperations();
      } else {
        throw new Error(result.error || '작업 취소 실패');
      }
    } catch (error) {
      console.error('작업 취소 오류:', error);
      toast.error('작업 취소에 실패했습니다.');
    }
  };

  const runningOperations = operations.filter(op => op.status === 'running');
  const hasRunningOperations = runningOperations.length > 0;

  useEffect(() => {
    fetchOperations();
  }, []); // 초기 로드만

  // 실행 중인 작업이 있을 때만 더 자주 폴링
  useEffect(() => {
    const interval = setInterval(() => {
      fetchOperations();
    }, hasRunningOperations ? 2000 : 10000); // 실행 중인 작업이 있으면 2초, 없으면 10초
    
    return () => clearInterval(interval);
  }, [hasRunningOperations]); // hasRunningOperations가 변경될 때만 재실행

  const getOperationIcon = (type: string) => {
    switch (type) {
      case 'generate_posts': return <Play className="h-4 w-4" />;
      case 'generate_bots': return <Database className="h-4 w-4" />;
      case 'generate_comments': return <MessageCircle className="h-4 w-4" />;
      case 'cleanup_posts': return <Trash2 className="h-4 w-4" />;
      case 'cleanup_bots': return <Trash2 className="h-4 w-4" />;
      case 'cleanup_comments': return <Trash2 className="h-4 w-4" />;
      case 'cleanup_all_bots': return <AlertTriangle className="h-4 w-4" />;
      case 'cleanup_all_posts': return <AlertTriangle className="h-4 w-4" />;
      case 'cleanup_all_comments': return <AlertTriangle className="h-4 w-4" />;
      default: return <Zap className="h-4 w-4" />;
    }
  };

  const getOperationName = (type: string) => {
    switch (type) {
      case 'generate_posts': return 'AI 게시글 생성';
      case 'generate_bots': return '봇 계정 생성';
      case 'generate_comments': return 'AI 댓글 생성';
      case 'cleanup_posts': return '게시글 정리';
      case 'cleanup_bots': return '봇 계정 정리';
      case 'cleanup_comments': return '댓글 정리';
      case 'cleanup_all_bots': return '모든 AI 봇 삭제';
      case 'cleanup_all_posts': return '모든 AI 게시글 삭제';
      case 'cleanup_all_comments': return '모든 AI 댓글 삭제';
      default: return '알 수 없는 작업';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="secondary">대기 중</Badge>;
      case 'running': return <Badge variant="default">실행 중</Badge>;
      case 'completed': return <Badge variant="outline" className="text-green-600">완료</Badge>;
      case 'failed': return <Badge variant="destructive">실패</Badge>;
      case 'cancelled': return <Badge variant="secondary">취소됨</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

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
            <span className="font-medium">대량 작업 관리</span>
          </div>
          <h1 className="text-3xl font-bold">⚡ 대량 작업 관리</h1>
          <p className="text-muted-foreground">AI 데이터의 대량 생성, 삭제, 정리 작업을 관리하세요.</p>
        </div>
        <Button onClick={fetchOperations} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>

      {hasRunningOperations && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700">
              <Clock className="h-5 w-5" />
              실행 중인 작업 ({runningOperations.length}개)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {runningOperations.map((op, index) => (
                <div key={op.id || `running-op-${index}`} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getOperationIcon(op.type)}
                      <span className="font-medium">{getOperationName(op.type)}</span>
                      {getStatusBadge(op.status)}
                    </div>
                    <Progress value={op.total > 0 ? (op.progress / op.total) * 100 : 0} className="w-full" />
                    <p className="text-sm text-muted-foreground mt-1">
                      {op.progress} / {op.total} 완료 ({op.total > 0 ? ((op.progress / op.total) * 100).toFixed(1) : 0}%)
                    </p>
                    {op.message && (
                      <p className="text-xs text-muted-foreground mt-1">{op.message}</p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => cancelOperation(op.id)}
                    className="ml-4"
                  >
                    취소
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 게시글 생성 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700">
            <Play className="w-5 h-5" />
            AI 게시글 생성
          </CardTitle>
          <CardDescription>
            GPT를 활용하여 자연스러운 학교 커뮤니티 게시글을 대량 생성합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={() => startPostGeneration(10, 1)}
              disabled={hasRunningOperations}
              className="flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              10개 게시글 생성
            </Button>
            <Button
              onClick={() => startPostGeneration(100, 1)}
              disabled={hasRunningOperations}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              100개 게시글 생성
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={() => startPostGeneration(1000, 1)}
              disabled={hasRunningOperations}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              1000개 게시글 생성
            </Button>
            <Button
              onClick={() => startPostGeneration(5000, 1)}
              disabled={hasRunningOperations}
              variant="outline"
              className="flex items-center gap-2 text-orange-600"
            >
              <Play className="w-4 h-4" />
              5000개 게시글 생성
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 봇 계정 생성 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-700">
            <Database className="w-5 h-5" />
            봇 계정 생성
          </CardTitle>
          <CardDescription>
            학교별로 AI 봇 계정을 대량 생성합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-700">
              🎲 각 학교마다 2~4개의 봇이 랜덤으로 생성됩니다.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={() => startBotGeneration(10)}
              disabled={hasRunningOperations}
              className="flex items-center gap-2"
            >
              <Database className="w-4 h-4" />
              10개 학교 봇 생성
            </Button>
            <Button
              onClick={() => startBotGeneration(100)}
              disabled={hasRunningOperations}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Database className="w-4 h-4" />
              100개 학교 봇 생성
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={() => startBotGeneration(1000)}
              disabled={hasRunningOperations}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Database className="w-4 h-4" />
              1000개 학교 봇 생성
            </Button>
            <Button
              onClick={() => startBotGeneration(5000)}
              disabled={hasRunningOperations}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Database className="w-4 h-4" />
              5000개 학교 봇 생성
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 댓글 생성 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-700">
            <MessageCircle className="w-5 h-5" />
            AI 댓글 생성
          </CardTitle>
          <CardDescription>
            기존 게시글에 자연스러운 AI 댓글을 대량 생성합니다. 각 댓글은 서로 다른 게시글에 작성됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-700">
              💡 각 버튼은 서로 다른 게시글에 댓글을 하나씩 생성합니다. (20개 = 20개 게시글에 각각 1개 댓글)
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={() => startCommentGeneration(20)}
              disabled={hasRunningOperations}
              className="flex items-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              20개 댓글 생성
            </Button>
            <Button
              onClick={() => startCommentGeneration(50)}
              disabled={hasRunningOperations}
              variant="outline"
              className="flex items-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              50개 댓글 생성
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={() => startCommentGeneration(100)}
              disabled={hasRunningOperations}
              variant="outline"
              className="flex items-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              100개 댓글 생성
            </Button>
            <Button
              onClick={() => startCommentGeneration(200)}
              disabled={hasRunningOperations}
              variant="outline"
              className="flex items-center gap-2 text-orange-600"
            >
              <MessageCircle className="w-4 h-4" />
              200개 댓글 생성
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 데이터 정리 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <Trash2 className="w-5 h-5" />
            데이터 정리
          </CardTitle>
          <CardDescription>
            AI 데이터를 정리하여 시스템 성능을 최적화합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 일반 정리 작업 */}
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={() => startCleanupOperation('cleanup_posts', 30)}
              disabled={hasRunningOperations}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              30일 이상 게시글 정리
            </Button>
            <Button
              onClick={() => startCleanupOperation('cleanup_bots', 90)}
              disabled={hasRunningOperations}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              90일 이상 비활성 봇 정리
            </Button>
          </div>
          
          {/* 위험한 작업 - 전체 삭제 */}
          <div className="border-t pt-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <h4 className="font-semibold text-red-800">⚠️ 위험한 작업</h4>
              </div>
              <p className="text-sm text-red-700">
                아래 작업들은 모든 AI 데이터를 영구적으로 삭제합니다. 신중하게 진행하세요.
              </p>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              <Button
                onClick={() => {
                  if (confirm('⚠️ 정말로 모든 AI 봇 계정을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다!')) {
                    if (confirm('🚨 마지막 확인: 정말로 모든 AI 봇을 삭제하시겠습니까?')) {
                      deleteAllFakeData('bots');
                    }
                  }
                }}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <Database className="w-4 h-4" />
                🤖 모든 AI 봇 계정 삭제
              </Button>
              
              <Button
                onClick={() => {
                  if (confirm('⚠️ 정말로 모든 AI 게시글을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다!')) {
                    if (confirm('🚨 마지막 확인: 정말로 모든 AI 게시글을 삭제하시겠습니까?')) {
                      deleteAllFakeData('posts');
                    }
                  }
                }}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                📝 모든 AI 게시글 삭제
              </Button>
              
              <Button
                onClick={() => {
                  if (confirm('⚠️ 정말로 모든 AI 댓글을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다!')) {
                    if (confirm('🚨 마지막 확인: 정말로 모든 AI 댓글을 삭제하시겠습니까?')) {
                      deleteAllFakeData('comments');
                    }
                  }
                }}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                💬 모든 AI 댓글 삭제
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 작업 히스토리 */}
      <Card>
        <CardHeader>
          <CardTitle>작업 히스토리</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>작업 목록을 불러오는 중...</p>
            </div>
          ) : operations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">실행된 작업이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {operations.map((operation, index) => (
                <div key={operation.id || `operation-${index}`} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getOperationIcon(operation.type)}
                        <h3 className="font-semibold">{getOperationName(operation.type)}</h3>
                        {getStatusBadge(operation.status)}
                      </div>
                      {operation.status === 'running' && (
                        <div className="mb-2">
                          <Progress value={operation.total > 0 ? (operation.progress / operation.total) * 100 : 0} className="w-full" />
                          <p className="text-sm text-muted-foreground mt-1">
                            {operation.progress} / {operation.total} 완료 ({operation.total > 0 ? ((operation.progress / operation.total) * 100).toFixed(1) : 0}%)
                          </p>
                          {operation.message && (
                            <p className="text-xs text-muted-foreground mt-1">{operation.message}</p>
                          )}
                        </div>
                      )}
                      <div className="text-sm text-muted-foreground">
                        <p>시작: {operation.startedAt ? new Date(operation.startedAt).toLocaleString() : '대기 중'}</p>
                        {operation.completedAt && (
                          <p>완료: {new Date(operation.completedAt).toLocaleString()}</p>
                        )}
                        {operation.errorMessage && (
                          <p className="text-red-600">오류: {operation.errorMessage}</p>
                        )}
                      </div>
                    </div>
                    {operation.status === 'running' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => cancelOperation(operation.id)}
                      >
                        취소
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

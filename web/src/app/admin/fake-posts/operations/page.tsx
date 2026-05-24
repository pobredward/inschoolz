"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  Zap, Users, Calendar, Trash2, Download, AlertTriangle, RefreshCw,
  Clock, CheckCircle, XCircle, MessageCircle, Play, Pause, Square
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/AuthProvider';
import Link from 'next/link';
import { useBulkOperations, BulkOperationProgress } from '@/hooks/useBulkOperations';

export default function OperationsManagementPage() {
  const { user } = useAuth();
  const {
    operations,
    startBotCreation,
    startPostGeneration,
    startCommentGeneration,
    startCleanup,
    getOperationStatus
  } = useBulkOperations();

  // 관리자 권한 확인
  if (!user || user.role !== 'admin') {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              접근 권한 없음
            </CardTitle>
            <CardDescription className="text-red-600">
              이 페이지는 관리자만 접근할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin">
              <Button variant="outline" className="text-red-700 border-red-300 hover:bg-red-100">
                관리자 대시보드로 돌아가기
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusIcon = (status: BulkOperationProgress['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'running':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: BulkOperationProgress['status']) => {
    const variants = {
      pending: 'secondary',
      running: 'default',
      completed: 'success',
      failed: 'destructive'
    };
    const labels = {
      pending: '대기 중',
      running: '실행 중',
      completed: '완료',
      failed: '실패'
    };
    
    return (
      <Badge variant={variants[status] as any} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {labels[status]}
      </Badge>
    );
  };

  const operationLabels = {
    create_bots: '봇 생성',
    generate_posts: '게시글 생성',
    generate_comments: '댓글 생성',
    cleanup: '데이터 정리'
  };

  // 실행 중인 작업이 있는지 확인
  const hasRunningOperations = Array.from(operations.values()).some(op => op.status === 'running');

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">대량 작업 관리</h1>
        <p className="text-gray-600">
          하이브리드 아키텍처로 서버 제한 없이 대규모 작업을 안전하게 실행합니다.
        </p>
      </div>

      {/* 현재 실행 중인 작업들 */}
      {operations.size > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              실행 중인 작업
            </CardTitle>
            <CardDescription>
              현재 진행 중인 대량 작업들의 상태를 실시간으로 확인할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from(operations.values()).map((operation) => (
              <div key={operation.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">
                      {operationLabels[operation.type]} #{operation.id.split('_')[2]?.slice(-4)}
                    </h3>
                    {getStatusBadge(operation.status)}
                  </div>
                  <div className="text-sm text-gray-500">
                    {operation.progress}/{operation.total}
                  </div>
                </div>
                
                {operation.status === 'running' && (
                  <div className="mb-2">
                    <Progress 
                      value={(operation.progress / operation.total) * 100} 
                      className="h-2"
                    />
                  </div>
                )}
                
                <div className="text-sm text-gray-600">
                  {operation.message}
                </div>
                
                {operation.error && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    오류: {operation.error}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 작업 실행 버튼들 */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* 봇 생성 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <Users className="w-5 h-5" />
              봇 계정 생성
            </CardTitle>
            <CardDescription>
              선택한 학교들에 AI 봇 계정을 생성합니다. 배치 단위로 안전하게 처리됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={() => startBotCreation(10, 3)}
                disabled={hasRunningOperations}
                className="flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                10개 학교에 봇 생성
              </Button>
              <Button
                onClick={() => startBotCreation(100, 3)}
                disabled={hasRunningOperations}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                100개 학교에 봇 생성
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={() => startBotCreation(1000, 3)}
                disabled={hasRunningOperations}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                1000개 학교에 봇 생성
              </Button>
              <Button
                onClick={() => startBotCreation(5000, 3)}
                disabled={hasRunningOperations}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                5000개 학교에 봇 생성
              </Button>
            </div>
            <p className="text-sm text-gray-500">
              💡 각 학교당 최대 3개의 봇이 생성됩니다. 대량 생성 시 배치 크기가 자동 최적화됩니다 (5000개: 50개씩, 1000개: 20개씩).
            </p>
          </CardContent>
        </Card>

        {/* 게시글 생성 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <MessageCircle className="w-5 h-5" />
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
            <p className="text-sm text-gray-500">
              💡 대량 생성 시 배치 크기가 자동 최적화됩니다 (5000개: 100개씩, 1000개: 50개씩). OpenAI API 제한을 고려하여 딜레이도 조정됩니다.
            </p>
          </CardContent>
        </Card>

        {/* 댓글 생성 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-700">
              <Calendar className="w-5 h-5" />
              AI 댓글 생성
            </CardTitle>
            <CardDescription>
              기존 게시글에 자연스러운 AI 댓글을 생성하여 커뮤니티 활성화를 돕습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={() => startCommentGeneration(10)}
                disabled={hasRunningOperations}
                className="flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                10개 댓글 생성
              </Button>
              <Button
                onClick={() => startCommentGeneration(50)}
                disabled={hasRunningOperations}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
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
                <Play className="w-4 h-4" />
                100개 댓글 생성
              </Button>
              <Button
                onClick={() => startCommentGeneration(500)}
                disabled={hasRunningOperations}
                variant="outline"
                className="flex items-center gap-2 text-orange-600"
              >
                <Play className="w-4 h-4" />
                500개 댓글 생성
              </Button>
            </div>
            <p className="text-sm text-gray-500">
              💡 20개씩 배치로 처리되며, 게시글의 맥락에 맞는 자연스러운 댓글을 생성합니다.
            </p>
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
              AI로 생성된 가짜 데이터를 일괄 정리합니다. 신중히 사용하세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={startCleanup}
              disabled={hasRunningOperations}
              variant="destructive"
              className="w-full flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              모든 AI 생성 데이터 정리
            </Button>
            <p className="text-sm text-red-500">
              ⚠️ 이 작업은 되돌릴 수 없습니다. 신중히 결정하세요.
            </p>
          </CardContent>
        </Card>
      </div>

      <Separator className="my-8" />

      {/* 하이브리드 아키텍처 설명 */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-800 flex items-center gap-2">
            <Zap className="w-5 h-5" />
            하이브리드 아키텍처의 장점
          </CardTitle>
        </CardHeader>
        <CardContent className="text-blue-700">
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-1 flex-shrink-0" />
              <span><strong>서버 제한 우회:</strong> Vercel의 60초 제한을 배치 처리로 우회</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-1 flex-shrink-0" />
              <span><strong>실시간 진행률:</strong> 클라이언트에서 작업 상태를 실시간 추적</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-1 flex-shrink-0" />
              <span><strong>오류 복구:</strong> 배치 단위로 오류 처리 및 재시도 가능</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-1 flex-shrink-0" />
              <span><strong>대규모 처리:</strong> 1000개 이상의 학교/게시글도 안전하게 처리</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* 관리 링크 */}
      <div className="mt-8 flex flex-wrap gap-4">
        <Link href="/admin">
          <Button variant="outline" className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            관리자 대시보드
          </Button>
        </Link>
        <Link href="/admin/fake-posts">
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            게시글 관리
          </Button>
        </Link>
        <Link href="/admin/users">
          <Button variant="outline" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            사용자 관리
          </Button>
        </Link>
      </div>
    </div>
  );
}
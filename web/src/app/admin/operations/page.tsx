"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Activity, Zap, Users, Calendar, Trash2, Download, AlertTriangle, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/AuthProvider';
import Link from 'next/link';

interface BulkOperation {
  id: string;
  type: 'create_bots' | 'generate_posts' | 'delete_posts' | 'cleanup';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  total: number;
  message: string;
  startedAt: string;
  completedAt?: string;
}

export default function AdminOperationsPage() {
  const { user } = useAuth();
  const [bulkOperations, setBulkOperations] = useState<BulkOperation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 대량 작업 목록 가져오기
  const fetchBulkOperations = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/bulk-operations');
      const result = await response.json();
      
      if (result.success) {
        setBulkOperations(result.data || []);
      } else {
        throw new Error(result.error || '대량 작업 조회 실패');
      }
    } catch (error) {
      console.error('대량 작업 조회 오류:', error);
      toast.error('대량 작업 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 대량 작업 실행
  const executeBulkOperation = async (type: BulkOperation['type'], params: any) => {
    try {
      const response = await fetch('/api/admin/bulk-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, params })
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success('대량 작업이 시작되었습니다.');
        fetchBulkOperations();
      } else {
        throw new Error(result.error || '대량 작업 시작 실패');
      }
    } catch (error) {
      console.error('대량 작업 실행 오류:', error);
      toast.error('대량 작업을 시작할 수 없습니다.');
    }
  };

  useEffect(() => {
    fetchBulkOperations();
    
    // 5초마다 자동 새로고침
    const interval = setInterval(fetchBulkOperations, 5000);
    return () => clearInterval(interval);
  }, []);

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
            <Link href="/admin/dashboard" className="text-muted-foreground hover:text-foreground">
              관리자
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">대량 작업</span>
          </div>
          <h1 className="text-3xl font-bold">⚡ 대량 작업 관리</h1>
          <p className="text-muted-foreground">대량 작업을 실행하고 진행 상황을 모니터링하세요.</p>
        </div>
        <Button onClick={fetchBulkOperations} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>

      {/* 작업 현황 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            진행 중인 작업
          </CardTitle>
          <CardDescription>
            현재 실행 중이거나 완료된 대량 작업들의 상태를 확인할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                작업 목록을 불러오는 중...
              </div>
            ) : bulkOperations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                진행 중인 작업이 없습니다.
              </div>
            ) : (
              bulkOperations.map((operation, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        operation.status === 'running' ? 'bg-blue-500 animate-pulse' :
                        operation.status === 'completed' ? 'bg-green-500' :
                        operation.status === 'failed' ? 'bg-red-500' : 'bg-gray-400'
                      }`} />
                      <span className="font-medium">
                        {operation.type === 'create_bots' ? '봇 계정 생성' :
                         operation.type === 'generate_posts' ? 'AI 게시글 생성' :
                         operation.type === 'delete_posts' ? '게시글 삭제' : '데이터 정리'}
                      </span>
                      <Badge variant={
                        operation.status === 'running' ? 'default' :
                        operation.status === 'completed' ? 'secondary' :
                        operation.status === 'failed' ? 'destructive' : 'outline'
                      }>
                        {operation.status === 'running' ? '실행 중' :
                         operation.status === 'completed' ? '완료' :
                         operation.status === 'failed' ? '실패' : '대기 중'}
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {operation.progress}/{operation.total}
                    </span>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(operation.progress / operation.total) * 100}%` }}
                    />
                  </div>
                  
                  <p className="text-sm text-muted-foreground">{operation.message}</p>
                  
                  <div className="text-xs text-muted-foreground mt-2">
                    시작: {new Date(operation.startedAt).toLocaleString('ko-KR')}
                    {operation.completedAt && (
                      <span> | 완료: {new Date(operation.completedAt).toLocaleString('ko-KR')}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* 새 작업 시작 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            새 대량 작업 시작
          </CardTitle>
          <CardDescription>
            대량 작업을 설정하고 실행할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium">봇 계정 관리</h4>
              <div className="space-y-2">
                <Button 
                  onClick={() => executeBulkOperation('create_bots', { schoolCount: 500 })}
                  className="w-full justify-start"
                  variant="outline"
                >
                  <Users className="h-4 w-4 mr-2" />
                  500개 학교에 봇 생성 (1,500개 봇)
                </Button>
                <Button 
                  onClick={() => executeBulkOperation('create_bots', { schoolCount: 1000 })}
                  className="w-full justify-start"
                  variant="outline"
                >
                  <Users className="h-4 w-4 mr-2" />
                  1,000개 학교에 봇 생성 (3,000개 봇)
                </Button>
                <Button 
                  onClick={() => executeBulkOperation('create_bots', { schoolCount: 12525 })}
                  className="w-full justify-start"
                  variant="outline"
                >
                  <Users className="h-4 w-4 mr-2" />
                  전체 학교에 봇 생성 (37,575개 봇)
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">게시글 생성</h4>
              <div className="space-y-2">
                <Button 
                  onClick={() => executeBulkOperation('generate_posts', { schoolLimit: 100, postsPerSchool: 1 })}
                  className="w-full justify-start"
                  variant="outline"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  100개 학교 × 1개 게시글
                </Button>
                <Button 
                  onClick={() => executeBulkOperation('generate_posts', { schoolLimit: 500, postsPerSchool: 2 })}
                  className="w-full justify-start"
                  variant="outline"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  500개 학교 × 2개 게시글
                </Button>
                <Button 
                  onClick={() => executeBulkOperation('generate_posts', { schoolLimit: 1000, postsPerSchool: 3 })}
                  className="w-full justify-start"
                  variant="outline"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  1,000개 학교 × 3개 게시글
                </Button>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium">데이터 정리</h4>
              <div className="space-y-2">
                <Button 
                  onClick={() => executeBulkOperation('cleanup', { olderThanDays: 7 })}
                  className="w-full justify-start"
                  variant="outline"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  7일 이상 된 게시글 삭제
                </Button>
                <Button 
                  onClick={() => executeBulkOperation('cleanup', { olderThanDays: 30 })}
                  className="w-full justify-start"
                  variant="outline"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  30일 이상 된 게시글 삭제
                </Button>
                <Button 
                  onClick={() => {
                    if (confirm('정말로 모든 AI 게시글을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
                      executeBulkOperation('delete_posts', { all: true });
                    }
                  }}
                  className="w-full justify-start"
                  variant="destructive"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  모든 AI 게시글 삭제
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">데이터 관리</h4>
              <div className="space-y-2">
                <Button 
                  onClick={() => window.open('/api/admin/export-data?type=posts', '_blank')}
                  className="w-full justify-start"
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-2" />
                  게시글 데이터 내보내기
                </Button>
                <Button 
                  onClick={() => window.open('/api/admin/export-data?type=bots', '_blank')}
                  className="w-full justify-start"
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-2" />
                  봇 계정 데이터 내보내기
                </Button>
                <Button 
                  onClick={() => window.open('/api/admin/export-data?type=schools', '_blank')}
                  className="w-full justify-start"
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-2" />
                  학교 통계 내보내기
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 작업 가이드 */}
      <Card>
        <CardHeader>
          <CardTitle>대량 작업 가이드</CardTitle>
          <CardDescription>
            효율적인 대량 작업을 위한 권장사항입니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div>
              <h5 className="font-medium mb-2">🤖 봇 계정 생성</h5>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>각 학교당 3개의 봇 계정이 생성됩니다</li>
                <li>봇 계정은 학교별로 고유한 닉네임을 가집니다</li>
                <li>생성 완료까지 약 1-2분 소요됩니다</li>
              </ul>
            </div>
            
            <div>
              <h5 className="font-medium mb-2">📝 게시글 생성</h5>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>봇 계정이 있는 학교에서만 게시글이 생성됩니다</li>
                <li>각 게시글은 OpenAI를 통해 자연스럽게 생성됩니다</li>
                <li>생성 속도는 API 제한에 따라 조절됩니다</li>
              </ul>
            </div>
            
            <div>
              <h5 className="font-medium mb-2">🗑️ 데이터 정리</h5>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>실제 사용자 게시글은 삭제되지 않습니다</li>
                <li>AI 게시글만 선별적으로 삭제됩니다</li>
                <li>삭제 작업은 되돌릴 수 없으니 신중히 선택하세요</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

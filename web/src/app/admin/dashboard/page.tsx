"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, Users, Calendar, School, Bot, Trash2, RefreshCw,
  AlertTriangle, Zap, Activity, Download, Target
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/AuthProvider';
import Link from 'next/link';

interface SystemStats {
  totalSchools: number;
  schoolsWithBots: number;
  totalBots: number;
  totalPosts: number;
  postsToday: number;
  averagePostsPerSchool: number;
  topActiveSchools: Array<{
    id: string;
    name: string;
    postCount: number;
  }>;
}

interface FakePost {
  id: string;
  title: string;
  content: string;
  schoolId: string;
  schoolName: string;
  authorId: string;
  authorNickname?: string;
  boardCode: string;
  boardName: string;
  createdAt: string | null;
  stats: {
    viewCount: number;
    likeCount: number;
    commentCount: number;
  };
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [recentPosts, setRecentPosts] = useState<FakePost[]>([]);
  const [, setIsLoading] = useState(true);

  // 시스템 통계 가져오기
  const fetchSystemStats = async () => {
    try {
      const response = await fetch('/api/admin/system-stats');
      const result = await response.json();
      
      if (result.success) {
        setSystemStats(result.data);
      } else {
        throw new Error(result.error || '통계 조회 실패');
      }
    } catch (error) {
      console.error('시스템 통계 조회 오류:', error);
      toast.error('시스템 통계를 불러오는데 실패했습니다.');
    }
  };

  // 최근 게시글 가져오기
  const fetchRecentPosts = async () => {
    try {
      const response = await fetch('/api/admin/fake-posts?limit=5');
      const result = await response.json();
      
      if (result.success) {
        setRecentPosts(result.data || []);
      }
    } catch (error) {
      console.error('최근 게시글 조회 오류:', error);
    }
  };

  // 대량 작업 실행
  const executeBulkOperation = async (type: string, params: Record<string, unknown>) => {
    try {
      const response = await fetch('/api/admin/bulk-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, params })
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success('대량 작업이 시작되었습니다.');
      } else {
        throw new Error(result.error || '대량 작업 시작 실패');
      }
    } catch (error) {
      console.error('대량 작업 실행 오류:', error);
      toast.error('대량 작업을 시작할 수 없습니다.');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchSystemStats(),
        fetchRecentPosts()
      ]);
      setIsLoading(false);
    };

    loadData();
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
          <h1 className="text-3xl font-bold">📊 관리자 대시보드</h1>
          <p className="text-muted-foreground">시스템 전체 현황을 한눈에 확인하세요.</p>
        </div>
        <Button onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          새로고침
        </Button>
      </div>

      {/* 시스템 개요 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">전체 학교</p>
                <p className="text-2xl font-bold">{systemStats?.totalSchools?.toLocaleString() || '12,525'}</p>
              </div>
              <School className="h-8 w-8 text-blue-600" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              봇 있는 학교: {systemStats?.schoolsWithBots?.toLocaleString() || '2'}개
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">총 봇 계정</p>
                <p className="text-2xl font-bold">{systemStats?.totalBots?.toLocaleString() || '6'}</p>
              </div>
              <Bot className="h-8 w-8 text-purple-600" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              활성 봇: {Math.floor((systemStats?.totalBots || 0) * 0.8)}개
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">총 AI 게시글</p>
                <p className="text-2xl font-bold">{systemStats?.totalPosts?.toLocaleString() || '3'}</p>
              </div>
              <Calendar className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              오늘: {systemStats?.postsToday || 0}개
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">평균 게시글/학교</p>
                <p className="text-2xl font-bold">{systemStats?.averagePostsPerSchool?.toFixed(1) || '0.0'}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-600" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              지난 7일 평균
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 빠른 작업 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            빠른 작업
          </CardTitle>
          <CardDescription>
            자주 사용하는 관리 작업들을 빠르게 실행할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button 
              onClick={() => executeBulkOperation('create_bots', { schoolCount: 100 })}
              className="h-20 flex-col gap-2"
              variant="outline"
            >
              <Users className="h-6 w-6" />
              <span>봇 대량 생성</span>
              <span className="text-xs text-muted-foreground">100개 학교</span>
            </Button>

            <Button 
              onClick={() => executeBulkOperation('generate_posts', { schoolLimit: 50, postsPerSchool: 2 })}
              className="h-20 flex-col gap-2"
              variant="outline"
            >
              <Calendar className="h-6 w-6" />
              <span>게시글 대량 생성</span>
              <span className="text-xs text-muted-foreground">50개 학교 × 2개</span>
            </Button>

            <Button 
              onClick={() => executeBulkOperation('cleanup', { olderThanDays: 30 })}
              className="h-20 flex-col gap-2"
              variant="outline"
            >
              <Trash2 className="h-6 w-6" />
              <span>오래된 게시글 정리</span>
              <span className="text-xs text-muted-foreground">30일 이상</span>
            </Button>

            <Button 
              onClick={() => window.open('/api/admin/export-data', '_blank')}
              className="h-20 flex-col gap-2"
              variant="outline"
            >
              <Download className="h-6 w-6" />
              <span>데이터 내보내기</span>
              <span className="text-xs text-muted-foreground">CSV/JSON</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 관리 메뉴 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/admin/posts">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold">AI 게시글 관리</h3>
                  <p className="text-sm text-muted-foreground">게시글 조회, 수정, 삭제</p>
                  <Badge variant="secondary" className="mt-1">
                    {systemStats?.totalPosts || 0}개
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/bots">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Bot className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold">봇 계정 관리</h3>
                  <p className="text-sm text-muted-foreground">봇 현황 및 통계</p>
                  <Badge variant="secondary" className="mt-1">
                    {systemStats?.totalBots || 0}개
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/schools-management">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <School className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold">학교 관리</h3>
                  <p className="text-sm text-muted-foreground">학교별 봇 생성 및 관리</p>
                  <Badge variant="secondary" className="mt-1">
                    {systemStats?.totalSchools?.toLocaleString() || '12,525'}개
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/operations">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <Zap className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold">대량 작업</h3>
                  <p className="text-sm text-muted-foreground">대량 생성, 삭제, 정리</p>
                  <Badge variant="secondary" className="mt-1">
                    실시간 모니터링
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/reports">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold">신고 관리</h3>
                  <p className="text-sm text-muted-foreground">사용자 신고 처리</p>
                  <Badge variant="destructive" className="mt-1">
                    처리 대기
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/users">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gray-100 rounded-lg">
                  <Users className="h-6 w-6 text-gray-600" />
                </div>
                <div>
                  <h3 className="font-semibold">사용자 관리</h3>
                  <p className="text-sm text-muted-foreground">일반 사용자 관리</p>
                  <Badge variant="outline" className="mt-1">
                    전체 사용자
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* 최근 활동 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              최근 생성된 게시글
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentPosts.slice(0, 5).map((post) => (
                <div key={post.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <Bot className="h-4 w-4 mt-1 text-purple-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{post.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {post.authorNickname} • {post.schoolName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {post.createdAt ? new Date(post.createdAt).toLocaleDateString('ko-KR') : ''}
                    </p>
                  </div>
                </div>
              ))}
              {recentPosts.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  최근 생성된 게시글이 없습니다.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              활성 학교 TOP 5
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {systemStats?.topActiveSchools?.slice(0, 5).map((school, index) => (
                <div key={school.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-center w-6 h-6 bg-primary text-primary-foreground rounded-full text-xs font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{school.name}</p>
                    <p className="text-xs text-muted-foreground">
                      봇 {school.botCount}개 • 게시글 {school.postCount}개
                    </p>
                  </div>
                  <Badge variant={school.status === 'active' ? 'default' : 'secondary'}>
                    {school.status === 'active' ? '활성' : '비활성'}
                  </Badge>
                </div>
              )) || (
                <p className="text-sm text-muted-foreground text-center py-4">
                  데이터를 불러오는 중...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

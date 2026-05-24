"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, RefreshCw, School, Calendar, TrendingUp, Clock, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/AuthProvider';
import Link from 'next/link';

interface BotAccount {
  uid: string;
  nickname: string;
  schoolId: string;
  schoolName: string;
  schoolType: 'elementary' | 'middle' | 'high';
  stats: {
    level: number;
    totalExperience: number;
    postCount: number;
    commentCount: number;
  };
  createdAt: string;
}

interface BotResponse {
  success: boolean;
  data: BotAccount[];
  total: number;
  hasMore?: boolean;
  queryTime?: number;
  lastUpdated: string;
  source: string;
  note?: string;
  error?: string;
}

export default function BotsManagementPage() {
  const { user } = useAuth();
  const [botAccounts, setBotAccounts] = useState<BotAccount[]>([]);
  const [isLoadingBots, setIsLoadingBots] = useState(false);
  const [schoolTypeFilter, setSchoolTypeFilter] = useState<string>('all');
  const [queryTime, setQueryTime] = useState<number>(0);
  const [dataSource, setDataSource] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // 봇 계정 목록 가져오기 (최적화된 버전)
  const fetchBotAccounts = async (useCache: boolean = true) => {
    try {
      setIsLoadingBots(true);
      
      const params = new URLSearchParams({
        limit: '100',
        schoolType: schoolTypeFilter,
        cache: useCache.toString()
      });
      
      const response = await fetch(`/api/admin/bot-accounts?${params}`);
      const result: BotResponse = await response.json();
      
      if (result.success) {
        setBotAccounts(result.data || []);
        setQueryTime(result.queryTime || 0);
        setDataSource(result.source);
        setLastUpdated(result.lastUpdated);
        
        const sourceText = result.source === 'cache' ? '캐시' : 'Firebase';
        const timeText = result.queryTime ? ` (${result.queryTime}ms)` : '';
        toast.success(`${sourceText}에서 ${result.data.length}개의 봇 계정을 조회했습니다${timeText}`);
      } else {
        throw new Error(result.error || '알 수 없는 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('봇 계정 조회 오류:', error);
      toast.error('봇 계정을 불러오는데 실패했습니다.');
      setBotAccounts([]);
    } finally {
      setIsLoadingBots(false);
    }
  };

  // 강제 새로고침 (캐시 무시)
  const forceRefresh = () => {
    fetchBotAccounts(false);
  };

  // 학교 유형 필터 변경 시 자동 새로고침
  useEffect(() => {
    fetchBotAccounts();
  }, [schoolTypeFilter]);

  // 초기 로드
  useEffect(() => {
    fetchBotAccounts();
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
            <Link href="/admin" className="text-muted-foreground hover:text-foreground">
              관리자
            </Link>
            <span className="text-muted-foreground">/</span>
            <Link href="/admin/fake-posts" className="text-muted-foreground hover:text-foreground">
              AI 게시글 관리
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">봇 계정 관리</span>
          </div>
          <h1 className="text-3xl font-bold">🤖 봇 계정 목록</h1>
          <p className="text-muted-foreground">시스템에 등록된 모든 봇 계정을 확인할 수 있습니다.</p>
          
          {/* 성능 정보 표시 */}
          {queryTime > 0 && (
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                <span>쿼리 시간: {queryTime}ms</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>데이터 소스: {dataSource === 'cache' ? '캐시' : 'Firebase'}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>업데이트: {new Date(lastUpdated).toLocaleTimeString('ko-KR')}</span>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex gap-2">
          {/* 학교 유형 필터 */}
          <Select value={schoolTypeFilter} onValueChange={setSchoolTypeFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="학교 유형" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="elementary">초등학교</SelectItem>
              <SelectItem value="middle">중학교</SelectItem>
              <SelectItem value="high">고등학교</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={() => fetchBotAccounts(true)} disabled={isLoadingBots} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingBots ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
          
          <Button onClick={forceRefresh} disabled={isLoadingBots}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingBots ? 'animate-spin' : ''}`} />
            강제 새로고침
          </Button>
        </div>
      </div>


      {/* 봇 계정 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>전체 {botAccounts.length}개</CardTitle>
          <CardDescription>
            {schoolTypeFilter === 'all' ? '모든' : 
             schoolTypeFilter === 'elementary' ? '초등학교' :
             schoolTypeFilter === 'middle' ? '중학교' : '고등학교'} 봇 계정 목록
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingBots ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              봇 계정 목록을 불러오는 중...
            </div>
          ) : botAccounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              등록된 봇 계정이 없습니다.
            </div>
          ) : (
            <div className="space-y-4">
              {botAccounts.map((bot) => (
                <Card key={bot.uid} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-purple-600" />
                            <span className="font-medium">{bot.nickname}</span>
                          </div>
                          <Badge variant={
                            bot.schoolType === 'elementary' ? 'default' :
                            bot.schoolType === 'middle' ? 'secondary' : 'outline'
                          }>
                            {bot.schoolType === 'elementary' ? '초등학교' :
                             bot.schoolType === 'middle' ? '중학교' : '고등학교'}
                          </Badge>
                          <Badge variant={bot.stats.postCount > 0 ? 'default' : 'secondary'}>
                            {bot.stats.postCount > 0 ? '활성' : '비활성'}
                          </Badge>
                        </div>
                        
                        <div className="text-sm text-muted-foreground mb-3">
                          <div className="flex items-center gap-1 mb-1">
                            <School className="h-3 w-3" />
                            <span>{bot.schoolName}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              레벨 {bot.stats.level}
                            </span>
                            <span>경험치 {bot.stats.totalExperience.toLocaleString()}</span>
                            <span>게시글 {bot.stats.postCount}개</span>
                            <span>댓글 {bot.stats.commentCount}개</span>
                          </div>
                        </div>
                        
                        <div className="text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            생성일: {new Date(bot.createdAt).toLocaleDateString('ko-KR')}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`/users/${bot.uid}`, '_blank')}
                        >
                          프로필
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}

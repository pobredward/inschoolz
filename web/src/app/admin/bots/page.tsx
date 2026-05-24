"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, RefreshCw, Users, School, Calendar, TrendingUp } from 'lucide-react';
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

export default function AdminBotsPage() {
  const { user } = useAuth();
  const [botAccounts, setBotAccounts] = useState<BotAccount[]>([]);
  const [isLoadingBots, setIsLoadingBots] = useState(false);

  // 봇 계정 목록 가져오기
  const fetchBotAccounts = async () => {
    try {
      setIsLoadingBots(true);
      const response = await fetch('/api/admin/bot-accounts');
      const result = await response.json();
      
      if (result.success) {
        setBotAccounts(result.data || []);
        toast.success(`${result.data.length}개의 봇 계정을 조회했습니다.`);
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
            <Link href="/admin/dashboard" className="text-muted-foreground hover:text-foreground">
              관리자
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">봇 계정 관리</span>
          </div>
          <h1 className="text-3xl font-bold">🤖 봇 계정 관리</h1>
          <p className="text-muted-foreground">시스템에 등록된 봇 계정들의 현황을 확인하고 관리하세요.</p>
        </div>
        <Button onClick={fetchBotAccounts} disabled={isLoadingBots}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingBots ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>

      {/* 봇 계정 통계 */}
      <Card>
        <CardHeader>
          <CardTitle>봇 계정 현황</CardTitle>
          <CardDescription>
            현재 시스템에 등록된 봇 계정들의 현황을 확인할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingBots ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              봇 계정 정보를 불러오는 중...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {botAccounts.filter(bot => bot.schoolType === 'elementary').length}
                </div>
                <div className="text-sm text-muted-foreground">초등학교 봇</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {botAccounts.filter(bot => bot.schoolType === 'middle').length}
                </div>
                <div className="text-sm text-muted-foreground">중학교 봇</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {botAccounts.filter(bot => bot.schoolType === 'high').length}
                </div>
                <div className="text-sm text-muted-foreground">고등학교 봇</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {botAccounts.filter(bot => bot.stats.postCount > 0).length}
                </div>
                <div className="text-sm text-muted-foreground">활성 봇</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 봇 계정 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>봇 계정 목록 ({botAccounts.length})</CardTitle>
          <CardDescription>
            등록된 모든 봇 계정들의 상세 정보를 확인할 수 있습니다.
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

      {/* 봇 관리 도구 */}
      <Card>
        <CardHeader>
          <CardTitle>봇 관리 도구</CardTitle>
          <CardDescription>
            봇 계정들을 관리하기 위한 도구들입니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/admin/schools-management">
              <Button variant="outline" className="w-full h-20 flex-col gap-2">
                <Users className="h-6 w-6" />
                <span>새 봇 생성</span>
                <span className="text-xs text-muted-foreground">학교별 봇 생성</span>
              </Button>
            </Link>
            
            <Button 
              variant="outline" 
              className="w-full h-20 flex-col gap-2"
              onClick={() => window.open('/api/admin/export-data?type=bots&format=csv', '_blank')}
            >
              <Bot className="h-6 w-6" />
              <span>봇 데이터 내보내기</span>
              <span className="text-xs text-muted-foreground">CSV 형태로 다운로드</span>
            </Button>

            <Link href="/admin/operations">
              <Button variant="outline" className="w-full h-20 flex-col gap-2">
                <RefreshCw className="h-6 w-6" />
                <span>대량 작업</span>
                <span className="text-xs text-muted-foreground">봇 대량 관리</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

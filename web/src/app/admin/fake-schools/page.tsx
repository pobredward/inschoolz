"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { School, RefreshCw, Search, Plus, Users, Bot, Calendar, Settings, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/AuthProvider';
import { BotManagementModal } from '@/components/admin/BotManagementModal';

interface SchoolStats {
  id: string;
  name: string;
  type?: 'elementary' | 'middle' | 'high';
  region: string;
  botCount: number;
  postCount: number;
  commentCount?: number;
  lastBotCreated?: string;
  lastPostCreated?: string;
  status: 'active' | 'inactive' | 'no_bots';
}

interface GlobalStats {
  totalSchools: number;
  schoolsWithBots: number;
  totalBots: number;
  totalPosts: number;
}

export default function FakeSchoolsPage() {
  const { user } = useAuth();
  const [schools, setSchools] = useState<SchoolStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedSchool, setSelectedSchool] = useState<SchoolStats | null>(null);
  const [isBotModalOpen, setIsBotModalOpen] = useState(false);
  const [isCreatingBot, setIsCreatingBot] = useState<string | null>(null);
  const [globalStats, setGlobalStats] = useState<GlobalStats>({
    totalSchools: 0,
    schoolsWithBots: 0,
    totalBots: 0,
    totalPosts: 0
  });
  const itemsPerPage = 20;

  // 학교 통계 가져오기
  const fetchSchoolStats = useCallback(async (page: number = 1) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/school-stats?page=${page}&limit=${itemsPerPage}&search=${searchTerm}&searchMode=startsWith&sortBy=botCount&sortOrder=desc`);
      const result = await response.json();
      
      if (result.success) {
        setSchools(result.data || []);
        setTotalPages(result.totalPages || Math.ceil((result.totalCount || result.total || 0) / itemsPerPage));
        
        // 글로벌 통계 업데이트
        if (result.globalStats) {
          setGlobalStats(result.globalStats);
        }
        
        toast.success(`${result.data?.length || 0}개 학교의 통계를 조회했습니다.`);
      } else {
        throw new Error(result.error || '알 수 없는 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('학교 통계 조회 오류:', error);
      toast.error('학교 통계를 불러오는데 실패했습니다.');
      setSchools([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, itemsPerPage]);

  // 학교에 봇 생성 (기존 봇 생성 로직 사용)
  const createBotsForSchool = async (schoolId: string, schoolName: string) => {
    try {
      setIsCreatingBot(schoolId);
      const response = await fetch('/api/admin/bulk-operations/single-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'create_bots',
          schoolCount: 1,
          botsPerSchool: 1,
          schoolId: schoolId,
          schoolName: schoolName
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success(`1개의 봇이 생성되었습니다.`);
        await fetchSchoolStats(currentPage);
      } else {
        throw new Error(result.error || '봇 생성 실패');
      }
    } catch (error) {
      console.error('봇 생성 오류:', error);
      toast.error('봇 생성에 실패했습니다.');
    } finally {
      setIsCreatingBot(null);
    }
  };

  // 학교 봇들로 게시글 생성
  const generatePostsForSchool = async (schoolId: string, postCount: number = 5) => {
    try {
      const response = await fetch('/api/admin/fake-posts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, schoolLimit: 1, postsPerSchool: postCount })
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success(`${postCount}개의 게시글 생성이 시작되었습니다.`);
        await fetchSchoolStats(currentPage);
      } else {
        throw new Error(result.error || '게시글 생성 실패');
      }
    } catch (error) {
      console.error('게시글 생성 오류:', error);
      toast.error('게시글 생성에 실패했습니다.');
    }
  };

  // 봇 관리 모달 열기
  const openBotManagementModal = (school: SchoolStats) => {
    setSelectedSchool(school);
    setIsBotModalOpen(true);
  };

  // 봇 관리 모달 닫기
  const closeBotManagementModal = () => {
    setIsBotModalOpen(false);
    setSelectedSchool(null);
  };

  // 봇 수 업데이트 콜백
  const handleBotCountUpdate = (newCount: number) => {
    if (selectedSchool) {
      // 로컬 상태 업데이트
      setSchools(prevSchools => 
        prevSchools.map(school => 
          school.id === selectedSchool.id 
            ? { ...school, botCount: newCount }
            : school
        )
      );
      // 선택된 학교 정보도 업데이트
      setSelectedSchool(prev => prev ? { ...prev, botCount: newCount } : null);
    }
  };

  // 학교 커뮤니티로 이동
  const navigateToSchoolCommunity = (schoolId: string) => {
    window.open(`/community?tab=school/${schoolId}`, '_blank');
  };

  useEffect(() => {
    fetchSchoolStats(currentPage);
  }, [currentPage, fetchSchoolStats]);

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      setCurrentPage(1);
      fetchSchoolStats(1);
    }, 500);

    return () => clearTimeout(delayedSearch);
  }, [searchTerm, fetchSchoolStats]);

  // 글로벌 통계 사용 (전체 데이터 기준)
  const { totalSchools, schoolsWithBots, totalBots, totalPosts } = globalStats;

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
            <span className="font-medium">학교별 AI 관리</span>
          </div>
          <h1 className="text-3xl font-bold">🏫 학교별 AI 관리</h1>
          <p className="text-muted-foreground">학교별로 봇 계정을 생성하고 게시글을 관리하세요.</p>
        </div>
        <Button onClick={() => fetchSchoolStats(currentPage)} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">총 학교</p>
                <p className="text-2xl font-bold">{totalSchools.toLocaleString()}</p>
              </div>
              <School className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">봇 있는 학교</p>
                <p className="text-2xl font-bold">{schoolsWithBots}</p>
              </div>
              <Users className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">총 봇 계정</p>
                <p className="text-2xl font-bold">{totalBots}</p>
              </div>
              <Bot className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">총 게시글</p>
                <p className="text-2xl font-bold">{totalPosts}</p>
              </div>
              <Calendar className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 검색 */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="학교명으로 검색... (예: 서울, 강남)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* 학교 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>학교 목록 (페이지 {currentPage}/{totalPages})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>학교 데이터를 불러오는 중...</p>
            </div>
          ) : schools.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">학교가 없습니다.</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {schools.map((school, index) => (
                  <div key={school.id || `school-${index}`} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{school.name}</h3>
                          <Badge variant="outline">{school.region}</Badge>
                          {school.type && (
                            <Badge variant="secondary">
                              {school.type === 'elementary' ? '초등학교' : 
                               school.type === 'middle' ? '중학교' : '고등학교'}
                            </Badge>
                          )}
                          <Badge variant={school.status === 'active' ? "default" : "secondary"}>
                            {school.status === 'active' ? '활성' : 
                             school.status === 'inactive' ? '비활성' : '봇 없음'}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                          <div>
                            <span className="font-medium">봇 계정:</span> {school.botCount || 0}개
                          </div>
                          <div>
                            <span className="font-medium">게시글:</span> {school.postCount || 0}개
                          </div>
                          <div>
                            <span className="font-medium">댓글:</span> {school.commentCount || 0}개
                          </div>
                          <div>
                            <span className="font-medium">마지막 활동:</span>{' '}
                            {school.lastPostCreated 
                              ? new Date(school.lastPostCreated).toLocaleDateString()
                              : '없음'
                            }
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => createBotsForSchool(school.id, school.name)}
                          disabled={isCreatingBot === school.id}
                        >
                          {isCreatingBot === school.id ? (
                            <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4 mr-1" />
                          )}
                          봇 생성
                        </Button>
                        
                        {(school.botCount || 0) > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openBotManagementModal(school)}
                          >
                            <Settings className="h-4 w-4 mr-1" />
                            봇 관리
                          </Button>
                        )}
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generatePostsForSchool(school.id, 5)}
                          disabled={(school.botCount || 0) === 0}
                        >
                          <Calendar className="h-4 w-4 mr-1" />
                          게시글 생성
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigateToSchoolCommunity(school.id)}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          커뮤니티
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 페이지네이션 */}
              <div className="flex justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  이전
                </Button>
                <span className="flex items-center px-4">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  다음
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 봇 관리 모달 */}
      {selectedSchool && (
        <BotManagementModal
          isOpen={isBotModalOpen}
          onClose={closeBotManagementModal}
          school={{
            id: selectedSchool.id,
            name: selectedSchool.name,
            type: selectedSchool.type || 'middle',
            botCount: selectedSchool.botCount || 0
          }}
          onBotCountUpdate={handleBotCountUpdate}
        />
      )}
    </div>
  );
}

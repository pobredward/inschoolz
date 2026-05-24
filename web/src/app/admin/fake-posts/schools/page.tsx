"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Database, RefreshCw, Search, Filter, Users, Eye, MapPin, 
  Bot, Clock, Download, School, Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/AuthProvider';
import Link from 'next/link';
import { BotManagementModal } from '@/components/admin/BotManagementModal';

interface SchoolStats {
  id: string;
  name: string;
  type: 'elementary' | 'middle' | 'high';
  region: string;
  botCount: number;
  postCount: number;
  lastActivity: string;
  status: 'active' | 'inactive' | 'no_bots';
}

export default function SchoolsManagementPage() {
  const { user } = useAuth();
  const [schoolStats, setSchoolStats] = useState<SchoolStats[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // 필터링 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedSchoolType, setSelectedSchoolType] = useState('all');
  
  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSchools, setTotalSchools] = useState(0);
  const itemsPerPage = 20;

  // 봇 관리 모달 상태
  const [selectedSchool, setSelectedSchool] = useState<SchoolStats | null>(null);
  const [isBotModalOpen, setIsBotModalOpen] = useState(false);

  // 학교별 통계 가져오기 (페이지네이션 지원) - 검색 최적화
  const fetchSchoolStats = async (page: number = currentPage) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        region: selectedRegion,
        schoolType: selectedSchoolType,
        search: searchTerm.trim(),
        page: page.toString(),
        limit: itemsPerPage.toString(),
        searchMode: 'startsWith' // 시작하는 단어로 검색
      });
      
      const response = await fetch(`/api/admin/school-stats?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setSchoolStats(result.data || []);
        setTotalSchools(result.totalCount || 0);
        setTotalPages(Math.ceil((result.totalCount || 0) / itemsPerPage));
        setCurrentPage(page);
      } else {
        throw new Error(result.error || '학교 통계 조회 실패');
      }
    } catch (error) {
      console.error('학교 통계 조회 오류:', error);
      toast.error('학교 통계를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 봇 관리 모달 열기
  const openBotManagement = (school: SchoolStats) => {
    setSelectedSchool(school);
    setIsBotModalOpen(true);
  };

  // 봇 수 업데이트 콜백
  const handleBotCountUpdate = (schoolId: string, newBotCount: number) => {
    setSchoolStats(prev => 
      prev.map(school => 
        school.id === schoolId 
          ? { 
              ...school, 
              botCount: newBotCount,
              status: newBotCount > 0 ? 'active' : 'no_bots'
            }
          : school
      )
    );
  };

  useEffect(() => {
    fetchSchoolStats(1);
  }, []);

  // 검색어가 변경될 때 디바운스 적용
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      fetchSchoolStats(1);
    }, 300); // 300ms 디바운스

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // 필터가 변경될 때 즉시 검색
  useEffect(() => {
    setCurrentPage(1);
    fetchSchoolStats(1);
  }, [selectedRegion, selectedSchoolType]);

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
            <span className="font-medium">학교 관리</span>
          </div>
          <h1 className="text-3xl font-bold">🏫 학교 관리</h1>
          <p className="text-muted-foreground">12,525개 학교의 봇 계정 및 게시글 현황을 관리하세요.</p>
        </div>
        <Button onClick={() => fetchSchoolStats(currentPage)} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>

      {/* 필터 및 검색 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            학교 필터링
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search-schools">학교명 검색</Label>
              <Input
                id="search-schools"
                placeholder="학교명을 입력하세요... (시작 단어로 검색)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="region-filter">지역</Label>
              <select
                id="region-filter"
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">전체 지역</option>
                <option value="서울">서울</option>
                <option value="부산">부산</option>
                <option value="대구">대구</option>
                <option value="인천">인천</option>
                <option value="광주">광주</option>
                <option value="대전">대전</option>
                <option value="울산">울산</option>
                <option value="세종">세종</option>
                <option value="경기">경기</option>
                <option value="강원">강원</option>
                <option value="충북">충북</option>
                <option value="충남">충남</option>
                <option value="전북">전북</option>
                <option value="전남">전남</option>
                <option value="경북">경북</option>
                <option value="경남">경남</option>
                <option value="제주">제주</option>
              </select>
            </div>
            <div>
              <Label htmlFor="type-filter">학교급</Label>
              <select
                id="type-filter"
                value={selectedSchoolType}
                onChange={(e) => setSelectedSchoolType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">전체</option>
                <option value="elementary">초등학교</option>
                <option value="middle">중학교</option>
                <option value="high">고등학교</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={() => fetchSchoolStats(1)} className="w-full">
                <Search className="h-4 w-4 mr-2" />
                검색
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 학교 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              학교 목록
              <Badge variant="outline">
                {totalSchools.toLocaleString()}개 중 {((currentPage - 1) * itemsPerPage + 1).toLocaleString()}-{Math.min(currentPage * itemsPerPage, totalSchools).toLocaleString()}개
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/api/admin/export-data?type=schools&format=csv&limit=12525`, '_blank')}
              >
                <Download className="h-4 w-4 mr-1" />
                전체 내보내기
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            학교별 봇 계정 및 게시글 현황을 확인하고 관리할 수 있습니다. (페이지당 {itemsPerPage}개씩 표시)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                학교 정보를 불러오는 중...
              </div>
            ) : schoolStats.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                검색 조건에 맞는 학교가 없습니다.
              </div>
            ) : (
              schoolStats.map((school) => (
                <div key={school.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium">{school.name}</h3>
                        <Badge variant={
                          school.type === 'elementary' ? 'default' :
                          school.type === 'middle' ? 'secondary' : 'outline'
                        }>
                          {school.type === 'elementary' ? '초등학교' :
                           school.type === 'middle' ? '중학교' : '고등학교'}
                        </Badge>
                        <Badge variant={
                          school.status === 'active' ? 'default' :
                          school.status === 'inactive' ? 'secondary' : 'destructive'
                        }>
                          {school.status === 'active' ? '활성' :
                           school.status === 'inactive' ? '비활성' : '봇 없음'}
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {school.region}
                          </span>
                          <span className="flex items-center gap-1">
                            <Bot className="h-3 w-3" />
                            봇 {school.botCount}개
                          </span>
                          <span className="flex items-center gap-1">
                            <Database className="h-3 w-3" />
                            게시글 {school.postCount}개
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {school.lastActivity}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openBotManagement(school)}
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        봇 관리
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/community?tab=school/${school.id}`, '_blank')}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        커뮤니티
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
            
            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-muted-foreground">
                  총 {totalSchools.toLocaleString()}개 학교 중 {((currentPage - 1) * itemsPerPage + 1).toLocaleString()}-{Math.min(currentPage * itemsPerPage, totalSchools).toLocaleString()}개 표시
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchSchoolStats(1)}
                    disabled={currentPage === 1}
                  >
                    처음
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchSchoolStats(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    이전
                  </Button>
                  
                  {/* 페이지 번호 */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => fetchSchoolStats(pageNum)}
                          className="w-8 h-8 p-0"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchSchoolStats(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    다음
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchSchoolStats(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    마지막
                  </Button>
                </div>
              </div>
            )}
            
            {schoolStats.length > 0 && (
              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {schoolStats.filter(s => s.status === 'active').length}
                    </div>
                    <div className="text-sm text-muted-foreground">활성 학교 (현재 페이지)</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-orange-600">
                      {schoolStats.filter(s => s.status === 'inactive').length}
                    </div>
                    <div className="text-sm text-muted-foreground">비활성 학교 (현재 페이지)</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-600">
                      {schoolStats.filter(s => s.status === 'no_bots').length}
                    </div>
                    <div className="text-sm text-muted-foreground">봇 없는 학교 (현재 페이지)</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {schoolStats.reduce((sum, s) => sum + (s.postCount || 0), 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">총 게시글 (현재 페이지)</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 봇 관리 모달 */}
      {selectedSchool && (
        <BotManagementModal
          isOpen={isBotModalOpen}
          onClose={() => {
            setIsBotModalOpen(false);
            setSelectedSchool(null);
          }}
          school={selectedSchool}
          onBotCountUpdate={(newCount) => handleBotCountUpdate(selectedSchool.id, newCount)}
        />
      )}
    </div>
  );
}

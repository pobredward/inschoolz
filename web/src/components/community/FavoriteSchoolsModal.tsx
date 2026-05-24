'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { School } from '@/types';
import { getUserFavoriteSchools, toggleFavoriteSchool, searchSchools, selectSchool } from '@/lib/api/schools';
import { useAuth } from '@/providers/AuthProvider';
import { toast } from "sonner";

interface FavoriteSchoolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export function FavoriteSchoolsModal({ isOpen, onClose, onUpdate }: FavoriteSchoolsModalProps) {
  const { user, refreshUser } = useAuth();
  const [favoriteSchools, setFavoriteSchools] = useState<School[]>([]);
  const [favoriteSchoolsTab, setFavoriteSchoolsTab] = useState<'manage' | 'search'>('manage');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<School[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  // 즐겨찾기 학교 목록 가져오기
  const fetchFavoriteSchools = useCallback(async () => {
    if (!user) return;
    
    try {
      const schools = await getUserFavoriteSchools(user.uid);
      setFavoriteSchools(schools);
    } catch (error) {
      console.error('즐겨찾기 학교 목록 조회 오류:', error);
      toast.error('즐겨찾기 학교 목록을 불러오는데 실패했습니다.');
    }
  }, [user]);

  // 사용자 데이터 가져오기
  const fetchUserData = useCallback(async () => {
    if (!user) return;
    
    try {
      const { getUserById } = await import('@/lib/api/users');
      const data = await getUserById(user.uid);
      setUserData(data);
    } catch (error) {
      console.error('사용자 데이터 조회 오류:', error);
    }
  }, [user]);

  // 학교 검색 함수
  const handleSearchSchool = async () => {
    if (!searchTerm.trim()) {
      toast.error('검색어를 입력해주세요.');
      return;
    }
    
    setSearchLoading(true);
    try {
      const results = await searchSchools(searchTerm);
      setSearchResults(results.schools);
    } catch (error) {
      console.error('학교 검색 오류:', error);
      toast.error('학교를 검색하는 중 오류가 발생했습니다.');
    } finally {
      setSearchLoading(false);
    }
  };

  // 즐겨찾기 토글
  const handleToggleFavorite = async (schoolId: string) => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    try {
      await toggleFavoriteSchool(user.uid, schoolId);
      await fetchFavoriteSchools();
      await refreshUser();
      
      if (onUpdate) {
        onUpdate();
      }
      
      toast.success('즐겨찾기가 업데이트되었습니다.');
    } catch (error) {
      console.error('즐겨찾기 토글 오류:', error);
      toast.error('즐겨찾기 설정 중 오류가 발생했습니다.');
    }
  };

  // 메인 학교 설정
  const handleSetMainSchool = async (schoolId: string, schoolName: string) => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    try {
      await selectSchool(user.uid, schoolId, schoolName, {});
      await fetchUserData();
      await refreshUser();
      
      if (onUpdate) {
        onUpdate();
      }
      
      toast.success('메인 학교가 설정되었습니다.');
    } catch (error) {
      console.error('메인 학교 설정 오류:', error);
      toast.error('메인 학교 설정 중 오류가 발생했습니다.');
    }
  };

  // 모달이 열릴 때 데이터 로드
  useEffect(() => {
    if (isOpen && user) {
      fetchFavoriteSchools();
      fetchUserData();
    }
  }, [isOpen, user, fetchFavoriteSchools, fetchUserData]);

  // 모달 닫을 때 초기화
  const handleClose = () => {
    setFavoriteSchoolsTab('manage');
    setSearchTerm('');
    setSearchResults([]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🏫 즐겨찾기 학교 관리
          </DialogTitle>
          <DialogDescription>
            즐겨찾기 학교를 관리하고 메인 학교를 설정하세요. (최대 5개)
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={favoriteSchoolsTab} onValueChange={(value) => setFavoriteSchoolsTab(value as 'manage' | 'search')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manage" className="flex items-center gap-2">
              📋 관리
            </TabsTrigger>
            <TabsTrigger value="search" className="flex items-center gap-2">
              🔍 학교 추가
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="manage" className="space-y-4 max-h-[55vh] overflow-y-auto">
            {favoriteSchools.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🏫</div>
                <h3 className="text-xl font-semibold mb-2">즐겨찾기 학교가 없습니다</h3>
                <p className="text-muted-foreground mb-6">
                  학교를 추가하여 해당 학교 커뮤니티에 참여하세요
                </p>
                <Button 
                  onClick={() => setFavoriteSchoolsTab('search')}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  학교 추가하기
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3">
                  {favoriteSchools.map((school) => (
                    <div key={school.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <button 
                          className="flex-1 text-left"
                          onClick={() => {
                            window.location.href = `/community?tab=school/${school.id}`;
                          }}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-blue-600 font-semibold text-sm">🏫</span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-gray-900 hover:text-blue-600 transition-colors">{school.name}</h4>
                                {userData?.school?.id === school.id && (
                                  <Badge className="bg-green-500 text-white text-xs px-2 py-1">
                                    메인
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mt-1">
                                {school.address}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-500 ml-13">
                            <span className="flex items-center gap-1">
                              👥 멤버 {school.memberCount || 0}명
                            </span>
                            <span className="flex items-center gap-1">
                              ⭐ 즐겨찾기 {school.favoriteCount || 0}명
                            </span>
                          </div>
                        </button>
                        
                        <div className="flex flex-col gap-2">
                          {userData?.school?.id !== school.id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSetMainSchool(school.id, school.name);
                              }}
                              className="bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
                            >
                              메인 설정
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFavorite(school.id);
                            }}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            삭제
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {favoriteSchools.length < 5 && (
                  <div className="text-center pt-4">
                    <Button 
                      variant="outline" 
                      onClick={() => setFavoriteSchoolsTab('search')}
                      className="border-dashed border-2 border-gray-300 hover:border-blue-400 hover:bg-blue-50"
                    >
                      + 학교 추가하기
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="search" className="space-y-4 max-h-[55vh] overflow-y-auto">
            <div className="space-y-4">
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <h3 className="font-semibold text-yellow-900">학교 검색 안내</h3>
                </div>
                <p className="text-sm text-yellow-700">
                  학교 이름의 앞자리에서 두 글자 이상 입력하세요.<br/>
                  예시: 서울가곡초등학교인 경우 가곡(X) 서울가곡(O)
                </p>
              </div>
              
              <div className="flex gap-2">
                <Input
                  placeholder="학교 이름 입력"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearchSchool();
                    }
                  }}
                  className="flex-1"
                />
                <Button onClick={handleSearchSchool} disabled={searchLoading}>
                  {searchLoading ? '검색 중...' : '검색'}
                </Button>
              </div>
              
              <div className="space-y-3">
                {searchResults.map((school) => {
                  const isAlreadyAdded = favoriteSchools.some(fav => fav.id === school.id);
                  
                  return (
                    <div
                      key={school.id}
                      className={`bg-white border rounded-xl p-4 transition-all ${
                        isAlreadyAdded 
                          ? 'border-gray-200 bg-gray-50' 
                          : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                              <span className="text-gray-600 font-semibold text-sm">🏫</span>
                            </div>
                            <div>
                              <h4 className={`font-semibold ${isAlreadyAdded ? 'text-gray-500' : 'text-gray-900'}`}>
                                {school.name}
                              </h4>
                              <p className="text-sm text-gray-600 mt-1">
                                {school.address}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-500 ml-13">
                            <span className="flex items-center gap-1">
                              👥 멤버 {school.memberCount || 0}명
                            </span>
                            <span className="flex items-center gap-1">
                              ⭐ 즐겨찾기 {school.favoriteCount || 0}명
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center">
                          {isAlreadyAdded ? (
                            <Badge variant="secondary" className="bg-gray-200 text-gray-600">
                              추가됨
                            </Badge>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                await handleToggleFavorite(school.id);
                                setFavoriteSchoolsTab('manage');
                              }}
                              disabled={favoriteSchools.length >= 5}
                              className="bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
                            >
                              즐겨찾기 추가
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {searchTerm.length >= 2 && searchResults.length === 0 && !searchLoading && (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">🔍</div>
                    <h3 className="text-lg font-semibold mb-2">검색 결과가 없습니다</h3>
                    <p className="text-muted-foreground">
                      다른 검색어로 시도해보세요
                    </p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleClose}
          >
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


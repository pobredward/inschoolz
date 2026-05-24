'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { School } from '@/types';
import { getUserFavoriteSchools, toggleFavoriteSchool, searchSchools, selectSchool } from '@/lib/api/schools';
import { useAuth } from '@/providers/AuthProvider';
import { toast } from 'sonner';
import { getUserById } from '@/lib/api/users';
import { ArrowLeft } from 'lucide-react';

export default function FavoriteSchoolsPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [favoriteSchools, setFavoriteSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<School[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // 즐겨찾기 학교 목록 가져오기
  const fetchFavoriteSchools = async () => {
    if (!user) return;
    
    try {
      const schools = await getUserFavoriteSchools(user.uid);
      setFavoriteSchools(schools);
    } catch (error) {
      console.error('즐겨찾기 학교 목록 조회 오류:', error);
      toast.error('즐겨찾기 학교 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchFavoriteSchools();
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

  // 학교 즐겨찾기 추가
  const handleAddSchool = async (schoolId: string) => {
    if (!user) return;
    
    if (favoriteSchools.length >= 5) {
      toast.error('즐겨찾기 학교는 최대 5개까지만 등록할 수 있습니다.');
      return;
    }

    try {
      const result = await toggleFavoriteSchool(user.uid, schoolId);
      
      if (result.success) {
        await fetchFavoriteSchools();
        setSearchResults([]);
        setSearchTerm('');
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('즐겨찾기 추가 오류:', error);
      toast.error('즐겨찾기 추가 중 오류가 발생했습니다.');
    }
  };

  // 학교 즐겨찾기 삭제
  const handleRemoveSchool = async (schoolId: string, schoolName: string) => {
    if (!user) return;
    
    if (!confirm(`${schoolName}을(를) 즐겨찾기에서 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const result = await toggleFavoriteSchool(user.uid, schoolId);
      
      if (result.success) {
        await fetchFavoriteSchools();
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('즐겨찾기 삭제 오류:', error);
      toast.error('즐겨찾기 삭제 중 오류가 발생했습니다.');
    }
  };

  // 메인 학교 설정 함수
  const handleSetMainSchool = async (schoolId: string, schoolName: string) => {
    if (!user) return;
    
    try {
      const result = await selectSchool(user.uid, schoolId, schoolName, {
        isGraduate: true
      });
      
      if (result) {
        // 사용자 정보 새로고침
        await refreshUser();
        await fetchFavoriteSchools();
        
        toast.success(`${schoolName}이(가) 메인 학교로 설정되었습니다.`);
      }
    } catch (error) {
      console.error('메인 학교 설정 오류:', error);
      toast.error('메인 학교 설정 중 오류가 발생했습니다.');
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">로그인이 필요합니다.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">학교 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 sm:px-6 md:px-8 lg:px-12 py-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => router.back()}
          className="h-9 w-9 sm:h-10 sm:w-10"
        >
          <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
        <h1 className="text-xl sm:text-2xl font-bold">즐겨찾기 학교 관리</h1>
      </div>

      {/* 학교 검색 섹션 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>🔍 학교 추가</CardTitle>
          <CardDescription>
            학교 이름의 앞자리에서 두 글자 이상 입력하세요.<br/>
            예시: 서울가곡초등학교인 경우 가곡(X) 서울가곡(O)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

          {/* 검색 결과 */}
          {searchResults.length > 0 && (
            <div className="space-y-3 max-h-96 overflow-y-auto">
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
                            onClick={() => handleAddSchool(school.id)}
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
            </div>
          )}

          {searchTerm.length >= 2 && searchResults.length === 0 && !searchLoading && (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-lg font-semibold mb-2">검색 결과가 없습니다</h3>
              <p className="text-muted-foreground">
                다른 검색어로 시도해보세요
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 즐겨찾기 학교 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>📋 내 즐겨찾기 학교 ({favoriteSchools.length}/5)</CardTitle>
          <CardDescription>
            메인 학교는 커뮤니티와 랭킹에서 기본으로 표시됩니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          {favoriteSchools.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🏫</div>
              <h3 className="text-xl font-semibold mb-2">즐겨찾기 학교가 없습니다</h3>
              <p className="text-muted-foreground mb-6">
                학교를 추가하여 해당 학교 커뮤니티에 참여하세요
              </p>
            </div>
          ) : (
            <div className="space-y-3">
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
                            {user?.school?.id === school.id && (
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
                      {user?.school?.id !== school.id && (
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
                          handleRemoveSchool(school.id, school.name);
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}








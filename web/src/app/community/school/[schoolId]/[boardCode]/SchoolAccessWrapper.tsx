'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { checkSchoolAccess, getSchoolById, getPopularSchools } from '@/lib/api/schools';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Heart, AlertCircle, Lock, School as SchoolIcon, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { School } from '@/types';

interface SchoolAccessWrapperProps {
  schoolId: string;
  children: React.ReactNode;
}

export default function SchoolAccessWrapper({ schoolId, children }: SchoolAccessWrapperProps) {
  const { user, isLoading: authLoading } = useAuth();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [accessError, setAccessError] = useState<string>('');
  const [schoolName, setSchoolName] = useState<string>('');
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const [popularSchools, setPopularSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      // 인증 로딩 중이면 대기
      if (authLoading) {
        return;
      }

      try {
        // 학교 정보 가져오기
        const school = await getSchoolById(schoolId);
        if (school) {
          setSchoolName(school.name);
        }

        // 접근 권한 확인 (로그인 여부와 관계없이)
        const accessResult = await checkSchoolAccess(user?.uid || null, schoolId);
        setHasAccess(accessResult.hasAccess);
        setIsGuest(accessResult.isGuest || false);
        
        if (!accessResult.hasAccess) {
          setAccessError(accessResult.reason || '접근 권한이 없습니다.');
          
          // 인기 학교 목록 로드 (접근 실패 시에만)
          const schools = await getPopularSchools(8);
          setPopularSchools(schools);
        }
      } catch (error) {
        console.error('접근 권한 확인 오류:', error);
        setHasAccess(false);
        setAccessError('접근 권한을 확인하는 중 오류가 발생했습니다.');
        
        // 오류 시에도 인기 학교 목록 로드 시도
        try {
          const schools = await getPopularSchools(8);
          setPopularSchools(schools);
        } catch (schoolError) {
          console.error('인기 학교 목록 로드 실패:', schoolError);
        }
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [user, schoolId, authLoading]);

  if (loading || authLoading) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {authLoading ? '로그인 정보 확인 중...' : '접근 권한을 확인하는 중...'}
          </p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          {/* 헤더 */}
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-4">
              <Link href="/community">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  커뮤니티
                </Button>
              </Link>
            </div>
          </div>

          {/* 접근 제한 메시지 - 작게 만들기 */}
          <Card className="border border-red-200 bg-red-50 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <div>
                  <p className="text-red-800 font-medium text-sm">
                    {schoolName || '이 학교'} 커뮤니티에 접근할 수 없습니다
                  </p>
                  <p className="text-red-600 text-xs mt-1">
                    {accessError}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 인기 학교 커뮤니티 추천 */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <CardTitle className="text-lg">인기 학교 커뮤니티</CardTitle>
              </div>
              {/* <p className="text-sm text-muted-foreground">
                활발한 활동이 이루어지고 있는 학교 커뮤니티를 둘러보세요
              </p> */}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {popularSchools.map((school) => (
                  <Link
                    key={school.id}
                    href={`/community?tab=school/${school.id}`}
                    className="block"
                  >
                    <Card className="hover:shadow-md transition-shadow cursor-pointer border border-gray-200 hover:border-blue-300">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100">
                              <SchoolIcon className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <h3 className="font-medium text-sm truncate max-w-[200px]">
                                {school.name}
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                {school.district}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">
                              멤버 {school.memberCount || 0}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
              
              {popularSchools.length === 0 && (
                <div className="text-center py-8">
                  <SchoolIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    인기 학교 목록을 불러오는 중입니다...
                  </p>
                </div>
              )}
              
              <div className="flex gap-3 justify-center mt-6 pt-4 border-t">
                <Link href="/community">
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <SchoolIcon className="w-4 h-4 mr-2" />
                    전체 커뮤니티 보기
                  </Button>
                </Link>
                {!user && (
                  <Link href="/login">
                    <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100">
                      로그인하기
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // 접근 권한이 있으면 원래 컨텐츠 표시
  return <>{children}</>;
} 
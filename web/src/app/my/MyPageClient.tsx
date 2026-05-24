'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
// import { 
//   BookCheck, 
//   GraduationCap, 
// } from 'lucide-react';
import { User, School } from '@/types';
import { getUserById, getFollowersCount, getFollowingCount } from '@/lib/api/users';
import { useAuth } from "@/providers/AuthProvider";
import { useQuestTracker } from "@/hooks/useQuestTracker";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { selectSchool, getUserFavoriteSchools, toggleFavoriteSchool, searchSchools } from '@/lib/api/schools';
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import AttendanceCalendar from '../[userName]/components/AttendanceCalendar';
import FollowersModal from '@/components/FollowersModal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

import { getDoc, doc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { deleteUserAccount } from '@/lib/api/auth';

// Shimmer 애니메이션 스타일
const shimmerStyles = `
  @keyframes shimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }
  .animate-shimmer {
    animation: shimmer 2s infinite;
  }
`;

// 경험치 포맷팅 함수
const formatExp = (exp: number): string => {
  return exp.toLocaleString();
};

// 휴대폰 번호 포맷팅 함수
const formatPhoneNumber = (value: string): string => {
  if (!value) return '미설정';
  
  // +82 형식 처리
  if (value.startsWith('+82')) {
    const numbers = value.replace(/\D/g, '');
    const koreanNumber = numbers.slice(2); // +82 제거
    // 첫 번째 0이 없으면 추가
    const normalizedNumber = koreanNumber.startsWith('1') ? `0${koreanNumber}` : koreanNumber;
    
    if (normalizedNumber.length === 11) {
      return `${normalizedNumber.slice(0, 3)}-${normalizedNumber.slice(3, 7)}-${normalizedNumber.slice(7)}`;
    }
  }
  
  // 일반적인 숫자만 포함된 경우
  const numbers = value.replace(/\D/g, '');
  
  if (numbers.length <= 3) {
    return numbers;
  } else if (numbers.length <= 7) {
    return numbers.replace(/(\d{3})(\d{1,4})/, '$1-$2');
  } else if (numbers.length === 11) {
    return numbers.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  } else {
    return numbers.replace(/(\d{3})(\d{4})(\d{1,4})/, '$1-$2-$3');
  }
};

// 레벨에 따른 필요 경험치 계산 (헤더와 동일한 로직)
const getRequiredExpForLevel = (level: number): number => {
  // PRD 요구사항: 1->2레벨 10exp, 2->3레벨 20exp, 오름차순
  return level * 10;
};

// 학교 정보 인터페이스 (사용하지 않음 - 제거됨)

interface MyPageClientProps {
  userData?: User | null;
}

export default function MyPageClient({ userData: initialUserData }: MyPageClientProps) {
  const { user, refreshUser } = useAuth();
  const { trackSchoolRegister } = useQuestTracker();
  const [loading, setLoading] = useState(!initialUserData);
  const [userData, setUserData] = useState<User | null>(initialUserData || null);
  const [isSchoolDialogOpen, setIsSchoolDialogOpen] = useState(false);
  const [selectedSchoolInfo, setSelectedSchoolInfo] = useState<{id: string, name: string} | null>(null);
  const [isGraduate, setIsGraduate] = useState(false);
  const [grade, setGrade] = useState('');
  const [classNumber, setClassNumber] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [favoriteSchools, setFavoriteSchools] = useState<School[]>([]);
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<School[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isFavoriteSchoolsModalOpen, setIsFavoriteSchoolsModalOpen] = useState(false);
  const [favoriteSchoolsTab, setFavoriteSchoolsTab] = useState<'manage' | 'search'>('manage');
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowersModalOpen, setIsFollowersModalOpen] = useState(false);
  const [followersModalType, setFollowersModalType] = useState<'followers' | 'following'>('followers');
  const [isAccountDeleteDialogOpen, setIsAccountDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  
  const router = useRouter();

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

  // 학교 즐겨찾기 토글 함수
  const handleToggleFavorite = async (schoolId: string, isAdding: boolean = false) => {
    if (!user) return;
    
    try {
      const result = await toggleFavoriteSchool(user.uid, schoolId);
      
      if (result.success) {
        // 즐겨찾기 목록 갱신
        await fetchFavoriteSchools();
        toast.success(result.message);
        
        // 퀘스트 트래킹: 학교 추가 시에만 트래킹 (2단계)
        if (isAdding || result.message?.includes('추가')) {
          console.log('📍 퀘스트 트래킹: 학교 즐겨찾기 추가');
          await trackSchoolRegister();
        }
      } else {
        // 실패 시 에러 메시지 표시
        toast.error(result.message);
      }
    } catch (error) {
      console.error('즐겨찾기 토글 오류:', error);
      toast.error('즐겨찾기 상태를 변경하는 중 오류가 발생했습니다.');
    }
  };

  // 학교 선택 함수
  const handleSelectSchool = (school: School) => {
    setSelectedSchoolInfo({
      id: school.id,
      name: school.name
    });
    setIsSchoolDialogOpen(true);
    setIsSearchDialogOpen(false);
  };

  // 메인 학교 설정 함수
  const handleSetMainSchool = async (schoolId: string, schoolName: string) => {
    if (!user) return;
    
    try {
      // 여기서는 간단히 selectSchool 함수를 사용하여 메인 학교를 설정
      const result = await selectSchool(user.uid, schoolId, schoolName, {
        isGraduate: true // 기본값으로 졸업생 설정
      });
      
      if (result) {
        // 사용자 정보 새로고침
        const updatedUserData = await getUserById(user.uid);
        setUserData(updatedUserData);
        
        // AuthProvider의 글로벌 상태도 새로고침하여 실시간 반영
        await refreshUser();
        
        // 퀘스트 트래킹: 메인 학교 설정 (2단계)
        console.log('📍 퀘스트 트래킹: 메인 학교 설정');
        await trackSchoolRegister();
        
        toast.success(`${schoolName}이(가) 메인 학교로 설정되었습니다.`);
      }
    } catch (error) {
      console.error('메인 학교 설정 오류:', error);
      toast.error('메인 학교 설정 중 오류가 발생했습니다.');
    }
  };

  // 계정 삭제 함수
  const handleDeleteAccount = async () => {
    if (!user || !auth.currentUser) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    if (!deletePassword.trim()) {
      toast.error('현재 비밀번호를 입력해주세요.');
      return;
    }

    setIsDeleting(true);
    try {
      await deleteUserAccount(deletePassword);
      toast.success('계정이 완전히 삭제되었습니다.');
      
      // 계정 삭제 후 로그인 페이지로 리디렉션
      router.push('/login');
    } catch (error) {
      console.error('계정 삭제 오류:', error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('계정 삭제 중 오류가 발생했습니다.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        
        if (!user) {
          console.log('사용자 인증 정보가 아직 로드되지 않았습니다.');
          return;
        }
        
        // 서버에서 최신 사용자 데이터 가져오기
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
          throw new Error('사용자 정보를 찾을 수 없습니다.');
        }
        
        const data = userDoc.data() as User;
        
        setUserData(data);
        
        // 즐겨찾기 학교 목록 가져오기
        await fetchFavoriteSchools();
        
        // 팔로워/팔로잉 수 가져오기
        try {
          const [followersNum, followingNum] = await Promise.all([
            getFollowersCount(user.uid),
            getFollowingCount(user.uid)
          ]);
          setFollowersCount(followersNum);
          setFollowingCount(followingNum);
        } catch (error) {
          console.error('팔로워/팔로잉 수 조회 오류:', error);
        }
      } catch (error) {
        console.error('사용자 정보를 가져오는 중 오류 발생:', error);
        if (error instanceof Error && error.message !== '사용자 인증 정보가 아직 로드되지 않았습니다.') {
          toast.error('사용자 정보를 불러오는데 실패했습니다.');
        }
      } finally {
        setLoading(false);
      }
    };

    // user가 존재할 때만 fetchUserData 실행
    if (user) {
      fetchUserData();
    } else if (user === null) {
      // user가 명시적으로 null인 경우 (로그아웃 상태)
      setLoading(false);
    }
    // user가 undefined인 경우는 아직 로딩 중이므로 아무것도 하지 않음
  }, [user, fetchFavoriteSchools]);

  if (loading) {
    return <div className="p-4 text-center">정보를 불러오는 중...</div>;
  }

  if (!user) {
    return <div className="p-4 text-center">로그인이 필요합니다.</div>;
  }

  if (!userData) {
    return <div className="p-4 text-center">사용자 정보를 불러오는 중...</div>;
  }

  return (
    <div className="px-3 sm:px-6 md:px-8 lg:px-12 py-6 max-w-7xl mx-auto">
      <style>{shimmerStyles}</style>
      
      <div className="space-y-6">
        {/* 메인 컨텐츠 그리드 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽 컬럼: 프로필 헤더 + 활동 통계 + 설정 메뉴 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 게이미파이 프로필 카드 */}
            <Card className="overflow-hidden bg-gradient-to-br from-slate-50 via-emerald-50 to-green-50">
              <CardContent className="p-0">
                {/* 상단 헤더 배경 */}
                <div className="relative bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 px-6 pt-6 pb-20">
                  <div className="absolute top-4 right-4 flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => router.push('/my/edit')}
                      className="bg-white/90 hover:bg-white shadow-md"
                    >
                      <span className="text-xs">✏️ 수정</span>
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => router.push('/my/favorite-schools')}
                      className="bg-white/90 hover:bg-white shadow-md"
                    >
                      <span className="text-xs">🏫 학교</span>
                    </Button>
                  </div>
                </div>

                {/* 프로필 정보 영역 */}
                <div className="relative px-6 pb-6 -mt-14">
                  <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
                    {/* 아바타와 레벨 */}
                    <div className="relative">
                      <div className="relative">
                        <Avatar className="w-24 h-24 border-4 border-white shadow-xl ring-2 ring-emerald-200">
                          <AvatarImage src={userData.profile?.profileImageUrl || ''} alt={userData.profile?.userName} />
                          <AvatarFallback className="text-xl font-bold bg-gradient-to-br from-emerald-400 to-green-500 text-white">
                            {userData.profile?.userName?.substring(0, 2) || 'ME'}
                          </AvatarFallback>
                        </Avatar>
                        <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-sm px-3 py-1 shadow-lg border-2 border-white">
                          Lv.{userData.stats?.level || 1}
                        </Badge>
                      </div>
                    </div>
                    
                    {/* 프로필 정보 */}
                    <div className="flex-1 w-full bg-white rounded-xl shadow-sm p-6 space-y-4">
                      <div className="text-center md:text-left">
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                          {userData.profile?.userName}
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center md:justify-start gap-2">
                          <span>🏫</span>
                          {userData.school?.name || '학교 미설정'}
                          {userData.profile?.isAdmin && (
                            <Badge variant="secondary" className="ml-1">관리자</Badge>
                          )}
                        </p>
                      </div>
                      
                      {/* 팔로워/팔로잉 - 게임 스타일 */}
                      <div className="flex items-center justify-center gap-4">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setFollowersModalType('followers');
                            setIsFollowersModalOpen(true);
                          }}
                          className="flex-1 max-w-[140px] h-auto p-0 hover:bg-transparent"
                        >
                          <div className="w-full bg-gradient-to-br from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-200 rounded-lg p-3 border-2 border-emerald-200 transition-all">
                            <div className="text-xs text-emerald-600 font-medium mb-1">팔로워</div>
                            <div className="text-2xl font-bold text-emerald-700">{followersCount}</div>
                          </div>
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setFollowersModalType('following');
                            setIsFollowersModalOpen(true);
                          }}
                          className="flex-1 max-w-[140px] h-auto p-0 hover:bg-transparent"
                        >
                          <div className="w-full bg-gradient-to-br from-teal-50 to-teal-100 hover:from-teal-100 hover:to-teal-200 rounded-lg p-3 border-2 border-teal-200 transition-all">
                            <div className="text-xs text-teal-600 font-medium mb-1">팔로잉</div>
                            <div className="text-2xl font-bold text-teal-700">{followingCount}</div>
                          </div>
                        </Button>
                      </div>
                      
                      {/* 경험치 바 - 게임 스타일 */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                            <span>⚡</span> 경험치
                          </span>
                          <span className="text-xs font-bold text-emerald-600">
                            {formatExp(userData.stats?.currentExp || 0)} / {formatExp(getRequiredExpForLevel(userData.stats?.level || 1))} XP
                          </span>
                        </div>
                        <div className="relative">
                          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden border-2 border-gray-300 shadow-inner">
                            <div 
                              className="h-full bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500 rounded-full transition-all duration-500 ease-out relative overflow-hidden"
                              style={{ width: `${Math.min(100, Math.floor(((userData.stats?.currentExp || 0) / getRequiredExpForLevel(userData.stats?.level || 1)) * 100))}%` }}
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer"></div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 기본 정보 - 컴팩트하게 */}
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-500">👤</span>
                            <span className="text-gray-600 font-medium">{userData.profile?.realName || '미설정'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-500">
                              {userData.profile?.gender === 'male' ? '👨' : 
                               userData.profile?.gender === 'female' ? '👩' : '🧑'}
                            </span>
                            <span className="text-gray-600 font-medium">
                              {userData.profile?.gender === 'male' ? '남성' : 
                               userData.profile?.gender === 'female' ? '여성' :
                               userData.profile?.gender === 'other' ? '기타' : '미설정'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-500">🎂</span>
                            <span className="text-gray-600 font-medium">
                              {userData.profile?.birthYear 
                                ? `${userData.profile.birthYear}.${userData.profile.birthMonth}.${userData.profile.birthDay}` 
                                : '미설정'}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-500">📧</span>
                            <span className="text-gray-600 font-medium truncate">{userData.email || '미설정'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-500">📱</span>
                            <span className="text-gray-600 font-medium">{formatPhoneNumber(userData.profile?.phoneNumber || '') || '미설정'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-500">📍</span>
                            <span className="text-gray-600 font-medium truncate">
                              {(() => {
                                const parts = [
                                  userData.regions?.sido,
                                  userData.regions?.sigungu
                                ].filter(Boolean);
                                return parts.length > 0 ? parts.join(' ') : '미설정';
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 출석체크 - 모바일에서만 표시 */}
            <div className="lg:hidden">
              {user?.uid ? (
                <div className="border-2 border-emerald-100 rounded-xl overflow-hidden bg-gradient-to-br from-white to-emerald-50/30">
                  <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-b-2 border-emerald-100 px-6 py-4">
                    <h3 className="font-bold text-emerald-900 flex items-center gap-2">
                      <span className="text-2xl">📅</span>
                      <span>출석체크</span>
                    </h3>
                  </div>
                  <AttendanceCalendar 
                    userId={user.uid} 
                    isProfileOwner={true} 
                    onAttendanceComplete={async () => {
                      if (user) {
                        const refreshedUserData = await getUserById(user.uid);
                        setUserData(refreshedUserData);
                      }
                    }}
                  />
                </div>
              ) : (
                <Card className="border-2 border-gray-200">
                  <CardHeader>
                    <CardTitle>출석체크</CardTitle>
                    <CardDescription>로그인 후 출석체크를 할 수 있습니다.</CardDescription>
                  </CardHeader>
                  <CardContent className="h-64 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <p>로그인이 필요합니다</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* 활동 통계 - 게임 스타일 */}
            <Card className="overflow-hidden border-2 border-emerald-100 bg-gradient-to-br from-white to-emerald-50/30">
              <CardHeader className="bg-gradient-to-r from-emerald-500/10 to-green-500/10 border-b-2 border-emerald-100">
                <CardTitle className="flex items-center gap-2 text-emerald-900">
                  <span className="text-2xl">📊</span>
                  <span>활동 통계</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <button 
                    className="group relative w-full bg-gradient-to-r from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-200 rounded-xl p-4 cursor-pointer transition-all duration-300 border border-emerald-200 hover:border-emerald-300 hover:shadow-lg flex items-center gap-4"
                    onClick={() => router.push('/my/posts')}
                  >
                    <span className="text-xl group-hover:scale-110 transition-transform">📝</span>
                    <span className="font-medium text-emerald-900 flex-1 text-left">내가 쓴 글</span>
                    <span className="text-emerald-400 group-hover:text-emerald-600 transition-colors">›</span>
                  </button>
                  <button 
                    className="group relative w-full bg-gradient-to-r from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-200 rounded-xl p-4 cursor-pointer transition-all duration-300 border border-emerald-200 hover:border-emerald-300 hover:shadow-lg flex items-center gap-4"
                    onClick={() => router.push('/my/comments')}
                  >
                    <span className="text-xl group-hover:scale-110 transition-transform">💬</span>
                    <span className="font-medium text-emerald-900 flex-1 text-left">내 댓글</span>
                    <span className="text-emerald-400 group-hover:text-emerald-600 transition-colors">›</span>
                  </button>
                  <button 
                    className="group relative w-full bg-gradient-to-r from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-200 rounded-xl p-4 cursor-pointer transition-all duration-300 border border-emerald-200 hover:border-emerald-300 hover:shadow-lg flex items-center gap-4"
                    onClick={() => router.push('/my/scraps')}
                  >
                    <span className="text-xl group-hover:scale-110 transition-transform">🔖</span>
                    <span className="font-medium text-emerald-900 flex-1 text-left">스크랩한 글</span>
                    <span className="text-emerald-400 group-hover:text-emerald-600 transition-colors">›</span>
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* 설정 메뉴 - 게임 스타일 */}
            <Card className="overflow-hidden border-2 border-emerald-100 bg-gradient-to-br from-white to-emerald-50/30">
              <CardHeader className="bg-gradient-to-r from-emerald-500/10 to-green-500/10 border-b-2 border-emerald-100">
                <CardTitle className="flex items-center gap-2 text-emerald-900">
                  <span className="text-2xl">⚙️</span>
                  <span>설정</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start h-auto py-3 px-4 bg-gradient-to-r from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-200 border border-emerald-200 hover:border-emerald-300 transition-all group"
                    onClick={() => router.push('/my/settings/notifications')}
                  >
                    <span className="mr-3 text-xl group-hover:scale-110 transition-transform">🔔</span>
                    <span className="font-medium text-emerald-900">알림 설정</span>
                    <span className="ml-auto text-emerald-400 group-hover:text-emerald-600">›</span>
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start h-auto py-3 px-4 bg-gradient-to-r from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-200 border border-emerald-200 hover:border-emerald-300 transition-all group"
                    onClick={() => router.push('/my/reports')}
                  >
                    <span className="mr-3 text-xl group-hover:scale-110 transition-transform">🚨</span>
                    <span className="font-medium text-emerald-900">신고 기록</span>
                    <span className="ml-auto text-emerald-400 group-hover:text-emerald-600">›</span>
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start h-auto py-3 px-4 bg-gradient-to-r from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-200 border border-emerald-200 hover:border-emerald-300 transition-all group"
                    onClick={() => router.push('/my/blocked-users')}
                  >
                    <span className="mr-3 text-xl group-hover:scale-110 transition-transform">🚫</span>
                    <span className="font-medium text-emerald-900">차단된 사용자</span>
                    <span className="ml-auto text-emerald-400 group-hover:text-emerald-600">›</span>
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start h-auto py-3 px-4 bg-gradient-to-r from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 border border-red-200 hover:border-red-300 text-red-700 hover:text-red-800 transition-all group"
                    onClick={() => setIsAccountDeleteDialogOpen(true)}
                  >
                    <span className="mr-3 text-xl group-hover:scale-110 transition-transform">🗑️</span>
                    <span className="font-medium">계정 삭제</span>
                    <span className="ml-auto text-red-400 group-hover:text-red-600">›</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* 오른쪽 컬럼: 출석체크 - 데스크톱에서만 표시 */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-6">
              {user?.uid ? (
                <div className="border-2 border-emerald-100 rounded-xl overflow-hidden bg-gradient-to-br from-white to-emerald-50/30">
                  <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-b-2 border-emerald-100 px-6 py-4">
                    <h3 className="font-bold text-emerald-900 flex items-center gap-2">
                      <span className="text-2xl">📅</span>
                      <span>출석체크</span>
                    </h3>
                  </div>
                  <AttendanceCalendar 
                    userId={user.uid} 
                    isProfileOwner={true} 
                    onAttendanceComplete={async () => {
                      // 출석체크 완료 시 사용자 정보 새로고침
                      if (user) {
                        const refreshedUserData = await getUserById(user.uid);
                        setUserData(refreshedUserData);
                      }
                    }}
                  />
                </div>
              ) : (
                <Card className="border-2 border-gray-200">
                  <CardHeader>
                    <CardTitle>출석체크</CardTitle>
                    <CardDescription>로그인 후 출석체크를 할 수 있습니다.</CardDescription>
                  </CardHeader>
                  <CardContent className="h-64 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <p>로그인이 필요합니다</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* 학교 선택 다이얼로그 */}
      <Dialog open={isSchoolDialogOpen} onOpenChange={setIsSchoolDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>학교 정보 입력</DialogTitle>
            <DialogDescription>
              {selectedSchoolInfo?.name} 학교에 대한 추가 정보를 입력해주세요.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Switch 
                id="graduate-mode"
                checked={isGraduate}
                onCheckedChange={(checked) => setIsGraduate(checked)}
              />
              <label
                htmlFor="graduate-mode"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                졸업생입니다
              </label>
            </div>
            
            {!isGraduate ? (
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label htmlFor="grade" className="text-sm font-medium">
                    학년
                  </label>
                  <Select 
                    value={grade} 
                    onValueChange={setGrade}
                  >
                    <SelectTrigger id="grade">
                      <SelectValue placeholder="학년 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1학년</SelectItem>
                      <SelectItem value="2">2학년</SelectItem>
                      <SelectItem value="3">3학년</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="class" className="text-sm font-medium">
                    반
                  </label>
                  <Select 
                    value={classNumber} 
                    onValueChange={setClassNumber}
                  >
                    <SelectTrigger id="class">
                      <SelectValue placeholder="반 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 15 }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>
                          {i + 1}반
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="studentNumber" className="text-sm font-medium">
                    번호
                  </label>
                  <Select 
                    value={studentNumber} 
                    onValueChange={setStudentNumber}
                  >
                    <SelectTrigger id="studentNumber">
                      <SelectValue placeholder="번호 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 40 }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>
                          {i + 1}번
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="bg-green-50 p-3 rounded-md text-green-700 text-sm">
                졸업생으로 설정되었습니다. 학년, 반, 번호 정보는 입력하지 않아도 됩니다.
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsSchoolDialogOpen(false)}
            >
              취소
            </Button>
            <Button 
              onClick={async () => {
                try {
                  if (!user || !selectedSchoolInfo) {
                    setIsSchoolDialogOpen(false);
                    return;
                  }
                  
                  // 학교 선택하기
                  const result = await selectSchool(user.uid, selectedSchoolInfo.id, selectedSchoolInfo.name, {
                    grade: isGraduate ? undefined : grade,
                    classNumber: isGraduate ? undefined : classNumber,
                    studentNumber: isGraduate ? undefined : studentNumber,
                    isGraduate
                  });
                  
                  if (result) {
                    // 사용자 정보 다시 가져오기
                    const updatedUserData = await getUserById(user.uid);
                    setUserData(updatedUserData);
                    
                    // 퀘스트 트래킹: 학교 등록 (2단계)
                    await trackSchoolRegister();
                    
                    toast.success(`${selectedSchoolInfo.name}이(가) 내 학교로 설정되었습니다.`);
                  }
                  
                  setIsSchoolDialogOpen(false);
                } catch (error) {
                  console.error('학교 선택 오류:', error);
                  toast.error('학교 선택 중 오류가 발생했습니다.');
                }
              }}
              disabled={!isGraduate && (!grade || !classNumber || !studentNumber)}
            >
              저장하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 학교 검색 다이얼로그 */}
      <Dialog open={isSearchDialogOpen} onOpenChange={setIsSearchDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>학교 검색</DialogTitle>
            <DialogDescription>
              학교 이름의 앞자리에서 두 글자 이상 입력하세요.<br/>
              예시: 서울가곡초등학교인 경우 가곡(X) 서울가곡(O)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="학교 이름 입력"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearchSchool();
                  }
                }}
              />
              <Button onClick={handleSearchSchool} disabled={searchLoading}>
                {searchLoading ? '검색 중...' : '검색'}
              </Button>
            </div>
            
            <div className="max-h-[250px] overflow-y-auto space-y-2">
              {searchResults.map((school) => (
                <div key={school.id} className="border rounded-md p-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{school.name}</p>
                      <p className="text-xs text-muted-foreground">가입 {school.memberCount || 0}명 · 즐겨찾기 {school.favoriteCount || 0}명</p>
                      <p className="text-xs text-muted-foreground mt-1">{school.address || '주소 정보 없음'}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSelectSchool(school)}
                      >
                        선택
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleFavorite(school.id, true)}
                      >
                        즐겨찾기
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              
              {searchResults.length === 0 && searchTerm && !searchLoading && (
                <div className="text-center p-3">
                  <p className="text-muted-foreground">검색 결과가 없습니다.</p>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsSearchDialogOpen(false)}
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 즐겨찾기 학교 관리 모달 */}
      <Dialog open={isFavoriteSchoolsModalOpen} onOpenChange={setIsFavoriteSchoolsModalOpen}>
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
                                  await handleToggleFavorite(school.id, true);
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
              onClick={() => {
                setIsFavoriteSchoolsModalOpen(false);
                setFavoriteSchoolsTab('manage');
                setSearchTerm('');
                setSearchResults([]);
              }}
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 계정 삭제 다이얼로그 */}
      <Dialog open={isAccountDeleteDialogOpen} onOpenChange={setIsAccountDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">⚠️ 계정 삭제</DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              이 작업은 되돌릴 수 없습니다. 계정을 삭제하면 모든 데이터가 완전히 제거됩니다.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-semibold text-red-800 mb-2">삭제되는 데이터:</h4>
              <ul className="text-sm text-red-700 space-y-1">
                <li>• 프로필 정보 및 개인 데이터</li>
                <li>• 작성한 모든 게시글과 댓글</li>
                <li>• 즐겨찾기 및 설정 정보</li>
                <li>• 경험치 및 활동 기록</li>
              </ul>
            </div>
            
            <div>
              <label htmlFor="deletePassword" className="block text-sm font-medium text-gray-700 mb-2">
                현재 비밀번호 확인 *
              </label>
              <Input
                id="deletePassword"
                type="password"
                placeholder="현재 비밀번호를 입력하세요"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsAccountDeleteDialogOpen(false);
                setDeletePassword('');
              }}
              disabled={isDeleting}
            >
              취소
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeleting || !deletePassword.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? '삭제 중...' : '계정 삭제'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 팔로워/팔로잉 모달 */}
      <FollowersModal
        isOpen={isFollowersModalOpen}
        onClose={() => setIsFollowersModalOpen(false)}
        userId={user.uid}
        type={followersModalType}
        title={followersModalType === 'followers' ? '팔로워' : '팔로잉'}
      />
    </div>
  );
}
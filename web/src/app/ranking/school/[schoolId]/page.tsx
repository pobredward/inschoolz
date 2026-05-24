'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, School, Users, Star, TrendingUp, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/providers/AuthProvider';
import { getRankings, RankingUser } from '@/lib/api/ranking';
import { DocumentSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

// 학교 정보 타입
interface SchoolInfo {
  id: string;
  name: string;
  address?: string;
  type?: string;
  regions?: {
    sido: string;
    sigungu: string;
  };
}

// 랭킹 상태 타입
interface RankingState {
  users: RankingUser[];
  hasMore: boolean;
  lastDoc?: DocumentSnapshot;
  isLoading: boolean;
  error?: string;
}

// 랭킹 아이템 컴포넌트 (기존과 동일)
function RankingItem({ user, index }: { 
  user: RankingUser; 
  index: number; 
}) {
  // 실제 랭킹 사용 (검색 시) 또는 index 기반 순위 (일반 리스트)
  const rank = user.rank || (index + 1);
  
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <div className="flex items-center justify-center w-8 h-8 bg-yellow-500 text-white rounded-full text-sm font-bold">1</div>;
      case 2:
        return <div className="flex items-center justify-center w-8 h-8 bg-gray-400 text-white rounded-full text-sm font-bold">2</div>;
      case 3:
        return <div className="flex items-center justify-center w-8 h-8 bg-amber-600 text-white rounded-full text-sm font-bold">3</div>;
      default:
        return <span className="text-base font-bold text-pastel-green-600 w-8 text-center">#{rank}</span>;
    }
  };

  const getRankBg = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200';
      case 2:
        return 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200';
      case 3:
        return 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200';
      default:
        return 'bg-white border-pastel-green-100 hover:bg-pastel-green-50';
    }
  };

  return (
    <button 
      onClick={() => window.location.href = `/users/${user.id}`}
      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all hover:shadow-md ${getRankBg(rank)}`}
    >
      <div className="flex items-center justify-center w-10 h-10">
        {getRankIcon(rank)}
      </div>
      
      <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-full">
        <span className="text-sm font-semibold text-green-600">
          {user.userName.slice(0, 2).toUpperCase()}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900 truncate text-sm hover:text-blue-600 transition-colors">
            {user.userName}
          </h3>
          <Badge variant="secondary" className="bg-pastel-green-100 text-pastel-green-700 text-xs px-1.5 py-0.5">
            Lv.{user.stats.level}
          </Badge>
        </div>
        {user.regions && (
          <div className="flex items-center gap-1 mt-1">
            <MapPin className="h-3 w-3 text-gray-500 flex-shrink-0" />
            <span className="text-xs text-gray-600">{user.regions.sido} {user.regions.sigungu}</span>
          </div>
        )}
      </div>

      <div className="text-right flex-shrink-0">
        <div className="flex items-center gap-1">
          <Star className="h-3 w-3 text-pastel-green-500" />
          <span className="font-bold text-pastel-green-600 text-sm">
            {user.stats.totalExperience.toLocaleString()}
          </span>
        </div>
        <span className="text-xs text-gray-500">경험치</span>
      </div>
    </button>
  );
}

// 사용자 순위 표시 컴포넌트
function UserRankBadge({ rank, isCurrentUser }: { rank: number; isCurrentUser: boolean }) {
  if (!isCurrentUser || rank === 0) return null;
  
  return (
    <div className="mb-4 p-3 bg-gradient-to-r from-pastel-green-50 to-emerald-50 border border-pastel-green-200 rounded-lg">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-pastel-green-600" />
        <span className="text-sm font-medium text-pastel-green-700">
          이 학교에서 내 순위: <span className="font-bold">#{rank}</span>
        </span>
      </div>
    </div>
  );
}

// 로딩 스켈레톤
function RankingListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 border rounded-lg animate-pulse">
          <div className="w-10 h-10 bg-gray-200 rounded-full" />
          <div className="w-10 h-10 bg-gray-200 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-24" />
            <div className="h-3 bg-gray-200 rounded w-16" />
          </div>
          <div className="h-6 bg-gray-200 rounded w-12" />
        </div>
      ))}
    </div>
  );
}

export default function SchoolRankingPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const schoolId = params.schoolId as string;
  
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  const [state, setState] = useState<RankingState>({
    users: [],
    hasMore: false,
    isLoading: true,
    lastDoc: undefined,
  });

  // 학교 정보 로드
  const loadSchoolInfo = async () => {
    try {
      const schoolDoc = await getDoc(doc(db, 'schools', schoolId));
      if (schoolDoc.exists()) {
        const data = schoolDoc.data();
        setSchoolInfo({
          id: schoolDoc.id,
          name: data.name,
          address: data.address,
          type: data.type,
          regions: data.regions,
        });
      } else {
        // 사용자 데이터에서 학교 이름 찾기 (fallback)
        const result = await getRankings({
          type: 'school',
          schoolId,
          limit: 1,
        });
        if (result.users.length > 0 && result.users[0].school) {
          setSchoolInfo({
            id: schoolId,
            name: result.users[0].school.name,
          });
        }
      }
    } catch (error) {
      console.error('학교 정보 로드 오류:', error);
    }
  };

  const loadRankings = async (reset = false) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: undefined }));
      
      const result = await getRankings({
        type: 'school',
        schoolId,
        limit: 20,
        lastDoc: reset ? undefined : state.lastDoc,
      });

      setState(prev => ({
        users: reset ? result.users : [...prev.users, ...result.users],
        hasMore: result.hasMore,
        lastDoc: result.lastDoc,
        isLoading: false,
      }));
    } catch (error) {
      console.error('학교 랭킹 로드 오류:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: '랭킹을 불러오는 중 오류가 발생했습니다.' 
      }));
    }
  };

  useEffect(() => {
    if (schoolId) {
      loadSchoolInfo();
      loadRankings(true);
    }
  }, [schoolId]);

  const handleLoadMore = () => {
    if (!state.isLoading && state.hasMore) {
      loadRankings(false);
    }
  };

  // 현재 사용자의 순위 계산
  const currentUserRank = user ? state.users.findIndex(u => u.id === user.uid) + 1 : 0;
  const isCurrentUserInSchool = user && user.school?.id === schoolId;

  return (
    <div className="container mx-auto px-3 py-4 pb-20">
      {/* 헤더 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4 p-2 hover:bg-gray-100"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          뒤로가기
        </Button>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <School className="h-6 w-6 text-green-500" />
          {schoolInfo?.name || '학교'} 랭킹
        </h1>
        <div className="space-y-1">
          <p className="text-sm text-gray-600">
            이 학교에 속한 사용자들의 경험치 순위입니다
          </p>
          {schoolInfo?.regions && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <MapPin className="h-3 w-3" />
              <span>{schoolInfo.regions.sido} {schoolInfo.regions.sigungu}</span>
            </div>
          )}
          {schoolInfo?.type && (
            <div className="text-xs text-gray-500">
              {schoolInfo.type}
            </div>
          )}
        </div>
      </div>

      {/* 랭킹 카드 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-green-500" />
            개인 랭킹
          </CardTitle>
          <CardDescription>
            {schoolInfo?.name || '학교'} 소속 사용자 순위
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* 현재 사용자 순위 표시 */}
          {isCurrentUserInSchool && (
            <UserRankBadge 
              rank={currentUserRank} 
              isCurrentUser={currentUserRank > 0}
            />
          )}

          {/* 랭킹 리스트 */}
          {state.isLoading && state.users.length === 0 ? (
            <RankingListSkeleton />
          ) : state.error ? (
            <div className="text-center py-8 text-red-500 text-sm">{state.error}</div>
          ) : state.users.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              이 학교에는 아직 사용자가 없습니다.
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {state.users.map((user, index) => (
                  <RankingItem
                    key={user.id}
                    user={user}
                    index={index}
                  />
                ))}
              </div>

              {/* 더 보기 버튼 */}
              {state.hasMore && (
                <div className="flex justify-center mt-6">
                  <Button
                    onClick={handleLoadMore}
                    disabled={state.isLoading}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    {state.isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-pastel-green-600 rounded-full animate-spin" />
                        로딩 중...
                      </>
                    ) : (
                      '더 보기'
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

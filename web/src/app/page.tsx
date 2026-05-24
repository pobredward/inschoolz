'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRightIcon,
  MessageCircleIcon,
  ShieldIcon,
  MapPin,
  School,
  Zap
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/providers/AuthProvider';
import { getPopularPostsForHome } from '@/lib/api/board';
import { getRankingPreview, getAggregatedRegionalRankings, getAggregatedSchoolRankings, RankingUser, AggregatedRegion, AggregatedSchool } from '@/lib/api/ranking';
import { FirebaseTimestamp } from '@/types';

import PostListItem from '@/components/board/PostListItem';
import TodayMeals from '@/components/meals/TodayMeals';

interface PopularPost {
  id: string;
  title: string;
  content: string;
  boardName: string;
  boardCode: string;
  previewContent?: string;
  authorInfo: {
    displayName: string;
    isAnonymous: boolean;
  };
  stats: {
    viewCount: number;
    likeCount: number;
    commentCount: number;
  };
  createdAt: FirebaseTimestamp;
}

interface RankingPreview {
  national: RankingUser[];
  regional: AggregatedRegion[];
  school: AggregatedSchool[];
}

export default function Home() {
  const { user } = useAuth();
  const [popularPosts, setPopularPosts] = useState<PopularPost[]>([]);
  const [rankingPreview, setRankingPreview] = useState<RankingPreview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHomeData = async () => {
      try {
        setLoading(true);
        
        // 인기 게시글 로드
        const posts = await getPopularPostsForHome(2);
        setPopularPosts(posts);
        
        // 전국 유저 랭킹 (3등까지)
        const nationalRankingData = await getRankingPreview(
          user?.uid,
          user?.school?.id,
          user?.regions?.sido,
          user?.regions?.sigungu
        );
        
        // 지역별 집계 랭킹 (3등까지)
        const regionalAggregated = await getAggregatedRegionalRankings(3, 0);
        
        // 학교별 집계 랭킹 (3등까지)
        const schoolAggregated = await getAggregatedSchoolRankings(3, 0);
        
        setRankingPreview({
          national: nationalRankingData.national,
          regional: regionalAggregated,
          school: schoolAggregated,
        });
        
      } catch (error) {
        console.error('홈 데이터 로드 실패:', error);
      } finally {
        setLoading(false);
      }
    };

    loadHomeData();
  }, [user]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <span className="text-lg">🥇</span>;
      case 2: return <span className="text-lg">🥈</span>;
      case 3: return <span className="text-lg">🥉</span>;
      default: return <span className="text-sm font-medium text-gray-500">#{rank}</span>;
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-emerald-50/30 to-green-50/30">
      <div className="container mx-auto px-4 py-6">
        {/* 관리자 대시보드 바로가기 */}
        {user && 'isAdmin' in user && Boolean((user as { isAdmin?: boolean }).isAdmin) && (
          <div className="mb-6">
            <Link 
              href="/admin" 
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:from-amber-700 active:to-orange-700 text-white py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-medium transition-all duration-200 touch-manipulation active:scale-95 min-h-touch shadow-lg border-2 border-amber-300"
            >
              <ShieldIcon className="h-5 w-5" />
              관리자 대시보드 바로가기
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* 메인 컨텐츠 */}
          <div className="lg:col-span-2 space-y-6 lg:space-y-8">
            {/* 인기 게시글 섹션 - 게임 스타일 */}
            <div className="bg-white rounded-2xl overflow-hidden border-2 border-emerald-100 shadow-lg">
              <div className="bg-gradient-to-r from-emerald-500/10 to-green-500/10 border-b-2 border-emerald-100 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl lg:text-2xl font-bold text-emerald-900 flex items-center gap-2">
                  <span>🔥</span>
                  <span>실시간 인기 글</span>
                </h2>
                <Link 
                  href="/community?tab=national" 
                  className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 active:text-emerald-800 flex items-center gap-1 transition-all hover:gap-2"
                >
                  더보기
                  <span className="text-lg">›</span>
                </Link>
              </div>
              <div className="p-4">
                {loading ? (
                  <div className="space-y-4">
                    {[...Array(2)].map((_, i) => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : popularPosts.length > 0 ? (
                  <div className="space-y-3">
                    {popularPosts.map((post) => (
                      <PostListItem
                        key={post.id}
                        post={post}
                        href={`/community/national/${post.boardCode}/${post.id}`}
                        typeBadgeText="전국"
                        boardBadgeText={post.boardName || post.boardCode}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <MessageCircleIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>아직 인기 게시글이 없습니다.</p>
                  </div>
                )}
              </div>
            </div>

            {/* 커뮤니티 바로가기 - 게임 스타일 */}
            <div className="bg-white rounded-2xl overflow-hidden border-2 border-emerald-100 shadow-lg">
              <div className="bg-gradient-to-r from-emerald-500/10 to-green-500/10 border-b-2 border-emerald-100 px-6 py-4">
                <h2 className="text-xl font-bold text-emerald-900 flex items-center gap-2">
                  <span>💬</span>
                  <span>커뮤니티 바로가기</span>
                </h2>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-3 gap-3">
                  <Link href="/community?tab=national" className="group">
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-200 border border-emerald-200 hover:border-emerald-300 rounded-xl p-3 sm:p-4 text-center transition-all duration-300 hover:shadow-lg">
                      <div className="text-2xl sm:text-3xl mb-1 sm:mb-2 group-hover:scale-110 transition-transform">🌍</div>
                      <h3 className="font-semibold mb-1 text-xs sm:text-base text-emerald-900">전국 커뮤니티</h3>
                      <p className="text-xs text-emerald-600 hidden sm:block">모든 학생들과 소통</p>
                    </div>
                  </Link>
                  <Link href="/community?tab=regional" className="group">
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-200 border border-emerald-200 hover:border-emerald-300 rounded-xl p-3 sm:p-4 text-center transition-all duration-300 hover:shadow-lg">
                      <div className="text-2xl sm:text-3xl mb-1 sm:mb-2 group-hover:scale-110 transition-transform">🏘️</div>
                      <h3 className="font-semibold mb-1 text-xs sm:text-base text-emerald-900">지역 커뮤니티</h3>
                      <p className="text-xs text-emerald-600 hidden sm:block">우리 지역 친구들과</p>
                    </div>
                  </Link>
                  <Link href="/community?tab=school" className="group">
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-200 border border-emerald-200 hover:border-emerald-300 rounded-xl p-3 sm:p-4 text-center transition-all duration-300 hover:shadow-lg">
                      <div className="text-2xl sm:text-3xl mb-1 sm:mb-2 group-hover:scale-110 transition-transform">🏫</div>
                      <h3 className="font-semibold mb-1 text-xs sm:text-base text-emerald-900">학교 커뮤니티</h3>
                      <p className="text-xs text-emerald-600 hidden sm:block">우리 학교만의 공간</p>
                    </div>
                  </Link>
                </div>
              </div>
            </div>

            {/* 미니게임 바로가기 - 게임 스타일 */}
            <div className="bg-white rounded-2xl overflow-hidden border-2 border-emerald-100 shadow-lg">
              <div className="bg-gradient-to-r from-emerald-500/10 to-green-500/10 border-b-2 border-emerald-100 px-6 py-4">
                <h2 className="text-xl font-bold text-emerald-900 flex items-center gap-2">
                  <span>🎮</span>
                  <span>미니게임</span>
                </h2>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-3 gap-3">
                  <Link href="/games/reaction" className="group">
                    <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 hover:from-yellow-100 hover:to-yellow-200 border border-yellow-200 hover:border-yellow-300 rounded-xl p-4 text-center transition-all duration-300 hover:shadow-lg">
                      <Zap className="h-8 w-8 mx-auto mb-2 text-yellow-600 group-hover:scale-110 transition-transform" />
                      <h4 className="font-semibold text-sm mb-1 text-yellow-900">반응속도</h4>
                      <p className="text-xs text-yellow-700 font-medium">+15 XP</p>
                    </div>
                  </Link>
                  <Link href="/games/tile" className="group">
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 border border-purple-200 hover:border-purple-300 rounded-xl p-4 text-center transition-all duration-300 hover:shadow-lg">
                      <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">🧩</div>
                      <h4 className="font-semibold text-sm mb-1 text-purple-900">타일 맞추기</h4>
                      <p className="text-xs text-purple-700 font-medium">+10 XP</p>
                    </div>
                  </Link>
                  <Link href="/games/math" className="group">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border border-blue-200 hover:border-blue-300 rounded-xl p-4 text-center transition-all duration-300 hover:shadow-lg">
                      <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">🧮</div>
                      <h4 className="font-semibold text-sm mb-1 text-blue-900">빠른 계산</h4>
                      <p className="text-xs text-blue-700 font-medium">+15 XP</p>
                    </div>
                  </Link>
                </div>
              </div>
            </div>

            {/* 급식 정보 - 게임 스타일 */}
            {user?.school?.id && (
              <div className="bg-white rounded-2xl overflow-hidden border-2 border-emerald-100 shadow-lg">
                <div className="bg-gradient-to-r from-emerald-500/10 to-green-500/10 border-b-2 border-emerald-100 px-6 py-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-emerald-900 flex items-center gap-2">
                    <span>🍽️</span>
                    <span>오늘의 급식</span>
                  </h2>
                  <Link 
                    href="/meals" 
                    className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-all hover:gap-2"
                  >
                    전체보기
                    <span className="text-lg">›</span>
                  </Link>
                </div>
                <div className="p-4">
                  <TodayMeals 
                    schoolId={user.school.id} 
                    schoolName={user.school.name}
                    showHeader={false}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 사이드바 - 게임 스타일 */}
          <div className="space-y-6">
            {/* 랭킹 미리보기 */}
            <div className="bg-white rounded-2xl overflow-hidden border-2 border-emerald-100 shadow-lg">
              <div className="bg-gradient-to-r from-emerald-500/10 to-green-500/10 border-b-2 border-emerald-100 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-emerald-900 flex items-center gap-2">
                  <span>🏆</span>
                  <span>랭킹</span>
                </h2>
                <Link 
                  href="/ranking" 
                  className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-all hover:gap-2"
                >
                  전체보기
                  <span className="text-lg">›</span>
                </Link>
              </div>
              
              <div className="p-4">
                {loading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border border-emerald-200">
                        <Skeleton className="h-4 w-16 mb-2" />
                        <div className="space-y-2">
                          {[...Array(3)].map((_, j) => (
                            <div key={j} className="flex items-center gap-2">
                              <Skeleton className="h-6 w-6 rounded-full" />
                              <Skeleton className="h-4 w-20" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* 전국 랭킹 */}
                    <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-4 border border-yellow-200">
                      <h4 className="font-semibold text-sm mb-3 flex items-center gap-1 text-yellow-900">
                        <span>🌍</span> 전국 랭킹
                      </h4>
                      <div className="space-y-2">
                        {rankingPreview?.national.slice(0, 3).map((user, index) => (
                          <div key={user.id} className="flex items-center gap-2 text-sm bg-white/50 rounded-lg px-2 py-1">
                            <div className="w-6 flex justify-center">
                              {getRankIcon(index + 1)}
                            </div>
                            <span className="flex-1 truncate font-medium text-gray-900">{user.userName}</span>
                            <span className="text-xs font-semibold text-emerald-600">Lv.{user.stats.level}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 지역 랭킹 (집계) */}
                    {rankingPreview?.regional && rankingPreview.regional.length > 0 && (
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                        <h4 className="font-semibold text-sm mb-3 flex items-center gap-1 text-blue-900">
                          <MapPin className="h-4 w-4" /> 지역 랭킹
                        </h4>
                        <div className="space-y-2">
                          {rankingPreview.regional.slice(0, 3).map((region, index) => (
                            <div key={region.id} className="flex items-center gap-2 text-sm bg-white/50 rounded-lg px-2 py-1">
                              <div className="w-6 flex justify-center">
                                {getRankIcon(index + 1)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 truncate">{region.sido} {region.sigungu}</div>
                                <div className="text-xs text-gray-600">{region.userCount}명 참여</div>
                              </div>
                              <span className="text-xs font-semibold text-blue-600">{region.totalExperience.toLocaleString()} XP</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 학교 랭킹 (집계) */}
                    {rankingPreview?.school && rankingPreview.school.length > 0 && (
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
                        <h4 className="font-semibold text-sm mb-3 flex items-center gap-1 text-purple-900">
                          <School className="h-4 w-4" /> 학교 랭킹
                        </h4>
                        <div className="space-y-2">
                          {rankingPreview.school.slice(0, 3).map((school, index) => (
                            <div key={school.id} className="flex items-center gap-2 text-sm bg-white/50 rounded-lg px-2 py-1">
                              <div className="w-6 flex justify-center">
                                {getRankIcon(index + 1)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 truncate">{school.name}</div>
                                <div className="text-xs text-gray-600">{school.userCount}명 참여</div>
                              </div>
                              <span className="text-xs font-semibold text-purple-600">{school.totalExperience.toLocaleString()} XP</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

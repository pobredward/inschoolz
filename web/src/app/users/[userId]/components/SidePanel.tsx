'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getUserActivitySummary, getUserGameStats } from '@/lib/api/users';
import { Skeleton } from '@/components/ui/skeleton';
import { Post } from '@/types';

// 활동 요약 인터페이스 정의
interface ActivitySummary {
  mostActiveBoards: Array<{
    boardCode: string;
    count: number;
  }>;
  topPosts: Post[];
}

// 게임 스탯 인터페이스 정의
interface GameStats {
  flappyBird?: { totalScore: number };
  reactionGame?: { totalScore: number };
  tileGame?: { totalScore: number };
}

interface SidePanelProps {
  userId: string;
  isOwnProfile: boolean;
}

export default function SidePanel({ userId, isOwnProfile }: SidePanelProps) {
  const [loading, setLoading] = useState(true);
  const [activitySummary, setActivitySummary] = useState<ActivitySummary | null>(null);
  const [gameStats, setGameStats] = useState<GameStats | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryData, statsData] = await Promise.all([
          getUserActivitySummary(userId),
          getUserGameStats(userId)
        ]);
        
        setActivitySummary(summaryData as ActivitySummary);
        setGameStats(statsData as GameStats);
      } catch (error) {
        console.error('사이드 패널 데이터 로드 오류:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  return (
    <div className="space-y-6">
      {/* 활동 요약 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-md">활동 요약</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ) : activitySummary ? (
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">자주 활동하는 게시판</h4>
                {activitySummary.mostActiveBoards?.length > 0 ? (
                  <ul className="space-y-1 text-muted-foreground">
                    {activitySummary.mostActiveBoards.map((board, index) => (
                      <li key={index} className="flex justify-between">
                        <span>{board.boardCode}</span>
                        <span>{board.count}개 게시글</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">활동한 게시판이 없습니다.</p>
                )}
              </div>
              
              <div>
                <h4 className="font-medium mb-2">인기 게시글</h4>
                {activitySummary.topPosts?.length > 0 ? (
                  <ul className="space-y-1 text-muted-foreground">
                    {activitySummary.topPosts.map((post) => (
                      <li key={post.id} className="truncate">
                        {post.title} (💗 {post.stats.likeCount})
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">인기 게시글이 없습니다.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">활동 정보가 없습니다.</p>
          )}
        </CardContent>
      </Card>

      {/* 게임 스탯 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-md">게임 스탯</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : gameStats ? (
            <div className="space-y-2 text-sm">
              {gameStats.flappyBird && (
                <div className="flex justify-between">
                  <span>플래피 버드</span>
                  <span className="font-medium">{gameStats.flappyBird.totalScore} 점</span>
                </div>
              )}
              {gameStats.reactionGame && (
                <div className="flex justify-between">
                  <span>반응 속도 게임</span>
                  <span className="font-medium">{gameStats.reactionGame.totalScore} 점</span>
                </div>
              )}
              {gameStats.tileGame && (
                <div className="flex justify-between">
                  <span>타일 맞추기</span>
                  <span className="font-medium">{gameStats.tileGame.totalScore} 점</span>
                </div>
              )}
              {!gameStats.flappyBird && !gameStats.reactionGame && !gameStats.tileGame && (
                <p className="text-muted-foreground">게임 기록이 없습니다.</p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">게임 기록이 없습니다.</p>
          )}
        </CardContent>
      </Card>
      
      {/* 추가 정보 패널 */}
      {isOwnProfile && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-md">프로필 관리</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                프로필 정보를 수정하거나 개인정보 설정을 변경할 수 있습니다.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 
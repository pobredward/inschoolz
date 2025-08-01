'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/providers/AuthProvider';
import { useExperience } from '@/providers/experience-provider';
import { updateGameScore, getUserGameStats } from '@/lib/api/games';
import { getExperienceSettings } from '@/lib/api/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Home, Trophy, Medal, Zap } from 'lucide-react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

type GameState = 'waiting' | 'ready' | 'active' | 'finished';

interface GameResult {
  reactionTime: number;
  round: number;
}

interface RankingUser {
  id: string;
  nickname: string;
  bestReactionTime: number; // ms 단위
  schoolName?: string;
}

export default function ReactionGamePage() {
  const { user } = useAuth();
  const { showExpGain, showLevelUp, refreshUserStats } = useExperience();
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [currentAttempt, setCurrentAttempt] = useState(1);
  const [remainingAttempts, setRemainingAttempts] = useState(5);
  const [result, setResult] = useState<GameResult | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [rankings, setRankings] = useState<RankingUser[]>([]);
  const [experienceThresholds, setExperienceThresholds] = useState<Array<{minReactionTime: number; xpReward: number}>>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  const maxAttempts = 5;

  // 랭킹 데이터 로드 (최저 반응시간 기준)
  const loadRankings = async () => {
    try {
      const usersRef = collection(db, 'users');
      const rankingQuery = query(
        usersRef,
        orderBy('gameStats.reactionGame.bestReactionTime', 'asc'),
        limit(10)
      );
      
      const snapshot = await getDocs(rankingQuery);
      const rankingData: RankingUser[] = [];
      
      snapshot.forEach((doc) => {
        const userData = doc.data();
        if (userData.gameStats?.reactionGame?.bestReactionTime && userData.gameStats.reactionGame.bestReactionTime > 0) {
          rankingData.push({
            id: doc.id,
            nickname: userData.profile?.userName || userData.profile?.nickname || '익명',
            bestReactionTime: userData.gameStats.reactionGame.bestReactionTime,
            schoolName: userData.school?.name
          });
        }
      });
      
      setRankings(rankingData);
    } catch (error) {
      console.error('랭킹 데이터 로드 실패:', error);
    }
  };

  // 경험치 설정 로드 (반응시간 기반으로 변경)
  const loadExperienceSettings = async () => {
    try {
      // 캐시 무효화하여 최신 Firebase 설정 가져오기
      const { invalidateSystemSettingsCache } = await import('@/lib/experience');
      invalidateSystemSettingsCache();
      
      const settings = await getExperienceSettings();
      const gameSettings = settings.games.reactionGame;
      
      if (gameSettings && gameSettings.thresholds) {
        // Firebase threshold를 직접 사용 (minScore를 ms로 해석)
        const timeBasedThresholds = gameSettings.thresholds.map(threshold => ({
          minReactionTime: threshold.minScore, // minScore가 실제로는 ms 값
          xpReward: threshold.xpReward
        })).sort((a, b) => a.minReactionTime - b.minReactionTime); // 빠른 시간 순으로 정렬
        
        setExperienceThresholds(timeBasedThresholds);
        console.log('Experience thresholds loaded:', timeBasedThresholds);
      }
    } catch (error) {
      console.error('경험치 설정 로드 실패:', error);
    }
  };

  // 남은 기회 실시간 조회
  const loadRemainingAttempts = async () => {
    if (!user?.uid) return;
    
    try {
      setIsLoadingStats(true);
      const statsResponse = await getUserGameStats(user.uid);
      
      if (statsResponse.success && statsResponse.data) {
        const todayPlays = statsResponse.data.todayPlays.reactionGame || 0;
        const maxPlays = statsResponse.data.maxPlays || 5;
        const remaining = Math.max(0, maxPlays - todayPlays);
        
        setRemainingAttempts(remaining);
        setCurrentAttempt(todayPlays + 1);
      }
    } catch (error) {
      console.error('게임 통계 로드 실패:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    loadRankings();
    loadExperienceSettings();
    loadRemainingAttempts();
  }, [user]);

  // 게임 시작 (색상 변경 시작)
  const startGame = () => {
    if (gameState !== 'waiting' || remainingAttempts <= 0) return;
    
    setGameState('ready');
    setResult(null);
    
    // 2-5초 후 랜덤하게 색상 변경
    const delay = Math.random() * 3000 + 2000;
    const id = setTimeout(() => {
      setGameState('active');
      setStartTime(performance.now());
    }, delay);
    
    setTimeoutId(id);
  };

  // 게임 영역 클릭 처리
  const handleGameClick = () => {
    if (gameState === 'waiting') {
      startGame();
    } else if (gameState === 'active') {
      const endTime = performance.now();
      const reactionTime = endTime - startTime;
      
      // timeout 정리
      if (timeoutId) {
        clearTimeout(timeoutId);
        setTimeoutId(null);
      }
      
      setResult({
        reactionTime,
        round: currentAttempt
      });
      setGameState('finished');
      
      // 게임 결과 저장
      finishGame(reactionTime);
    } else if (gameState === 'ready') {
      // 너무 빨리 클릭한 경우
      if (timeoutId) {
        clearTimeout(timeoutId);
        setTimeoutId(null);
      }
      
      toast.error('너무 빨리 클릭했습니다! 초록색으로 변할 때까지 기다리세요.');
      setGameState('waiting');
    }
  };

  // 게임 종료 및 점수 저장
  const finishGame = async (reactionTime: number) => {
    if (!user?.uid) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    console.log(`finishGame - 반응시간: ${reactionTime}ms`);
    console.log('finishGame - 현재 경험치 임계값:', experienceThresholds);

    try {
      // 반응시간을 점수로 변환 (반응시간이 빠를수록 높은 점수)
      // 1000ms 기준으로 점수 계산
      const score = Math.max(1, Math.round(1000 - reactionTime + 100));
      console.log(`finishGame - 계산된 점수: ${score}`);
      
      // 동적 import로 updateGameScore 함수 호출
      const result = await updateGameScore(user.uid, 'reactionGame', score, reactionTime);
      console.log('finishGame - updateGameScore 결과:', result);
      
      if (result.success) {
        // 경험치 모달 표시
        if (result.leveledUp && result.oldLevel && result.newLevel) {
          showLevelUp(result.xpEarned || 0, result.oldLevel, result.newLevel);
        } else if (result.xpEarned && result.xpEarned > 0) {
          showExpGain(
            result.xpEarned, 
            `반응속도 게임 완료! ${(reactionTime / 1000).toFixed(3)}초 기록`
          );
        } else {
          console.log('finishGame - 경험치를 얻지 못함:', result.xpEarned);
          toast.info(`게임 완료! ${(reactionTime / 1000).toFixed(3)}초 기록 (경험치 없음)`);
        }
        
        // 성공 시 랭킹 새로고침 및 남은 기회 업데이트
        loadRankings();
        loadRemainingAttempts();
        refreshUserStats(); // 실시간 사용자 통계 새로고침
      } else {
        toast.error(result.message || '점수 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('게임 결과 저장 실패:', error);
      toast.error('게임 결과 저장 중 오류가 발생했습니다.');
    }
  };

  // 다시 하기
  const resetGame = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setGameState('waiting');
    setResult(null);
    
    // 남은 기회 새로고침
    loadRemainingAttempts();
  };

  // 게임 초기화 (모든 기회 리셋)
  const resetAllAttempts = () => {
    // 실제 구현에서는 관리자만 가능하도록 제한하거나, 일일 리셋 기능으로 대체
    toast.info('일일 기회는 매일 자정에 초기화됩니다.');
  };

  const getGameButtonText = () => {
    if (remainingAttempts <= 0) return '오늘의 기회 소진';
    if (gameState === 'waiting') return '게임 시작 (클릭하세요!)';
    if (gameState === 'ready') return '초록색으로 변하면 클릭!';
    if (gameState === 'active') return '지금 클릭!';
    if (gameState === 'finished') return '게임 완료';
    return '게임 시작';
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Zap className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">로그인이 필요합니다</h3>
              <p className="text-sm text-gray-500 mb-4">
                반응속도 게임을 플레이하려면 로그인해주세요.
              </p>
              <Button asChild>
                <Link href="/auth">로그인하기</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/games">
                <Home className="w-4 h-4 mr-2" />
                게임 홈
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">반응속도 게임</h1>
              <p className="text-gray-600">초록색으로 바뀌는 순간 최대한 빠르게 클릭하세요!</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {isLoadingStats ? (
              <div className="text-sm text-gray-500">로딩 중...</div>
            ) : (
              <div className="text-right">
                <div className="text-sm text-gray-500">오늘 남은 기회</div>
                <div className="text-xl font-bold text-blue-600">
                  {remainingAttempts}/{maxAttempts}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 게임 영역 */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <button
            onClick={handleGameClick}
            disabled={remainingAttempts <= 0 || gameState === 'ready'}
            className={`w-full h-48 rounded-lg text-white font-bold text-xl transition-colors duration-200 ${
              remainingAttempts <= 0 
                ? 'bg-gray-400 cursor-not-allowed' 
                : gameState === 'waiting' 
                ? 'bg-red-500 hover:bg-red-600' 
                : gameState === 'ready' 
                ? 'bg-yellow-500' 
                : gameState === 'active' 
                ? 'bg-green-500' 
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {getGameButtonText()}
          </button>

          {/* 게임 결과 */}
          {result && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">게임 결과</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {(result.reactionTime / 1000).toFixed(3)}초
                  </div>
                  <div className="text-sm text-gray-600">반응 시간</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {Math.round(100000 / result.reactionTime)}점
                  </div>
                  <div className="text-sm text-gray-600">점수</div>
                </div>
              </div>
            </div>
          )}

          {/* 게임 버튼들 */}
          <div className="mt-6 flex gap-3">
            {gameState === 'finished' && remainingAttempts > 0 && (
              <button
                onClick={resetGame}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                ▶ 다시 하기
              </button>
            )}
            
            <button
              onClick={resetAllAttempts}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              🔄 초기화
            </button>
          </div>
        </div>

        {/* 경험치 정보 */}
        {experienceThresholds.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              ⭐ 경험치 정보
            </h2>
            <div className="text-sm text-gray-600 mb-4">
              반응속도가 빠를수록 더 많은 경험치를 획득할 수 있습니다!
            </div>
            <div className="space-y-3">
              {experienceThresholds
                .sort((a, b) => a.minReactionTime - b.minReactionTime)
                .map((threshold, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium">
                      {threshold.minReactionTime}ms 이하
                    </span>
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                      +{threshold.xpReward} XP
                    </span>
                  </div>
                ))}
            </div>
            <div className="text-xs text-gray-500 mt-3">
              💡 200ms 이하로 반응하면 최대 경험치를 획득할 수 있어요!
            </div>
          </div>
        )}

        {/* 랭킹 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              TOP 10 랭킹
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {rankings.length > 0 ? (
                rankings.map((user, index) => (
                  <div key={user.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-yellow-500 text-white' :
                        index === 1 ? 'bg-gray-400 text-white' :
                        index === 2 ? 'bg-amber-600 text-white' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {index === 0 ? <Medal className="w-3 h-3" /> : index + 1}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{user.nickname}</div>
                        {user.schoolName && (
                          <div className="text-xs text-gray-500">{user.schoolName}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-sm font-bold">{user.bestReactionTime.toFixed(2)}ms</div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-4">
                  아직 랭킹 데이터가 없습니다.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 
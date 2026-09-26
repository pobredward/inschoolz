'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/providers/AuthProvider';
import { useExperience } from '@/providers/experience-provider';
import { useQuestTracker } from '@/hooks/useQuestTracker';
import { updateGameScore, getUserGameStats } from '@/lib/api/games';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Medal, Calculator } from 'lucide-react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

type GameState = 'waiting' | 'playing' | 'finished';

interface MathProblem {
  num1: number;
  num2: number;
  operator: '+' | '-';
  answer: number;
}

interface RankingUser {
  id: string;
  nickname: string;
  bestScore: number;
  schoolName?: string;
}

export default function MathGamePage() {
  const { user, isLoading } = useAuth();
  const { showExpGain, showLevelUp, refreshUserStats } = useExperience();
  const { trackPlayGame } = useQuestTracker();
  
  // 게임 상태
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [currentProblem, setCurrentProblem] = useState<MathProblem | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [totalProblems, setTotalProblems] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  
  // 통계 및 랭킹
  const [remainingAttempts, setRemainingAttempts] = useState(5);
  const [rankings, setRankings] = useState<RankingUser[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [bestScore, setBestScore] = useState<number | null>(null);

  const maxAttempts = 5;

  // 랜덤 문제 생성 (1~20 범위 덧셈/뺄셈)
  const generateProblem = useCallback((): MathProblem => {
    const num1 = Math.floor(Math.random() * 20) + 1; // 1-20
    const num2 = Math.floor(Math.random() * 20) + 1; // 1-20
    const operator = Math.random() < 0.5 ? '+' : '-';
    
    let answer: number;
    let finalNum1: number;
    let finalNum2: number;
    
    if (operator === '-') {
      // 뺄셈의 경우 음수가 나오지 않도록 큰 수를 앞에
      finalNum1 = Math.max(num1, num2);
      finalNum2 = Math.min(num1, num2);
      answer = finalNum1 - finalNum2;
    } else {
      finalNum1 = num1;
      finalNum2 = num2;
      answer = finalNum1 + finalNum2;
    }
    
    return {
      num1: finalNum1,
      num2: finalNum2,
      operator,
      answer
    };
  }, []);

  // 랭킹 데이터 로드
  const loadRankings = async () => {
    try {
      const usersRef = collection(db, 'publicProfiles');
      const rankingQuery = query(
        usersRef,
        where('gameStats.mathGame.bestReactionTime', '>', 0),
        orderBy('gameStats.mathGame.bestReactionTime', 'desc'),
        limit(10)
      );
      
      const snapshot = await getDocs(rankingQuery);
      const rankingData: RankingUser[] = [];
      
      snapshot.forEach((doc) => {
        const userData = doc.data();
        const bestScore = userData.gameStats?.mathGame?.bestReactionTime;
        
        if (bestScore) {
          rankingData.push({
            id: doc.id,
            nickname: userData.profile?.userName || userData.profile?.nickname || '익명',
            bestScore: bestScore,
            schoolName: userData.school?.name
          });
        }
      });
      
      setRankings(rankingData);
    } catch (error) {
      console.error('랭킹 데이터 로드 실패:', error);
    }
  };

  // 남은 기회 실시간 조회
  const loadRemainingAttempts = async () => {
    if (!user?.uid) return;
    
    try {
      setIsLoadingStats(true);
      const statsResponse = await getUserGameStats(user.uid);
      
      if (statsResponse.success && statsResponse.data) {
        const todayPlays = statsResponse.data.todayPlays.mathGame || 0;
        const maxPlays = statsResponse.data.maxPlays || 5;
        const remaining = Math.max(0, maxPlays - todayPlays);
        
        setRemainingAttempts(remaining);
        
        // 최고 점수 로드
        const best = statsResponse.data.bestReactionTimes.mathGame || null;
        setBestScore(best);
      }
    } catch (error) {
      console.error('게임 통계 로드 실패:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    loadRankings();
    loadRemainingAttempts();
  }, [user]);

  // 타이머 관리
  useEffect(() => {
    if (gameState === 'playing' && timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
      
      return () => clearTimeout(timer);
    } else if (gameState === 'playing' && timeLeft === 0) {
      finishGame();
    }
  }, [gameState, timeLeft]);

  // 게임 시작
  const startGame = async () => {
    if (remainingAttempts <= 0) {
      toast.error('오늘의 플레이 횟수를 모두 사용했습니다.');
      return;
    }
    
    if (!user?.uid) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    
    // 게임 시작 시 횟수 차감
    try {
      const { startGamePlay } = await import('@/lib/api/games');
      const result = await startGamePlay(user.uid, 'mathGame');
      
      if (!result.success) {
        toast.error(result.message || '게임을 시작할 수 없습니다.');
        loadRemainingAttempts();
        return;
      }
    } catch (error) {
      console.error('게임 시작 오류:', error);
      toast.error('게임을 시작할 수 없습니다.');
      return;
    }
    
    setGameState('playing');
    setScore(0);
    setTimeLeft(20);
    setTotalProblems(0);
    setCorrectCount(0);
    setUserAnswer('');
    setCurrentProblem(generateProblem());
  };

  // 답안 제출
  const submitAnswer = () => {
    if (!currentProblem || userAnswer === '') return;
    
    const isCorrect = parseInt(userAnswer) === currentProblem.answer;
    
    if (isCorrect) {
      setScore(score + 1);
      setCorrectCount(correctCount + 1);
    }
    
    setTotalProblems(totalProblems + 1);
    setUserAnswer('');
    setCurrentProblem(generateProblem());
  };

  // 숫자 버튼 클릭
  const handleNumberClick = (num: number) => {
    if (gameState !== 'playing') return;
    setUserAnswer(userAnswer + num.toString());
  };

  // 지우기
  const handleBackspace = () => {
    setUserAnswer(userAnswer.slice(0, -1));
  };

  // 엔터 키 처리
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && userAnswer !== '') {
      submitAnswer();
    }
  };

  // 게임 종료
  const finishGame = async () => {
    setGameState('finished');
    
    if (!user?.uid) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    try {
      console.log('🎮 게임 종료 - 점수:', score);
      const result = await updateGameScore(user.uid, 'mathGame', score, score);
      console.log('🎮 updateGameScore 결과:', result);
      
      if (result.success) {
        // 퀘스트 트래킹: 게임 플레이 (7단계)
        await trackPlayGame();
        
        if (result.leveledUp && result.oldLevel && result.newLevel) {
          console.log('🎉 레벨업!', result.oldLevel, '→', result.newLevel);
          showLevelUp(result.xpEarned || 0, result.oldLevel, result.newLevel);
        } else if (result.xpEarned && result.xpEarned > 0) {
          console.log('⭐ 경험치 획득:', result.xpEarned);
          showExpGain(
            result.xpEarned,
            `빠른 계산 게임 완료! ${score}개 정답`
          );
        } else {
          console.log('❌ 경험치 없음 - xpEarned:', result.xpEarned);
          toast.info(`게임 완료! ${score}개 정답 (경험치 없음)`);
        }
        
        loadRankings();
        loadRemainingAttempts();
        refreshUserStats();
      } else {
        console.error('❌ 게임 저장 실패:', result.message);
        toast.error(result.message || '점수 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('게임 결과 저장 실패:', error);
      toast.error('게임 결과 저장 중 오류가 발생했습니다.');
    }
  };

  // 다시 하기
  const resetGame = () => {
    setGameState('waiting');
    setScore(0);
    setTimeLeft(20);
    setTotalProblems(0);
    setCorrectCount(0);
    setUserAnswer('');
    setCurrentProblem(null);
    loadRemainingAttempts();
  };

  // 로딩 중
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">로그인 정보 확인 중...</h3>
              <p className="text-sm text-gray-500">잠시만 기다려주세요.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 로그인 안됨
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Calculator className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">로그인이 필요합니다</h3>
              <p className="text-sm text-gray-500 mb-4">
                빠른 계산 게임을 플레이하려면 로그인해주세요.
              </p>
              <Button asChild>
                <Link href="/login">로그인하기</Link>
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
                <ArrowLeft className="w-4 h-4 mr-2" />
                게임 홈
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">빠른 계산 릴레이</h1>
              <p className="text-gray-600">20초 동안 최대한 많은 문제를 풀어보세요!</p>
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
                {bestScore !== null && (
                  <div className="text-xs text-gray-500 mt-1">
                    최고 기록: {bestScore}개
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 게임 영역 */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          {gameState === 'waiting' && (
            <div className="text-center py-12">
              <Calculator className="mx-auto h-20 w-20 text-blue-500 mb-6 animate-bounce" />
              <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">빠른 계산 릴레이</h2>
              <p className="text-gray-600 mb-8 text-lg">
                20초 동안 한 자리 수 덧셈/뺄셈 문제를 풀어보세요!
              </p>
              <Button
                onClick={startGame}
                disabled={remainingAttempts <= 0}
                size="lg"
                className="px-10 py-6 text-lg font-bold bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              >
                {remainingAttempts <= 0 ? '오늘의 기회 소진' : '🎮 게임 시작'}
              </Button>
            </div>
          )}

          {gameState === 'playing' && currentProblem && (
            <div className="space-y-6">
              {/* 타이머와 점수 */}
              <div className="flex justify-between items-center">
                <div className="text-center">
                  <div className="text-sm text-gray-500">남은 시간</div>
                  <div className={`text-3xl font-bold ${timeLeft <= 5 ? 'text-red-600' : 'text-blue-600'}`}>
                    {timeLeft}초
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500">정답 수</div>
                  <div className="text-3xl font-bold text-green-600">{score}개</div>
                </div>
              </div>

              {/* 문제 */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-10 text-center shadow-lg">
                <div className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent mb-6 animate-pulse">
                  {currentProblem.num1} {currentProblem.operator} {currentProblem.num2} = ?
                </div>
                <input
                  type="text"
                  value={userAnswer}
                  readOnly
                  placeholder="답을 입력하세요"
                  className="w-full max-w-xs mx-auto text-center text-4xl font-bold border-3 border-blue-400 rounded-xl p-5 bg-white shadow-md"
                  onKeyPress={handleKeyPress}
                />
              </div>

              {/* 숫자 패드 */}
              <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
                {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleNumberClick(num)}
                    className="bg-white border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 rounded-xl h-16 text-3xl font-bold transition-all duration-150 transform hover:scale-105 shadow-md hover:shadow-lg"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={handleBackspace}
                  className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl h-16 text-2xl font-bold transition-all duration-150 transform hover:scale-105 shadow-md hover:shadow-lg"
                >
                  ←
                </button>
                <button
                  onClick={() => handleNumberClick(0)}
                  className="bg-white border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 rounded-xl h-16 text-3xl font-bold transition-all duration-150 transform hover:scale-105 shadow-md hover:shadow-lg"
                >
                  0
                </button>
                <button
                  onClick={submitAnswer}
                  disabled={userAnswer === ''}
                  className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl h-16 text-2xl font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 transform hover:scale-105 shadow-md hover:shadow-lg"
                >
                  ✓
                </button>
              </div>
            </div>
          )}

          {gameState === 'finished' && (
            <div className="text-center py-12">
              <h2 className="text-3xl font-bold mb-6">게임 종료!</h2>
              <div className="space-y-4 mb-8">
                <div className="bg-blue-50 rounded-lg p-6">
                  <div className="text-lg text-gray-600 mb-2">정답 개수</div>
                  <div className="text-5xl font-bold text-blue-600">{score}개</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600">총 문제 수</div>
                    <div className="text-2xl font-bold text-gray-900">{totalProblems}개</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600">정확도</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {totalProblems > 0 ? Math.round((correctCount / totalProblems) * 100) : 0}%
                    </div>
                  </div>
                </div>
              </div>
              {remainingAttempts > 0 && (
                <Button onClick={resetGame} size="lg">
                  다시 하기
                </Button>
              )}
            </div>
          )}
        </div>

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
                rankings.map((rankUser, index) => (
                  <div
                    key={rankUser.id}
                    className={`flex items-center justify-between py-2 border-b last:border-b-0 ${
                      user?.uid === rankUser.id ? 'bg-blue-50 border-blue-200 rounded-lg px-3 -mx-3' : ''
                    }`}
                  >
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
                        <div className={`font-medium text-sm ${
                          user?.uid === rankUser.id ? 'text-blue-700 font-bold' : ''
                        }`}>
                          {rankUser.nickname}
                          {user?.uid === rankUser.id && (
                            <span className="ml-2 text-blue-600 text-xs">(나)</span>
                          )}
                        </div>
                        {rankUser.schoolName && (
                          <div className="text-xs text-gray-500">{rankUser.schoolName}</div>
                        )}
                      </div>
                    </div>
                    <div className={`text-sm font-bold ${
                      user?.uid === rankUser.id ? 'text-blue-700' : ''
                    }`}>
                      {rankUser.bestScore}개
                    </div>
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

        {/* 경험치 정보 */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            ⭐ 경험치 정보
          </h2>
          <div className="text-sm text-gray-600 mb-4">
            더 많은 문제를 맞출수록 더 많은 경험치를 획득할 수 있습니다!
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium">15개 이상</span>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                +15 XP
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium">12-14개</span>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                +10 XP
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium">9-11개</span>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                +5 XP
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium">8개 이하</span>
              <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
                +0 XP
              </span>
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-3">
            💡 팁: 빠르고 정확하게 풀수록 더 높은 점수를 얻을 수 있어요!
          </div>
        </div>
      </div>
    </div>
  );
}


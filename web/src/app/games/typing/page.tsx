'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/providers/AuthProvider';
import { useExperience } from '@/providers/experience-provider';
import { useQuestTracker } from '@/hooks/useQuestTracker';
import { updateGameScore, getUserGameStats } from '@/lib/api/games';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Medal, Keyboard } from 'lucide-react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { englishWords, WordPair } from '@/data/english-words';

type GameState = 'waiting' | 'playing' | 'finished';

interface RankingUser {
  id: string;
  nickname: string;
  bestScore: number;
  schoolName?: string;
}

export default function TypingGamePage() {
  const { user, isLoading } = useAuth();
  const { showExpGain, showLevelUp, refreshUserStats } = useExperience();
  const { trackPlayGame } = useQuestTracker();
  
  // 게임 상태
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [currentWord, setCurrentWord] = useState<WordPair | null>(null);
  const [userInput, setUserInput] = useState('');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [usedWords, setUsedWords] = useState<Set<number>>(new Set());
  
  // 통계 및 랭킹
  const [remainingAttempts, setRemainingAttempts] = useState(5);
  const [rankings, setRankings] = useState<RankingUser[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [bestScore, setBestScore] = useState<number | null>(null);

  const maxAttempts = 5;

  // 랜덤 단어 선택 (중복 방지)
  const getRandomWord = useCallback((): WordPair => {
    const availableIndices = englishWords
      .map((_, index) => index)
      .filter(index => !usedWords.has(index));
    
    // 모든 단어를 사용했으면 초기화
    if (availableIndices.length === 0) {
      setUsedWords(new Set());
      const randomIndex = Math.floor(Math.random() * englishWords.length);
      setUsedWords(new Set([randomIndex]));
      return englishWords[randomIndex];
    }
    
    const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    setUsedWords(prev => new Set([...prev, randomIndex]));
    return englishWords[randomIndex];
  }, [usedWords]);

  // 랭킹 데이터 로드
  const loadRankings = async () => {
    try {
      const usersRef = collection(db, 'publicProfiles');
      const rankingQuery = query(
        usersRef,
        where('gameStats.typingGame.bestReactionTime', '>', 0),
        orderBy('gameStats.typingGame.bestReactionTime', 'desc'),
        limit(10)
      );
      
      const snapshot = await getDocs(rankingQuery);
      const rankingData: RankingUser[] = [];
      
      snapshot.forEach((doc) => {
        const userData = doc.data();
        const bestScore = userData.gameStats?.typingGame?.bestReactionTime;
        
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
        const todayPlays = statsResponse.data.todayPlays.typingGame || 0;
        const maxPlays = statsResponse.data.maxPlays || 5;
        const remaining = Math.max(0, maxPlays - todayPlays);
        
        setRemainingAttempts(remaining);
        
        // 최고 점수 로드
        const best = statsResponse.data.bestReactionTimes.typingGame || null;
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
      const result = await startGamePlay(user.uid, 'typingGame');
      
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
    setUserInput('');
    setUsedWords(new Set());
    const firstWord = getRandomWord();
    setCurrentWord(firstWord);
  };

  // 입력 처리
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase();
    setUserInput(value);

    // 정답 체크
    if (currentWord && value === currentWord.english.toLowerCase()) {
      setScore(prev => prev + 1);
      setUserInput('');
      const nextWord = getRandomWord();
      setCurrentWord(nextWord);
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
      const result = await updateGameScore(user.uid, 'typingGame', score, score);
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
            `영단어 타이핑 게임 완료! ${score}개 정답`
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
    setUserInput('');
    setUsedWords(new Set());
    setCurrentWord(null);
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
              <Keyboard className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">로그인이 필요합니다</h3>
              <p className="text-sm text-gray-500 mb-4">
                영단어 타이핑 게임을 플레이하려면 로그인해주세요.
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
              <h1 className="text-3xl font-bold text-gray-900">영단어 타이핑</h1>
              <p className="text-gray-600">20초 동안 최대한 많은 단어를 입력하세요!</p>
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
              <Keyboard className="mx-auto h-20 w-20 text-purple-500 mb-6 animate-bounce" />
              <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-purple-400 bg-clip-text text-transparent">영단어 타이핑 게임</h2>
              <p className="text-gray-600 mb-8 text-lg">
                20초 동안 화면에 나타나는 영단어를 빠르게 입력하세요!
              </p>
              <Button
                onClick={startGame}
                disabled={remainingAttempts <= 0}
                size="lg"
                className="px-10 py-6 text-lg font-bold bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              >
                {remainingAttempts <= 0 ? '오늘의 기회 소진' : '🎮 게임 시작'}
              </Button>
            </div>
          )}

          {gameState === 'playing' && currentWord && (
            <div className="space-y-6">
              {/* 타이머와 점수 */}
              <div className="flex justify-between items-center">
                <div className="text-center">
                  <div className="text-sm text-gray-500">남은 시간</div>
                  <div className={`text-3xl font-bold ${timeLeft <= 5 ? 'text-red-600' : 'text-purple-600'}`}>
                    {timeLeft}초
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500">정답 수</div>
                  <div className="text-3xl font-bold text-green-600">{score}개</div>
                </div>
              </div>

              {/* 단어 표시 영역 */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-10 text-center shadow-lg">
                <div className="text-6xl font-bold bg-gradient-to-r from-purple-600 to-purple-400 bg-clip-text text-transparent mb-6 tracking-wider animate-pulse">
                  {currentWord.english.toLowerCase()}
                </div>
                <div className="text-3xl text-gray-700 font-semibold mb-8">
                  {currentWord.korean}
                </div>
                <input
                  type="text"
                  value={userInput}
                  onChange={handleInputChange}
                  placeholder="여기에 입력하세요"
                  className="w-full max-w-md mx-auto text-center text-3xl font-bold border-3 border-purple-400 rounded-xl p-5 bg-white focus:outline-none focus:ring-4 focus:ring-purple-300 shadow-md transition-all duration-200"
                  autoFocus
                  autoComplete="off"
                />
                <p className="text-sm text-purple-600 mt-5 font-medium">
                  💡 소문자로 입력해도 됩니다
                </p>
              </div>

              {/* 진행 바 */}
              <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-purple-500 h-full transition-all duration-1000 ease-linear"
                  style={{ width: `${(timeLeft / 20) * 100}%` }}
                />
              </div>
            </div>
          )}

          {gameState === 'finished' && (
            <div className="text-center py-12">
              <h2 className="text-3xl font-bold mb-6">게임 종료!</h2>
              <div className="space-y-4 mb-8">
                <div className="bg-purple-50 rounded-lg p-6">
                  <div className="text-lg text-gray-600 mb-2">정답 개수</div>
                  <div className="text-5xl font-bold text-purple-600">{score}개</div>
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
            더 많은 단어를 입력할수록 더 많은 경험치를 획득할 수 있습니다!
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
            💡 팁: 정확하고 빠르게 입력할수록 더 높은 점수를 얻을 수 있어요!
          </div>
        </div>
      </div>
    </div>
  );
}

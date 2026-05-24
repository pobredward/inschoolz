'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RotateCcw, Trophy, Star, Zap, Medal } from 'lucide-react';
import Link from 'next/link';
import { updateGameScore, getUserGameStats } from '@/lib/api/games';
import { useAuth } from '@/providers/AuthProvider';
import { useExperience } from '@/providers/experience-provider';
import { useQuestTracker } from '@/hooks/useQuestTracker';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

type GameState = 'waiting' | 'playing' | 'finished';

interface Tile {
  id: number;
  value: number;
  isFlipped: boolean;
  isMatched: boolean;
}

interface RankingUser {
  id: string;
  nickname: string;
  bestMoves: number; // 최소 움직임 횟수 (낮을수록 좋음)
  schoolName?: string;
}

export default function TileGamePage() {
  const { user, isLoading } = useAuth();
  const { showExpGain, showLevelUp, refreshUserStats } = useExperience();
  const { trackPlayGame } = useQuestTracker();
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [flippedTiles, setFlippedTiles] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [gameStartTime, setGameStartTime] = useState<number>(0);
  const [remainingAttempts, setRemainingAttempts] = useState(5);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [rankings, setRankings] = useState<RankingUser[]>([]);

  const totalPairs = 6; // 3x4 grid with 6 pairs
  const maxTime = 120; // 2 minutes
  const maxAttempts = 5;

  // 남은 기회 실시간 조회
  const loadRemainingAttempts = async () => {
    if (!user?.uid) return;
    
    try {
      setIsLoadingStats(true);
      const statsResponse = await getUserGameStats(user.uid);
      
      if (statsResponse.success && statsResponse.data) {
        const todayPlays = statsResponse.data.todayPlays.tileGame || 0;
        const remaining = Math.max(0, maxAttempts - todayPlays);
        
        setRemainingAttempts(remaining);
      }
    } catch (error) {
      console.error('게임 통계 로드 실패:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  // 랭킹 데이터 로드 (최소 움직임 횟수 기준)
  const loadRankings = async () => {
    try {
      const usersRef = collection(db, 'users');
      const rankingQuery = query(
        usersRef,
        where('gameStats.tileGame.bestMoves', '>', 0),
        orderBy('gameStats.tileGame.bestMoves', 'asc'),
        limit(10)
      );
      
      const snapshot = await getDocs(rankingQuery);
      const rankingData: RankingUser[] = [];
      
      snapshot.forEach((doc) => {
        const userData = doc.data();
        const bestMoves = userData.gameStats?.tileGame?.bestMoves;
        
        if (bestMoves) {
          rankingData.push({
            id: doc.id,
            nickname: userData.profile?.userName || userData.profile?.nickname || '익명',
            bestMoves: bestMoves,
            schoolName: userData.school?.name
          });
        }
      });
      
      setRankings(rankingData);
    } catch (error) {
      console.error('랭킹 데이터 로드 실패:', error);
    }
  };
  
  // 게임 초기화
  const initializeGame = useCallback(() => {
    const values = [];
    for (let i = 1; i <= totalPairs; i++) {
      values.push(i, i); // 각 숫자를 두 번씩 추가
    }
    
    // 카드 섞기
    const shuffled = values.sort(() => Math.random() - 0.5);
    
    const newTiles: Tile[] = shuffled.map((value, index) => ({
      id: index,
      value,
      isFlipped: false,
      isMatched: false,
    }));
    
    setTiles(newTiles);
    setFlippedTiles([]);
    setMoves(0);
    setMatches(0);
    setTimeElapsed(0);
  }, [totalPairs]);

  // 게임 시작
  const startGame = async () => {
    if (!user?.uid) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    
    // 게임 시작 시 횟수 차감 (새 게임 시작시에만)
    if (gameState !== 'finished') {
      try {
        const { startGamePlay } = await import('@/lib/api/games');
        const result = await startGamePlay(user.uid, 'tileGame');
        
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
    }
    
    // 게임 상태 완전 초기화
    setFlippedTiles([]);
    setMoves(0);
    setMatches(0);
    setTimeElapsed(0);
    setGameStartTime(performance.now());
    
    initializeGame();
    setGameState('playing');
  };

  // 타일 클릭 처리
  const handleTileClick = (tileId: number) => {
    if (gameState !== 'playing' || flippedTiles.length >= 2) return;
    
    const tile = tiles.find(t => t.id === tileId);
    if (!tile || tile.isFlipped || tile.isMatched) return;
    
    const newFlippedTiles = [...flippedTiles, tileId];
    setFlippedTiles(newFlippedTiles);
    
    // 타일 뒤집기
    setTiles(prev => prev.map(t => 
      t.id === tileId ? { ...t, isFlipped: true } : t
    ));

    if (newFlippedTiles.length === 2) {
      setMoves(prev => prev + 1);
      
      const [firstId, secondId] = newFlippedTiles;
      const firstTile = tiles.find(t => t.id === firstId);
      const secondTile = tiles.find(t => t.id === secondId);
      
      if (firstTile && secondTile && firstTile.value === secondTile.value) {
        // 매치 성공
        setTimeout(() => {
          setTiles(prev => prev.map(t => 
            t.id === firstId || t.id === secondId 
              ? { ...t, isMatched: true }
              : t
          ));
          setMatches(prev => {
            const newMatches = prev + 1;
            // 모든 매치 완료 체크
            if (newMatches === totalPairs) {
              // 약간의 지연을 두고 게임 완료
              setTimeout(() => finishGame(), 500);
            }
            return newMatches;
          });
          setFlippedTiles([]);
        }, 1000);
      } else {
        // 매치 실패
        setTimeout(() => {
          setTiles(prev => prev.map(t => 
            t.id === firstId || t.id === secondId 
              ? { ...t, isFlipped: false }
              : t
          ));
          setFlippedTiles([]);
        }, 1000);
      }
    }
  };

  // 게임 종료
  const finishGame = async () => {
    const endTime = performance.now();
    const totalTime = Math.floor((endTime - gameStartTime) / 1000);
    setTimeElapsed(totalTime);
    setGameState('finished');

    // Firebase에 움직임 횟수 저장
    if (user?.uid) {
      try {
        // 움직임 횟수를 score 파라미터로 전달
        const result = await updateGameScore(user.uid, 'tileGame', moves);
        if (result.success) {
          // 퀘스트 트래킹: 게임 플레이 (7단계)
          await trackPlayGame();
          
          // 🆕 타일 게임 10번 이하 클리어 퀘스트 트래킹
          if (moves <= 10) {
            try {
              const { trackQuestAction } = await import('@/lib/quests/questService');
              await trackQuestAction(user.uid, 'tile_game_clear', user, { tileGameMoves: moves });
              console.log(`✅ 타일 게임 ${moves}번 클리어 - 퀘스트 트래킹 완료`);
            } catch (questError) {
              console.error('❌ 퀘스트 트래킹 오류:', questError);
            }
          }
          
          // 경험치 모달 표시
          if (result.leveledUp && result.oldLevel && result.newLevel) {
            showLevelUp(result.xpEarned || 0, result.oldLevel, result.newLevel);
          } else if (result.xpEarned && result.xpEarned > 0) {
            showExpGain(
              result.xpEarned, 
              `타일 게임 완료! ${moves}번 움직임`
            );
          } else {
            toast.info(`게임 완료! ${moves}번 움직임 (경험치 없음)`);
          }
          
          // 성공 시 남은 기회 업데이트
          loadRemainingAttempts();
          loadRankings(); // 랭킹 데이터 새로고침
          refreshUserStats(); // 실시간 사용자 통계 새로고침
        } else {
          toast.error(result.message || '점수 저장에 실패했습니다.');
        }
      } catch (error) {
        console.error('게임 점수 저장 실패:', error);
        toast.error('게임 결과 저장 중 오류가 발생했습니다.');
      }
    }
  };

  // 타이머
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (gameState === 'playing' && gameStartTime > 0) {
      interval = setInterval(() => {
        const elapsed = Math.floor((performance.now() - gameStartTime) / 1000);
        setTimeElapsed(elapsed);
        
        if (elapsed >= maxTime) {
          finishGame();
        }
      }, 1000);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };
  }, [gameState, gameStartTime, maxTime]);

  // 게임 초기화 및 사용자 데이터 로드 (컴포넌트 마운트 시)
  useEffect(() => {
    initializeGame();
    loadRankings(); // 랭킹 데이터 로드
    if (user?.uid) {
      loadRemainingAttempts();
    }
  }, [initializeGame, user?.uid]);

  const getEmojiForValue = (value: number) => {
    const emojis = ['🍎', '🍌', '🍇', '🍊', '🍓', '🥝'];
    return emojis[value - 1] || '❓';
  };

  const progressPercentage = (matches / totalPairs) * 100;
  const timeProgress = ((maxTime - timeElapsed) / maxTime) * 100;

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
              <h1 className="text-3xl font-bold text-gray-900">🧩 타일 매칭 게임</h1>
              <p className="text-gray-600">같은 그림의 타일을 찾아 매칭하세요!</p>
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

        {/* 게임 상태 */}
        {gameState === 'playing' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 max-w-lg mx-auto">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  <div>
                    <p className="text-sm text-gray-600">매치</p>
                    <p className="text-lg font-bold">{matches}/{totalPairs}</p>
                  </div>
                </div>
                <Progress value={progressPercentage} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="text-sm text-gray-600">움직임</p>
                    <p className="text-lg font-bold">{moves}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 게임 영역 */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          {/* 로딩 중일 때 */}
          {isLoading ? (
            <div className="text-center py-12">
              <div className="space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">로그인 정보 확인 중...</h3>
                <p className="text-sm text-gray-500">
                  잠시만 기다려주세요.
                </p>
              </div>
            </div>
          ) : gameState === 'waiting' && (
            <div className="text-center py-12">
              {!user ? (
                <div className="space-y-4">
                  <div className="text-6xl mb-4">🧩</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">로그인이 필요합니다</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    타일 매칭 게임을 플레이하려면 로그인해주세요.
                  </p>
                  <Button asChild>
                    <Link href="/login">로그인하기</Link>
                  </Button>
                </div>
              ) : remainingAttempts <= 0 ? (
                <div className="space-y-4">
                  <div className="text-6xl mb-4">😴</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">오늘의 기회 소진</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    내일 다시 도전해보세요!
                  </p>
                  <Button disabled size="lg">
                    기회 소진
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-7xl mb-6 animate-bounce">🧩</div>
                  <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-green-600 to-green-400 bg-clip-text text-transparent">타일 매칭 게임</h2>
                  <p className="text-gray-600 mb-8 text-lg">
                    3x4 격자에서 6쌍의 타일을 모두 매칭하세요!<br />
                    적은 움직임으로 완료할수록 더 많은 경험치를 획득합니다.
                  </p>
                  <button
                    onClick={startGame}
                    className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-bold py-4 px-10 rounded-xl text-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
                  >
                    🎮 게임 시작 (클릭하세요!)
                  </button>
                </div>
              )}
            </div>
          )}

            {gameState === 'playing' && (
              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto justify-items-center">
                {tiles.map((tile) => (
                  <button
                    key={tile.id}
                    onClick={() => handleTileClick(tile.id)}
                    className={`
                      aspect-square rounded-2xl border-3 text-5xl font-bold transition-all duration-300 h-24 w-24 shadow-lg
                      ${tile.isMatched 
                        ? 'bg-gradient-to-br from-green-100 to-green-200 border-green-400 text-green-600 scale-95 opacity-80' 
                        : tile.isFlipped 
                          ? 'bg-gradient-to-br from-green-100 to-green-200 border-green-400 text-green-600 shadow-xl' 
                          : 'bg-gradient-to-br from-gray-100 to-gray-200 border-gray-300 hover:bg-gradient-to-br hover:from-gray-200 hover:to-gray-300 text-gray-400 hover:shadow-2xl'
                      }
                      ${!tile.isFlipped && !tile.isMatched ? 'hover:scale-110 active:scale-95' : ''}
                    `}
                    disabled={tile.isFlipped || tile.isMatched}
                  >
                    {tile.isFlipped || tile.isMatched ? getEmojiForValue(tile.value) : '❓'}
                  </button>
                ))}
              </div>
            )}

            {gameState === 'finished' && (
              <div className="text-center py-8">
                <div className="text-7xl mb-6 animate-bounce">🎉</div>
                <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-green-600 to-green-400 bg-clip-text text-transparent">게임 완료!</h2>
                
                <div className="max-w-sm mx-auto mb-8">
                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl shadow-md border-2 border-green-200">
                    <p className="text-sm text-green-700 font-semibold mb-2">총 움직임</p>
                    <p className="text-5xl font-bold text-green-600">{moves}회</p>
                  </div>
                </div>

                {/* Firebase 설정에서 실제 경험치 계산됨 */}

                <div className="flex gap-4 justify-center">
                  <Button 
                    onClick={startGame} 
                    className="gap-2 px-8 py-6 text-lg font-bold bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                  >
                    <RotateCcw className="w-5 h-5" />
                    다시 플레이
                  </Button>
                  <Link href="/games">
                    <Button 
                      variant="outline"
                      className="px-8 py-6 text-lg font-semibold border-2 border-gray-300 hover:border-gray-400 shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                    >
                      게임 목록으로
                    </Button>
                  </Link>
                </div>
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
                      {rankUser.bestMoves}번
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
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-xl font-bold text-center mb-4">⭐ 경험치 정보</h3>
          <p className="text-center text-gray-600 mb-6">
            움직임 횟수가 적을수록 더 많은 경험치를 획득할 수 있습니다!
          </p>
          <div className="space-y-3 max-w-md mx-auto">
            <div className="flex justify-between items-center bg-gray-50 px-4 py-2 rounded-lg">
              <span className="font-medium text-gray-700">7번 이하</span>
              <Badge className="bg-yellow-100 text-yellow-800">+15 XP</Badge>
            </div>
            <div className="flex justify-between items-center bg-gray-50 px-4 py-2 rounded-lg">
              <span className="font-medium text-gray-700">8-10번</span>
              <Badge className="bg-yellow-100 text-yellow-800">+10 XP</Badge>
            </div>
            <div className="flex justify-between items-center bg-gray-50 px-4 py-2 rounded-lg">
              <span className="font-medium text-gray-700">11-13번</span>
              <Badge className="bg-yellow-100 text-yellow-800">+5 XP</Badge>
            </div>
            <div className="flex justify-between items-center bg-gray-50 px-4 py-2 rounded-lg">
              <span className="font-medium text-gray-700">14번 이상</span>
              <Badge className="bg-yellow-100 text-yellow-800">+0 XP</Badge>
            </div>
          </div>
          <p className="text-center text-sm text-gray-500 italic mt-4">
            💡 팁: 최적 움직임은 6번입니다. 7번 이하로 완료하면 경험치를 획득할 수 있어요!
          </p>
        </div>
      </div>
    </div>
  );
} 
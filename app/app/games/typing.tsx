import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import { updateGameScore, getUserGameStats } from '../../lib/games';
import { englishWords, WordPair } from '../../data/english-words';
import { Ionicons } from '@expo/vector-icons';
import { useQuest } from '../../providers/QuestProvider';

type GameState = 'waiting' | 'playing' | 'finished';

interface RankingUser {
  id: string;
  nickname: string;
  bestScore: number;
  schoolName?: string;
}

export default function TypingGameScreen() {
  const { user } = useAuthStore();
  const { trackAction } = useQuest();
  const insets = useSafeAreaInsets();
  
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
  const [refreshing, setRefreshing] = useState(false);
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
      const usersQuery = query(
        collection(db, 'publicProfiles'),
        where('gameStats.typingGame.bestReactionTime', '>', 0),
        orderBy('gameStats.typingGame.bestReactionTime', 'desc'),
        limit(10)
      );
      
      const querySnapshot = await getDocs(usersQuery);
      const rankingData: RankingUser[] = [];
      
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        const bestScore = userData.gameStats?.typingGame?.bestReactionTime;
        
        if (bestScore) {
          rankingData.push({
            id: doc.id,
            nickname: userData.profile?.userName || '익명',
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
    if (user?.uid) {
      loadRankings();
      loadRemainingAttempts();
    }
  }, [user?.uid]);

  // 새로고침
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadRankings(),
      loadRemainingAttempts()
    ]);
    setRefreshing(false);
  };

  // 게임 시작
  const startGame = async () => {
    if (remainingAttempts <= 0) {
      Alert.alert('알림', '오늘의 플레이 횟수를 모두 사용했습니다.');
      return;
    }
    
    if (!user?.uid) {
      Alert.alert('오류', '로그인이 필요합니다.');
      return;
    }
    
    // 게임 시작 시 횟수 차감
    try {
      const { startGamePlay } = await import('../../lib/games');
      const result = await startGamePlay(user.uid, 'typingGame');
      
      if (!result.success) {
        Alert.alert('플레이 제한', result.message || '게임을 시작할 수 없습니다.');
        loadRemainingAttempts();
        return;
      }
    } catch (error) {
      console.error('게임 시작 오류:', error);
      Alert.alert('오류', '게임을 시작할 수 없습니다.');
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

  // 입력 처리
  const handleInputChange = (value: string) => {
    const lowerValue = value.toLowerCase();
    setUserInput(lowerValue);

    // 정답 체크
    if (currentWord && lowerValue === currentWord.english.toLowerCase()) {
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
      Alert.alert('오류', '로그인이 필요합니다.');
      return;
    }

    try {
      console.log('🎮 게임 종료 - 점수:', score);
      const result = await updateGameScore(user.uid, 'typingGame', score, score);
      console.log('🎮 updateGameScore 결과:', result);
      
      // 퀘스트 트래킹: 게임 플레이 (7단계)
      try {
        await trackAction('play_game');
        console.log('✅ 퀘스트 트래킹: 게임 플레이 (타이핑)');
      } catch (questError) {
        console.error('❌ 퀘스트 트래킹 오류:', questError);
      }
      
      if (result.success) {
        if (result.leveledUp && result.oldLevel && result.newLevel) {
          console.log('🎉 레벨업!', result.oldLevel, '→', result.newLevel);
          Alert.alert(
            '🎉 레벨업!',
            `축하합니다! 레벨 ${result.oldLevel}에서 레벨 ${result.newLevel}로 레벨업했습니다!\n경험치 +${result.xpEarned} XP 획득!`,
            [{ text: '확인' }]
          );
        } else if (result.xpEarned && result.xpEarned > 0) {
          console.log('⭐ 경험치 획득:', result.xpEarned);
          Alert.alert(
            '⭐ 경험치 획득!',
            `영단어 타이핑 게임 완료!\n${score}개 정답\n경험치 +${result.xpEarned} XP 획득!`,
            [{ text: '확인' }]
          );
        } else {
          console.log('❌ 경험치 없음 - xpEarned:', result.xpEarned);
          Alert.alert(
            '게임 완료',
            `정답 개수: ${score}개\n경험치를 얻지 못했습니다.`,
            [{ text: '확인' }]
          );
        }
        
        loadRankings();
        loadRemainingAttempts();
      } else {
        console.error('❌ 게임 저장 실패:', result.message);
        Alert.alert('오류', result.message || '점수 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('게임 결과 저장 실패:', error);
      Alert.alert('오류', '게임 결과 저장 중 오류가 발생했습니다.');
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

  if (!user) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loginPrompt}>
          <Text style={styles.loginTitle}>로그인이 필요합니다</Text>
          <Text style={styles.loginDescription}>
            영단어 타이핑 게임을 플레이하려면 로그인해주세요.
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.loginButtonText}>로그인하기</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" translucent={false} />
      
      {/* 고정 헤더 */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>영단어 타이핑</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* 스크롤 가능한 컨텐츠 */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollViewContent,
          { paddingTop: insets.top + 56 }
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* 게임 영역 */}
        <View style={styles.gameArea}>
          <Text style={styles.gameDescription}>
            20초 동안 최대한 많은 단어를 입력하세요!
          </Text>
          
          {/* 남은 기회 표시 */}
          <View style={styles.attemptsContainer}>
            {isLoadingStats ? (
              <Text style={styles.loadingText}>로딩중...</Text>
            ) : (
              <>
                <Text style={styles.attemptsText}>
                  오늘 남은 기회: {remainingAttempts}/{maxAttempts}
                </Text>
                {bestScore !== null && (
                  <Text style={styles.bestScoreText}>
                    최고 기록: {bestScore}개
                  </Text>
                )}
              </>
            )}
          </View>

          {gameState === 'waiting' && (
            <View style={styles.waitingContainer}>
              <Ionicons name="chatbox-ellipses" size={64} color="#8B5CF6" style={styles.icon} />
              <Text style={styles.waitingTitle}>영단어 타이핑</Text>
              <Text style={styles.waitingDescription}>
                화면에 나타나는 영단어를 빠르게 입력하세요!
              </Text>
              <TouchableOpacity
                style={[styles.startButton, remainingAttempts <= 0 && styles.disabledButton]}
                onPress={startGame}
                disabled={remainingAttempts <= 0}
              >
                <Text style={styles.startButtonText}>
                  {remainingAttempts <= 0 ? '오늘의 기회 소진' : '게임 시작'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {gameState === 'playing' && currentWord && (
            <View style={styles.playingContainer}>
              {/* 타이머와 점수 */}
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>남은 시간</Text>
                  <Text style={[styles.statValue, timeLeft <= 5 && styles.statValueDanger]}>
                    {timeLeft}초
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>정답 수</Text>
                  <Text style={[styles.statValue, styles.statValueSuccess]}>
                    {score}개
                  </Text>
                </View>
              </View>

              {/* 단어 표시 영역 */}
              <View style={styles.wordContainer}>
                <Text style={styles.englishWord}>{currentWord.english.toLowerCase()}</Text>
                <Text style={styles.koreanWord}>{currentWord.korean}</Text>
              </View>

              {/* 입력 필드 */}
              <TextInput
                style={styles.answerInput}
                value={userInput}
                onChangeText={handleInputChange}
                placeholder="여기에 입력하세요"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
              <Text style={styles.inputHint}>💡 소문자로 입력해도 됩니다</Text>

              {/* 진행 바 */}
              <View style={styles.progressBarContainer}>
                <View
                  style={[styles.progressBar, { width: `${(timeLeft / 20) * 100}%` }]}
                />
              </View>
            </View>
          )}

          {gameState === 'finished' && (
            <View style={styles.finishedContainer}>
              <Text style={styles.finishedTitle}>게임 종료!</Text>
              <View style={styles.resultBox}>
                <Text style={styles.resultLabel}>정답 개수</Text>
                <Text style={styles.resultValue}>{score}개</Text>
              </View>
              {remainingAttempts > 0 && (
                <TouchableOpacity style={styles.playAgainButton} onPress={resetGame}>
                  <Text style={styles.playAgainText}>다시 하기</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* TOP 10 랭킹 */}
        <View style={styles.rankingContainer}>
          <Text style={styles.rankingTitle}>🏆 TOP 10 랭킹</Text>
          {rankings.length > 0 ? (
            rankings.map((rankUser, index) => (
              <View
                key={rankUser.id}
                style={[
                  styles.rankingItem,
                  user?.uid === rankUser.id && styles.myRankingItem
                ]}
              >
                <View style={styles.rankingLeft}>
                  <View style={[
                    styles.rankBadge,
                    index === 0 ? styles.goldBadge :
                    index === 1 ? styles.silverBadge :
                    index === 2 ? styles.bronzeBadge :
                    styles.defaultBadge
                  ]}>
                    <Text style={[
                      styles.rankText,
                      index < 3 ? styles.medalText : styles.defaultRankText
                    ]}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                    </Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text
                      style={[
                        styles.userName,
                        user?.uid === rankUser.id && styles.myUserName
                      ]}
                      numberOfLines={1}
                    >
                      {rankUser.nickname}
                      {user?.uid === rankUser.id && (
                        <Text style={styles.myIndicator}> (나)</Text>
                      )}
                    </Text>
                    {rankUser.schoolName && (
                      <Text style={styles.schoolName} numberOfLines={1}>{rankUser.schoolName}</Text>
                    )}
                  </View>
                </View>
                <View style={styles.rankingRight}>
                  <Text style={[
                    styles.scoreText,
                    user?.uid === rankUser.id && styles.myScoreText
                  ]}>
                    {rankUser.bestScore}개
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noDataText}>아직 랭킹 데이터가 없습니다.</Text>
          )}
        </View>

        {/* 경험치 정보 */}
        <View style={styles.xpContainer}>
          <Text style={styles.xpTitle}>⭐ 경험치 정보</Text>
          <Text style={styles.xpDescription}>
            더 많은 단어를 입력할수록 더 많은 경험치를 획득할 수 있습니다!
          </Text>
          <View style={styles.xpItem}>
            <Text style={styles.xpText}>15개 이상</Text>
            <View style={styles.xpBadge}>
              <Text style={styles.xpBadgeText}>+15 XP</Text>
            </View>
          </View>
          <View style={styles.xpItem}>
            <Text style={styles.xpText}>12-14개</Text>
            <View style={styles.xpBadge}>
              <Text style={styles.xpBadgeText}>+10 XP</Text>
            </View>
          </View>
          <View style={styles.xpItem}>
            <Text style={styles.xpText}>9-11개</Text>
            <View style={styles.xpBadge}>
              <Text style={styles.xpBadgeText}>+5 XP</Text>
            </View>
          </View>
          <View style={styles.xpItem}>
            <Text style={styles.xpText}>8개 이하</Text>
            <View style={[styles.xpBadge, styles.xpBadgeGray]}>
              <Text style={[styles.xpBadgeText, styles.xpBadgeTextGray]}>+0 XP</Text>
            </View>
          </View>
          <Text style={styles.xpTip}>
            💡 팁: 정확하고 빠르게 입력할수록 더 높은 점수를 얻을 수 있어요!
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    elevation: 10,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    zIndex: 1000,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    marginHorizontal: 8,
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  gameArea: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  gameDescription: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 15,
  },
  attemptsContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  attemptsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  bestScoreText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  waitingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  icon: {
    marginBottom: 20,
    opacity: 0.9,
  },
  waitingTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#111827',
  },
  waitingDescription: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 28,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  startButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  startButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  disabledButton: {
    opacity: 0.5,
  },
  playingContainer: {
    paddingVertical: 10,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statBox: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#8B5CF6',
  },
  statValueDanger: {
    color: '#DC2626',
  },
  statValueSuccess: {
    color: '#16A34A',
  },
  wordContainer: {
    backgroundColor: '#F3E8FF',
    borderRadius: 16,
    padding: 28,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  englishWord: {
    fontSize: 44,
    fontWeight: 'bold',
    color: '#8B5CF6',
    marginBottom: 16,
    letterSpacing: 3,
    textShadowColor: 'rgba(139, 92, 246, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  koreanWord: {
    fontSize: 22,
    color: '#6B7280',
    fontWeight: '600',
    letterSpacing: 1,
  },
  answerInput: {
    width: '100%',
    backgroundColor: 'white',
    borderWidth: 3,
    borderColor: '#A78BFA',
    borderRadius: 12,
    padding: 18,
    fontSize: 30,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#111827',
    marginBottom: 8,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  inputHint: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#8B5CF6',
  },
  finishedContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  finishedTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  resultBox: {
    backgroundColor: '#F3E8FF',
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  resultLabel: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  resultValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#8B5CF6',
  },
  playAgainButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  playAgainText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  rankingContainer: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2.22,
    elevation: 3,
  },
  rankingTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  rankingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  rankingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  goldBadge: {
    backgroundColor: '#EAB308',
  },
  silverBadge: {
    backgroundColor: '#9CA3AF',
  },
  bronzeBadge: {
    backgroundColor: '#D97706',
  },
  defaultBadge: {
    backgroundColor: '#F3F4F6',
  },
  rankText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  medalText: {
    fontSize: 12,
  },
  defaultRankText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  userInfo: {
    flex: 1,
    marginRight: 8,
  },
  userName: {
    fontSize: 14,
    fontWeight: '500',
  },
  schoolName: {
    fontSize: 12,
    color: '#6B7280',
  },
  rankingRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
    minWidth: 60,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  noDataText: {
    textAlign: 'center',
    color: '#6B7280',
    paddingVertical: 20,
  },
  myRankingItem: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: 8,
    marginHorizontal: -8,
    paddingHorizontal: 8,
  },
  myUserName: {
    color: '#1d4ed8',
    fontWeight: 'bold',
  },
  myIndicator: {
    color: '#2563eb',
    fontSize: 12,
  },
  myScoreText: {
    color: '#1d4ed8',
  },
  xpContainer: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2.22,
    elevation: 3,
  },
  xpTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  xpDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  xpItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  xpText: {
    fontSize: 14,
    color: '#4B5563',
  },
  xpBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  xpBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  xpBadgeGray: {
    backgroundColor: '#F3F4F6',
  },
  xpBadgeTextGray: {
    color: '#6B7280',
  },
  xpTip: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 12,
    textAlign: 'center',
  },
  loginPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loginTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  loginDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});


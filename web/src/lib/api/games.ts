import { doc, getDoc, updateDoc, increment, FieldValue } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from '@/types';
import { updateUserExperience, getSystemSettings } from '@/lib/experience';
import { getKoreanDateString } from '@/lib/utils';

export type GameType = 'reactionGame' | 'tileGame' | 'flappyBird' | 'mathGame' | 'typingGame';

export interface GameResult {
  success: boolean;
  message?: string;
  xpEarned?: number;
  leveledUp?: boolean;
  oldLevel?: number;
  newLevel?: number;
  remainingAttempts?: number;
}

export interface GameStatsResponse {
  success: boolean;
  message?: string;
  data?: {
    todayPlays: Record<GameType, number>;
    maxPlays: number;
    bestReactionTimes: Record<GameType, number | null>;
    totalXpEarned: number;
  };
}

// 게임 타입별 경험치 계산 (Firebase 설정 기반)
const calculateGameXP = async (gameType: GameType, value: number): Promise<number> => {
  try {
    console.log('calculateGameXP - gameType:', gameType, 'value:', value);
    
    // 게임 타입에 따라 적절한 경험치 계산
    if (gameType === 'reactionGame') {
      // 반응속도 게임은 기존 로직 유지 (반응시간 기반)
      const settings = await getSystemSettings();
      if (settings.gameSettings.reactionGame.thresholds) {
        const thresholds = settings.gameSettings.reactionGame.thresholds;
        const sortedThresholds = [...thresholds].sort((a, b) => a.minScore - b.minScore);
        
        for (const threshold of sortedThresholds) {
          if (value <= threshold.minScore) {
            console.log(`calculateGameXP - 반응속도 게임 경험치 ${threshold.xpReward} 지급! (${value}ms <= ${threshold.minScore}ms)`);
            return threshold.xpReward;
          }
        }
      }
    } else if (gameType === 'tileGame') {
      // 타일 게임은 움직임 횟수 기반으로 경험치 계산
      console.log(`calculateGameXP - 타일 게임 움직임 횟수: ${value}번`);
      
      if (value <= 7) {
        console.log('calculateGameXP - 타일 게임 15 XP 지급! (7번 이하)');
        return 15;
      } else if (value <= 10) {
        console.log('calculateGameXP - 타일 게임 10 XP 지급! (8-10번)');
        return 10;
      } else if (value <= 13) {
        console.log('calculateGameXP - 타일 게임 5 XP 지급! (11-13번)');
        return 5;
      } else {
        console.log('calculateGameXP - 타일 게임 0 XP 지급! (14번 이상)');
        return 0;
      }
    } else if (gameType === 'flappyBird') {
      // flappyBird는 기본 경험치 반환
      const settings = await getSystemSettings();
      return settings.gameSettings.flappyBird.rewardAmount;
    } else if (gameType === 'mathGame') {
      // 빠른 계산 게임은 정답 개수 기반으로 경험치 계산 (Firebase 설정 사용)
      console.log(`calculateGameXP - 빠른 계산 게임 정답 개수: ${value}개`);
      
      const settings = await getSystemSettings();
      if (settings.gameSettings.mathGame?.thresholds) {
        const thresholds = settings.gameSettings.mathGame.thresholds;
        const sortedThresholds = [...thresholds].sort((a, b) => b.minScore - a.minScore);
        
        for (const threshold of sortedThresholds) {
          if (value >= threshold.minScore) {
            console.log(`calculateGameXP - 빠른 계산 게임 경험치 ${threshold.xpReward} 지급! (${value}개 >= ${threshold.minScore}개)`);
            return threshold.xpReward;
          }
        }
      }
      
      console.log('calculateGameXP - 빠른 계산 게임 0 XP 지급! (모든 threshold 미달)');
      return 0;
    } else if (gameType === 'typingGame') {
      // 영단어 타이핑 게임은 정답 개수 기반으로 경험치 계산 (Firebase 설정 사용)
      console.log(`calculateGameXP - 영단어 타이핑 게임 정답 개수: ${value}개`);
      
      const settings = await getSystemSettings();
      if (settings.gameSettings.typingGame?.thresholds) {
        const thresholds = settings.gameSettings.typingGame.thresholds;
        const sortedThresholds = [...thresholds].sort((a, b) => b.minScore - a.minScore);
        
        for (const threshold of sortedThresholds) {
          if (value >= threshold.minScore) {
            console.log(`calculateGameXP - 영단어 타이핑 게임 경험치 ${threshold.xpReward} 지급! (${value}개 >= ${threshold.minScore}개)`);
            return threshold.xpReward;
          }
        }
      }
      
      console.log('calculateGameXP - 영단어 타이핑 게임 0 XP 지급! (모든 threshold 미달)');
      return 0;
    }
    
    console.log('calculateGameXP - 0 XP 반환');
    return 0;
  } catch (error) {
    console.error('경험치 계산 중 오류:', error);
    return 0;
  }
};

// 게임 시작 시 플레이 횟수 차감
export const startGamePlay = async (userId: string, gameType: GameType): Promise<GameResult> => {
  try {
    // 캐시 무효화하여 최신 Firebase 설정 가져오기
    const { invalidateSystemSettingsCache, checkDailyLimit } = await import('../experience');
    invalidateSystemSettingsCache();
    
    // 플레이 전 일일 제한 확인
    const limitCheck = await checkDailyLimit(userId, 'games', gameType);
    if (!limitCheck.canEarnExp) {
      return {
        success: false,
        message: `오늘의 ${gameType} 플레이 횟수를 모두 사용했습니다. (${limitCheck.currentCount}/${limitCheck.limit})`
      };
    }
    
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return {
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      };
    }
    
    // 일일 플레이 카운트 증가 (게임 시작 시)
    const updateData: Record<string, FieldValue> = {
      [`activityLimits.dailyCounts.games.${gameType}`]: increment(1)
    };
    
    await updateDoc(userRef, updateData);
    
    return {
      success: true,
      message: '게임을 시작합니다.'
    };
    
  } catch (error) {
    console.error('게임 시작 실패:', error);
    return {
      success: false,
      message: '게임 시작 중 오류가 발생했습니다.'
    };
  }
};

// 게임 점수 업데이트 및 경험치 지급 (횟수 차감은 startGamePlay에서 이미 처리됨)
export const updateGameScore = async (userId: string, gameType: GameType, score: number, reactionTime?: number): Promise<GameResult> => {
  try {
    // 캐시 무효화하여 최신 Firebase 설정 가져오기
    const { invalidateSystemSettingsCache } = await import('../experience');
    invalidateSystemSettingsCache();
    
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return {
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      };
    }

    const userData = userDoc.data() as User;
    
    // 최고 기록 확인
    // - 반응속도 게임: bestReactionTime (낮을수록 좋음)
    // - 타일 게임: bestMoves (낮을수록 좋음)
    // - 계산/타이핑 게임: bestReactionTime (높을수록 좋음, 점수)
    const currentBestReactionTime = userData.gameStats?.[gameType]?.bestReactionTime || null;
    const currentBestMoves = userData.gameStats?.tileGame?.bestMoves || null;
    
    const isBestReactionTime = gameType === 'reactionGame' && reactionTime && 
      (currentBestReactionTime === null || reactionTime < currentBestReactionTime);
    const isBestMoves = gameType === 'tileGame' && score && 
      (currentBestMoves === null || score < currentBestMoves);
    const isHighScore = (gameType === 'mathGame' || gameType === 'typingGame') && score && 
      (currentBestReactionTime === null || score > currentBestReactionTime);
    
    // 게임 통계 업데이트
    const updateData: Record<string, number | string | FieldValue> = {};
    
    // 각 게임 타입에 맞는 필드 업데이트
    if (isBestReactionTime && reactionTime) {
      // 반응속도 게임: bestReactionTime
      updateData[`gameStats.${gameType}.bestReactionTime`] = reactionTime;
    } else if (isBestMoves && score) {
      // 타일 게임: bestMoves (움직임 횟수)
      updateData[`gameStats.tileGame.bestMoves`] = score;
    } else if (isHighScore && score) {
      // 계산/타이핑 게임: bestReactionTime에 점수 저장
      updateData[`gameStats.${gameType}.bestReactionTime`] = score;
    }
    
    // Firestore 업데이트 (일일 플레이 카운트는 startGamePlay에서 이미 증가시킴)
    if (Object.keys(updateData).length > 0) {
      await updateDoc(userRef, updateData);
    }
    
    // 경험치 계산 및 지급 (반응시간 또는 움직임 횟수 기반)
    const xpEarned = await calculateGameXP(gameType, reactionTime || score || 1000);
    
    let result: { leveledUp: boolean; oldLevel?: number; newLevel?: number } = { 
      leveledUp: false, 
      oldLevel: undefined, 
      newLevel: undefined 
    };
    
    if (xpEarned > 0) {
      result = await updateUserExperience(userId, xpEarned);
    }
    
    return {
      success: true,
      leveledUp: result.leveledUp,
      oldLevel: result.oldLevel,
      newLevel: result.newLevel,
      xpEarned,
      message: '게임 점수가 성공적으로 저장되었습니다.'
    };
    
  } catch (error) {
    console.error('게임 점수 업데이트 실패:', error);
    return {
      success: false,
      message: '점수 저장 중 오류가 발생했습니다.'
    };
  }
};

// 사용자 게임 통계 조회
export const getUserGameStats = async (userId: string): Promise<GameStatsResponse> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return {
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      };
    }
    
    const userData = userDoc.data() as User;
    const today = getKoreanDateString(); // 한국 시간 기준 날짜 사용
    
    // 날짜 체크 - 새로운 날이거나 데이터가 없으면 기본값 반환
    const activityLimits = userData.activityLimits;
    const isNewDay = !activityLimits || activityLimits.lastResetDate !== today;
    
    // 오늘 플레이 횟수 (새로운 날이면 모두 0으로 초기화)
    const todayPlays = isNewDay ? {
      flappyBird: 0,
      reactionGame: 0,
      tileGame: 0,
      mathGame: 0,
      typingGame: 0,
    } : {
      flappyBird: activityLimits.dailyCounts?.games?.flappyBird || 0,
      reactionGame: activityLimits.dailyCounts?.games?.reactionGame || 0,
      tileGame: activityLimits.dailyCounts?.games?.tileGame || 0,
      mathGame: activityLimits.dailyCounts?.games?.mathGame || 0,
      typingGame: activityLimits.dailyCounts?.games?.typingGame || 0,
    };
    
    // 최저 반응시간 및 최고 점수
    const bestReactionTimes = {
      flappyBird: userData.gameStats?.flappyBird?.bestReactionTime || null,
      reactionGame: userData.gameStats?.reactionGame?.bestReactionTime || null,
      tileGame: userData.gameStats?.tileGame?.bestReactionTime || null,
      mathGame: userData.gameStats?.mathGame?.bestReactionTime || null,
      typingGame: userData.gameStats?.typingGame?.bestReactionTime || null,
    };
    
    // 일일 최대 플레이 횟수 (시스템 설정에서 가져오기)
    const { getSystemSettings } = await import('../experience');
    const settings = await getSystemSettings();
    const maxPlays = settings.dailyLimits.gamePlayCount;
    
    // 게임별 획득 가능한 경험치 계산
    let totalXpEarned = 0;
    
    // 반응속도 게임 경험치 계산
    if (bestReactionTimes.reactionGame) {
      const reactionXp = await calculateGameXP('reactionGame', bestReactionTimes.reactionGame);
      totalXpEarned += reactionXp;
    }
    
    // 타일 게임 경험치 계산
    if (bestReactionTimes.tileGame) {
      const tileXp = await calculateGameXP('tileGame', bestReactionTimes.tileGame);
      totalXpEarned += tileXp;
    }
    
    // FlappyBird 게임 경험치 계산
    if (bestReactionTimes.flappyBird) {
      const flappyXp = await calculateGameXP('flappyBird', bestReactionTimes.flappyBird);
      totalXpEarned += flappyXp;
    }
    
    // 빠른 계산 게임 경험치 계산
    if (bestReactionTimes.mathGame) {
      const mathXp = await calculateGameXP('mathGame', bestReactionTimes.mathGame);
      totalXpEarned += mathXp;
    }
    
    return {
      success: true,
      data: {
        todayPlays,
        maxPlays,
        bestReactionTimes,
        totalXpEarned
      }
    };
    
  } catch (error) {
    console.error('게임 통계 조회 실패:', error);
    return {
      success: false,
      message: '게임 통계를 불러오는 중 오류가 발생했습니다.'
    };
  }
}; 
import { communityCommand } from './community-client';
import { doc, getDoc, updateDoc, serverTimestamp, increment, collection, query, where, orderBy, limit, getDocs, FieldValue, getCountFromServer } from 'firebase/firestore';
import { db } from './firebase';
import { User, SystemSettings } from '../types';
import { getKoreanDateString } from '../utils/timeUtils';

// 레벨별 필요 경험치 (1→2레벨 10exp, 2→3레벨 20exp, 오름차순)
// 각 레벨에서 다음 레벨로 가기 위해 필요한 경험치
// 패턴: 레벨 * 10 (100레벨까지 확장)
export const LEVEL_REQUIREMENTS: Record<number, number> = (() => {
  const requirements: Record<number, number> = {};
  for (let level = 1; level <= 100; level++) {
    requirements[level] = level * 10;
  }
  return requirements;
})();

// 레벨별 누적 경험치 (총 경험치로 레벨 계산용)
// 100레벨까지 자동 계산
export const CUMULATIVE_REQUIREMENTS: Record<number, number> = (() => {
  const cumulative: Record<number, number> = { 1: 0 };
  let totalExp = 0;
  
  for (let level = 1; level <= 100; level++) {
    if (level > 1) {
      totalExp += LEVEL_REQUIREMENTS[level - 1];
      cumulative[level] = totalExp;
    }
  }
  
  return cumulative;
})();

/**
 * 시스템 설정 캐시 무효화
 */
export const invalidateSystemSettingsCache = () => {
  console.log('invalidateSystemSettingsCache - 캐시 무효화');
  cachedSystemSettings = null;
};

/**
 * 시스템 설정 가져오기
 */
let cachedSystemSettings: SystemSettings | null = null;

export const getSystemSettings = async (): Promise<SystemSettings> => {
  // 캐시가 있으면 반환하되, 디버깅을 위해 로그 출력
  if (cachedSystemSettings) {
    console.log('getSystemSettings - 캐시된 설정 사용:', cachedSystemSettings);
    return cachedSystemSettings;
  }
  
  console.log('getSystemSettings - Firebase에서 새로운 설정 로드 시도');
  
  try {
    // Firebase의 실제 experienceSettings 문서 읽기
    const experienceSettingsDoc = await getDoc(doc(db, 'system', 'experienceSettings'));
    
    if (experienceSettingsDoc.exists()) {
      const firebaseSettings = experienceSettingsDoc.data();
      console.log('getSystemSettings - Firebase settings loaded:', firebaseSettings);
      
      // Firebase 구조를 코드 구조로 변환
      cachedSystemSettings = {
        experience: {
          postReward: firebaseSettings.community?.postXP || 10,
          commentReward: firebaseSettings.community?.commentXP || 5,
          likeReward: firebaseSettings.community?.likeXP || 1,
          attendanceReward: firebaseSettings.attendance?.dailyXP || 10, // Firestore와 맞춤
          attendanceStreakReward: firebaseSettings.attendance?.streakBonus || 5, // Firestore와 맞춤
          referralReward: firebaseSettings.referral?.referrerXP || 30, // Firestore와 맞춤
          levelRequirements: LEVEL_REQUIREMENTS
        },
        dailyLimits: {
          postsForReward: firebaseSettings.community?.dailyPostLimit || 3,
          commentsForReward: firebaseSettings.community?.dailyCommentLimit || 5,
          gamePlayCount: Math.max(
            firebaseSettings.games?.reactionGame?.dailyLimit || 5,
            firebaseSettings.games?.tileGame?.dailyLimit || 5,
            firebaseSettings.games?.mathGame?.dailyLimit || 5,
            firebaseSettings.games?.typingGame?.dailyLimit || 5
          ) // 게임 중 가장 높은 제한 사용
        },
        gameSettings: {
          reactionGame: {
            enabled: firebaseSettings.games?.reactionGame?.enabled ?? true,
            dailyLimit: firebaseSettings.games?.reactionGame?.dailyLimit || 5,
            rewardThreshold: 100, // 최소 점수 (Firestore thresholds의 최소값)
            rewardAmount: 15, // 기본 보상
            thresholds: firebaseSettings.games?.reactionGame?.thresholds || [
              { minScore: 100, xpReward: 15 },
              { minScore: 200, xpReward: 10 },
              { minScore: 300, xpReward: 5 }
            ]
          },
          tileGame: {
            enabled: firebaseSettings.games?.tileGame?.enabled ?? true,
            dailyLimit: firebaseSettings.games?.tileGame?.dailyLimit || 5,
            rewardThreshold: 7, // 최소 움직임 (7번 이하부터 경험치)
            rewardAmount: 15, // 기본 보상
            thresholds: firebaseSettings.games?.tileGame?.thresholds || [
              { minScore: 7, xpReward: 15 },
              { minScore: 10, xpReward: 10 },
              { minScore: 13, xpReward: 5 }
            ]
          },
          flappyBird: {
            rewardThreshold: 10,
            rewardAmount: 25
          },
          mathGame: {
            enabled: firebaseSettings.games?.mathGame?.enabled ?? true,
            dailyLimit: firebaseSettings.games?.mathGame?.dailyLimit || 5,
            thresholds: firebaseSettings.games?.mathGame?.thresholds || [
              { minScore: 15, xpReward: 15 },
              { minScore: 12, xpReward: 10 },
              { minScore: 9, xpReward: 5 }
            ]
          },
          typingGame: {
            enabled: firebaseSettings.games?.typingGame?.enabled ?? true,
            dailyLimit: firebaseSettings.games?.typingGame?.dailyLimit || 5,
            thresholds: firebaseSettings.games?.typingGame?.thresholds || [
              { minScore: 15, xpReward: 15 },
              { minScore: 12, xpReward: 10 },
              { minScore: 9, xpReward: 5 }
            ]
          }
        },
        ads: {
          rewardedVideo: {
            gameExtraPlays: 3,
            cooldownMinutes: 30,
            experienceReward: firebaseSettings.ads?.rewardedVideo?.experienceReward || 30,
            dailyLimit: firebaseSettings.ads?.rewardedVideo?.dailyLimit || 5
          }
        },
        appVersion: {
          current: '1.0.0',
          minimum: '1.0.0',
          forceUpdate: false
        },
        maintenance: {
          isActive: false
        },
        // Firebase 설정 추가
        attendanceBonus: {
          weeklyBonusXP: firebaseSettings.attendance?.weeklyBonusXP || 50,
          streakBonus: firebaseSettings.attendance?.streakBonus || 5
        }
      };
      
      console.log('getSystemSettings - Cached settings created:', cachedSystemSettings);
      return cachedSystemSettings;
    } else {
      console.log('getSystemSettings - Firebase settings document not found, using defaults');
    }
  } catch (error) {
    console.error('getSystemSettings - Error loading Firebase settings:', error);
  }
  
  // 기본값 반환 (Firestore 설정과 동일하게)
  return {
    experience: {
      postReward: 10,
      commentReward: 5,
      likeReward: 1,
      attendanceReward: 10,
      attendanceStreakReward: 5,
      referralReward: 30,
      levelRequirements: LEVEL_REQUIREMENTS
    },
    dailyLimits: {
      postsForReward: 3,
      commentsForReward: 5,
      gamePlayCount: 5
    },
    gameSettings: {
      reactionGame: {
        enabled: true,
        dailyLimit: 5,
        rewardThreshold: 100,
        rewardAmount: 15,
        thresholds: [
          { minScore: 100, xpReward: 15 },
          { minScore: 200, xpReward: 10 },
          { minScore: 300, xpReward: 5 }
        ]
      },
      tileGame: {
        enabled: true,
        dailyLimit: 3,
        rewardThreshold: 7,
        rewardAmount: 15,
        thresholds: [
          { minScore: 7, xpReward: 15 },
          { minScore: 10, xpReward: 10 },
          { minScore: 13, xpReward: 5 }
        ]
      },
      flappyBird: {
        rewardThreshold: 10,
        rewardAmount: 25
      }
    },
    ads: {
      rewardedVideo: {
        gameExtraPlays: 3,
        cooldownMinutes: 30,
        experienceReward: 30,
        dailyLimit: 5
      }
    },
    appVersion: {
      current: '1.0.0',
      minimum: '1.0.0',
      forceUpdate: false
    },
    maintenance: {
      isActive: false
    },
    attendanceBonus: {
      weeklyBonusXP: 50,
      streakBonus: 5
    }
  };
};

/**
 * 레벨에 따른 필요 경험치 계산 (시스템 설정 기반)
 */
export const calculateRequiredExpForLevel = async (targetLevel: number): Promise<number> => {
  const settings = await getSystemSettings();
  return settings.experience.levelRequirements[targetLevel] || (targetLevel - 1) * targetLevel * 5;
};

/**
 * 현재 레벨에서 다음 레벨로 가기 위한 필요 경험치
 */
export const calculateExpToNextLevel = async (currentLevel: number): Promise<number> => {
  const currentLevelExp = await calculateRequiredExpForLevel(currentLevel);
  const nextLevelExp = await calculateRequiredExpForLevel(currentLevel + 1);
  return nextLevelExp - currentLevelExp;
};

/**
 * 총 경험치에서 현재 레벨 계산
 */
export const calculateLevelFromTotalExp = (totalExp: number): number => {
  let level = 1;
  
  // 100레벨까지 확인
  for (let checkLevel = 1; checkLevel <= 100; checkLevel++) {
    const requiredExp = CUMULATIVE_REQUIREMENTS[checkLevel];
    if (totalExp >= requiredExp) {
      level = checkLevel;
    } else {
      break;
    }
  }
  
  // 최대 레벨 제한
  return Math.min(level, 100);
};

/**
 * 현재 레벨에서 다음 레벨로 가기 위해 필요한 경험치
 */
export const getExpRequiredForNextLevel = (currentLevel: number): number => {
  // 100레벨이 최대이므로 100레벨에서는 다음 레벨이 없음
  if (currentLevel >= 100) {
    return 0;
  }
  return LEVEL_REQUIREMENTS[currentLevel] || (currentLevel * 10);
};

/**
 * 현재 레벨에서의 경험치 진행률 계산
 */
export const calculateCurrentLevelProgress = (totalExp: number): {
  level: number;
  currentExp: number;
  expToNextLevel: number;
  currentLevelRequiredXp: number;
  progressPercentage: number;
} => {
  const level = calculateLevelFromTotalExp(totalExp);
  const currentLevelStartExp = CUMULATIVE_REQUIREMENTS[level] || 0;
  const currentExp = totalExp - currentLevelStartExp;
  const currentLevelRequiredXp = getExpRequiredForNextLevel(level);
  
  // 100레벨(최대 레벨)에 도달한 경우
  if (level >= 100) {
    return {
      level: 100,
      currentExp: totalExp - (CUMULATIVE_REQUIREMENTS[100] || 0),
      expToNextLevel: 0,
      currentLevelRequiredXp: 0,
      progressPercentage: 100
    };
  }
  
  const expToNextLevel = currentLevelRequiredXp - currentExp;
  const progressPercentage = currentLevelRequiredXp > 0 
    ? Math.min(100, Math.floor((currentExp / currentLevelRequiredXp) * 100))
    : 100;
  
  return {
    level,
    currentExp,
    expToNextLevel: Math.max(0, expToNextLevel),
    currentLevelRequiredXp,
    progressPercentage
  };
};

/**
 * 레벨업 체크 및 처리
 */
export const checkLevelUp = (currentLevel: number, currentExp: number, currentLevelRequiredXp: number): {
  shouldLevelUp: boolean;
  newLevel: number;
  newCurrentExp: number;
  newCurrentLevelRequiredXp: number;
} => {
  let newLevel = currentLevel;
  let newCurrentExp = currentExp;
  let newCurrentLevelRequiredXp = currentLevelRequiredXp;
  let shouldLevelUp = false;
  
  // 레벨업 조건: 현재 경험치가 필요 경험치보다 크거나 같을 때
  // 최대 레벨(100레벨) 제한
  while (newCurrentExp >= newCurrentLevelRequiredXp && newLevel < 100) {
    shouldLevelUp = true;
    newCurrentExp -= newCurrentLevelRequiredXp; // 레벨업 후 남은 경험치
    newLevel++;
    newCurrentLevelRequiredXp = getExpRequiredForNextLevel(newLevel);
  }
  
  // 100레벨에 도달한 경우
  if (newLevel >= 100) {
    newLevel = 100;
    newCurrentLevelRequiredXp = 0;
  }
  
  return {
    shouldLevelUp,
    newLevel,
    newCurrentExp,
    newCurrentLevelRequiredXp
  };
};

/**
 * 일일 활동 제한 확인
 */
export const checkDailyLimit = async (userId: string, activityType: 'posts' | 'comments' | 'games', gameType?: string): Promise<{
  canEarnExp: boolean;
  currentCount: number;
  limit: number;
  resetTime: Date;
}> => {
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.exists()) {
    throw new Error('사용자를 찾을 수 없습니다.');
  }
  
  const userData = userDoc.data() as User;
  const settings = await getSystemSettings();
  
  const today = getKoreanDateString(); // 한국 시간 기준 날짜 사용
  const activityLimits = userData.activityLimits;
  
  // 오늘 첫 활동이거나 날짜가 바뀐 경우
  if (!activityLimits || activityLimits.lastResetDate !== today) {
    // 일일 제한 리셋 수행
    await resetDailyLimits(userId, today);
    
    // 다음 리셋 시간 계산 (다음 날 00:00 KST)
    const now = new Date();
    const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const resetTime = new Date(koreaTime);
    resetTime.setUTCHours(15, 0, 0, 0); // 한국시간 00:00 = UTC 15:00
    resetTime.setUTCDate(resetTime.getUTCDate() + 1);
    
    return {
      canEarnExp: true,
      currentCount: 0,
      limit: settings.dailyLimits[activityType === 'posts' ? 'postsForReward' : 
                                 activityType === 'comments' ? 'commentsForReward' : 'gamePlayCount'],
      resetTime
    };
  }
  
  // 현재 카운트 확인
  let currentCount = 0;
  let limit = 0;
  
  if (activityType === 'posts') {
    currentCount = activityLimits.dailyCounts.posts || 0;
    limit = settings.dailyLimits.postsForReward;
  } else if (activityType === 'comments') {
    currentCount = activityLimits.dailyCounts.comments || 0;
    limit = settings.dailyLimits.commentsForReward;
  } else if (activityType === 'games') {
    if (gameType) {
      // 특정 게임 타입의 카운트만 (타입 안전성 검증)
      if (gameType === 'flappyBird' || gameType === 'reactionGame' || gameType === 'tileGame' || gameType === 'mathGame' || gameType === 'typingGame') {
        currentCount = activityLimits.dailyCounts.games?.[gameType] || 0;
      } else {
        console.warn('Invalid game type:', gameType);
        currentCount = 0;
      }
    } else {
      // 모든 게임 타입의 합계
      const gamesCounts = activityLimits.dailyCounts.games || {};
      currentCount = (gamesCounts.flappyBird || 0) + (gamesCounts.reactionGame || 0) + (gamesCounts.tileGame || 0) + (gamesCounts.mathGame || 0) + (gamesCounts.typingGame || 0);
    }
    limit = settings.dailyLimits.gamePlayCount;
  }
  
  // 다음 리셋 시간 계산
  const now = new Date();
  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const resetTime = new Date(koreaTime);
  resetTime.setUTCHours(15, 0, 0, 0); // 한국시간 00:00 = UTC 15:00
  resetTime.setUTCDate(resetTime.getUTCDate() + 1);
  
  return {
    canEarnExp: currentCount < limit,
    currentCount,
    limit,
    resetTime
  };
};

/**
 * 일일 제한 데이터 리셋
 */
export const resetDailyLimits = async (userId: string, today: string): Promise<void> => {
  // Daily accounting and XP are maintained atomically by the server.
  return;
};

/**
 * 활동 카운트 업데이트 (단순화된 버전)
 * 접속 시점에 이미 리셋되었으므로 단순히 카운트만 증가
 */
export const updateActivityCount = async (userId: string, activityType: 'posts' | 'comments', gameType?: 'flappyBird' | 'reactionGame' | 'tileGame' | 'mathGame' | 'typingGame'): Promise<void> => {
  const userRef = doc(db, 'users', userId);
  
  const userDoc = await getDoc(userRef);
  if (!userDoc.exists()) return;
  
  // 활동 카운트 증가만 수행 (날짜 체크 불필요)
  const updateData: Record<string, FieldValue> = {};
  
  if (activityType === 'posts') {
    updateData[`activityLimits.dailyCounts.posts`] = increment(1);
  } else if (activityType === 'comments') {
    updateData[`activityLimits.dailyCounts.comments`] = increment(1);
  }
  
  if (gameType) {
    updateData[`activityLimits.dailyCounts.games.${gameType}`] = increment(1);
  }
  
  await updateDoc(userRef, updateData);
};

/**
 * 경험치 지급 함수
 */
export const awardExperience = async (
  userId: string, 
  activityType: 'post' | 'comment' | 'like' | 'attendance' | 'attendanceStreak' | 'referral' | 'game',
  amount?: number,
  gameType?: 'flappyBird' | 'reactionGame' | 'tileGame',
  gameScore?: number
): Promise<{
  success: boolean;
  expAwarded: number;
  leveledUp: boolean;
  oldLevel?: number;
  newLevel?: number;
  reason?: string;
}> => {
  return communityCommand('reward.claim', { activityType }, userId);
};

/**
 * 사용자 경험치 데이터 동기화 (기존 데이터 마이그레이션용)
 */
export const syncUserExperienceData = async (userId: string): Promise<void> => {
  // Daily accounting and XP are maintained atomically by the server.
  return;
};

/**
 * 사용자 경험치 업데이트 및 레벨업 처리 (완전히 새로운 로직)
 */
export const updateUserExperience = async (
  userId: string, 
  xp: number
): Promise<{ 
  leveledUp: boolean; 
  oldLevel?: number; 
  newLevel?: number; 
  userData?: User 
}> => {
  if (!xp) return { leveledUp: false };
  
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }
    
    const userData = userDoc.data() as User;
    const currentLevel = userData.stats?.level || 1;
    const totalExperience = userData.stats?.totalExperience || 0;
    
    // 새로운 총 경험치 계산
    const newTotalExperience = totalExperience + xp;
    
    // 새로운 총 경험치 기준으로 레벨과 현재 경험치 계산
    const progress = calculateCurrentLevelProgress(newTotalExperience);
    
    // 데이터 업데이트
    const updateData = {
      'stats.totalExperience': newTotalExperience,
      'stats.level': progress.level,
      'stats.currentExp': progress.currentExp,
      'stats.currentLevelRequiredXp': progress.currentLevelRequiredXp,
      // 'stats.experience': newTotalExperience, // experience 필드 제거
      'updatedAt': serverTimestamp()
    };
    
    await updateDoc(userRef, updateData);
    
    const leveledUp = progress.level > currentLevel;
    
    if (leveledUp) {
      console.log(`🎉 사용자 ${userId}가 레벨 ${currentLevel}에서 레벨 ${progress.level}로 레벨업했습니다!`);
    }
    
    console.log(`✨ 사용자 ${userId}에게 ${xp} 경험치가 추가되었습니다. (총 ${newTotalExperience}XP, 레벨 ${progress.level}, 현재 ${progress.currentExp}/${progress.currentLevelRequiredXp})`);
    
    // 업데이트된 사용자 데이터 조회
    const updatedUserDoc = await getDoc(userRef);
    const updatedUserData = updatedUserDoc.data() as User;
    
    return { 
      leveledUp: leveledUp, 
      oldLevel: currentLevel, 
      newLevel: progress.level, 
      userData: updatedUserData 
    };
    
  } catch (error) {
    console.error('경험치 업데이트 실패:', error);
    throw error;
  }
};

/**
 * 랭킹 데이터 조회
 */
export const getRankingData = async (
  type: 'global' | 'school' | 'region',
  schoolId?: string,
  sido?: string,
  sigungu?: string,
  limitCount: number = 100
): Promise<{
  rank: number;
  userId: string;
  displayName: string;
  schoolName?: string;
  level: number;
  totalExperience: number;
  profileImageUrl?: string;
}[]> => {
  try {
    let usersQuery;
    
    if (type === 'school' && schoolId) {
      usersQuery = query(
        collection(db, 'publicProfiles'),
        where('school.id', '==', schoolId),
        orderBy('stats.totalExperience', 'desc'),
        limit(limitCount)
      );
    } else if (type === 'region' && sido) {
      if (sigungu) {
        usersQuery = query(
          collection(db, 'publicProfiles'),
          where('regions.sido', '==', sido),
          where('regions.sigungu', '==', sigungu),
          orderBy('stats.totalExperience', 'desc'),
          limit(limitCount)
        );
      } else {
        usersQuery = query(
          collection(db, 'publicProfiles'),
          where('regions.sido', '==', sido),
          orderBy('stats.totalExperience', 'desc'),
          limit(limitCount)
        );
      }
    } else {
      // 전체 랭킹
      usersQuery = query(
        collection(db, 'publicProfiles'),
        orderBy('stats.totalExperience', 'desc'),
        limit(limitCount)
      );
    }
    
    const querySnapshot = await getDocs(usersQuery);
    const rankingData: {
      rank: number;
      userId: string;
      displayName: string;
      schoolName?: string;
      level: number;
      totalExperience: number;
      profileImageUrl?: string;
    }[] = [];
    
    querySnapshot.docs.forEach((doc, index) => {
      const userData = doc.data() as User;
      rankingData.push({
        rank: index + 1,
        userId: doc.id,
        displayName: userData.profile.userName,
        schoolName: userData.school?.name,
        level: userData.stats?.level || 1,
        totalExperience: userData.stats?.totalExperience || 0,
        profileImageUrl: userData.profile.profileImageUrl
      });
    });
    
    return rankingData;
  } catch (error) {
    console.error('랭킹 데이터 조회 실패:', error);
    return [];
  }
};

/**
 * 사용자의 현재 랭킹 조회
 */
export const getUserRank = async (
  userId: string,
  type: 'global' | 'school' | 'region',
  schoolId?: string,
  sido?: string,
  sigungu?: string
): Promise<number | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'publicProfiles', userId));
    if (!userDoc.exists()) return null;
    
    const userData = userDoc.data() as User;
    const userExp = userData.stats?.totalExperience || 0;
    
    let usersQuery;
    
    if (type === 'school' && schoolId) {
      usersQuery = query(
        collection(db, 'publicProfiles'),
        where('school.id', '==', schoolId),
        where('stats.totalExperience', '>', userExp)
      );
    } else if (type === 'region' && sido) {
      if (sigungu) {
        usersQuery = query(
          collection(db, 'publicProfiles'),
          where('regions.sido', '==', sido),
          where('regions.sigungu', '==', sigungu),
          where('stats.totalExperience', '>', userExp)
        );
      } else {
        usersQuery = query(
          collection(db, 'publicProfiles'),
          where('regions.sido', '==', sido),
          where('stats.totalExperience', '>', userExp)
        );
      }
    } else {
      // 전체 랭킹
      usersQuery = query(
        collection(db, 'publicProfiles'),
        where('stats.totalExperience', '>', userExp)
      );
    }
    
    const querySnapshot = await getDocs(usersQuery);
    return querySnapshot.size + 1; // 자신보다 높은 사람 수 + 1 = 자신의 순위
    
  } catch (error) {
    console.error('사용자 랭킹 조회 실패:', error);
    return null;
  }
};

/**
 * 관리자용 경험치 설정 관리 API
 */

// 경험치 설정 타입 정의
export interface ExperienceSettings {
  community: {
    postXP: number;
    commentXP: number;
    likeXP: number;
    dailyPostLimit: number;
    dailyCommentLimit: number;
    dailyLikeLimit: number;
  };
  games: {
    reactionGame: {
      enabled: boolean;
      dailyLimit: number;
      thresholds: {
        minScore: number;
        xpReward: number;
      }[];
    };
    tileGame: {
      enabled: boolean;
      dailyLimit: number;
      thresholds: {
        minScore: number;
        xpReward: number;
      }[];
    };
  };

  attendance: {
    dailyXP: number;
    streakBonus: number;
    weeklyBonusXP: number;
  };
  
  referral: {
    referrerXP: number;    // 추천인(A)이 받는 경험치
    refereeXP: number;     // 추천받은 사람(B)이 받는 경험치
    enabled: boolean;      // 추천인 시스템 활성화 여부
  };
  
  ads: {
    rewardedVideo: {
      experienceReward: number;
      dailyLimit: number;
      cooldownMinutes: number;
    };
  };
}

/**
 * 관리자용 경험치 설정 조회
 */
export const getExperienceSettings = async (): Promise<ExperienceSettings> => {
  try {
    const settingsDoc = await getDoc(doc(db, 'system', 'experienceSettings'));
    
    if (settingsDoc.exists()) {
      return settingsDoc.data() as ExperienceSettings;
    } else {
      // 기본 설정 반환
      const defaultSettings: ExperienceSettings = {
        community: {
          postXP: 10,
          commentXP: 5,
          likeXP: 1,
          dailyPostLimit: 3,
          dailyCommentLimit: 5,
          dailyLikeLimit: 50,
        },
        games: {
          reactionGame: {
            enabled: true,
            dailyLimit: 5,
            thresholds: [
              { minScore: 100, xpReward: 15 },
              { minScore: 200, xpReward: 10 },
              { minScore: 300, xpReward: 5 },
            ],
          },
          tileGame: {
            enabled: true,
            dailyLimit: 3,
            thresholds: [
              { minScore: 7, xpReward: 15 },
              { minScore: 10, xpReward: 10 },
              { minScore: 13, xpReward: 5 },
            ],
          },
        },

        attendance: {
          dailyXP: 10,
          streakBonus: 5,
          weeklyBonusXP: 50,
        },
        
        referral: {
          referrerXP: 30,     // 추천인이 받는 경험치 (기본값)
          refereeXP: 30,      // 추천받은 사람이 받는 경험치 (기본값)
          enabled: true,      // 추천인 시스템 활성화
        },
        
        ads: {
          rewardedVideo: {
            experienceReward: 30,
            dailyLimit: 5,
            cooldownMinutes: 30,
          },
        },
      };
      
      // 기본 설정을 Firestore에 저장 (문서가 없으면 생성)
      await updateDoc(doc(db, 'system', 'experienceSettings'), {
        ...defaultSettings,
        updatedAt: serverTimestamp()
      });
      return defaultSettings;
    }
  } catch (error) {
    console.error('경험치 설정 조회 오류:', error);
    throw new Error('경험치 설정을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 관리자용 경험치 설정 업데이트
 */
export const updateExperienceSettings = async (settings: ExperienceSettings): Promise<void> => {
  try {
    // setDoc을 사용하여 문서가 없으면 생성, 있으면 업데이트
    await updateDoc(doc(db, 'system', 'experienceSettings'), {
      ...settings,
      updatedAt: serverTimestamp(),
    });
    invalidateSystemSettingsCache(); // 캐시 무효화
  } catch (error) {
    console.error('경험치 설정 업데이트 오류:', error);
    throw new Error('경험치 설정 업데이트 중 오류가 발생했습니다.');
  }
};

/**
 * 관리자용 통계 데이터 조회
 */
export const getAdminStats = async (): Promise<{
  totalUsers: number;
  activeUsers: number;
  totalPosts: number;
  totalComments: number;
  pendingReports: number;
  totalExperience: number;
}> => {
  try {
    // 사용자 수 계산
    const usersSnapshot = await getCountFromServer(collection(db, 'users'));
    const totalUsers = usersSnapshot.data().count;

    // 활성 사용자 수 계산 (최근 30일 내 활동)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const activeUsersQuery = query(
      collection(db, 'users'),
      where('lastActiveAt', '>=', thirtyDaysAgo)
    );
    const activeUsersSnapshot = await getCountFromServer(activeUsersQuery);
    const activeUsers = activeUsersSnapshot.data().count;

    // 게시글 수 계산
    const postsSnapshot = await getCountFromServer(collection(db, 'posts'));
    const totalPosts = postsSnapshot.data().count;

    // 댓글 수 계산 (모든 게시글의 comments 서브컬렉션 합계)
    let totalComments = 0;
    const postsQuerySnapshot = await getDocs(collection(db, 'posts'));
    for (const postDoc of postsQuerySnapshot.docs) {
      const commentsSnapshot = await getCountFromServer(collection(db, 'posts', postDoc.id, 'comments'));
      totalComments += commentsSnapshot.data().count;
    }

    // 신고 건수 계산 (처리되지 않은 신고)
    let pendingReports = 0;
    for (const postDoc of postsQuerySnapshot.docs) {
      const reportsQuery = query(
        collection(db, 'posts', postDoc.id, 'reports'),
        where('status', '==', 'pending')
      );
      const reportsSnapshot = await getCountFromServer(reportsQuery);
      pendingReports += reportsSnapshot.data().count;
    }

    // 총 경험치 계산 (모든 사용자의 누적 경험치 합계)
    const usersQuerySnapshot = await getDocs(collection(db, 'users'));
    let totalExperience = 0;
    usersQuerySnapshot.forEach((userDoc) => {
      const userData = userDoc.data();
      const userXP = userData.stats?.totalExperience || 0;
      totalExperience += userXP;
    });

    return {
      totalUsers,
      activeUsers,
      totalPosts,
      totalComments,
      pendingReports,
      totalExperience,
    };
  } catch (error) {
    console.error('관리자 통계 조회 오류:', error);
    throw new Error('통계 데이터를 가져오는 중 오류가 발생했습니다.');
  }
}; 

/**
 * 게임 랭킹 데이터 조회
 */
export const getGameRankings = async (gameType: 'reactionGame' | 'tileGame' | 'flappyBird', period: 'daily' | 'weekly' | 'all' = 'all'): Promise<{
  id: string;
  gameType: string;
  period: string;
  score: number;
  userId: string;
  userName: string;
  createdAt: unknown;
}[]> => {
  try {
    const rankingRef = collection(db, 'gameRankings');
    const rankingQuery = query(
      rankingRef,
      where('gameType', '==', gameType),
      where('period', '==', period),
      orderBy('score', 'desc'),
      limit(10)
    );
    
    const snapshot = await getDocs(rankingQuery);
    return snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    } as {
      id: string;
      gameType: string;
      period: string;
      score: number;
      userId: string;
      userName: string;
      createdAt: unknown;
    }));
  } catch (error) {
    console.error('게임 랭킹 조회 오류:', error);
    return [];
  }
};

/**
 * 사용자 랭킹 조회
 */
export const getUserRanking = async (userId: string): Promise<{ rank: number; totalUsers: number } | null> => {
  try {
    const usersRef = collection(db, 'publicProfiles');
    const userDoc = await getDoc(doc(db, 'publicProfiles', userId));
    
    if (!userDoc.exists()) return null;
    
    const userTotalExp = userDoc.data().stats?.totalExperience || 0;
    
    // 현재 사용자보다 높은 경험치를 가진 사용자 수 계산
    const higherExpQuery = query(
      usersRef,
      where('stats.totalExperience', '>', userTotalExp)
    );
    
    const higherExpSnapshot = await getCountFromServer(higherExpQuery);
    const rank = higherExpSnapshot.data().count + 1;
    
    // 전체 사용자 수
    const totalUsersSnapshot = await getCountFromServer(usersRef);
    const totalUsers = totalUsersSnapshot.data().count;
    
    return { rank, totalUsers };
  } catch (error) {
    console.error('사용자 랭킹 조회 오류:', error);
    return null;
  }
};

/**
 * 상위 랭킹 사용자 조회
 */
export const getTopRankedUsers = async (limitCount: number = 10): Promise<User[]> => {
  try {
    const usersRef = collection(db, 'publicProfiles');
    const topUsersQuery = query(
      usersRef,
      orderBy('stats.totalExperience', 'desc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(topUsersQuery);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as User));
  } catch (error) {
    console.error('상위 랭킹 사용자 조회 오류:', error);
    return [];
  }
}; 

/**
 * 홈 화면용 통계 데이터 조회
 */
export const getHomeStats = async (): Promise<{
  totalUsers: number;
  todayPosts: number;
  onlineUsers: number;
  totalPosts: number;
}> => {
  try {
    // 사용자 수 계산
    const usersSnapshot = await getCountFromServer(collection(db, 'publicProfiles'));
    const totalUsers = usersSnapshot.data().count;

    // 오늘 작성된 게시글 수 계산
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayPostsQuery = query(
      collection(db, 'posts'),
      where('createdAt', '>=', today.getTime()),
      where('status.isDeleted', '==', false)
    );
    const todayPostsSnapshot = await getCountFromServer(todayPostsQuery);
    const todayPosts = todayPostsSnapshot.data().count;

    // 온라인 사용자 수 계산 (최근 5분 내 활동)
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const onlineUsersQuery = query(
      collection(db, 'publicProfiles'),
      where('lastActiveAt', '>=', fiveMinutesAgo)
    );
    const onlineUsersSnapshot = await getCountFromServer(onlineUsersQuery);
    const onlineUsers = onlineUsersSnapshot.data().count;

    // 전체 게시글 수 계산
    const postsSnapshot = await getCountFromServer(collection(db, 'posts'));
    const totalPosts = postsSnapshot.data().count;

    return {
      totalUsers,
      todayPosts,
      onlineUsers,
      totalPosts,
    };
  } catch (error) {
    console.error('홈 통계 조회 오류:', error);
    throw new Error('홈 통계 데이터를 가져오는 중 오류가 발생했습니다.');
  }
}; 

/**
 * 사용자 접속 시 일일 활동 제한 자동 리셋
 * 00시 정각 이후 첫 접속 시 activityLimits를 모두 0으로 초기화
 */
export const resetDailyActivityLimits = async (userId: string): Promise<void> => {
  // Daily accounting and XP are maintained atomically by the server.
  return;
}; 

/**
 * 특정 사용자의 경험치 데이터를 총 경험치 기준으로 재계산 및 동기화
 */
export const fixUserExperienceData = async (userId: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }
    
    const userData = userDoc.data() as User;
    
    // totalExperience를 기준으로 정확한 레벨과 현재 경험치 계산
    const totalExp = userData.stats?.totalExperience || (userData.stats as unknown as { experience?: number })?.experience || 0;
    const progress = calculateCurrentLevelProgress(totalExp);
    
    // 데이터 동기화
    await updateDoc(userRef, {
      'stats.totalExperience': totalExp,
      // 'stats.experience': totalExp, // experience 필드 제거
      'stats.level': progress.level,
      'stats.currentExp': progress.currentExp,
      'stats.currentLevelRequiredXp': progress.currentLevelRequiredXp,
      'updatedAt': serverTimestamp()
    });
    
    console.log(`✅ 사용자 ${userId}의 경험치 데이터가 수정되었습니다.`);
    console.log(`- 총 경험치: ${totalExp}XP`);
    console.log(`- 레벨: ${progress.level}`);
    console.log(`- 현재 경험치: ${progress.currentExp}/${progress.currentLevelRequiredXp}`);
  } catch (error) {
    console.error('경험치 데이터 수정 오류:', error);
    throw error;
  }
}; 
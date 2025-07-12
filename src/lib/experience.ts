import { doc, getDoc, updateDoc, serverTimestamp, increment, collection, query, where, orderBy, limit, getDocs, FieldValue } from 'firebase/firestore';
import { db } from './firebase';
import { User, SystemSettings } from '@/types';

// 레벨별 필요 경험치 (1→2레벨 10exp, 2→3레벨 20exp, 오름차순)
// 각 레벨에서 다음 레벨로 가기 위해 필요한 경험치
export const LEVEL_REQUIREMENTS = {
  1: 10,   // 1레벨 → 2레벨
  2: 20,   // 2레벨 → 3레벨
  3: 30,   // 3레벨 → 4레벨
  4: 40,   // 4레벨 → 5레벨
  5: 50,   // 5레벨 → 6레벨
  6: 60,   // 6레벨 → 7레벨
  7: 70,   // 7레벨 → 8레벨
  8: 80,   // 8레벨 → 9레벨
  9: 90,   // 9레벨 → 10레벨
  10: 100, // 10레벨 → 11레벨
  11: 110, // 11레벨 → 12레벨
  12: 120, // 12레벨 → 13레벨
  13: 130,
  14: 140,
  15: 150,
  16: 160,
  17: 170,
  18: 180,
  19: 190,
  20: 200
};

// 레벨별 누적 경험치 (총 경험치로 레벨 계산용)
export const CUMULATIVE_REQUIREMENTS = {
  1: 0,    // 1레벨 시작
  2: 10,   // 1→2레벨 10exp
  3: 30,   // 10 + 20 = 30
  4: 60,   // 30 + 30 = 60
  5: 100,  // 60 + 40 = 100
  6: 150,  // 100 + 50 = 150
  7: 210,  // 150 + 60 = 210
  8: 280,  // 210 + 70 = 280
  9: 360,  // 280 + 80 = 360
  10: 450, // 360 + 90 = 450
  11: 550, // 450 + 100 = 550
  12: 660, // 550 + 110 = 660
  13: 780, // 660 + 120 = 780
  14: 910, // 780 + 130 = 910
  15: 1050, // 910 + 140 = 1050
  16: 1200, // 1050 + 150 = 1200
  17: 1360, // 1200 + 160 = 1360
  18: 1530, // 1360 + 170 = 1530
  19: 1710, // 1530 + 180 = 1710
  20: 1900  // 1710 + 190 = 1900
};

/**
 * 시스템 설정 가져오기
 */
let cachedSystemSettings: SystemSettings | null = null;

export const getSystemSettings = async (): Promise<SystemSettings> => {
  if (cachedSystemSettings) {
    return cachedSystemSettings;
  }
  
  try {
    // Firebase의 실제 experienceSettings 문서 읽기
    const experienceSettingsDoc = await getDoc(doc(db, 'system', 'experienceSettings'));
    
    if (experienceSettingsDoc.exists()) {
      const firebaseSettings = experienceSettingsDoc.data();
      
      // Firebase 구조를 코드 구조로 변환
      cachedSystemSettings = {
        experience: {
          postReward: firebaseSettings.community?.postXP || 10, // 기본값 10
          commentReward: firebaseSettings.community?.commentXP || 5, // 기본값 5
          likeReward: firebaseSettings.community?.likeXP || 1, // 기본값 1
          attendanceReward: firebaseSettings.attendance?.dailyXP || 5, // 기본값 5
          attendanceStreakReward: firebaseSettings.attendance?.streakBonus || 10, // 기본값 10
          referralReward: 50, // 기본값 50
          levelRequirements: LEVEL_REQUIREMENTS, // 시스템 설정에서 로드된 값 사용
        },
        dailyLimits: {
          postsForReward: firebaseSettings.community?.dailyPostLimit || 3, // 기본값 3
          commentsForReward: firebaseSettings.community?.dailyCommentLimit || 5, // 기본값 5
          gamePlayCount: firebaseSettings.games?.reactionGame?.dailyLimit || 5 // 기본값 5
        },
        gameSettings: {
          reactionGame: {
            rewardThreshold: 500, // 기본값 유지 (thresholds 배열로 대체됨)
            rewardAmount: 15, // 기본값 15
            thresholds: firebaseSettings.games?.reactionGame?.thresholds || [
              { minScore: 100, xpReward: 5 },
              { minScore: 200, xpReward: 10 },
              { minScore: 300, xpReward: 15 }
            ]
          },
          tileGame: {
            rewardThreshold: 800, // 기본값 유지 (thresholds 배열로 대체됨)
            rewardAmount: 20, // 기본값 20
            thresholds: firebaseSettings.games?.tileGame?.thresholds || [
              { minScore: 50, xpReward: 5 },
              { minScore: 100, xpReward: 10 },
              { minScore: 150, xpReward: 15 }
            ]
          },
          flappyBird: {
            rewardThreshold: 10,
            rewardAmount: 25 // 기본값 25
          }
        },
        ads: {
          rewardedVideo: {
            gameExtraPlays: 3,
            cooldownMinutes: 30
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
      
      return cachedSystemSettings;
    }
  } catch (error) {
    console.error('시스템 설정 로드 실패:', error);
  }
  
  // 기본값 반환
  return {
    experience: {
      postReward: 10,
      commentReward: 5,
      likeReward: 1,
      attendanceReward: 5,
      attendanceStreakReward: 10,
      referralReward: 50,
      levelRequirements: LEVEL_REQUIREMENTS
    },
    dailyLimits: {
      postsForReward: 3,
      commentsForReward: 5,
      gamePlayCount: 5
    },
    gameSettings: {
      reactionGame: {
        rewardThreshold: 500,
        rewardAmount: 15,
        thresholds: [
          { minScore: 100, xpReward: 5 },
          { minScore: 200, xpReward: 10 },
          { minScore: 300, xpReward: 15 }
        ]
      },
      tileGame: {
        rewardThreshold: 800,
        rewardAmount: 20,
        thresholds: [
          { minScore: 50, xpReward: 5 },
          { minScore: 100, xpReward: 10 },
          { minScore: 150, xpReward: 15 }
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
        cooldownMinutes: 30
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
 * 시스템 설정 캐시 무효화
 * 관리자가 설정을 변경했을 때 호출
 */
export const invalidateSystemSettingsCache = (): void => {
  cachedSystemSettings = null;
};

/**
 * 레벨에 따른 필요 경험치 계산 (시스템 설정 기반)
 */
export const calculateRequiredExpForLevel = async (targetLevel: number): Promise<number> => {
  const settings = await getSystemSettings();
  return settings.experience.levelRequirements[targetLevel] || (targetLevel - 1) * targetLevel * 5;
};

// 하위 호환성을 위한 export
export const calculateRequiredExp = calculateRequiredExpForLevel;

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
  for (const [levelStr, requiredExp] of Object.entries(CUMULATIVE_REQUIREMENTS)) {
    const levelNum = parseInt(levelStr);
    if (totalExp >= requiredExp) {
      level = levelNum;
    } else {
      break;
    }
  }
  return level;
};

/**
 * 현재 레벨에서 다음 레벨로 가기 위해 필요한 경험치
 */
export const getExpRequiredForNextLevel = (currentLevel: number): number => {
  return LEVEL_REQUIREMENTS[currentLevel as keyof typeof LEVEL_REQUIREMENTS] || (currentLevel * 10);
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
  const currentLevelStartExp = CUMULATIVE_REQUIREMENTS[level as keyof typeof CUMULATIVE_REQUIREMENTS] || 0;
  const currentExp = totalExp - currentLevelStartExp;
  const currentLevelRequiredXp = getExpRequiredForNextLevel(level);
  const expToNextLevel = currentLevelRequiredXp - currentExp;
  
  const progressPercentage = Math.min(100, Math.floor((currentExp / currentLevelRequiredXp) * 100));
  
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
  while (newCurrentExp >= newCurrentLevelRequiredXp) {
    shouldLevelUp = true;
    newCurrentExp -= newCurrentLevelRequiredXp; // 레벨업 후 남은 경험치
    newLevel++;
    newCurrentLevelRequiredXp = getExpRequiredForNextLevel(newLevel);
  }
  
  return {
    shouldLevelUp,
    newLevel,
    newCurrentExp,
    newCurrentLevelRequiredXp
  };
};

/**
 * 일일 활동 제한 확인 함수
 */
export const checkDailyLimit = async (userId: string, activityType: 'posts' | 'comments' | 'games'): Promise<{
  canEarnExp: boolean;
  currentCount: number;
  limit: number;
}> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return { canEarnExp: false, currentCount: 0, limit: 0 };
    }
    
    const userData = userDoc.data() as User;
    const today = new Date().toISOString().split('T')[0];
    
    // 활동 제한 데이터 확인
    const activityLimits = userData.activityLimits;
    if (!activityLimits || activityLimits.lastResetDate !== today) {
      // 새로운 날이거나 데이터가 없으면 제한 없음
      return { canEarnExp: true, currentCount: 0, limit: getActivityLimit(activityType) };
    }
    
    let currentCount = 0;
    
    if (activityType === 'games') {
      // 게임의 경우 모든 게임 타입의 합계
      const gamesCounts = activityLimits.dailyCounts.games || { flappyBird: 0, reactionGame: 0, tileGame: 0 };
      currentCount = gamesCounts.flappyBird + gamesCounts.reactionGame + gamesCounts.tileGame;
    } else {
      // posts, comments의 경우
      currentCount = (activityLimits.dailyCounts[activityType] as number) || 0;
    }
    
    const limit = getActivityLimit(activityType);
    
    return {
      canEarnExp: currentCount < limit,
      currentCount,
      limit
    };
  } catch (error) {
    console.error('일일 제한 확인 오류:', error);
    return { canEarnExp: false, currentCount: 0, limit: 0 };
  }
};

/**
 * 활동 타입별 제한 수치 반환
 */
const getActivityLimit = (activityType: 'posts' | 'comments' | 'games'): number => {
  switch (activityType) {
    case 'posts': return 3;
    case 'comments': return 5;
    case 'games': return 5;
    default: return 0;
  }
};

/**
 * 활동 카운트 업데이트
 */
export const updateActivityCount = async (userId: string, activityType: 'posts' | 'comments', gameType?: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    const today = new Date().toISOString().split('T')[0];
    
    // 활동 카운트 증가
    const updateData: Record<string, string | FieldValue> = {
      [`activityLimits.lastResetDate`]: today,
      [`activityLimits.dailyCounts.${activityType}`]: increment(1)
    };
    
    if (gameType) {
      updateData[`activityLimits.dailyCounts.games.${gameType}`] = increment(1);
    }
    
    await updateDoc(userRef, updateData);
  } catch (error) {
    console.error('활동 카운트 업데이트 오류:', error);
  }
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
  try {
    const settings = await getSystemSettings();
    let expToAward = 0;
    let shouldCheckLimit = true;
    let activityLimitType: 'posts' | 'comments' | 'games' | null = null;
    
    // 활동 타입별 경험치 계산
    switch (activityType) {
      case 'post':
        expToAward = settings.experience.postReward;
        activityLimitType = 'posts';
        break;
      case 'comment':
        expToAward = settings.experience.commentReward;
        activityLimitType = 'comments';
        break;
      case 'like':
        expToAward = settings.experience.likeReward;
        shouldCheckLimit = false; // 좋아요는 제한 없음
        break;
      case 'attendance':
        expToAward = settings.experience.attendanceReward;
        shouldCheckLimit = false;
        break;
      case 'attendanceStreak':
        expToAward = settings.experience.attendanceStreakReward;
        shouldCheckLimit = false;
        break;
      case 'referral':
        expToAward = settings.experience.referralReward;
        shouldCheckLimit = false;
        break;
      case 'game':
        if (!gameType) return { success: false, expAwarded: 0, leveledUp: false, reason: '게임 타입이 필요합니다.' };
        
        const gameSettings = settings.gameSettings[gameType];
        if (gameScore && gameScore >= gameSettings.rewardThreshold) {
          expToAward = gameSettings.rewardAmount;
          activityLimitType = 'games';
        } else {
          return { success: false, expAwarded: 0, leveledUp: false, reason: '기준 점수에 도달하지 못했습니다.' };
        }
        break;
      default:
        expToAward = amount || 0;
        shouldCheckLimit = false;
    }
    
    // 일일 제한 확인
    if (shouldCheckLimit && activityLimitType) {
      const limitCheck = await checkDailyLimit(userId, activityLimitType);
      if (!limitCheck.canEarnExp) {
        return { 
          success: false, 
          expAwarded: 0, 
          leveledUp: false, 
          reason: `일일 제한에 도달했습니다. (${limitCheck.currentCount}/${limitCheck.limit})` 
        };
      }
    }
    
    // 경험치 업데이트
    const result = await updateUserExperience(userId, expToAward);
    
    // 활동 카운트 업데이트
    if (activityLimitType === 'posts') {
      await updateActivityCount(userId, 'posts');
    } else if (activityLimitType === 'comments') {
      await updateActivityCount(userId, 'comments');
    } else if (activityType === 'game' && gameType) {
      await updateActivityCount(userId, 'posts', gameType); // 게임의 경우 임시로 posts 타입 사용하고 gameType 전달
    }
    
    return {
      success: true,
      expAwarded: expToAward,
      leveledUp: result.leveledUp,
      oldLevel: result.oldLevel,
      newLevel: result.newLevel
    };
    
  } catch (error) {
    console.error('경험치 지급 실패:', error);
    return { success: false, expAwarded: 0, leveledUp: false, reason: '경험치 지급 중 오류가 발생했습니다.' };
  }
};

/**
 * 사용자 경험치 업데이트 및 레벨업 처리 (개선된 버전)
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
    const currentExp = userData.stats?.currentExp || 0;
    const currentLevelRequiredXp = userData.stats?.currentLevelRequiredXp || getExpRequiredForNextLevel(currentLevel);
    const totalExperience = userData.stats?.totalExperience || 0;
    
    // 새로운 경험치 계산
    const newCurrentExp = currentExp + xp;
    const newTotalExperience = totalExperience + xp;
    
    // 레벨업 체크
    const levelUpResult = checkLevelUp(currentLevel, newCurrentExp, currentLevelRequiredXp);
    
    // 데이터 업데이트
    const updateData = {
      'stats.totalExperience': newTotalExperience,
      'stats.level': levelUpResult.newLevel,
      'stats.currentExp': levelUpResult.newCurrentExp,
      'stats.currentLevelRequiredXp': levelUpResult.newCurrentLevelRequiredXp,
      'stats.experience': newTotalExperience, // 호환성을 위해 유지 (totalExperience와 동일)
      'updatedAt': serverTimestamp()
    };
    
    await updateDoc(userRef, updateData);
    
    if (levelUpResult.shouldLevelUp) {
      console.log(`🎉 사용자 ${userId}가 레벨 ${currentLevel}에서 레벨 ${levelUpResult.newLevel}로 레벨업했습니다!`);
    }
    
    console.log(`✨ 사용자 ${userId}에게 ${xp} 경험치가 추가되었습니다. (총 ${newTotalExperience}XP)`);
    
    // 업데이트된 사용자 데이터 조회
    const updatedUserDoc = await getDoc(userRef);
    const updatedUserData = updatedUserDoc.data() as User;
    
    return { 
      leveledUp: levelUpResult.shouldLevelUp, 
      oldLevel: currentLevel, 
      newLevel: levelUpResult.newLevel, 
      userData: updatedUserData 
    };
  } catch (error) {
    console.error('경험치 업데이트 실패:', error);
    throw error;
  }
};

/**
 * 사용자 경험치 데이터 동기화 (기존 데이터 마이그레이션용)
 */
export const syncUserExperienceData = async (userId: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }
    
    const userData = userDoc.data() as User;
    
    // totalExperience를 기준으로 정확한 레벨과 현재 경험치 계산
    const totalExp = userData.stats?.totalExperience || userData.stats?.experience || 0;
    const progress = calculateCurrentLevelProgress(totalExp);
    
    // 데이터 동기화
    await updateDoc(userRef, {
      'stats.totalExperience': totalExp,
      'stats.experience': totalExp, // 호환성을 위해 유지
      'stats.level': progress.level,
      'stats.currentExp': progress.currentExp,
      'stats.currentLevelRequiredXp': progress.currentLevelRequiredXp,
      'updatedAt': serverTimestamp()
    });
    
    console.log(`✅ 사용자 ${userId}의 경험치 데이터가 동기화되었습니다.`);
    console.log(`- 총 경험치: ${totalExp}, 레벨: ${progress.level}, 현재 경험치: ${progress.currentExp}/${progress.currentLevelRequiredXp}`);
  } catch (error) {
    console.error('경험치 데이터 동기화 오류:', error);
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
): Promise<Array<{
  rank: number;
  userId: string;
  displayName: string;
  schoolName?: string;
  level: number;
  experience: number;
  profileImageUrl?: string;
}>> => {
  try {
    let usersQuery;
    
    if (type === 'school' && schoolId) {
      usersQuery = query(
        collection(db, 'users'),
        where('school.id', '==', schoolId),
        orderBy('stats.totalExperience', 'desc'),
        limit(limitCount)
      );
    } else if (type === 'region' && sido) {
      if (sigungu) {
        usersQuery = query(
          collection(db, 'users'),
          where('regions.sido', '==', sido),
          where('regions.sigungu', '==', sigungu),
          orderBy('stats.totalExperience', 'desc'),
          limit(limitCount)
        );
      } else {
        usersQuery = query(
          collection(db, 'users'),
          where('regions.sido', '==', sido),
          orderBy('stats.totalExperience', 'desc'),
          limit(limitCount)
        );
      }
    } else {
      // 전체 랭킹
      usersQuery = query(
        collection(db, 'users'),
        orderBy('stats.totalExperience', 'desc'),
        limit(limitCount)
      );
    }
    
    const querySnapshot = await getDocs(usersQuery);
    const rankingData: Array<{
      rank: number;
      userId: string;
      displayName: string;
      schoolName?: string;
      level: number;
      experience: number;
      profileImageUrl?: string;
    }> = [];
    
    querySnapshot.docs.forEach((doc, index) => {
      const userData = doc.data() as User;
      rankingData.push({
        rank: index + 1,
        userId: doc.id,
        displayName: userData.profile.userName,
        schoolName: userData.school?.name,
        level: userData.stats?.level || 1,
        experience: userData.stats?.totalExperience || 0,
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
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return null;
    
    const userData = userDoc.data() as User;
    const userExp = userData.stats?.totalExperience || 0;
    
    let usersQuery;
    
    if (type === 'school' && schoolId) {
      usersQuery = query(
        collection(db, 'users'),
        where('school.id', '==', schoolId),
        where('stats.totalExperience', '>', userExp)
      );
    } else if (type === 'region' && sido) {
      if (sigungu) {
        usersQuery = query(
          collection(db, 'users'),
          where('regions.sido', '==', sido),
          where('regions.sigungu', '==', sigungu),
          where('stats.totalExperience', '>', userExp)
        );
      } else {
        usersQuery = query(
          collection(db, 'users'),
          where('regions.sido', '==', sido),
          where('stats.totalExperience', '>', userExp)
        );
      }
    } else {
      // 전체 랭킹
      usersQuery = query(
        collection(db, 'users'),
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
import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserAttendance, AttendanceLog } from '@/types';
import { getSystemSettings, updateUserExperience } from '@/lib/experience';

// 경험치 관련 상수는 시스템 설정에서 동적으로 가져옴
// const ATTENDANCE_XP = 10; // 제거됨 - 시스템 설정에서 가져옴
// const STREAK_7_XP = 50;   // 제거됨 - 시스템 설정에서 가져옴
// const STREAK_30_XP = 200; // 제거됨 - 시스템 설정에서 가져옴

/**
 * 한국 시간대 기준(UTC+9)으로 날짜 문자열 생성
 * @param date 날짜 (선택사항, 기본값: 현재 시간)
 * @returns 한국 시간대 기준 날짜 문자열 (YYYY-MM-DD 형태)
 */
const getKoreanDateString = (date: Date = new Date()): string => {
  // UTC 시간에 9시간(한국 시간)을 더해서 한국 시간으로 변환
  const koreaTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
  
  // UTC 기준으로 날짜 추출 (이미 한국 시간으로 변환된 상태)
  const year = koreaTime.getUTCFullYear();
  const month = String(koreaTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(koreaTime.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * 연속 출석 일수에 따른 추가 경험치 계산
 * @param streak 연속 출석 일수
 * @param prevStreak 이전 연속 출석 일수
 * @param settings 시스템 설정
 * @returns 추가 경험치
 */
const calculateStreakBonus = (streak: number, prevStreak: number, settings: { attendanceBonus?: { weeklyBonusXP: number } }): number => {
  let bonus = 0;
  
  // Firebase 설정에서 보너스 값 가져오기
  const weeklyBonusXP = settings.attendanceBonus?.weeklyBonusXP || 50;
  const monthlyBonusXP = 200; // 30일 보너스는 기본값 유지 (Firebase에 없음)
  
  // 7일 연속 출석 보너스
  if (streak >= 7 && prevStreak < 7) {
    bonus += weeklyBonusXP;
  }
  
  // 30일 연속 출석 보너스
  if (streak >= 30 && prevStreak < 30) {
    bonus += monthlyBonusXP;
  }
  
  return bonus;
};

/**
 * 사용자 출석 체크 정보 조회 및 출석체크 처리
 * @param userId 사용자 ID
 * @param doCheck 출석체크 수행 여부 (true인 경우 출석체크 처리)
 * @returns 출석체크 정보 및 레벨업 여부
 */
export const checkAttendance = async (
  userId: string,
  doCheck: boolean = false
): Promise<UserAttendance> => {
  try {
    // userId 유효성 검사
    if (!userId || userId.trim() === '') {
      throw new Error('유효하지 않은 사용자 ID입니다.');
    }
    
    // 한국 시간 기준 날짜 문자열 가져오기
    const todayStr = getKoreanDateString();
    
    // 사용자 출석체크 데이터 조회
    const attendanceRef = doc(db, 'attendance', userId);
    const attendanceDoc = await getDoc(attendanceRef);
    
    if (!attendanceDoc.exists()) {
      // 출석체크 데이터가 없으면 새로 생성
      if (doCheck) {
        const newMonthlyLog: AttendanceLog = {
          [todayStr]: true
        };
        
        const newAttendance = {
          userId,
          attendances: {
            [todayStr]: true
          },
          streak: 1,
          lastAttendance: serverTimestamp(),
          monthlyLog: newMonthlyLog
        };
        
        await setDoc(attendanceRef, newAttendance);
        
        // 첫 출석 경험치 추가 - 시스템 설정 기반
        const settings = await getSystemSettings();
        const attendanceXP = settings.experience.attendanceReward;
        const expResult = await updateUserExperience(userId, attendanceXP);
        
        return {
          checkedToday: true,
          streak: 1,
          totalCount: 1,
          monthCount: 1,
          lastAttendance: serverTimestamp(),
          monthlyLog: newMonthlyLog,
          attendances: {
            [todayStr]: true
          },
          expGained: attendanceXP,
          leveledUp: expResult.leveledUp,
          oldLevel: expResult.oldLevel,
          newLevel: expResult.newLevel
        };
      } else {
        return {
          checkedToday: false,
          streak: 0,
          totalCount: 0,
          monthCount: 0,
          monthlyLog: {},
          attendances: {}
        };
      }
    }
    
    // 기존 출석체크 데이터 처리
    const attendanceData = attendanceDoc.data();
    const attendances = attendanceData.attendances || {};
    let streak = attendanceData.streak || 0;
    const monthlyLog = attendanceData.monthlyLog || attendances; // 이전 데이터 호환성 유지
    
    // 오늘 출석체크 여부 확인
    const checkedToday = attendances[todayStr] === true;
    
    // 출석체크 요청인 경우 처리
    if (doCheck && !checkedToday) {
      // 어제 날짜 계산 (한국 시간 기준)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = getKoreanDateString(yesterday);
      
      // 이전 연속 출석 일수 저장 (경험치 보상 계산용)
      const prevStreak = streak;
      
      // 연속 출석 여부 확인
      if (attendances[yesterdayStr]) {
        streak += 1;
      } else {
        streak = 1;
      }
      
      // 출석체크 데이터 업데이트
      const updatedAttendances = {
        ...attendances,
        [todayStr]: true
      };
      
      // monthlyLog 업데이트
      const updatedMonthlyLog = {
        ...monthlyLog,
        [todayStr]: true
      };
      
      await updateDoc(attendanceRef, {
        attendances: updatedAttendances,
        streak,
        lastAttendance: serverTimestamp(),
        monthlyLog: updatedMonthlyLog
      });
      
      // 기본 출석 경험치 추가 - 시스템 설정 기반
      const settings = await getSystemSettings();
      let totalXp = settings.experience.attendanceReward;
      
      // 연속 출석 보너스 계산
      const streakBonus = calculateStreakBonus(streak, prevStreak, settings);
      totalXp += streakBonus;
      
      // 사용자 경험치 업데이트 및 레벨업 확인
      const expResult = await updateUserExperience(userId, totalXp);
      
      // 사용자의 streak 통계도 업데이트
      await updateDoc(doc(db, 'users', userId), {
        'stats.streak': streak
      });
      
      // 월별 출석 일수 계산
      const monthCount = Object.keys(updatedMonthlyLog).length;
      const totalCount = Object.keys(updatedAttendances).length;
      
      return {
        checkedToday: true,
        streak,
        totalCount,
        monthCount,
        lastAttendance: serverTimestamp(),
        monthlyLog: updatedMonthlyLog,
        attendances: updatedAttendances,
        expGained: totalXp,
        leveledUp: expResult.leveledUp,
        oldLevel: expResult.oldLevel,
        newLevel: expResult.newLevel
      };
    }
    
    // 출석체크 정보만 조회하는 경우
    const monthCount = Object.keys(monthlyLog).length;
    const totalCount = Object.keys(attendances).length;
    
    return {
      checkedToday,
      streak,
      totalCount,
      monthCount,
      lastAttendance: attendanceData.lastAttendance,
      monthlyLog,
      attendances
    };
    
  } catch (error) {
    console.error('출석체크 처리 오류:', error);
    throw error;
  }
}; 
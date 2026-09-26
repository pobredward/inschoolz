import { communityCommand } from '../community-client';
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
  return communityCommand('attendance.check', { doCheck }, userId);
}; 
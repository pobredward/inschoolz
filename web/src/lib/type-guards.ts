import { User } from '@/types';

/**
 * 사용자 객체가 유효한지 검증하는 타입 가드
 */
export function isValidUser(user: any): user is User {
  return (
    user &&
    typeof user === 'object' &&
    typeof user.uid === 'string' &&
    user.uid.length > 0 &&
    typeof user.email === 'string' &&
    user.profile &&
    typeof user.profile === 'object' &&
    typeof user.profile.userName === 'string' &&
    user.profile.userName.length > 0
  );
}

/**
 * 사용자 프로필이 완전한지 검증
 */
export function hasCompleteProfile(user: User): boolean {
  return !!(
    user.profile?.userName &&
    user.profile?.realName &&
    user.profile?.birthYear &&
    user.profile?.birthMonth &&
    user.profile?.birthDay
  );
}

/**
 * 안전한 숫자 변환
 */
export function safeNumber(value: unknown, defaultValue: number = 0): number {
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
}

/**
 * 안전한 문자열 가져오기
 */
export function safeString(value: unknown, defaultValue: string = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value != null) {
    return String(value);
  }
  return defaultValue;
}

/**
 * 안전한 배열 접근
 */
export function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Firebase Timestamp를 안전하게 Date로 변환
 */
export function safeTimestampToDate(timestamp: any): Date {
  try {
    if (!timestamp) {
      return new Date();
    }
    
    // Firebase Timestamp 객체인 경우
    if (timestamp && typeof timestamp.seconds === 'number') {
      return new Date(timestamp.seconds * 1000);
    }
    
    // 숫자 타임스탬프인 경우
    if (typeof timestamp === 'number') {
      return new Date(timestamp);
    }
    
    // 문자열 날짜인 경우
    if (typeof timestamp === 'string') {
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? new Date() : date;
    }
    
    // Date 객체인 경우
    if (timestamp instanceof Date) {
      return isNaN(timestamp.getTime()) ? new Date() : timestamp;
    }
    
    return new Date();
  } catch (error) {
    console.warn('타임스탬프 변환 오류:', error);
    return new Date();
  }
}

/**
 * 사용자 통계 데이터가 유효한지 검증
 */
export function hasValidStats(stats: any): boolean {
  return !!(
    stats &&
    typeof stats === 'object' &&
    typeof stats.level === 'number' &&
    stats.level > 0
  );
}

/**
 * 안전한 학교 정보 접근
 */
export function getSchoolInfo(user: User): {
  name: string;
  grade?: string;
  classNumber?: string;
  fullInfo: string;
} {
  const school = user.school;
  const name = safeString(school?.name, '소속 학교 없음');
  const grade = school?.grade ? safeString(school.grade) : undefined;
  const classNumber = school?.classNumber ? safeString(school.classNumber) : undefined;
  
  let fullInfo = name;
  if (grade && classNumber) {
    fullInfo += ` (${grade}학년 ${classNumber}반)`;
  }
  
  return { name, grade, classNumber, fullInfo };
}

/**
 * 안전한 레벨 정보 계산
 */
export function getLevelInfo(user: User): {
  level: number;
  currentExp: number;
  requiredExp: number;
  percentage: number;
} {
  const stats = user.stats;
  const level = safeNumber(stats?.level, 1);
  const currentExp = safeNumber(stats?.currentExp, 0);
  const requiredExp = safeNumber(stats?.currentLevelRequiredXp, level * 10);
  const percentage = requiredExp > 0 ? Math.min((currentExp / requiredExp) * 100, 100) : 0;
  
  return {
    level,
    currentExp,
    requiredExp,
    percentage
  };
}

/**
 * 사용자 역할 검증
 */
export function getUserRole(user: User): {
  isAdmin: boolean;
  isTeacher: boolean;
  isVerified: boolean;
  displayRole: string;
} {
  const role = safeString(user.role, 'user');
  const isVerified = Boolean(user.isVerified);
  
  return {
    isAdmin: role === 'admin',
    isTeacher: role === 'teacher',
    isVerified,
    displayRole: role === 'admin' ? '관리자' : role === 'teacher' ? '선생님' : '일반 회원'
  };
}

/**
 * 안전한 이미지 URL 처리
 */
export function getSafeImageUrl(url: string | undefined | null, defaultUrl: string = '/images/default-profile.png'): string {
  // null, undefined, 빈 문자열 체크
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return defaultUrl;
  }
  
  // 공백만 있는 문자열 체크
  if (url.trim() === '') {
    return defaultUrl;
  }
  
  try {
    // 절대 URL인지 확인
    new URL(url);
    return url;
  } catch {
    // 상대 경로인지 확인
    if (url.startsWith('/')) {
      return url;
    }
    
    // 그 외의 경우 기본 이미지 반환
    return defaultUrl;
  }
} 
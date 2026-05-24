/**
 * 관리자 권한 관련 유틸리티 함수들
 */

// 관리자 이메일 목록
const ADMIN_EMAILS = [
  'pobredward@gmail.com',
  'admin@inschoolz.com'
];

/**
 * 사용자가 관리자인지 확인
 */
export function isAdmin(userEmail?: string | null): boolean {
  if (!userEmail) return false;
  return ADMIN_EMAILS.includes(userEmail.toLowerCase());
}

/**
 * 관리자 권한이 필요한 작업에 대한 권한 확인
 */
export function requireAdmin(userEmail?: string | null): void {
  if (!isAdmin(userEmail)) {
    throw new Error('관리자 권한이 필요합니다.');
  }
}

/**
 * AI 댓글인지 확인
 */
export function isAIComment(comment: any): boolean {
  return comment?.fake === true;
}

/**
 * 관리자가 AI 댓글을 수정할 수 있는지 확인
 */
export function canEditAIComment(userEmail?: string | null, comment?: any): boolean {
  return isAdmin(userEmail) && isAIComment(comment);
}

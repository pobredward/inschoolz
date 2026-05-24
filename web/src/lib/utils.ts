import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Timestamp } from 'firebase/firestore'

// ===== Timestamp 직렬화 유틸리티 =====

/**
 * Firestore Timestamp를 JavaScript Date로 변환
 * @param timestamp Firestore Timestamp 또는 Date 또는 문자열
 * @returns JavaScript Date 객체
 */
export function serializeTimestamp(timestamp: unknown): Date {
  if (!timestamp) return new Date();
  
  // 이미 Date 객체인 경우
  if (timestamp instanceof Date) return timestamp;
  
  // Firestore Timestamp인 경우
  if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && typeof (timestamp as { toDate: () => Date }).toDate === 'function') {
    return (timestamp as { toDate: () => Date }).toDate();
  }
  
  // 문자열이나 숫자인 경우
  if (typeof timestamp === 'string' || typeof timestamp === 'number') {
    return new Date(timestamp);
  }
  
  // seconds와 nanoseconds가 있는 객체인 경우 (직렬화된 Timestamp)
  if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp && typeof (timestamp as { seconds: number; nanoseconds?: number }).seconds === 'number') {
    const { seconds, nanoseconds = 0 } = timestamp as { seconds: number; nanoseconds?: number };
    return new Date(seconds * 1000 + Math.floor(nanoseconds / 1000000));
  }
  
  // fallback
  return new Date();
}

/**
 * 객체의 모든 timestamp 필드를 직렬화
 * @param obj 직렬화할 객체
 * @param timestampFields timestamp 필드명 배열
 * @returns 직렬화된 객체
 */
export function serializeObject<T>(obj: Record<string, unknown>, timestampFields: string[] = ['createdAt', 'updatedAt']): T {
  if (!obj || typeof obj !== 'object') return obj as T;
  
  const serialized = { ...obj };
  
  timestampFields.forEach(field => {
    if (serialized[field]) {
      serialized[field] = serializeTimestamp(serialized[field]);
    }
  });
  
  return serialized as T;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ===== 로깅 유틸리티 =====

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  debug: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.log(`🔍 [DEBUG] ${message}`, ...args);
    }
  },
  
  info: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.log(`ℹ️ [INFO] ${message}`, ...args);
    }
  },
  
  warn: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.warn(`⚠️ [WARN] ${message}`, ...args);
    }
  },
  
  error: (message: string, ...args: unknown[]) => {
    console.error(`❌ [ERROR] ${message}`, ...args);
  },
  
  // Firebase 인증 관련 로그
  auth: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.log(`🔐 [AUTH] ${message}`, ...args);
    }
  },
  
  // Firebase 관련 로그
  firebase: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.log(`🔥 [FIREBASE] ${message}`, ...args);
    }
  },
  
  // API 호출 관련 로그
  api: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.log(`🌐 [API] ${message}`, ...args);
    }
  },
  
  // 사용자 액션 관련 로그
  user: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.log(`👤 [USER] ${message}`, ...args);
    }
  }
};

// 성능 측정을 위한 타이머 유틸리티
export const performanceLogger = {
  start: (label: string) => {
    if (isDevelopment) {
      console.time(`⏱️ [PERF] ${label}`);
    }
  },
  
  end: (label: string) => {
    if (isDevelopment) {
      console.timeEnd(`⏱️ [PERF] ${label}`);
    }
  }
};

// ===== 시간 관련 유틸리티 함수들 =====

/**
 * 다양한 형태의 timestamp를 Date 객체로 변환
 * @param timestamp Firebase Timestamp, Date, number, string 등
 * @returns Date 객체
 */
export function toDate(timestamp: unknown): Date {
  // Date 객체인 경우
  if (timestamp instanceof Date) {
    return timestamp;
  }
  
  // number 타입인 경우 (Unix timestamp)
  if (typeof timestamp === 'number') {
    return new Date(timestamp);
  }
  
  // string 타입인 경우
  if (typeof timestamp === 'string') {
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  // Firebase Timestamp 객체인 경우
  if (timestamp && typeof timestamp === 'object') {
    // Timestamp 객체의 toDate 메소드 사용
    if ('toDate' in timestamp && typeof (timestamp as Timestamp).toDate === 'function') {
      return (timestamp as Timestamp).toDate();
    }
    
    // Firestore에서 직렬화된 Timestamp 형태 (seconds, nanoseconds)
    if ('seconds' in timestamp && typeof (timestamp as { seconds: unknown }).seconds === 'number') {
      const { seconds, nanoseconds = 0 } = timestamp as { seconds: number; nanoseconds?: number };
      return new Date(seconds * 1000 + nanoseconds / 1000000);
    }
    
    // serverTimestamp() 후 아직 서버에서 처리되지 않은 경우 (null)
    if (timestamp === null) {
      console.warn('serverTimestamp()가 아직 처리되지 않았습니다. 현재 시간을 사용합니다.');
      return new Date();
    }
  }
  
  // 기본값: 현재 시간
  console.warn('알 수 없는 timestamp 형태:', timestamp, typeof timestamp);
  return new Date();
}

/**
 * 다양한 형태의 timestamp를 number(milliseconds)로 변환
 * @param timestamp Firebase Timestamp, Date, number, 또는 기타 형태
 * @returns Unix timestamp (milliseconds)
 */
export function toTimestamp(timestamp: unknown): number {
  return toDate(timestamp).getTime();
}

/**
 * 현재 시간을 Timestamp로 반환
 * @returns Firebase Timestamp
 */
export function now(): Timestamp {
  return Timestamp.now();
}

/**
 * 상대 시간 포맷팅 (예: "3시간 전", "2일 전")
 * @param timestamp 시간 데이터
 * @returns 포맷된 상대 시간 문자열
 */
export function formatRelativeTime(timestamp: unknown): string {
  try {
    const date = toDate(timestamp);
    
    if (isNaN(date.getTime())) {
      return '방금 전';
    }
    
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return '방금 전';
    } else if (diffInSeconds < 3600) {
      return `${Math.floor(diffInSeconds / 60)}분 전`;
    } else if (diffInSeconds < 86400) {
      return `${Math.floor(diffInSeconds / 3600)}시간 전`;
    } else if (diffInSeconds < 604800) {
      return `${Math.floor(diffInSeconds / 86400)}일 전`;
    } else {
      return formatAbsoluteTime(timestamp, 'short');
    }
  } catch (error) {
    console.error('시간 포맷팅 오류:', error);
    return '방금 전';
  }
}

/**
 * 절대 시간 포맷팅 (예: "2024-01-15", "01-15")
 * @param timestamp 시간 데이터
 * @param format 포맷 형태 ('full' | 'short' | 'time')
 * @returns 포맷된 절대 시간 문자열
 */
export function formatAbsoluteTime(timestamp: unknown, format: 'full' | 'short' | 'time' | 'datetime' = 'short'): string {
  try {
    const date = toDate(timestamp);
    
    if (isNaN(date.getTime())) {
      return '날짜 오류';
    }
    
    switch (format) {
      case 'full':
        return date.toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
      case 'short':
        return date.toLocaleDateString('ko-KR', {
          month: '2-digit',
          day: '2-digit'
        });
      case 'time':
        return date.toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit'
        });
      case 'datetime':
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        return `${year}.${month}.${day} ${hour}:${minute}`;
      default:
        return date.toLocaleDateString('ko-KR');
    }
  } catch (error) {
    console.error('날짜 포맷팅 오류:', error);
    return '날짜 오류';
  }
}

/**
 * 스마트 시간 포맷팅 (상황에 따라 상대/절대 시간 자동 선택)
 * @param timestamp 시간 데이터
 * @returns 포맷된 시간 문자열
 */
export function formatSmartTime(timestamp: unknown): string {
  try {
    const date = toDate(timestamp);
    
    if (isNaN(date.getTime())) {
      return '방금 전';
    }
    
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return '방금 전';
    } else if (diffInHours < 24) {
      return `${diffInHours}시간 전`;
    } else if (diffInHours < 24 * 7) {
      return `${Math.floor(diffInHours / 24)}일 전`;
    } else {
      return formatAbsoluteTime(timestamp, 'short');
    }
  } catch (error) {
    console.error('스마트 시간 포맷팅 오류:', error);
    return '방금 전';
  }
}

/**
 * 한국 시간대 기준 날짜 문자열 생성 (YYYY-MM-DD 형태)
 * @param date 날짜 (선택사항, 기본값: 현재 시간)
 * @returns 한국 시간대 기준 날짜 문자열
 */
export function getKoreanDateString(date: Date = new Date()): string {
  // UTC 시간에 9시간(한국 시간)을 더해서 한국 시간으로 변환
  const koreaTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
  
  // UTC 기준으로 날짜 추출 (이미 한국 시간으로 변환된 상태)
  const year = koreaTime.getUTCFullYear();
  const month = String(koreaTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(koreaTime.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * 두 시간의 차이를 계산
 * @param start 시작 시간
 * @param end 종료 시간 (선택사항, 기본값: 현재 시간)
 * @returns 차이 (milliseconds)
 */
export function timeDiff(start: unknown, end: unknown = now()): number {
  return toTimestamp(end) - toTimestamp(start);
}

/**
 * 시간이 오늘인지 확인
 * @param timestamp 확인할 시간
 * @returns 오늘인지 여부
 */
export function isToday(timestamp: unknown): boolean {
  const date = toDate(timestamp);
  const today = new Date();
  
  return date.getFullYear() === today.getFullYear() &&
         date.getMonth() === today.getMonth() &&
         date.getDate() === today.getDate();
}

// ===== 기존 함수들 (호환성 유지) =====

/**
 * Firestore Timestamp를 number로 변환하는 함수
 * @deprecated formatTimestamp 사용을 권장합니다
 */
export function convertTimestamp(timestamp: unknown): number {
  return toTimestamp(timestamp);
}

/**
 * Post 객체의 Timestamp들을 number로 변환
 * @deprecated 개별 필드에 toTimestamp 사용을 권장합니다
 */
export function serializePost(post: Record<string, unknown>) {
  return {
    ...post,
    createdAt: toTimestamp(post.createdAt),
    updatedAt: toTimestamp(post.updatedAt),
  };
}

/**
 * Comment 객체의 Timestamp들을 number로 변환
 * @deprecated 개별 필드에 toTimestamp 사용을 권장합니다
 */
export function serializeComment(comment: Record<string, unknown>) {
  return {
    ...comment,
    createdAt: toTimestamp(comment.createdAt),
    updatedAt: toTimestamp(comment.updatedAt),
  };
}

/**
 * 서버에서 HTML을 안전하게 sanitize (sanitize-html 사용)
 * 이미지·링크·서식 태그를 보존하고 XSS 위험 요소만 제거
 * img 태그에 lazy loading 속성 자동 추가
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _sanitizeHtml = typeof window === 'undefined' ? require('sanitize-html') : null;

export function sanitizeHtmlServer(content: string): string {
  if (!content) return '';
  const sanitizeHtml = _sanitizeHtml;
  if (!sanitizeHtml) return content;
  return sanitizeHtml(content, {
    allowedTags: [
      'b', 'i', 'em', 'strong', 'u', 'strike', 's',
      'p', 'br', 'div', 'span',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'a', 'img',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height', 'style', 'loading', 'decoding'],
      span: ['class', 'style'],
      div: ['class', 'style'],
      p: ['class', 'style'],
    },
    allowedSchemes: ['http', 'https', 'data'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
      img: (_tagName: string, attribs: Record<string, string>) => ({
        tagName: 'img',
        attribs: {
          ...attribs,
          loading: 'lazy',
          decoding: 'async',
          style: `max-width:100%;height:auto;${attribs.style || ''}`,
        },
      }),
    },
  }) as string;
}

/**
 * HTML 태그를 파싱하여 안전한 HTML로 변환
 */
export async function parseHtmlContent(content: string): Promise<string> {
  if (typeof window === 'undefined') {
    // 서버사이드에서는 HTML 태그 제거하고 줄바꿈 처리
    return content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<\/div>/gi, '\n')
      .replace(/<div[^>]*>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .trim();
  }

  // 클라이언트사이드에서는 DOMPurify 사용
  const DOMPurify = await import('dompurify');
  
  // 먼저 줄바꿈 처리를 위해 HTML 태그를 변환
  const processedContent = content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/div>/gi, '\n')
    .replace(/<div[^>]*>/gi, '');
  
  // 허용할 HTML 태그와 속성 설정 (img 태그 추가)
  const cleanHtml = DOMPurify.default.sanitize(processedContent, {
    ALLOWED_TAGS: ['strong', 'b', 'em', 'i', 'u', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'a', 'img'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'src', 'alt', 'width', 'height', 'style'],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus', 'onblur'],
  });

  // HTML 엔티티 디코딩 및 줄바꿈 정리
  const finalContent = cleanHtml
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();

  return finalContent;
}

/**
 * HTML 태그를 제거하고 순수 텍스트만 반환하는 함수
 * @param html HTML 문자열 또는 일반 텍스트
 * @returns 순수 텍스트
 */
export function stripHtmlTags(html: string): string {
  if (!html) return '';
  
  // <br>, <p> 태그를 줄바꿈으로 변환
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/div>/gi, '\n')
    .replace(/<div[^>]*>/gi, '');
  
  // 다른 HTML 태그 제거
  text = text.replace(/<[^>]*>/g, '');
  
  // HTML 엔티티 디코딩
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
  
  // 앞뒤 공백만 제거 (줄바꿈은 사용자 의도대로 보존)
  text = text.trim();
  
  return text;
}

/**
 * 게시글 내용 미리보기 생성 (HTML 태그 제거 후 일정 길이로 자르기)
 */
export function generatePreviewContent(content: string, maxLength: number = 100): string {
  const textOnly = stripHtmlTags(content);
  return textOnly.length > maxLength 
    ? textOnly.substring(0, maxLength) + '...' 
    : textOnly;
}

/**
 * JSON 형태의 content를 파싱하여 텍스트를 추출하는 함수 (웹용)
 * @param content JSON 문자열 또는 일반 텍스트
 * @returns 추출된 텍스트
 */
export function parseContentText(content: string): string {
  if (!content) return '';
  
  try {
    // JSON 형태인지 확인
    if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
      const parsed = JSON.parse(content);
      
      // TipTap JSON 형태인 경우
      if (parsed.type === 'doc' && parsed.content) {
        return extractTextFromTipTapJson(parsed);
      }
      
      // 다른 JSON 형태인 경우
      return JSON.stringify(parsed);
    }
    
    // HTML 태그가 포함된 경우
    if (content.includes('<') && content.includes('>')) {
      return stripHtmlTags(content);
    }
    
    // 일반 텍스트인 경우 (줄바꿈 보존)
    return content;
  } catch {
    // JSON 파싱 실패 시 HTML 태그 제거 시도
    return stripHtmlTags(content);
  }
}

/**
 * TipTap JSON에서 텍스트를 추출하는 함수
 * @param node TipTap JSON 노드
 * @returns 추출된 텍스트
 */
function extractTextFromTipTapJson(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  
  const nodeObj = node as Record<string, unknown>;
  let text = '';
  
  // 텍스트 노드인 경우
  if (nodeObj.type === 'text') {
    return (nodeObj.text as string) || '';
  }
  
  // 하드 브레이크인 경우
  if (nodeObj.type === 'hardBreak') {
    return '\n';
  }
  
  // 자식 노드들을 재귀적으로 처리
  if (nodeObj.content && Array.isArray(nodeObj.content)) {
    for (const child of nodeObj.content) {
      text += extractTextFromTipTapJson(child);
    }
  }
  
  // 단락 노드인 경우 뒤에 줄바꿈 추가
  if (nodeObj.type === 'paragraph' && text) {
    text += '\n';
  }
  
  return text;
}

/**
 * 텍스트를 지정된 길이로 자르고 말줄임표를 추가하는 함수
 * @param text 원본 텍스트
 * @param maxLength 최대 길이 (기본값: 100)
 * @returns 잘린 텍스트
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (!text) return '';
  
  // 먼저 HTML 태그 제거 및 텍스트 파싱
  const cleanText = parseContentText(text);
  
  if (cleanText.length <= maxLength) {
    return cleanText;
  }
  
  return cleanText.substring(0, maxLength) + '...';
}

/**
 * 텍스트에서 모든 이미지 URL을 추출하는 함수
 * @param content 콘텐츠 텍스트
 * @returns 이미지 URL 배열
 */
export function extractAllImageUrls(content: string): string[] {
  if (!content) return [];
  
  const imageUrls: string[] = [];
  
  // HTML img 태그에서 src 추출
  const imgTagMatches = content.matchAll(/<img[^>]+src="([^"]+)"/gi);
  for (const match of imgTagMatches) {
    imageUrls.push(match[1]);
  }
  
  // 마크다운 이미지 형태 ![alt](url) 추출
  const markdownImgMatches = content.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g);
  for (const match of markdownImgMatches) {
    imageUrls.push(match[1]);
  }
  
  // URL 형태의 이미지 링크 추출
  const urlMatches = content.matchAll(/(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp))/gi);
  for (const match of urlMatches) {
    imageUrls.push(match[1]);
  }
  
  // 중복 제거
  return [...new Set(imageUrls)];
}

/**
 * URL에서 파일명을 추출하여 중복 여부를 판단하는 함수
 * Firebase Storage URL의 특성을 고려하여 중복을 제거
 * @param url 이미지 URL
 * @returns 파일 식별자
 */
function getImageIdentifier(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Firebase Storage URL인 경우 특별 처리
    if (urlObj.hostname.includes('firebasestorage.googleapis.com')) {
      // pathname에서 /o/ 이후의 경로 추출 (URL 디코딩)
      const pathname = urlObj.pathname;
      const oIndex = pathname.indexOf('/o/');
      if (oIndex !== -1) {
        const encodedPath = pathname.substring(oIndex + 3);
        const decodedPath = decodeURIComponent(encodedPath);
        return decodedPath;
      }
    }
    
    // 일반 URL의 경우 pathname 사용
    const pathname = urlObj.pathname;
    
    // 쿼리 파라미터와 프래그먼트 제거하여 순수한 경로만 사용
    return pathname;
  } catch {
    // URL 파싱 실패 시 쿼리 파라미터만 제거한 URL 사용
    return url.split('?')[0].split('#')[0];
  }
}

/**
 * 게시글에서 이미지 URL들을 추출하는 함수 (content와 attachments 모두 고려)
 * @param post 게시글 객체
 * @returns 이미지 URL 배열 (최대 개수 제한 가능)
 */
export function extractPostImageUrls(
  post: { 
    content: string; 
    attachments?: Array<{ type: string; url: string }> 
  }, 
  maxImages: number = 10
): string[] {
  const imageUrls: string[] = [];
  const seenIdentifiers = new Set<string>();
  
  // 1. attachments에서 이미지 타입만 추출
  if (post.attachments && Array.isArray(post.attachments)) {
    const attachmentImages = post.attachments
      .filter(attachment => attachment.type === 'image')
      .map(attachment => attachment.url);
    
    for (const imageUrl of attachmentImages) {
      const identifier = getImageIdentifier(imageUrl);
      if (!seenIdentifiers.has(identifier)) {
        imageUrls.push(imageUrl);
        seenIdentifiers.add(identifier);
      }
    }
  }
  
  // 2. content에서 이미지 URL 추출 (HTML img 태그, 마크다운 이미지, 직접 URL)
  if (post.content) {
    const contentImages = extractAllImageUrls(post.content);
    
    for (const imageUrl of contentImages) {
      const identifier = getImageIdentifier(imageUrl);
      if (!seenIdentifiers.has(identifier)) {
        imageUrls.push(imageUrl);
        seenIdentifiers.add(identifier);
      }
    }
  }
  
  // 최대 개수 제한
  return imageUrls.slice(0, maxImages);
}

/**
 * 게시글 리스트용 이미지 미리보기 URL 추출 (최대 2개)
 * @param post 게시글 객체
 * @returns 이미지 URL 배열 (최대 2개)
 */
export function getPostPreviewImages(
  post: { 
    content: string; 
    attachments?: Array<{ type: string; url: string }> 
  }
): string[] {
  return extractPostImageUrls(post, 2);
}

/**
 * Firebase 객체를 클라이언트에서 사용할 수 있도록 안전하게 직렬화
 * @param obj 직렬화할 Firebase 객체
 * @returns 직렬화된 일반 JavaScript 객체
 */
export function serializeFirebaseObject<T>(obj: T): T {
  try {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }
    
    // 깊은 복사를 통해 원본 수정 방지 및 Firebase 객체 직렬화
    const serialized = JSON.parse(JSON.stringify(obj, (key, value) => {
      // Firebase Timestamp 객체 처리
      if (value && typeof value === 'object') {
        // Firestore Timestamp 객체 감지 (seconds, nanoseconds 속성)
        if ('seconds' in value && 'nanoseconds' in value && typeof value.seconds === 'number') {
          return value.seconds * 1000 + Math.floor(value.nanoseconds / 1000000);
        }
        
        // serverTimestamp() 호출 결과 처리
        if (value._methodName === 'serverTimestamp') {
          return Date.now();
        }
        
        // DocumentReference 처리 (필요한 경우)
        if (value.path && typeof value.path === 'string') {
          return value.path;
        }
      }
      
      return value;
    }));
    
    return serialized as T;
  } catch (error) {
    console.error('Firebase 객체 직렬화 오류:', error);
    
    // 직렬화 실패 시 원본 반환 (위험하지만 fallback)
    console.warn('직렬화 실패, 원본 객체를 반환합니다. 클라이언트에서 오류가 발생할 수 있습니다.');
    return obj;
  }
}

/**
 * 사용자 객체를 클라이언트 컴포넌트에서 사용할 수 있도록 직렬화
 * @param user User 객체
 * @returns 직렬화된 User 객체
 */
export function serializeUserForClient<T extends Record<string, any>>(user: T): T {
  try {
    return serializeFirebaseObject(user);
  } catch (error) {
    console.error('사용자 데이터 직렬화 오류:', error);
    
    // 사용자 객체의 경우 특별한 fallback 처리
    return {
      ...user,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastLoginAt: user.lastLoginAt ? Date.now() : undefined,
      profile: user.profile ? {
        ...user.profile,
        createdAt: Date.now(),
      } : undefined,
    } as T;
  }
}



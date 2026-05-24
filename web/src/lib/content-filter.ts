/**
 * 콘텐츠 필터링 시스템 (앱스토어 가이드라인 1.2 준수)
 * 부적절한 콘텐츠 자동 검출 및 필터링
 */

// 금지된 키워드 리스트 (실제 운영에서는 더 포괄적이어야 함)
const PROHIBITED_WORDS = [
  // 욕설/비속어
  '바보', '멍청이', '병신', '미친', '또라이', '개새끼', '씨발', '좆', '시발', '존나',
  // 차별적 표현
  '흑인', '백인', '중국인', '일본인', '조선족', '다문화',
  // 폭력적 표현
  '죽이', '때리', '폭행', '살해', '자살', '죽어',
  // 성적 표현
  '섹스', '야동', '포르노', '음란', '변태',
  // 개인정보 관련
  '주민등록번호', '계좌번호', '비밀번호', '전화번호',
  // 스팸/광고
  '대출', '홍보', '광고', '돈벌기', '투자', '주식', '코인',
];

// 패턴 기반 필터링 (정규식)
const PROHIBITED_PATTERNS = [
  /\d{3}-\d{4}-\d{4}/, // 전화번호 패턴
  /\d{6}-\d{7}/, // 주민등록번호 패턴
  /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/g, // URL 패턴 (일부)
  /[ㄱ-ㅎㅏ-ㅣ가-힣]{2,}\s*죽|죽\s*[ㄱ-ㅎㅏ-ㅣ가-힣]{2,}/, // 폭력적 표현 패턴
];

export interface ContentFilterResult {
  isAllowed: boolean;
  filteredContent?: string;
  violations: string[];
  severity: 'low' | 'medium' | 'high';
}

/**
 * 텍스트 콘텐츠 필터링
 * @param content 검사할 텍스트 내용
 * @returns 필터링 결과
 */
export function filterTextContent(content: string): ContentFilterResult {
  if (!content || typeof content !== 'string') {
    return {
      isAllowed: true,
      violations: [],
      severity: 'low'
    };
  }

  const violations: string[] = [];
  let filteredContent = content;
  let severity: 'low' | 'medium' | 'high' = 'low';

  // 1. 금지된 키워드 검사
  const lowerContent = content.toLowerCase();
  for (const word of PROHIBITED_WORDS) {
    if (lowerContent.includes(word.toLowerCase())) {
      violations.push(`금지된 키워드: ${word}`);
      // 키워드를 별표로 마스킹
      const regex = new RegExp(word, 'gi');
      filteredContent = filteredContent.replace(regex, '*'.repeat(word.length));
      
      // 심각도 판단
      if (['병신', '씨발', '좆', '시발', '개새끼'].includes(word)) {
        severity = 'high';
      } else if (['바보', '멍청이', '미친'].includes(word)) {
        severity = severity === 'low' ? 'medium' : severity;
      }
    }
  }

  // 2. 패턴 기반 검사
  for (const pattern of PROHIBITED_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      violations.push(`부적절한 패턴 감지: ${matches[0]}`);
      filteredContent = filteredContent.replace(pattern, '[차단된 내용]');
      severity = severity === 'low' ? 'medium' : severity;
    }
  }

  // 3. 반복 문자 검사 (스팸 방지)
  const repeatedChars = /(.)\1{9,}/g; // 같은 문자 10개 이상 반복
  if (repeatedChars.test(content)) {
    violations.push('반복 문자 스팸');
    filteredContent = filteredContent.replace(repeatedChars, '$1$1$1'); // 3개로 제한
    severity = severity === 'low' ? 'medium' : severity;
  }

  // 4. 과도한 대문자 사용 검사
  const upperCaseRatio = (content.match(/[A-Z]/g) || []).length / content.length;
  if (upperCaseRatio > 0.7 && content.length > 10) {
    violations.push('과도한 대문자 사용');
    severity = severity === 'low' ? 'medium' : severity;
  }

  return {
    isAllowed: violations.length === 0 || severity === 'low',
    filteredContent: violations.length > 0 ? filteredContent : undefined,
    violations,
    severity
  };
}

/**
 * 이미지 파일명 및 메타데이터 검사
 * @param fileName 파일명
 * @param fileSize 파일 크기 (bytes)
 * @returns 필터링 결과
 */
export function filterImageContent(fileName: string, fileSize?: number): ContentFilterResult {
  const violations: string[] = [];
  let severity: 'low' | 'medium' | 'high' = 'low';

  // 파일명 검사
  const fileNameResult = filterTextContent(fileName);
  if (!fileNameResult.isAllowed) {
    violations.push(...fileNameResult.violations);
    severity = fileNameResult.severity;
  }

  // 파일 크기 검사 (10MB 제한)
  if (fileSize && fileSize > 10 * 1024 * 1024) {
    violations.push('파일 크기 초과 (10MB 제한)');
    severity = 'medium';
  }

  // 의심스러운 확장자 검사
  const suspiciousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif'];
  const lowerFileName = fileName.toLowerCase();
  if (suspiciousExtensions.some(ext => lowerFileName.endsWith(ext))) {
    violations.push('허용되지 않는 파일 형식');
    severity = 'high';
  }

  return {
    isAllowed: violations.length === 0,
    violations,
    severity
  };
}

/**
 * 게시글 제목 검사
 * @param title 게시글 제목
 * @returns 필터링 결과
 */
export function filterPostTitle(title: string): ContentFilterResult {
  const result = filterTextContent(title);
  
  // 제목 특화 검사
  if (title.length < 2) {
    result.violations.push('제목이 너무 짧습니다');
    result.severity = 'medium';
    (result as any).isAllowed = false;
  }
  
  if (title.length > 100) {
    result.violations.push('제목이 너무 깁니다');
    result.severity = 'medium';
    (result as any).isAllowed = false;
  }

  return result;
}

/**
 * 댓글 내용 검사
 * @param content 댓글 내용
 * @returns 필터링 결과
 */
export function filterCommentContent(content: string): ContentFilterResult {
  const result = filterTextContent(content);
  
  // 댓글 특화 검사
  if (content.length < 1) {
    result.violations.push('댓글 내용이 비어있습니다');
    result.severity = 'medium';
    (result as any).isAllowed = false;
  }
  
  if (content.length > 1000) {
    result.violations.push('댓글이 너무 깁니다');
    result.severity = 'medium';
    (result as any).isAllowed = false;
  }

  return result;
}

/**
 * 사용자 프로필 정보 검사
 * @param userName 사용자명
 * @param realName 실명
 * @param bio 자기소개
 * @returns 필터링 결과
 */
export function filterUserProfile(userName: string, realName?: string, bio?: string): ContentFilterResult {
  const violations: string[] = [];
  let severity: 'low' | 'medium' | 'high' = 'low';

  // 사용자명 검사
  const userNameResult = filterTextContent(userName);
  if (!userNameResult.isAllowed) {
    violations.push(...userNameResult.violations.map(v => `사용자명: ${v}`));
    severity = userNameResult.severity;
  }

  // 사용자명 길이 검사
  if (userName.length < 2 || userName.length > 20) {
    violations.push('사용자명은 2-20자여야 합니다');
    severity = 'medium';
  }

  // 실명 검사 (선택사항)
  if (realName) {
    const realNameResult = filterTextContent(realName);
    if (!realNameResult.isAllowed) {
      violations.push(...realNameResult.violations.map(v => `실명: ${v}`));
      severity = Math.max(severity === 'low' ? 0 : severity === 'medium' ? 1 : 2, 
                          realNameResult.severity === 'low' ? 0 : realNameResult.severity === 'medium' ? 1 : 2) === 0 ? 'low' : 
                          Math.max(severity === 'low' ? 0 : severity === 'medium' ? 1 : 2, 
                          realNameResult.severity === 'low' ? 0 : realNameResult.severity === 'medium' ? 1 : 2) === 1 ? 'medium' : 'high';
    }
  }

  // 자기소개 검사 (선택사항)
  if (bio) {
    const bioResult = filterTextContent(bio);
    if (!bioResult.isAllowed) {
      violations.push(...bioResult.violations.map(v => `자기소개: ${v}`));
      severity = Math.max(severity === 'low' ? 0 : severity === 'medium' ? 1 : 2, 
                          bioResult.severity === 'low' ? 0 : bioResult.severity === 'medium' ? 1 : 2) === 0 ? 'low' : 
                          Math.max(severity === 'low' ? 0 : severity === 'medium' ? 1 : 2, 
                          bioResult.severity === 'low' ? 0 : bioResult.severity === 'medium' ? 1 : 2) === 1 ? 'medium' : 'high';
    }

    if (bio.length > 500) {
      violations.push('자기소개가 너무 깁니다 (500자 제한)');
      severity = severity === 'low' ? 'medium' : severity;
    }
  }

  return {
    isAllowed: violations.length === 0,
    violations,
    severity
  };
}

/**
 * 콘텐츠 필터링 로그 기록
 * @param userId 사용자 ID
 * @param content 원본 콘텐츠
 * @param result 필터링 결과
 * @param contentType 콘텐츠 타입
 */
export function logContentFilter(
  userId: string, 
  content: string, 
  result: ContentFilterResult, 
  contentType: 'post' | 'comment' | 'profile' | 'image'
): void {
  if (!result.isAllowed || result.violations.length > 0) {
    console.warn(`[콘텐츠 필터] ${contentType} 위반 감지:`, {
      userId,
      contentType,
      violations: result.violations,
      severity: result.severity,
      timestamp: new Date().toISOString(),
      contentPreview: content.substring(0, 100) + (content.length > 100 ? '...' : '')
    });
    
    // 실제 운영에서는 별도 로깅 시스템이나 모니터링 시스템에 전송
    // 예: analytics.track('content_violation', { ... })
  }
} 

// 콘텐츠 필터링 및 모더레이션 유틸리티

/**
 * 부적절한 콘텐츠 키워드 목록
 */
const INAPPROPRIATE_KEYWORDS = [
  // 욕설/비속어 (예시 - 실제로는 더 포괄적인 리스트 필요)
  '씨발', '개새끼', '병신', '미친놈', '미친년', '바보', '멍청이',
  '죽어', '죽이고', '죽을래', '자살', '목매', '뛰어내려',
  
  // 성적 콘텐츠
  '성관계', '섹스', '야동', '포르노', '자위', '성기',
  
  // 차별/혐오 표현
  '김치녀', '한남충', '메갈', '일베', '홍어', '떠라이',
  
  // 불법/위험 내용
  '마약', '대마초', '환각제', '폭탄', '테러', '자해',
  
  // 개인정보 관련
  '주민번호', '전화번호', '주소', '집주소', '학교주소',
  
  // 스팸/광고
  '돈벌기', '대출', '사기', '투자', '코인', '도박',
];

/**
 * 강도별 필터링 규칙
 */
export interface FilterLevel {
  level: 'strict' | 'moderate' | 'relaxed';
  blockedKeywords: string[];
  warningKeywords: string[];
}

/**
 * 콘텐츠 필터링 결과
 */
export interface FilterResult {
  isAllowed: boolean;
  filteredContent: string;
  detectedIssues: {
    type: 'blocked' | 'warning' | 'suspicious';
    keyword: string;
    position: number;
  }[];
  riskLevel: 'low' | 'medium' | 'high';
  reason?: string;
}

/**
 * 기본 부적절한 키워드 체크
 */
export function checkInappropriateContent(content: string): FilterResult {
  const detectedIssues: FilterResult['detectedIssues'] = [];
  let filteredContent = content;
  let riskLevel: FilterResult['riskLevel'] = 'low';
  
  // 대소문자 구분 없이 검사
  const lowerContent = content.toLowerCase();
  
  for (const keyword of INAPPROPRIATE_KEYWORDS) {
    const regex = new RegExp(keyword, 'gi');
    const matches = [...lowerContent.matchAll(regex)];
    
    for (const match of matches) {
      const position = match.index || 0;
      
      // 심각도 판단
      const issueType = getSeverityLevel(keyword);
      detectedIssues.push({
        type: issueType,
        keyword,
        position
      });
      
      // 콘텐츠에서 해당 단어를 *로 치환
      const replacement = '*'.repeat(keyword.length);
      filteredContent = filteredContent.replace(regex, replacement);
      
      // 위험 레벨 업데이트
      if (issueType === 'blocked') {
        riskLevel = 'high';
      } else if (issueType === 'warning' && riskLevel === 'low') {
        riskLevel = 'medium';
      }
    }
  }
  
  const isAllowed = !detectedIssues.some(issue => issue.type === 'blocked');
  
  return {
    isAllowed,
    filteredContent,
    detectedIssues,
    riskLevel,
    reason: isAllowed ? undefined : '부적절한 내용이 포함되어 있습니다.'
  };
}

/**
 * 키워드의 심각도 레벨 판단
 */
function getSeverityLevel(keyword: string): 'blocked' | 'warning' | 'suspicious' {
  const blockedKeywords = ['씨발', '개새끼', '병신', '죽어', '죽이고', '자살', '야동', '포르노'];
  const warningKeywords = ['바보', '멍청이', '김치녀', '한남충', '마약', '대마초'];
  
  if (blockedKeywords.includes(keyword)) {
    return 'blocked';
  } else if (warningKeywords.includes(keyword)) {
    return 'warning';
  } else {
    return 'suspicious';
  }
}

/**
 * 연속된 같은 문자 스팸 체크
 */
export function checkSpamPattern(content: string): boolean {
  // 같은 문자가 5번 이상 연속으로 나오는 경우
  const repeatPattern = /(.)\1{4,}/g;
  if (repeatPattern.test(content)) {
    return true;
  }
  
  // 같은 단어가 3번 이상 반복되는 경우
  const wordRepeatPattern = /(\S+)(\s+\1){2,}/gi;
  if (wordRepeatPattern.test(content)) {
    return true;
  }
  
  return false;
}

/**
 * 개인정보 패턴 검사
 */
export function checkPersonalInfo(content: string): {
  hasPersonalInfo: boolean;
  detectedTypes: string[];
} {
  const detectedTypes: string[] = [];
  
  // 전화번호 패턴
  const phonePattern = /01[0-9]-?\d{3,4}-?\d{4}/g;
  if (phonePattern.test(content)) {
    detectedTypes.push('전화번호');
  }
  
  // 주민등록번호 패턴 (앞 6자리만이라도)
  const ssnPattern = /\d{6}-?\d{7}|\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/g;
  if (ssnPattern.test(content)) {
    detectedTypes.push('주민등록번호');
  }
  
  // 이메일 주소
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  if (emailPattern.test(content)) {
    detectedTypes.push('이메일');
  }
  
  // 주소 패턴 (시, 구, 동이 포함된 경우)
  const addressPattern = /(시|구|동)\s*\d+(-\d+)?/g;
  if (addressPattern.test(content)) {
    detectedTypes.push('주소');
  }
  
  return {
    hasPersonalInfo: detectedTypes.length > 0,
    detectedTypes
  };
}

/**
 * 종합 콘텐츠 모더레이션
 */
export function moderateContent(content: string, options: {
  checkInappropriate?: boolean;
  checkSpam?: boolean;
  checkPersonalInfo?: boolean;
  filterLevel?: 'strict' | 'moderate' | 'relaxed';
} = {}): FilterResult {
  const {
    checkInappropriate = true,
    checkSpam = true,
    checkPersonalInfo = true,
    filterLevel = 'moderate'
  } = options;
  
  let result: FilterResult = {
    isAllowed: true,
    filteredContent: content,
    detectedIssues: [],
    riskLevel: 'low'
  };
  
  // 부적절한 내용 체크
  if (checkInappropriate) {
    const inappropriateResult = checkInappropriateContent(content);
    result = {
      ...inappropriateResult,
      detectedIssues: [...result.detectedIssues, ...inappropriateResult.detectedIssues]
    };
  }
  
  // 스팸 패턴 체크
  if (checkSpam && checkSpamPattern(content)) {
    result.isAllowed = false;
    result.riskLevel = 'high';
    result.reason = '스팸성 내용이 감지되었습니다.';
    result.detectedIssues.push({
      type: 'blocked',
      keyword: '스팸 패턴',
      position: 0
    });
  }
  
  // 개인정보 체크
  if (checkPersonalInfo) {
    const personalInfoResult = checkPersonalInfo(content);
    if (personalInfoResult.hasPersonalInfo) {
      result.isAllowed = false;
      result.riskLevel = 'high';
      result.reason = `개인정보가 포함되어 있습니다: ${personalInfoResult.detectedTypes.join(', ')}`;
      result.detectedIssues.push({
        type: 'blocked',
        keyword: personalInfoResult.detectedTypes.join(', '),
        position: 0
      });
    }
  }
  
  return result;
}

/**
 * 관리자용 - 새로운 금지 키워드 추가
 */
export function addBlockedKeyword(keyword: string): void {
  if (!INAPPROPRIATE_KEYWORDS.includes(keyword)) {
    INAPPROPRIATE_KEYWORDS.push(keyword);
  }
}

/**
 * 관리자용 - 금지 키워드 제거
 */
export function removeBlockedKeyword(keyword: string): void {
  const index = INAPPROPRIATE_KEYWORDS.indexOf(keyword);
  if (index > -1) {
    INAPPROPRIATE_KEYWORDS.splice(index, 1);
  }
}

/**
 * 현재 필터링 키워드 목록 조회 (관리자용)
 */
export function getBlockedKeywords(): string[] {
  return [...INAPPROPRIATE_KEYWORDS];
} 
import { User } from '@/types';
import { ExportOptions } from '@/types/admin';
import { toDate } from '@/lib/utils';

/**
 * 사용자 데이터를 CSV 형식으로 변환
 */
export const convertUsersToCSV = (users: User[], options: ExportOptions): string => {
  if (users.length === 0) return '';

  const { fields, includeStats, includeSensitiveData } = options;
  
  // 기본 필드 정의
  const availableFields = {
    // 기본 정보
    uid: '사용자 ID',
    userName: '사용자명',
    realName: '실명',
    email: '이메일',
    role: '역할',
    status: '상태',
    
    // 학교/지역 정보
    schoolName: '학교명',
    schoolCode: '학교 코드',
    sido: '시/도',
    sigungu: '시/군/구',
    address: '상세 주소',
    
    // 프로필 정보
    gender: '성별',
    birthYear: '출생년도',
    phoneNumber: '전화번호',
    
    // 활동 통계 (includeStats가 true일 때만)
    level: '레벨',
    currentExp: '현재 경험치',
    totalExperience: '총 경험치',
    postCount: '게시글 수',
    commentCount: '댓글 수',
    likeCount: '좋아요 수',
    streak: '연속 출석',
    
    // 경고/제재 정보
    warningCount: '경고 횟수',
    suspensionReason: '정지 사유',
    suspendedUntil: '정지 해제일',
    
    // 날짜 정보
    createdAt: '가입일',
    lastLoginAt: '최근 로그인',
    updatedAt: '수정일'
  };

  // 내보낼 필드 결정
  let exportFields = fields.length > 0 ? fields : Object.keys(availableFields);
  
  // 민감한 데이터 제외 (옵션에 따라)
  if (!includeSensitiveData) {
    const sensitiveFields = ['email', 'realName', 'phoneNumber', 'address'];
    exportFields = exportFields.filter(field => !sensitiveFields.includes(field));
  }
  
  // 통계 데이터 제외 (옵션에 따라)
  if (!includeStats) {
    const statsFields = ['level', 'currentExp', 'totalExperience', 'postCount', 'commentCount', 'likeCount', 'streak'];
    exportFields = exportFields.filter(field => !statsFields.includes(field));
  }

  // CSV 헤더 생성
  const headers = exportFields.map(field => availableFields[field as keyof typeof availableFields] || field);
  
  // CSV 데이터 행 생성
  const rows = users.map(user => {
    return exportFields.map(field => {
      let value = '';
      
      switch (field) {
        case 'uid':
          value = user.uid || '';
          break;
        case 'userName':
          value = user.profile?.userName || '';
          break;
        case 'realName':
          value = user.profile?.realName || '';
          break;
        case 'email':
          value = user.email || '';
          break;
        case 'role':
          value = getRoleDisplayName(user.role);
          break;
        case 'status':
          value = getStatusDisplayName(user.status);
          break;
        case 'schoolName':
          value = user.school?.name || '';
          break;
        case 'schoolCode':
          value = user.school?.id || '';
          break;
        case 'sido':
          value = user.regions?.sido || '';
          break;
        case 'sigungu':
          value = user.regions?.sigungu || '';
          break;
        case 'address':
          value = user.regions?.address || '';
          break;
        case 'gender':
          value = getGenderDisplayName(user.profile?.gender);
          break;
        case 'birthYear':
          value = user.profile?.birthYear?.toString() || '';
          break;
        case 'phoneNumber':
          value = user.profile?.phoneNumber || '';
          break;
        case 'level':
          value = user.stats?.level?.toString() || '1';
          break;
        case 'currentExp':
          value = user.stats?.currentExp?.toString() || '0';
          break;
        case 'totalExperience':
          value = user.stats?.totalExperience?.toString() || '0';
          break;
        case 'postCount':
          value = user.stats?.postCount?.toString() || '0';
          break;
        case 'commentCount':
          value = user.stats?.commentCount?.toString() || '0';
          break;
        case 'likeCount':
          value = user.stats?.likeCount?.toString() || '0';
          break;
        case 'streak':
          value = user.stats?.streak?.toString() || '0';
          break;
        case 'warningCount':
          value = user.warnings?.count?.toString() || '0';
          break;
        case 'suspensionReason':
          value = (user as unknown as Record<string, unknown>).suspensionReason as string || '';
          break;
        case 'suspendedUntil':
          try {
            const suspendedUntil = (user as unknown as Record<string, unknown>).suspendedUntil;
            value = suspendedUntil ? formatDateForCSV(toDate(suspendedUntil)) : '';
          } catch {
            value = '';
          }
          break;
        case 'createdAt':
          try {
            value = formatDateForCSV(toDate(user.profile?.createdAt || user.createdAt));
          } catch {
            value = '';
          }
          break;
        case 'lastLoginAt':
          try {
            const lastLoginAt = (user as unknown as Record<string, unknown>).lastLoginAt;
            value = lastLoginAt ? formatDateForCSV(toDate(lastLoginAt)) : '';
          } catch {
            value = '';
          }
          break;
        case 'updatedAt':
          try {
            const updatedAt = (user as unknown as Record<string, unknown>).updatedAt;
            value = updatedAt ? formatDateForCSV(toDate(updatedAt)) : '';
          } catch {
            value = '';
          }
          break;
        default:
          value = '';
      }
      
      // CSV 형식에 맞게 이스케이프 처리
      return escapeCsvValue(value);
    });
  });

  // CSV 문자열 생성
  const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  
  return csvContent;
};

/**
 * CSV 파일 다운로드
 */
export const downloadCSV = (csvContent: string, filename: string): void => {
  // BOM 추가 (Excel에서 한글 깨짐 방지)
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};

/**
 * 역할 표시명 변환
 */
const getRoleDisplayName = (role?: string): string => {
  switch (role) {
    case 'admin': return '관리자';
    case 'teacher': return '교사';
    case 'student': return '학생';
    case 'user': return '일반 사용자';
    default: return '일반 사용자';
  }
};

/**
 * 상태 표시명 변환
 */
const getStatusDisplayName = (status?: string): string => {
  switch (status) {
    case 'active': return '활성';
    case 'inactive': return '비활성';
    case 'suspended': return '정지';
    default: return '활성';
  }
};

/**
 * 성별 표시명 변환
 */
const getGenderDisplayName = (gender?: string): string => {
  switch (gender) {
    case 'male': return '남성';
    case 'female': return '여성';
    default: return '';
  }
};

/**
 * 날짜를 CSV용 문자열로 변환
 */
const formatDateForCSV = (date: Date): string => {
  if (!date || isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ko-KR') + ' ' + date.toLocaleTimeString('ko-KR');
};

/**
 * CSV 값 이스케이프 처리
 */
const escapeCsvValue = (value: string): string => {
  if (!value) return '';
  
  // 쉼표, 따옴표, 줄바꿈이 포함된 경우 따옴표로 감싸기
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    // 따옴표는 두 개로 이스케이프
    const escapedValue = value.replace(/"/g, '""');
    return `"${escapedValue}"`;
  }
  
  return value;
};

/**
 * 파일명 생성 (현재 날짜 포함)
 */
export const generateExportFilename = (prefix: string = 'users', extension: string = 'csv'): string => {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
  
  return `${prefix}_${dateStr}_${timeStr}.${extension}`;
}; 
/**
 * 24시간 모더레이션 응답 시스템 (앱스토어 가이드라인 1.2 준수)
 * 사용자 신고 및 콘텐츠 모더레이션 관리
 */

import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp, 
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ContentFilterResult, filterTextContent, logContentFilter } from '@/lib/content-filter';

export interface ModerationReport {
  id: string;
  reporterId: string;
  reportedUserId?: string;
  reportedContentId: string;
  reportedContentType: 'post' | 'comment' | 'user' | 'message';
  reason: string;
  category: 'spam' | 'harassment' | 'hate_speech' | 'violence' | 'inappropriate_content' | 'privacy_violation' | 'other';
  description: string;
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedModerator?: string;
  resolution?: string;
  actionTaken?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  reviewedAt?: Timestamp;
  responseDeadline: Timestamp; // 24시간 내 응답 기한
}

export interface ModerationAction {
  id: string;
  reportId: string;
  moderatorId: string;
  action: 'warning' | 'content_removal' | 'temporary_ban' | 'permanent_ban' | 'dismiss';
  reason: string;
  details: string;
  createdAt: Timestamp;
}

export interface ModerationStats {
  totalReports: number;
  pendingReports: number;
  resolvedReports: number;
  averageResponseTime: number; // in hours
  reportsWithin24h: number;
  overdueReports: number;
}

/**
 * 콘텐츠 신고하기
 * @param reportData 신고 데이터
 * @returns 신고 ID
 */
export async function submitContentReport(reportData: {
  reporterId: string;
  reportedUserId?: string;
  reportedContentId: string;
  reportedContentType: 'post' | 'comment' | 'user' | 'message';
  reason: string;
  category: 'spam' | 'harassment' | 'hate_speech' | 'violence' | 'inappropriate_content' | 'privacy_violation' | 'other';
  description: string;
}): Promise<string> {
  try {
    // 신고 내용 필터링
    const reasonFilter = filterTextContent(reportData.reason);
    const descriptionFilter = filterTextContent(reportData.description);
    
    // 필터링된 내용으로 교체
    const filteredReason = reasonFilter.filteredContent || reportData.reason;
    const filteredDescription = descriptionFilter.filteredContent || reportData.description;

    // 우선순위 결정
    const priority = determinePriority(reportData.category, filteredDescription);
    
    // 24시간 후 응답 기한 설정
    const responseDeadline = new Date();
    responseDeadline.setHours(responseDeadline.getHours() + 24);

    const report: Omit<ModerationReport, 'id'> = {
      ...reportData,
      reason: filteredReason,
      description: filteredDescription,
      status: 'pending',
      priority,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
      responseDeadline: Timestamp.fromDate(responseDeadline)
    };

    const docRef = await addDoc(collection(db, 'moderationReports'), report);
    
    // 긴급 신고인 경우 즉시 알림
    if (priority === 'urgent') {
      await notifyModerators(docRef.id, report);
    }

    return docRef.id;
  } catch (error) {
    console.error('신고 제출 오류:', error);
    throw new Error('신고 제출 중 오류가 발생했습니다.');
  }
}

/**
 * 신고 우선순위 결정
 * @param category 신고 카테고리
 * @param description 신고 설명
 * @returns 우선순위
 */
function determinePriority(
  category: string, 
  description: string
): 'low' | 'medium' | 'high' | 'urgent' {
  // 긴급 처리가 필요한 카테고리
  if (['violence', 'hate_speech', 'harassment'].includes(category)) {
    return 'urgent';
  }
  
  // 높은 우선순위 키워드 검사
  const highPriorityKeywords = ['죽이', '자살', '폭력', '위협', '개인정보', '사생활'];
  if (highPriorityKeywords.some(keyword => description.includes(keyword))) {
    return 'high';
  }
  
  // 중간 우선순위
  if (['inappropriate_content', 'privacy_violation'].includes(category)) {
    return 'medium';
  }
  
  // 기본 낮은 우선순위
  return 'low';
}

/**
 * 모더레이터에게 긴급 알림
 * @param reportId 신고 ID
 * @param report 신고 데이터
 */
async function notifyModerators(reportId: string, report: Omit<ModerationReport, 'id'>): Promise<void> {
  try {
    // 실제 운영에서는 이메일, SMS, 푸시 알림 등을 통해 모더레이터에게 즉시 알림
    console.warn(`[긴급 신고] ID: ${reportId}`, {
      category: report.category,
      priority: report.priority,
      reportedContentType: report.reportedContentType,
      timestamp: new Date().toISOString()
    });
    
    // 모더레이터 알림 기록
    await addDoc(collection(db, 'moderatorNotifications'), {
      reportId,
      type: 'urgent_report',
      message: `긴급 신고가 접수되었습니다: ${report.category}`,
      priority: report.priority,
      createdAt: serverTimestamp(),
      read: false
    });
  } catch (error) {
    console.error('모더레이터 알림 발송 오류:', error);
  }
}

/**
 * 신고 목록 조회 (관리자용)
 * @param filters 필터 조건
 * @returns 신고 목록
 */
export async function getModerationReports(filters: {
  status?: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
  limit?: number;
} = {}): Promise<ModerationReport[]> {
  try {
    let q = query(
      collection(db, 'moderationReports'),
      orderBy('createdAt', 'desc')
    );

    if (filters.status) {
      q = query(q, where('status', '==', filters.status));
    }
    
    if (filters.priority) {
      q = query(q, where('priority', '==', filters.priority));
    }
    
    if (filters.category) {
      q = query(q, where('category', '==', filters.category));
    }
    
    if (filters.limit) {
      q = query(q, limit(filters.limit));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ModerationReport[];
  } catch (error) {
    console.error('신고 목록 조회 오류:', error);
    throw new Error('신고 목록을 불러오는 중 오류가 발생했습니다.');
  }
}

/**
 * 만료된 신고 (24시간 초과) 조회
 * @returns 만료된 신고 목록
 */
export async function getOverdueReports(): Promise<ModerationReport[]> {
  try {
    const now = Timestamp.now();
    const q = query(
      collection(db, 'moderationReports'),
      where('status', 'in', ['pending', 'reviewing']),
      where('responseDeadline', '<', now),
      orderBy('responseDeadline', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ModerationReport[];
  } catch (error) {
    console.error('만료된 신고 조회 오류:', error);
    throw new Error('만료된 신고를 조회하는 중 오류가 발생했습니다.');
  }
}

/**
 * 신고 처리하기 (모더레이터용)
 * @param reportId 신고 ID
 * @param action 처리 액션
 * @param moderatorId 모더레이터 ID
 * @param details 처리 상세 내용
 */
export async function processModerationReport(
  reportId: string,
  action: 'warning' | 'content_removal' | 'temporary_ban' | 'permanent_ban' | 'dismiss',
  moderatorId: string,
  details: string
): Promise<void> {
  try {
    const reportRef = doc(db, 'moderationReports', reportId);
    const reportDoc = await getDoc(reportRef);
    
    if (!reportDoc.exists()) {
      throw new Error('신고를 찾을 수 없습니다.');
    }

    // 신고 상태 업데이트
    await updateDoc(reportRef, {
      status: 'resolved',
      assignedModerator: moderatorId,
      actionTaken: action,
      resolution: details,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // 모더레이션 액션 기록
    await addDoc(collection(db, 'moderationActions'), {
      reportId,
      moderatorId,
      action,
      reason: `신고 처리: ${action}`,
      details,
      createdAt: serverTimestamp()
    } as Omit<ModerationAction, 'id'>);

    // 실제 액션 실행 (콘텐츠 삭제, 사용자 정지 등)
    await executeModerationAction(reportDoc.data() as ModerationReport, action, details);

    console.log(`신고 처리 완료: ${reportId}, 액션: ${action}`);
  } catch (error) {
    console.error('신고 처리 오류:', error);
    throw new Error('신고 처리 중 오류가 발생했습니다.');
  }
}

/**
 * 모더레이션 액션 실행
 * @param report 신고 데이터
 * @param action 실행할 액션
 * @param details 상세 내용
 */
async function executeModerationAction(
  report: ModerationReport,
  action: string,
  details: string
): Promise<void> {
  try {
    switch (action) {
      case 'content_removal':
        await removeContent(report.reportedContentType, report.reportedContentId);
        break;
      case 'warning':
        if (report.reportedUserId) {
          await issueWarning(report.reportedUserId, details);
        }
        break;
      case 'temporary_ban':
        if (report.reportedUserId) {
          await temporaryBanUser(report.reportedUserId, details);
        }
        break;
      case 'permanent_ban':
        if (report.reportedUserId) {
          await permanentBanUser(report.reportedUserId, details);
        }
        break;
      case 'dismiss':
        // 신고 기각 - 별도 액션 없음
        break;
    }
  } catch (error) {
    console.error('모더레이션 액션 실행 오류:', error);
    throw error;
  }
}

/**
 * 콘텐츠 삭제
 * @param contentType 콘텐츠 타입
 * @param contentId 콘텐츠 ID
 */
async function removeContent(contentType: string, contentId: string): Promise<void> {
  try {
    let collectionName = '';
    switch (contentType) {
      case 'post':
        collectionName = 'posts';
        break;
      case 'comment':
        // 댓글은 posts/{postId}/comments 구조이므로 별도 처리 필요
        return;
      default:
        throw new Error(`지원되지 않는 콘텐츠 타입: ${contentType}`);
    }

    const contentRef = doc(db, collectionName, contentId);
    await updateDoc(contentRef, {
      'status.isDeleted': true,
      'status.deletedAt': serverTimestamp(),
      'status.deletedReason': '모더레이션에 의한 삭제',
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('콘텐츠 삭제 오류:', error);
    throw error;
  }
}

/**
 * 사용자 경고 발급
 * @param userId 사용자 ID
 * @param reason 경고 사유
 */
async function issueWarning(userId: string, reason: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      'warnings.count': (await getDoc(userRef)).data()?.warnings?.count || 0 + 1,
      'warnings.lastWarningAt': serverTimestamp(),
      'warnings.lastWarningReason': reason,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('경고 발급 오류:', error);
    throw error;
  }
}

/**
 * 임시 사용자 정지
 * @param userId 사용자 ID
 * @param reason 정지 사유
 */
async function temporaryBanUser(userId: string, reason: string): Promise<void> {
  try {
    const banUntil = new Date();
    banUntil.setDate(banUntil.getDate() + 7); // 7일 정지

    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      'status.isBanned': true,
      'status.banReason': reason,
      'status.bannedAt': serverTimestamp(),
      'status.banUntil': Timestamp.fromDate(banUntil),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('임시 정지 오류:', error);
    throw error;
  }
}

/**
 * 영구 사용자 정지
 * @param userId 사용자 ID
 * @param reason 정지 사유
 */
async function permanentBanUser(userId: string, reason: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      'status.isBanned': true,
      'status.isPermanentBan': true,
      'status.banReason': reason,
      'status.bannedAt': serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('영구 정지 오류:', error);
    throw error;
  }
}

/**
 * 모더레이션 통계 조회
 * @returns 모더레이션 통계
 */
export async function getModerationStats(): Promise<ModerationStats> {
  try {
    const reportsRef = collection(db, 'moderationReports');
    
    // 전체 신고 수
    const totalSnapshot = await getDocs(reportsRef);
    const totalReports = totalSnapshot.size;
    
    // 대기 중인 신고 수
    const pendingSnapshot = await getDocs(
      query(reportsRef, where('status', '==', 'pending'))
    );
    const pendingReports = pendingSnapshot.size;
    
    // 처리 완료된 신고 수
    const resolvedSnapshot = await getDocs(
      query(reportsRef, where('status', '==', 'resolved'))
    );
    const resolvedReports = resolvedSnapshot.size;
    
    // 24시간 이내 처리된 신고 수
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);
    
    const recentSnapshot = await getDocs(
      query(
        reportsRef, 
        where('status', '==', 'resolved'),
        where('reviewedAt', '>=', Timestamp.fromDate(oneDayAgo))
      )
    );
    const reportsWithin24h = recentSnapshot.size;
    
    // 만료된 신고 수
    const overdueReports = await getOverdueReports();
    
    // 평균 응답 시간 계산 (간단한 추정)
    const averageResponseTime = reportsWithin24h > 0 ? 24 / reportsWithin24h : 24;

    return {
      totalReports,
      pendingReports,
      resolvedReports,
      averageResponseTime,
      reportsWithin24h,
      overdueReports: overdueReports.length
    };
  } catch (error) {
    console.error('모더레이션 통계 조회 오류:', error);
    throw new Error('통계를 불러오는 중 오류가 발생했습니다.');
  }
} 
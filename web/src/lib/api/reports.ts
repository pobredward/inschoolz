import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Report, ReportType, ReportReason, ReportStatus, ReportStats, UserReportRecord } from '@/types';
import { createReportReceivedNotification } from './notifications';
import { toTimestamp } from '@/lib/utils';

// 신고 생성
export async function createReport(data: {
  reason: ReportReason;
  customReason?: string;
  description?: string;
  targetId: string;
  targetType: ReportType;
  targetContent?: string;
  postId?: string; // 댓글 신고 시 필요
  reporterId: string;
  reporterInfo: {
    displayName: string;
    profileImageUrl?: string;
  };
  boardCode?: string;
  schoolId?: string;
  regions?: {
    sido: string;
    sigungu: string;
  };
}): Promise<Report> {
  try {
    // 신고 스팸 방지 검사
    const spamCheck = await checkReportSpam(data.reporterId);
    if (!spamCheck.canReport) {
      throw new Error(spamCheck.reason || '신고할 수 없습니다.');
    }

    // 신고받은 사용자 ID 찾기
    let targetAuthorId: string | null = null;
    
    if (data.targetType === 'user') {
      targetAuthorId = data.targetId;
    } else if (data.targetType === 'post') {
      // 게시글 신고 시 게시글 작성자 ID 조회
      const postDoc = await getDoc(doc(db, 'posts', data.targetId));
      if (postDoc.exists()) {
        targetAuthorId = postDoc.data().authorId;
      }
    } else if (data.targetType === 'comment') {
      // 댓글 신고 시 댓글 작성자 ID 조회
      if (data.postId) {
        const commentDoc = await getDoc(doc(db, 'posts', data.postId, 'comments', data.targetId));
        if (commentDoc.exists()) {
          targetAuthorId = commentDoc.data().authorId;
        }
      }
    }

    // undefined 값들을 제거한 reportData 생성
    const reportData: Omit<Report, 'id'> = {
      reason: data.reason,
      targetId: data.targetId,
      targetType: data.targetType,
      reporterId: data.reporterId,
      reporterInfo: data.reporterInfo,
      status: 'pending',
      createdAt: serverTimestamp(),
      // 조건부로 필드 추가 (undefined 값 제외)
      ...(data.customReason && { customReason: data.customReason }),
      ...(data.description && { description: data.description }),
      ...(data.targetContent && { targetContent: data.targetContent }),
      ...(targetAuthorId && { targetAuthorId }),
      ...(data.postId && { postId: data.postId }),
      ...(data.boardCode && { boardCode: data.boardCode }),
      ...(data.schoolId && { schoolId: data.schoolId }),
      ...(data.regions && { regions: data.regions }),
    };

    const docRef = await addDoc(collection(db, 'reports'), reportData);
    
    const report = {
      id: docRef.id,
      ...reportData,
    };

    // 신고당한 사용자에게 알림 전송
    try {
      // 자기 자신을 신고한 경우는 알림 전송하지 않음
      if (targetAuthorId && targetAuthorId !== data.reporterId) {
        await createReportReceivedNotification(
          targetAuthorId,
          docRef.id,
          data.reporterInfo.displayName,
          data.targetType
        );
      }
    } catch (notificationError) {
      console.error('신고 알림 전송 실패:', notificationError);
      // 알림 전송 실패는 신고 생성 자체를 실패시키지 않음
    }
    
    return report;
  } catch (error) {
    console.error('신고 생성 실패:', error);
    throw error;
  }
}

// 신고 조회 (단일)
export async function getReport(reportId: string): Promise<Report | null> {
  try {
    const docRef = doc(db, 'reports', reportId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as Report;
    }
    
    return null;
  } catch (error) {
    console.error('신고 조회 실패:', error);
    throw error;
  }
}

// 사용자의 신고 내역 조회
export async function getUserReports(userId: string): Promise<UserReportRecord> {
  try {
    console.log('getUserReports 시작, userId:', userId);
    
    // 내가 신고한 내역
    console.log('내가 신고한 내역 조회 시작');
    const reportsMadeQuery = query(
      collection(db, 'reports'),
      where('reporterId', '==', userId)
    );
    const reportsMadeSnap = await getDocs(reportsMadeQuery);
    const reportsMade = reportsMadeSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Report[];
    
    console.log('내가 신고한 내역 개수:', reportsMade.length);
    
    // 클라이언트에서 정렬
    reportsMade.sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt));

    // 나를 신고한 내역 - targetAuthorId 필드 사용
    console.log('나를 신고한 내역 조회 시작');
    let reportsReceived: Report[] = [];
    
    try {
      const reportsReceivedQuery = query(
        collection(db, 'reports'),
        where('targetAuthorId', '==', userId)
      );
      const reportsReceivedSnap = await getDocs(reportsReceivedQuery);
      reportsReceived = reportsReceivedSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Report[];
      
      console.log('targetAuthorId 필드로 나를 신고한 내역 개수:', reportsReceived.length);
    } catch (indexError) {
      console.warn('targetAuthorId 인덱스 에러, fallback 사용:', indexError);
      
      // Fallback: 기존 방식으로 사용자 직접 신고만 조회
      try {
        const userReportsQuery = query(
          collection(db, 'reports'),
          where('targetId', '==', userId),
          where('targetType', '==', 'user')
        );
        const userReportsSnap = await getDocs(userReportsQuery);
        reportsReceived = userReportsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Report[];
        
        console.log('fallback으로 나를 신고한 내역 개수:', reportsReceived.length);
      } catch (fallbackError) {
        console.error('Fallback도 실패:', fallbackError);
        reportsReceived = [];
      }
    }

    // 정렬
    reportsReceived.sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt));

    // 통계 계산
    const stats = {
      totalReportsMade: reportsMade.length,
      totalReportsReceived: reportsReceived.length,
      warningsReceived: reportsReceived.filter(r => r.status === 'resolved' && r.actionTaken?.includes('경고')).length,
      suspensionsReceived: reportsReceived.filter(r => r.status === 'resolved' && r.actionTaken?.includes('정지')).length,
    };

    console.log('신고 기록 통계:', stats);

    const result = {
      reportsMade,
      reportsReceived,
      stats,
    };

    console.log('getUserReports 완료, 결과:', result);
    return result;
  } catch (error) {
    console.error('사용자 신고 내역 조회 실패:', error);
    
    // Firebase 에러의 경우 더 자세한 정보 로깅
    if (error instanceof Error) {
      console.error('에러 메시지:', error.message);
      console.error('에러 스택:', error.stack);
    }
    
    // 기본값 반환으로 앱이 크래시되지 않도록 함
    return {
      reportsMade: [],
      reportsReceived: [],
      stats: {
        totalReportsMade: 0,
        totalReportsReceived: 0,
        warningsReceived: 0,
        suspensionsReceived: 0,
      },
    };
  }
}

// 신고 수정 (사용자가 자신의 신고를 수정)
export async function updateReport(reportId: string, data: {
  reason?: ReportReason;
  customReason?: string;
  description?: string;
}): Promise<void> {
  try {
    const docRef = doc(db, 'reports', reportId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('신고 수정 실패:', error);
    throw error;
  }
}

// 신고 취소 (사용자가 자신의 신고를 삭제)
export async function cancelReport(reportId: string): Promise<void> {
  try {
    const docRef = doc(db, 'reports', reportId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('신고 취소 실패:', error);
    throw error;
  }
}

// 관리자용 - 모든 신고 조회
export async function getReports(
  status?: ReportStatus,
  type?: ReportType,
  pageSize: number = 20,
  lastDoc?: QueryDocumentSnapshot<DocumentData>
): Promise<{ reports: Report[]; lastDoc?: QueryDocumentSnapshot<DocumentData> }> {
  try {
    let q = query(
      collection(db, 'reports'),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );

    if (status) {
      q = query(q, where('status', '==', status));
    }
    if (type) {
      q = query(q, where('type', '==', type));
    }
    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    const querySnapshot = await getDocs(q);
    const reports = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Report[];

    return {
      reports,
      lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1],
    };
  } catch (error) {
    console.error('신고 목록 조회 실패:', error);
    throw error;
  }
}

// 관리자용 - 신고 처리
export async function processReport(
  reportId: string,
  status: ReportStatus,
  adminId: string,
  adminNote?: string,
  actionTaken?: string
): Promise<void> {
  try {
    const docRef = doc(db, 'reports', reportId);
    
    // 기존 신고 정보 조회
    const reportDoc = await getDoc(docRef);
    if (!reportDoc.exists()) {
      throw new Error('신고를 찾을 수 없습니다.');
    }
    
    const reportData = reportDoc.data() as Report;
    
    const updateData: Partial<Report> = {
      status,
      adminId,
      updatedAt: serverTimestamp(),
    };

    if (adminNote) updateData.adminNote = adminNote;
    if (actionTaken) updateData.actionTaken = actionTaken;
    if (status === 'resolved') updateData.resolvedAt = serverTimestamp();

    await updateDoc(docRef, updateData);

    // 신고 처리 완료 알림 전송
    try {
      // 1. 신고자에게 처리 완료 알림
      const { createReportResolvedNotification } = await import('./notifications');
      await createReportResolvedNotification(
        reportData.reporterId,
        reportId,
        reportData.targetType,
        actionTaken || (status === 'resolved' ? '검토 완료' : '반려')
      );

      // 2. 신고당한 사용자에게 제재 알림 (필요한 경우)
      if (status === 'resolved' && actionTaken) {
        let targetUserId: string | null = null;

        if (reportData.targetType === 'user') {
          targetUserId = reportData.targetId;
        } else if (reportData.targetType === 'post') {
          const postDoc = await getDoc(doc(db, 'posts', reportData.targetId));
          if (postDoc.exists()) {
            targetUserId = postDoc.data()?.authorId;
          }
        } else if (reportData.targetType === 'comment' && reportData.postId) {
          const commentDoc = await getDoc(doc(db, 'posts', reportData.postId, 'comments', reportData.targetId));
          if (commentDoc.exists()) {
            targetUserId = commentDoc.data()?.authorId;
          }
        }

        if (targetUserId && targetUserId !== reportData.reporterId) {
          const { createSanctionNotification } = await import('./notifications');
          
          if (actionTaken.includes('경고')) {
            await createSanctionNotification(
              targetUserId,
              'warning',
              `신고 처리 결과: ${actionTaken}`
            );
          } else if (actionTaken.includes('정지')) {
            await createSanctionNotification(
              targetUserId,
              'suspension',
              `신고 처리 결과: ${actionTaken}`,
              actionTaken.includes('일') ? actionTaken : undefined
            );
          }
        }
      }
    } catch (notificationError) {
      console.error('신고 처리 알림 전송 실패:', notificationError);
      // 알림 전송 실패는 신고 처리 자체를 실패시키지 않음
    }
  } catch (error) {
    console.error('신고 처리 실패:', error);
    throw error;
  }
}

// 관리자용 - 신고 통계 조회
export async function getReportStats(): Promise<ReportStats> {
  try {
    const allReportsQuery = query(collection(db, 'reports'));
    const allReportsSnap = await getDocs(allReportsQuery);
    const allReports = allReportsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Report[];

    // 최근 신고 조회
    const recentReportsQuery = query(
      collection(db, 'reports'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const recentReportsSnap = await getDocs(recentReportsQuery);
    const recentReports = recentReportsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Report[];

    // 통계 계산
    const totalReports = allReports.length;
    const pendingReports = allReports.filter(r => r.status === 'pending').length;
    const resolvedReports = allReports.filter(r => r.status === 'resolved').length;
    const rejectedReports = allReports.filter(r => r.status === 'rejected').length;

    // 사유별 통계
    const reportsByReason: Record<ReportReason, number> = {
      spam: 0,
      inappropriate: 0,
      harassment: 0,
      fake: 0,
      copyright: 0,
      privacy: 0,
      violence: 0,
      sexual: 0,
      hate: 0,
      other: 0,
    };

    // 타입별 통계
    const reportsByType: Record<ReportType, number> = {
      post: 0,
      comment: 0,
      user: 0,
    };

    allReports.forEach(report => {
      reportsByReason[report.reason]++;
      reportsByType[report.targetType]++;
    });

    return {
      totalReports,
      pendingReports,
      resolvedReports,
      rejectedReports,
      reportsByReason,
      reportsByType,
      recentReports,
    };
  } catch (error) {
    console.error('신고 통계 조회 실패:', error);
    throw error;
  }
}

// 특정 대상에 대한 신고 조회
export async function getReportsByTarget(
  targetId: string,
  targetType: ReportType
): Promise<Report[]> {
  try {
    const q = query(
      collection(db, 'reports'),
      where('targetId', '==', targetId),
      where('targetType', '==', targetType),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Report[];
  } catch (error) {
    console.error('대상별 신고 조회 실패:', error);
    throw error;
  }
}

// 사용자가 이미 신고했는지 확인
export async function hasUserReported(
  reporterId: string,
  targetId: string,
  targetType: ReportType
): Promise<boolean> {
  try {
    const q = query(
      collection(db, 'reports'),
      where('reporterId', '==', reporterId),
      where('targetId', '==', targetId),
      where('targetType', '==', targetType),
      limit(1)
    );

    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('중복 신고 확인 실패:', error);
    throw error;
  }
} 

// 신고 스팸 방지 검사 (단순화된 버전 - Firebase 인덱스 없이)
export async function checkReportSpam(reporterId: string): Promise<{
  canReport: boolean;
  reason?: string;
  remainingTime?: number;
}> {
  try {
    // 기본적으로 신고 허용
    // 복잡한 스팸 체크는 서버사이드 Cloud Functions에서 처리
    // 중복 신고는 hasUserReported 함수에서 별도 체크
    return { canReport: true };
  } catch (error) {
    console.error('신고 스팸 검사 실패:', error);
    // 에러 발생 시 신고 허용 (안전한 기본값)
    return { canReport: true };
  }
} 
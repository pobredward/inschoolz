import { 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  getCountFromServer,
  Timestamp,
  QueryConstraint
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AdminActionLog } from '@/types/admin';
import { toDate } from '@/lib/utils';

export interface AdminLogListParams {
  page?: number;
  pageSize?: number;
  adminId?: string;
  action?: string;
  targetUserId?: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
  sortOrder?: 'asc' | 'desc';
}

export interface AdminLogListResponse {
  logs: AdminActionLog[];
  totalCount: number;
  hasMore: boolean;
  currentPage: number;
}

/**
 * 관리자 작업 로그 목록 조회
 */
export const getAdminActionLogs = async (params: AdminLogListParams = {}): Promise<AdminLogListResponse> => {
  try {
    const {
      page = 1,
      pageSize = 50,
      adminId,
      action,
      targetUserId,
      dateRange,
      sortOrder = 'desc'
    } = params;

    const logsRef = collection(db, 'adminActionLogs');
    const constraints: QueryConstraint[] = [];

    // 관리자 ID 필터
    if (adminId) {
      constraints.push(where('adminId', '==', adminId));
    }

    // 작업 유형 필터
    if (action) {
      constraints.push(where('action', '==', action));
    }

    // 대상 사용자 ID 필터
    if (targetUserId) {
      constraints.push(where('targetUserId', '==', targetUserId));
    }

    // 날짜 범위 필터
    if (dateRange) {
      if (dateRange.from) {
        constraints.push(where('timestamp', '>=', Timestamp.fromDate(dateRange.from)));
      }
      if (dateRange.to) {
        constraints.push(where('timestamp', '<=', Timestamp.fromDate(dateRange.to)));
      }
    }

    // 정렬 추가
    constraints.push(orderBy('timestamp', sortOrder));

    // 페이지네이션
    const offset = (page - 1) * pageSize;
    constraints.push(limit(pageSize + offset));

    const q = query(logsRef, ...constraints);
    const querySnapshot = await getDocs(q);
    const allLogs: AdminActionLog[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      allLogs.push({ 
        id: doc.id,
        ...data,
        timestamp: toDate(data.timestamp)
      } as AdminActionLog);
    });

    // 페이지네이션 적용
    const logs = allLogs.slice(offset, offset + pageSize);

    // 전체 개수 조회 (필터 조건 적용)
    const countConstraints = constraints.slice(0, -2); // 마지막 2개(orderBy, limit) 제거
    const countQuery = countConstraints.length > 0 
      ? query(logsRef, ...countConstraints)
      : query(logsRef);
    const countSnapshot = await getCountFromServer(countQuery);
    const totalCount = countSnapshot.data().count;

    return {
      logs,
      totalCount,
      hasMore: totalCount > page * pageSize,
      currentPage: page
    };
  } catch (error) {
    console.error('관리자 작업 로그 조회 오류:', error);
    throw new Error('관리자 작업 로그를 조회하는 중 오류가 발생했습니다.');
  }
};

/**
 * 작업 유형별 통계 조회
 */
export const getActionStatistics = async (dateRange?: { from: Date; to: Date }) => {
  try {
    const logsRef = collection(db, 'adminActionLogs');
    const constraints: QueryConstraint[] = [];

    // 날짜 범위 필터
    if (dateRange) {
      if (dateRange.from) {
        constraints.push(where('timestamp', '>=', Timestamp.fromDate(dateRange.from)));
      }
      if (dateRange.to) {
        constraints.push(where('timestamp', '<=', Timestamp.fromDate(dateRange.to)));
      }
    }

    const q = constraints.length > 0 ? query(logsRef, ...constraints) : query(logsRef);
    const querySnapshot = await getDocs(q);
    
    const stats: Record<string, number> = {};
    const adminStats: Record<string, number> = {};
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const action = data.action;
      const adminId = data.adminId;
      
      // 작업 유형별 통계
      stats[action] = (stats[action] || 0) + 1;
      
      // 관리자별 통계
      adminStats[adminId] = (adminStats[adminId] || 0) + 1;
    });

    return {
      actionStats: stats,
      adminStats: adminStats,
      totalLogs: querySnapshot.size
    };
  } catch (error) {
    console.error('작업 통계 조회 오류:', error);
    throw new Error('작업 통계를 조회하는 중 오류가 발생했습니다.');
  }
};

/**
 * 관리자 목록 조회 (로그에 등장하는 관리자들)
 */
export const getAdminList = async (): Promise<{ adminId: string; adminName: string; actionCount: number }[]> => {
  try {
    const logsRef = collection(db, 'adminActionLogs');
    const querySnapshot = await getDocs(logsRef);
    
    const adminMap: Record<string, { name: string; count: number }> = {};
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const adminId = data.adminId;
      const adminName = data.adminName;
      
      if (!adminMap[adminId]) {
        adminMap[adminId] = { name: adminName, count: 0 };
      }
      adminMap[adminId].count++;
    });

    return Object.entries(adminMap).map(([adminId, info]) => ({
      adminId,
      adminName: info.name,
      actionCount: info.count
    })).sort((a, b) => b.actionCount - a.actionCount);
  } catch (error) {
    console.error('관리자 목록 조회 오류:', error);
    throw new Error('관리자 목록을 조회하는 중 오류가 발생했습니다.');
  }
};

/**
 * 작업 유형 목록 조회
 */
export const getActionTypeList = async (): Promise<string[]> => {
  try {
    const logsRef = collection(db, 'adminActionLogs');
    const querySnapshot = await getDocs(logsRef);
    
    const actionTypes = new Set<string>();
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      actionTypes.add(data.action);
    });

    return Array.from(actionTypes).sort();
  } catch (error) {
    console.error('작업 유형 목록 조회 오류:', error);
    throw new Error('작업 유형 목록을 조회하는 중 오류가 발생했습니다.');
  }
};

/**
 * 작업 유형 표시명 변환
 */
export const getActionDisplayName = (action: string): string => {
  const actionNames: Record<string, string> = {
    'role_change': '역할 변경',
    'status_change': '상태 변경',
    'delete_user': '사용자 삭제',
    'add_warning': '경고 추가',
    'update_experience': '경험치 수정',
    'bulk_update': '대량 업데이트'
  };
  
  return actionNames[action] || action;
}; 
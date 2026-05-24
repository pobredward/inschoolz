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
  startAfter, 
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Appeal, AppealStatus } from '@/types';

// 이의제기 생성
export async function createAppeal(data: {
  reportId: string;
  userId: string;
  reason: string;
  description: string;
}): Promise<Appeal> {
  try {
    // 이미 이의제기가 있는지 확인
    const existingAppealQuery = query(
      collection(db, 'appeals'),
      where('reportId', '==', data.reportId),
      where('userId', '==', data.userId),
      limit(1)
    );
    
    const existingAppealSnap = await getDocs(existingAppealQuery);
    if (!existingAppealSnap.empty) {
      throw new Error('이미 이의제기를 신청하셨습니다.');
    }

    const appealData: Omit<Appeal, 'id'> = {
      reportId: data.reportId,
      userId: data.userId,
      reason: data.reason,
      description: data.description,
      status: 'pending',
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'appeals'), appealData);
    
    return {
      id: docRef.id,
      ...appealData,
    };
  } catch (error) {
    console.error('이의제기 생성 실패:', error);
    throw error;
  }
}

// 사용자의 이의제기 조회
export async function getUserAppeals(userId: string): Promise<Appeal[]> {
  try {
    const q = query(
      collection(db, 'appeals'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Appeal[];
  } catch (error) {
    console.error('사용자 이의제기 조회 실패:', error);
    throw error;
  }
}

// 특정 신고에 대한 이의제기 조회
export async function getAppealByReport(reportId: string, userId: string): Promise<Appeal | null> {
  try {
    const q = query(
      collection(db, 'appeals'),
      where('reportId', '==', reportId),
      where('userId', '==', userId),
      limit(1)
    );

    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
    } as Appeal;
  } catch (error) {
    console.error('신고별 이의제기 조회 실패:', error);
    throw error;
  }
}

// 관리자용 - 모든 이의제기 조회
export async function getAppeals(status?: AppealStatus): Promise<Appeal[]> {
  try {
    let q = query(
      collection(db, 'appeals'),
      orderBy('createdAt', 'desc')
    );

    if (status) {
      q = query(q, where('status', '==', status));
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Appeal[];
  } catch (error) {
    console.error('이의제기 목록 조회 실패:', error);
    throw error;
  }
}

// 관리자용 - 이의제기 처리
export async function processAppeal(
  appealId: string,
  status: AppealStatus,
  adminId: string,
  adminNote?: string,
  adminDecision?: string
): Promise<void> {
  try {
    const docRef = doc(db, 'appeals', appealId);
    const updateData: Partial<Appeal> = {
      status,
      adminId,
      updatedAt: serverTimestamp(),
    };

    if (adminNote) updateData.adminNote = adminNote;
    if (adminDecision) updateData.adminDecision = adminDecision;
    if (status === 'approved' || status === 'rejected') {
      updateData.resolvedAt = serverTimestamp();
    }

    await updateDoc(docRef, updateData);

    // 이의제기 승인 시 원본 신고 상태 변경
    if (status === 'approved') {
      const appealDoc = await getDoc(docRef);
      if (appealDoc.exists()) {
        const appealData = appealDoc.data() as Appeal;
        const reportRef = doc(db, 'reports', appealData.reportId);
        await updateDoc(reportRef, {
          status: 'rejected',
          adminNote: `이의제기 승인: ${adminDecision || '이의제기가 승인되었습니다.'}`,
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    console.error('이의제기 처리 실패:', error);
    throw error;
  }
} 
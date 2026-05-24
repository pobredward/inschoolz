import { 
  collection, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  doc, 
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logAdminAction } from './users';

/**
 * 만료된 정지 기간의 사용자들을 자동으로 복구
 */
export const autoUnsuspendExpiredUsers = async (): Promise<{ 
  totalChecked: number; 
  unsuspendedCount: number; 
  restoredUsers: string[] 
}> => {
  try {
    const now = new Date();
    const usersRef = collection(db, 'users');
    
    // 정지 상태이면서 정지 기간이 설정된 사용자들 조회
    const suspendedQuery = query(
      usersRef,
      where('status', '==', 'suspended')
    );
    
    const suspendedSnapshot = await getDocs(suspendedQuery);
    const totalChecked = suspendedSnapshot.size;
    let unsuspendedCount = 0;
    const restoredUsers: string[] = [];
    
    const updatePromises = suspendedSnapshot.docs.map(async (userDoc) => {
      const userData = userDoc.data();
      const suspendedUntil = userData.suspendedUntil;
      
      // suspendedUntil이 없으면 영구 정지이므로 복구하지 않음
      if (!suspendedUntil) {
        return;
      }
      
      try {
        // Firebase Timestamp를 Date로 변환
        let suspendedUntilDate: Date;
        if (suspendedUntil instanceof Timestamp) {
          suspendedUntilDate = suspendedUntil.toDate();
        } else if (suspendedUntil.seconds) {
          suspendedUntilDate = new Date(suspendedUntil.seconds * 1000);
        } else {
          suspendedUntilDate = new Date(suspendedUntil);
        }
        
        // 정지 기간이 만료된 경우에만 복구
        if (suspendedUntilDate <= now) {
          const userRef = doc(db, 'users', userDoc.id);
          
          await updateDoc(userRef, {
            status: 'active',
            suspendedAt: null,
            suspendedUntil: null,
            suspensionReason: null,
            autoRestoreEnabled: null,
            notifyUser: null,
            updatedAt: serverTimestamp()
          });
          
          unsuspendedCount++;
          restoredUsers.push(userDoc.id);
          
          // 관리자 로그 기록
          await logAdminAction({
            adminId: 'system',
            adminName: 'System Auto-Restore',
            action: 'status_change',
            targetUserId: userDoc.id,
            targetUserName: userData.profile?.userName || userData.email || userDoc.id,
            oldValue: 'suspended',
            newValue: 'active',
            reason: '정지 기간 만료로 인한 자동 복구'
          });
          
          console.log(`사용자 ${userDoc.id} 자동 복구 완료`);
        }
      } catch (error) {
        console.error(`사용자 ${userDoc.id} 복구 중 오류:`, error);
      }
    });
    
    await Promise.all(updatePromises);
    
    console.log(`자동 정지 해제 완료: ${unsuspendedCount}/${totalChecked}명 복구`);
    
    return {
      totalChecked,
      unsuspendedCount,
      restoredUsers
    };
  } catch (error) {
    console.error('자동 정지 해제 처리 오류:', error);
    throw new Error('자동 정지 해제 중 오류가 발생했습니다.');
  }
};

/**
 * 특정 사용자의 정지 상태를 수동으로 확인하고 복구
 */
export const checkAndRestoreUser = async (userId: string): Promise<boolean> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', userId)));
    
    if (userDoc.empty) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }
    
    const userData = userDoc.docs[0].data();
    
    if (userData.status !== 'suspended') {
      return false; // 정지 상태가 아님
    }
    
    const suspendedUntil = userData.suspendedUntil;
    if (!suspendedUntil) {
      return false; // 영구 정지
    }
    
    const now = new Date();
    let suspendedUntilDate: Date;
    
    if (suspendedUntil instanceof Timestamp) {
      suspendedUntilDate = suspendedUntil.toDate();
    } else if (suspendedUntil.seconds) {
      suspendedUntilDate = new Date(suspendedUntil.seconds * 1000);
    } else {
      suspendedUntilDate = new Date(suspendedUntil);
    }
    
    // 정지 기간이 만료되지 않음
    if (suspendedUntilDate > now) {
      return false;
    }
    
    // 정지 기간이 만료된 경우 복구
    await updateDoc(userRef, {
      status: 'active',
      suspendedAt: null,
      suspendedUntil: null,
      suspensionReason: null,
      autoRestoreEnabled: null,
      notifyUser: null,
      updatedAt: serverTimestamp()
    });
    
    // 관리자 로그 기록
    await logAdminAction({
      adminId: 'system',
      adminName: 'System Manual-Restore',
      action: 'status_change',
      targetUserId: userId,
      targetUserName: userData.profile?.userName || userData.email || userId,
      oldValue: 'suspended',
      newValue: 'active',
      reason: '정지 기간 만료로 인한 수동 복구'
    });
    
    return true;
  } catch (error) {
    console.error(`사용자 ${userId} 복구 확인 오류:`, error);
    throw error;
  }
}; 
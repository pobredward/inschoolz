/**
 * 휴대폰 번호 정규화 마이그레이션 유틸리티
 * 
 * 사용법:
 * 1. 개발자 도구 콘솔에서 실행
 * 2. 또는 관리자 페이지에서 실행
 * 
 * 주의: 실제 프로덕션에서는 백업 후 실행할 것!
 */

import { collection, getDocs, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * 휴대폰 번호를 한국 표준 형식(010-1234-5678)으로 정규화
 */
export const normalizePhoneNumber = (phoneNumber: string): string => {
  if (!phoneNumber) return '';
  
  // 모든 비숫자 문자 제거
  const numbers = phoneNumber.replace(/\D/g, '');
  
  // +82로 시작하는 경우 처리
  if (phoneNumber.startsWith('+82')) {
    const koreanNumber = numbers.slice(2); // +82 제거
    // 첫 번째 0이 없으면 추가
    const normalizedNumber = koreanNumber.startsWith('1') ? `0${koreanNumber}` : koreanNumber;
    
    // 010-1234-5678 형식으로 포맷팅
    if (normalizedNumber.length === 11) {
      return `${normalizedNumber.slice(0, 3)}-${normalizedNumber.slice(3, 7)}-${normalizedNumber.slice(7)}`;
    }
  }
  
  // 일반적인 010으로 시작하는 경우
  if (numbers.length === 11 && numbers.startsWith('010')) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
  }
  
  // 길이가 10인 경우 (0이 빠진 경우)
  if (numbers.length === 10 && numbers.startsWith('10')) {
    const fullNumber = `0${numbers}`;
    return `${fullNumber.slice(0, 3)}-${fullNumber.slice(3, 7)}-${fullNumber.slice(7)}`;
  }
  
  // 정규화할 수 없는 경우 원본 반환
  return phoneNumber;
};

/**
 * 모든 사용자의 휴대폰 번호를 정규화합니다.
 * 
 * @returns Promise<{success: number, failed: number, total: number}>
 */
export async function migratePhoneNumbers(): Promise<{
  success: number;
  failed: number;
  total: number;
  details: Array<{uid: string, originalPhone: string, normalizedPhone: string, status: 'success' | 'failed' | 'skipped'}>;
}> {
  console.log('🚀 휴대폰 번호 정규화 마이그레이션 시작...');
  
  const results = {
    success: 0,
    failed: 0,
    total: 0,
    details: [] as Array<{uid: string, originalPhone: string, normalizedPhone: string, status: 'success' | 'failed' | 'skipped'}>
  };

  try {
    // 모든 사용자 조회
    const usersRef = collection(db, 'users');
    const querySnapshot = await getDocs(usersRef);
    
    console.log(`📊 총 ${querySnapshot.size}명의 사용자를 발견했습니다.`);
    results.total = querySnapshot.size;

    // Batch 처리를 위한 배치 생성
    const batch = writeBatch(db);
    let batchCount = 0;
    const BATCH_SIZE = 500; // Firestore 배치 제한

    for (const userDoc of querySnapshot.docs) {
      const userData = userDoc.data();
      const originalPhoneNumber = userData.profile?.phoneNumber;
      
      if (!originalPhoneNumber) {
        results.details.push({
          uid: userDoc.id,
          originalPhone: '',
          normalizedPhone: '',
          status: 'skipped'
        });
        continue;
      }

      // 휴대폰 번호 정규화
      const normalizedPhoneNumber = normalizePhoneNumber(originalPhoneNumber);
      
      // 변경이 필요한 경우에만 업데이트
      if (originalPhoneNumber !== normalizedPhoneNumber) {
        console.log(`🔄 ${userDoc.id}: "${originalPhoneNumber}" → "${normalizedPhoneNumber}"`);
        
        try {
          // 배치에 업데이트 추가
          batch.update(doc(db, 'users', userDoc.id), {
            'profile.phoneNumber': normalizedPhoneNumber,
            updatedAt: new Date()
          });
          
          batchCount++;
          results.success++;
          
          results.details.push({
            uid: userDoc.id,
            originalPhone: originalPhoneNumber,
            normalizedPhone: normalizedPhoneNumber,
            status: 'success'
          });

          // 배치가 가득 찬 경우 커밋
          if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            console.log(`💾 ${batchCount}개 사용자 업데이트 완료`);
            batchCount = 0;
          }
          
        } catch (error) {
          console.error(`❌ ${userDoc.id} 업데이트 실패:`, error);
          results.failed++;
          
          results.details.push({
            uid: userDoc.id,
            originalPhone: originalPhoneNumber,
            normalizedPhone: normalizedPhoneNumber,
            status: 'failed'
          });
        }
      } else {
        results.details.push({
          uid: userDoc.id,
          originalPhone: originalPhoneNumber,
          normalizedPhone: normalizedPhoneNumber,
          status: 'skipped'
        });
      }
    }

    // 마지막 배치 커밋
    if (batchCount > 0) {
      await batch.commit();
      console.log(`💾 마지막 ${batchCount}개 사용자 업데이트 완료`);
    }

    console.log('✅ 휴대폰 번호 정규화 마이그레이션 완료!');
    console.log(`📈 결과: 성공 ${results.success}개, 실패 ${results.failed}개, 총 ${results.total}개`);
    
    return results;

  } catch (error) {
    console.error('💥 마이그레이션 중 오류 발생:', error);
    throw error;
  }
}

/**
 * 단일 사용자의 휴대폰 번호를 정규화합니다.
 * 
 * @param uid 사용자 UID
 * @returns Promise<boolean> 성공 여부
 */
export async function normalizeUserPhoneNumber(uid: string): Promise<boolean> {
  try {
    const userDoc = await getDocs(collection(db, 'users').where('__name__', '==', uid));
    
    if (userDoc.empty) {
      console.error(`사용자를 찾을 수 없습니다: ${uid}`);
      return false;
    }

    const userData = userDoc.docs[0].data();
    const originalPhoneNumber = userData.profile?.phoneNumber;
    
    if (!originalPhoneNumber) {
      console.log(`휴대폰 번호가 없는 사용자: ${uid}`);
      return true; // 번호가 없는 것은 정상
    }

    const normalizedPhoneNumber = normalizePhoneNumber(originalPhoneNumber);
    
    if (originalPhoneNumber !== normalizedPhoneNumber) {
      await updateDoc(doc(db, 'users', uid), {
        'profile.phoneNumber': normalizedPhoneNumber,
        updatedAt: new Date()
      });
      
      console.log(`✅ ${uid}: "${originalPhoneNumber}" → "${normalizedPhoneNumber}"`);
      return true;
    } else {
      console.log(`ℹ️ ${uid}: 이미 정규화된 형식입니다.`);
      return true;
    }
    
  } catch (error) {
    console.error(`❌ ${uid} 정규화 실패:`, error);
    return false;
  }
}

// 브라우저 콘솔에서 사용할 수 있도록 전역 함수로 노출
if (typeof window !== 'undefined') {
  (window as any).migratePhoneNumbers = migratePhoneNumbers;
  (window as any).normalizeUserPhoneNumber = normalizeUserPhoneNumber;
  
  console.log('🔧 휴대폰 번호 마이그레이션 유틸리티가 로드되었습니다.');
  console.log('사용법:');
  console.log('  전체 마이그레이션: await migratePhoneNumbers()');
  console.log('  단일 사용자: await normalizeUserPhoneNumber("USER_UID")');
}

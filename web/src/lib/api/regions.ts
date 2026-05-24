import { 
  collection,
  getDocs,
  query,
  where, 
  orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface RegionOption {
  value: string;
  label: string;
}

/**
 * 시/도 목록 조회
 */
export const getSidoList = async (): Promise<RegionOption[]> => {
  try {
    const regionsRef = collection(db, 'regions');
    const regionsQuery = query(
      regionsRef,
      where('type', '==', 'sido'),
      orderBy('name', 'asc')
    );
    
    const regionsSnapshot = await getDocs(regionsQuery);
    const sidoList = regionsSnapshot.docs.map(doc => ({
      value: doc.id,
      label: doc.data().name
    }));
    
    return sidoList;
  } catch (error) {
    console.error('시/도 목록 조회 오류:', error);
    throw new Error('지역 정보를 불러오는데 실패했습니다.');
  }
};

/**
 * 시/군/구 목록 조회
 * @param sidoCode 시/도 코드
 */
export const getSigunguList = async (sidoCode: string): Promise<RegionOption[]> => {
  try {
    if (!sidoCode) {
      return [];
    }
    
    const regionsRef = collection(db, 'regions');
    const regionsQuery = query(
      regionsRef,
      where('type', '==', 'sigungu'),
      where('parentCode', '==', sidoCode),
      orderBy('name', 'asc')
    );
    
    const regionsSnapshot = await getDocs(regionsQuery);
    const sigunguList = regionsSnapshot.docs.map(doc => ({
      value: doc.id,
      label: doc.data().name
    }));
    
    return sigunguList;
  } catch (error) {
    console.error('시/군/구 목록 조회 오류:', error);
    throw new Error('지역 정보를 불러오는데 실패했습니다.');
  }
}; 
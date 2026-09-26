import { ensureUserProfile } from './community-client';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCustomToken,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from './firebase';
import { User } from '../types';
import { generateUserSearchTokens } from '../utils/search-tokens';

/**
 * userName 중복 확인 (대소문자 구분)
 */
export const checkUserNameAvailability = async (userName: string): Promise<boolean> => {
  try {
    const trimmedUserName = userName.trim();
    
    if (trimmedUserName.length < 2) {
      return false;
    }
    
    console.log(`[DEBUG] Checking userName availability for: "${trimmedUserName}"`);
    
    // users 컬렉션에서 정확히 같은 userName이 있는지 확인 (대소문자 구분)
    const usersRef = collection(db, 'publicProfiles');
    const q = query(
      usersRef, 
      where('profile.userName', '==', trimmedUserName)
    );
    
    const querySnapshot = await getDocs(q);
    
    console.log(`[DEBUG] Query result: ${querySnapshot.size} documents found`);
    
    if (!querySnapshot.empty) {
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        console.log(`[DEBUG] Found existing userName: "${userData.profile?.userName}"`);
      });
    }
    
    // 문서가 존재하면 중복, 존재하지 않으면 사용 가능
    const isAvailable = querySnapshot.empty;
    console.log(`[DEBUG] userName "${trimmedUserName}" is ${isAvailable ? 'available' : 'taken'}`);
    
    return isAvailable;
  } catch (error) {
    console.error('userName 중복 확인 오류:', error);
    // 오류 발생시 안전하게 false 반환 (중복으로 간주)
    return false;
  }
};

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
 * 이메일 중복 확인
 */
export const checkEmailExists = async (email: string): Promise<boolean> => {
  // Email uniqueness is enforced by Firebase Authentication at signup.
  return false;

};



/**
 * 이메일/비밀번호로 회원가입
 */
export const registerWithEmail = async (
  userData: { email: string; password: string; userName: string; referral?: string; agreements?: { terms: boolean; privacy: boolean; location: boolean; marketing: boolean } }
): Promise<User> => {
  await createUserWithEmailAndPassword(auth, userData.email.trim(), userData.password);
  return ensureUserProfile({ profile: { userName: userData.userName }, agreements: userData.agreements, referral: userData.referral || undefined });
};

/**
 * 이메일/비밀번호로 로그인
 */
export const loginWithEmail = async (
  email: string,
  password: string
): Promise<User> => {
  await signInWithEmailAndPassword(auth, email.trim(), password);
  return ensureUserProfile();
};

/**
 * Google로 로그인
 */
export const loginWithGoogle = async (): Promise<User> => {
  await signInWithPopup(auth, new GoogleAuthProvider());
  return ensureUserProfile();
};

/**
 * 로그아웃
 */
export const logout = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('로그아웃 오류:', error);
    throw new Error('로그아웃 중 오류가 발생했습니다.');
  }
};

/**
 * 현재 로그인된 사용자 가져오기 (Promise 버전)
 */
export const getCurrentUser = (): Promise<User | null> => {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async user => {
      unsubscribe();
      try { resolve(user ? await ensureUserProfile() : null); } catch (error) { reject(error); }
    });
  });
};







/**
 * 카카오 커스텀 토큰으로 로그인
 */
export const loginWithKakaoToken = async (customToken: string): Promise<User> => {
  await signInWithCustomToken(auth, customToken);
  return ensureUserProfile();
};

/**
 * 카카오 사용자 정보로 Firestore 사용자 생성
 */
export const createKakaoUser = async (
  uid: string,
  kakaoUserInfo: {
    id: number;
    email?: string;
    nickname?: string;
    profileImage?: string;
    gender?: string;
    birthyear?: string;
    birthday?: string;
    phoneNumber?: string;
  }
): Promise<User> => {
  if (auth.currentUser?.uid !== uid) throw new Error('로그인이 필요합니다.');
  return ensureUserProfile();
};

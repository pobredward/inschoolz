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
    const usersRef = collection(db, 'users');
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
  try {
    const trimmedEmail = email.trim().toLowerCase();
    
    if (!trimmedEmail) {
      return false;
    }
    
    console.log(`[DEBUG] Checking email existence for: "${trimmedEmail}"`);
    
    // users 컬렉션에서 이메일 확인
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', trimmedEmail));
    const querySnapshot = await getDocs(q);
    
    console.log(`[DEBUG] Query for email "${trimmedEmail}": ${querySnapshot.size} documents found`);
    
    if (!querySnapshot.empty) {
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        console.log(`[DEBUG] Found existing email: "${userData.email}"`);
      });
      return true;
    }
    
    console.log(`[DEBUG] No duplicate found for email "${trimmedEmail}"`);
    return false;
  } catch (error) {
    console.error('이메일 중복 확인 오류:', error);
    return false;
  }
};



/**
 * 이메일/비밀번호로 회원가입
 */
export const registerWithEmail = async (
  userData: { email: string; password: string; userName: string; referral?: string }
): Promise<User> => {
  const { email, password, userName, referral } = userData;
  try {
    // Firebase 인증으로 계정 생성
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    // 프로필 업데이트
    await updateProfile(firebaseUser, { displayName: userName });
    
    // 검색 토큰 생성
    const searchTokens = generateUserSearchTokens(userName.trim());
    
    // Firestore에 사용자 정보 저장
    const newUser: User = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      role: 'student',
      isVerified: true,
      fake: false, // 실제 사용자 표시
      searchTokens, // 검색 토큰 추가
      profile: {
        userName: userName.trim(),
        realName: '',
        gender: '',
        birthYear: 0,
        birthMonth: 0,
        birthDay: 0,
        phoneNumber: '',
        profileImageUrl: '',
        createdAt: Timestamp.now(),
        isAdmin: false
      },
      stats: {
        level: 1,
        currentExp: 0,
        totalExperience: 0,
        currentLevelRequiredXp: 10,
        postCount: 0,
        commentCount: 0,
        likeCount: 0,
        streak: 0
      },
      agreements: {
        terms: true,
        privacy: true,
        location: false,
        marketing: false
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
    
    // 추천인 처리
    if (referral && referral.trim() !== '') {
      try {
        // 추천인 찾기
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('profile.userName', '==', referral.trim()));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const referrerDoc = querySnapshot.docs[0];
          const referrerId = referrerDoc.id;
          
          // 자기 자신 추천 방지
          if (referrerId !== firebaseUser.uid) {
            // 시스템 설정에서 추천인 경험치 값 가져오기
            const { getExperienceSettings } = await import('./api/admin');
            const expSettings = await getExperienceSettings();
            
            const referrerExp = expSettings.referral?.referrerXP || 30; // 추천인이 받는 경험치
            const refereeExp = expSettings.referral?.refereeXP || 30;   // 추천받은 사람이 받는 경험치
            
            // 추천인 경험치 업데이트 (레벨업 계산 포함)
            const { updateUserExperience } = await import('./experience');
            await updateUserExperience(referrerId, referrerExp);
            
            // 신규 사용자 경험치 업데이트 (레벨업 계산 포함)
            await updateUserExperience(firebaseUser.uid, refereeExp);

            // 신규 사용자에게 추천인 정보 저장
            await updateDoc(doc(db, 'users', firebaseUser.uid), {
              referrerId: referrerId,
              updatedAt: serverTimestamp()
            });

            // 알림 발송
            try {
              const { createReferralNotification, createReferralSuccessNotification } = await import('./api/notifications');
              
              // 추천인에게 알림
              await createReferralNotification(
                referrerId,
                userName,
                firebaseUser.uid,
                referrerExp
              );
              
              // 신규 사용자에게 알림
              await createReferralSuccessNotification(
                firebaseUser.uid,
                referral.trim(),
                referrerId,
                refereeExp
              );
            } catch (notificationError) {
              console.error('추천인 알림 발송 오류:', notificationError);
              // 알림 실패해도 회원가입은 성공으로 처리
            }
          }
        }
      } catch (referralError) {
        console.error('추천인 처리 오류:', referralError);
        // 추천인 처리 실패해도 회원가입은 성공으로 처리
      }
    }
    
    return newUser;
  } catch (error) {
    console.error('회원가입 오류:', error);
    
    if (error instanceof Error && 'code' in error) {
      const firebaseError = error as { code: string };
      if (firebaseError.code === 'auth/email-already-in-use') {
        throw new Error('이미 가입된 이메일 주소입니다.');
      } else if (firebaseError.code === 'auth/weak-password') {
        throw new Error('비밀번호는 최소 6자 이상이어야 합니다.');
      } else if (firebaseError.code === 'auth/invalid-email') {
        throw new Error('유효하지 않은 이메일 형식입니다.');
      }
    }
    
    throw new Error('회원가입 중 오류가 발생했습니다.');
  }
};

/**
 * 이메일/비밀번호로 로그인
 */
export const loginWithEmail = async (
  email: string,
  password: string
): Promise<User> => {
  try {
    // Firebase 인증으로 로그인
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    // Firestore에서 사용자 정보 가져오기
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    
    if (userDoc.exists()) {
      // 마지막 로그인 시간 업데이트
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      return userDoc.data() as User;
    } else {
      throw new Error('사용자 정보를 찾을 수 없습니다.');
    }
  } catch (error) {
    console.error('로그인 오류:', error);
    
    if (error instanceof Error && 'code' in error) {
      const firebaseError = error as { code: string };
      if (firebaseError.code === 'auth/user-not-found') {
        throw new Error('가입되지 않은 이메일입니다.');
      } else if (firebaseError.code === 'auth/wrong-password') {
        throw new Error('비밀번호가 올바르지 않습니다.');
      } else if (firebaseError.code === 'auth/invalid-email') {
        throw new Error('올바르지 않은 이메일 형식입니다.');
      } else if (firebaseError.code === 'auth/invalid-credential') {
        throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
      }
    }
    
    throw new Error('로그인 중 오류가 발생했습니다.');
  }
};

/**
 * Google로 로그인
 */
export const loginWithGoogle = async (): Promise<User> => {
  try {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    const firebaseUser = userCredential.user;
    
    // Firestore에서 사용자 정보 확인
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    
    if (userDoc.exists()) {
      // 기존 사용자: 마지막 로그인 시간 업데이트
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      return userDoc.data() as User;
    } else {
      // 신규 사용자: Firestore에 정보 저장
      const userName = firebaseUser.displayName || '사용자';
      
      // 검색 토큰 생성
      const searchTokens = generateUserSearchTokens(userName);
      
      const newUser: User = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        role: 'student',
        isVerified: true,
        fake: false, // 실제 사용자 표시
        searchTokens, // 검색 토큰 추가
        profile: {
          userName,
          realName: '',
          gender: '',
          birthYear: 0,
          birthMonth: 0,
          birthDay: 0,
          phoneNumber: '',
          profileImageUrl: firebaseUser.photoURL || '',
          createdAt: Timestamp.now(),
          isAdmin: false
        },
        stats: {
          level: 1,
          currentExp: 0,
          totalExperience: 0,
          currentLevelRequiredXp: 10,
          postCount: 0,
          commentCount: 0,
          likeCount: 0,
          streak: 0
        },
        agreements: {
          terms: false,
          privacy: false,
          location: false,
          marketing: false
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
      
      return newUser;
    }
  } catch (error) {
    console.error('Google 로그인 오류:', error);
    throw new Error('Google 로그인 중 오류가 발생했습니다.');
  }
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
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubscribe();
      
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          
          if (userDoc.exists()) {
            resolve(userDoc.data() as User);
          } else {
            resolve(null);
          }
        } catch (error) {
          console.error('사용자 정보 가져오기 오류:', error);
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });
  });
};







/**
 * 카카오 커스텀 토큰으로 로그인
 */
export const loginWithKakaoToken = async (customToken: string): Promise<User> => {
  try {
    // Firebase 커스텀 토큰으로 로그인
    const userCredential = await signInWithCustomToken(auth, customToken);
    const firebaseUser = userCredential.user;
    
    // Firestore에서 사용자 정보 확인
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    
    if (userDoc.exists()) {
      // 기존 사용자: 마지막 로그인 시간 업데이트
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      return userDoc.data() as User;
    } else {
      // 신규 사용자의 경우 별도로 사용자 정보를 생성해야 함
      throw new Error('사용자 정보를 찾을 수 없습니다. 회원가입을 진행해주세요.');
    }
  } catch (error) {
    console.error('카카오 로그인 오류:', error);
    
    if (error instanceof Error && 'code' in error) {
      const firebaseError = error as { code: string };
      if (firebaseError.code === 'auth/invalid-custom-token') {
        throw new Error('유효하지 않은 인증 토큰입니다.');
      } else if (firebaseError.code === 'auth/custom-token-mismatch') {
        throw new Error('인증 토큰이 일치하지 않습니다.');
      }
    }
    
    throw new Error('카카오 로그인 중 오류가 발생했습니다.');
  }
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
  try {
    const userName = kakaoUserInfo.nickname || `카카오사용자${kakaoUserInfo.id}`;
    
    // 검색 토큰 생성
    const searchTokens = generateUserSearchTokens(userName);
    
    const newUser: User = {
      uid,
      email: kakaoUserInfo.email || '',
      role: 'student',
      isVerified: true,
      fake: false, // 실제 사용자 표시
      searchTokens, // 검색 토큰 추가
      profile: {
        userName,
        realName: '',
        gender: kakaoUserInfo.gender === 'female' ? '여성' : 
                kakaoUserInfo.gender === 'male' ? '남성' : '',
        birthYear: kakaoUserInfo.birthyear ? parseInt(kakaoUserInfo.birthyear) : 0,
        birthMonth: kakaoUserInfo.birthday ? parseInt(kakaoUserInfo.birthday.substring(0, 2)) : 0,
        birthDay: kakaoUserInfo.birthday ? parseInt(kakaoUserInfo.birthday.substring(2, 4)) : 0,
        phoneNumber: kakaoUserInfo.phoneNumber || '',
        profileImageUrl: kakaoUserInfo.profileImage || '',
        createdAt: Timestamp.now(),
        isAdmin: false
      },
      stats: {
        level: 1,
        currentExp: 0,
        totalExperience: 0,
        currentLevelRequiredXp: 10,
        postCount: 0,
        commentCount: 0,
        likeCount: 0,
        streak: 0
      },
      agreements: {
        terms: true,
        privacy: true,
        location: false,
        marketing: false
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    await setDoc(doc(db, 'users', uid), newUser);
    
    return newUser;
  } catch (error) {
    console.error('카카오 사용자 생성 오류:', error);
    throw new Error('사용자 정보 생성 중 오류가 발생했습니다.');
  }
};

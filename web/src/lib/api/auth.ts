import { communityCommand } from '../community-client';
import { ensureUserProfile } from '../community-client';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { auth, db, storage } from '@/lib/firebase';
import { FormDataType, User } from '@/types';
import { FirebaseError } from 'firebase/app';
import { generateUserSearchTokens } from '@/utils/search-tokens';

/**
 * 추천인 아이디 검증 함수
 */
export async function validateReferralCode(referralCode: string): Promise<{
  isValid: boolean;
  user?: {
    uid: string;
    userName: string;
    displayName: string;
  };
  message?: string;
}> {
  if (!referralCode || referralCode.trim() === '') {
    return {
      isValid: false,
      message: '추천인 아이디를 입력해주세요.'
    };
  }

  try {
    // users 컬렉션에서 userName으로 검색
    const usersRef = collection(db, 'publicProfiles');
    const q = query(usersRef, where('profile.userName', '==', referralCode.trim()));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return {
        isValid: false,
        message: '존재하지 않는 사용자입니다.'
      };
    }

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data() as User;

    return {
      isValid: true,
      user: {
        uid: userDoc.id,
        userName: userData.profile.userName,
        displayName: userData.profile.userName
      }
    };
  } catch (error) {
    console.error('추천인 검증 오류:', error);
    return {
      isValid: false,
      message: '추천인 검증 중 오류가 발생했습니다.'
    };
  }
}
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';


/**
 * 회원가입 함수
 */
export const signUp = async (userData: FormDataType): Promise<{ user: User }> => {
  if (!userData.email || !userData.password) throw new Error('이메일과 비밀번호를 입력해주세요.');
  if (!userData.agreements.terms || !userData.agreements.privacy) throw new Error('필수 약관에 동의해주세요.');
  await createUserWithEmailAndPassword(auth, userData.email.trim(), userData.password);
  const user = await ensureUserProfile({
    profile: { userName: userData.userName, realName: userData.realName, gender: userData.gender, birthYear: userData.birthYear || undefined, birthMonth: userData.birthMonth || undefined, birthDay: userData.birthDay || undefined, phoneNumber: userData.phoneNumber },
    school: userData.school?.id ? userData.school : undefined,
    regions: userData.regions?.sido && userData.regions?.sigungu ? userData.regions : undefined,
    agreements: userData.agreements, favorites: userData.favorites,
  });
  if (userData.profileImage) {
    const { updateProfileImage } = await import('./users');
    await updateProfileImage(user.uid, userData.profileImage);
  }
  return { user };

};

/**
 * 로그인 함수
 */
export const signIn = async (email: string, password: string): Promise<User> => {
  await signInWithEmailAndPassword(auth, email.trim(), password);
  return ensureUserProfile();
};

/**
 * 로그아웃 함수
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
 * 비밀번호 재설정 이메일 발송
 */
export const sendPasswordReset = async (email: string): Promise<void> => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: unknown) {
    console.error('비밀번호 재설정 이메일 발송 오류:', error);
    
    if (error instanceof FirebaseError && error.code === 'auth/user-not-found') {
      throw new Error('등록되지 않은 이메일 주소입니다.');
    }
    
    throw new Error('비밀번호 재설정 이메일 발송 중 오류가 발생했습니다.');
  }
};

/**
 * 현재 로그인한 사용자 정보 가져오기
 */
export const getCurrentUser = async (): Promise<User | null> => {
  return auth.currentUser ? ensureUserProfile() : null;
};

/**
 * 이메일 인증 상태 확인
 */
export const checkEmailVerification = async (): Promise<boolean> => {
  if (!auth.currentUser) {
    return false;
  }
  
  try {
    // 현재 사용자의 정보를 서버에서 새로고침
    await auth.currentUser.reload();
    return auth.currentUser.emailVerified;
  } catch (error) {
    console.error('이메일 인증 상태 확인 오류:', error);
    return false;
  }
};

/**
 * 인증 필요 상태 확인
 * 로그인 상태이지만 이메일 인증이 필요한 경우를 확인
 */
export const requiresEmailVerification = async (): Promise<boolean> => {
  if (!auth.currentUser) {
    return false;
  }
  
  try {
    await auth.currentUser.reload();
    return !auth.currentUser.emailVerified;
  } catch (error) {
    console.error('인증 필요 상태 확인 오류:', error);
    return false;
  }
};

/**
 * 계정 완전 삭제 (앱스토어 가이드라인 5.1.1(v) 준수)
 * @param password 현재 비밀번호
 */
export const deleteUserAccount = async (password: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('다시 로그인해주세요.');
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  await communityCommand('account.delete');
  await signOut(auth);
};

/**
 * 사용자 콘텐츠 익명화 처리
 * @param userId 삭제할 사용자 ID
 */
const anonymizeUserContent = async (userId: string): Promise<void> => {
  try {
    const batch = writeBatch(db);
    
    // 사용자가 작성한 게시글 익명화
    const postsQuery = query(
      collection(db, 'posts'),
      where('authorId', '==', userId)
    );
    const postsSnapshot = await getDocs(postsQuery);
    
    postsSnapshot.forEach((postDoc) => {
      batch.update(postDoc.ref, {
        'authorInfo.displayName': '삭제된 계정',
        'authorInfo.profileImageUrl': '',
        'authorInfo.isAnonymous': true,
        // authorId는 유지하되 실제 조회 시 처리
        updatedAt: serverTimestamp()
      });
    });
    
    // 사용자가 작성한 댓글들도 익명화 (모든 게시글의 댓글 서브컬렉션 확인)
    // 참고: 이 부분은 Cloud Functions에서 처리하는 것이 더 효율적
    console.log(`사용자 ${userId}의 콘텐츠 익명화 처리 완료`);
    
    await batch.commit();
  } catch (error) {
    console.error('콘텐츠 익명화 처리 오류:', error);
    // 익명화 실패해도 계정 삭제는 진행 (부분적 삭제 허용)
  }
};
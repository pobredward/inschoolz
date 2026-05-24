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
    const usersRef = collection(db, 'users');
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
  try {
    if (!userData.email || !userData.password) {
      throw new Error('이메일과 비밀번호는 필수 입력 항목입니다.');
    }

    // userName 중복 체크 (보안 강화)
    if (userData.userName) {
      const { checkUserNameAvailability } = await import('./users');
      const userNameCheck = await checkUserNameAvailability(userData.userName);
      if (!userNameCheck.isAvailable) {
        throw new Error(userNameCheck.message);
      }
    }

    // 이메일 중복 체크 (보안 강화)
    if (userData.email) {
      const { checkEmailAvailability } = await import('./users');
      const emailCheck = await checkEmailAvailability(userData.email);
      if (!emailCheck.isAvailable) {
        throw new Error(emailCheck.message);
      }
    }

    // 이메일/비밀번호로 Firebase Auth 계정 생성
    const userCredential = await createUserWithEmailAndPassword(
      auth, 
      userData.email, 
      userData.password
    );
    
    const userId = userCredential.user.uid;
    
    // 프로필 이미지 업로드 처리
    let profileImageUrl = '';
    if (userData.profileImage) {
      try {
        // 파일 확장자 추출
        const fileExtension = userData.profileImage.name.split('.').pop();
        const fileName = `${userId}_${Date.now()}.${fileExtension}`;
        const storageRef = ref(storage, `profile_images/${fileName}`);
        
        // 이미지 업로드
        await uploadBytes(storageRef, userData.profileImage);
        
        // 다운로드 URL 가져오기
        profileImageUrl = await getDownloadURL(storageRef);
      } catch (imageError) {
        console.error('프로필 이미지 업로드 오류:', imageError);
        // 이미지 업로드 실패해도 회원가입은 계속 진행
      }
    }
    
    // 사용자 프로필 정보 설정 (userName)
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, {
        displayName: userData.userName,
        photoURL: profileImageUrl
      });
    }
    
    // 검색 토큰 생성
    const searchTokens = generateUserSearchTokens(
      userData.userName,
      userData.realName,
      userData.school?.name
    );
    
    // Firestore에 사용자 데이터 저장 (통일된 구조 - Timestamp 사용)
    const userDocRef = doc(db, 'users', userId);
    
    // 기본 사용자 데이터 구조 (undefined 필드 제거, Timestamp 사용)
    const userDoc: User = {
      uid: userId,
      email: userData.email,
      role: 'student',
      status: 'active', // 기본 상태를 'active'로 설정
      isVerified: true, // 이메일 인증 없이 바로 인증된 상태로 처리
      fake: false, // 실제 사용자 표시
      searchTokens, // 검색 토큰 추가
      
      // 프로필 정보 (선택사항 필드들은 값이 있을 때만 저장)
      profile: {
        userName: userData.userName,
        realName: userData.realName,
        ...(userData.gender && { gender: userData.gender }),
        ...(userData.birthYear && { birthYear: Number(userData.birthYear) }),
        ...(userData.birthMonth && { birthMonth: Number(userData.birthMonth) }),
        ...(userData.birthDay && { birthDay: Number(userData.birthDay) }),
        ...(userData.phoneNumber && { phoneNumber: userData.phoneNumber }),
        profileImageUrl: profileImageUrl,
        createdAt: serverTimestamp(), // Timestamp를 밀리초로 변환
        isAdmin: false
      },
      
      // 경험치/통계
      stats: {
        level: 1,
        totalExperience: 0,
        currentExp: 0,
        currentLevelRequiredXp: 10,
        postCount: 0,
        commentCount: 0,
        likeCount: 0,
        streak: 0
      },
      
      // 약관 동의
      agreements: {
        terms: userData.agreements.terms,
        privacy: userData.agreements.privacy,
        location: userData.agreements.location,
        marketing: userData.agreements.marketing
      },
      
      // 시스템 정보 (Timestamp 사용)
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    } as User;
    
    // 학교 정보가 있는 경우에만 추가 (추가 필드들도 저장)
    if (userData.school && userData.school.id && userData.school.id.trim() !== '') {
      userDoc.school = {
        id: userData.school.id,
        name: userData.school.name || '',
        grade: userData.school.grade,
        classNumber: userData.school.classNumber,
        studentNumber: userData.school.studentNumber,
        isGraduate: userData.school.isGraduate,
      };
    }
    
    // 즐겨찾기 학교 정보 추가 (favoriteSchools 배열 또는 favorites 객체 사용)
    const favoriteSchoolIds = userData.favorites?.schools || userData.favoriteSchools || [];
    
    // 선택한 메인 학교가 즐겨찾기에 없으면 추가
    if (userData.school?.id && !favoriteSchoolIds.includes(userData.school.id)) {
      favoriteSchoolIds.unshift(userData.school.id); // 메인 학교를 첫 번째로
    }
    
    if (favoriteSchoolIds.length > 0) {
      userDoc.favorites = {
        schools: favoriteSchoolIds.slice(0, 5), // 최대 5개로 제한
        boards: userData.favorites?.boards || []
      };
    }
    
    // 지역 정보가 있는 경우에만 추가 (앱과 동일한 로직)
    if (userData.regions && userData.regions.sido && userData.regions.sigungu) {
      userDoc.regions = {
        sido: userData.regions.sido,
        sigungu: userData.regions.sigungu,
        address: userData.regions.address || ''
      };
    }
    
    // 추천인 정보가 있는 경우에만 추가
    if (userData.referral && userData.referral.trim() !== '') {
      userDoc.referrerId = userData.referral;
    }
    
    // Firestore에 저장
    await setDoc(userDocRef, userDoc);
    
    // 선택한 학교가 있는 경우, 학교의 멤버 카운트와 즐겨찾기 카운트 증가
    if (userData.school && userData.school.id && userData.school.id.trim() !== '') {
      try {
        const schoolRef = doc(db, 'schools', userData.school.id);
        const schoolDoc = await getDoc(schoolRef);
        
        if (schoolDoc.exists()) {
          const schoolData = schoolDoc.data();
          const currentMemberCount = schoolData.memberCount || 0;
          const currentFavoriteCount = schoolData.favoriteCount || 0;
          
          await updateDoc(schoolRef, {
            memberCount: currentMemberCount + 1,
            favoriteCount: currentFavoriteCount + 1 // 즐겨찾기 카운트도 증가
          });
        }
      } catch (schoolError) {
        console.error('학교 멤버 카운트 및 즐겨찾기 카운트 업데이트 오류:', schoolError);
        // 학교 업데이트 실패해도 회원가입은 성공으로 처리
      }
    }
    
    // 추천 아이디가 있는 경우 추천 보상 처리 (앱과 동일한 로직)
    if (userData.referral && userData.referral.trim() !== '') {
      try {
        // 추천인 찾기
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('profile.userName', '==', userData.referral));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const referrerDoc = querySnapshot.docs[0];
          const referrerId = referrerDoc.id;
          
          // 시스템 설정에서 추천인 경험치 값 가져오기
          const { getExperienceSettings } = await import('./admin');
          const expSettings = await getExperienceSettings();
          
          const referrerExp = expSettings.referral?.referrerXP || 30; // 추천인이 받는 경험치
          const refereeExp = expSettings.referral?.refereeXP || 30;   // 추천받은 사람이 받는 경험치
          
          // 추천인 경험치 업데이트 (레벨업 계산 포함)
          const { updateUserExperience } = await import('../experience');
          await updateUserExperience(referrerId, referrerExp);
          
          // 신규 사용자 경험치 업데이트 (레벨업 계산 포함)
          await updateUserExperience(userId, refereeExp);

          // 알림 발송
          try {
            const { createReferralNotification, createReferralSuccessNotification } = await import('./notifications');
            
            // 1. 추천인에게 알림 발송
            await createReferralNotification(
              referrerId,
              userData.userName,
              userId,
              referrerExp // 추천인이 받은 경험치 정보 포함
            );

            // 2. 추천받은 사용자(신규 가입자)에게 성공 알림 발송
            const referrerData = referrerDoc.data();
            const referrerName = referrerData?.profile?.userName || '추천인';
            await createReferralSuccessNotification(
              userId,
              referrerName,
              referrerId,
              refereeExp // 추천받은 사용자가 받은 경험치 정보 포함
            );
          } catch (notificationError) {
            console.error('추천인 알림 발송 실패:', notificationError);
            // 알림 발송 실패는 회원가입 자체를 실패시키지 않음
          }
          
          console.log('추천 보상 처리 완료:', userData.referral);
        }
      } catch (referralError) {
        console.error('추천 보상 처리 오류:', referralError);
        // 추천 보상 실패해도 회원가입은 성공으로 처리
      }
    }

    return { user: userDoc };
  } catch (error) {
    console.error('회원가입 오류:', error);
    
    // Firebase 에러 메시지를 사용자 친화적으로 변환
    if (error instanceof FirebaseError) {
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('이미 가입된 이메일 주소입니다.');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('비밀번호는 최소 6자 이상이어야 합니다.');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('유효하지 않은 이메일 형식입니다.');
      }
    }
    
    throw new Error('회원가입 중 오류가 발생했습니다.');
  }
};

/**
 * 로그인 함수
 */
export const signIn = async (email: string, password: string): Promise<User> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const userId = userCredential.user.uid;
    
    // Firestore에서 사용자 정보 가져오기 (단일 문서)
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      throw new Error('사용자 정보를 찾을 수 없습니다.');
    }
    
    // 사용자 정보 반환 (이미 중첩 필드를 포함하고 있음)
    const userData = userDoc.data();
    return {
      ...userData,
      uid: userId
    } as User;
  } catch (error: unknown) {
    console.error('로그인 오류:', error);
    
    // Firebase 에러 메시지를 사용자 친화적으로 변환
    if (error instanceof FirebaseError) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        throw new Error('이메일 또는 비밀번호가 일치하지 않습니다.');
      } else if (error.code === 'auth/invalid-credential') {
        throw new Error('유효하지 않은 로그인 정보입니다.');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('잠시 후 다시 시도해주세요.');
      }
    }
    
    throw new Error('로그인 중 오류가 발생했습니다.');
  }
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
  if (!auth.currentUser) {
    return null;
  }
  
  const userId = auth.currentUser.uid;
  
  try {
    // Firestore에서 사용자 정보 가져오기 (단일 문서)
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      return null;
    }
    
    // 사용자 정보 반환 (이미 중첩 필드를 포함하고 있음)
    const userData = userDoc.data();
    return {
      ...userData,
      uid: userId
    } as User;
  } catch (error) {
    console.error('사용자 정보 조회 오류:', error);
    return null;
  }
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
  if (!auth.currentUser) {
    throw new Error('로그인이 필요합니다.');
  }

  try {
    const userId = auth.currentUser.uid;
    
    // 재인증
    const credential = EmailAuthProvider.credential(auth.currentUser.email!, password);
    await reauthenticateWithCredential(auth.currentUser, credential);
    
    // 1. 사용자가 작성한 게시글/댓글의 작성자 정보를 익명화
    await anonymizeUserContent(userId);
    
    // 2. Firestore에서 사용자 문서 완전 삭제
    await deleteDoc(doc(db, 'users', userId));
    
    // 3. Firebase 인증 계정 삭제
    await deleteUser(auth.currentUser);
    
  } catch (error) {
    console.error('계정 삭제 오류:', error);
    if (error instanceof FirebaseError) {
      if (error.code === 'auth/wrong-password') {
        throw new Error('비밀번호가 일치하지 않습니다.');
      }
    }
    throw new Error('계정 삭제 중 오류가 발생했습니다.');
  }
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
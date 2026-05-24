'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signOut as firebaseSignOut,
  GoogleAuthProvider, 
  signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { useRouter } from 'next/navigation';

// 인증 컨텍스트 타입 정의
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  isAdmin: boolean;
}

// 기본 컨텍스트 값
const initialAuthContext: AuthContextType = {
  user: null,
  loading: true,
  signOut: async () => {},
  signInWithGoogle: async () => {},
  isAdmin: false,
};

// 컨텍스트 생성
const AuthContext = createContext<AuthContextType>(initialAuthContext);

// 컨텍스트 훅
export const useAuth = () => useContext(AuthContext);

// 인증 제공자 컴포넌트
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  // 사용자 권한 정보 가져오기
  const fetchUserRole = async (uid: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setIsAdmin(userData.role === 'admin');
      }
    } catch (error) {
      console.error('사용자 권한 정보 조회 오류:', error);
    }
  };

  // 인증 상태 변경 감지
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        await fetchUserRole(user.uid);
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 로그아웃
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      router.push('/');
    } catch (error) {
      console.error('로그아웃 오류:', error);
    }
  };

  // 구글 로그인
  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // 신규 회원 정보 저장
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          profile: {
            userName: user.displayName || '',
            email: user.email || '',
            realName: '',
            gender: '',
            birthYear: 0,
            birthMonth: 0,
            birthDay: 0,
            phoneNumber: '',
            profileImageUrl: user.photoURL || '',
            createdAt: serverTimestamp(),
            isAdmin: false
          },
          role: 'user',
          createdAt: new Date(),
        });
      }
      
      router.push('/');
    } catch (error) {
      console.error('구글 로그인 오류:', error);
    }
  };

  const value = {
    user,
    loading,
    signOut,
    signInWithGoogle,
    isAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 
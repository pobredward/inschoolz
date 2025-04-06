// hooks/useAuth.ts

import { useEffect, useState, useCallback } from "react";
import { useRecoilValue, useSetRecoilState, useRecoilState } from "recoil";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { userState, userExperienceState, userLevelState } from "../store/atoms";
import { User } from "../types";
import { useSignup } from "./useSignup";
import { useLogin } from "./useLogin";
import { useLogout } from "./useLogout";

export const useAuth = () => {
  const [user, setUser] = useRecoilState(userState);
  const [loading, setLoading] = useState(true);
  const signup = useSignup();
  const login = useLogin();
  const logout = useLogout();
  const setUserExperience = useSetRecoilState(userExperienceState);
  const setUserLevel = useSetRecoilState(userLevelState);

  // 사용자 상태 초기화 함수를 useCallback으로 메모이제이션
  const resetUserState = useCallback(() => {
    setUser(null);
    setUserExperience(0);
    setUserLevel(1);
  }, [setUser, setUserExperience, setUserLevel]);
  
  // 사용자 데이터 처리 함수를 useCallback으로 메모이제이션
  const handleAuthStateChanged = useCallback(async (firebaseUser) => {
    if (firebaseUser) {
      try {
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));

        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData) {
            const user: User = {
              uid: firebaseUser.uid,
              userId: userData.userId || "",
              email: firebaseUser.email,
              name: userData.name || firebaseUser.displayName,
              address1: userData.address1 || "",
              address2: userData.address2 || "",
              schoolId: userData.schoolId || "",
              schoolName: userData.schoolName || "",
              grade: userData.grade || "",
              classNumber: userData.classNumber || "",
              experience: userData.experience || 0,
              totalExperience: userData.totalExperience || 0,
              level: userData.level || 1,
              birthYear: userData.birthYear || "",
              birthMonth: userData.birthMonth || "",
              birthDay: userData.birthDay || "",
              phoneNumber: userData.phoneNumber || "",
              profileImageUrl: userData.profileImageUrl || "",
              warnings: userData.warnings || [],
              isAdmin: userData.isAdmin || false,
              favoriteSchools: userData.favoriteSchools || [],
            };
            setUser(user);
            setUserExperience(user.experience);
            setUserLevel(user.level);
          } else {
            console.error("User data not found in Firestore");
            resetUserState();
          }
        } else {
          console.error("User document does not exist");
          setUser(null);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        resetUserState();
      }
    } else {
      resetUserState();
    }
    setLoading(false);
  }, [resetUserState, setUser, setUserExperience, setUserLevel]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, handleAuthStateChanged);
    return () => unsubscribe();
  }, [handleAuthStateChanged]);

  return { user, loading, signup, login, logout };
};

// hooks/useAuthStateManager.ts

import { useEffect, useCallback } from "react";
import { auth, db } from "../lib/firebase";
import { User } from "../types";
import { doc, getDoc } from "firebase/firestore";
import { errorMessages } from "../utils/errorMessages";
import { signInWithEmailAndPassword } from "firebase/auth";

export const useAuthStateManager = () => {
  const updateUserState = useCallback(async (firebaseUser: any) => {
    if (firebaseUser) {
      try {
        const cachedUser = localStorage.getItem(`user_${firebaseUser.uid}`);
        let userData: User;

        if (cachedUser) {
          userData = JSON.parse(cachedUser);
        } else {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            userData = userDoc.data() as User;
            const userToCache: Partial<User> = {
              uid: userData.uid,
              name: userData.name,
              userId: userData.userId,
              experience: userData.experience,
              totalExperience: userData.totalExperience,
              level: userData.level,
            };
            localStorage.setItem(
              `user_${firebaseUser.uid}`,
              JSON.stringify(userToCache),
            );
          } else {
            throw new Error(errorMessages.USER_NOT_FOUND);
          }
        }

        return userData;
      } catch (error) {
        console.error(errorMessages.USER_DATA_FETCH_ERROR, error);
        return null;
      }
    } else {
      localStorage.removeItem(`user_${firebaseUser?.uid}`);
      return null;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(updateUserState);
    return () => unsubscribe();
  }, [updateUserState]);

  const login = async (email: string, password: string) => {
    if (!isValidPassword(password)) {
      throw new Error(errorMessages.INVALID_PASSWORD);
    }
    await signInWithEmailAndPassword(auth, email, password);
  };

  return { login, updateUserState };
};

const isValidPassword = (password: string): boolean => {
  return password.length >= 8;
};

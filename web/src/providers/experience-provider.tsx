"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { ExperienceAlert, ExperienceAlertContextType } from "@/components/ui/experience-alert";
import { User } from "@/types";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/providers/AuthProvider";

// 확장된 컨텍스트 타입
interface ExtendedExperienceContextType extends ExperienceAlertContextType {
  userStats: {
    level: number;
    currentExp: number;
    currentLevelRequiredXp: number;
  } | null;
  refreshUserStats: () => void;
}

// 컨텍스트 생성
export const ExperienceContext = createContext<ExtendedExperienceContextType | null>(null);

// 컨텍스트 훅
export const useExperience = () => {
  const context = useContext(ExperienceContext);
  if (!context) {
    throw new Error("useExperience must be used within ExperienceProvider");
  }
  return context;
};

// 프로바이더 props
interface ExperienceProviderProps {
  children: ReactNode;
}

// 경험치 프로바이더 컴포넌트
export function ExperienceProvider({ children }: ExperienceProviderProps) {
  const { user } = useAuth();
  
  // 사용자 통계 상태
  const [userStats, setUserStats] = useState<{
    level: number;
    currentExp: number;
    currentLevelRequiredXp: number;
  } | null>(null);

  // 경험치 획득 알림 상태
  const [expGainState, setExpGainState] = useState({
    show: false,
    xp: 0,
    message: "",
  });

  // 레벨업 알림 상태
  const [levelUpState, setLevelUpState] = useState({
    show: false,
    xp: 0,
    oldLevel: 1,
    newLevel: 1,
  });

  // 사용자 통계 새로고침
  const refreshUserStats = () => {
    // 현재 사용자 정보 가져오기는 AuthProvider에서 처리
    // 여기서는 실시간 업데이트만 담당
  };

  // Firebase 실시간 리스너 설정
  useEffect(() => {
    // 인증된 사용자가 있는 경우에만 리스너 설정
    if (!user?.uid) return;

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const userData = doc.data() as User;
        setUserStats({
          level: userData.stats?.level || 1,
          currentExp: userData.stats?.currentExp || 0,
          currentLevelRequiredXp: userData.stats?.currentLevelRequiredXp || 10,
        });
      }
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // 경험치 획득 알림 표시
  const showExpGain = (xp: number, message?: string) => {
    setExpGainState({
      show: true,
      xp,
      message: message || "",
    });
  };

  // 레벨업 알림 표시
  const showLevelUp = (xp: number, oldLevel: number, newLevel: number) => {
    setLevelUpState({
      show: true,
      xp,
      oldLevel,
      newLevel,
    });
  };

  return (
    <ExperienceContext.Provider
      value={{
        showExpGain,
        showLevelUp,
        userStats,
        refreshUserStats,
      }}
    >
      {children}

      {/* 경험치 획득 알림 */}
      <ExperienceAlert
        show={expGainState.show}
        onClose={() => setExpGainState((prev) => ({ ...prev, show: false }))}
        xp={expGainState.xp}
        message={expGainState.message}
        type="gain"
      />

      {/* 레벨업 알림 */}
      <ExperienceAlert
        show={levelUpState.show}
        onClose={() => setLevelUpState((prev) => ({ ...prev, show: false }))}
        xp={levelUpState.xp}
        oldLevel={levelUpState.oldLevel}
        newLevel={levelUpState.newLevel}
        type="levelup"
      />
    </ExperienceContext.Provider>
  );
} 
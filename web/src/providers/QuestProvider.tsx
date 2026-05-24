'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { QuestStep, UserQuestProgress } from '@/types';
import { 
  initializeUserQuests, 
  getUserQuestProgress, 
  getCurrentQuestStep,
  trackQuestAction,
  setQuestCompletedCallback,
  QuestActionType,
  QUEST_GUIDES,
} from '@/lib/quests/questService';
import { tutorialChain } from '@/lib/quests/chains/tutorial';
import QuestCompletedModal from '@/components/quests/QuestCompletedModal';

interface QuestContextType {
  // 퀘스트 상태
  questProgress: UserQuestProgress | null;
  currentStep: QuestStep | null;
  currentProgress: number;
  currentTarget: number;
  isLoading: boolean;
  
  // 가이드 정보
  currentGuide: {
    howTo: string;
    where: string;
    tip?: string;
  } | null;
  
  // 액션
  trackAction: (actionType: QuestActionType, metadata?: { 
    boardId?: string; 
    isOtherSchool?: boolean; 
    reactionTime?: number; 
    tileGameMoves?: number;
    consecutiveDays?: number;
  }) => Promise<void>;
  refreshProgress: () => Promise<void>;
}

const QuestContext = createContext<QuestContextType | undefined>(undefined);

export function useQuest() {
  const context = useContext(QuestContext);
  if (context === undefined) {
    throw new Error('useQuest must be used within a QuestProvider');
  }
  return context;
}

interface QuestProviderProps {
  children: ReactNode;
}

export function QuestProvider({ children }: QuestProviderProps) {
  const { user, firebaseUser } = useAuth();
  const [questProgress, setQuestProgress] = useState<UserQuestProgress | null>(null);
  const [currentStep, setCurrentStep] = useState<QuestStep | null>(null);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [currentTarget, setCurrentTarget] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  
  // 완료 모달 상태
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [completedStep, setCompletedStep] = useState<QuestStep | null>(null);
  const [completedRewards, setCompletedRewards] = useState<{ xp: number; badge?: string; title?: string } | null>(null);
  
  // 현재 가이드
  const currentGuide = currentStep ? QUEST_GUIDES[currentStep.id] : null;
  
  // 퀘스트 완료 콜백 등록
  useEffect(() => {
    setQuestCompletedCallback((step, rewards) => {
      console.log('🎉 퀘스트 완료 콜백 호출:', step.title);
      setCompletedStep(step);
      setCompletedRewards(rewards);
      setShowCompletedModal(true);
    });
  }, []);
  
  // 퀘스트 진행 상태 로드
  const loadQuestProgress = useCallback(async () => {
    const userId = firebaseUser?.uid || user?.uid;
    if (!userId) {
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      
      // 퀘스트 진행 상태 조회 (없으면 초기화)
      let progress = await getUserQuestProgress(userId);
      if (!progress) {
        progress = await initializeUserQuests(userId);
      }
      
      setQuestProgress(progress);
      
      // 현재 단계 조회
      const current = await getCurrentQuestStep(userId);
      if (current) {
        setCurrentStep(current.step);
        setCurrentProgress(current.progress);
        setCurrentTarget(current.target);
      } else {
        // 튜토리얼 완료 상태
        setCurrentStep(null);
        setCurrentProgress(0);
        setCurrentTarget(0);
      }
    } catch (error) {
      console.error('❌ 퀘스트 로드 오류:', error);
    } finally {
      setIsLoading(false);
    }
  }, [firebaseUser?.uid, user?.uid]);
  
  // 초기 로드
  useEffect(() => {
    loadQuestProgress();
  }, [loadQuestProgress]);
  
  // 퀘스트 액션 추적
  const trackAction = useCallback(async (
    actionType: QuestActionType,
    metadata?: { 
      boardId?: string; 
      isOtherSchool?: boolean; 
      reactionTime?: number; 
      tileGameMoves?: number;
      consecutiveDays?: number;
    }
  ) => {
    const userId = firebaseUser?.uid || user?.uid;
    if (!userId) {
      console.warn('⚠️ 퀘스트 트래킹 실패: userId 없음');
      return;
    }
    
    console.log(`📍 퀘스트 액션 추적 시작: ${actionType}`, { 
      userId, 
      metadata,
      currentStep: currentStep?.id,
      currentProgress: `${currentProgress}/${currentTarget}`
    });
    
    const result = await trackQuestAction(userId, actionType, user || undefined, metadata);
    
    console.log('📊 퀘스트 트래킹 결과:', result);
    
    if (result) {
      // 진행도 업데이트
      if (result.newProgress !== undefined) {
        setCurrentProgress(result.newProgress);
      }
      
      // 완료된 경우 다음 단계로 갱신
      if (result.completed) {
        console.log('🎉 퀘스트 완료! 다음 단계로 이동');
        await loadQuestProgress();
      }
    } else {
      console.warn('⚠️ 퀘스트 트래킹 결과 없음 (이미 완료되었거나 조건 불일치)');
    }
  }, [firebaseUser?.uid, user?.uid, user, loadQuestProgress, currentStep, currentProgress, currentTarget]);
  
  // 진행 상태 새로고침
  const refreshProgress = useCallback(async () => {
    await loadQuestProgress();
  }, [loadQuestProgress]);
  
  return (
    <QuestContext.Provider
      value={{
        questProgress,
        currentStep,
        currentProgress,
        currentTarget,
        isLoading,
        currentGuide,
        trackAction,
        refreshProgress,
      }}
    >
      {children}
      
      {/* 퀘스트 완료 모달 */}
      <QuestCompletedModal
        isOpen={showCompletedModal}
        onClose={() => setShowCompletedModal(false)}
        step={completedStep}
        rewards={completedRewards}
      />
    </QuestContext.Provider>
  );
}








'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { useQuest } from '@/providers/QuestProvider';
import { tutorialChain } from '@/lib/quests/chains/tutorial';
import { newbieGrowthChain } from '@/lib/quests/chains/newbie-growth';
import { QUEST_GUIDES, questChains, chainOrder } from '@/lib/quests/questService';
import { QuestStep, UserQuestProgress, QuestChain } from '@/types';

export default function TutorialQuestPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { questProgress, refreshProgress, isLoading } = useQuest();
  
  const [expandedChains, setExpandedChains] = useState<string[]>([]);

  // 진행 중인 체인 찾기
  const getActiveChainId = () => {
    if (!questProgress) return 'tutorial';
    
    for (const chainId of chainOrder) {
      const chainProgress = questProgress.chains[chainId];
      if (chainProgress && chainProgress.status === 'in_progress') {
        return chainId;
      }
    }
    
    return 'tutorial';
  };
  
  // 초기 확장 상태 설정 및 자동 해금 체크
  useEffect(() => {
    if (questProgress) {
      const activeChainId = getActiveChainId();
      setExpandedChains([activeChainId]);
      
      // 🆕 자동 해금 체크: tutorial 완료 시 newbie-growth 자동 생성
      checkAndUnlockNextChain();
    }
  }, [questProgress]);
  
  // 다음 체인 자동 해금 함수
  const checkAndUnlockNextChain = async () => {
    if (!questProgress || !user?.uid) return;
    
    // tutorial이 완료되었는데 newbie-growth가 없으면 생성
    const tutorialProgress = questProgress.chains.tutorial;
    const newbieProgress = questProgress.chains['newbie-growth'];
    
    if (tutorialProgress?.status === 'completed' && !newbieProgress) {
      console.log('🔓 tutorial 완료됨, newbie-growth 자동 생성 중...');
      
      try {
        const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        
        const nextChain = questChains['newbie-growth'];
        const firstStep = nextChain.steps[0];
        
        const questRef = doc(db, 'quests', user.uid);
        await updateDoc(questRef, {
          [`chains.newbie-growth`]: {
            currentStep: 1,
            status: 'in_progress',
            startedAt: serverTimestamp(),
            stepProgress: {
              [firstStep.id]: {
                status: 'in_progress',
                progress: 0,
                target: firstStep.objective.target,
              },
            },
          },
          updatedAt: serverTimestamp(),
        });
        
        console.log('✅ newbie-growth 체인 생성 완료!');
        
        // 퀘스트 진행 상태 새로고침
        await refreshProgress();
      } catch (error) {
        console.error('❌ newbie-growth 생성 오류:', error);
      }
    }
  };
  
  const toggleChain = (chainId: string) => {
    setExpandedChains(prev =>
      prev.includes(chainId)
        ? prev.filter(id => id !== chainId)
        : [...prev, chainId]
    );
  };
  
  const renderChainCard = (chainId: string) => {
    const chain = questChains[chainId];
    const chainProgress = questProgress?.chains[chainId];
    const isExpanded = expandedChains.includes(chainId);
    const isActive = chainProgress?.status === 'in_progress';
    const isCompleted = chainProgress?.status === 'completed';
    const isLocked = !chainProgress || chainProgress.status === 'locked';
    
    // 완료된 단계 수 계산
    const completedSteps = chain.steps.filter(step => {
      const stepProgress = chainProgress?.stepProgress[step.id];
      return stepProgress?.status === 'completed';
    }).length;
    
    const currentStepNum = chainProgress?.currentStep || 0;
    const progressPercent = (currentStepNum / chain.totalSteps) * 100;
    
    return (
      <div
        key={chainId}
        className={`bg-white rounded-xl shadow-sm mb-4 overflow-hidden ${
          isActive ? 'ring-2 ring-blue-500' : ''
        } ${isCompleted ? 'border-2 border-green-500' : ''}`}
      >
        {/* 체인 헤더 */}
        <button
          onClick={() => !isLocked && toggleChain(chainId)}
          className="w-full p-6 text-left hover:bg-gray-50 transition-colors"
          disabled={isLocked}
        >
          <div className="flex items-center gap-4">
            <span className={`text-5xl ${isLocked ? 'grayscale opacity-50' : ''}`}>
              {isLocked ? '🔒' : chain.icon}
            </span>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-2xl font-bold text-gray-900">{chain.name}</h2>
                {isActive && (
                  <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                    진행 중
                  </span>
                )}
                {isCompleted && (
                  <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-1 rounded-full">
                    완료
                  </span>
                )}
                {isLocked && (
                  <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                    잠김
                  </span>
                )}
              </div>
              <p className="text-gray-600 mb-3">{chain.description}</p>
              
              {/* 진행도 바 */}
              {!isLocked && (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">진행도</span>
                    <span className="text-sm font-bold text-blue-600">
                      {completedSteps} / {chain.totalSteps}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isCompleted ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </>
              )}
            </div>
            {!isLocked && (
              <span className={`text-2xl transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                ▼
              </span>
            )}
          </div>
        </button>
        
        {/* 체인 상세 (펼쳤을 때) */}
        {isExpanded && !isLocked && (
          <div className="px-6 pb-6">
            <div className="space-y-4">
              {chain.steps.map((step, index) => renderStep(chain, step, chainProgress))}
            </div>
            
            {/* 완료 보상 */}
            <div className="mt-6 p-6 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl border-2 border-amber-200">
              <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
                <span>🏆</span> {isCompleted ? '체인 완료 보상' : '완료 시 획득 가능'}
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⭐</span>
                  <span className="font-semibold text-gray-900">{chain.completionRewards.xp} XP</span>
                </div>
                {chain.completionRewards.title && (
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">👑</span>
                    <span className="font-semibold text-gray-900">칭호: {chain.completionRewards.title}</span>
                  </div>
                )}
                {chain.completionRewards.badge && (
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🎖️</span>
                    <span className="font-semibold text-gray-900">배지: {chain.completionRewards.badge}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };
  
  const renderStep = (chain: QuestChain, step: QuestStep, chainProgress: any) => {
    const stepProgress = chainProgress?.stepProgress[step.id];
    const isCompleted = stepProgress?.status === 'completed';
    const isInProgress = stepProgress?.status === 'in_progress';
    const isLocked = !stepProgress || stepProgress.status === 'locked';
    
    const progressValue = stepProgress?.progress || 0;
    const targetValue = step.objective.target;
    const stepProgressPercent = targetValue > 0 ? (progressValue / targetValue) * 100 : 0;
    
    const guide = QUEST_GUIDES[step.id];
    
    if (isLocked) {
      return (
        <div key={step.id} className="bg-gray-100 rounded-lg p-4 opacity-50">
          <div className="flex items-center gap-3">
            <span className="text-2xl grayscale">🔒</span>
            <div>
              <div className="text-sm font-medium text-gray-500">단계 {step.step}</div>
              <p className="text-sm text-gray-400">잠김</p>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div
        key={step.id}
        className={`rounded-lg p-4 border-2 ${
          isCompleted ? 'bg-green-50 border-green-500' : ''
        } ${isInProgress ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-200'}`}
      >
        <div className="flex items-start gap-3 mb-3">
          <div className="relative">
            <span className="text-4xl">{step.icon}</span>
            {isCompleted && (
              <span className="absolute -bottom-1 -right-1 bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                ✓
              </span>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-gray-500">단계 {step.step}</span>
              {isCompleted && (
                <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                  완료
                </span>
              )}
              {isInProgress && (
                <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                  진행 중
                </span>
              )}
            </div>
            <h4 className="font-bold text-gray-900 mb-1">{step.title}</h4>
            <p className="text-sm text-gray-600">{step.description}</p>
          </div>
        </div>
        
        {isInProgress && (
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600 italic">"{step.storyText}"</p>
            </div>
            
            {guide && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <h5 className="text-xs font-bold text-amber-800 mb-1 flex items-center gap-1">
                  <span>📍</span> 어떻게 하나요?
                </h5>
                <p className="text-xs text-amber-700">{guide.howTo}</p>
              </div>
            )}
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-gray-700">진행도</span>
                <span className="text-xs font-bold text-blue-600">
                  {progressValue} / {targetValue}
                </span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${stepProgressPercent}%` }}
                />
              </div>
            </div>
          </div>
        )}
        
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">보상:</span>
          <div className="flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
            <span>⭐</span> {step.rewards.xp} XP
          </div>
          {step.rewards.title && (
            <div className="flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-1 rounded-full text-xs font-medium">
              <span>👑</span> {step.rewards.title}
            </div>
          )}
        </div>
      </div>
    );
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">퀘스트 불러오는 중...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-700 font-medium mb-4 flex items-center gap-2"
          >
            <span>←</span>
            <span>뒤로가기</span>
          </button>
          <div className="flex items-center gap-4">
            <span className="text-6xl">🎮</span>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">퀘스트</h1>
              <p className="text-gray-600 mt-1">모든 퀘스트 체인을 확인하세요</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* 컨텐츠 */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {chainOrder.map(chainId => renderChainCard(chainId))}
      </div>
    </div>
  );
}

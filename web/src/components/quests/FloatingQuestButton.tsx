'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { useQuest } from '@/providers/QuestProvider';
import { tutorialChain } from '@/lib/quests/chains/tutorial';
import { newbieGrowthChain } from '@/lib/quests/chains/newbie-growth';
import { QUEST_GUIDES, questChains, chainOrder } from '@/lib/quests/questService';

export default function FloatingQuestButton() {
  const router = useRouter();
  const { user, firebaseUser, isLoading: authLoading } = useAuth();
  const { currentStep, currentProgress, currentTarget, currentGuide, questProgress, isLoading: questLoading, refreshProgress } = useQuest();
  
  const [showPreview, setShowPreview] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ 
    x: typeof window !== 'undefined' ? window.innerWidth - 80 : 0, 
    y: typeof window !== 'undefined' ? window.innerHeight / 2 - 30 : 0 
  });
  
  const buttonRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0, startX: 0, startY: 0 });
  
  // 현재 진행 중인 체인 찾기
  const getActiveChain = () => {
    if (!questProgress) return { chainId: 'tutorial', chain: tutorialChain, chainProgress: null };
    
    for (const chainId of chainOrder) {
      const chainProgress = questProgress.chains[chainId];
      if (chainProgress && chainProgress.status === 'in_progress') {
        return {
          chainId,
          chain: questChains[chainId],
          chainProgress,
        };
      }
    }
    
    // 진행 중인 체인이 없으면 tutorial 반환
    return { chainId: 'tutorial', chain: tutorialChain, chainProgress: questProgress.chains.tutorial };
  };
  
  const { chainId: activeChainId, chain: activeChain, chainProgress: activeChainProgress } = getActiveChain();
  const currentStepNum = activeChainProgress?.currentStep || 1;
  const isCompleted = activeChainProgress?.status === 'completed';
  
  useEffect(() => {
    // 항상 표시 (로그인 여부 무관)
    setIsVisible(true);
  }, [firebaseUser?.uid, user?.uid]);
  
  useEffect(() => {
    // 초기 위치 설정 (클라이언트에서만)
    if (typeof window !== 'undefined') {
      setPosition({
        x: window.innerWidth - 80,
        y: window.innerHeight / 2 - 30,
      });
    }
  }, []);
  
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
      startX: e.clientX,
      startY: e.clientY,
    };
  };
  
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || typeof window === 'undefined') return;
    
    const newX = Math.max(0, Math.min(e.clientX - dragStart.current.x, window.innerWidth - 60));
    const newY = Math.max(0, Math.min(e.clientY - dragStart.current.y, window.innerHeight - 60));
    
    setPosition({ x: newX, y: newY });
  };
  
  const handleMouseUp = (e: MouseEvent) => {
    if (isDragging) {
      const distance = Math.sqrt(
        Math.pow(e.clientX - dragStart.current.startX, 2) +
        Math.pow(e.clientY - dragStart.current.startY, 2)
      );
      
      // 작은 드래그는 클릭으로 처리 (10px 이하)
      if (distance < 10) {
        if (firebaseUser?.uid || user?.uid) {
          setShowPreview(true);
        } else {
          router.push('/login');
        }
      }
    }
    setIsDragging(false);
  };
  
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, position]);
  
  if (!isVisible) {
    return null;
  }
  
  // 로그인하지 않은 경우 버튼만 표시
  if (!firebaseUser && !user) {
    return (
      <div
        ref={buttonRef}
        className="fixed z-50 select-none"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          cursor: isDragging ? 'grabbing' : 'grab',
          transition: isDragging ? 'none' : 'all 0.3s ease',
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="relative group">
          <div className="w-[60px] h-[60px] bg-gray-400 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow animate-pulse">
            <span className="text-3xl">🎓</span>
          </div>
          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
            ?
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <>
      {/* Floating Button */}
      <div
        ref={buttonRef}
        className="fixed z-50 select-none"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          cursor: isDragging ? 'grabbing' : 'grab',
          transition: isDragging ? 'none' : 'all 0.3s ease',
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="relative group">
          <div 
            className={`w-[60px] h-[60px] rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all ${
              isCompleted 
                ? 'bg-gradient-to-br from-amber-400 to-orange-500' 
                : 'bg-gradient-to-br from-blue-500 to-indigo-600 animate-pulse'
            }`}
            style={{ backgroundColor: currentStep?.color }}
          >
            <span className="text-3xl">{currentStep?.icon || (isCompleted ? '🎊' : '🎓')}</span>
          </div>
          <div className={`absolute -top-1 -right-1 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center ${
            isCompleted ? 'bg-green-500' : 'bg-red-500'
          }`}>
            {isCompleted ? '✓' : `${currentStepNum}`}
          </div>
        </div>
      </div>
      
      {/* Preview Modal */}
      {showPreview && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
              <span className="text-4xl">{activeChain.icon}</span>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{activeChain.name}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {isCompleted ? '완료!' : `${currentStepNum} / ${activeChain.totalSteps} 단계`}
                </p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            
            {isCompleted ? (
              // 완료 상태
              <div className="text-center py-6">
                <span className="text-6xl block mb-4">🎊</span>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  축하합니다!
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {activeChain.name}를 모두 완료했어요!
                </p>
                <button
                  onClick={() => {
                    setShowPreview(false);
                    refreshProgress();
                  }}
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                >
                  전체 보기
                </button>
              </div>
            ) : questLoading || authLoading ? (
              // 로딩 상태
              <div className="text-center py-6">
                <div className="animate-spin text-4xl mb-4">⏳</div>
                <p className="text-gray-500 dark:text-gray-400">퀘스트 로딩 중...</p>
              </div>
            ) : currentStep ? (
              // 진행 중인 퀘스트
              <div className="mb-4">
                {/* 현재 단계 */}
                <div className="flex items-start gap-3 mb-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{ backgroundColor: currentStep.color + '20' }}
                  >
                    {currentStep.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {currentStep.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {currentStep.description}
                    </p>
                  </div>
                </div>
                
                {/* 스토리 */}
                {currentStep.storyText && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 mb-4">
                    <p className="text-sm text-blue-800 dark:text-blue-300 italic">
                      "{currentStep.storyText}"
                    </p>
                  </div>
                )}
                
                {/* 구체적 가이드 */}
                {currentGuide && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 mb-4 border border-amber-200 dark:border-amber-800">
                    <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
                      <span>📍</span> 어떻게 하나요?
                    </h4>
                    <p className="text-sm text-amber-700 dark:text-amber-400 mb-2">
                      {currentGuide.howTo}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-500">
                      <span className="font-medium">📌 위치:</span> {currentGuide.where}
                    </p>
                    {currentGuide.tip && (
                      <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                        <span className="font-medium">💡 팁:</span> {currentGuide.tip}
                      </p>
                    )}
                  </div>
                )}
                
                {/* 진행도 */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">진행도</span>
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                      {currentProgress} / {currentTarget}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${(currentProgress / currentTarget) * 100}%`,
                        backgroundColor: currentStep.color || '#3B82F6',
                      }}
                    />
                  </div>
                </div>
                
                {/* 보상 */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                    🎁 완료 시 보상
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-full text-sm font-medium">
                      <span>⭐</span>
                      <span>+{currentStep.rewards.xp} XP</span>
                    </div>
                    {currentStep.rewards.badge && (
                      <div className="flex items-center gap-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-3 py-1.5 rounded-full text-sm font-medium">
                        <span>🏅</span>
                        <span>배지</span>
                      </div>
                    )}
                    {currentStep.rewards.title && (
                      <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-3 py-1.5 rounded-full text-sm font-medium">
                        <span>👑</span>
                        <span>{currentStep.rewards.title}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // 첫 번째 단계 표시 (currentStep이 없으면 첫 번째 단계 표시)
              (() => {
                const firstStep = tutorialChain.steps[0];
                const firstGuide = QUEST_GUIDES[firstStep.id];
                return (
                  <div className="mb-4">
                    {/* 첫 번째 단계 정보 */}
                    <div className="flex items-start gap-3 mb-4">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                        style={{ backgroundColor: firstStep.color + '20' }}
                      >
                        {firstStep.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                          {firstStep.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {firstStep.description}
                        </p>
                      </div>
                    </div>
                    
                    {/* 가이드 */}
                    {firstGuide && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 mb-4 border border-amber-200 dark:border-amber-800">
                        <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
                          <span>📍</span> 어떻게 하나요?
                        </h4>
                        <p className="text-sm text-amber-700 dark:text-amber-400 mb-2">
                          {firstGuide.howTo}
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-500">
                          <span className="font-medium">📌 위치:</span> {firstGuide.where}
                        </p>
                        {firstGuide.tip && (
                          <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                            <span className="font-medium">💡 팁:</span> {firstGuide.tip}
                          </p>
                        )}
                      </div>
                    )}
                    
                    {/* 진행도 */}
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">진행도</span>
                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                          {currentProgress} / {firstStep.objective.target}
                        </span>
                      </div>
                      <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${(currentProgress / firstStep.objective.target) * 100}%`,
                            backgroundColor: firstStep.color || '#3B82F6',
                          }} 
                        />
                      </div>
                    </div>
                    
                    {/* 보상 */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                        🎁 완료 시 보상
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <div className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-full text-sm font-medium">
                          <span>⭐</span>
                          <span>+{firstStep.rewards.xp} XP</span>
                        </div>
                        {firstStep.rewards.badge && (
                          <div className="flex items-center gap-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-3 py-1.5 rounded-full text-sm font-medium">
                            <span>🏅</span>
                            <span>배지</span>
                          </div>
                        )}
                        {firstStep.rewards.title && (
                          <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-3 py-1.5 rounded-full text-sm font-medium">
                            <span>👑</span>
                            <span>{firstStep.rewards.title}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
            
            {/* 액션 버튼들 */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowPreview(false)}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors"
              >
                닫기
              </button>
              <button
                onClick={() => {
                  setShowPreview(false);
                  router.push(`/quests/${activeChainId}`);
                }}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium rounded-xl transition-all shadow-lg"
              >
                전체 보기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

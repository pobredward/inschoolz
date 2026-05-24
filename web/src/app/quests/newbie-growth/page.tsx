'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { newbieGrowthChain } from '@/lib/quests/chains/newbie-growth';
import { QUEST_GUIDES, initializeUserQuests } from '@/lib/quests/questService';
import { QuestStep, UserQuestProgress } from '@/types';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function NewbieGrowthQuestPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<UserQuestProgress | null>(null);
  const [steps, setSteps] = useState<QuestStep[]>(newbieGrowthChain.steps);
  
  useEffect(() => {
    if (user?.uid) {
      loadQuestData();
    }
  }, [user?.uid]);
  
  const loadQuestData = async () => {
    if (!user?.uid) return;
    
    try {
      setLoading(true);
      const questRef = doc(db, 'quests', user.uid);
      const questDoc = await getDoc(questRef);
      
      let data: UserQuestProgress;
      
      if (questDoc.exists()) {
        data = questDoc.data() as UserQuestProgress;
      } else {
        // 퀘스트 데이터가 없으면 초기화
        data = await initializeUserQuests(user.uid);
      }
      
      setProgress(data);
      
      const chainProgress = data.chains['newbie-growth'];
      const currentStepNum = chainProgress?.currentStep || 1;
      
      // 단계별 진행도 업데이트
      const updatedSteps = newbieGrowthChain.steps.map(step => {
        const stepProgress = chainProgress?.stepProgress[step.id];
        
        if (stepProgress) {
          return {
            ...step,
            status: stepProgress.status,
            objective: {
              ...step.objective,
              current: stepProgress.progress || 0,
            },
          };
        }
        
        return step;
      });
      
      setSteps(updatedSteps);
    } catch (error) {
      console.error('퀘스트 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4">🌱</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">로그인이 필요합니다</h2>
          <p className="text-gray-600 mb-6">새내기의 성장 퀘스트를 진행하려면 로그인해주세요.</p>
          <button
            onClick={() => router.push('/login')}
            className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
          >
            로그인하기
          </button>
        </div>
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">퀘스트 정보 불러오는 중...</p>
        </div>
      </div>
    );
  }
  
  const chainProgress = progress?.chains['newbie-growth'];
  const currentStepNum = chainProgress?.currentStep || 1;
  const isChainCompleted = chainProgress?.status === 'completed';
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const progressPercentage = (completedSteps / newbieGrowthChain.totalSteps) * 100;
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* 헤더 */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="font-medium">뒤로</span>
            </button>
            
            <div className="text-center flex-1">
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl">{newbieGrowthChain.icon}</span>
                <h1 className="text-xl font-bold text-gray-900">{newbieGrowthChain.name}</h1>
              </div>
              <p className="text-sm text-gray-600 mt-1">{newbieGrowthChain.description}</p>
            </div>
            
            <div className="w-20"></div>
          </div>
        </div>
      </div>
      
      {/* 진행도 바 */}
      <div className="container mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">
              전체 진행도
            </span>
            <span className="text-sm font-bold text-green-600">
              {completedSteps}/{newbieGrowthChain.totalSteps}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-green-500 to-green-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          
          {isChainCompleted && (
            <div className="mt-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="text-3xl">🎉</div>
                <div>
                  <h3 className="font-bold text-green-900">체인 완료!</h3>
                  <p className="text-sm text-green-700">
                    축하합니다! 새내기를 졸업했어요!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* 퀘스트 단계 목록 */}
      <div className="container mx-auto px-4 pb-8">
        <div className="space-y-4">
          {steps.map((step) => {
            const isCurrent = step.step === currentStepNum && !isChainCompleted;
            const isLocked = step.status === 'locked';
            const isCompleted = step.status === 'completed';
            const stepProgress = chainProgress?.stepProgress[step.id];
            const current = stepProgress?.progress || 0;
            const target = step.objective.target;
            const progressPercent = target > 0 ? (current / target) * 100 : 0;
            
            return (
              <div
                key={step.id}
                className={`
                  bg-white rounded-xl shadow-sm border-2 p-6 transition-all duration-300
                  ${isCurrent ? 'border-green-500 shadow-green-100 shadow-lg' : 'border-gray-200'}
                  ${isLocked ? 'opacity-50' : ''}
                `}
              >
                <div className="flex items-start gap-4">
                  {/* 단계 번호 & 아이콘 */}
                  <div className="flex-shrink-0">
                    <div
                      className={`
                        w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold
                        ${isCompleted ? 'bg-green-100 text-green-600' : 
                          isCurrent ? 'bg-green-500 text-white animate-pulse' : 
                          'bg-gray-100 text-gray-400'}
                      `}
                    >
                      {isCompleted ? '✓' : step.icon || step.step}
                    </div>
                  </div>
                  
                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-gray-500">
                            {step.step}단계
                          </span>
                          {isCurrent && (
                            <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                              진행 중
                            </span>
                          )}
                          {isCompleted && (
                            <span className="bg-green-50 text-green-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                              완료
                            </span>
                          )}
                          {isLocked && (
                            <span className="bg-gray-100 text-gray-500 text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                              </svg>
                              잠김
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">
                          {step.title}
                        </h3>
                        <p className="text-sm text-gray-600 mb-2">
                          {step.description}
                        </p>
                        <p className="text-sm text-gray-500 italic">
                          {step.storyText}
                        </p>
                      </div>
                    </div>
                    
                    {/* 진행도 바 */}
                    {!isCompleted && !isLocked && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-gray-600 font-medium">진행도</span>
                          <span className="font-bold text-green-600">
                            {current}/{target}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-green-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(progressPercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    {/* 보상 */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <div className="inline-flex items-center gap-1.5 bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full text-sm font-semibold">
                        <span>⭐</span>
                        <span>+{step.rewards.xp} XP</span>
                      </div>
                      {step.rewards.badge && (
                        <div className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-sm font-semibold">
                          <span>🏅</span>
                          <span>배지</span>
                        </div>
                      )}
                      {step.rewards.title && (
                        <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
                          <span>👑</span>
                          <span>{step.rewards.title}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* 가이드 */}
                    {isCurrent && QUEST_GUIDES[step.objective.type] && (
                      <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <span className="text-green-600 text-lg flex-shrink-0">💡</span>
                          <p className="text-sm text-green-800">
                            {QUEST_GUIDES[step.objective.type]}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* 체인 완료 보상 */}
        {!isChainCompleted && (
          <div className="mt-8 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-green-900 mb-3 flex items-center gap-2">
              <span className="text-2xl">🎁</span>
              체인 완료 보상
            </h3>
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-1.5 bg-white px-4 py-2 rounded-lg text-sm font-semibold text-yellow-700 border border-yellow-200">
                <span>⭐</span>
                <span>+{newbieGrowthChain.completionRewards.xp} XP</span>
              </div>
              {newbieGrowthChain.completionRewards.badge && (
                <div className="inline-flex items-center gap-1.5 bg-white px-4 py-2 rounded-lg text-sm font-semibold text-purple-700 border border-purple-200">
                  <span>🏅</span>
                  <span>{newbieGrowthChain.completionRewards.badge}</span>
                </div>
              )}
              {newbieGrowthChain.completionRewards.title && (
                <div className="inline-flex items-center gap-1.5 bg-white px-4 py-2 rounded-lg text-sm font-semibold text-blue-700 border border-blue-200">
                  <span>👑</span>
                  <span>{newbieGrowthChain.completionRewards.title}</span>
                </div>
              )}
              {newbieGrowthChain.completionRewards.frame && (
                <div className="inline-flex items-center gap-1.5 bg-white px-4 py-2 rounded-lg text-sm font-semibold text-pink-700 border border-pink-200">
                  <span>🖼️</span>
                  <span>{newbieGrowthChain.completionRewards.frame}</span>
                </div>
              )}
              {newbieGrowthChain.completionRewards.items && newbieGrowthChain.completionRewards.items.length > 0 && (
                <div className="inline-flex items-center gap-1.5 bg-white px-4 py-2 rounded-lg text-sm font-semibold text-orange-700 border border-orange-200">
                  <span>📦</span>
                  <span>{newbieGrowthChain.completionRewards.items.length}개 상자</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}




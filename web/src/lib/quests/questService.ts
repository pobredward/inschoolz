import { communityCommand } from '../community-client';
/**
 * 퀘스트 서비스 - 조건 체크 및 진행 상태 관리
 */

import { db } from '@/lib/firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp,
  Timestamp,
  increment 
} from 'firebase/firestore';
import { User, UserQuestProgress, QuestStep, QuestStatus, QuestChain } from '@/types';
import { tutorialChain } from './chains/tutorial';
import { newbieGrowthChain } from './chains/newbie-growth';

// 모든 퀘스트 체인 등록
export const questChains: Record<string, QuestChain> = {
  tutorial: tutorialChain,
  'newbie-growth': newbieGrowthChain,
};

// 체인 순서 정의 (순차적 진행)
export const chainOrder = ['tutorial', 'newbie-growth'];

// 퀘스트 액션 타입
export type QuestActionType = 
  | 'nickname_change'       // 닉네임 변경/설정
  | 'profile_complete'      // 프로필 완성 (레거시)
  | 'school_register'       // 학교 등록 (레거시)
  | 'favorite_school'       // 즐겨찾기 학교 등록
  | 'visit_board'           // 게시판 방문
  | 'create_post'           // 게시글 작성
  | 'create_comment'        // 댓글 작성
  | 'give_like'             // 좋아요 누르기
  | 'play_game'             // 게임 플레이
  | 'attendance'            // 출석체크
  | 'visit_other_board'     // 다른 게시판 방문
  | 'consecutive_attendance' // 연속 출석
  | 'visit_category'        // 특정 카테고리 방문
  | 'tile_game_clear';      // 타일 게임 클리어 (움직임 횟수 기반)

// 퀘스트 완료 콜백 타입
export type QuestCompletedCallback = (
  step: QuestStep,
  rewards: { xp: number; badge?: string; title?: string }
) => void;

// 전역 콜백 저장소
let onQuestCompleted: QuestCompletedCallback | null = null;

/**
 * 퀘스트 완료 콜백 등록
 */
export function setQuestCompletedCallback(callback: QuestCompletedCallback) {
  onQuestCompleted = callback;
}

/**
 * 사용자 퀘스트 진행 상태 초기화
 */
export async function initializeUserQuests(userId: string): Promise<UserQuestProgress> {
  await communityCommand('quest.initialize', {}, userId);
  return (await getDoc(doc(db, 'quests', userId))).data() as UserQuestProgress;
}

/**
 * 사용자 퀘스트 진행 상태 조회
 */
export async function getUserQuestProgress(userId: string): Promise<UserQuestProgress | null> {
  const questRef = doc(db, 'quests', userId);
  const questDoc = await getDoc(questRef);
  
  if (!questDoc.exists()) {
    return null;
  }
  
  return questDoc.data() as UserQuestProgress;
}

/**
 * 현재 진행 중인 퀘스트 단계 조회 (다중 체인 지원)
 */
export async function getCurrentQuestStep(userId: string): Promise<{
  chain: QuestChain;
  step: QuestStep;
  progress: number;
  target: number;
} | null> {
  const progress = await getUserQuestProgress(userId);
  
  if (!progress) return null;
  
  // 순서대로 체인 확인
  for (const chainId of chainOrder) {
    const chainProgress = progress.chains[chainId];
    const chain = questChains[chainId];
    
    if (!chain || !chainProgress) continue;
    
    // 진행 중인 체인 찾기
    if (chainProgress.status === 'in_progress') {
      const currentStepNum = chainProgress.currentStep || 1;
      const step = chain.steps.find(s => s.step === currentStepNum);
      
      if (!step) continue;
      
      const stepProgress = chainProgress.stepProgress[step.id];
      
      return {
        chain,
        step,
        progress: stepProgress?.progress || 0,
        target: step.objective.target,
      };
    }
  }
  
  return null;
}

/**
 * 닉네임 존재 여부 체크
 */
export function checkNicknameExists(user: User): boolean {
  const profile = user.profile;
  if (!profile) return false;
  
  return !!profile.userName && profile.userName.trim().length > 0;
}

/**
 * 프로필 완성도 체크 (레거시)
 */
export function checkProfileComplete(user: User): boolean {
  const profile = user.profile;
  if (!profile) return false;
  
  // 필수 프로필 필드 체크
  const hasUserName = !!profile.userName && profile.userName.trim().length > 0;
  const hasGender = !!profile.gender && profile.gender.trim().length > 0;
  const hasBirthYear = !!profile.birthYear && profile.birthYear > 1900;
  
  return hasUserName && hasGender && hasBirthYear;
}

/**
 * 학교 등록 체크
 */
export function checkSchoolRegistered(user: User): boolean {
  return !!user.school?.id && !!user.school?.name;
}

/**
 * 퀘스트 액션 처리 - 조건 체크 및 진행도 업데이트
 * @param userId 사용자 ID
 * @param actionType 액션 타입
 * @param user 사용자 정보 (프로필/학교 체크용)
 * @param metadata 추가 메타데이터 (게시판 ID 등)
 * @returns 완료된 퀘스트 단계 (있으면)
 */
export async function trackQuestAction(
  userId: string,
  actionType: QuestActionType,
  user?: User,
  metadata?: {
    boardId?: string;
    isOtherSchool?: boolean;
    tileGameMoves?: number;
    reactionTime?: number;
    consecutiveDays?: number;
  }
): Promise<{
  completed: boolean;
  step?: QuestStep;
  newProgress?: number;
  target?: number;
  rewards?: { xp: number; badge?: string; title?: string };
} | null> {
  const result = await communityCommand('quest.track', { actionType, metadata }, userId);
  if (result?.completed && result.step && result.rewards) onQuestCompleted?.(result.step, result.rewards);
  return result;
}

/**
 * 사용자 경험치 추가 (퀘스트 보상)
 */
export async function addQuestXP(userId: string, xp: number): Promise<void> {
  // Rewards are issued by the server after validating actual activity.
  return;
}

/**
 * 각 단계별 구체적인 가이드 텍스트
 */
export const QUEST_GUIDES: Record<string, {
  howTo: string;        // 어떻게 하는지
  where: string;        // 어디서 하는지
  tip?: string;         // 팁
}> = {
  tutorial_1: {
    howTo: '닉네임을 입력하고 저장하세요',
    where: '마이페이지 → 프로필 수정',
    tip: '닉네임은 다른 친구들에게 보여지는 이름이에요!',
  },
  tutorial_2: {
    howTo: '학교를 검색하고 별(⭐) 버튼을 눌러 즐겨찾기에 추가하세요',
    where: '마이페이지 → 즐겨찾기 학교 관리',
    tip: '즐겨찾기한 학교의 게시판을 빠르게 확인할 수 있어요!',
  },
  tutorial_3: {
    howTo: '학교 게시판에 들어가서 글을 읽어보세요',
    where: '홈 → 우리 학교 게시판',
    tip: '어떤 이야기들이 오가는지 구경해보세요!',
  },
  tutorial_4: {
    howTo: '게시판에서 새 글 작성 버튼을 눌러 글을 작성하세요',
    where: '게시판 → 글쓰기 버튼 (연필 아이콘)',
    tip: '자기소개나 질문을 올려보는 건 어때요?',
  },
  tutorial_5: {
    howTo: '다른 친구들의 글에 댓글을 달아보세요',
    where: '게시글 하단 → 댓글 입력',
    tip: '따뜻한 댓글은 모두를 행복하게 해요 😊',
  },
  tutorial_6: {
    howTo: '마음에 드는 글이나 댓글에 좋아요를 눌러보세요',
    where: '게시글/댓글 옆 하트 아이콘',
    tip: '좋아요를 받으면 작성자도 기분이 좋아져요!',
  },
  tutorial_7: {
    howTo: '미니게임을 플레이해보세요',
    where: '하단 메뉴 → 게임',
    tip: '게임으로 경험치도 얻고 순위에도 도전해보세요!',
  },
  tutorial_8: {
    howTo: '출석체크 버튼을 눌러 오늘의 출석을 완료하세요',
    where: '홈 → 출석체크 버튼',
    tip: '매일 출석하면 연속 출석 보상을 받을 수 있어요!',
  },
  tutorial_9: {
    howTo: '다른 학교나 지역 게시판을 방문해보세요',
    where: '게시판 → 다른 학교/지역 탭',
    tip: '다른 학교 친구들은 어떤 이야기를 할까요?',
  },
  tutorial_10: {
    howTo: '3일 연속으로 출석체크를 완료하세요',
    where: '홈 → 출석체크 (매일)',
    tip: '꾸준함이 최고의 무기! 화이팅! 💪',
  },
};


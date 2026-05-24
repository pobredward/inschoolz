import { QuestChain } from '../../../types';

/**
 * 새내기의 성장 (Newbie Growth Chain)
 * "인스쿨즈 입학기" 완료 후 진행하는 두 번째 체인
 * 기본 활동 강화 및 습관 형성
 */
export const newbieGrowthChain: QuestChain = {
  id: 'newbie-growth',
  type: 'main',
  name: '새내기의 성장',
  description: '인스쿨즈의 다양한 활동을 경험하고 성장하세요!',
  icon: '🌱',
  
  steps: [
    {
      id: 'newbie_growth_1',
      step: 1,
      title: '글쓰기 연습',
      description: '게시글 3개를 작성하세요',
      storyText: '이제 본격적으로 활동해볼 시간이에요! 먼저 글쓰기부터 시작해볼까요?',
      objective: {
        type: 'create_post',
        target: 3,
        current: 0,
      },
      rewards: {
        xp: 80,
      },
      status: 'locked',
      icon: '✏️',
      color: '#3B82F6',
    },
    {
      id: 'newbie_growth_2',
      step: 2,
      title: '활발한 댓글러',
      description: '댓글 10개를 작성하세요',
      storyText: '다른 사람들과 소통해보세요. 댓글로 대화를 나눠봅시다!',
      objective: {
        type: 'create_comment',
        target: 10,
        current: 0,
      },
      rewards: {
        xp: 100,
      },
      status: 'locked',
      icon: '💬',
      color: '#10B981',
    },
    {
      id: 'newbie_growth_3',
      step: 3,
      title: '첫 인기글',
      description: '게시글 좋아요 3개 받기',
      storyText: '사람들의 공감을 얻어보세요!',
      objective: {
        type: 'get_likes',
        target: 3,
        current: 0,
      },
      rewards: {
        xp: 120,
      },
      status: 'locked',
      icon: '⭐',
      color: '#8B5CF6',
    },
    {
      id: 'newbie_growth_4',
      step: 4,
      title: '반응속도 테스트',
      description: '반응속도 게임 1회 플레이',
      storyText: '잠깐의 휴식! 반응속도 게임으로 두뇌를 풀어봐요.',
      objective: {
        type: 'play_game',
        target: 1,
        current: 0,
      },
      rewards: {
        xp: 80,
      },
      status: 'locked',
      icon: '⚡',
      color: '#F59E0B',
    },
    {
      id: 'newbie_growth_5',
      step: 5,
      title: '빠른 손놀림',
      description: '반응속도 게임 300ms 이하 클리어',
      storyText: '조금 더 빠르게! 300ms 이하에 도전해보세요.',
      objective: {
        type: 'custom',
        target: 1,
        current: 0,
        customCheck: 'reaction_game_300ms',
      },
      rewards: {
        xp: 150,
      },
      status: 'locked',
      icon: '🎯',
      color: '#EC4899',
    },
    {
      id: 'newbie_growth_6',
      step: 6,
      title: '공감의 힘',
      description: '좋아요 20개 누르기',
      storyText: '다른 사람들의 글에도 응원을 보내보세요!',
      objective: {
        type: 'give_like',
        target: 20,
        current: 0,
      },
      rewards: {
        xp: 100,
      },
      status: 'locked',
      icon: '❤️',
      color: '#EF4444',
    },
    {
      id: 'newbie_growth_7',
      step: 7,
      title: '활발한 소통',
      description: '답글(대댓글) 5개 작성하기',
      storyText: '댓글에 답글을 달아 더 깊은 대화를 나눠보세요!',
      objective: {
        type: 'create_comment',
        target: 5,
        current: 0,
      },
      rewards: {
        xp: 120,
      },
      status: 'locked',
      icon: '💭',
      color: '#6366F1',
    },
    {
      id: 'newbie_growth_8',
      step: 8,
      title: '게임 마스터 입문',
      description: '타일 게임 10번 이하로 클리어',
      storyText: '타일 게임 실력을 뽐내볼까요?',
      objective: {
        type: 'tile_game_moves',
        target: 1,
        current: 0,
        metadata: {
          maxMoves: 10,
        },
      },
      rewards: {
        xp: 200,
      },
      status: 'locked',
      icon: '🎮',
      color: '#14B8A6',
    },
    {
      id: 'newbie_growth_9',
      step: 9,
      title: '번개 손가락',
      description: '반응속도 게임 250ms 이하 클리어',
      storyText: '최고의 반응속도를 보여주세요!',
      objective: {
        type: 'custom',
        target: 1,
        current: 0,
        customCheck: 'reaction_game_250ms',
      },
      rewards: {
        xp: 250,
        badge: 'reaction_master',
      },
      status: 'locked',
      icon: '⚡',
      color: '#06B6D4',
    },
    {
      id: 'newbie_growth_10',
      step: 10,
      title: '꾸준한 성장',
      description: '3일 연속 출석하기',
      storyText: '축하합니다! 이제 진정한 인스쿨러로 성장했어요! 🎉',
      objective: {
        type: 'consecutive_attendance',
        target: 3,
        current: 0,
      },
      rewards: {
        xp: 300,
        title: '성장하는 인스쿨러',
      },
      status: 'locked',
      icon: '🌱',
      color: '#A855F7',
    },
  ],
  
  totalSteps: 10,
  currentStep: 0,
  
  completionRewards: {
    xp: 1000,
    badge: 'newbie_graduate',
    title: '새내기 졸업',
    frame: 'growth_frame',
    items: ['rare_box', 'rare_box'],
  },
  
  status: 'locked',
  
  // 잠금 조건: "인스쿨즈 입학기" 완료 필요
  unlockConditions: {
    completedChains: ['tutorial'],
  },
};




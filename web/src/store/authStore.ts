import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';
import { calculateCurrentLevelProgress } from '@/lib/experience';

// 인증 상태 타입 정의
interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

// 인증 액션 타입 정의
interface AuthActions {
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearAuth: () => void;
  updateUserProfile: (profileData: Partial<User['profile']>) => void;
  updateUserStats: (statsData: Partial<User['stats']>) => void;
  updateUserSchool: (schoolData: Partial<User['school']>) => void;
  updateUserRegions: (regionsData: Partial<User['regions']>) => void;
  // 즐겨찾기 학교 기능은 향후 구현 예정
  incrementExperience: (amount: number) => void;
  updateGameStats: (gameType: string, stats: { totalScore: number }) => void;
}

// 초기 상태
const initialState: AuthState = {
  user: null,
  isLoading: false,
  isAuthenticated: false,
  error: null,
};

// AuthStore 생성
export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      // 사용자 설정
      setUser: (user) => {
        set({
          user,
          isAuthenticated: !!user,
          error: null,
        });
      },

      // 로딩 상태 설정
      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      // 에러 설정
      setError: (error) => {
        set({ error });
      },

      // 인증 정보 초기화
      clearAuth: () => {
        set(initialState);
      },

      // 프로필 업데이트
      updateUserProfile: (profileData) => {
        const { user } = get();
        if (user) {
          set({
            user: {
              ...user,
              profile: {
                ...user.profile,
                ...profileData,
              },
            },
          });
        }
      },

      // 통계 업데이트
      updateUserStats: (statsData) => {
        const { user } = get();
        if (user) {
          set({
            user: {
              ...user,
              stats: {
                ...user.stats,
                ...statsData,
              },
            },
          });
        }
      },

      // 학교 정보 업데이트
      updateUserSchool: (schoolData) => {
        const { user } = get();
        if (user && user.school) {
          set({
            user: {
              ...user,
              school: {
                ...user.school,
                ...schoolData,
              },
            },
          });
        }
      },

      // 지역 정보 업데이트
      updateUserRegions: (regionsData) => {
        const { user } = get();
        if (user && user.regions) {
          set({
            user: {
              ...user,
              regions: {
                ...user.regions,
                ...regionsData,
              },
            },
          });
        }
      },

      // 즐겨찾기 학교 기능은 향후 구현 예정

      // 경험치 증가 (완전히 새로운 로직)
      incrementExperience: (amount) => {
        const { user } = get();
        if (user) {
          const totalExperience = user.stats.totalExperience + amount;
          
          // 새로운 총 경험치 기준으로 레벨과 현재 경험치 계산
          const progress = calculateCurrentLevelProgress(totalExperience);
          
          set({
            user: {
              ...user,
              stats: {
                ...user.stats,
                totalExperience: totalExperience,
                level: progress.level,
                currentExp: progress.currentExp,
                currentLevelRequiredXp: progress.currentLevelRequiredXp,
              },
            },
          });
        }
      },

      // 게임 통계 업데이트
      updateGameStats: (gameType, stats) => {
        const { user } = get();
        if (user && user.gameStats) {
          set({
            user: {
              ...user,
              gameStats: {
                ...user.gameStats,
                [gameType]: stats,
              },
            },
          });
        }
      },
    }),
    {
      name: 'auth-store', // localStorage 키
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// 편의 함수들
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useIsLoading = () => useAuthStore((state) => state.isLoading);
export const useAuthError = () => useAuthStore((state) => state.error); 
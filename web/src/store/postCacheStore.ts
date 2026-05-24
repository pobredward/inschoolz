import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Post, Board, Comment } from '@/types';

interface PostCache {
  post: Post;
  board?: Board;
  comments?: Comment[];
  cachedAt: number;
}

interface PostCacheStore {
  // 게시글 캐시 (postId -> PostCache)
  posts: Record<string, PostCache>;
  
  // 게시판 캐시 (boardCode -> Board)
  boards: Record<string, Board>;
  
  // 게시글 캐싱
  cachePost: (postId: string, post: Post, board?: Board, comments?: Comment[]) => void;
  
  // 게시글 가져오기
  getPost: (postId: string) => PostCache | null;
  
  // 게시판 캐싱
  cacheBoard: (boardCode: string, board: Board) => void;
  
  // 게시판 가져오기
  getBoard: (boardCode: string) => Board | null;
  
  // 캐시 초기화
  clearCache: () => void;
  
  // 오래된 캐시 정리 (5분 이상)
  cleanOldCache: () => void;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5분

export const usePostCacheStore = create<PostCacheStore>()(
  persist(
    (set, get) => ({
      posts: {},
      boards: {},
      
      cachePost: (postId, post, board, comments) => {
        set((state) => ({
          posts: {
            ...state.posts,
            [postId]: {
              post,
              board,
              comments,
              cachedAt: Date.now(),
            },
          },
          // 게시판도 함께 캐싱
          ...(board && {
            boards: {
              ...state.boards,
              [board.code]: board,
            },
          }),
        }));
      },
      
      getPost: (postId) => {
        const cached = get().posts[postId];
        if (!cached) return null;
        
        // 캐시가 5분 이상 오래되었으면 null 반환
        if (Date.now() - cached.cachedAt > CACHE_DURATION) {
          return null;
        }
        
        return cached;
      },
      
      cacheBoard: (boardCode, board) => {
        set((state) => ({
          boards: {
            ...state.boards,
            [boardCode]: board,
          },
        }));
      },
      
      getBoard: (boardCode) => {
        return get().boards[boardCode] || null;
      },
      
      clearCache: () => {
        set({ posts: {}, boards: {} });
      },
      
      cleanOldCache: () => {
        const now = Date.now();
        const posts = get().posts;
        const newPosts: Record<string, PostCache> = {};
        
        Object.entries(posts).forEach(([postId, cache]) => {
          if (now - cache.cachedAt <= CACHE_DURATION) {
            newPosts[postId] = cache;
          }
        });
        
        set({ posts: newPosts });
      },
    }),
    {
      name: 'inschoolz-post-cache', // localStorage key
      storage: createJSONStorage(() => localStorage),
      // 일부만 persist (캐시 데이터만, 함수는 제외)
      partialize: (state) => ({ 
        posts: state.posts,
        boards: state.boards 
      }),
    }
  )
);


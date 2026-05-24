"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatRelativeTime, getPostPreviewImages } from "@/lib/utils";
import { MessageSquare, ThumbsUp, Eye, Pin, PenSquare, Loader2, BarChart3, RefreshCw } from "lucide-react";
import { BoardType, BoardFilterOptions } from "@/types/board";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { useRouter, useSearchParams } from "next/navigation";
import { getPostsByBoard } from "@/lib/api/board";
import { getBlockedUserIds } from "@/lib/api/users";
import { BlockedUserContent } from "@/components/ui/blocked-user-content";
import { useAuth } from "@/providers/AuthProvider";
import { toast } from "sonner";
import { Timestamp } from "firebase/firestore";
import { FirebaseTimestamp } from "@/types";

// Firebase 문서에서 가져온 게시글 타입 확장
interface PostWithOptionalFields {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorInfo?: {
    displayName?: string;
    isAnonymous?: boolean;
    profileImageUrl?: string; // 추가된 필드
  };
  createdAt: Date | Timestamp | FirebaseTimestamp;
  status?: {
    isPinned?: boolean;
    isDeleted?: boolean;
    isHidden?: boolean;
  };
  stats?: {
    viewCount?: number;
    likeCount?: number;
    commentCount?: number;
  };
  attachments?: Array<{
    type: string;
    url: string;
  }>;
  tags?: string[];
  poll?: {
    isActive: boolean;
    question: string;
    options: Array<{
      text: string;
      voteCount: number;
    }>;
  };
  imageUrls?: string[];
  boardName?: string; // boardName 필드 추가
}

interface PostListProps {
  boardCode: string;
  type: BoardType;
  page: number;
  sort: string;
  keyword: string;
  filter: string;
}

export default function PostList({ 
  boardCode, 
  type, 
  page, 
  sort, 
  keyword, 
  filter 
}: PostListProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostWithOptionalFields[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  
  // 차단된 사용자 목록 로드
  const loadBlockedUsers = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      const blockedIds = await getBlockedUserIds(user.uid);
      setBlockedUserIds(new Set(blockedIds));
    } catch (error) {
      console.error('차단된 사용자 목록 로드 실패:', error);
    }
  }, [user?.uid]);

  // 게시글 목록 로드 함수
  const fetchPosts = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      
      // 필터 옵션 설정
      const filterOptions: BoardFilterOptions = {
        keyword: keyword || undefined,
        sortBy: (sort === 'popular' || sort === 'comments' || sort === 'views') 
          ? sort 
          : 'latest',
        searchTarget: 'title', // 기본값 설정
        hasImage: filter === 'image' ? true : undefined,
        hasPoll: filter === 'poll' ? true : undefined,
        timeFilter: (filter === 'today' || filter === 'week' || filter === 'month') 
          ? filter as 'today' | 'week' | 'month'
          : undefined
      };
      
      // API 호출하여 게시글 가져오기
      const postsData = await getPostsByBoard(boardCode, 20, undefined, filterOptions);
      
      if (postsData) {
        // 받아온 데이터를 PostWithOptionalFields 형식으로 매핑
        const formattedPosts = postsData.items.map(post => ({
          id: post.id,
          title: post.title,
          content: post.content,
          authorId: post.authorId,
          authorInfo: post.authorInfo,
          createdAt: post.createdAt,
          status: post.status,
          stats: post.stats,
          tags: post.tags,
          poll: post.poll,
          boardName: post.boardName, // boardName 추가
          imageUrls: Array.isArray(post.attachments) ? 
            post.attachments
              .filter(att => att.type === 'image')
              .map(att => att.url) 
            : []
        }));
        
        setPosts(formattedPosts);
        // 페이지네이션을 위한 totalCount 계산 (실제로는 API에서 가져오는 것이 좋음)
        setTotalPages(Math.max(1, Math.ceil(postsData.items.length / 20))); 
      }
    } catch (error) {
      console.error("게시글 목록 로드 실패:", error);
      toast.error("게시글 목록을 불러오는데 실패했습니다.");
      setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [boardCode, page, sort, keyword, filter]);

  // 수동 새로고침 함수
  const handleRefresh = () => {
    fetchPosts(false);
  };

  // 데이터 가져오기
  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // 차단된 사용자 목록 로드
  useEffect(() => {
    loadBlockedUsers();
  }, [loadBlockedUsers]);

  // 차단 해제 시 상태 업데이트
  const handleUnblock = (userId: string) => {
    setBlockedUserIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(userId);
      return newSet;
    });
  };

  // 게시글 클릭 핸들러 - 즉시 클라이언트 사이드 라우팅
  const handlePostClick = useCallback((postId: string) => {
    // 빠른 로딩 모드로 이동 (SEO 우회)
    router.push(`/community/${type}/${boardCode}/${postId}/fast`);
  }, [router, type, boardCode]);

  // 게시글 렌더링 함수
  const renderPost = (post: PostWithOptionalFields) => {
    const isBlocked = blockedUserIds.has(post.authorId);
    
    if (isBlocked) {
      return (
        <BlockedUserContent
          key={post.id}
          blockedUserId={post.authorId}
          blockedUserName={post.authorInfo?.displayName || '사용자'}
          contentType="post"
          onUnblock={() => handleUnblock(post.authorId)}
        >
          <PostCard post={post} />
        </BlockedUserContent>
      );
    }
    
    return <PostCard key={post.id} post={post} />;
  };

  // 게시글 카드 컴포넌트
  const PostCard = ({ post }: { post: PostWithOptionalFields }) => {
    // ... existing post card rendering logic ...
    return (
      <Card className="hover:shadow-md transition-shadow duration-200">
        <div className="p-4">
          {/* 게시글 내용 렌더링 로직 */}
          <div 
            className="cursor-pointer space-y-3"
            onClick={() => handlePostClick(post.id)}
          >
            <h3 className="font-semibold text-lg text-gray-900 hover:text-blue-600 transition-colors">
              {post.title}
            </h3>
            {post.content && (
              <p className="text-gray-600 text-sm line-clamp-2">
                {post.content.replace(/<[^>]*>/g, '').slice(0, 100)}...
              </p>
            )}
          </div>
        </div>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 새로고침 버튼 */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">게시글 목록</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>

      {/* 게시글 목록 */}
      {posts.length === 0 ? (
        <div className="text-center py-12">
          <PenSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">게시글이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(renderPost)}
        </div>
      )}
    </div>
  );
} 
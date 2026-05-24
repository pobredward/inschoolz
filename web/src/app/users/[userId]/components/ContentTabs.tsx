'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getUserPosts, getUserComments } from '@/lib/api/users';
import { Post, Comment } from '@/types';
import { Bookmark as ScrapIcon, MessageSquareIcon } from 'lucide-react';
import { stripHtmlTags, toDate } from '@/lib/utils';

interface ContentTabsProps {
  userId: string;
  isOwnProfile?: boolean;
}

export default function ContentTabs({ userId, isOwnProfile = false }: ContentTabsProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [postsError, setPostsError] = useState('');
  const [commentsError, setCommentsError] = useState('');
  const [postsSortBy, setPostsSortBy] = useState<'latest' | 'popular'>('latest');
  const [postsPage, setPostsPage] = useState(1);
  const [commentsPage, setCommentsPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [hasMoreComments, setHasMoreComments] = useState(false);
  const [totalPosts, setTotalPosts] = useState(0);
  const [totalComments, setTotalComments] = useState(0);
  const [activeTab, setActiveTab] = useState<string>('posts');
  
  // 게시글 로드
  const loadPosts = useCallback(async (page = 1, sortBy: 'latest' | 'popular' = 'latest') => {
    if (postsLoading) return;
    
    setPostsLoading(true);
    setPostsError('');
    
    try {
      const response = await getUserPosts(userId, page, 10, sortBy);
      
      if (page === 1) {
        setPosts(response.posts);
      } else {
        setPosts(prev => [...prev, ...response.posts]);
      }
      
      setHasMorePosts(response.hasMore);
      setTotalPosts(response.totalCount);
      setPostsPage(page);
    } catch (error) {
      setPostsError('게시글을 불러오는 중 오류가 발생했습니다.');
      console.error('게시글 로드 오류:', error);
    } finally {
      setPostsLoading(false);
    }
  }, [userId, postsLoading]);
  
  // 댓글 로드
  const loadComments = useCallback(async (page = 1) => {
    if (commentsLoading) return;
    
    setCommentsLoading(true);
    setCommentsError('');
    
    try {
      const response = await getUserComments(userId, page, 10);
      
      if (page === 1) {
        setComments(response.comments);
      } else {
        setComments(prev => [...prev, ...response.comments]);
      }
      
      setHasMoreComments(response.hasMore);
      setTotalComments(response.totalCount);
      setCommentsPage(page);
    } catch (error) {
      setCommentsError('댓글을 불러오는 중 오류가 발생했습니다.');
      console.error('댓글 로드 오류:', error);
    } finally {
      setCommentsLoading(false);
    }
  }, [userId, commentsLoading]);
  
  // 정렬 방식 변경 핸들러
  const handleSortChange = (sortBy: 'latest' | 'popular') => {
    setPostsSortBy(sortBy);
    setPostsPage(1);
    loadPosts(1, sortBy);
  };
  
  // 게시글 더 불러오기
  const handleLoadMorePosts = () => {
    if (hasMorePosts && !postsLoading) {
      loadPosts(postsPage + 1, postsSortBy);
    }
  };
  
  // 댓글 더 불러오기
  const handleLoadMoreComments = () => {
    if (hasMoreComments && !commentsLoading) {
      loadComments(commentsPage + 1);
    }
  };
  
  // 탭 변경 핸들러
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === 'posts' && posts.length === 0 && !postsLoading) {
      loadPosts();
    } else if (value === 'comments' && comments.length === 0 && !commentsLoading) {
      loadComments();
    }
  };
  
  // 초기 데이터 로드
  useEffect(() => {
    loadPosts();
  }, [userId, loadPosts]);
  
  const renderPosts = () => {
    if (postsLoading) {
      return <div className="py-8 text-center">로딩 중...</div>;
    }

    if (posts.length === 0) {
      return <div className="py-8 text-center">게시물이 없습니다.</div>;
    }

    return (
      <div className="space-y-4">
        {posts.map((post) => (
          <div
            key={post.id}
            className="rounded-lg border p-4 transition-all hover:bg-accent"
            onClick={() => window.location.href = `/community/${post.boardCode}/${post.id}`}
          >
            <div className="flex justify-between">
              <h3 className="font-medium line-clamp-1">{post.title}</h3>
              <span className="text-xs text-muted-foreground">
                {new Date(toDate(post.createdAt)).toLocaleString()}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap">
              {stripHtmlTags(post.content)}
            </p>
            <div className="mt-2 flex items-center space-x-4 text-xs text-muted-foreground">
              <span className="flex items-center">
                <ScrapIcon className="mr-1 h-3.5 w-3.5" />
                {post.stats.likeCount}
              </span>
              <span className="flex items-center">
                <MessageSquareIcon className="mr-1 h-3.5 w-3.5" />
                {post.stats.commentCount}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderComments = () => {
    if (commentsLoading) {
      return <div className="py-8 text-center">로딩 중...</div>;
    }

    if (comments.length === 0) {
      return <div className="py-8 text-center">댓글이 없습니다.</div>;
    }

    return (
      <div className="space-y-4">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className="rounded-lg border p-4 transition-all hover:bg-accent"
            onClick={() => window.location.href = `/boards/all/${comment.postId}`}
          >
            <div className="flex justify-between">
              <h3 className="font-medium line-clamp-2">{comment.content}</h3>
              <span className="text-xs text-muted-foreground">
                {new Date(toDate(comment.createdAt)).toLocaleString()}
              </span>
            </div>
            <div className="mt-2 flex items-center space-x-4 text-xs text-muted-foreground">
              <span className="flex items-center">
                <ScrapIcon className="mr-1 h-3.5 w-3.5" />
                {comment.stats.likeCount}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Tabs defaultValue="posts" onValueChange={handleTabChange}>
      <TabsList className="w-full mb-4">
        <TabsTrigger value="posts" className="flex-1">게시글</TabsTrigger>
        <TabsTrigger value="comments" className="flex-1">댓글</TabsTrigger>
        {isOwnProfile && <TabsTrigger value="level" className="flex-1">레벨 정보</TabsTrigger>}
      </TabsList>
      
      <div className="text-sm text-muted-foreground mb-4">
        사용자의 공개 설정에 따라 일부 정보가 표시되지 않을 수 있습니다.
      </div>
      
      <TabsContent value="posts">
        {renderPosts()}
      </TabsContent>
      
      <TabsContent value="comments">
        {renderComments()}
      </TabsContent>
      
      {isOwnProfile && (
        <TabsContent value="level">
          <div className="space-y-6">
            <div className="bg-card p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-medium mb-4">레벨 정보</h3>
              <div className="grid gap-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm">현재 레벨</span>
                  <span className="font-medium">23</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">다음 레벨까지</span>
                  <span className="font-medium">128 EXP</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>진행도</span>
                    <span>72%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: '72%' }}></div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-card p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-medium mb-4">획득한 뱃지</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mb-2">
                    🏆
                  </div>
                  <span className="text-xs text-center">첫 게시글</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mb-2">
                    💬
                  </div>
                  <span className="text-xs text-center">소통왕</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mb-2">
                    ⭐
                  </div>
                  <span className="text-xs text-center">인기인</span>
                </div>
              </div>
            </div>
            
            <div className="bg-card p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-medium mb-4">최근 활동</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm">게시글 작성</span>
                  <span className="text-sm text-muted-foreground">이번 주 5개</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">댓글 작성</span>
                  <span className="text-sm text-muted-foreground">이번 주 12개</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">좋아요 받음</span>
                  <span className="text-sm text-muted-foreground">이번 주 28개</span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      )}
    </Tabs>
  );
}
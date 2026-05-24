'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getUserComments, getUserById } from '@/lib/api/users';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, ArrowLeft, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { safeTimestampToDate } from '@/lib/type-guards';
import { generateCommentPostUrl } from '@/lib/utils/post-url-generator';
import { User } from '@/types';
import { toast } from 'sonner';

interface Comment {
  id: string;
  content: string;
  postId: string;
  createdAt: unknown;
  postData?: {
    title: string;
    type: string;
    boardCode: string;
    boardName?: string;
    schoolId?: string;
    regions?: {
      sido: string;
      sigungu: string;
    };
  };
}

type CommentType = 'all' | 'national' | 'regional' | 'school';

export default function UserCommentsPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params?.userId as string;
  
  const [comments, setComments] = useState<Comment[]>([]);
  const [filteredComments, setFilteredComments] = useState<Comment[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<CommentType>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 10;

  const filterComments = (comments: Comment[], type: CommentType) => {
    if (type === 'all') return comments;
    return comments.filter(comment => comment.postData?.type === type);
  };

  const loadUser = async () => {
    if (!userId) return;
    
    try {
      const userData = await getUserById(userId);
      setUser(userData);
    } catch (error) {
      console.error('사용자 정보 로드 오류:', error);
    }
  };

  const loadComments = async (pageNum: number = 1, isLoadMore: boolean = false) => {
    if (!userId) return;

    try {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      const result = await getUserComments(userId, pageNum, ITEMS_PER_PAGE);
      
      if (isLoadMore) {
        setComments(prev => [...prev, ...(result.comments as Comment[])]);
      } else {
        setComments(result.comments as Comment[]);
      }
      
      setHasMore(result.hasMore);
      setPage(pageNum);
    } catch (error) {
      console.error('댓글 로드 오류:', error);
      setError('댓글을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadUser();
    loadComments();
  }, [userId]);

  useEffect(() => {
    setFilteredComments(filterComments(comments, selectedType));
  }, [selectedType, comments]);

  const handleTypeChange = (type: CommentType) => {
    setSelectedType(type);
  };

  const handleLoadMore = () => {
    loadComments(page + 1, true);
  };

  const getTypeLabel = (type: CommentType) => {
    switch (type) {
      case 'all': return '전체';
      case 'national': return '전국';
      case 'regional': return '지역';
      case 'school': return '학교';
      default: return '전체';
    }
  };

  const getBoardTypeLabel = (type?: string) => {
    switch (type) {
      case 'national': return '전국';
      case 'regional': return '지역';
      case 'school': return '학교';
      default: return type || '게시판';
    }
  };

  const getBoardName = (postData?: Comment['postData']) => {
    return postData?.boardName || postData?.boardCode || '게시판';
  };

  const handleCommentClick = (comment: Comment) => {
    // 게시글 데이터 검증
    if (!comment.postData || !comment.postId) {
      toast.error('게시글 정보를 찾을 수 없습니다.');
      return;
    }

    // 삭제되거나 접근할 수 없는 게시글 확인
    if (comment.postData.title === '삭제된 게시글' || comment.postData.title === '접근할 수 없는 게시글') {
      toast.error('해당 게시글에 접근할 수 없습니다.');
      return;
    }

    const commentPostUrl = generateCommentPostUrl(comment);
    router.push(commentPostUrl);
  };

  if (loading) {
    return (
      <div className="w-full max-w-md mx-auto p-4 space-y-4">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-8 flex-1" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-md mx-auto p-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button onClick={() => router.back()} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            돌아가기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto p-4 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="flex-shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold flex-1">
          {user?.profile?.userName || '사용자'}님의 댓글
        </h1>
      </div>

      {/* 필터 탭 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2 overflow-x-auto">
            {(['all', 'national', 'regional', 'school'] as CommentType[]).map((type) => (
              <Button
                key={type}
                variant={selectedType === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTypeChange(type)}
                className="flex-shrink-0"
              >
                {getTypeLabel(type)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 댓글 목록 */}
      <div className="space-y-3">
        {filteredComments.length > 0 ? (
          <>
            {filteredComments.map((comment) => {
              const isAccessible = comment.postData?.title !== '삭제된 게시글' && 
                                   comment.postData?.title !== '접근할 수 없는 게시글';
              
              return (
                <Card 
                  key={comment.id} 
                  className={`${isAccessible ? 'hover:shadow-md cursor-pointer' : 'opacity-60'} transition-shadow`}
                  onClick={() => isAccessible && handleCommentClick(comment)}
                >
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      {/* 배지 */}
                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-xs font-medium">
                            {getBoardTypeLabel(comment.postData?.type)}
                          </span>
                          <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-800 text-xs font-medium">
                            {getBoardName(comment.postData)}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {(() => {
                            try {
                              const date = safeTimestampToDate(comment.createdAt);
                              return formatDistanceToNow(date, { 
                                addSuffix: true, 
                                locale: ko 
                              });
                            } catch {
                              return '알 수 없음';
                            }
                          })()}
                        </span>
                      </div>

                      {/* 게시글 제목 */}
                      <div className="font-medium text-sm line-clamp-1">
                        {comment.postData?.title || '게시글 제목 없음'}
                      </div>

                      {/* 댓글 내용 */}
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        댓글: {comment.content?.replace(/<[^>]*>/g, '') || '댓글 내용'}
                      </p>

                      {/* 이동 링크 */}
                      <div className="text-xs text-blue-600 flex items-center gap-1">
                        {isAccessible ? (
                          <>
                            게시글로 이동 →
                          </>
                        ) : (
                          <span className="text-muted-foreground">
                            접근 불가
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            
            {/* 더보기 버튼 */}
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  variant="outline"
                  className="w-full"
                >
                  {loadingMore ? '로딩 중...' : '더보기'}
                </Button>
              </div>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">작성한 댓글이 없습니다</h3>
              <p className="text-sm text-muted-foreground">
                {user?.profile?.userName || '사용자'}님이 작성한 댓글이 없습니다.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}


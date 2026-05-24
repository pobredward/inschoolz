'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getUserPosts, getUserById } from '@/lib/api/users';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, ArrowLeft, FileText } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { safeTimestampToDate } from '@/lib/type-guards';
import { generatePostUrl } from '@/lib/utils/post-url-generator';
import { User } from '@/types';

interface UserPost {
  id: string;
  title: string;
  content: string;
  createdAt: unknown;
  boardCode: string;
  type: 'national' | 'regional' | 'school';
  schoolId?: string;
  regions?: {
    sido: string;
    sigungu: string;
  };
  attachments?: unknown[];
  stats: {
    viewCount: number;
    likeCount: number;
    commentCount: number;
  };
  boardName?: string;
  previewContent?: string;
  schoolName?: string;
}

type BoardType = 'all' | 'national' | 'regional' | 'school';

export default function UserPostsPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params?.userId as string;
  
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<UserPost[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<BoardType>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 10;

  const filterPosts = (posts: UserPost[], type: BoardType) => {
    if (type === 'all') return posts;
    return posts.filter(post => post.type === type);
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

  const loadPosts = async (pageNum: number = 1, isLoadMore: boolean = false) => {
    if (!userId) return;

    try {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      const result = await getUserPosts(userId, pageNum, ITEMS_PER_PAGE, 'latest');
      
      if (isLoadMore) {
        setPosts(prev => [...prev, ...(result.posts as UserPost[])]);
      } else {
        setPosts(result.posts as UserPost[]);
      }
      
      setHasMore(result.hasMore);
      setPage(pageNum);
    } catch (error) {
      console.error('게시글 로드 오류:', error);
      setError('게시글을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadUser();
    loadPosts();
  }, [userId]);

  useEffect(() => {
    setFilteredPosts(filterPosts(posts, selectedType));
  }, [selectedType, posts]);

  const handleTypeChange = (type: BoardType) => {
    setSelectedType(type);
  };

  const handleLoadMore = () => {
    loadPosts(page + 1, true);
  };

  const getTypeLabel = (type: BoardType) => {
    switch (type) {
      case 'all': return '전체';
      case 'national': return '전국';
      case 'regional': return '지역';
      case 'school': return '학교';
      default: return '전체';
    }
  };

  const getBoardTypeLabel = (type: string) => {
    switch (type) {
      case 'national': return '전국';
      case 'regional': return '지역';
      case 'school': return '학교';
      default: return type;
    }
  };

  const getBoardName = (post: UserPost) => {
    return post.boardName || '게시판';
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
          {user?.profile?.userName || '사용자'}님의 게시글
        </h1>
      </div>

      {/* 필터 탭 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2 overflow-x-auto">
            {(['all', 'national', 'regional', 'school'] as BoardType[]).map((type) => (
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

      {/* 게시글 목록 */}
      <div className="space-y-3">
        {filteredPosts.length > 0 ? (
          <>
            {filteredPosts.map((post) => {
              const postUrl = generatePostUrl({
                id: post.id,
                type: post.type,
                boardCode: post.boardCode,
                schoolId: post.schoolId,
                regions: post.regions
              });
              
              return (
                <Card key={post.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <Link href={postUrl} className="block space-y-2">
                      {/* 배지 */}
                      <div className="flex gap-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-xs font-medium">
                          {getBoardTypeLabel(post.type)}
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-800 text-xs font-medium">
                          {getBoardName(post)}
                        </span>
                      </div>

                      {/* 제목 */}
                      <h3 className="font-semibold text-lg line-clamp-1">
                        {post.title}
                      </h3>

                      {/* 내용 미리보기 */}
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {post.content?.replace(/<[^>]*>/g, '')}
                      </p>

                      {/* 통계 */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>👁️ {post.stats.viewCount.toLocaleString()}</span>
                        <span>❤️ {post.stats.likeCount.toLocaleString()}</span>
                        <span>💬 {post.stats.commentCount.toLocaleString()}</span>
                        <span className="ml-auto">
                          {(() => {
                            try {
                              const date = safeTimestampToDate(post.createdAt);
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
                    </Link>
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
              <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">작성한 게시글이 없습니다</h3>
              <p className="text-sm text-muted-foreground">
                {user?.profile?.userName || '사용자'}님이 작성한 게시글이 없습니다.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}


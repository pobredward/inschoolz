'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Heart, Calendar, ExternalLink } from 'lucide-react';
import { getUserComments } from '@/lib/api/users';
import { Comment } from '@/types';
import { formatSmartTime, toDate } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

interface GroupedComment {
  postId: string;
  postData: any;
  comments: Comment[];
}

export default function MyCommentsPage() {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [groupedComments, setGroupedComments] = useState<GroupedComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!user) return;

    const loadComments = async () => {
      try {
        setIsLoading(true);
        const result = await getUserComments(user.uid, 1, 20);
        setComments(result.comments);
        
        // 게시글별로 댓글 그룹화
        const grouped = groupCommentsByPost(result.comments);
        setGroupedComments(grouped);
        
        setHasMore(result.hasMore);
      } catch (error) {
        console.error('내 댓글 목록 로딩 오류:', error);
        toast.error('댓글 목록을 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    loadComments();
  }, [user]);
  
  const groupCommentsByPost = (comments: Comment[]): GroupedComment[] => {
    const grouped = comments.reduce((acc, comment) => {
      const postId = comment.postId;
      if (!acc[postId]) {
        acc[postId] = {
          postId,
          postData: comment.postData,
          comments: []
        };
      }
      acc[postId].comments.push(comment);
      return acc;
    }, {} as Record<string, GroupedComment>);
    
    // 최신 댓글 순으로 정렬
    return Object.values(grouped).sort((a, b) => {
      const latestA = Math.max(...a.comments.map(c => toDate(c.createdAt).getTime()));
      const latestB = Math.max(...b.comments.map(c => toDate(c.createdAt).getTime()));
      return latestB - latestA;
    });
  };

  const loadMoreComments = async () => {
    if (!user || !hasMore || isLoading) return;

    try {
      setIsLoading(true);
      const nextPage = currentPage + 1;
      const result = await getUserComments(user.uid, nextPage, 20);
      const newComments = [...comments, ...result.comments];
      setComments(newComments);
      
      // 새로운 댓글들과 함께 다시 그룹화
      const grouped = groupCommentsByPost(newComments);
      setGroupedComments(grouped);
      
      setHasMore(result.hasMore);
      setCurrentPage(nextPage);
    } catch (error) {
      console.error('추가 댓글 로딩 오류:', error);
      toast.error('댓글을 더 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-500">로그인이 필요합니다.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <MessageSquare className="h-6 w-6 text-green-600" />
            <h1 className="text-2xl font-bold">내 댓글</h1>
          </div>
          <p className="text-gray-600">작성한 댓글을 확인하세요.</p>
        </div>

        {isLoading && groupedComments.length === 0 ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : groupedComments.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">
                작성한 댓글이 없습니다
              </h3>
              <p className="text-gray-500 mb-4">
                게시글에 댓글을 작성해보세요.
              </p>
              <Link href="/community">
                <Button variant="outline">커뮤니티 둘러보기</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {groupedComments.map((group) => {
              const getBoardTypeLabel = (type: string) => {
                switch (type) {
                  case 'national': return '전국';
                  case 'regional': return '지역';
                  case 'school': return '학교';
                  default: return type;
                }
              };

              const getBoardName = (postData: any) => {
                return postData?.boardName || postData?.boardCode || '게시판';
              };

              const getPostUrl = () => {
                if (!group.postData) return '#';
                
                switch (group.postData.type) {
                  case 'national':
                    return `/community/national/${group.postData.boardCode}/${group.postId}`;
                  case 'regional':
                    return group.postData.regions 
                      ? `/community/region/${group.postData.regions.sido}/${group.postData.regions.sigungu}/${group.postData.boardCode}/${group.postId}`
                      : '#';
                  case 'school':
                    return group.postData.schoolId 
                      ? `/community/school/${group.postData.schoolId}/${group.postData.boardCode}/${group.postId}`
                      : '#';
                  default:
                    return '#';
                }
              };

              return (
                <Card key={group.postId} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    {/* 게시글 정보 헤더 */}
                    <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-100">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {group.postData && (
                            <>
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                                {getBoardTypeLabel(group.postData.type)}
                              </Badge>
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                                {getBoardName(group.postData)}
                              </Badge>
                              {(group.postData as any).attachments && (group.postData as any).attachments.length > 0 && (
                                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
                                  📷 사진
                                </Badge>
                              )}
                              {(group.postData as any).poll && (
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                                  📊 투표
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                        {group.postData?.title && (
                          <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                            {group.postData.title}
                          </h3>
                        )}
                        <p className="text-sm text-gray-600">
                          댓글 {group.comments.length}개 작성
                        </p>
                      </div>
                      <Link href={getPostUrl()}>
                        <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700">
                          <ExternalLink className="h-4 w-4 mr-1" />
                          원글 보기
                        </Button>
                      </Link>
                    </div>

                    {/* 내 댓글들 */}
                    <div className="space-y-3">
                      {group.comments.map((comment, index) => (
                        <div key={comment.id} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-gray-500">
                              댓글 #{index + 1}
                            </span>
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Calendar className="h-3 w-3" />
                              <span>{formatSmartTime(comment.createdAt)}</span>
                            </div>
                          </div>
                          <p className="text-gray-800 leading-relaxed text-sm">
                            {comment.content}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <Heart className="h-3 w-3" />
                              <span>{comment.stats?.likeCount || 0}</span>
                            </div>
                            {comment.isAnonymous && (
                              <Badge variant="outline" className="text-xs">
                                익명
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {hasMore && (
              <div className="text-center py-4">
                <Button 
                  onClick={loadMoreComments} 
                  disabled={isLoading}
                  variant="outline"
                >
                  {isLoading ? '로딩 중...' : '더 보기'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 
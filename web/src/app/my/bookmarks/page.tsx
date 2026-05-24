'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bookmark, Heart, MessageSquare, Eye, Calendar } from 'lucide-react';
import { getScrappedPosts } from '@/lib/api/board';
import { Post } from '@/types';
import { formatSmartTime } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

export default function ScrapsPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadScraps = async () => {
      try {
        setIsLoading(true);
        const scrappedPosts = await getScrappedPosts(user.uid);
        setPosts(scrappedPosts as Post[]);
              } catch (error) {
          console.error('스크랩 목록 로딩 오류:', error);
          toast.error('스크랩 목록을 불러오는데 실패했습니다.');
        } finally {
          setIsLoading(false);
        }
      };

      loadScraps();
  }, [user]);

  const getBoardTypeLabel = (type: string) => {
    switch (type) {
      case 'national': return '전국';
      case 'regional': return '지역';
      case 'school': return '학교';
      default: return type;
    }
  };

  const getPostUrl = (post: Post) => {
    switch (post.type) {
      case 'national':
        return `/community/national/${post.boardCode}/${post.id}`;
      case 'regional':
        return `/community/region/${post.regions?.sido}/${post.regions?.sigungu}/${post.boardCode}/${post.id}`;
      case 'school':
        return `/community/school/${post.schoolId}/${post.boardCode}/${post.id}`;
      default:
        return `/community/${post.type}/${post.boardCode}/${post.id}`;
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
            <Bookmark className="h-6 w-6 text-green-600" />
            <h1 className="text-2xl font-bold">스크랩한 글</h1>
          </div>
          <p className="text-gray-600">스크랩한 게시글을 확인하세요.</p>
        </div>

        {isLoading ? (
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
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Bookmark className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">
                스크랩한 글이 없습니다
              </h3>
              <p className="text-gray-500 mb-4">
                관심 있는 게시글을 스크랩해보세요.
              </p>
              <Link href="/community">
                <Button variant="outline">커뮤니티 둘러보기</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <Card key={post.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                        {getBoardTypeLabel(post.type)}
                      </Badge>
                      <span>•</span>
                      <Calendar className="h-3 w-3" />
                      <span>{formatSmartTime(post.createdAt)}</span>
                    </div>
                  </div>

                  <Link href={getPostUrl(post)}>
                    <h3 className="text-lg font-semibold mb-2 hover:text-green-600 transition-colors cursor-pointer">
                      {post.title}
                    </h3>
                  </Link>

                  {post.content && (
                    <p className="text-gray-600 mb-3 line-clamp-2">
                      {post.content.replace(/<[^>]*>/g, '').substring(0, 100)}
                      {post.content.length > 100 && '...'}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      <span>{post.stats.viewCount || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Heart className="h-4 w-4" />
                      <span>{post.stats.likeCount || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-4 w-4" />
                      <span>{post.stats.commentCount || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 
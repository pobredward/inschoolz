'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit } from 'lucide-react';
import { getUserPosts } from '@/lib/api/users';
import { Post } from '@/types';
import PostListItem from '@/components/board/PostListItem';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ExtendedPost extends Post {
  boardName?: string;
  previewContent?: string;
  schoolName?: string;
  regions?: {
    sido: string;
    sigungu: string;
  };
}

type BoardType = 'all' | 'national' | 'regional' | 'school';

export default function MyPostsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<ExtendedPost[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<ExtendedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedType, setSelectedType] = useState<BoardType>('all');

  useEffect(() => {
    if (!user) return;

    const loadPosts = async () => {
      try {
        setIsLoading(true);
        const result = await getUserPosts(user.uid, 1, 50, 'latest'); // 더 많은 게시글 로드하여 필터링
        setPosts(result.posts as ExtendedPost[]);
        filterPosts(result.posts as ExtendedPost[], selectedType);
        setHasMore(result.hasMore);
      } catch (error) {
        console.error('내 게시글 목록 로딩 오류:', error);
        toast.error('게시글 목록을 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    loadPosts();
  }, [user]);

  useEffect(() => {
    if (posts.length > 0) {
      filterPosts(posts, selectedType);
    }
  }, [selectedType, posts]);

  const filterPosts = (posts: ExtendedPost[], type: BoardType) => {
    let filtered = posts;
    
    if (type !== 'all') {
      filtered = posts.filter(post => post.type === type);
    }
    
    setFilteredPosts(filtered);
  };

  const handleTypeChange = (type: BoardType) => {
    setSelectedType(type);
    filterPosts(posts, type);
  };

  const getTypeLabel = (type: BoardType, post?: ExtendedPost) => {
    switch (type) {
      case 'all': return '전체';
      case 'national': return '전국';
      case 'regional': 
        if (post?.regions?.sido && post?.regions?.sigungu) {
          return `${post.regions.sido} ${post.regions.sigungu}`;
        }
        return '지역';
      case 'school': 
        if (post?.schoolName) {
          return post.schoolName;
        }
        return '학교';
      default: return '전체';
    }
  };

  const loadMorePosts = async () => {
    if (!user || !hasMore || isLoading) return;

    try {
      setIsLoading(true);
      const nextPage = currentPage + 1;
      const result = await getUserPosts(user.uid, nextPage, 20, 'latest');
      setPosts(prev => [...prev, ...result.posts as ExtendedPost[]]);
      setHasMore(result.hasMore);
      setCurrentPage(nextPage);
    } catch (error) {
      console.error('추가 게시글 로딩 오류:', error);
      toast.error('게시글을 더 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };



  const getPostUrl = (post: ExtendedPost) => {
    if (post.type === 'national') {
      return `/community/national/${post.boardCode}/${post.id}`;
    } else if (post.type === 'regional' && post.regions) {
      return `/community/region/${encodeURIComponent(post.regions.sido)}/${encodeURIComponent(post.regions.sigungu)}/${post.boardCode}/${post.id}`;
    } else if (post.type === 'school' && post.schoolId) {
      return `/community/school/${post.schoolId}/${post.boardCode}/${post.id}`;
    }
    return '#';
  };

  const handlePostClick = (post: ExtendedPost) => {
    const url = getPostUrl(post);
    if (url !== '#') {
      router.push(url);
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

  const getBoardName = (post: ExtendedPost) => {
    return post.boardName || '게시판';
  };

  if (isLoading && posts.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-500">게시글을 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold">내가 쓴 글</h1>
            <div className="text-sm text-gray-500">
              총 {filteredPosts.length}개
            </div>
          </div>
          <p className="text-gray-600">작성한 게시글을 확인하세요.</p>
        </div>

        {/* 토글 필터 */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {(['all', 'national', 'regional', 'school'] as BoardType[]).map((type) => (
            <Button
              key={type}
              variant={selectedType === type ? "default" : "outline"}
              size="sm"
              onClick={() => handleTypeChange(type)}
              className={`whitespace-nowrap ${selectedType === type ? 'bg-green-500 hover:bg-green-600' : ''}`}
            >
              {getTypeLabel(type)}
            </Button>
          ))}
        </div>

        {filteredPosts.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              {selectedType === 'all' ? '작성한 게시글이 없습니다' : `${getTypeLabel(selectedType)} 게시글이 없습니다`}
            </h3>
            <p className="text-gray-500 mb-6">
              {selectedType === 'all' ? '첫 번째 게시글을 작성해보세요!' : '다른 카테고리를 선택해보세요.'}
            </p>
            {selectedType === 'all' && (
              <Button onClick={() => router.push('/community')}>
                게시글 작성하기
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPosts.map((post) => (
              <PostListItem
                key={post.id}
                post={{
                  ...post,
                  authorInfo: post.authorInfo || { displayName: '나', isAnonymous: false },
                  boardName: getBoardName(post),
                }}
                href={getPostUrl(post)}
                showBadges={true}
                typeBadgeText={getBoardTypeLabel(post.type)}
                boardBadgeText={getBoardName(post)}
                variant="profile"
              />
            ))}

            {/* 더 보기 버튼 */}
            {hasMore && (
              <div className="flex justify-center pt-6">
                <Button
                  variant="outline"
                  onClick={loadMorePosts}
                  disabled={isLoading}
                  className="w-full max-w-md"
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
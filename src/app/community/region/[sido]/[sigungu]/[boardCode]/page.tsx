import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, TrendingUp, MessageSquare, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { stripHtmlTags } from '@/lib/utils';
import { getBoardsByType } from '@/lib/api/board';
import { Metadata } from 'next';

interface PageProps {
  params: Promise<{
    sido: string;
    sigungu: string;
    boardCode: string;
  }>;
}

// 샘플 게시글 데이터
const getSamplePosts = () => [
  {
    id: '1',
    title: '강남구 맛집 추천드려요!',
    content: '강남구에서 정말 맛있는 곳들을 소개해드리겠습니다. 특히 압구정 근처가 좋아요.',
    author: '맛집탐험가',
    timeAgo: '1시간 전',
    views: 456,
    likes: 23,
    comments: 12,
    isHot: true,
  },
  {
    id: '2',
    title: '학원 정보 공유해요',
    content: '강남구 학원들 정보를 정리해봤습니다. 수학 학원 위주로 정리했어요.',
    author: '학부모',
    timeAgo: '3시간 전',
    views: 789,
    likes: 34,
    comments: 18,
    isHot: false,
  },
  {
    id: '3',
    title: '동네 소식 전해드려요',
    content: '이번 주말에 강남구에서 열리는 행사들을 정리해봤습니다.',
    author: '동네주민',
    timeAgo: '5시간 전',
    views: 234,
    likes: 15,
    comments: 8,
    isHot: false,
  },
];

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { boardCode, sido, sigungu } = await params;
  const decodedSido = decodeURIComponent(sido);
  const decodedSigungu = decodeURIComponent(sigungu);
  
  try {
    const boards = await getBoardsByType('regional');
    const boardInfo = boards.find(board => board.code === boardCode);
    
    if (!boardInfo) {
      return {
        title: '게시판을 찾을 수 없습니다 - Inschoolz',
        description: '요청하신 게시판을 찾을 수 없습니다.',
      };
    }

    return {
      title: `${boardInfo.name} - ${decodedSido} ${decodedSigungu} - Inschoolz`,
      description: `${decodedSido} ${decodedSigungu} ${boardInfo.name}에서 지역 정보를 공유하고 소통해보세요. ${boardInfo.description}`,
      openGraph: {
        title: `${boardInfo.name} - ${decodedSido} ${decodedSigungu}`,
        description: boardInfo.description,
        type: 'website',
        siteName: 'Inschoolz',
      },
    };
  } catch (error) {
    console.error('메타데이터 생성 오류:', error);
    return {
      title: '게시판을 찾을 수 없습니다 - Inschoolz',
      description: '요청하신 게시판을 찾을 수 없습니다.',
    };
  }
}

export default async function RegionalBoardPage({ params }: PageProps) {
  const { boardCode, sido, sigungu } = await params;
  const decodedSido = decodeURIComponent(sido);
  const decodedSigungu = decodeURIComponent(sigungu);
  
  try {
    const boards = await getBoardsByType('regional');
    const boardInfo = boards.find(board => board.code === boardCode);
    
    if (!boardInfo) {
      notFound();
    }

    const posts = getSamplePosts();

    return (
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          {/* 헤더 */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              <Link href="/community">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  커뮤니티
                </Button>
              </Link>
            </div>
            
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-500 text-white">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl">{boardInfo.icon || '💬'}</span>
                        <CardTitle className="text-2xl">{boardInfo.name}</CardTitle>
                        <Badge variant="secondary">{decodedSido} {decodedSigungu}</Badge>
                      </div>
                      <p className="text-muted-foreground">{boardInfo.description}</p>
                    </div>
                  </div>
                  <Link href={`/community/region/${sido}/${sigungu}/${boardCode}/write`}>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      글쓰기
                    </Button>
                  </Link>
                </div>
              </CardHeader>
            </Card>
          </div>

          {/* 게시글 목록 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="space-y-3">
              {posts.map((post) => (
                <Link key={post.id} href={`/community/region/${sido}/${sigungu}/${boardCode}/${post.id}`} className="block group">
                  <div className="bg-white p-4 rounded-lg border border-gray-100 hover:shadow-md transition-all duration-200">
                    {/* 상단 뱃지들 */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-bold text-gray-700 bg-blue-100 px-2 py-1 rounded">
                        지역
                      </span>
                      <span className="text-xs font-bold text-gray-700 bg-green-100 px-2 py-1 rounded">
                        {boardCode}
                      </span>
                      {post.isHot && (
                        <span className="text-xs font-bold text-white bg-red-500 px-2 py-1 rounded">
                          🔥 HOT
                        </span>
                      )}
                    </div>
                    
                    {/* 제목 */}
                    <h3 className="font-semibold text-gray-900 group-hover:text-green-600 line-clamp-2 leading-relaxed mb-2">
                      {post.title}
                    </h3>
                    
                    {/* 내용 미리보기 */}
                    <div className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {stripHtmlTags(post.content)}
                    </div>
                    
                    {/* 하단 정보 */}
                    <div className="flex items-center justify-between">
                      {/* 작성자 | 날짜 */}
                      <div className="text-sm text-gray-500">
                        <span>{post.author}</span>
                        <span className="mx-1">|</span>
                        <span>{post.timeAgo}</span>
                      </div>
                      
                      {/* 통계 (조회수, 좋아요, 댓글) */}
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <span>👁</span>
                          {post.views || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <span>👍</span>
                          {post.likes || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <span>💬</span>
                          {post.comments || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* 페이지네이션 */}
          <div className="mt-8 flex justify-center">
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled>
                이전
              </Button>
              <Button variant="default" size="sm">1</Button>
              <Button variant="outline" size="sm">2</Button>
              <Button variant="outline" size="sm">3</Button>
              <Button variant="outline">
                다음
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Regional board page 오류:', error);
    notFound();
  }
}; 
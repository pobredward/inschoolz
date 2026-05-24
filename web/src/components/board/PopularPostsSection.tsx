import React from "react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/utils";
import { BoardType } from "@/types/board";
import { Card, CardContent } from "@/components/ui/card";
import { getPopularPostsForHome } from "@/lib/api/board";

interface PopularPostsSectionProps {
  type: BoardType;
}

export default async function PopularPostsSection({ type }: PopularPostsSectionProps) {
  // 실제 인기 게시글 가져오기
  const popularPosts = await getPopularPostsForHome(5);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">인기 게시글</h2>
        <Link href="/board/popular" className="text-sm text-primary hover:underline">
          더보기
        </Link>
      </div>
      
      <div className="space-y-3">
        {popularPosts.map((post) => (
          <Link key={post.id} href={`/community/national/${post.boardCode}/${post.id}/fast`}>
            <Card className="hover:shadow-md transition-all duration-200">
              <CardContent className="p-4">
                {/* 상단 뱃지들 */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-gray-700 bg-blue-100 px-2 py-1 rounded">
                    전국
                  </span>
                  <span className="text-xs font-bold text-gray-700 bg-green-100 px-2 py-1 rounded">
                    {post.boardName || post.boardCode}
                  </span>
                </div>
                
                {/* 제목 */}
                <h3 className="font-semibold text-gray-900 hover:text-primary line-clamp-2 leading-relaxed mb-2">
                  {post.title}
                </h3>
                
                {/* 내용 미리보기 */}
                <div className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {post.previewContent || '게시글 내용을 확인해보세요.'}
                </div>
                
                {/* 하단 정보 */}
                <div className="flex items-center justify-between">
                  {/* 작성자 | 날짜 */}
                  <div className="text-sm text-muted-foreground">
                    <span>{post.authorInfo.isAnonymous ? '익명' : post.authorInfo.displayName}</span>
                    <span className="mx-1">|</span>
                    <span>{formatRelativeTime(post.createdAt)}</span>
                  </div>
                  
                  {/* 통계 (조회수, 좋아요, 댓글) */}
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span>👁</span>
                      {post.stats.viewCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <span>👍</span>
                      {post.stats.likeCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <span>💬</span>
                      {post.stats.commentCount}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      
      {popularPosts.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">인기 게시글이 없습니다.</p>
        </div>
      )}
    </section>
  );
} 
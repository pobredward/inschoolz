import { Suspense } from 'react';
import { getPost, getBoard } from '@/lib/api/boards';
import { notFound } from 'next/navigation';
import { Post } from '@/types';
import { Board } from '@/types/board';
import { PostEditClient } from '@/components/board/PostEditClient';
import { serializeObject } from '@/lib/utils';

interface PageProps {
  params: Promise<{
    boardCode: string;
    postId: string;
  }>;
}

async function PostEditContent({ boardCode, postId }: { boardCode: string; postId: string }) {
  try {
    const [post, board] = await Promise.all([
      getPost(postId),
      getBoard(boardCode)
    ]);

    if (!post || !board) {
      notFound();
    }

    // Firebase Timestamp 직렬화
    const serializedPost = serializeObject(post, ['createdAt', 'updatedAt']);
    const serializedBoard = serializeObject(board, ['createdAt', 'updatedAt']);

    return (
      <PostEditClient
        post={serializedPost as Post}
        board={serializedBoard as Board}
        type="national"
        boardCode={boardCode}
      />
    );
  } catch (error) {
    console.error('게시글 편집 페이지 로드 오류:', error);
    notFound();
  }
}

export default async function PostEditPage({ params }: PageProps) {
  const { boardCode, postId } = await params;

  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">게시글을 불러오는 중...</p>
            </div>
          </div>
        </div>
      </div>
    }>
      <PostEditContent boardCode={boardCode} postId={postId} />
    </Suspense>
  );
} 
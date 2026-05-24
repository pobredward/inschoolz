import { notFound } from 'next/navigation';
import { cache } from 'react';
import { getPostDetailOptimized, getPostDocument, getBoardsByType } from '@/lib/api/board';
import { PostViewClient } from '@/components/board/PostViewClient';
import type { BoardType } from '@/types/board';
import { Post, Comment } from '@/types';
import { stripHtmlTags } from '@/lib/utils';

// generateMetadata: post 문서만 필요 → getPostDocumentCached
// page(): 댓글까지 필요 → getPostDetailCached
// getBoardsByType: unstable_cache(1시간) 적용
const getPostDocumentCached = cache(getPostDocument);
const getPostDetailCached = cache(getPostDetailOptimized);

interface PostDetailPageProps {
  params: Promise<{
    type: BoardType;
    boardCode: string;
    postId: string;
  }>;
}

export default async function PostDetailPage({ params }: PostDetailPageProps) {
  const { type, boardCode, postId } = await params;

  try {
    const [{ post, comments }, boards] = await Promise.all([
      getPostDetailCached(postId, true),
      getBoardsByType(type)
    ]);
    const board = boards.find(b => b.code === boardCode);
    
    if (!board) {
      notFound();
    }

    if ((post as Post).boardCode !== boardCode) {
      notFound();
    }

    return (
      <PostViewClient
        post={post as Post}
        initialComments={comments as Comment[]}
      />
    );
  } catch (error) {
    console.error('게시글 상세 페이지 오류:', error);
    notFound();
  }
}

export async function generateMetadata({ params }: PostDetailPageProps) {
  const { postId } = await params;
  
  try {
    const post = await getPostDocumentCached(postId);
    
    if (!post) {
      return {
        title: '게시글을 찾을 수 없습니다 - Inschoolz',
        description: '요청하신 게시글을 찾을 수 없습니다.',
      };
    }

    return {
      title: `${post.title} - Inschoolz`,
      description: stripHtmlTags(post.content).slice(0, 150) + '...',
      openGraph: {
        title: post.title,
        description: stripHtmlTags(post.content).slice(0, 150) + '...',
        images: post.attachments?.length > 0 ? [post.attachments[0].url] : [],
      },
    };
  } catch {
    return {
      title: '게시글을 찾을 수 없습니다 - Inschoolz',
      description: '요청하신 게시글을 찾을 수 없습니다.',
    };
  }
}

import React from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostViewClient } from "@/components/board/PostViewClient";
import { getPostDetail, getBoardsByType } from "@/lib/api/board";
import { Post, Comment } from "@/types";
import { stripHtmlTags, serializeTimestamp } from "@/lib/utils";
import { ArticleStructuredData, BreadcrumbStructuredData } from "@/components/seo/StructuredData";
import { 
  generateSeoTitle, 
  generateSeoDescription, 
  generateSeoKeywords,
  categorizePost
} from "@/lib/seo-utils";

interface PostViewPageProps {
  params: Promise<{
    boardCode: string;
    postId: string;
  }>;
}

export async function generateMetadata({ params }: PostViewPageProps): Promise<Metadata> {
  const { boardCode, postId } = await params;
  
  try {
    // 실제 게시글 데이터 가져오기
    const { post } = await getPostDetail(postId);
    const boards = await getBoardsByType('national');
    const boardInfo = boards.find(board => board.code === boardCode);
    
    if (!boardInfo || !post) {
      return {
        title: '게시글을 찾을 수 없습니다 - 인스쿨즈',
        description: '요청하신 게시글을 찾을 수 없습니다.',
        robots: 'noindex, nofollow',
      };
    }

    // 익명 게시글은 검색엔진에서 제외
    const isAnonymous = post.authorInfo?.isAnonymous;
    
    // 게시글 내용 정리 및 작성 정보 추가
    const cleanContent = stripHtmlTags(post.content);
    const authorName = isAnonymous ? '익명' : (post.authorInfo?.displayName || '사용자');
    const createdDate = serializeTimestamp(post.createdAt).toLocaleDateString('ko-KR');
    
    // 첨부 이미지 추출
    const images = post.attachments?.filter(att => att.type === 'image').map(att => att.url) || [];
    const firstImage = images.length > 0 ? images[0] : undefined;
    
    // SEO 최적화된 메타데이터 생성
    const seoTitle = generateSeoTitle(post, boardInfo.name, 'national');
    const seoDescription = generateSeoDescription(
      post, 
      cleanContent, 
      authorName, 
      createdDate, 
      'national'
    );
    const seoKeywords = generateSeoKeywords(post, boardInfo.name, 'national');
    
    // 게시글 카테고리 분류
    const categories = categorizePost(post.title, post.content);

    return {
      title: seoTitle,
      description: seoDescription,
      keywords: seoKeywords,
      authors: [{ name: authorName }],
      robots: isAnonymous ? 'noindex, nofollow' : 'index, follow',
      alternates: {
        canonical: `https://inschoolz.com/community/national/${boardCode}/${postId}`,
      },
      openGraph: {
        title: seoTitle,
        description: seoDescription,
        type: 'article',
        siteName: 'Inschoolz - 인스쿨즈',
        url: `https://inschoolz.com/community/national/${boardCode}/${postId}`,
        publishedTime: serializeTimestamp(post.createdAt).toISOString(),
        modifiedTime: serializeTimestamp(post.updatedAt || post.createdAt).toISOString(),
        authors: [authorName],
        section: `전국 ${boardInfo.name}`,
        tags: [...categories, ...seoKeywords.slice(0, 10)],
        ...(firstImage && { images: [{ url: firstImage, alt: post.title }] }),
      },
      twitter: {
        card: firstImage ? 'summary_large_image' : 'summary',
        title: seoTitle,
        description: seoDescription,
        site: '@inschoolz',
        creator: `@${authorName}`,
        ...(firstImage && { images: [firstImage] }),
      },
      other: {
        'article:section': `전국 ${boardInfo.name}`,
        'article:tag': categories.join(','),
        'article:author': authorName,
        'article:published_time': serializeTimestamp(post.createdAt).toISOString(),
        'article:modified_time': serializeTimestamp(post.updatedAt || post.createdAt).toISOString(),
      },
    };
  } catch (error) {
    console.error('메타데이터 생성 오류:', error);
    return {
      title: '게시글을 찾을 수 없습니다 - 인스쿨즈',
      description: '요청하신 게시글을 찾을 수 없습니다.',
      robots: 'noindex, nofollow',
    };
  }
}

export default async function NationalPostDetailPage({ params }: PostViewPageProps) {
  const { boardCode, postId } = await params;
  
  try {
    // 게시글 상세 정보 가져오기 (이미 직렬화됨)
    const { post, comments } = await getPostDetail(postId);
    
    // 게시판 정보 가져오기
    const boards = await getBoardsByType('national');
    const board = boards.find(b => b.code === boardCode);
    
    if (!board) {
      notFound();
    }

    // 게시글이 해당 게시판에 속하는지 확인
    if ((post as Post).boardCode !== boardCode) {
      notFound();
    }

    const postUrl = `https://inschoolz.com/community/national/${boardCode}/${postId}`;
    
    // SEO 최적화 데이터 생성
    const categories = categorizePost((post as Post).title, (post as Post).content);
    const seoKeywords = generateSeoKeywords(post as Post, board.name, 'national');

    return (
      <>
        {/* SEO 구조화 데이터 */}
        <ArticleStructuredData
          post={post as Post}
          url={postUrl}
          boardName={board.name}
          communityType="national"
          categories={categories}
          keywords={seoKeywords}
        />
        <BreadcrumbStructuredData 
          boardCode={boardCode}
          boardName={board.name}
          postTitle={(post as Post).title}
          communityType="national"
        />
        
        <PostViewClient
          post={post as unknown as Post}
          initialComments={comments as unknown as Comment[]}
        />
      </>
    );
  } catch (error) {
    console.error('National 게시글 상세 페이지 오류:', error);
    notFound();
  }
} 
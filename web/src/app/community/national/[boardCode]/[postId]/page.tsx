import React from "react";
import { cache } from "react";
import { cookies } from "next/headers";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostViewClient } from "@/components/board/PostViewClient";
import { getPostDetailAdmin } from "@/lib/api/community-server";
import { Post, Comment, Board } from "@/types";
import { stripHtmlTags, serializeTimestamp, sanitizeHtmlServer } from "@/lib/utils";
import { ArticleStructuredData, BreadcrumbStructuredData } from "@/components/seo/StructuredData";
import { 
  generateSeoTitle, 
  generateSeoDescription, 
  generateSeoKeywords,
  categorizePost
} from "@/lib/seo-utils";

// generateMetadata와 page()가 동일한 React cache를 공유 → Admin SDK 1번만 호출
const getPostDetailAdminCached = cache(
  (postId: string, uid: string) => getPostDetailAdmin(postId, 'national', uid, 30)
);

interface PostViewPageProps {
  params: Promise<{
    boardCode: string;
    postId: string;
  }>;
}

export async function generateMetadata({ params }: PostViewPageProps): Promise<Metadata> {
  const { boardCode, postId } = await params;
  
  try {
    // metadata용: uid 없이 호출 — boards는 result 안에 포함됨
    const result = await getPostDetailAdminCached(postId, '');
    const boardInfo = (result?.boards as Board[] | undefined)?.find((board: Board) => board.code === boardCode);
    
    if (!boardInfo || !result?.post) {
      return {
        title: '게시글을 찾을 수 없습니다 - 인스쿨즈',
        description: '요청하신 게시글을 찾을 수 없습니다.',
        robots: 'noindex, nofollow',
      };
    }

    const postData = result.post as unknown as Post;
    const isAnonymous = postData.authorInfo?.isAnonymous;
    const cleanContent = stripHtmlTags(postData.content);
    const authorName = isAnonymous ? '익명' : (postData.authorInfo?.displayName || '사용자');
    const createdDate = serializeTimestamp(postData.createdAt).toLocaleDateString('ko-KR');
    const images = postData.attachments?.filter(att => att.type === 'image').map(att => att.url) || [];
    const firstImage = images.length > 0 ? images[0] : undefined;
    
    const seoTitle = generateSeoTitle(postData, boardInfo.name, 'national');
    const seoDescription = generateSeoDescription(postData, cleanContent, authorName, createdDate, 'national');
    const seoKeywords = generateSeoKeywords(postData, boardInfo.name, 'national');
    const categories = categorizePost(postData.title, postData.content);

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
        publishedTime: serializeTimestamp(postData.createdAt).toISOString(),
        modifiedTime: serializeTimestamp(postData.updatedAt || postData.createdAt).toISOString(),
        authors: [authorName],
        section: `전국 ${boardInfo.name}`,
        tags: [...categories, ...seoKeywords.slice(0, 10)],
        ...(firstImage && { images: [{ url: firstImage, alt: postData.title }] }),
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
        'article:published_time': serializeTimestamp(postData.createdAt).toISOString(),
        'article:modified_time': serializeTimestamp(postData.updatedAt || postData.createdAt).toISOString(),
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
    const cookieStore = await cookies();
    const uid = cookieStore.get('uid')?.value || '';

    // Admin SDK 단일 호출: post + comments + boards + userState 완전 병렬
    const result = await getPostDetailAdminCached(postId, uid);
    
    if (!result) notFound();

    const { post, comments, hasMoreComments, boards, userState } = result;
    
    const board = (boards as Board[]).find(b => b.code === boardCode);
    if (!board) notFound();

    if ((post as unknown as Post).boardCode !== boardCode) notFound();

    const postUrl = `https://inschoolz.com/community/national/${boardCode}/${postId}`;
    const categories = categorizePost((post as unknown as Post).title, (post as unknown as Post).content);
    const seoKeywords = generateSeoKeywords(post as unknown as Post, board.name, 'national');

    return (
      <>
        <ArticleStructuredData
          post={post as unknown as Post}
          url={postUrl}
          boardName={board.name}
          communityType="national"
          categories={categories}
          keywords={seoKeywords}
        />
        <BreadcrumbStructuredData 
          boardCode={boardCode}
          boardName={board.name}
          postTitle={(post as unknown as Post).title}
          communityType="national"
        />
        
        <PostViewClient
          post={post as unknown as Post}
          initialComments={comments as unknown as Comment[]}
          hasMoreComments={hasMoreComments}
          sanitizedContent={sanitizeHtmlServer((post as unknown as Post).content)}
          initialUserState={userState}
        />
      </>
    );
  } catch (error) {
    console.error('National 게시글 상세 페이지 오류:', error);
    notFound();
  }
}

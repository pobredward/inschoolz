import React from "react";
import { cache } from "react";
import { cookies } from "next/headers";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostViewClient } from "@/components/board/PostViewClient";
import { getPostDetailAdmin } from "@/lib/api/community-server";
import { Post, Comment } from "@/types";
import { stripHtmlTags, serializeTimestamp, sanitizeHtmlServer } from "@/lib/utils";
import { 
  generateSeoTitle, 
  generateSeoDescription, 
  generateSeoKeywords,
  categorizePost
} from "@/lib/seo-utils";

const getPostDetailAdminCached = cache(
  (postId: string, uid: string) => getPostDetailAdmin(postId, 'regional', uid, 30)
);

interface PostViewPageProps {
  params: Promise<{
    sido: string;
    sigungu: string;
    boardCode: string;
    postId: string;
  }>;
}

export async function generateMetadata({ params }: PostViewPageProps): Promise<Metadata> {
  const { sido, sigungu, boardCode, postId } = await params;
  
  try {
    const result = await getPostDetailAdminCached(postId, '');
    const boardInfo = result?.boards?.find(board => board.code === boardCode);
    
    if (!boardInfo || !result?.post) {
      return {
        title: '게시글을 찾을 수 없습니다 - 인스쿨즈',
        description: '요청하신 게시글을 찾을 수 없습니다.',
        robots: 'noindex, nofollow',
      };
    }

    const post = result.post as unknown as Post;
    const isAnonymous = post.authorInfo?.isAnonymous;
    const cleanContent = stripHtmlTags(post.content);
    const authorName = isAnonymous ? '익명' : (post.authorInfo?.displayName || '사용자');
    const createdDate = serializeTimestamp(post.createdAt).toLocaleDateString('ko-KR');
    const images = post.attachments?.filter(att => att.type === 'image').map(att => att.url) || [];
    const firstImage = images.length > 0 ? images[0] : undefined;
    
    const decodedSido = decodeURIComponent(sido);
    const decodedSigungu = decodeURIComponent(sigungu);
    const fullAddress = `${decodedSido} ${decodedSigungu}`;
    
    const locationInfo = { name: decodedSigungu, address: fullAddress };
    const seoTitle = generateSeoTitle(post, boardInfo.name, 'regional', locationInfo);
    const seoDescription = generateSeoDescription(post, cleanContent, authorName, createdDate, 'regional', locationInfo);
    const seoKeywords = generateSeoKeywords(post, boardInfo.name, 'regional', locationInfo);
    const categories = categorizePost(post.title, post.content);

    return {
      title: seoTitle,
      description: seoDescription,
      keywords: seoKeywords,
      authors: [{ name: authorName }],
      robots: isAnonymous ? 'noindex, nofollow' : 'index, follow',
      alternates: {
        canonical: `https://inschoolz.com/community/region/${sido}/${sigungu}/${boardCode}/${postId}`,
      },
      openGraph: {
        title: seoTitle,
        description: seoDescription,
        type: 'article',
        siteName: 'Inschoolz - 인스쿨즈',
        url: `https://inschoolz.com/community/region/${sido}/${sigungu}/${boardCode}/${postId}`,
        publishedTime: serializeTimestamp(post.createdAt).toISOString(),
        modifiedTime: serializeTimestamp(post.updatedAt || post.createdAt).toISOString(),
        authors: [authorName],
        section: `${fullAddress} ${boardInfo.name}`,
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
        'article:section': `${fullAddress} ${boardInfo.name}`,
        'article:tag': categories.join(','),
        'article:author': authorName,
        'article:published_time': serializeTimestamp(post.createdAt).toISOString(),
        'article:modified_time': serializeTimestamp(post.updatedAt || post.createdAt).toISOString(),
        'region:sido': decodedSido,
        'region:sigungu': decodedSigungu,
        'region:address': fullAddress,
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

export default async function RegionalPostDetailPage({ params }: PostViewPageProps) {
  const { boardCode, postId } = await params;
  
  try {
    const cookieStore = await cookies();
    const uid = cookieStore.get('uid')?.value || '';

    // Admin SDK 단일 호출: post + comments + boards + userState 완전 병렬
    const result = await getPostDetailAdminCached(postId, uid);
    
    if (!result) notFound();

    const { post, comments, hasMoreComments, boards, userState } = result;
    
    const board = boards.find(b => b.code === boardCode);
    if (!board) notFound();

    if ((post as unknown as Post).boardCode !== boardCode) notFound();

    return (
      <PostViewClient
        post={post as unknown as Post}
        initialComments={comments as unknown as Comment[]}
        hasMoreComments={hasMoreComments}
        sanitizedContent={sanitizeHtmlServer((post as unknown as Post).content)}
        initialUserState={userState}
      />
    );
  } catch (error) {
    console.error('Regional 게시글 상세 페이지 오류:', error);
    notFound();
  }
}

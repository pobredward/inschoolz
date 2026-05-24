'use client';

import { Post } from "@/types";
import { toDate } from '@/lib/utils';

interface ArticleStructuredDataProps {
  post: Post;
  url: string;
  boardName: string;
  communityType: 'national' | 'school' | 'regional';
  locationInfo?: { name: string; address?: string };
  categories?: string[];
  keywords?: string[];
}

export function ArticleStructuredData({ 
  post, 
  url, 
  boardName, 
  communityType,
  locationInfo,
  categories = [],
  keywords = []
}: ArticleStructuredDataProps) {
  const authorName = post.authorInfo?.isAnonymous ? '익명' : (post.authorInfo?.displayName || '사용자');
  const images = post.attachments?.filter(att => att.type === 'image').map(att => att.url) || [];
  
  // 커뮤니티 타입별 섹션 이름
  let sectionName = '';
  switch (communityType) {
    case 'national':
      sectionName = `전국 ${boardName}`;
      break;
    case 'school':
      sectionName = `${locationInfo?.name} ${boardName}`;
      break;
    case 'regional':
      sectionName = `${locationInfo?.address || locationInfo?.name} ${boardName}`;
      break;
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post.title,
    "description": post.content.slice(0, 200) + "...",
    "image": images.length > 0 ? images : undefined,
    "author": {
      "@type": "Person",
      "name": authorName,
      "url": post.authorInfo?.isAnonymous ? undefined : `https://inschoolz.com/users/${post.authorId}`
    },
    "publisher": {
      "@type": "Organization",
      "name": "Inschoolz",
      "logo": {
        "@type": "ImageObject",
        "url": "https://inschoolz.com/logo.png"
      }
    },
    "datePublished": new Date(toDate(post.createdAt)).toISOString(),
    "dateModified": new Date(toDate(post.updatedAt || post.createdAt)).toISOString(),
    "articleSection": sectionName,
    "keywords": keywords.join(", "),
    "genre": categories.join(", "),
    "url": url,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": url
    },
    "interactionStatistic": [
      {
        "@type": "InteractionCounter",
        "interactionType": "https://schema.org/LikeAction",
        "userInteractionCount": post.stats?.likeCount || 0
      },
      {
        "@type": "InteractionCounter", 
        "interactionType": "https://schema.org/CommentAction",
        "userInteractionCount": post.stats?.commentCount || 0
      },
      {
        "@type": "InteractionCounter",
        "interactionType": "https://schema.org/ViewAction", 
        "userInteractionCount": post.stats?.viewCount || 0
      }
    ],
    "isPartOf": {
      "@type": "WebSite",
      "name": "Inschoolz",
      "alternateName": "인스쿨즈",
      "url": "https://inschoolz.com",
      "description": "초중고 학생을 위한 3계층 커뮤니티 서비스"
    },
    "about": [
      {
        "@type": "Thing",
        "name": boardName,
        "description": `${sectionName} 게시판`
      },
      ...(locationInfo ? [{
        "@type": communityType === 'school' ? "EducationalOrganization" : "Place",
        "name": locationInfo.name,
        "address": locationInfo.address
      }] : []),
      ...categories.map(category => ({
        "@type": "Thing", 
        "name": category,
        "description": `${category} 관련 게시글`
      }))
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

interface BreadcrumbStructuredDataProps {
  boardCode: string;
  boardName: string;
  postTitle: string;
  communityType: 'national' | 'school' | 'regional';
  locationInfo?: { name: string; address?: string };
  schoolId?: string;
  sido?: string;
  sigungu?: string;
}

export function BreadcrumbStructuredData({ 
  boardCode, 
  boardName, 
  postTitle,
  communityType,
  locationInfo,
  schoolId,
  sido,
  sigungu
}: BreadcrumbStructuredDataProps) {
  const breadcrumbItems = [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "홈",
      "item": "https://inschoolz.com"
    },
    {
      "@type": "ListItem", 
      "position": 2,
      "name": "커뮤니티",
      "item": "https://inschoolz.com/community"
    }
  ];

  // 커뮤니티 타입별 브레드크럼
  switch (communityType) {
    case 'national':
      breadcrumbItems.push(
        {
          "@type": "ListItem",
          "position": 3,
          "name": "전국 커뮤니티", 
          "item": "https://inschoolz.com/community?tab=national"
        },
        {
          "@type": "ListItem",
          "position": 4,
          "name": boardName,
          "item": `https://inschoolz.com/community/national/${boardCode}`
        }
      );
      break;
    case 'school':
      breadcrumbItems.push(
        {
          "@type": "ListItem",
          "position": 3,
          "name": "학교 커뮤니티",
          "item": "https://inschoolz.com/community?tab=school"
        },
        {
          "@type": "ListItem", 
          "position": 4,
          "name": locationInfo?.name || "학교",
          "item": `https://inschoolz.com/community/school/${schoolId}/${boardCode}`
        },
        {
          "@type": "ListItem",
          "position": 5, 
          "name": boardName,
          "item": `https://inschoolz.com/community/school/${schoolId}/${boardCode}`
        }
      );
      break;
    case 'regional':
      breadcrumbItems.push(
        {
          "@type": "ListItem",
          "position": 3,
          "name": "지역 커뮤니티",
          "item": "https://inschoolz.com/community?tab=regional"
        },
        {
          "@type": "ListItem",
          "position": 4,
          "name": locationInfo?.address || "지역",
          "item": `https://inschoolz.com/community/region/${sido}/${sigungu}/${boardCode}`
        },
        {
          "@type": "ListItem",
          "position": 5,
          "name": boardName,
          "item": `https://inschoolz.com/community/region/${sido}/${sigungu}/${boardCode}`
        }
      );
      break;
  }

  // 마지막 게시글 항목 추가
  breadcrumbItems.push({
    "@type": "ListItem",
    "position": breadcrumbItems.length + 1,
    "name": postTitle,
    "item": window.location.href
  });

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbItems
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
} 
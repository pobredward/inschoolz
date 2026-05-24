import { MetadataRoute } from 'next';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const SITE_URL = 'https://www.inschoolz.com';

// sitemap을 24시간마다 재생성 (게시글이 매일 올라오므로)
export const revalidate = 86400; // 24시간 = 86400초

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sitemap: MetadataRoute.Sitemap = [];

  // 기본 정적 페이지들
  const staticPages = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1,
    },
    {
      url: `${SITE_URL}/community`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/community?tab=national`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/community?tab=school`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/community?tab=regional`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/ranking`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/games`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/youth-protection`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/help`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/support`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.4,
    },
  ];

  sitemap.push(...staticPages);

  try {
    // Firebase에서 공개 게시글들을 가져와서 sitemap에 추가
    const postsRef = collection(db, 'posts');
    
    // 공개되고 활성화된 게시글만 가져오기 (익명 제외)
    const publicPostsQuery = query(
      postsRef,
      where('status', '==', 'active'),
      where('isPublic', '==', true),
      where('isAnonymous', '==', false),
      orderBy('createdAt', 'desc'),
      limit(1000) // 최신 1000개 게시글만 sitemap에 포함
    );

    const postsSnapshot = await getDocs(publicPostsQuery);
    
    for (const postDoc of postsSnapshot.docs) {
      const postData = postDoc.data();
      const postId = postDoc.id;
      
      // 게시판 타입별로 URL 생성
      let postUrl = '';
      
      if (postData.boardType === 'national') {
        postUrl = `${SITE_URL}/community/national/${postData.boardCode}/${postId}`;
      } else if (postData.boardType === 'school' && postData.schoolId) {
        postUrl = `${SITE_URL}/community/school/${postData.schoolId}/${postData.boardCode}/${postId}`;
      } else if (postData.boardType === 'regional' && postData.sido && postData.sigungu) {
        postUrl = `${SITE_URL}/community/region/${encodeURIComponent(postData.sido)}/${encodeURIComponent(postData.sigungu)}/${postData.boardCode}/${postId}`;
      }
      
      if (postUrl) {
        sitemap.push({
          url: postUrl,
          lastModified: postData.updatedAt?.toDate() || postData.createdAt?.toDate() || new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.6,
        });
      }
    }

    console.log(`Generated dynamic sitemap with ${sitemap.length} entries (${sitemap.length - staticPages.length} posts)`);
    
  } catch (error) {
    console.error('Sitemap generation error:', error);
    // 에러가 발생하더라도 정적 페이지는 반환
    console.log(`Fallback: Generated static sitemap with ${staticPages.length} entries`);
  }

  return sitemap;
} 
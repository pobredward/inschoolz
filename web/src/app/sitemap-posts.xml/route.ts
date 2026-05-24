import { NextResponse } from 'next/server';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET() {
  const siteUrl = 'https://www.inschoolz.com';
  
  try {
    let sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    // Firebase에서 공개 게시글들을 가져오기
    const postsRef = collection(db, 'posts');
    
    // 공개되고 활성화된 게시글만 가져오기 (익명 제외)
    const publicPostsQuery = query(
      postsRef,
      where('status', '==', 'active'),
      where('isPublic', '==', true),
      where('isAnonymous', '==', false),
      orderBy('createdAt', 'desc'),
      limit(2000) // 최신 2000개 게시글
    );

    const postsSnapshot = await getDocs(publicPostsQuery);
    
    for (const postDoc of postsSnapshot.docs) {
      const postData = postDoc.data();
      const postId = postDoc.id;
      
      // 게시판 타입별로 URL 생성
      let postUrl = '';
      
      if (postData.boardType === 'national') {
        postUrl = `${siteUrl}/community/national/${postData.boardCode}/${postId}`;
      } else if (postData.boardType === 'school' && postData.schoolId) {
        postUrl = `${siteUrl}/community/school/${postData.schoolId}/${postData.boardCode}/${postId}`;
      } else if (postData.boardType === 'regional' && postData.sido && postData.sigungu) {
        postUrl = `${siteUrl}/community/region/${encodeURIComponent(postData.sido)}/${encodeURIComponent(postData.sigungu)}/${postData.boardCode}/${postId}`;
      }
      
      if (postUrl) {
        const lastmod = postData.updatedAt?.toDate() || postData.createdAt?.toDate() || new Date();
        
        sitemapContent += `
  <url>
    <loc>${postUrl}</loc>
    <lastmod>${lastmod.toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
      }
    }

    sitemapContent += `
</urlset>`;

    console.log(`Generated posts sitemap with ${postsSnapshot.size} entries`);

    return new NextResponse(sitemapContent, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=1800', // 1시간 캐시, 30분 stale-while-revalidate
      },
    });

  } catch (error) {
    console.error('Posts sitemap generation error:', error);
    
    // 에러 시 빈 sitemap 반환
    const fallbackSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;

    return new NextResponse(fallbackSitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=300', // 에러 시 5분만 캐시
      },
    });
  }
} 
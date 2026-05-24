import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { firestore } from '@/lib/firebase-admin';

interface RegionInfo {
  sido: string;
  sigungu: string;
  postCount: number;
}

const fetchPopularRegions = unstable_cache(
  async (limit: number): Promise<RegionInfo[]> => {
    // posts 컬렉션에서 지역별 게시글 수 집계 (Admin SDK, 서버 전용)
    const postsSnapshot = await firestore
      .collection('posts')
      .where('type', '==', 'regional')
      .get();

    const regionPostCounts = new Map<string, RegionInfo>();
    postsSnapshot.forEach((doc) => {
      const regions = doc.data().regions;
      if (regions?.sido && regions?.sigungu) {
        const regionKey = `${regions.sido}-${regions.sigungu}`;
        const current = regionPostCounts.get(regionKey);
        if (current) {
          current.postCount += 1;
        } else {
          regionPostCounts.set(regionKey, {
            sido: regions.sido,
            sigungu: regions.sigungu,
            postCount: 1,
          });
        }
      }
    });

    return Array.from(regionPostCounts.values())
      .sort((a, b) => b.postCount - a.postCount)
      .slice(0, limit);
  },
  ['popular-regions'],
  { revalidate: 3600 }
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '12', 10), 50);
    const regions = await fetchPopularRegions(limit);
    return NextResponse.json({ regions });
  } catch (error) {
    console.error('인기 지역 조회 오류:', error);
    return NextResponse.json({ regions: [] }, { status: 500 });
  }
}

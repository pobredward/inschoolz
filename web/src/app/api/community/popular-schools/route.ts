import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { firestore } from '@/lib/firebase-admin';

interface SchoolData {
  id: string;
  name: string;
  address: string;
  district: string;
  type: string;
  websiteUrl?: string;
  regions: { sido: string; sigungu: string };
  isActive: boolean;
  memberCount: number;
  favoriteCount: number;
}

function getSchoolType(schoolName: string): string {
  if (schoolName.includes('초등학교')) return '초등학교';
  if (schoolName.includes('중학교')) return '중학교';
  if (schoolName.includes('고등학교')) return '고등학교';
  if (schoolName.includes('대학교')) return '대학교';
  return '고등학교';
}

function getDistrict(address: string): string {
  const parts = address.split(' ');
  return parts.length >= 2 ? parts[1] : '';
}

const fetchPopularSchools = unstable_cache(
  async (limit: number): Promise<SchoolData[]> => {
    // posts 컬렉션에서 학교별 게시글 수 집계 (Admin SDK, 서버 전용)
    const postsSnapshot = await firestore
      .collection('posts')
      .where('type', '==', 'school')
      .get();

    const schoolPostCounts = new Map<string, number>();
    postsSnapshot.forEach((doc) => {
      const schoolId = doc.data().schoolId;
      if (schoolId) {
        schoolPostCounts.set(schoolId, (schoolPostCounts.get(schoolId) || 0) + 1);
      }
    });

    const sortedSchoolIds = Array.from(schoolPostCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([schoolId]) => schoolId);

    const popularSchools: SchoolData[] = [];
    for (const schoolId of sortedSchoolIds) {
      const schoolDoc = await firestore.collection('schools').doc(schoolId).get();
      if (!schoolDoc.exists) continue;
      const data = schoolDoc.data()!;
      const isActive = data.isActive !== undefined ? data.isActive : true;
      if (!isActive) continue;

      popularSchools.push({
        id: schoolDoc.id,
        name: data.KOR_NAME,
        address: data.ADDRESS,
        district: data.REGION,
        type: getSchoolType(data.KOR_NAME),
        websiteUrl: data.HOMEPAGE,
        regions: { sido: data.REGION, sigungu: getDistrict(data.ADDRESS) },
        isActive,
        memberCount: data.memberCount || 0,
        favoriteCount: data.favoriteCount || 0,
      });
    }

    return popularSchools;
  },
  ['popular-schools'],
  { revalidate: 3600 }
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '12', 10), 50);
    const schools = await fetchPopularSchools(limit);
    return NextResponse.json({ schools });
  } catch (error) {
    console.error('인기 학교 조회 오류:', error);
    return NextResponse.json({ schools: [] }, { status: 500 });
  }
}

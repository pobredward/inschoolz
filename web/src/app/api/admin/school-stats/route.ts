import { NextRequest, NextResponse } from 'next/server';

/**
 * Firebase Admin SDK 동적 import 및 초기화
 */
async function getFirebaseAdmin() {
  const admin = await import('firebase-admin');
  
  if (admin.default.apps.length > 0) {
    return admin.default;
  }

  const serviceAccount = {
    type: 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL?.replace('@', '%40')}`,
    universe_domain: 'googleapis.com'
  };

  admin.default.initializeApp({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    credential: admin.default.credential.cert(serviceAccount as any),
    databaseURL: 'https://inschoolz-default-rtdb.asia-southeast1.firebasedatabase.app'
  });

  return admin.default;
}

interface SchoolStats {
  id: string;
  name: string;
  type: 'elementary' | 'middle' | 'high';
  region: string;
  botCount: number;
  postCount: number;
  lastActivity: string;
  status: 'active' | 'inactive' | 'no_bots';
}

/**
 * GET /api/admin/school-stats
 * 학교별 통계 조회 (필터링 지원)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region') || 'all';
    const schoolType = searchParams.get('schoolType') || 'all';
    const search = searchParams.get('search') || '';
    const searchMode = searchParams.get('searchMode') || 'contains'; // 'contains' 또는 'startsWith'
    const sortBy = searchParams.get('sortBy') || 'name'; // 'name', 'botCount', 'postCount'
    const sortOrder = searchParams.get('sortOrder') || 'asc'; // 'asc', 'desc'
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    console.log('🏫 학교별 통계 조회 시작:', { region, schoolType, search, searchMode, sortBy, sortOrder, page, limit });

    const app = await getFirebaseAdmin();
    const db = app.firestore();
    
    // 효율적인 학교 쿼리 구성
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let schoolsQuery: any = db.collection('schools');
    
    // 지역 필터
    if (region !== 'all') {
      schoolsQuery = schoolsQuery.where('SIDO_NAME', '==', region);
    }
    
    // 검색 최적화: startsWith 검색만 지원하고 Firestore range query 사용
    if (search) {
      const searchUpper = search.toUpperCase();
      const searchEnd = searchUpper.slice(0, -1) + String.fromCharCode(searchUpper.charCodeAt(searchUpper.length - 1) + 1);
      
      schoolsQuery = schoolsQuery
        .where('KOR_NAME', '>=', searchUpper)
        .where('KOR_NAME', '<', searchEnd)
        .orderBy('KOR_NAME');
        
      console.log(`🔍 Range query: KOR_NAME >= "${searchUpper}" AND < "${searchEnd}"`);
    } else {
      // 검색이 없을 때는 봇 수 기준 정렬을 위해 이름순으로 정렬
      schoolsQuery = schoolsQuery.orderBy('KOR_NAME');
    }
    
    // 전체 카운트를 위한 별도 쿼리 (count만)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let countQuery: any = db.collection('schools');
    if (region !== 'all') {
      countQuery = countQuery.where('SIDO_NAME', '==', region);
    }
    if (search) {
      const searchUpper = search.toUpperCase();
      const searchEnd = searchUpper.slice(0, -1) + String.fromCharCode(searchUpper.charCodeAt(searchUpper.length - 1) + 1);
      countQuery = countQuery
        .where('KOR_NAME', '>=', searchUpper)
        .where('KOR_NAME', '<', searchEnd);
    }
    
    // 병렬로 전체 카운트와 학교 데이터 조회
    const [totalCountSnapshot, schoolsSnapshot] = await Promise.all([
      countQuery.count().get(),
      search ? 
        schoolsQuery.limit(1000).get() : // 검색 시에는 최대 1000개로 제한
        schoolsQuery.get() // 검색이 없으면 모든 학교 조회
    ]);
    
    const totalCount = totalCountSnapshot.data().count;
    
    if (schoolsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        data: [],
        total: 0,
        totalCount,
        page,
        totalPages: 0,
        globalStats: { totalSchools: 0, schoolsWithBots: 0, totalBots: 0, totalPosts: 0 },
        filters: { region, schoolType, search, searchMode, sortBy, sortOrder, page, limit }
      });
    }

    // 학교 데이터 처리
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schools: any[] = [];
    const schoolIds: string[] = [];
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schoolsSnapshot.docs.forEach((doc: any) => {
      const data = doc.data();
      const schoolName = data.KOR_NAME || '알 수 없는 학교';
      
      // 학교 유형 판단
      let type: 'elementary' | 'middle' | 'high' = 'middle';
      if (schoolName.includes('초등학교')) {
        type = 'elementary';
      } else if (schoolName.includes('고등학교') || schoolName.includes('고교')) {
        type = 'high';
      }
      
      // 학교 유형 필터
      if (schoolType !== 'all' && type !== schoolType) {
        return;
      }
      
      const schoolId = data.SCHUL_CODE || doc.id;
      schoolIds.push(schoolId);
      
      schools.push({
        id: schoolId,
        name: schoolName,
        type,
        region: data.SIDO_NAME || '알 수 없음',
        botCount: 0,
        postCount: 0,
        lastActivity: '활동 없음',
        status: 'no_bots' as const
      });
    });

    if (schools.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        total: 0,
        totalCount,
        page,
        totalPages: 0,
        globalStats: { totalSchools: 0, schoolsWithBots: 0, totalBots: 0, totalPosts: 0 },
        filters: { region, schoolType, search, searchMode, sortBy, sortOrder, page, limit }
      });
    }

    // 각 학교별 봇 수와 게시글 수 조회
    const schoolStatsMap = new Map<string, SchoolStats>();
    schools.forEach(school => {
      schoolStatsMap.set(school.id, school);
    });

    // 배치 처리로 봇 수와 게시글 수 조회 (Firestore 'in' 연산자 10개 제한 우회)
    const botCounts = new Map<string, number>();
    const postCounts = new Map<string, number>();
    const lastActivities = new Map<string, Date>();
    
    // schoolIds를 10개씩 배치로 나누어 처리
    const batchSize = 10;
    const batches = [];
    for (let i = 0; i < schoolIds.length; i += batchSize) {
      batches.push(schoolIds.slice(i, i + batchSize));
    }
    
    console.log(`📦 배치 처리: ${batches.length}개 배치, 총 ${schoolIds.length}개 학교`);
    
    // 각 배치별로 병렬 처리
    await Promise.all(batches.map(async (batch, batchIndex) => {
      console.log(`🔄 배치 ${batchIndex + 1}/${batches.length} 처리 중... (${batch.length}개 학교)`);
      
      // 봇 수 조회
      const botsQuery = await db.collection('users')
        .where('fake', '==', true)
        .where('schoolId', 'in', batch)
        .get();
      
      botsQuery.docs.forEach(doc => {
        const data = doc.data();
        const schoolId = data.schoolId;
        if (schoolId) {
          botCounts.set(schoolId, (botCounts.get(schoolId) || 0) + 1);
        }
      });
      
      // 게시글 수 조회
      const postsQuery = await db.collection('posts')
        .where('fake', '==', true)
        .where('schoolId', 'in', batch)
        .get();
      
      postsQuery.docs.forEach(doc => {
        const data = doc.data();
        const schoolId = data.schoolId;
        if (schoolId) {
          postCounts.set(schoolId, (postCounts.get(schoolId) || 0) + 1);
          
          // 마지막 활동 시간 업데이트
          const createdAt = data.createdAt?.toDate?.() || new Date();
          const currentLast = lastActivities.get(schoolId);
          if (!currentLast || createdAt > currentLast) {
            lastActivities.set(schoolId, createdAt);
          }
        }
      });
    }));
    
    console.log(`✅ 배치 처리 완료: 봇 ${Array.from(botCounts.values()).reduce((a, b) => a + b, 0)}개, 게시글 ${Array.from(postCounts.values()).reduce((a, b) => a + b, 0)}개`);

    // 통계 업데이트
    const schoolStats: SchoolStats[] = [];
    schoolStatsMap.forEach((school, schoolId) => {
      const botCount = botCounts.get(schoolId) || 0;
      const postCount = postCounts.get(schoolId) || 0;
      const lastActivity = lastActivities.get(schoolId);
      
      let status: 'active' | 'inactive' | 'no_bots' = 'no_bots';
      if (botCount > 0) {
        status = postCount > 0 ? 'active' : 'inactive';
      }
      
      let lastActivityStr = '활동 없음';
      if (lastActivity) {
        const daysDiff = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff === 0) {
          lastActivityStr = '오늘';
        } else if (daysDiff === 1) {
          lastActivityStr = '어제';
        } else if (daysDiff < 7) {
          lastActivityStr = `${daysDiff}일 전`;
        } else if (daysDiff < 30) {
          lastActivityStr = `${Math.floor(daysDiff / 7)}주 전`;
        } else {
          lastActivityStr = `${Math.floor(daysDiff / 30)}개월 전`;
        }
      }
      
      schoolStats.push({
        ...school,
        botCount,
        postCount,
        lastActivity: lastActivityStr,
        status
      });
    });

    // 정렬 적용
    console.log(`🔄 정렬 적용: sortBy=${sortBy}, sortOrder=${sortOrder}`);
    
    schoolStats.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'botCount':
          comparison = a.botCount - b.botCount;
          break;
        case 'postCount':
          comparison = a.postCount - b.postCount;
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        default:
          // 기본 정렬: 상태별 정렬 (활성 > 비활성 > 봇 없음)
          const statusOrder = { active: 0, inactive: 1, no_bots: 2 };
          const statusDiff = statusOrder[a.status] - statusOrder[b.status];
          if (statusDiff !== 0) return statusDiff;
          // 같은 상태면 게시글 수로 정렬
          return b.postCount - a.postCount;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // 글로벌 통계 계산 (현재 조회된 학교들 기준)
    const globalStats = {
      totalSchools: 0, // 계산하지 않음
      schoolsWithBots: schoolStats.filter(s => s.botCount > 0).length,
      totalBots: schoolStats.reduce((sum, s) => sum + s.botCount, 0),
      totalPosts: 0 // 계산하지 않음
    };

    // 페이지네이션 적용 (정렬 후)
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedSchools = schoolStats.slice(startIndex, endIndex);

    console.log(`✅ 학교별 통계 조회 완료: ${paginatedSchools.length}개 학교 (전체: ${schoolStats.length}개, 페이지 ${page}/${Math.ceil(schoolStats.length / limit)})`);
    
    return NextResponse.json({
      success: true,
      data: paginatedSchools,
      total: paginatedSchools.length,
      totalCount: schoolStats.length,
      page,
      totalPages: Math.ceil(schoolStats.length / limit),
      globalStats,
      filters: { region, schoolType, search, searchMode, sortBy, sortOrder, page, limit },
      lastUpdated: new Date().toISOString(),
      source: 'firebase_optimized_batch'
    });

  } catch (error) {
    console.error('❌ 학교별 통계 조회 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `학교별 통계를 조회하는 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}` 
      },
      { status: 500 }
    );
  }
}

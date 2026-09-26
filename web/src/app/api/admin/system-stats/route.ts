import { guardAdmin } from '@/lib/server/auth';
import { NextResponse } from 'next/server';

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin.default.initializeApp({
    credential: admin.default.credential.cert(serviceAccount as admin.default.ServiceAccount),
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

interface SystemStats {
  totalSchools: number;
  schoolsWithBots: number;
  totalBots: number;
  totalPosts: number;
  postsToday: number;
  averagePostsPerSchool: number;
  topActiveSchools: SchoolStats[];
}

/**
 * GET /api/admin/system-stats
 * 시스템 전체 통계 조회
 */
export async function GET(request: Request) {
  const denied = await guardAdmin(request);
  if (denied) return denied;
  try {
    console.log('📊 시스템 통계 조회 시작');

    const app = await getFirebaseAdmin();
    const db = app.firestore();
    
    // 병렬로 모든 통계 조회 (최적화된 버전)
    const [
      schoolsSnapshot,
      botsSnapshot,
      postsSnapshot,
      todayPostsSnapshot,
      // 봇이 있는 학교 데이터를 한 번에 조회
      schoolsWithBotsQuery
    ] = await Promise.all([
      // 전체 학교 수
      db.collection('schools').count().get(),
      
      // 전체 봇 계정 수
      db.collection('users').where('fake', '==', true).count().get(),
      
      // 전체 AI 게시글 수
      db.collection('posts').where('fake', '==', true).count().get(),
      
      // 오늘 생성된 AI 게시글 수 (인덱스 문제로 임시 비활성화)
      Promise.resolve({ data: () => ({ count: 0 }) }),
      
      // 봇이 있는 학교들의 데이터를 한 번에 조회 (중복 제거)
      db.collection('users')
        .where('fake', '==', true)
        .select('schoolId', 'schoolName', 'schoolType')
        .get()
    ]);

    const totalSchools = schoolsSnapshot.data().count;
    const totalBots = botsSnapshot.data().count;
    const totalPosts = postsSnapshot.data().count;
    const postsToday = todayPostsSnapshot.data().count;

    // 봇이 있는 학교 수 계산 (중복 쿼리 제거)
    const schoolIdsWithBots = new Set();
    schoolsWithBotsQuery.docs.forEach(doc => {
      const data = doc.data();
      if (data.schoolId) {
        schoolIdsWithBots.add(data.schoolId);
      }
    });
    
    const schoolsWithBots = schoolIdsWithBots.size;

    // 평균 게시글 수 계산
    const averagePostsPerSchool = schoolsWithBots > 0 ? totalPosts / schoolsWithBots : 0;

    // 활성 학교 TOP 5 조회
    const topActiveSchools: SchoolStats[] = [];
    
    // 학교별 게시글 수 집계
    const schoolPostCounts = new Map<string, number>();
    const postsQuery = await db.collection('posts')
      .where('fake', '==', true)
      .get();
    
    postsQuery.docs.forEach(doc => {
      const data = doc.data();
      const schoolId = data.schoolId;
      if (schoolId) {
        schoolPostCounts.set(schoolId, (schoolPostCounts.get(schoolId) || 0) + 1);
      }
    });

    // 상위 5개 학교 정보 가져오기
    const topSchoolIds = Array.from(schoolPostCounts.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([schoolId]) => schoolId);

    if (topSchoolIds.length > 0) {
      const topSchoolsQuery = await db.collection('schools')
        .where('SCHUL_CODE', 'in', topSchoolIds)
        .get();
      
      const schoolsMap = new Map();
      topSchoolsQuery.docs.forEach(doc => {
        const data = doc.data();
        schoolsMap.set(data.SCHUL_CODE, {
          id: data.SCHUL_CODE,
          name: data.KOR_NAME || '알 수 없는 학교',
          type: data.KOR_NAME?.includes('초등학교') ? 'elementary' :
                data.KOR_NAME?.includes('중학교') ? 'middle' : 'high',
          region: data.SIDO_NAME || '알 수 없음'
        });
      });

      // 각 학교의 봇 수 조회
      for (const schoolId of topSchoolIds) {
        const schoolInfo = schoolsMap.get(schoolId);
        if (schoolInfo) {
          const schoolBotsQuery = await db.collection('users')
            .where('fake', '==', true)
            .where('schoolId', '==', schoolId)
            .get();
          
          const botCount = schoolBotsQuery.size;
          const postCount = schoolPostCounts.get(schoolId) || 0;
          
          topActiveSchools.push({
            ...schoolInfo,
            botCount,
            postCount,
            lastActivity: '최근',
            status: botCount > 0 ? 'active' : 'no_bots'
          });
        }
      }
    }

    const systemStats: SystemStats = {
      totalSchools,
      schoolsWithBots,
      totalBots,
      totalPosts,
      postsToday,
      averagePostsPerSchool: Math.round(averagePostsPerSchool * 10) / 10,
      topActiveSchools
    };

    console.log(`✅ 시스템 통계 조회 완료:`, {
      totalSchools,
      schoolsWithBots,
      totalBots,
      totalPosts,
      postsToday
    });
    
    return NextResponse.json({
      success: true,
      data: systemStats,
      lastUpdated: new Date().toISOString(),
      source: 'firebase_direct_realtime'
    });

  } catch (error) {
    console.error('❌ 시스템 통계 조회 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `시스템 통계를 조회하는 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}` 
      },
      { status: 500 }
    );
  }
}

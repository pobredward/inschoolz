import { guardAdmin } from '@/lib/server/auth';
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin.default.initializeApp({
    credential: admin.default.credential.cert(serviceAccount as admin.default.ServiceAccount),
    databaseURL: 'https://inschoolz-default-rtdb.asia-southeast1.firebasedatabase.app'
  });

  return admin.default;
}

/**
 * CSV 형태로 데이터 변환
 */
function convertToCSV(data: any[], headers: string[]): string {
  const csvHeaders = headers.join(',');
  const csvRows = data.map(row => 
    headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
      return value.toString();
    }).join(',')
  );
  
  return [csvHeaders, ...csvRows].join('\n');
}

/**
 * GET /api/admin/export-data
 * 데이터 내보내기 (CSV/JSON)
 */
export async function GET(request: NextRequest) {
  const denied = await guardAdmin(request);
  if (denied) return denied;
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'posts'; // posts, bots, schools
    const format = searchParams.get('format') || 'csv'; // csv, json
    const limit = parseInt(searchParams.get('limit') || '1000');

    console.log('📥 데이터 내보내기 시작:', { type, format, limit });

    const app = await getFirebaseAdmin();
    const db = app.firestore();
    
    let data: any[] = [];
    let filename = '';
    let headers: string[] = [];

    switch (type) {
      case 'posts':
        // AI 게시글 데이터 내보내기
        const postsQuery = await db.collection('posts')
          .where('fake', '==', true)
          .limit(limit)
          .get();
        
        data = postsQuery.docs.map(doc => {
          const postData = doc.data();
          return {
            id: doc.id,
            title: postData.title || '',
            content: postData.content || '',
            schoolId: postData.schoolId || '',
            schoolName: postData.schoolName || '',
            authorId: postData.authorId || '',
            authorNickname: postData.authorNickname || '',
            boardCode: postData.boardCode || '',
            boardName: postData.boardName || '',
            viewCount: postData.stats?.viewCount || 0,
            likeCount: postData.stats?.likeCount || 0,
            commentCount: postData.stats?.commentCount || 0,
            createdAt: postData.createdAt?.toDate?.()?.toISOString() || '',
            updatedAt: postData.updatedAt?.toDate?.()?.toISOString() || ''
          };
        });
        
        headers = [
          'id', 'title', 'content', 'schoolId', 'schoolName', 
          'authorId', 'authorNickname', 'boardCode', 'boardName',
          'viewCount', 'likeCount', 'commentCount', 'createdAt', 'updatedAt'
        ];
        filename = `ai_posts_${new Date().toISOString().split('T')[0]}`;
        break;

      case 'bots':
        // 봇 계정 데이터 내보내기
        const botsQuery = await db.collection('users')
          .where('fake', '==', true)
          .limit(limit)
          .get();
        
        data = botsQuery.docs.map(doc => {
          const botData = doc.data();
          return {
            uid: botData.uid || doc.id,
            nickname: botData.profile?.userName || botData.nickname || '',
            email: botData.email || '',
            schoolId: botData.schoolId || '',
            schoolName: botData.schoolName || '',
            schoolType: botData.schoolType || '',
            level: botData.stats?.level || 1,
            totalExperience: botData.stats?.totalExperience || 0,
            postCount: botData.stats?.postCount || 0,
            commentCount: botData.stats?.commentCount || 0,
            status: botData.status || 'active',
            createdAt: botData.createdAt?.toDate?.()?.toISOString() || '',
            updatedAt: botData.updatedAt?.toDate?.()?.toISOString() || ''
          };
        });
        
        headers = [
          'uid', 'nickname', 'email', 'schoolId', 'schoolName', 'schoolType',
          'level', 'totalExperience', 'postCount', 'commentCount', 
          'status', 'createdAt', 'updatedAt'
        ];
        filename = `bot_accounts_${new Date().toISOString().split('T')[0]}`;
        break;

      case 'schools':
        // 학교 통계 데이터 내보내기
        const schoolsQuery = await db.collection('schools')
          .orderBy('KOR_NAME')
          .limit(limit)
          .get();
        
        // 학교별 봇 수와 게시글 수 집계
        const schoolBotCounts = new Map<string, number>();
        const schoolPostCounts = new Map<string, number>();
        
        const [botsSnapshot, postsSnapshot] = await Promise.all([
          db.collection('users').where('fake', '==', true).get(),
          db.collection('posts').where('fake', '==', true).get()
        ]);
        
        botsSnapshot.docs.forEach(doc => {
          const botData = doc.data();
          const schoolId = botData.schoolId;
          if (schoolId) {
            schoolBotCounts.set(schoolId, (schoolBotCounts.get(schoolId) || 0) + 1);
          }
        });
        
        postsSnapshot.docs.forEach(doc => {
          const postData = doc.data();
          const schoolId = postData.schoolId;
          if (schoolId) {
            schoolPostCounts.set(schoolId, (schoolPostCounts.get(schoolId) || 0) + 1);
          }
        });
        
        data = schoolsQuery.docs.map(doc => {
          const schoolData = doc.data();
          const schoolId = schoolData.SCHUL_CODE || doc.id;
          const schoolName = schoolData.KOR_NAME || '알 수 없는 학교';
          
          let schoolType = 'middle';
          if (schoolName.includes('초등학교')) {
            schoolType = 'elementary';
          } else if (schoolName.includes('고등학교') || schoolName.includes('고교')) {
            schoolType = 'high';
          }
          
          const botCount = schoolBotCounts.get(schoolId) || 0;
          const postCount = schoolPostCounts.get(schoolId) || 0;
          
          return {
            id: schoolId,
            name: schoolName,
            type: schoolType,
            region: schoolData.SIDO_NAME || '알 수 없음',
            address: schoolData.ORG_RDNMA || '',
            botCount,
            postCount,
            status: botCount > 0 ? (postCount > 0 ? 'active' : 'inactive') : 'no_bots',
            establishmentDate: schoolData.FOND_YMD || '',
            phoneNumber: schoolData.ORG_TELNO || ''
          };
        });
        
        headers = [
          'id', 'name', 'type', 'region', 'address', 
          'botCount', 'postCount', 'status', 'establishmentDate', 'phoneNumber'
        ];
        filename = `school_stats_${new Date().toISOString().split('T')[0]}`;
        break;

      default:
        return NextResponse.json(
          { success: false, error: '지원하지 않는 데이터 타입입니다.' },
          { status: 400 }
        );
    }

    // 데이터 형식 변환
    let content: string;
    let contentType: string;
    let fileExtension: string;

    if (format === 'csv') {
      content = convertToCSV(data, headers);
      contentType = 'text/csv; charset=utf-8';
      fileExtension = 'csv';
    } else {
      content = JSON.stringify({
        exportedAt: new Date().toISOString(),
        type,
        total: data.length,
        data
      }, null, 2);
      contentType = 'application/json; charset=utf-8';
      fileExtension = 'json';
    }

    console.log(`✅ 데이터 내보내기 완료: ${data.length}개 항목 (${type})`);

    // 파일 다운로드 응답
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}.${fileExtension}"`,
        'Content-Length': Buffer.byteLength(content, 'utf8').toString()
      }
    });

  } catch (error) {
    console.error('❌ 데이터 내보내기 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `데이터를 내보내는 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}` 
      },
      { status: 500 }
    );
  }
}

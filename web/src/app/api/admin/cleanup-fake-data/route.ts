import { guardAdmin } from '@/lib/server/auth';
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import * as admin from 'firebase-admin';

/**
 * Firebase Admin SDK 초기화
 */
async function getFirebaseAdmin() {
  console.log('🔥 [FIREBASE] Firebase Admin 초기화 시작');
  
  if (admin.apps.length > 0) {
    console.log('✅ [FIREBASE] 기존 Firebase Admin 앱 사용');
    return admin;
  }
  
  console.log('🔧 [FIREBASE] 새로운 Firebase Admin 앱 초기화');

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

  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      databaseURL: 'https://inschoolz-default-rtdb.asia-southeast1.firebasedatabase.app'
    });
    
    console.log('✅ [FIREBASE] Firebase Admin 앱 초기화 완료');
    return admin;
  } catch (error) {
    console.error('❌ [FIREBASE] Firebase Admin 초기화 실패:', error);
    throw error;
  }
}

/**
 * POST /api/admin/cleanup-fake-data
 * AI 데이터 삭제 (간단한 버전)
 */
export async function POST(request: NextRequest) {
  const denied = await guardAdmin(request);
  if (denied) return denied;
  console.log('🚀 [CLEANUP-API] POST 요청 시작');
  
  try {
    console.log('📋 [CLEANUP-API] 요청 본문 파싱 중...');
    const body = await request.json();
    const { type } = body; // 'bots', 'posts', 'comments'
    
    console.log(`🗑️ [CLEANUP-API] AI 데이터 삭제 시작: ${type}`);
    console.log(`📊 [CLEANUP-API] 요청 데이터:`, body);
    
    if (!type || !['bots', 'posts', 'comments'].includes(type)) {
      console.error(`❌ [CLEANUP-API] 잘못된 타입: ${type}`);
      return NextResponse.json(
        { success: false, error: `잘못된 타입: ${type}` },
        { status: 400 }
      );
    }
    
    console.log('🔥 [CLEANUP-API] Firebase Admin 초기화 중...');
    const app = await getFirebaseAdmin();
    const db = app.firestore();
    console.log('✅ [CLEANUP-API] Firebase Admin 초기화 완료');
    
    let deletedCount = 0;
    
    switch (type) {
      case 'bots':
        try {
          // 모든 AI 봇 삭제
          console.log('🤖 [BOTS] AI 봇 조회 시작...');
          console.log('🔍 [BOTS] 쿼리: users 컬렉션에서 fake == true');
          
          const botsQuery = await db.collection('users').where('fake', '==', true).get();
          console.log(`📊 [BOTS] 발견된 AI 봇: ${botsQuery.size}개`);
          
          if (botsQuery.empty) {
            console.log('ℹ️ [BOTS] 삭제할 AI 봇이 없습니다.');
            break;
          }
          
          // 봇 데이터 샘플 로그 (첫 번째 봇)
          if (botsQuery.docs.length > 0) {
            const firstBot = botsQuery.docs[0].data();
            console.log('🔍 [BOTS] 첫 번째 봇 데이터 샘플:', {
              id: botsQuery.docs[0].id,
              fake: firstBot.fake,
              nickname: firstBot.profile?.userName,
              schoolId: firstBot.schoolId,
              schoolName: firstBot.schoolName
            });
          }
          
          // 학교별 봇 수 카운트 (학교 통계 업데이트용)
          const schoolBotCounts = new Map<string, number>();
          
          botsQuery.docs.forEach(doc => {
            const botData = doc.data();
            const schoolId = botData.schoolId;
            if (schoolId) {
              schoolBotCounts.set(schoolId, (schoolBotCounts.get(schoolId) || 0) + 1);
            }
          });
          
          // 1단계: 봇 삭제 (우선 처리)
          const botBatch = db.batch();
          
          botsQuery.docs.forEach((doc, index) => {
            console.log(`🗑️ 봇 삭제 준비: ${doc.id} (${index + 1}/${botsQuery.size})`);
            botBatch.delete(doc.ref);
            deletedCount++;
          });
          
          console.log(`💾 [BOTS] 봇 삭제 배치 커밋 시작: ${deletedCount}개 봇 삭제`);
          console.log(`🔥 [BOTS] 배치 크기: ${deletedCount}개 문서`);
          
          const batchStartTime = Date.now();
          await botBatch.commit();
          const batchEndTime = Date.now();
          
          console.log(`✅ [BOTS] AI 봇 삭제 완료 (${batchEndTime - batchStartTime}ms)`);
          console.log(`📊 [BOTS] 삭제된 봇 수: ${deletedCount}개`);
          
          // 2단계: 학교 통계 업데이트 (별도 처리 - 실패해도 봇 삭제는 성공)
          if (schoolBotCounts.size > 0) {
            try {
              console.log('📊 학교 통계 업데이트 시작...');
              const schoolBatch = db.batch();
              
              for (const [schoolId, botCount] of schoolBotCounts) {
                const schoolRef = db.collection('schools').doc(schoolId);
                schoolBatch.update(schoolRef, {
                  memberCount: admin.firestore.FieldValue.increment(-botCount),
                  favoriteCount: admin.firestore.FieldValue.increment(-botCount)
                });
                console.log(`📊 학교 ${schoolId} 통계 업데이트 준비: -${botCount}명`);
              }
              
              await schoolBatch.commit();
              console.log('✅ 학교 통계 업데이트 완료');
            } catch (schoolError) {
              console.warn('⚠️ 학교 통계 업데이트 실패 (봇 삭제는 성공):', schoolError);
              // 학교 통계 업데이트 실패해도 봇 삭제는 이미 성공했으므로 계속 진행
            }
          }
          
        } catch (botError) {
          console.error('❌ AI 봇 삭제 중 오류:', botError);
          throw new Error(`AI 봇 삭제 실패: ${botError instanceof Error ? botError.message : 'Unknown error'}`);
        }
        break;
        
      case 'posts':
        // 모든 AI 게시글 삭제
        const postsQuery = await db.collection('posts').where('fake', '==', true).get();
        const postBatch = db.batch();
        
        postsQuery.docs.forEach(doc => {
          postBatch.delete(doc.ref);
          deletedCount++;
        });
        
        if (deletedCount > 0) {
          await postBatch.commit();
        }
        break;
        
      case 'comments':
        // 모든 AI 댓글 삭제
        const commentsQuery = await db.collection('comments').where('fake', '==', true).get();
        const commentBatch = db.batch();
        
        commentsQuery.docs.forEach(doc => {
          commentBatch.delete(doc.ref);
          deletedCount++;
        });
        
        if (deletedCount > 0) {
          await commentBatch.commit();
        }
        break;
        
      default:
        throw new Error(`지원하지 않는 삭제 타입: ${type}`);
    }
    
    console.log(`✅ [CLEANUP-API] AI ${type} 삭제 완료: ${deletedCount}개`);
    
    const responseData = {
      success: true,
      message: `${deletedCount}개의 AI ${type}이 삭제되었습니다.`,
      deletedCount,
      type
    };
    
    console.log(`📤 [CLEANUP-API] 응답 데이터:`, responseData);
    
    // Next.js 서버 사이드 캐시 무효화
    try {
      console.log('🔄 [CLEANUP-API] 서버 사이드 캐시 무효화 중...');
      
      if (type === 'bots') {
        revalidatePath('/admin/fake-bots');
        revalidatePath('/admin/fake-schools');
        revalidatePath('/api/admin/bot-accounts');
        console.log('   - 봇 관련 경로 캐시 무효화 완료');
      } else if (type === 'posts') {
        revalidatePath('/admin/fake-posts');
        revalidatePath('/admin/fake-schools');
        revalidatePath('/api/admin/fake-posts');
        console.log('   - 게시글 관련 경로 캐시 무효화 완료');
      } else if (type === 'comments') {
        revalidatePath('/admin/fake-comments');
        revalidatePath('/admin/fake-schools');
        revalidatePath('/api/admin/fake-comments');
        console.log('   - 댓글 관련 경로 캐시 무효화 완료');
      }
      
      // 공통 관리 페이지들
      revalidatePath('/admin');
      revalidatePath('/admin/fake-operations');
      
      console.log('✅ [CLEANUP-API] 서버 사이드 캐시 무효화 완료');
    } catch (cacheError) {
      console.warn('⚠️ [CLEANUP-API] 캐시 무효화 실패:', cacheError);
      // 캐시 무효화 실패해도 메인 작업은 성공으로 처리
    }
    
    const response = NextResponse.json(responseData);
    
    // 캐시 방지 헤더 추가 (삭제 후 즉시 반영을 위해)
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
    
  } catch (error) {
    console.error('💥 [CLEANUP-API] AI 데이터 삭제 오류:', error);
    console.error('💥 [CLEANUP-API] 오류 스택:', error instanceof Error ? error.stack : 'No stack trace');
    
    const errorData = {
      success: false,
      error: `AI 데이터 삭제 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error instanceof Error ? error.message : String(error)
    };
    
    console.log(`📤 [CLEANUP-API] 오류 응답:`, errorData);
    
    return NextResponse.json(errorData, { status: 500 });
  }
}

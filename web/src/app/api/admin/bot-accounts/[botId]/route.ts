import { guardAdmin } from '@/lib/server/auth';
import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

/**
 * Firebase Admin SDK 초기화
 */
async function getFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin;
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

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    databaseURL: 'https://inschoolz-default-rtdb.asia-southeast1.firebasedatabase.app'
  });

  return admin;
}

/**
 * DELETE /api/admin/bot-accounts/[botId]
 * 개별 봇 계정 삭제
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const denied = await guardAdmin(request);
  if (denied) return denied;
  console.log('🗑️ [BOT-DELETE] DELETE 요청 시작');
  
  try {
    const { botId } = await params;
    
    console.log('📋 [BOT-DELETE] 봇 ID:', botId);
    
    if (!botId) {
      console.error('❌ [BOT-DELETE] 봇 ID가 제공되지 않음');
      return NextResponse.json(
        { success: false, error: '봇 ID가 필요합니다.' },
        { status: 400 }
      );
    }
    
    console.log('🔥 [BOT-DELETE] Firebase Admin 초기화 중...');
    const app = await getFirebaseAdmin();
    const db = app.firestore();
    
    // 봇 존재 여부 확인
    console.log(`🔍 [BOT-DELETE] 봇 존재 여부 확인: ${botId}`);
    const botDoc = await db.collection('users').doc(botId).get();
    
    if (!botDoc.exists) {
      console.error(`❌ [BOT-DELETE] 봇을 찾을 수 없음: ${botId}`);
      return NextResponse.json(
        { success: false, error: '봇을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    const botData = botDoc.data();
    if (!botData?.fake) {
      console.error(`❌ [BOT-DELETE] 실제 사용자 삭제 시도: ${botId}`);
      return NextResponse.json(
        { success: false, error: '실제 사용자는 삭제할 수 없습니다.' },
        { status: 403 }
      );
    }
    
    console.log(`🗑️ [BOT-DELETE] 봇 삭제 시작: ${botId}`);
    console.log(`📊 [BOT-DELETE] 봇 정보:`, {
      nickname: botData.profile?.userName,
      schoolName: botData.schoolName,
      schoolId: botData.schoolId
    });
    
    // 봇 삭제
    await db.collection('users').doc(botId).delete();
    console.log(`✅ [BOT-DELETE] 봇 삭제 완료: ${botId}`);
    
    // 학교 통계 업데이트 (선택적)
    if (botData.schoolId) {
      try {
        console.log(`📊 [BOT-DELETE] 학교 통계 업데이트: ${botData.schoolId}`);
        const schoolRef = db.collection('schools').doc(botData.schoolId);
        await schoolRef.update({
          memberCount: admin.firestore.FieldValue.increment(-1),
          favoriteCount: admin.firestore.FieldValue.increment(-1)
        });
        console.log(`✅ [BOT-DELETE] 학교 통계 업데이트 완료`);
      } catch (schoolError) {
        console.warn(`⚠️ [BOT-DELETE] 학교 통계 업데이트 실패:`, schoolError);
        // 학교 통계 업데이트 실패해도 봇 삭제는 성공으로 처리
      }
    }
    
    const responseData = {
      success: true,
      message: '봇 계정이 삭제되었습니다.',
      deletedBotId: botId
    };
    
    console.log('📤 [BOT-DELETE] 응답 데이터:', responseData);
    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('💥 [BOT-DELETE] 봇 삭제 오류:', error);
    console.error('💥 [BOT-DELETE] 오류 스택:', error instanceof Error ? error.stack : 'No stack');
    
    const errorData = {
      success: false,
      error: `봇 삭제 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error instanceof Error ? error.message : String(error)
    };
    
    console.log('📤 [BOT-DELETE] 오류 응답:', errorData);
    return NextResponse.json(errorData, { status: 500 });
  }
}

/**
 * PUT /api/admin/bot-accounts/[botId]
 * 봇 계정 정보 수정
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const denied = await guardAdmin(request);
  if (denied) return denied;
  console.log('✏️ [BOT-UPDATE] PUT 요청 시작');
  
  try {
    const { botId } = await params;
    const body = await request.json();
    
    console.log('📋 [BOT-UPDATE] 봇 ID:', botId);
    console.log('📊 [BOT-UPDATE] 업데이트 데이터:', body);
    
    if (!botId) {
      console.error('❌ [BOT-UPDATE] 봇 ID가 제공되지 않음');
      return NextResponse.json(
        { success: false, error: '봇 ID가 필요합니다.' },
        { status: 400 }
      );
    }
    
    console.log('🔥 [BOT-UPDATE] Firebase Admin 초기화 중...');
    const app = await getFirebaseAdmin();
    const db = app.firestore();
    
    // 봇 존재 여부 확인
    console.log(`🔍 [BOT-UPDATE] 봇 존재 여부 확인: ${botId}`);
    const botDoc = await db.collection('users').doc(botId).get();
    
    if (!botDoc.exists) {
      console.error(`❌ [BOT-UPDATE] 봇을 찾을 수 없음: ${botId}`);
      return NextResponse.json(
        { success: false, error: '봇을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    const botData = botDoc.data();
    if (!botData?.fake) {
      console.error(`❌ [BOT-UPDATE] 실제 사용자 수정 시도: ${botId}`);
      return NextResponse.json(
        { success: false, error: '실제 사용자는 수정할 수 없습니다.' },
        { status: 403 }
      );
    }
    
    // 업데이트할 데이터 준비
    const updateData: any = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // 프로필 정보 업데이트
    if (body.userName) {
      updateData['profile.userName'] = body.userName;
      console.log(`📝 [BOT-UPDATE] 사용자명 업데이트: ${body.userName}`);
    }
    
    if (body.realName !== undefined) {
      updateData['profile.realName'] = body.realName;
      console.log(`📝 [BOT-UPDATE] 실명 업데이트: ${body.realName}`);
    }
    
    if (body.profileImageUrl !== undefined) {
      updateData['profile.profileImageUrl'] = body.profileImageUrl;
      console.log(`📝 [BOT-UPDATE] 프로필 이미지 업데이트: ${body.profileImageUrl}`);
    }
    
    // 통계 정보 업데이트
    if (body.stats) {
      if (body.stats.level !== undefined) {
        updateData['stats.level'] = body.stats.level;
      }
      if (body.stats.postCount !== undefined) {
        updateData['stats.postCount'] = body.stats.postCount;
      }
      if (body.stats.commentCount !== undefined) {
        updateData['stats.commentCount'] = body.stats.commentCount;
      }
      console.log(`📊 [BOT-UPDATE] 통계 업데이트:`, body.stats);
    }
    
    console.log(`✏️ [BOT-UPDATE] 봇 업데이트 시작: ${botId}`);
    console.log(`📊 [BOT-UPDATE] 업데이트 필드:`, updateData);
    
    // 봇 정보 업데이트
    await db.collection('users').doc(botId).update(updateData);
    console.log(`✅ [BOT-UPDATE] 봇 업데이트 완료: ${botId}`);
    
    // 업데이트된 봇 정보 조회
    const updatedBotDoc = await db.collection('users').doc(botId).get();
    const updatedBotData = updatedBotDoc.data();
    
    const responseData = {
      success: true,
      message: '봇 계정이 수정되었습니다.',
      updatedBot: {
        uid: botId,
        nickname: updatedBotData?.profile?.userName,
        realName: updatedBotData?.profile?.realName,
        profileImageUrl: updatedBotData?.profile?.profileImageUrl,
        stats: updatedBotData?.stats,
        schoolName: updatedBotData?.schoolName,
        schoolId: updatedBotData?.schoolId
      }
    };
    
    console.log('📤 [BOT-UPDATE] 응답 데이터:', responseData);
    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('💥 [BOT-UPDATE] 봇 업데이트 오류:', error);
    console.error('💥 [BOT-UPDATE] 오류 스택:', error instanceof Error ? error.stack : 'No stack');
    
    const errorData = {
      success: false,
      error: `봇 업데이트 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error instanceof Error ? error.message : String(error)
    };
    
    console.log('📤 [BOT-UPDATE] 오류 응답:', errorData);
    return NextResponse.json(errorData, { status: 500 });
  }
}

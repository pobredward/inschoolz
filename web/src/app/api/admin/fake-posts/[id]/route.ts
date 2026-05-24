import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
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

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { title, content, tags, isAnonymous } = body;

    console.log('🔥 [ADMIN-POST-UPDATE] PUT 요청 시작:', { id, body });

    // 입력 검증
    if (!title?.trim() || !content?.trim()) {
      console.error('🔥 [ADMIN-POST-UPDATE] 입력 검증 실패: 제목 또는 내용 누락');
      return NextResponse.json(
        { success: false, error: '제목과 내용은 필수입니다.' },
        { status: 400 }
      );
    }

    // Firebase Admin 초기화
    console.log('🔥 [ADMIN-POST-UPDATE] Firebase Admin 초기화 중...');
    const app = await getFirebaseAdmin();
    const db = app.firestore();

    // 게시글 존재 여부 및 AI 게시글 여부 확인
    console.log(`🔥 [ADMIN-POST-UPDATE] 게시글 존재 여부 확인: ${id}`);
    const postDoc = await db.collection('posts').doc(id).get();
    
    if (!postDoc.exists) {
      console.error(`🔥 [ADMIN-POST-UPDATE] 게시글을 찾을 수 없음: ${id}`);
      return NextResponse.json(
        { success: false, error: '게시글을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const postData = postDoc.data();
    if (!postData?.fake) {
      console.error(`🔥 [ADMIN-POST-UPDATE] 실제 게시글 수정 시도: ${id}`);
      return NextResponse.json(
        { success: false, error: '실제 게시글은 이 API로 수정할 수 없습니다.' },
        { status: 403 }
      );
    }

    // 업데이트할 데이터 준비
    const updateData: any = {
      title: title.trim(),
      content: content.trim(),
      tags: tags || [],
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // 익명 설정 처리
    if (isAnonymous !== undefined) {
      updateData['authorInfo.isAnonymous'] = isAnonymous;
      if (isAnonymous) {
        updateData['authorInfo.displayName'] = '익명';
        updateData['authorInfo.profileImageUrl'] = '';
      } else {
        // 원래 작성자 정보 복원 (봇 정보)
        const authorDoc = await db.collection('users').doc(postData.authorId).get();
        if (authorDoc.exists) {
          const authorData = authorDoc.data();
          updateData['authorInfo.displayName'] = authorData?.profile?.userName || '사용자';
          updateData['authorInfo.profileImageUrl'] = authorData?.profile?.profileImageUrl || '';
        }
      }
    }

    console.log('🔥 [ADMIN-POST-UPDATE] 업데이트 데이터:', updateData);

    // 게시글 업데이트
    console.log(`🔥 [ADMIN-POST-UPDATE] 게시글 업데이트 시작: ${id}`);
    await db.collection('posts').doc(id).update(updateData);
    console.log(`🔥 [ADMIN-POST-UPDATE] 게시글 업데이트 완료: ${id}`);

    // 업데이트된 게시글 정보 조회
    const updatedPostDoc = await db.collection('posts').doc(id).get();
    const updatedPostData = updatedPostDoc.data();

    const responseData = {
      success: true,
      message: 'AI 게시글이 수정되었습니다.',
      data: {
        id,
        title: updatedPostData?.title,
        content: updatedPostData?.content,
        tags: updatedPostData?.tags,
        isAnonymous: updatedPostData?.authorInfo?.isAnonymous,
        updatedAt: updatedPostData?.updatedAt
      }
    };

    console.log('🔥 [ADMIN-POST-UPDATE] 응답 데이터:', responseData);
    
    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('🔥 [ADMIN-POST-UPDATE] AI 게시글 수정 오류:', error);
    
    const errorData = {
      success: false,
      error: error instanceof Error ? error.message : '게시글 수정 중 알 수 없는 오류가 발생했습니다.'
    };
    
    return NextResponse.json(errorData, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  }
}

/**
 * DELETE /api/admin/fake-posts/[id]
 * 개별 게시글 삭제
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('🗑️ [POST-DELETE] DELETE 요청 시작');
  
  try {
    const { id } = params;
    
    console.log('📋 [POST-DELETE] 게시글 ID:', id);
    
    if (!id) {
      console.error('❌ [POST-DELETE] 게시글 ID가 제공되지 않음');
      return NextResponse.json(
        { success: false, error: '게시글 ID가 필요합니다.' },
        { status: 400 }
      );
    }
    
    console.log('🔥 [POST-DELETE] Firebase Admin 초기화 중...');
    const app = await getFirebaseAdmin();
    const db = app.firestore();
    
    // 게시글 존재 여부 확인
    console.log(`🔍 [POST-DELETE] 게시글 존재 여부 확인: ${id}`);
    const postDoc = await db.collection('posts').doc(id).get();
    
    if (!postDoc.exists) {
      console.error(`❌ [POST-DELETE] 게시글을 찾을 수 없음: ${id}`);
      return NextResponse.json(
        { success: false, error: '게시글을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    const postData = postDoc.data();
    if (!postData?.fake) {
      console.error(`❌ [POST-DELETE] 실제 게시글 삭제 시도: ${id}`);
      return NextResponse.json(
        { success: false, error: '실제 게시글은 삭제할 수 없습니다.' },
        { status: 403 }
      );
    }
    
    console.log(`🗑️ [POST-DELETE] 게시글 삭제 시작: ${id}`);
    console.log(`📊 [POST-DELETE] 게시글 정보:`, {
      title: postData.title,
      authorName: postData.authorName,
      schoolName: postData.schoolName,
      boardCode: postData.boardCode
    });
    
    // 게시글 삭제
    await db.collection('posts').doc(id).delete();
    console.log(`✅ [POST-DELETE] 게시글 삭제 완료: ${id}`);
    
    // 관련 댓글도 삭제 (선택적)
    try {
      console.log(`🗑️ [POST-DELETE] 관련 댓글 삭제 중: ${id}`);
      const commentsQuery = await db.collection('comments').where('postId', '==', id).get();
      
      if (!commentsQuery.empty) {
        const batch = db.batch();
        commentsQuery.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`✅ [POST-DELETE] 관련 댓글 ${commentsQuery.size}개 삭제 완료`);
      } else {
        console.log(`📝 [POST-DELETE] 삭제할 댓글이 없음`);
      }
    } catch (commentError) {
      console.warn(`⚠️ [POST-DELETE] 댓글 삭제 실패:`, commentError);
      // 댓글 삭제 실패해도 게시글 삭제는 성공으로 처리
    }
    
    // Next.js 서버 사이드 캐시 무효화
    try {
      console.log('🔄 [POST-DELETE] 서버 사이드 캐시 무효화 중...');
      revalidatePath('/admin/fake-posts');
      revalidatePath('/admin/fake-schools');
      revalidatePath(`/community/school/${postData.schoolId}/${postData.boardCode}`);
      revalidatePath(`/community/school/${postData.schoolId}/${postData.boardCode}/${id}`);
      revalidatePath(`/community/school/${postData.schoolId}/${postData.boardCode}/${id}/fast`);
      console.log('✅ [POST-DELETE] 서버 사이드 캐시 무효화 완료');
    } catch (cacheError) {
      console.warn('⚠️ [POST-DELETE] 캐시 무효화 실패:', cacheError);
    }
    
    const responseData = {
      success: true,
      message: '게시글이 삭제되었습니다.',
      deletedPostId: id,
      deletedComments: 0 // 실제 삭제된 댓글 수는 위에서 계산
    };
    
    console.log('📤 [POST-DELETE] 응답 데이터:', responseData);
    
    const response = NextResponse.json(responseData);
    
    // 캐시 방지 헤더 추가
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
    
  } catch (error) {
    console.error('💥 [POST-DELETE] 게시글 삭제 오류:', error);
    console.error('💥 [POST-DELETE] 오류 스택:', error instanceof Error ? error.stack : 'No stack');
    
    const errorData = {
      success: false,
      error: `게시글 삭제 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error instanceof Error ? error.message : String(error)
    };
    
    console.log('📤 [POST-DELETE] 오류 응답:', errorData);
    return NextResponse.json(errorData, { status: 500 });
  }
}

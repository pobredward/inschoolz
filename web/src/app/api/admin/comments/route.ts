import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

// Firebase Admin SDK 초기화
if (admin.apps.length === 0) {
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
}

interface Comment {
  id: string;
  postId: string;
  content: string;
  authorId: string;
  authorNickname: string;
  postTitle: string;
  schoolName: string;
  schoolId: string;
  createdAt: string;
  fake: boolean;
}

/**
 * GET /api/admin/comments
 * AI 생성 댓글 목록 조회 (관리자 검토용)
 */
export async function GET(request: NextRequest) {
  try {
    console.log('💬 AI 댓글 목록 조회 시작');

    const db = admin.firestore();

    // URL 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status') || 'all'; // all, pending, approved, rejected
    
    const offset = (page - 1) * limit;

    // AI 댓글 조회 (fake: true, 삭제되지 않은 것만) - 최신순 정렬 추가
    let query = db.collection('comments')
      .where('fake', '==', true)
      .where('status.isDeleted', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .offset(offset);

    const snapshot = await query.get();
    
    const comments: Comment[] = [];
    
    // 게시글 ID들을 수집하여 배치 조회
    const postIds = new Set<string>();
    const schoolIds = new Set<string>();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.postId) {
        postIds.add(data.postId);
      }
    });

    // 게시글 정보 배치 조회
    const postMap = new Map<string, any>();
    if (postIds.size > 0) {
      const postPromises = Array.from(postIds).map(async (postId) => {
        try {
          const postDoc = await db.collection('posts').doc(postId).get();
          if (postDoc.exists) {
            const postData = postDoc.data();
            postMap.set(postId, postData);
            if (postData?.schoolId) {
              schoolIds.add(postData.schoolId);
            }
          }
        } catch (err) {
          console.warn(`게시글 조회 실패 (${postId}):`, err);
        }
      });
      await Promise.all(postPromises);
    }

    // 학교 정보 배치 조회
    const schoolMap = new Map<string, any>();
    if (schoolIds.size > 0) {
      const schoolPromises = Array.from(schoolIds).map(async (schoolId) => {
        try {
          const schoolDoc = await db.collection('schools').doc(schoolId).get();
          if (schoolDoc.exists) {
            schoolMap.set(schoolId, schoolDoc.data());
          }
        } catch (err) {
          console.warn(`학교 조회 실패 (${schoolId}):`, err);
        }
      });
      await Promise.all(schoolPromises);
    }

    // 댓글 데이터 구성
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      
      let postTitle = '게시글 제목 없음';
      let schoolName = '학교 정보 없음';
      let schoolId = '';
      
      if (data.postId && postMap.has(data.postId)) {
        const postData = postMap.get(data.postId);
        postTitle = postData?.title || '제목 없음';
        schoolId = postData?.schoolId || '';
        
        if (schoolId && schoolMap.has(schoolId)) {
          const schoolData = schoolMap.get(schoolId);
          schoolName = schoolData?.KOR_NAME || '학교명 없음';
        }
      }

      comments.push({
        id: doc.id,
        postId: data.postId || '',
        content: data.content || '',
        authorId: data.authorId || '',
        authorNickname: data.authorNickname || '익명',
        postTitle,
        schoolName,
        schoolId,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        fake: data.fake || false
      });
    });

    // 총 개수 조회 (별도 쿼리, 삭제되지 않은 것만)
    const totalSnapshot = await db.collection('comments')
      .where('fake', '==', true)
      .where('status.isDeleted', '==', false)
      .get();
    const total = totalSnapshot.size;

    console.log(`✅ AI 댓글 조회 완료: ${comments.length}개 (전체: ${total}개)`);

    return NextResponse.json({
      success: true,
      data: comments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      message: comments.length > 0 ? `AI 생성 댓글 ${comments.length}개를 조회했습니다.` : 'AI 생성 댓글이 없습니다.',
      lastUpdated: new Date().toISOString(),
      source: 'firebase_realtime'
    });

  } catch (error) {
    console.error('❌ AI 댓글 조회 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `댓글을 조회하는 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}` 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/comments/generate
 * AI 댓글 생성 시작
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { schoolLimit = 5, commentsPerSchool = 3, maxCommentsPerPost = 2 } = body;

    console.log('💬 AI 댓글 생성 시작:', { schoolLimit, commentsPerSchool, maxCommentsPerPost });

    // 백그라운드에서 댓글 생성 실행
    const { spawn } = require('child_process');
    const path = require('path');
    
    const scriptPath = path.join(process.cwd(), '..', 'scripts', 'comment-generator.js');
    const args = [schoolLimit.toString(), commentsPerSchool.toString(), maxCommentsPerPost.toString()];

    const child = spawn('node', [scriptPath, ...args], {
      cwd: path.join(process.cwd(), '..'),
      stdio: 'pipe'
    });

    // 프로세스 출력 로깅
    child.stdout.on('data', (data: Buffer) => {
      console.log('댓글 생성 출력:', data.toString());
    });

    child.stderr.on('data', (data: Buffer) => {
      console.error('댓글 생성 오류:', data.toString());
    });

    return NextResponse.json({
      success: true,
      message: 'AI 댓글 생성이 백그라운드에서 시작되었습니다.',
      config: {
        schoolLimit,
        commentsPerSchool,
        maxCommentsPerPost,
        expectedComments: schoolLimit * commentsPerSchool * maxCommentsPerPost
      }
    });

  } catch (error) {
    console.error('AI 댓글 생성 API 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `댓글 생성을 시작하는 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}` 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/comments/[id]
 * AI 댓글 삭제 (관리자용)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('id');

    if (!commentId) {
      return NextResponse.json(
        { success: false, error: '댓글 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    console.log(`🗑️ 댓글 삭제 처리:`, commentId);

    const db = admin.firestore();

    // 댓글 존재 확인
    const commentDoc = await db.collection('comments').doc(commentId).get();
    
    if (!commentDoc.exists) {
      return NextResponse.json(
        { success: false, error: '댓글을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const commentData = commentDoc.data();
    if (!commentData?.fake) {
      return NextResponse.json(
        { success: false, error: '실제 댓글은 삭제할 수 없습니다.' },
        { status: 403 }
      );
    }

    // 댓글 삭제 (soft delete)
    await db.collection('comments').doc(commentId).update({
      'status.isDeleted': true,
      'status.deletedAt': admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 게시글의 댓글 수 감소
    if (commentData.postId) {
      await db.collection('posts').doc(commentData.postId).update({
        'stats.commentCount': admin.firestore.FieldValue.increment(-1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    console.log(`✅ 댓글 삭제 완료:`, commentId);

    return NextResponse.json({
      success: true,
      message: '댓글이 삭제되었습니다.',
      data: { id: commentId }
    });

  } catch (error) {
    console.error('❌ 댓글 삭제 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `댓글 삭제 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}` 
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/comments
 * AI 댓글 수정 (관리자용)
 */
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('id');
    const body = await request.json();

    if (!commentId) {
      return NextResponse.json(
        { success: false, error: '댓글 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const { content } = body;
    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: '댓글 내용이 필요합니다.' },
        { status: 400 }
      );
    }

    if (content.length > 500) {
      return NextResponse.json(
        { success: false, error: '댓글은 500자 이하로 작성해주세요.' },
        { status: 400 }
      );
    }

    console.log(`✏️ 댓글 수정 처리:`, commentId);

    const db = admin.firestore();

    // 댓글 존재 확인
    const commentDoc = await db.collection('comments').doc(commentId).get();
    
    if (!commentDoc.exists) {
      return NextResponse.json(
        { success: false, error: '댓글을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const commentData = commentDoc.data();
    if (!commentData?.fake) {
      return NextResponse.json(
        { success: false, error: '실제 댓글은 수정할 수 없습니다.' },
        { status: 403 }
      );
    }

    // 댓글 내용 수정
    await db.collection('comments').doc(commentId).update({
      content: content.trim(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ 댓글 수정 완료:`, commentId);

    return NextResponse.json({
      success: true,
      message: '댓글이 수정되었습니다.',
      data: { 
        id: commentId,
        content: content.trim()
      }
    });

  } catch (error) {
    console.error('❌ 댓글 수정 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `댓글 수정 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}` 
      },
      { status: 500 }
    );
  }
}

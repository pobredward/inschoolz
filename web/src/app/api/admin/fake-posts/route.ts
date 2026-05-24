import { NextRequest, NextResponse } from 'next/server';

// Firebase Admin SDK를 직접 임포트하지 않고 동적으로 로드
async function getFirebaseAdmin() {
  const admin = await import('firebase-admin');
  
  // 이미 초기화된 앱이 있는지 확인
  if (admin.default.apps.length > 0) {
    return admin.default.app();
  }

  // 서비스 계정 정보
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

  // Firebase Admin 초기화
  return admin.default.initializeApp({
    credential: admin.default.credential.cert(serviceAccount as any),
    databaseURL: 'https://inschoolz-default-rtdb.asia-southeast1.firebasedatabase.app'
  });
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔥 Firebase에서 직접 fake: true 게시글 실시간 조회 시작');

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '30');
    const offset = (page - 1) * limit;

    console.log(`📄 페이지네이션 파라미터: page=${page}, limit=${limit}, offset=${offset}`);

    const app = await getFirebaseAdmin();
    const db = app.firestore();
    
    // 1. 전체 개수 조회
    const countQuery = await db
      .collection('posts')
      .where('fake', '==', true)
      .count()
      .get();
    
    const totalCount = countQuery.data().count;
    console.log(`📊 전체 fake: true 게시글 개수: ${totalCount}개`);

    // 2. 페이지네이션된 게시글 조회
    const fakePostsQuery = await db
      .collection('posts')
      .where('fake', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .offset(offset)
      .get();

    if (fakePostsQuery.empty) {
      console.log('✅ fake: true 게시글이 없습니다.');
      return NextResponse.json({
        success: true,
        data: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalCount: 0,
          limit: limit,
          hasNextPage: false,
          hasPrevPage: false
        },
        lastUpdated: new Date().toISOString(),
        source: 'firebase_direct_empty',
        note: "현재 Firebase에 fake: true 게시글이 없습니다."
      });
    }

    const allPosts: any[] = [];
    const schoolIds = new Set<string>();
    
    // 모든 AI 게시글 수집
    fakePostsQuery.docs.forEach(doc => {
      const data = doc.data();
      if (data.schoolId) {
        schoolIds.add(data.schoolId);
      }
      allPosts.push({
        id: doc.id,
        title: data.title,
        content: data.content,
        schoolId: data.schoolId,
        authorId: data.authorId,
        authorNickname: data.authorNickname || data.authorInfo?.displayName || '익명',
        boardCode: data.boardCode,
        boardName: data.boardName,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        stats: data.stats || { viewCount: 0, likeCount: 0, commentCount: 0 },
        fake: data.fake,
        tags: data.tags || []
      });
    });

    // 학교 정보 조회 (배치로 효율적으로)
    const schoolMap = new Map<string, string>();
    if (schoolIds.size > 0) {
      const schoolPromises = Array.from(schoolIds).map(async (schoolId: string) => {
        try {
          const schoolDoc = await db.collection('schools').doc(schoolId).get();
          if (schoolDoc.exists) {
            const schoolData = schoolDoc.data();
            schoolMap.set(schoolId, schoolData?.KOR_NAME || '알 수 없는 학교');
          }
        } catch (error) {
          console.error(`학교 정보 조회 실패 (${schoolId}):`, error);
          schoolMap.set(schoolId, '알 수 없는 학교');
        }
      });
      
      await Promise.all(schoolPromises);
    }

    // 게시글에 학교 이름 추가하고 최신순으로 정렬
    const postsWithSchoolNames = allPosts.map(post => ({
      ...post,
      schoolName: schoolMap.get(post.schoolId) || '알 수 없는 학교',
      // 프론트엔드가 기대하는 필드명으로 매핑
      authorName: post.authorNickname || '익명',
      likeCount: post.stats?.likeCount || 0,
      commentCount: post.stats?.commentCount || 0
    })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    console.log(`🎉 Firebase에서 직접 ${postsWithSchoolNames.length}개 fake: true 게시글 조회 완료!`);

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      success: true,
      data: postsWithSchoolNames,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalCount: totalCount,
        limit: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      lastUpdated: new Date().toISOString(),
      source: 'firebase_direct_realtime',
      note: `🔥 Firebase에서 직접 실시간으로 조회 (전체 ${totalCount}개 중 ${page}페이지 ${postsWithSchoolNames.length}개 표시)`
    });

  } catch (error) {
    console.error('❌ Firebase 직접 조회 오류:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      note: `Firebase 직접 조회 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('id');
    
    if (!postId) {
      return NextResponse.json(
        { success: false, error: '게시글 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    console.log('🗑️ AI 게시글 삭제 시작:', postId);

    const app = await getFirebaseAdmin();
    const db = app.firestore();
    
    // 게시글 존재 확인 및 fake 여부 검증
    const postDoc = await db.collection('posts').doc(postId).get();
    
    if (!postDoc.exists) {
      return NextResponse.json(
        { success: false, error: '게시글을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    const postData = postDoc.data();
    if (!postData?.fake) {
      return NextResponse.json(
        { success: false, error: '실제 게시글은 삭제할 수 없습니다.' },
        { status: 403 }
      );
    }
    
    // AI 게시글 삭제
    await db.collection('posts').doc(postId).delete();
    
    console.log('✅ AI 게시글 삭제 완료:', postId);
    
    return NextResponse.json({
      success: true,
      message: 'AI 게시글이 삭제되었습니다.',
      data: { id: postId }
    });

  } catch (error) {
    console.error('❌ AI 게시글 삭제 오류:', error);
    return NextResponse.json(
      { success: false, error: `게시글 삭제 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
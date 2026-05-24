import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase-admin';

export async function GET(
  request: NextRequest,
  { params }: { params: { schoolId: string } }
) {
  try {
    const { schoolId } = params;
    
    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: '학교 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const db = adminFirestore();
    
    // 해당 학교의 봇들 조회
    const botsQuery = await db
      .collection('users')
      .where('fake', '==', true)
      .where('schoolId', '==', schoolId)
      .orderBy('createdAt', 'desc')
      .get();

    const bots = [];
    
    for (const doc of botsQuery.docs) {
      const data = doc.data();
      
      // 봇이 작성한 게시글 수 조회
      const postsQuery = await db
        .collection('posts')
        .where('authorId', '==', doc.id)
        .where('fake', '==', true)
        .get();

      // 봇이 작성한 댓글 수 조회
      const commentsQuery = await db
        .collection('comments')
        .where('authorId', '==', doc.id)
        .where('fake', '==', true)
        .get();

      bots.push({
        id: doc.id,
        nickname: data.profile?.userName || data.nickname || '알 수 없음',
        schoolType: data.schoolType || 'middle',
        createdAt: data.createdAt?.toDate?.()?.toLocaleDateString() || '알 수 없음',
        postCount: postsQuery.size,
        commentCount: commentsQuery.size
      });
    }

    return NextResponse.json({
      success: true,
      data: bots
    });

  } catch (error) {
    console.error('학교별 봇 목록 조회 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '서버 오류가 발생했습니다.' 
      },
      { status: 500 }
    );
  }
}

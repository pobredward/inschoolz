import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { botIds, schoolId } = body;
    
    if (!botIds || !Array.isArray(botIds) || botIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '삭제할 봇 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: '학교 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const db = adminFirestore();
    
    // 배치 작업으로 봇과 관련 데이터 삭제
    const batchSize = 500;
    let deletedBots = 0;
    let deletedPosts = 0;
    let deletedComments = 0;

    // 봇들을 배치 단위로 처리
    for (let i = 0; i < botIds.length; i += batchSize) {
      const batchBotIds = botIds.slice(i, i + batchSize);
      const batch = db.batch();

      for (const botId of batchBotIds) {
        // 1. 봇이 작성한 게시글 삭제
        const postsQuery = await db
          .collection('posts')
          .where('authorId', '==', botId)
          .where('fake', '==', true)
          .get();

        postsQuery.docs.forEach(doc => {
          batch.delete(doc.ref);
          deletedPosts++;
        });

        // 2. 봇이 작성한 댓글 삭제
        const commentsQuery = await db
          .collection('comments')
          .where('authorId', '==', botId)
          .where('fake', '==', true)
          .get();

        commentsQuery.docs.forEach(doc => {
          batch.delete(doc.ref);
          deletedComments++;
        });

        // 3. 봇 계정 삭제
        batch.delete(db.collection('users').doc(botId));
        deletedBots++;
      }

      await batch.commit();
    }

    // 4. 학교의 memberCount와 favoriteCount 감소
    const schoolRef = db.collection('schools').doc(schoolId);
    const schoolDoc = await schoolRef.get();
    
    if (schoolDoc.exists) {
      const schoolData = schoolDoc.data()!;
      const currentMemberCount = schoolData.memberCount || 0;
      const currentFavoriteCount = schoolData.favoriteCount || 0;
      
      const newMemberCount = Math.max(0, currentMemberCount - deletedBots);
      const newFavoriteCount = Math.max(0, currentFavoriteCount - deletedBots);

      await schoolRef.update({
        memberCount: newMemberCount,
        favoriteCount: newFavoriteCount,
        updatedAt: new Date()
      });

      console.log(`📊 학교 카운트 업데이트: memberCount ${currentMemberCount} → ${newMemberCount}, favoriteCount ${currentFavoriteCount} → ${newFavoriteCount}`);
    }

    console.log(`✅ 봇 삭제 완료: 봇 ${deletedBots}개, 게시글 ${deletedPosts}개, 댓글 ${deletedComments}개`);

    return NextResponse.json({
      success: true,
      data: {
        deletedBots,
        deletedPosts,
        deletedComments
      }
    });

  } catch (error) {
    console.error('봇 삭제 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '서버 오류가 발생했습니다.' 
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getDoc, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; boardCode: string; postId: string }> }
) {
  try {
    const { postId } = await params;

    // Firestore에서 게시글 가져오기 (조회수 증가 없이)
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);

    if (!postSnap.exists()) {
      return NextResponse.json(
        { error: '게시글을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const postData = {
      id: postSnap.id,
      ...postSnap.data()
    };

    return NextResponse.json(postData);
  } catch (error) {
    console.error('게시글 조회 오류:', error);
    return NextResponse.json(
      { error: '게시글을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 조회수 증가를 위한 PATCH 메서드 추가
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; boardCode: string; postId: string }> }
) {
  try {
    const { postId } = await params;
    const body = await request.json();

    if (body.action === 'increment_view') {
      const postRef = doc(db, 'posts', postId);
      
      console.log('🚨 API route increment_view - postId:', postId);
      
      // 업데이트 전 poll 데이터 확인
      const beforeDoc = await getDoc(postRef);
      const beforePoll = beforeDoc.exists() ? beforeDoc.data()?.poll : null;
      console.log('🚨 Poll before increment:', JSON.stringify(beforePoll, null, 2));
      
      await updateDoc(postRef, {
        'stats.viewCount': increment(1)
      });
      
      // 업데이트 후 poll 데이터 확인
      const afterDoc = await getDoc(postRef);
      const afterPoll = afterDoc.exists() ? afterDoc.data()?.poll : null;
      console.log('🚨 Poll after increment:', JSON.stringify(afterPoll, null, 2));
      
      // poll이 변경되었는지 확인
      if (JSON.stringify(beforePoll) !== JSON.stringify(afterPoll)) {
        console.error('🚨🚨🚨 POLL DATA CHANGED BY INCREMENT_VIEW!');
        console.error('🚨 Before:', beforePoll);
        console.error('🚨 After:', afterPoll);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: '유효하지 않은 액션입니다.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('게시글 업데이트 오류:', error);
    return NextResponse.json(
      { error: '게시글을 업데이트하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 
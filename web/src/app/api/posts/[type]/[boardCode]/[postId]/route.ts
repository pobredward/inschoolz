import { authenticate, apiError } from '@/lib/server/auth';
import { executeCommunity } from '@/lib/server/community';
import { adminFirestore } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; boardCode: string; postId: string }> }
) {
  try {
    const { postId, type, boardCode } = await params;

    // Firestore에서 게시글 가져오기 (조회수 증가 없이)
    const postSnap = await adminFirestore().doc(`posts/${postId}`).get();
    const data = postSnap.data();

    if (!data || data.type !== type || data.boardCode !== boardCode || data.status?.isDeleted || data.status?.isHidden || data.status?.isBlocked) {
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
    const token = await authenticate(request);
    const { postId } = await params;
    return NextResponse.json(await executeCommunity(adminFirestore(), token, 'post.view', { postId }));
  } catch (error) { return apiError(error); }
}

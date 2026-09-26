import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  increment,
  runTransaction
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { auth } from '@/lib/firebase';
import { communityCommand } from '@/lib/community-client';
import { Comment } from '@/types';
import bcrypt from 'bcryptjs';

// 기존 댓글 API 함수들...

/**
 * 4자리 비밀번호를 해시화합니다. (웹과 앱 호환)
 */
export const hashPassword = async (password: string): Promise<string> => {
  const data = password + 'inschoolz_salt'; // 간단한 솔트 추가
  return simpleHash(data);
};

/**
 * 간단한 해시 함수 (웹과 앱 호환)
 */
const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32비트 정수로 변환
  }
  return Math.abs(hash).toString(16);
};

/**
 * 비밀번호를 검증합니다.
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  const hashedInput = await hashPassword(password);
  return hashedInput === hash;
};

/**
 * 익명 댓글을 작성합니다.
 */
export const createAnonymousComment = async ({
  postId,
  content,
  nickname,
  password,
  parentId = null,
  ipAddress
}: {
  postId: string;
  content: string;
  nickname: string;
  password: string;
  parentId?: string | null;
  ipAddress?: string;
}): Promise<Comment> => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('익명 댓글도 로그인이 필요합니다.');
  const result = await communityCommand<{ id: string }>('comment.create', { postId, content, parentId, isAnonymous: true }, uid);
  return { id: result.id, postId, content, authorId: uid, isAnonymous: true, parentId, stats: { likeCount: 0 }, status: { isDeleted: false, isBlocked: false }, createdAt: Date.now() } as Comment;
};

/**
 * 익명 댓글의 비밀번호를 검증합니다.
 */
export const verifyAnonymousCommentPassword = async (
  postId: string,
  commentId: string,
  password: string
): Promise<boolean> => {
  if (!auth.currentUser) return false;
  try {
    const commentDoc = await getDoc(doc(db, 'posts', postId, 'comments', commentId));

    if (!commentDoc.exists()) {
      return false;
    }

    const comment = commentDoc.data() as Comment;

    // 익명 댓글이 아니거나 비밀번호 해시가 없는 경우
    if (!comment.isAnonymous || !comment.anonymousAuthor?.passwordHash) {
      return false;
    }

    return verifyPassword(password, comment.anonymousAuthor.passwordHash);
  } catch (error) {
    console.error('익명 댓글 비밀번호 검증 실패:', error);
    return false;
  }
};

/**
 * 익명 댓글을 수정합니다.
 */
export const updateAnonymousComment = async (
  postId: string,
  commentId: string,
  content: string,
  password: string
): Promise<void> => {
  await communityCommand('comment.update', { postId, commentId, content });
};

/**
 * 대댓글 존재 여부 확인
 */
const hasReplies = async (postId: string, commentId: string): Promise<boolean> => {
  try {
    const repliesRef = collection(db, 'posts', postId, 'comments');
    const repliesQuery = query(
      repliesRef,
      where('parentId', '==', commentId),
      where('status.isDeleted', '==', false),
      limit(1)
    );

    const repliesSnapshot = await getDocs(repliesQuery);
    return !repliesSnapshot.empty;
  } catch (error) {
    console.error('대댓글 확인 오류:', error);
    return false;
  }
};

/**
 * 익명 댓글 삭제
 */
export const deleteAnonymousComment = async (
  postId: string,
  commentId: string,
  password: string
): Promise<void> => {
  await communityCommand('comment.delete', { postId, commentId });
};

/**
 * 사용자의 IP 주소를 가져옵니다 (클라이언트 측에서는 제한적)
 */
export const getClientIP = async (): Promise<string | null> => {
  try {
    // 실제 운영 환경에서는 서버 측에서 IP를 가져와야 합니다.
    // 클라이언트에서는 정확한 IP를 얻기 어렵습니다.
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error('IP 주소 조회 실패:', error);
    return null;
  }
};

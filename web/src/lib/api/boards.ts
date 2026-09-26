import { auth } from '../firebase';
import { communityCommand } from '../community-client';
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  increment,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Board,
  Post,
  Comment,
  FirebaseTimestamp
} from '@/types';

// Like 타입 정의 (App과 통일)
interface Like {
  userId: string;
  postId: string;
  createdAt: FirebaseTimestamp;
}
import { uploadPostImage, uploadPostAttachment } from '@/lib/storage';
import { awardExperience } from '@/lib/experience';
import { toTimestamp } from '@/lib/utils';

// 게시판 목록 가져오기
export const getBoards = async (type: 'national' | 'regional' | 'school', schoolId?: string, regions?: { sido: string; sigungu: string }): Promise<Board[]> => {
  try {
    const boardsRef = collection(db, 'boards');
    let q;

    if (type === 'national') {
      q = query(
        boardsRef,
        where('type', '==', 'national'),
        where('isActive', '==', true),
        orderBy('order', 'asc')
      );
    } else if (type === 'regional' && regions) {
      q = query(
        boardsRef,
        where('type', '==', 'regional'),
        where('isActive', '==', true),
        where('regions.sido', '==', regions.sido),
        where('regions.sigungu', '==', regions.sigungu),
        orderBy('order', 'asc')
      );
    } else if (type === 'school' && schoolId) {
      q = query(
        boardsRef,
        where('type', '==', 'school'),
        where('isActive', '==', true),
        where('schoolId', '==', schoolId),
        orderBy('order', 'asc')
      );
    } else {
      throw new Error('유효하지 않은 게시판 타입 또는 파라미터입니다.');
    }

    const querySnapshot = await getDocs(q);
    const boards: Board[] = [];

    querySnapshot.forEach((doc) => {
      boards.push({ id: doc.id, ...doc.data() } as Board);
    });

    return boards;
  } catch (error) {
    console.error('게시판 목록 가져오기 오류:', error);
    throw new Error('게시판 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

// 게시판 상세 정보 가져오기
export const getBoard = async (code: string): Promise<Board | null> => {
  if (!code || typeof code !== 'string') {
    throw new Error('유효하지 않은 게시판 코드입니다.');
  }

  try {
    const boardsRef = collection(db, 'boards');
    const q = query(
      boardsRef,
      where('code', '==', code),
      where('isActive', '==', true),
      limit(1)
    );

    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const boardDoc = querySnapshot.docs[0];
      const data = boardDoc.data();
      const boardData = { id: boardDoc.id, ...data } as Board;
      return boardData;
    } else {
      return null;
    }
  } catch (error) {
    console.error('게시판 상세 정보 가져오기 오류:', error);
    throw new Error('게시판 상세 정보를 가져오는 중 오류가 발생했습니다.');
  }
};

// 게시글 목록 가져오기 (최적화: totalCount 제거, limit(pageSize+1) 사용)
export const getPosts = async (
  code: string,
  page = 1,
  pageSize = 10,
  sortBy: 'latest' | 'popular' = 'latest'
): Promise<{ posts: Post[]; totalCount: number; hasMore: boolean }> => {
  try {
    const postsRef = collection(db, 'posts');
    let q;

    if (sortBy === 'latest') {
      q = query(
        postsRef,
        where('boardCode', '==', code),
        where('status.isDeleted', '==', false),
        where('status.isHidden', '==', false),
        orderBy('createdAt', 'desc'),
        limit(pageSize + 1) // hasMore 판단을 위해 1개 더 가져옴
      );
    } else {
      q = query(
        postsRef,
        where('boardCode', '==', code),
        where('status.isDeleted', '==', false),
        where('status.isHidden', '==', false),
        orderBy('stats.likeCount', 'desc'),
        limit(pageSize + 1) // hasMore 판단을 위해 1개 더 가져옴
      );
    }

    const querySnapshot = await getDocs(q);
    const posts: Post[] = [];

    querySnapshot.forEach((doc) => {
      posts.push({ id: doc.id, ...doc.data() } as Post);
    });

    // hasMore 판단 (pageSize + 1개를 가져왔으므로)
    const hasMore = posts.length > pageSize;

    // 실제로는 pageSize만큼만 반환
    const paginatedPosts = posts.slice(0, pageSize);

    return {
      posts: paginatedPosts,
      totalCount: 0, // totalCount는 비용이 많이 들므로 제공하지 않음
      hasMore: hasMore
    };
  } catch (error) {
    console.error('게시글 목록 가져오기 오류:', error);
    throw new Error('게시글 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

// 게시글 상세 정보 가져오기 (조회수 증가 없이)
export const getPost = async (postId: string): Promise<Post | null> => {
  try {
    const postRef = doc(db, 'posts', postId);
    const postDoc = await getDoc(postRef);

    if (postDoc.exists()) {
      return { id: postDoc.id, ...postDoc.data() } as Post;
    } else {
      return null;
    }
  } catch (error) {
    console.error('게시글 상세 정보 가져오기 오류:', error);
    throw new Error('게시글 상세 정보를 가져오는 중 오류가 발생했습니다.');
  }
};

// 게시글 조회수 증가 (별도 함수)
export const incrementPostViewCount = async (postId: string): Promise<void> => {
  if (!auth.currentUser) return;
  await communityCommand('post.view', { postId });
};

// 게시글 작성
export interface CreatePostParams {
  title: string;
  content: string;
  code: string;
  type: 'national' | 'regional' | 'school';
  category?: {
    id: string;
    name: string;
  };
  schoolId?: string;
  regions?: {
    sido: string;
    sigungu: string;
  };
  images?: File[];
  attachments?: File[];
  tags?: string[];
  isAnonymous?: boolean;
  poll?: {
    question: string;
    options: string[];
    expiresAt?: Date;
    multipleChoice: boolean;
  };
}

export const createPost = async (userId: string, params: CreatePostParams): Promise<Post> => {
  const uploadId = crypto.randomUUID();
  const attachments = await Promise.all([
    ...(params.images || []).map(async file => ({ type: 'image', url: await uploadPostImage(uploadId, file), name: file.name, size: file.size })),
    ...(params.attachments || []).map(async file => ({ type: 'file', url: await uploadPostAttachment(uploadId, file), name: file.name, size: file.size })),
  ]);
  const result = await communityCommand('post.create', {
    ...params, boardCode: params.code, attachments,
    poll: params.poll ? { ...params.poll, expiresAt: params.poll.expiresAt?.toISOString() } : undefined,
  }, userId);
  const snapshot = await getDoc(doc(db, 'posts', result.id));
  return { ...snapshot.data(), id: snapshot.id } as Post;
};

// 게시글 수정
export interface UpdatePostParams {
  title?: string;
  content?: string;
  tags?: string[];
  isAnonymous?: boolean;
}

export const updatePost = async (
  postId: string,
  userId: string,
  params: UpdatePostParams
): Promise<Post> => {
  await communityCommand('post.update', { postId, data: params }, userId);
  return (await getPost(postId))!;
};

// 게시글 삭제 (소프트 삭제)
export const deletePost = async (postId: string, userId: string): Promise<void> => {
  await communityCommand('post.delete', { postId }, userId);
};

// 게시글 좋아요/취소
export const toggleLikePost = async (postId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> => {
  return communityCommand('post.like', { postId }, userId);
};

// 댓글 목록 가져오기 (최적화: totalCount 제거, limit(pageSize+1) 사용)
export const getComments = async (
  postId: string,
  page = 1,
  pageSize = 10
): Promise<{ comments: Comment[]; totalCount: number; hasMore: boolean }> => {
  try {
    const commentsRef = collection(db, `posts/${postId}/comments`);
    const q = query(
      commentsRef,
      orderBy('createdAt', 'asc'),
      limit(pageSize + 1) // hasMore 판단을 위해 1개 더 가져옴
    );

    const querySnapshot = await getDocs(q);
    const allComments: Comment[] = [];

    querySnapshot.forEach((doc) => {
      const commentData = doc.data();
      const { id: _, ...dataWithoutId } = commentData;
      const comment = { id: doc.id, ...dataWithoutId } as Comment;

      // 삭제된 댓글이지만 대댓글이 없는 경우 건너뛰기
      if (comment.status.isDeleted && comment.content !== '삭제된 댓글입니다.') {
        return;
      }

      allComments.push(comment);
    });

    // 댓글을 시간순으로 명시적으로 정렬 (익명 댓글 포함)
    allComments.sort((a, b) => {
      const aTime = toTimestamp(a.createdAt);
      const bTime = toTimestamp(b.createdAt);
      return aTime - bTime;
    });

    // hasMore 판단 (pageSize + 1개를 가져왔으므로)
    const hasMore = allComments.length > pageSize;

    // 실제로는 pageSize만큼만 반환
    const paginatedComments = allComments.slice(0, pageSize);

    // Timestamp 직렬화
    const serializedComments = paginatedComments.map(comment => ({
      ...comment,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    }));

    return {
      comments: serializedComments,
      totalCount: 0, // totalCount는 비용이 많이 들므로 제공하지 않음
      hasMore: hasMore
    };
  } catch (error) {
    console.error('댓글 목록 가져오기 오류:', error);
    throw new Error('댓글 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

// 댓글 작성
export interface CreateCommentParams {
  content: string;
  parentId?: string;
  isAnonymous?: boolean;
}

export const createComment = async (
  postId: string,
  userId: string,
  params: CreateCommentParams
): Promise<Comment> => {
  const result = await communityCommand('comment.create', { ...params, postId }, userId);
  const snapshot = await getDoc(doc(db, 'posts', postId, 'comments', result.id));
  return { ...snapshot.data(), id: snapshot.id } as Comment;
};

// 댓글 수정
export const updateComment = async (
  postId: string,
  commentId: string,
  userId: string,
  content: string
): Promise<Comment> => {
  await communityCommand('comment.update', { postId, commentId, content }, userId);
  const snapshot = await getDoc(doc(db, 'posts', postId, 'comments', commentId));
  return { ...snapshot.data(), id: commentId } as Comment;
};



// 대댓글 존재 여부 확인
const hasReplies = async (postId: string, commentId: string): Promise<boolean> => {
  try {
    const repliesRef = collection(db, `posts/${postId}/comments`);
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

// 댓글 삭제 (소프트 삭제)
export const deleteComment = async (
  postId: string,
  commentId: string,
  userId: string
): Promise<{ hasReplies: boolean }> => {
  return communityCommand('comment.delete', { postId, commentId }, userId);
};

/**
 * 게시판 타입별 게시판 목록 조회
 */
export const getBoardsByType = async (boardType: 'national' | 'regional' | 'school'): Promise<Board[]> => {
  try {
    const q = query(
      collection(db, 'boards'),
      where('type', '==', boardType),
      where('isActive', '==', true),
      orderBy('order', 'asc')
    );

    const querySnapshot = await getDocs(q);
    const boards: Board[] = [];

    querySnapshot.forEach((doc) => {
      const boardData = doc.data();
      boards.push({
        id: doc.id,
        name: boardData.name,
        code: boardData.code,
        description: boardData.description,
        type: boardData.type,
        parentCode: boardData.parentCode,
        order: boardData.order,
        isActive: boardData.isActive,
        isPublic: boardData.isPublic || true,
        createdAt: boardData.createdAt,
        updatedAt: boardData.updatedAt,
        stats: boardData.stats || { postCount: 0, viewCount: 0, activeUserCount: 0 },
        allowAnonymous: boardData.allowAnonymous || false,
        allowPolls: boardData.allowPolls || false,
        icon: boardData.icon,
        customIcon: boardData.customIcon,
      });
    });

    return boards;
  } catch (error) {
    console.error('게시판 목록 조회 오류:', error);
    throw new Error('게시판 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 특정 게시판 정보 조회
 */
export const getBoardById = async (boardId: string): Promise<Board | null> => {
  try {
    const boardRef = doc(db, 'boards', boardId);
    const boardDoc = await getDoc(boardRef);

    if (!boardDoc.exists()) {
      return null;
    }

    const boardData = boardDoc.data();
    return {
      id: boardDoc.id,
      name: boardData.name,
      code: boardData.code,
      description: boardData.description,
      type: boardData.type,
      parentCode: boardData.parentCode,
      order: boardData.order,
      isActive: boardData.isActive,
      isPublic: boardData.isPublic || true,
      createdAt: boardData.createdAt,
      updatedAt: boardData.updatedAt,
      stats: boardData.stats || { postCount: 0, viewCount: 0, activeUserCount: 0 },
      allowAnonymous: boardData.allowAnonymous || false,
      allowPolls: boardData.allowPolls || false,
      icon: boardData.icon,
      customIcon: boardData.customIcon,
    };
  } catch (error) {
    console.error('게시판 정보 조회 오류:', error);
    return null;
  }
};

/**
 * 인기 게시판 목록 조회 (게시글 수 기준)
 */
export const getPopularBoards = async (limit_count: number = 5): Promise<Board[]> => {
  try {
    const q = query(
      collection(db, 'boards'),
      where('isActive', '==', true),
      orderBy('stats.postCount', 'desc'),
      limit(limit_count)
    );

    const querySnapshot = await getDocs(q);
    const boards: Board[] = [];

    querySnapshot.forEach((doc) => {
      const boardData = doc.data();
      boards.push({
        id: doc.id,
        name: boardData.name,
        code: boardData.code,
        description: boardData.description,
        type: boardData.type,
        parentCode: boardData.parentCode,
        order: boardData.order,
        isActive: boardData.isActive,
        isPublic: boardData.isPublic || true,
        createdAt: boardData.createdAt,
        updatedAt: boardData.updatedAt,
        stats: boardData.stats || { postCount: 0, viewCount: 0, activeUserCount: 0 },
        allowAnonymous: boardData.allowAnonymous || false,
        allowPolls: boardData.allowPolls || false,
        icon: boardData.icon,
        customIcon: boardData.customIcon,
      });
    });

    return boards;
  } catch (error) {
    console.error('인기 게시판 조회 오류:', error);
    return [];
  }
};

// 익명 댓글 작성하기
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
}) => {
  const result = await communityCommand('comment.create', { postId, content, parentId, isAnonymous: true }); return result.id;
};

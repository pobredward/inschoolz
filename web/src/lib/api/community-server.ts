/**
 * 서버 전용 커뮤니티 데이터 헬퍼 (Admin SDK, RSC에서 사용)
 */
import { firestore } from '@/lib/firebase-admin';
import { unstable_cache } from 'next/cache';
import { getBoardsByType } from '@/lib/api/board';
import type { BoardType } from '@/types/board';

interface SerializedBoard {
  id: string;
  name: string;
  code: string;
  type: string;
  order: number;
  isActive: boolean;
}

interface SerializedPost {
  id: string;
  title: string;
  content: string;
  boardCode: string;
  boardName: string;
  authorId: string;
  authorInfo: {
    displayName: string;
    isAnonymous: boolean;
    profileImageUrl?: string;
  };
  createdAt: string;
  stats: {
    viewCount: number;
    likeCount: number;
    commentCount: number;
    scrapCount: number;
  };
  status: {
    isPinned: boolean;
    isDeleted: boolean;
    isHidden: boolean;
  };
  [key: string]: unknown;
}

interface InitialCommunityData {
  posts: SerializedPost[];
  boards: SerializedBoard[];
  totalCount: number;
  totalPages: number;
}

function toSerializableTimestamp(ts: FirebaseFirestore.Timestamp | null | undefined): string {
  if (!ts) return new Date().toISOString();
  try {
    return ts.toDate().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

const fetchInitialNationalData = unstable_cache(
  async (): Promise<InitialCommunityData> => {
    const db = firestore;

    const [boardsSnap, countSnap, postsSnap] = await Promise.all([
      db.collection('boards')
        .where('type', '==', 'national')
        .where('isActive', '==', true)
        .orderBy('order', 'asc')
        .get(),
      db.collection('posts')
        .where('type', '==', 'national')
        .where('status.isDeleted', '==', false)
        .where('status.isHidden', '==', false)
        .count()
        .get(),
      db.collection('posts')
        .where('type', '==', 'national')
        .where('status.isDeleted', '==', false)
        .where('status.isHidden', '==', false)
        .orderBy('status.isPinned', 'desc')
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get(),
    ]);

    const boards: SerializedBoard[] = boardsSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name || '',
        code: d.code || '',
        type: d.type || 'national',
        order: d.order ?? 0,
        isActive: d.isActive ?? true,
      };
    });

    const boardMap = new Map(boards.map((b) => [b.code, b.name]));

    const totalCount: number = countSnap.data().count;
    const totalPages = Math.ceil(totalCount / 10) || 1;

    const posts: SerializedPost[] = postsSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        title: d.title || '',
        content: d.content || '',
        boardCode: d.boardCode || '',
        boardName: boardMap.get(d.boardCode) || d.boardCode || '',
        authorId: d.authorId || '',
        authorInfo: {
          displayName: d.authorInfo?.displayName || '사용자',
          isAnonymous: d.authorInfo?.isAnonymous ?? false,
          profileImageUrl: d.authorInfo?.profileImageUrl || '',
        },
        createdAt: toSerializableTimestamp(d.createdAt),
        stats: {
          viewCount: d.stats?.viewCount ?? 0,
          likeCount: d.stats?.likeCount ?? 0,
          commentCount: d.stats?.commentCount ?? 0,
          scrapCount: d.stats?.scrapCount ?? 0,
        },
        status: {
          isPinned: d.status?.isPinned ?? false,
          isDeleted: d.status?.isDeleted ?? false,
          isHidden: d.status?.isHidden ?? false,
        },
        imageUrls: d.imageUrls || [],
        attachments: d.attachments || [],
        tags: d.tags || [],
        poll: d.poll || null,
        regions: d.regions || null,
        schoolId: d.schoolId || null,
      };
    });

    return { posts, boards, totalCount, totalPages };
  },
  ['community-initial-national'],
  { revalidate: 60 }
);

// 서버 전용: getBoardsByType에 unstable_cache 1시간 적용 (RSC 페이지에서만 사용)
export const getBoardsByTypeCached = unstable_cache(
  getBoardsByType,
  ['boards-by-type'],
  { revalidate: 3600, tags: ['boards'] }
);

export async function getInitialNationalCommunityData(): Promise<InitialCommunityData> {
  try {
    return await fetchInitialNationalData();
  } catch (error) {
    console.error('초기 커뮤니티 데이터 조회 실패:', error);
    return { posts: [], boards: [], totalCount: 0, totalPages: 1 };
  }
}

export interface PostUserState {
  isLiked: boolean;
  isScrapped: boolean;
  isBlocked: boolean;
}

/**
 * 서버에서 게시글에 대한 유저 상호작용 상태를 한 번에 조회 (Admin SDK 사용)
 * RSC에서 cookies()로 uid를 읽어 전달받음
 */
export async function getPostUserState(
  postId: string,
  userId: string,
  authorId: string | null
): Promise<PostUserState> {
  const defaultState: PostUserState = { isLiked: false, isScrapped: false, isBlocked: false };
  if (!userId) return defaultState;

  try {
    const db = firestore;

    const likeRef = db.doc(`posts/${postId}/likes/${userId}`);
    const userRef = db.doc(`users/${userId}`);
    const blockRef = authorId ? db.doc(`users/${userId}/blocks/${authorId}`) : null;

    const [likeSnap, userSnap, blockSnap] = await Promise.all([
      likeRef.get(),
      userRef.get(),
      blockRef ? blockRef.get() : Promise.resolve(null),
    ]);

    const scraps: string[] = userSnap.exists ? (userSnap.data()?.scraps || []) : [];

    return {
      isLiked: likeSnap.exists,
      isScrapped: scraps.includes(postId),
      isBlocked: blockSnap ? blockSnap.exists : false,
    };
  } catch (error) {
    console.error('게시글 유저 상태 조회 실패:', error);
    return defaultState;
  }
}

// ─────────────────────────────────────────────────────────────
// Admin SDK 기반 게시글 상세 통합 조회
// 클라이언트 SDK보다 빠른 gRPC 경로 사용, post + comments + boards + userState 완전 병렬
// ─────────────────────────────────────────────────────────────

function tsToMs(ts: FirebaseFirestore.Timestamp | null | undefined): number {
  if (!ts) return Date.now();
  try { return ts.toMillis(); } catch { return Date.now(); }
}

function buildSerializedComment(
  commentDoc: FirebaseFirestore.DocumentSnapshot,
  parentCommentId: string | null,
  userDataMap: Map<string, { displayName: string; profileImageUrl: string }>
): Record<string, unknown> {
  const d = commentDoc.data() || {};
  const isAnonymous = d.isAnonymous || !d.authorId;
  const isDeleted = d.status?.isDeleted === true;

  let author: { displayName: string; profileImageUrl: string; isAnonymous: boolean };
  if (isAnonymous) {
    author = {
      displayName: d.anonymousAuthor?.nickname || '익명',
      profileImageUrl: '',
      isAnonymous: true,
    };
  } else if (isDeleted) {
    author = { displayName: '삭제된 계정', profileImageUrl: '', isAnonymous: true };
  } else {
    const u = userDataMap.get(d.authorId || '');
    author = u
      ? { ...u, isAnonymous: false }
      : { displayName: '삭제된 계정', profileImageUrl: '', isAnonymous: true };
  }

  return {
    id: commentDoc.id,
    postId: d.postId || '',
    content: d.content || '',
    authorId: d.authorId || null,
    isAnonymous,
    anonymousAuthor: d.anonymousAuthor || null,
    parentId: d.parentId || null,
    parentCommentId,
    fake: d.fake || false,
    stats: { likeCount: d.stats?.likeCount ?? 0 },
    status: {
      isDeleted: d.status?.isDeleted ?? false,
      isBlocked: d.status?.isBlocked ?? false,
    },
    createdAt: tsToMs(d.createdAt),
    updatedAt: tsToMs(d.updatedAt),
    author,
    replies: [],
  };
}

export interface AdminPostDetail {
  post: Record<string, unknown>;
  comments: Record<string, unknown>[];
  hasMoreComments: boolean;
  totalCommentCount: number;
  boards: SerializedBoard[];
  userState: PostUserState;
}

/**
 * RSC 전용: Admin SDK로 게시글 상세에 필요한 모든 데이터를 병렬 조회
 * - post 문서
 * - 댓글 (서브컬렉션 + 최상위)
 * - boards 목록 (캐시됨)
 * - 유저 상호작용 상태 (좋아요/스크랩/차단)
 * 를 단일 함수에서 처리하여 왕복 최소화
 */
export async function getPostDetailAdmin(
  postId: string,
  boardType: BoardType,
  userId: string,
  commentLimit = 30
): Promise<AdminPostDetail | null> {
  const db = firestore;

  const defaultUserState: PostUserState = { isLiked: false, isScrapped: false, isBlocked: false };

  try {
    // 1단계: post 문서 + 댓글(서브컬렉션) + 댓글(최상위/AI) + boards 를 완전 병렬 조회
    const [postSnap, subCommentsSnap, topCommentsSnap, boards] = await Promise.all([
      db.doc(`posts/${postId}`).get(),
      db.collection(`posts/${postId}/comments`).orderBy('createdAt', 'asc').get(),
      db.collection('comments').where('postId', '==', postId).get(),
      getBoardsByTypeCached(boardType),
    ]);

    if (!postSnap.exists) return null;

    const postData = postSnap.data()!;
    const authorId: string | null = postData.authorId || null;

    // 2단계: 작성자 프로필 + 유저 상태를 post 조회 직후 병렬로 시작
    const needsAuthorFetch =
      !postData.authorInfo?.profileImageUrl &&
      !postData.authorInfo?.isAnonymous &&
      !!authorId;

    const [authorSnap, userStateResult] = await Promise.all([
      needsAuthorFetch ? db.doc(`users/${authorId!}`).get() : Promise.resolve(null),
      userId
        ? (async (): Promise<PostUserState> => {
            try {
              const [likeSnap, userSnap, blockSnap] = await Promise.all([
                db.doc(`posts/${postId}/likes/${userId}`).get(),
                db.doc(`users/${userId}`).get(),
                authorId && authorId !== userId
                  ? db.doc(`users/${userId}/blocks/${authorId}`).get()
                  : Promise.resolve(null),
              ]);
              const scraps: string[] = userSnap.exists ? (userSnap.data()?.scraps || []) : [];
              return {
                isLiked: likeSnap.exists,
                isScrapped: scraps.includes(postId),
                isBlocked: blockSnap ? blockSnap.exists : false,
              };
            } catch {
              return defaultUserState;
            }
          })()
        : Promise.resolve(defaultUserState),
    ]);

    // authorInfo 처리
    let authorInfo = postData.authorInfo || {};
    if (needsAuthorFetch && authorSnap) {
      const u = authorSnap.exists ? authorSnap.data() : null;
      authorInfo = u?.profile
        ? {
            displayName: postData.authorInfo?.displayName || u.profile.userName || '사용자',
            profileImageUrl: u.profile.profileImageUrl || '',
            isAnonymous: false,
          }
        : { displayName: '삭제된 계정', profileImageUrl: '', isAnonymous: true };
    }

    // post 직렬화
    const post: Record<string, unknown> = {
      id: postSnap.id,
      title: postData.title || '',
      content: postData.content || '',
      boardCode: postData.boardCode || '',
      boardName: postData.boardName || '',
      type: postData.type || boardType,
      authorId,
      authorInfo,
      attachments: postData.attachments || [],
      tags: postData.tags || [],
      poll: postData.poll || null,
      regions: postData.regions || null,
      schoolId: postData.schoolId || null,
      imageUrls: postData.imageUrls || [],
      stats: {
        viewCount: postData.stats?.viewCount ?? 0,
        likeCount: postData.stats?.likeCount ?? 0,
        commentCount: postData.stats?.commentCount ?? 0,
        scrapCount: postData.stats?.scrapCount ?? 0,
      },
      status: {
        isDeleted: postData.status?.isDeleted ?? false,
        isHidden: postData.status?.isHidden ?? false,
        isBlocked: postData.status?.isBlocked ?? false,
        isPinned: postData.status?.isPinned ?? false,
      },
      createdAt: tsToMs(postData.createdAt),
      updatedAt: tsToMs(postData.updatedAt),
    };

    // 댓글 처리: 서브컬렉션 + 최상위 병합
    const parentComments: FirebaseFirestore.DocumentSnapshot[] = [];
    const replyDocs: Array<{ doc: FirebaseFirestore.DocumentSnapshot; parentId: string }> = [];

    for (const d of subCommentsSnap.docs) {
      const data = d.data();
      if (data.status?.isDeleted && data.content !== '삭제된 댓글입니다.') continue;
      if (data.parentId) {
        replyDocs.push({ doc: d, parentId: data.parentId });
      } else {
        parentComments.push(d);
      }
    }
    for (const d of topCommentsSnap.docs) {
      const data = d.data();
      if (data.status?.isDeleted) continue;
      if (data.parentCommentId) {
        replyDocs.push({ doc: d, parentId: data.parentCommentId });
      } else {
        parentComments.push(d);
      }
    }

    // 댓글 작성자 배치 조회 (Admin SDK: getAll 사용)
    const commentUserIds = new Set<string>();
    [...parentComments, ...replyDocs.map(r => r.doc)].forEach(d => {
      const data = d.data() || {};
      if (!data.isAnonymous && data.authorId && !data.status?.isDeleted) {
        commentUserIds.add(data.authorId);
      }
    });

    const userDataMap = new Map<string, { displayName: string; profileImageUrl: string }>();
    if (commentUserIds.size > 0) {
      try {
        const userRefs = Array.from(commentUserIds).map(uid => db.doc(`users/${uid}`));
        const userSnaps = await db.getAll(...userRefs);
        userSnaps.forEach(snap => {
          if (snap.exists) {
            const u = snap.data()!;
            if (u.profile) {
              userDataMap.set(snap.id, {
                displayName: u.profile.userName || '사용자',
                profileImageUrl: u.profile.profileImageUrl || '',
              });
            }
          }
        });
      } catch {
        // 사용자 정보 조회 실패는 무시
      }
    }

    // 댓글 구조화 및 시간순 정렬
    const commentMap = new Map<string, Record<string, unknown>>();
    const sortedParents = [...parentComments].sort(
      (a, b) => tsToMs((a.data() as any)?.createdAt) - tsToMs((b.data() as any)?.createdAt)
    );

    for (const d of sortedParents) {
      commentMap.set(d.id, buildSerializedComment(d, null, userDataMap));
    }
    for (const { doc: d, parentId } of replyDocs) {
      const reply = buildSerializedComment(d, parentId, userDataMap);
      const parent = commentMap.get(parentId);
      if (parent) {
        (parent.replies as Record<string, unknown>[]).push(reply);
      }
    }

    const allComments = Array.from(commentMap.values());
    const totalCommentCount = allComments.length;
    const hasMoreComments = totalCommentCount > commentLimit;
    const comments = hasMoreComments ? allComments.slice(0, commentLimit) : allComments;

    return {
      post,
      comments,
      hasMoreComments,
      totalCommentCount,
      boards: boards as SerializedBoard[],
      userState: userStateResult,
    };
  } catch (error) {
    console.error('Admin 게시글 상세 조회 실패:', error);
    return null;
  }
}

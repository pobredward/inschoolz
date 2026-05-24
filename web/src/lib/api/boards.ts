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
  try {
    const postRef = doc(db, 'posts', postId);
    await updateDoc(postRef, {
      'stats.viewCount': increment(1),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('조회수 증가 오류:', error);
    // 조회수 증가 실패는 중요하지 않으므로 에러를 던지지 않음
  }
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
  try {
    const {
      title,
      content,
      code,
      type,
      category,
      schoolId,
      regions,
      images,
      attachments,
      tags,
      isAnonymous,
      poll
    } = params;

    // 게시판 존재 여부 확인
    const boardRef = doc(db, 'boards', code);
    const boardDoc = await getDoc(boardRef);
    
    if (!boardDoc.exists()) {
      throw new Error('존재하지 않는 게시판입니다.');
    }

    const boardData = boardDoc.data();

    // 새 게시글 정보 생성
    const newPost: Omit<Post, 'id'> = {
      title,
      content,
      authorId: userId,
      authorInfo: {
        displayName: '', // 임시값, 실제로는 사용자 정보에서 가져와야 함
        isAnonymous: isAnonymous || false
      },
      boardCode: code,
      boardName: boardData?.name || code, // boardName 추가
      type,
      category: category || undefined,
      schoolId: schoolId || undefined,
      regions: regions || undefined,
      stats: {
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
        scrapCount: 0
      },
      status: {
        isDeleted: false,
        isHidden: false,
        isBlocked: false,
        isPinned: false
      },
      attachments: [],
      tags: tags || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // 투표 정보 추가
    if (poll) {
      newPost.poll = {
        isActive: true,
        question: poll.question,
        options: poll.options.map((text, index) => ({
          text,
          voteCount: 0,
          index
        })),
        expiresAt: poll.expiresAt ? poll.expiresAt.getTime() : undefined,
        multipleChoice: poll.multipleChoice
      };
    }

    // Firestore에 게시글 추가
    const postRef = await addDoc(collection(db, 'posts'), newPost);
    const postId = postRef.id;

    // 이미지 업로드 처리
    if (images && images.length > 0) {
      for (const image of images) {
        const imageUrl = await uploadPostImage(postId, image);
        
        // 이미지 URL을 게시글 내용에 추가 (마크다운 형식)
        await updateDoc(postRef, {
          content: content + `\n\n![이미지](${imageUrl})`,
          updatedAt: serverTimestamp()
        });
      }
    }

    // 첨부 파일 업로드 처리
    if (attachments && attachments.length > 0) {
      const uploadedAttachments = [];
      
      for (const file of attachments) {
        const fileUrl = await uploadPostAttachment(postId, file);
        
        uploadedAttachments.push({
          id: crypto.randomUUID(),
          fileName: file.name,
          fileUrl,
          fileType: file.type,
          fileSize: file.size,
          postId,
          userId,
          createdAt: serverTimestamp()
        });
      }
      
      // 첨부 파일 정보 업데이트
      await updateDoc(postRef, {
        attachments: uploadedAttachments,
        updatedAt: serverTimestamp()
      });
    }

    // 사용자 게시글 작성 수 증가
    await updateDoc(doc(db, 'users', userId), {
      'stats.postCount': increment(1),
      updatedAt: serverTimestamp()
    });

    // 경험치 부여 로직 제거 - 프론트엔드에서 처리

    // 생성된 게시글 반환
    const createdPost = await getPost(postId);
    
    if (!createdPost) {
      throw new Error('게시글이 생성되었지만 정보를 가져오지 못했습니다.');
    }
    
    return createdPost;
  } catch (error) {
    console.error('게시글 작성 오류:', error);
    throw new Error('게시글 작성 중 오류가 발생했습니다.');
  }
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
  try {
    console.log('🔥 boards.ts updatePost called with:', { postId, userId, params });
    
    const postRef = doc(db, 'posts', postId);
    const postDoc = await getDoc(postRef);
    
    if (!postDoc.exists()) {
      console.error('🔥 boards.ts updatePost: 게시글이 존재하지 않음:', postId);
      throw new Error('존재하지 않는 게시글입니다.');
    }
    
    const postData = postDoc.data() as Post;
    console.log('🔥 boards.ts updatePost: 게시글 데이터:', { 
      postId, 
      authorId: postData.authorId,
      fake: (postData as any).fake 
    });
    
    // 게시글 작성자 또는 관리자 권한 확인
    // 사용자 정보 가져와서 관리자 권한 확인
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.exists() ? userDoc.data() : null;
    const isAdmin = userData?.role === 'admin';
    const isAuthor = postData.authorId === userId;
    
    console.log('🔥 boards.ts updatePost: 권한 확인:', { 
      userId, 
      isAdmin, 
      isAuthor, 
      userRole: userData?.role 
    });
    
    if (!isAuthor && !isAdmin) {
      console.error('🔥 boards.ts updatePost: 권한 없음');
      throw new Error('게시글 수정 권한이 없습니다.');
    }
    
    // 게시글 업데이트
    const updateData: { [key: string]: any } = {
      updatedAt: Timestamp.now()
    };
    
    if (params.title) updateData.title = params.title;
    if (params.content) updateData.content = params.content;
    if (params.tags) updateData.tags = params.tags;
    if (params.isAnonymous !== undefined) updateData['authorInfo.isAnonymous'] = params.isAnonymous;
    
    console.log('🚨 boards.ts updatePost - updateData:', JSON.stringify(updateData, null, 2));
    console.log('🚨 boards.ts updatePost - contains poll?', 'poll' in updateData);
    
    console.log('🔥 boards.ts updatePost: Firestore 업데이트 시작');
    await updateDoc(postRef, updateData);
    console.log('🔥 boards.ts updatePost: Firestore 업데이트 완료');
    
    // 업데이트된 게시글 반환
    console.log('🔥 boards.ts updatePost: 업데이트된 게시글 조회 시작');
    const updatedPost = await getPost(postId);
    
    if (!updatedPost) {
      console.error('🔥 boards.ts updatePost: 업데이트된 게시글 조회 실패');
      throw new Error('게시글이 수정되었지만 정보를 가져오지 못했습니다.');
    }
    
    console.log('🔥 boards.ts updatePost: 성공적으로 완료');
    return updatedPost;
  } catch (error) {
    console.error('🔥 boards.ts updatePost: 오류 발생:', error);
    
    if (error instanceof Error) {
      console.error('🔥 boards.ts updatePost: 오류 메시지:', error.message);
      console.error('🔥 boards.ts updatePost: 스택 트레이스:', error.stack);
      throw error; // 원본 오류 메시지 유지
    }
    
    throw new Error('게시글 수정 중 알 수 없는 오류가 발생했습니다.');
  }
};

// 게시글 삭제 (소프트 삭제)
export const deletePost = async (postId: string, userId: string): Promise<void> => {
  try {
    const postRef = doc(db, 'posts', postId);
    const postDoc = await getDoc(postRef);
    
    if (!postDoc.exists()) {
      throw new Error('존재하지 않는 게시글입니다.');
    }
    
    const postData = postDoc.data() as Post;
    
    // 게시글 작성자 확인
    if (postData.authorId !== userId) {
      throw new Error('게시글 삭제 권한이 없습니다.');
    }
    
    // 게시글 소프트 삭제
    await updateDoc(postRef, {
      'status.isDeleted': true,
      updatedAt: Timestamp.now()
    });
    
    // 사용자 게시글 수 감소
    await updateDoc(doc(db, 'users', userId), {
      'stats.postCount': increment(-1),
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('게시글 삭제 오류:', error);
    throw new Error('게시글 삭제 중 오류가 발생했습니다.');
  }
};

// 게시글 좋아요/취소
export const toggleLikePost = async (postId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> => {
  try {
    // 좋아요 상태 확인
    const likesRef = collection(db, `posts/${postId}/likes`);
    const q = query(likesRef, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    
    const postRef = doc(db, 'posts', postId);
    const postDoc = await getDoc(postRef);
    
    if (!postDoc.exists()) {
      throw new Error('존재하지 않는 게시글입니다.');
    }
    
    const postData = postDoc.data() as Post;
    
    // 좋아요가 이미 존재하면 삭제, 없으면 추가
    if (!querySnapshot.empty) {
      // 좋아요 취소
      const likeDoc = querySnapshot.docs[0];
      await deleteDoc(doc(db, `posts/${postId}/likes`, likeDoc.id));
      
      // 게시글 좋아요 수 감소
      await updateDoc(postRef, {
        'stats.likeCount': increment(-1),
        updatedAt: Timestamp.now()
      });
      
      // 사용자 좋아요 수 감소
      await updateDoc(doc(db, 'users', userId), {
        'stats.likeCount': increment(-1),
        updatedAt: Timestamp.now()
      });
      
      return {
        liked: false,
        likeCount: (postData.stats.likeCount || 0) - 1
      };
    } else {
      // 좋아요 추가
      await addDoc(likesRef, {
        userId,
        postId,
        createdAt: serverTimestamp()
      });
      
      // 게시글 좋아요 수 증가
      await updateDoc(postRef, {
        'stats.likeCount': increment(1),
        updatedAt: Timestamp.now()
      });
      
      // 사용자 좋아요 수 증가
      await updateDoc(doc(db, 'users', userId), {
        'stats.likeCount': increment(1),
        updatedAt: Timestamp.now()
      });

      // 좋아요 시 경험치 지급 (좋아요 취소는 경험치 지급하지 않음)
      try {
        const expResult = await awardExperience(userId, 'like');
        if (expResult.success && expResult.leveledUp) {
          console.log(`🎉 레벨업! ${expResult.oldLevel} → ${expResult.newLevel} (좋아요)`);
        }
      } catch (expError) {
        console.error('좋아요 경험치 지급 오류:', expError);
        // 경험치 지급 실패는 좋아요 자체를 실패로 처리하지 않음
      }
      
      return {
        liked: true,
        likeCount: (postData.stats.likeCount || 0) + 1
      };
    }
  } catch (error) {
    console.error('게시글 좋아요 토글 오류:', error);
    throw new Error('좋아요 처리 중 오류가 발생했습니다.');
  }
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
  try {
    const { content, parentId, isAnonymous } = params;
    
    // 게시글 존재 여부 확인
    const postRef = doc(db, 'posts', postId);
    const postDoc = await getDoc(postRef);
    
    if (!postDoc.exists()) {
      throw new Error('존재하지 않는 게시글입니다.');
    }
    
    const postData = postDoc.data() as Post;
    
    // 새 댓글 정보 생성
    const newComment: Omit<Comment, 'id'> = {
      postId,
      content,
      authorId: userId,
      parentId: parentId || null,
      isAnonymous: isAnonymous || false,
      stats: {
        likeCount: 0
      },
      status: {
        isDeleted: false,
        isBlocked: false
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    // Firestore에 댓글 추가
    const commentsRef = collection(db, `posts/${postId}/comments`);
    const commentRef = await addDoc(commentsRef, newComment);
    const commentId = commentRef.id;
    
    // Comment 객체에 ID 추가
    await updateDoc(commentRef, { id: commentId });
    
    // 게시글 댓글 수 증가
    await updateDoc(postRef, {
      'stats.commentCount': increment(1),
      updatedAt: Timestamp.now()
    });
    
    // 사용자 댓글 작성 수 증가
    await updateDoc(doc(db, 'users', userId), {
      'stats.commentCount': increment(1),
      updatedAt: Timestamp.now()
    });

    // 알림 발송 로직
    try {
      // 댓글 작성자 정보 조회
      const authorDoc = await getDoc(doc(db, 'users', userId));
      const authorData = authorDoc.data();
      const commenterName = isAnonymous 
        ? '익명' 
        : (authorData?.profile?.userName || '사용자');

      if (parentId) {
        // 대댓글인 경우: 원 댓글 작성자에게 알림
        const parentCommentDoc = await getDoc(doc(db, `posts/${postId}/comments`, parentId));
        if (parentCommentDoc.exists()) {
          const parentCommentData = parentCommentDoc.data();
          const parentAuthorId = parentCommentData.authorId;
          
          // 자기 자신에게는 알림 보내지 않음
          if (parentAuthorId && parentAuthorId !== userId) {
            const { createCommentReplyNotification } = await import('./notifications');
            await createCommentReplyNotification(
              parentAuthorId,
              postId,
              postData.title || '게시글',
              parentId,
              commenterName,
              content,
              commentId,
              isAnonymous
            );
          }
        }
      } else {
        // 일반 댓글인 경우: 게시글 작성자에게 알림
        const postAuthorId = postData.authorId;
        
        // 자기 자신에게는 알림 보내지 않음
        if (postAuthorId && postAuthorId !== userId) {
          const { createPostCommentNotification } = await import('./notifications');
          await createPostCommentNotification(
            postAuthorId,                      // 게시글 작성자 ID
            userId,                            // 댓글 작성자 ID
            postId,                            // 게시글 ID
            commentId,                         // 댓글 ID
            postData.title || '게시글',         // 게시글 제목
            content,                           // 댓글 내용
            isAnonymous                        // 익명 여부 추가
          );
        }
      }
    } catch (notificationError) {
      console.error('댓글 알림 발송 실패:', notificationError);
      // 알림 발송 실패는 댓글 작성 자체를 실패시키지 않음
    }

    // 경험치 부여 로직 제거 - 프론트엔드에서 처리
    
    // 생성된 댓글 반환
    const commentDoc = await getDoc(commentRef);
    
    if (!commentDoc.exists()) {
      throw new Error('댓글이 생성되었지만 정보를 가져오지 못했습니다.');
    }
    
    return { id: commentDoc.id, ...commentDoc.data() } as Comment;
  } catch (error) {
    console.error('댓글 작성 오류:', error);
    throw new Error('댓글 작성 중 오류가 발생했습니다.');
  }
};

// 댓글 수정
export const updateComment = async (
  postId: string,
  commentId: string,
  userId: string,
  content: string
): Promise<Comment> => {
  try {
    const commentRef = doc(db, `posts/${postId}/comments`, commentId);
    const commentDoc = await getDoc(commentRef);
    
    if (!commentDoc.exists()) {
      throw new Error('존재하지 않는 댓글입니다.');
    }
    
    const commentData = commentDoc.data() as Comment;
    
    // 댓글 작성자 확인
    if (commentData.authorId !== userId) {
      throw new Error('댓글 수정 권한이 없습니다.');
    }
    
    // 댓글 업데이트
    await updateDoc(commentRef, {
      content,
      updatedAt: Timestamp.now()
    });
    
    // 업데이트된 댓글 반환
    const updatedCommentDoc = await getDoc(commentRef);
    
    if (!updatedCommentDoc.exists()) {
      throw new Error('댓글이 수정되었지만 정보를 가져오지 못했습니다.');
    }
    
    return { id: updatedCommentDoc.id, ...updatedCommentDoc.data() } as Comment;
  } catch (error) {
    console.error('댓글 수정 오류:', error);
    throw new Error('댓글 수정 중 오류가 발생했습니다.');
  }
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
  try {
    const commentRef = doc(db, `posts/${postId}/comments`, commentId);
    const commentDoc = await getDoc(commentRef);
    
    if (!commentDoc.exists()) {
      throw new Error('존재하지 않는 댓글입니다.');
    }
    
    const commentData = commentDoc.data() as Comment;
    
    // 댓글 작성자 확인
    if (commentData.authorId !== userId) {
      throw new Error('댓글 삭제 권한이 없습니다.');
    }
    
    // 대댓글 존재 여부 확인
    const hasRepliesExist = await hasReplies(postId, commentId);
    
    if (hasRepliesExist) {
      // 대댓글이 있는 경우: 소프트 삭제 (내용만 변경, 카운트는 유지)
      await updateDoc(commentRef, {
        content: '삭제된 댓글입니다.',
        'status.isDeleted': true,
        updatedAt: Timestamp.now()
      });
      // 대댓글이 있는 경우 카운트는 감소시키지 않음
    } else {
      // 대댓글이 없는 경우: 소프트 삭제 및 카운트 감소
      await updateDoc(commentRef, {
        'status.isDeleted': true,
        updatedAt: Timestamp.now()
      });
      
      // 게시글 댓글 수 감소 (대댓글이 없는 경우에만)
      await updateDoc(doc(db, 'posts', postId), {
        'stats.commentCount': increment(-1),
        updatedAt: Timestamp.now()
      });
      
      // 사용자 댓글 수 감소 (대댓글이 없는 경우에만)
      await updateDoc(doc(db, 'users', userId), {
        'stats.commentCount': increment(-1),
        updatedAt: Timestamp.now()
      });
    }
    
    return { hasReplies: hasRepliesExist };
  } catch (error) {
    console.error('댓글 삭제 오류:', error);
    throw new Error('댓글 삭제 중 오류가 발생했습니다.');
  }
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
  try {
    // 게시글 정보 가져오기
    const postDoc = await getDoc(doc(db, 'posts', postId));
    if (!postDoc.exists()) {
      throw new Error('존재하지 않는 게시글입니다.');
    }

    // 비밀번호 해시화 (간단한 해시 - 실제로는 더 안전한 방법 사용)
    const hashPassword = async (password: string): Promise<string> => {
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };
    
    const passwordHash = await hashPassword(password);
    
    // 댓글 데이터 생성
    const commentData = {
      postId,
      content,
      authorId: null,
      isAnonymous: true,
      parentId,
      anonymousAuthor: {
        nickname,
        passwordHash,
        ipAddress: ipAddress || null,
      },
      stats: {
        likeCount: 0,
      },
      status: {
        isDeleted: false,
        isBlocked: false,
      },
      createdAt: serverTimestamp(),
    };

    // Firestore에 댓글 추가
    const commentRef = await addDoc(collection(db, 'posts', postId, 'comments'), commentData);
    
    // 게시글의 댓글 수 증가
    await updateDoc(doc(db, 'posts', postId), {
      'stats.commentCount': increment(1),
    });

    // 알림 발송 로직
    try {
      const postData = postDoc.data();
      
      if (parentId) {
        // 대댓글인 경우: 원 댓글 작성자에게 알림
        const parentCommentDoc = await getDoc(doc(db, `posts/${postId}/comments`, parentId));
        if (parentCommentDoc.exists()) {
          const parentCommentData = parentCommentDoc.data();
          const parentAuthorId = parentCommentData.authorId;
          
          // 익명 댓글에 대한 답글이므로 원 댓글 작성자가 존재하는 경우에만 알림 발송
          if (parentAuthorId) {
            const { createCommentReplyNotification } = await import('./notifications');
            await createCommentReplyNotification(
              parentAuthorId,
              postId,
              postData.title || '게시글',
              parentId,
              nickname,
              content,
              commentRef.id
            );
          }
        }
      } else {
        // 일반 댓글인 경우: 게시글 작성자에게 알림
        const postAuthorId = postData.authorId;
        
        if (postAuthorId) {
          const { createPostCommentNotification } = await import('./notifications');
          await createPostCommentNotification(
            postAuthorId,
            'anonymous', // 익명 사용자 ID
            postId,
            commentRef.id,
            postData.title || '게시글',
            content
          );
        }
      }
    } catch (notificationError) {
      console.error('익명 댓글 알림 발송 실패:', notificationError);
      // 알림 발송 실패는 댓글 작성 자체를 실패시키지 않음
    }

    return commentRef.id;
  } catch (error) {
    console.error('익명 댓글 작성 실패:', error);
    throw new Error('댓글 작성에 실패했습니다.');
  }
}; 
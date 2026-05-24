import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy, 
  limit, 
  increment,
  serverTimestamp,
  writeBatch,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData,
  arrayUnion,
  arrayRemove,
  deleteField
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  Post, 
  Board,
  User
} from '@/types';
import { stripHtmlTags } from '@/lib/utils';
import { 
  BoardType,
  PopularPost,
  PostFormData,
  BoardFilterOptions
} from '@/types/board';
import { 
  getDocument, 
  getDocuments,
  getPaginatedDocuments,
  getPaginatedDocumentsWithCount,
  updateDocument,
  addDocument
} from '@/lib/firestore';
import { awardExperience } from '@/lib/experience';
import { 
  createPostCommentNotification, 
  createCommentReplyNotification 
} from './notifications';
import { serializeObject, serializeTimestamp } from '@/lib/utils';

// 게시글의 authorInfo 업데이트 (프로필 이미지 포함)
const updatePostAuthorInfo = async (post: any) => {
  if (!post.authorInfo?.profileImageUrl && !post.authorInfo?.isAnonymous && post.authorId) {
    try {
      const userDoc = await getDocument('users', post.authorId);
      if (userDoc && (userDoc as any).profile) {
        post.authorInfo = {
          ...post.authorInfo,
          displayName: post.authorInfo?.displayName || (userDoc as any).profile.userName || '사용자',
          profileImageUrl: (userDoc as any).profile.profileImageUrl || '',
          isAnonymous: post.authorInfo?.isAnonymous || false
        };
      } else {
        // 사용자 문서가 존재하지 않는 경우 (계정 삭제됨)
        post.authorInfo = {
          ...post.authorInfo,
          displayName: '삭제된 계정',
          profileImageUrl: '',
          isAnonymous: true
        };
      }
    } catch (userError) {
      console.warn('사용자 정보 업데이트 실패 (계정 삭제 가능성):', userError);
      // 사용자를 찾을 수 없는 경우 삭제된 계정으로 처리
      post.authorInfo = {
        ...post.authorInfo,
        displayName: '삭제된 계정',
        profileImageUrl: '',
        isAnonymous: true
      };
    }
  }
  return post;
};

// 여러 게시글의 authorInfo 일괄 업데이트
const updatePostsAuthorInfo = async (posts: any[]) => {
  // profileImageUrl이 이미 있는 게시글은 users 조회 불필요
  // 익명이거나 이미 프로필 이미지가 있는 게시글은 스킵
  const userIds = new Set<string>();
  posts.forEach(post => {
    if (!post.authorInfo?.isAnonymous && post.authorId && !post.authorInfo?.profileImageUrl) {
      userIds.add(post.authorId);
    }
  });

  // 조회가 필요한 사용자가 없으면 바로 반환
  if (userIds.size === 0) {
    return posts;
  }

  // 사용자 정보 일괄 조회
  const userDataMap = new Map<string, any>();
  try {
    const userPromises = Array.from(userIds).map(async (userId) => {
      try {
        const userDoc = await getDocument('users', userId);
        if (userDoc && (userDoc as any).profile) {
          return {
            userId,
            userData: {
              displayName: (userDoc as any).profile.userName || '사용자',
              profileImageUrl: (userDoc as any).profile.profileImageUrl || '',
              isAnonymous: false
            }
          };
        } else {
          return {
            userId,
            userData: {
              displayName: '삭제된 계정',
              profileImageUrl: '',
              isAnonymous: true
            }
          };
        }
      } catch (error) {
        console.warn(`사용자 ${userId} 정보 조회 실패:`, error);
        return {
          userId,
          userData: {
            displayName: '삭제된 계정',
            profileImageUrl: '',
            isAnonymous: true
          }
        };
      }
    });

    const userResults = await Promise.all(userPromises);
    userResults.forEach(result => {
      if (result) {
        userDataMap.set(result.userId, result.userData);
      }
    });
  } catch (error) {
    console.warn('사용자 정보 일괄 조회 실패:', error);
  }

  // 게시글에 사용자 정보 적용 (profileImageUrl이 없는 게시글만)
  return posts.map(post => {
    if (!post.authorInfo?.isAnonymous && post.authorId && !post.authorInfo?.profileImageUrl) {
      const userData = userDataMap.get(post.authorId);
      if (userData) {
        post.authorInfo = {
          ...post.authorInfo,
          displayName: userData.displayName,
          profileImageUrl: userData.profileImageUrl,
          isAnonymous: userData.isAnonymous
        };
      }
    }
    return post;
  });
};

// 게시판 목록 가져오기 (클라이언트/서버 공용)
// 서버 캐시(unstable_cache)는 RSC 페이지에서 getBoardsByTypeCached()를 사용하세요
export const getBoardsByType = async (type: BoardType) => {
  try {
    const boards = await getDocuments<Board>('boards', [
      where('type', '==', type),
      where('isActive', '==', true),
      orderBy('order', 'asc')
    ]);
    return boards.map(board => serializeObject(board as any, ['createdAt', 'updatedAt']));
  } catch (error) {
    console.error('게시판 목록 가져오기 오류:', error);
    throw new Error('게시판 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

// 즐겨찾는 게시판 목록 가져오기
export const getFavoriteBoards = async (userId: string, type: BoardType) => {
  try {
    const userDoc = await getDocument('users', userId);
    if (!userDoc || !(userDoc as any).favorites || !(userDoc as any).favorites.boards) {
      return [];
    }
    
    const boardCodes = (userDoc as any).favorites.boards[type] || [];
    
    if (boardCodes.length === 0) {
      return [];
    }
    
    return await getDocuments<Board>('boards', [
      where('code', 'in', boardCodes),
      where('isActive', '==', true),
      orderBy('order', 'asc')
    ]);
  } catch (error) {
    console.error('즐겨찾는 게시판 목록 가져오기 오류:', error);
    throw new Error('즐겨찾는 게시판 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

// 인기 게시글 가져오기
export const getPopularPosts = async (type: BoardType, count = 5) => {
  try {
    return await getDocuments<PopularPost>('hottestPosts', [
      where('boardType', '==', type),
      orderBy('score', 'desc'),
      limit(count)
    ]);
  } catch (error) {
    console.error('인기 게시글 가져오기 오류:', error);
    throw new Error('인기 게시글을 가져오는 중 오류가 발생했습니다.');
  }
};

// 홈 화면용 인기 게시글 가져오기 (14일 내 조회수 기준)
export const getPopularPostsForHome = async (count = 10) => {
  try {
    // 14일 전 Timestamp 계산
    const fourteenDaysAgo = Timestamp.fromDate(new Date(Date.now() - (14 * 24 * 60 * 60 * 1000)));
    
    const constraints = [
      where('createdAt', '>=', fourteenDaysAgo),
      where('status.isDeleted', '==', false),
      where('status.isHidden', '==', false),
      where('type', '==', 'national'), // 전국 커뮤니티만
      orderBy('createdAt', 'desc'), // 최신순으로 정렬
      limit(count * 3) // 더 많은 게시글을 가져와서 클라이언트에서 필터링
    ];
    
    const posts = await getDocuments<Post>('posts', constraints);
    
    // 조회수 기준으로 정렬하고 상위 게시글만 선택 (클라이언트 사이드)
    const sortedPosts = posts
      .sort((a, b) => (b.stats?.viewCount || 0) - (a.stats?.viewCount || 0))
      .slice(0, count);
    
    // 게시판 정보 추가 - code 필드로 검색
    const postsWithBoardInfo = await Promise.all(
      sortedPosts.map(async (post) => {
        try {
          // boardCode로 게시판 찾기
          const boardQuery = query(
            collection(db, 'boards'),
            where('code', '==', post.boardCode),
            where('type', '==', 'national'),
            limit(1)
          );
          const boardSnapshot = await getDocs(boardQuery);
          
          let boardName = post.boardCode; // fallback
          if (!boardSnapshot.empty) {
            const boardData = boardSnapshot.docs[0].data();
            boardName = boardData.name || post.boardCode;
          }
          
          return {
            ...post,
            boardName,
            previewContent: stripHtmlTags(post.content || '').slice(0, 150) || ''
          };
        } catch (error) {
          console.warn(`게시판 정보 조회 실패: ${post.boardCode}`, error);
          return {
            ...post,
            boardName: post.boardCode,
            previewContent: stripHtmlTags(post.content || '').slice(0, 150) || ''
          };
        }
      })
    );
    
    return postsWithBoardInfo;
  } catch (error) {
    console.error('홈 화면 인기 게시글 가져오기 오류:', error);
    throw new Error('인기 게시글을 가져오는 중 오류가 발생했습니다.');
  }
};

// 특정 게시판의 게시글 목록 가져오기
export const getPostsByBoard = async (
  boardCode: string, 
  pageSize = 20, 
  lastDoc?: QueryDocumentSnapshot<DocumentData>,
  filterOptions?: BoardFilterOptions
) => {
  try {
    const constraints = [
      where('code', '==', boardCode),
      where('status.isDeleted', '==', false),
      where('status.isHidden', '==', false)
    ];
    
    // 검색 필터 적용
    if (filterOptions?.keyword) {
      // 검색 대상에 따라 쿼리 조건 설정
      if (filterOptions.searchTarget === 'title') {
        constraints.push(where('title', '>=', filterOptions.keyword));
        constraints.push(where('title', '<=', filterOptions.keyword + '\uf8ff'));
      } else if (filterOptions.searchTarget === 'content') {
        constraints.push(where('content', '>=', filterOptions.keyword));
        constraints.push(where('content', '<=', filterOptions.keyword + '\uf8ff'));
      } else if (filterOptions.searchTarget === 'author') {
        constraints.push(where('authorInfo.displayName', '>=', filterOptions.keyword));
        constraints.push(where('authorInfo.displayName', '<=', filterOptions.keyword + '\uf8ff'));
      }
    }
    
    // 이미지 첨부 필터링
    if (filterOptions?.hasImage) {
      constraints.push(where('imageUrls', '!=', []));
    }
    
    // 투표 필터링
    if (filterOptions?.hasPoll) {
      constraints.push(where('poll.isActive', '==', true));
    }
    
    // 시간 필터링
    if (filterOptions?.timeFilter && filterOptions.timeFilter !== 'all') {
      let timestamp: Date;
      const now = new Date();
      
      if (filterOptions.timeFilter === 'today') {
        timestamp = new Date(now.setHours(0, 0, 0, 0));
      } else if (filterOptions.timeFilter === 'week') {
        const day = now.getDay();
        timestamp = new Date(now.setDate(now.getDate() - day));
        timestamp.setHours(0, 0, 0, 0);
      } else if (filterOptions.timeFilter === 'month') {
        timestamp = new Date(now.getFullYear(), now.getMonth(), 1);
      } else {
        timestamp = new Date();
      }
      
      constraints.push(where('createdAt', '>=', Timestamp.fromDate(timestamp)));
    }
    
    // 정렬 방식
    let sortField = 'createdAt';
    const sortDirection = 'desc';
    
    if (filterOptions?.sortBy === 'popular') {
      sortField = 'stats.likeCount';
    } else if (filterOptions?.sortBy === 'comments') {
      sortField = 'stats.commentCount';
    } else if (filterOptions?.sortBy === 'views') {
      sortField = 'stats.viewCount';
    }
    
    // orderBy 조건들을 별도로 추가
    const orderConstraints = [
      orderBy('status.isPinned', 'desc'),
      orderBy(sortField, sortDirection as 'asc' | 'desc')
    ];
    
    const result = await getPaginatedDocuments<Post>('posts', [...constraints, ...orderConstraints], pageSize, lastDoc);
    
    // 프로필 이미지 정보 업데이트
    if (result.items && result.items.length > 0) {
      result.items = await updatePostsAuthorInfo(result.items);
    }
    
    return result;
  } catch (error) {
    console.error('게시글 목록 가져오기 오류:', error);
    throw new Error('게시글 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

// 게시글 기본 정보만 가져오기 (메타데이터용, 댓글 제외)
export const getPostBasicInfo = async (postId: string) => {
  try {
    const post = await getDocument<Post>('posts', postId);
    
    if (!post) {
      throw new Error('게시글을 찾을 수 없습니다.');
    }
    
    // 익명이 아닌 경우 항상 최신 사용자 정보로 업데이트 (실시간 프로필 변경 반영)
    if (!post.authorInfo?.isAnonymous && post.authorId) {
      try {
        const userDoc = await getDocument('users', post.authorId);
        if (userDoc && (userDoc as any).profile) {
          post.authorInfo = {
            ...post.authorInfo,
            displayName: (userDoc as any).profile.userName || '사용자',
            profileImageUrl: (userDoc as any).profile.profileImageUrl || '',
            isAnonymous: false
          };
        } else {
          // 사용자 문서가 존재하지 않는 경우 (계정 삭제됨)
          post.authorInfo = {
            ...post.authorInfo,
            displayName: '삭제된 계정',
            profileImageUrl: '',
            isAnonymous: true
          };
        }
      } catch (userError) {
        console.warn('사용자 정보 업데이트 실패 (계정 삭제 가능성):', userError);
        // 사용자를 찾을 수 없는 경우 삭제된 계정으로 처리
        post.authorInfo = {
          ...post.authorInfo,
          displayName: '삭제된 계정',
          profileImageUrl: '',
          isAnonymous: true
        };
      }
    }
    
    // 게시글 Timestamp 직렬화 - serializeObject 사용
    const serializedPost = serializeObject(post as any, ['createdAt', 'updatedAt', 'deletedAt']);
    
    return serializedPost;
  } catch (error) {
    console.error('게시글 기본 정보 가져오기 오류:', error);
    throw new Error('게시글 정보를 가져오는 중 오류가 발생했습니다.');
  }
};

// 게시글 상세 정보 가져오기 (조회수 증가 없이)
export const getPostDetail = async (postId: string) => {
  try {
    const post = await getDocument<Post>('posts', postId);
    
    if (!post) {
      throw new Error('게시글을 찾을 수 없습니다.');
    }
    
    console.log('=== getPostDetail 디버깅 ===');
    console.log('게시글 ID:', postId);
    console.log('작성자 ID:', post.authorId);
    console.log('기존 authorInfo:', post.authorInfo);
    
    // authorInfo가 없거나 profileImageUrl이 없는 경우 사용자 정보 업데이트
    if (!post.authorInfo?.profileImageUrl && !post.authorInfo?.isAnonymous && post.authorId) {
      console.log('사용자 정보 업데이트 시도...');
      try {
        const userDoc = await getDocument('users', post.authorId);
        console.log('사용자 문서:', userDoc);
        if (userDoc && (userDoc as any).profile) {
          post.authorInfo = {
            ...post.authorInfo,
            displayName: post.authorInfo?.displayName || (userDoc as any).profile.userName || '사용자',
            profileImageUrl: (userDoc as any).profile.profileImageUrl || '',
            isAnonymous: post.authorInfo?.isAnonymous || false
          };
          console.log('업데이트된 authorInfo:', post.authorInfo);
        } else {
          // 사용자 문서가 존재하지 않는 경우 (계정 삭제됨)
          post.authorInfo = {
            ...post.authorInfo,
            displayName: '삭제된 계정',
            profileImageUrl: '',
            isAnonymous: true
          };
          console.log('삭제된 계정으로 처리:', post.authorInfo);
        }
      } catch (userError) {
        console.warn('사용자 정보 업데이트 실패 (계정 삭제 가능성):', userError);
        // 사용자를 찾을 수 없는 경우 삭제된 계정으로 처리
        post.authorInfo = {
          ...post.authorInfo,
          displayName: '삭제된 계정',
          profileImageUrl: '',
          isAnonymous: true
        };
      }
    } else {
      console.log('사용자 정보 업데이트 건너뜀 - 이유:', {
        hasProfileImage: !!post.authorInfo?.profileImageUrl,
        isAnonymous: !!post.authorInfo?.isAnonymous,
        hasAuthorId: !!post.authorId
      });
    }
    
    // 게시글 Timestamp 직렬화 - serializeObject 사용
    const serializedPost = serializeObject(post as any, ['createdAt', 'updatedAt', 'deletedAt']);
    
    // 댓글 가져오기 (이미 직렬화됨)
    const comments = await getCommentsByPost(postId);
    
    return { post: serializedPost, comments };
  } catch (error) {
    console.error('게시글 상세 정보 가져오기 오류:', error);
    throw new Error('게시글 정보를 가져오는 중 오류가 발생했습니다.');
  }
};

// post 문서만 가져오기 (generateMetadata와 page()가 공유하는 얇은 캐시용)
export const getPostDocument = async (postId: string): Promise<Post | null> => {
  return getDocument<Post>('posts', postId);
};

// 최적화된 게시글 상세 정보 가져오기 (메타데이터용, 댓글 제외)
export const getPostDetailOptimized = async (
  postId: string,
  includeComments = true,
  commentLimit?: number
) => {
  try {
    const post = await getDocument<Post>('posts', postId);
    
    if (!post) {
      throw new Error('게시글을 찾을 수 없습니다.');
    }

    // post 조회 완료 후 user 조회와 comments 조회를 병렬로 실행
    const needsUserFetch = !post.authorInfo?.profileImageUrl && !post.authorInfo?.isAnonymous && !!post.authorId;
    const [userDoc, allComments] = await Promise.all([
      needsUserFetch ? getDocument('users', post.authorId!) : Promise.resolve(null),
      includeComments ? getCommentsByPost(postId) : Promise.resolve([]),
    ]);

    // authorInfo 처리
    if (needsUserFetch) {
      try {
        if (userDoc && (userDoc as any).profile) {
          post.authorInfo = {
            ...post.authorInfo,
            displayName: post.authorInfo?.displayName || (userDoc as any).profile.userName || '사용자',
            profileImageUrl: (userDoc as any).profile.profileImageUrl || '',
            isAnonymous: post.authorInfo?.isAnonymous || false
          };
        } else {
          post.authorInfo = {
            ...post.authorInfo,
            displayName: '삭제된 계정',
            profileImageUrl: '',
            isAnonymous: true
          };
        }
      } catch (userError) {
        console.warn('사용자 정보 업데이트 실패:', userError);
        post.authorInfo = {
          ...post.authorInfo,
          displayName: '삭제된 계정',
          profileImageUrl: '',
          isAnonymous: true
        };
      }
    }
    
    const serializedPost = serializeObject(post as any, ['createdAt', 'updatedAt', 'deletedAt']);

    // commentLimit이 있으면 초기 N개만 반환하고 hasMoreComments 플래그 포함
    if (commentLimit !== undefined && allComments.length > commentLimit) {
      return {
        post: serializedPost,
        comments: allComments.slice(0, commentLimit),
        hasMoreComments: true,
        totalCommentCount: allComments.length,
      };
    }
    
    return { post: serializedPost, comments: allComments, hasMoreComments: false, totalCommentCount: allComments.length };
  } catch (error) {
    console.error('최적화된 게시글 정보 가져오기 오류:', error);
    throw new Error('게시글 정보를 가져오는 중 오류가 발생했습니다.');
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

// 게시글에 달린 댓글 가져오기 (최적화된 버전 - N+1 쿼리 문제 해결)
export const getCommentsByPost = async (postId: string) => {
  try {
    // 서브컬렉션과 최상위 컬렉션을 병렬로 조회
    const commentsRef = collection(db, 'posts', postId, 'comments');
    const subCollectionQuery = query(commentsRef, orderBy('createdAt', 'asc'));
    
    const topLevelCommentsRef = collection(db, 'comments');
    const topLevelQuery = query(topLevelCommentsRef, where('postId', '==', postId));

    const [subCollectionSnapshot, topLevelSnapshot] = await Promise.all([
      getDocs(subCollectionQuery),
      getDocs(topLevelQuery),
    ]);
    
    const allComments: any[] = [];
    const allReplies: any[] = [];
    const comments: any[] = [];
    
    // 서브컬렉션 댓글 처리
    for (const commentDoc of subCollectionSnapshot.docs) {
      const commentData = commentDoc.data();
      const comment = { id: commentDoc.id, ...commentData } as any;
      
      // 삭제된 댓글이지만 대댓글이 없는 경우 건너뛰기
      if (comment.status.isDeleted && comment.content !== '삭제된 댓글입니다.') {
        continue;
      }
      
      if (comment.parentId === null || comment.parentId === undefined) {
        // 부모 댓글
        allComments.push(comment);
      } else {
        // 대댓글
        allReplies.push({ ...comment, parentCommentId: comment.parentId });
      }
    }
    
    // 최상위 컬렉션 댓글 처리 (AI 댓글)
    for (const commentDoc of topLevelSnapshot.docs) {
      const commentData = commentDoc.data();
      const comment = { id: commentDoc.id, ...commentData } as any;
      
      // 삭제된 댓글 건너뛰기
      if (comment.status?.isDeleted === true) {
        continue;
      }
      
      // AI 댓글은 대부분 부모 댓글
      if (comment.parentCommentId === null || comment.parentCommentId === undefined) {
        allComments.push(comment);
      } else {
        allReplies.push(comment);
      }
    }
    
    // 모든 고유한 사용자 ID 수집 (익명이 아닌 경우만)
    const userIds = new Set<string>();
    
    [...allComments, ...allReplies].forEach(item => {
      if (!item.isAnonymous && item.authorId && !item.status?.isDeleted) {
        userIds.add(item.authorId);
      }
    });
    
    // 사용자 정보를 한 번에 가져오기
    const userDataMap = new Map<string, any>();
    if (userIds.size > 0) {
      try {
        // Firestore는 'in' 쿼리에서 최대 10개까지만 지원하므로 배치로 처리
        const userIdArray = Array.from(userIds);
        const batchSize = 10;
        
        for (let i = 0; i < userIdArray.length; i += batchSize) {
          const batch = userIdArray.slice(i, i + batchSize);
          const usersQuery = query(
            collection(db, 'users'),
            where('__name__', 'in', batch)
          );
          
          const usersSnapshot = await getDocs(usersQuery);
          usersSnapshot.docs.forEach(userDoc => {
            const userData = userDoc.data();
            if (userData && userData.profile) {
              userDataMap.set(userDoc.id, {
                displayName: userData.profile.userName || '사용자',
                profileImageUrl: userData.profile.profileImageUrl || '',
                isAnonymous: false
              });
            }
          });
        }
      } catch (error) {
        console.error('사용자 정보 일괄 조회 오류:', error);
      }
    }
    
    // 댓글별로 처리
    for (const comment of allComments) {
      // 댓글 작성자 정보 설정
      let authorInfo = {
        displayName: '사용자',
        profileImageUrl: '',
        isAnonymous: comment.isAnonymous
      };
      
      if (comment.isAnonymous || !comment.authorId) {
        if (comment.anonymousAuthor?.nickname) {
          authorInfo.displayName = comment.anonymousAuthor.nickname;
        } else {
          authorInfo.displayName = '익명';
        }
        authorInfo.isAnonymous = true;
      } else if (!comment.status.isDeleted) {
        const userData = userDataMap.get(comment.authorId);
        if (userData) {
          authorInfo = userData;
        } else {
          // 사용자를 찾을 수 없는 경우 삭제된 계정으로 처리
          authorInfo = {
            displayName: '삭제된 계정',
            profileImageUrl: '',
            isAnonymous: true
          };
        }
      }
      
      // 해당 댓글의 대댓글들 찾기
      const replies = allReplies
        .filter(reply => reply.parentCommentId === comment.id)
        .map(reply => {
          // 대댓글 작성자 정보 설정
          let replyAuthorInfo = {
            displayName: '사용자',
            profileImageUrl: '',
            isAnonymous: reply.isAnonymous
          };
          
          if (reply.isAnonymous || !reply.authorId) {
            if (reply.anonymousAuthor?.nickname) {
              replyAuthorInfo.displayName = reply.anonymousAuthor.nickname;
            } else {
              replyAuthorInfo.displayName = '익명';
            }
            replyAuthorInfo.isAnonymous = true;
          } else if (!reply.status.isDeleted) {
            const userData = userDataMap.get(reply.authorId);
            if (userData) {
              replyAuthorInfo = userData;
            } else {
              replyAuthorInfo = {
                displayName: '삭제된 계정',
                profileImageUrl: '',
                isAnonymous: true
              };
            }
          }
          
          const serializedReply = serializeObject(reply, ['createdAt', 'updatedAt', 'deletedAt']) as any;
          return {
            ...serializedReply,
            author: replyAuthorInfo,
          };
        });
      
      // 대댓글 시간순 정렬
      replies.sort((a, b) => a.createdAt - b.createdAt);
      
      const serializedComment = serializeObject(comment, ['createdAt', 'updatedAt', 'deletedAt']) as any;
      comments.push({
        ...serializedComment,
        author: authorInfo,
        replies,
      });
    }
    
    // 모든 댓글을 시간순으로 정렬
    comments.sort((a: any, b: any) => a.createdAt - b.createdAt);
    
    return comments;
  } catch (error) {
    console.error('댓글 조회 오류:', error);
    throw new Error('댓글을 불러오는 중 오류가 발생했습니다.');
  }
};

// 게시글 작성하기
export const createPost = async (boardCode: string, boardType: BoardType, data: PostFormData, userId: string) => {
  try {
    // 사용자 정보 가져오기
    const userDoc = await getDocument('users', userId);
    
    if (!userDoc) {
      throw new Error('사용자 정보를 찾을 수 없습니다.');
    }
    
    // 게시판 정보 가져오기
    const boardDoc = await getDocument('boards', boardCode) as Board | null;
    const boardName = boardDoc?.name || boardCode;
    
    // 게시글 데이터 생성
    const postData: Partial<Post> = {
      title: data.title,
      content: data.content,
      authorId: userId,
      boardCode: boardCode,
      boardName: boardName,
      type: boardType,
      attachments: [],
      tags: data.tags || [],
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
      authorInfo: {
        displayName: data.isAnonymous ? '익명' : (userDoc as any).profile?.userName || '사용자',
        profileImageUrl: data.isAnonymous ? '' : (userDoc as any).profile?.profileImageUrl || '',
        isAnonymous: data.isAnonymous
      }
    };
    
    // 학교 또는 지역 정보 설정
    if (boardType === 'school' && (userDoc as any).school?.id) {
      postData.schoolId = (userDoc as any).school.id;
    } else if (boardType === 'regional' && (userDoc as any).regions) {
      postData.regions = {
        sido: (userDoc as any).regions.sido,
        sigungu: (userDoc as any).regions.sigungu
      };
    }
    
    // 투표 정보 설정
    if (data.poll && data.poll.question && data.poll.options.length > 1) {
      postData.poll = {
        isActive: true,
        question: data.poll.question,
        options: data.poll.options.map((option, index) => ({
          text: option.text,
          imageUrl: option.imageUrl,
          voteCount: 0,
          index
        })),
        expiresAt: data.poll.expiresAt ? data.poll.expiresAt.getTime() : undefined,
        multipleChoice: data.poll.multipleChoice
      };
    }
    
    // 게시글 저장
    const postId = await addDocument('posts', postData);
    
    // 게시판 게시글 수 증가
    await updateDocument('boards', boardCode, {
      'stats.postCount': increment(1)
    });
    
    // 사용자 게시글 수 증가
    await updateDocument('users', userId, {
      'stats.postCount': increment(1)
    });

    // 경험치 부여 로직 제거 - 프론트엔드에서 처리
    
    return postId;
  } catch (error) {
    console.error('게시글 작성 오류:', error);
    throw new Error('게시글을 작성하는 중 오류가 발생했습니다.');
  }
};

// 게시글 좋아요 토글
export const togglePostLike = async (postId: string, userId: string) => {
  try {
    // 게시글 정보 가져오기 (작성자 ID 필요)
    const postRef = doc(db, 'posts', postId);
    const postDoc = await getDoc(postRef);
    
    if (!postDoc.exists()) {
      throw new Error('게시글을 찾을 수 없습니다.');
    }
    
    const postData = postDoc.data() as Post;
    const postAuthorId = postData.authorId;
    
    // 좋아요 중복 체크
    const likeRef = doc(db, 'posts', postId, 'likes', userId);
    const likeDoc = await getDoc(likeRef);
    const batch = writeBatch(db);
    
    let isLiked = false;
    
    if (likeDoc.exists()) {
      // 좋아요 취소
      batch.delete(likeRef);
      // 게시글 좋아요 수 감소
      batch.update(doc(db, 'posts', postId), {
        'stats.likeCount': increment(-1)
      });
    } else {
      // 좋아요 추가
      batch.set(likeRef, {
        createdAt: serverTimestamp()
      });
      // 게시글 좋아요 수 증가
      batch.update(doc(db, 'posts', postId), {
        'stats.likeCount': increment(1)
      });
      isLiked = true;
    }
    
    await batch.commit();

    // 좋아요 추가 시에만 경험치 지급 (좋아요 취소는 경험치 지급하지 않음)
    if (isLiked) {
      try {
        const expResult = await awardExperience(userId, 'like');
        if (expResult.success && expResult.leveledUp) {
          console.log(`🎉 레벨업! ${expResult.oldLevel} → ${expResult.newLevel} (좋아요)`);
        }
      } catch (expError) {
        console.error('좋아요 경험치 지급 오류:', expError);
        // 경험치 지급 실패는 좋아요 자체를 실패로 처리하지 않음
      }
      
      // 🆕 퀘스트 트래킹: 좋아요 받기 (작성자에게)
      if (postAuthorId && postAuthorId !== userId) {
        try {
          const { trackQuestAction } = await import('@/lib/quests/questService');
          await trackQuestAction(postAuthorId, 'get_likes');
          console.log('✅ 퀘스트 트래킹: 좋아요 받기 (게시글 작성자)');
        } catch (questError) {
          console.error('❌ 퀘스트 트래킹 오류:', questError);
        }
      }
    }
    
    return isLiked;
  } catch (error) {
    console.error('좋아요 토글 오류:', error);
    throw new Error('좋아요 처리 중 오류가 발생했습니다.');
  }
};

// 댓글 작성하기
export const createComment = async (postId: string, content: string, userId: string, isAnonymous: boolean, parentId?: string) => {
  try {
    // 사용자 정보 가져오기
    const userDoc = await getDocument('users', userId);
    
    if (!userDoc) {
      throw new Error('사용자 정보를 찾을 수 없습니다.');
    }
    
    // 댓글 데이터 생성
    const commentData = {
      postId,
      content,
      authorId: userId,
      isAnonymous,
      parentId: parentId || null,
      stats: {
        likeCount: 0
      },
      status: {
        isDeleted: false,
        isBlocked: false
      }
    };
    
    // 댓글 저장
    const commentRef = collection(db, 'posts', postId, 'comments');
    const commentDoc = await addDoc(commentRef, {
      ...commentData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // 게시글 댓글 수 업데이트
    await updateDocument('posts', postId, {
      'stats.commentCount': increment(1)
    });
    
    // 사용자 댓글 수 업데이트
    await updateDocument('users', userId, {
      'stats.commentCount': increment(1)
    });

    // 알림 발송 로직
    try {
      // 게시글 정보 조회
      const postDoc = await getDocument('posts', postId) as any;
      
      if (postDoc && postDoc.authorId !== userId) {
        // 대댓글인 경우
        if (parentId) {
          // 부모 댓글 작성자에게 알림
          const parentCommentDoc = await getDoc(doc(db, 'posts', postId, 'comments', parentId));
          
          if (parentCommentDoc.exists()) {
            const parentCommentData = parentCommentDoc.data();
            const parentAuthorId = parentCommentData?.authorId;
            
            // 부모 댓글 작성자가 자기 자신이 아닌 경우 알림 발송
            if (parentAuthorId && parentAuthorId !== userId) {
              await createCommentReplyNotification(
                parentAuthorId,
                postId,
                postDoc.title || '제목 없음',
                parentId,
                isAnonymous ? '익명' : (userDoc as any).displayName || '사용자',
                content,
                commentDoc.id,
                isAnonymous
              );
            }
          }
        } else {
          // 일반 댓글인 경우 - 게시글 작성자에게 알림
          await createPostCommentNotification(
            postDoc.authorId,
            userId,
            postId,
            commentDoc.id,
            postDoc.title || '제목 없음',
            content,
            isAnonymous
          );
        }
      }
    } catch (notificationError) {
      // 알림 발송 실패는 댓글 작성을 방해하지 않음
      console.error('알림 발송 실패:', notificationError);
    }

    // 경험치 부여 로직 제거 - 프론트엔드에서 처리
    
    return commentDoc.id;
  } catch (error) {
    console.error('댓글 작성 오류:', error);
    throw new Error('댓글을 작성하는 중 오류가 발생했습니다.');
  }
};

// 게시판 즐겨찾기 토글
export const toggleBoardFavorite = async (boardCode: string, boardType: BoardType, userId: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('사용자 정보를 찾을 수 없습니다.');
    }
    
    const userData = userDoc.data();
    const favorites = (userData as any).favorites?.boards || {};
    const boardCodes = favorites[boardType] || [];
    
    let isFavorite = false;
    
    if (boardCodes.includes(boardCode)) {
      // 즐겨찾기 해제
      await updateDoc(userRef, {
        [`favorites.boards.${boardType}`]: arrayRemove(boardCode)
      });
    } else {
      // 즐겨찾기 추가
      await updateDoc(userRef, {
        [`favorites.boards.${boardType}`]: arrayUnion(boardCode)
      });
      isFavorite = true;
    }
    
    return isFavorite;
  } catch (error) {
    console.error('게시판 즐겨찾기 토글 오류:', error);
    throw new Error('즐겨찾기 처리 중 오류가 발생했습니다.');
  }
}; 

// 댓글 수정하기
export const updateComment = async (postId: string, commentId: string, content: string, userId: string) => {
  try {
    const commentRef = doc(db, 'posts', postId, 'comments', commentId);
    const commentDoc = await getDoc(commentRef);
    
    if (!commentDoc.exists()) {
      throw new Error('댓글을 찾을 수 없습니다.');
    }
    
    const commentData = commentDoc.data();
    
    // 권한 체크 (작성자만 수정 가능)
    if (commentData.authorId !== userId) {
      throw new Error('댓글을 수정할 권한이 없습니다.');
    }
    
    await updateDoc(commentRef, {
      content,
      updatedAt: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error('댓글 수정 오류:', error);
    throw new Error('댓글을 수정하는 중 오류가 발생했습니다.');
  }
};

// 대댓글 존재 여부 확인
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

// 댓글 삭제하기
export const deleteComment = async (postId: string, commentId: string, userId: string): Promise<{ hasReplies: boolean }> => {
  try {
    const commentRef = doc(db, 'posts', postId, 'comments', commentId);
    const commentDoc = await getDoc(commentRef);
    
    if (!commentDoc.exists()) {
      throw new Error('댓글을 찾을 수 없습니다.');
    }
    
    const commentData = commentDoc.data();
    
    // 권한 체크 (작성자만 삭제 가능)
    if (commentData.authorId !== userId) {
      throw new Error('댓글을 삭제할 권한이 없습니다.');
    }
    
    // 대댓글 존재 여부 확인
    const hasRepliesExist = await hasReplies(postId, commentId);
    
    if (hasRepliesExist) {
      // 대댓글이 있는 경우: 소프트 삭제 (내용만 변경, 카운트는 유지)
      await updateDoc(commentRef, {
        content: '삭제된 댓글입니다.',
        status: {
          ...commentData.status,
          isDeleted: true
        },
        updatedAt: serverTimestamp()
      });
      // 대댓글이 있는 경우 카운트는 감소시키지 않음
    } else {
      // 대댓글이 없는 경우: 완전 삭제 및 카운트 감소
      await deleteDoc(commentRef);
      
      // 게시글 댓글 수 감소 (대댓글이 없는 경우에만)
      await updateDocument('posts', postId, {
        'stats.commentCount': increment(-1)
      });
      
      // 사용자 댓글 수 감소 (대댓글이 없는 경우에만)
      await updateDocument('users', userId, {
        'stats.commentCount': increment(-1)
      });
    }
    
    return { hasReplies: hasRepliesExist };
  } catch (error) {
    console.error('댓글 삭제 오류:', error);
    throw new Error('댓글을 삭제하는 중 오류가 발생했습니다.');
  }
};

// 댓글 좋아요 토글
export const toggleCommentLike = async (postId: string, commentId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> => {
  try {
    // 좋아요 상태 확인
    const likeRef = doc(db, 'posts', postId, 'comments', commentId, 'likes', userId);
    const likeDoc = await getDoc(likeRef);
    const commentRef = doc(db, 'posts', postId, 'comments', commentId);
    const commentDoc = await getDoc(commentRef);
    
    if (!commentDoc.exists()) {
      throw new Error('댓글을 찾을 수 없습니다.');
    }
    
    const commentData = commentDoc.data();
    const currentLikeCount = commentData.stats?.likeCount || 0;
    const commentAuthorId = commentData.authorId; // 댓글 작성자 ID
    
    const batch = writeBatch(db);
    let isLiked = false;
    let newLikeCount = currentLikeCount;
    
    if (likeDoc.exists()) {
      // 좋아요 취소
      batch.delete(likeRef);
      newLikeCount = Math.max(0, currentLikeCount - 1);
      batch.update(commentRef, {
        'stats.likeCount': newLikeCount,
        updatedAt: serverTimestamp()
      });
    } else {
      // 좋아요 추가
      batch.set(likeRef, {
        userId,
        commentId,
        postId,
        createdAt: serverTimestamp()
      });
      newLikeCount = currentLikeCount + 1;
      batch.update(commentRef, {
        'stats.likeCount': newLikeCount,
        updatedAt: serverTimestamp()
      });
      isLiked = true;
    }
    
    await batch.commit();
    
    // 좋아요 추가 시에만 경험치 지급
    if (isLiked) {
      try {
                 const { awardExperience } = await import('../experience');
        const expResult = await awardExperience(userId, 'like');
        if (expResult.success && expResult.leveledUp) {
          console.log(`🎉 레벨업! ${expResult.oldLevel} → ${expResult.newLevel} (댓글 좋아요)`);
        }
      } catch (expError) {
        console.error('댓글 좋아요 경험치 지급 오류:', expError);
        // 경험치 지급 실패는 좋아요 자체를 실패로 처리하지 않음
      }
      
      // 🆕 퀘스트 트래킹: 좋아요 받기 (댓글 작성자에게)
      if (commentAuthorId && commentAuthorId !== userId) {
        try {
          const { trackQuestAction } = await import('@/lib/quests/questService');
          await trackQuestAction(commentAuthorId, 'get_likes');
          console.log('✅ 퀘스트 트래킹: 좋아요 받기 (댓글 작성자)');
        } catch (questError) {
          console.error('❌ 퀘스트 트래킹 오류:', questError);
        }
      }
    }
    
    return {
      liked: isLiked,
      likeCount: newLikeCount
    };
  } catch (error) {
    console.error('댓글 좋아요 토글 오류:', error);
    throw new Error('댓글 좋아요 처리 중 오류가 발생했습니다.');
  }
};

// 댓글 좋아요 상태 확인
export const checkCommentLikeStatus = async (postId: string, commentId: string, userId: string): Promise<boolean> => {
  try {
    if (!userId) return false;
    
    const likeRef = doc(db, 'posts', postId, 'comments', commentId, 'likes', userId);
    const likeDoc = await getDoc(likeRef);
    
    return likeDoc.exists();
  } catch (error) {
    console.error('댓글 좋아요 상태 확인 오류:', error);
    return false;
  }
};

// 여러 댓글의 좋아요 상태를 한번에 확인
export const checkMultipleCommentLikeStatus = async (postId: string, commentIds: string[], userId: string): Promise<Record<string, boolean>> => {
  try {
    if (!userId || commentIds.length === 0) {
      return {};
    }
    
    const likeStatuses: Record<string, boolean> = {};
    
    // 각 댓글의 좋아요 상태를 병렬로 확인
    const promises = commentIds.map(async (commentId) => {
      const likeRef = doc(db, 'posts', postId, 'comments', commentId, 'likes', userId);
      const likeDoc = await getDoc(likeRef);
      return { commentId, liked: likeDoc.exists() };
    });
    
    const results = await Promise.all(promises);
    
    results.forEach(({ commentId, liked }) => {
      likeStatuses[commentId] = liked;
    });
    
    return likeStatuses;
  } catch (error) {
    console.error('여러 댓글 좋아요 상태 확인 오류:', error);
    return {};
  }
};

// 댓글 신고하기 함수는 제거됨 - 통합 신고 시스템 사용 (reports.ts)

// 특정 게시판의 게시글 목록 가져오기 (커뮤니티 페이지용)
export const getPostsByBoardType = async (
  boardType: BoardType,
  boardCode: string,
  pageSize = 20,
  schoolId?: string,
  regions?: { sido: string; sigungu: string }
) => {
  try {
    const whereConstraints = [
      where('type', '==', boardType),
      where('boardCode', '==', boardCode),
      where('status.isDeleted', '==', false),
      where('status.isHidden', '==', false)
    ];
    
    // 학교 커뮤니티인 경우 schoolId 필터링 추가
    if (boardType === 'school' && schoolId) {
      whereConstraints.push(where('schoolId', '==', schoolId));
    }
    
    // 지역 커뮤니티인 경우 지역 필터링 추가
    if (boardType === 'regional' && regions?.sido && regions?.sigungu) {
      whereConstraints.push(where('regions.sido', '==', regions.sido));
      whereConstraints.push(where('regions.sigungu', '==', regions.sigungu));
    }
    
    // 전체 constraints 배열 구성
    const allConstraints = [
      ...whereConstraints,
      orderBy('status.isPinned', 'desc'),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    ];
    
    const posts = await getDocuments<Post>('posts', allConstraints);
    
    // 프로필 이미지 정보 업데이트
    if (posts && posts.length > 0) {
      return await updatePostsAuthorInfo(posts);
    }
    
    return posts;
  } catch (error) {
    console.error('게시글 목록 가져오기 오류:', error);
    throw new Error('게시글 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

// 모든 게시판의 게시글 가져오기 (커뮤니티 페이지용)
export const getAllPostsByType = async (
  boardType: BoardType,
  pageSize = 50
) => {
  try {
    const constraints = [
      where('type', '==', boardType),
      where('status.isDeleted', '==', false),
      where('status.isHidden', '==', false),
      orderBy('status.isPinned', 'desc'),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    ];
    
    const posts = await getDocuments<Post>('posts', constraints);
    
    // 프로필 이미지 정보 업데이트
    if (posts && posts.length > 0) {
      return await updatePostsAuthorInfo(posts);
    }
    
    return posts;
  } catch (error) {
    console.error('전체 게시글 목록 가져오기 오류:', error);
    throw new Error('게시글 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

// 페이지네이션과 함께 모든 게시판의 게시글 가져오기 (커뮤니티 페이지용)
export const getAllPostsByTypeWithPagination = async (
  boardType: BoardType,
  page = 1,
  pageSize = 10,
  sortBy: 'latest' | 'popular' | 'views' | 'comments' = 'latest'
) => {
  try {
    let constraints = [
      where('type', '==', boardType),
      where('status.isDeleted', '==', false),
      where('status.isHidden', '==', false),
      orderBy('status.isPinned', 'desc')
    ];

    // 정렬 조건 추가
    switch (sortBy) {
      case 'popular':
        constraints.push(orderBy('stats.likeCount', 'desc'));
        break;
      case 'views':
        constraints.push(orderBy('stats.viewCount', 'desc'));
        break;
      case 'comments':
        constraints.push(orderBy('stats.commentCount', 'desc'));
        break;
      default:
        constraints.push(orderBy('createdAt', 'desc'));
    }
    
    const result = await getPaginatedDocumentsWithCount<Post>('posts', constraints, pageSize, page);
    
    // 프로필 이미지 정보 업데이트
    if (result.items && result.items.length > 0) {
      result.items = await updatePostsAuthorInfo(result.items);
    }
    
    return result;
  } catch (error) {
    console.error('페이지네이션 전체 게시글 목록 가져오기 오류:', error);
    throw new Error('게시글 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

// 학교별 게시글 가져오기 (유저의 메인 학교 기준)
export const getAllPostsBySchool = async (
  schoolId: string,
  pageSize = 50
) => {
  try {
    const constraints = [
      where('type', '==', 'school'),
      where('schoolId', '==', schoolId),
      where('status.isDeleted', '==', false),
      where('status.isHidden', '==', false),
      orderBy('status.isPinned', 'desc'),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    ];
    
    const posts = await getDocuments<Post>('posts', constraints);
    
    // 프로필 이미지 정보 업데이트
    if (posts && posts.length > 0) {
      return await updatePostsAuthorInfo(posts);
    }
    
    return posts;
  } catch (error) {
    console.error('학교별 게시글 목록 가져오기 오류:', error);
    throw new Error('학교별 게시글 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

// 페이지네이션과 함께 학교별 게시글 가져오기
export const getAllPostsBySchoolWithPagination = async (
  schoolId: string,
  page = 1,
  pageSize = 10,
  sortBy: 'latest' | 'popular' | 'views' | 'comments' = 'latest'
) => {
  try {
    let constraints = [
      where('type', '==', 'school'),
      where('schoolId', '==', schoolId),
      where('status.isDeleted', '==', false),
      where('status.isHidden', '==', false),
      orderBy('status.isPinned', 'desc')
    ];

    // 정렬 조건 추가
    switch (sortBy) {
      case 'popular':
        constraints.push(orderBy('stats.likeCount', 'desc'));
        break;
      case 'views':
        constraints.push(orderBy('stats.viewCount', 'desc'));
        break;
      case 'comments':
        constraints.push(orderBy('stats.commentCount', 'desc'));
        break;
      default:
        constraints.push(orderBy('createdAt', 'desc'));
    }
    
    const result = await getPaginatedDocumentsWithCount<Post>('posts', constraints, pageSize, page);
    
    // 프로필 이미지 정보 업데이트
    if (result.items && result.items.length > 0) {
      result.items = await updatePostsAuthorInfo(result.items);
    }
    
    return result;
  } catch (error) {
    console.error('페이지네이션 학교별 게시글 목록 가져오기 오류:', error);
    throw new Error('학교별 게시글 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

// 지역별 게시글 가져오기 (유저의 지역 기준)
export const getAllPostsByRegion = async (
  sido: string,
  sigungu: string,
  pageSize = 50
) => {
  try {
    const constraints = [
      where('type', '==', 'regional'),
      where('regions.sido', '==', sido),
      where('regions.sigungu', '==', sigungu),
      where('status.isDeleted', '==', false),
      where('status.isHidden', '==', false),
      orderBy('status.isPinned', 'desc'),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    ];
    
    const posts = await getDocuments<Post>('posts', constraints);
    
    // 프로필 이미지 정보 업데이트
    if (posts && posts.length > 0) {
      return await updatePostsAuthorInfo(posts);
    }
    
    return posts;
  } catch (error) {
    console.error('지역별 게시글 목록 가져오기 오류:', error);
    throw new Error('지역별 게시글 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

// 페이지네이션과 함께 지역별 게시글 가져오기
export const getAllPostsByRegionWithPagination = async (
  sido: string,
  sigungu: string,
  page = 1,
  pageSize = 10,
  sortBy: 'latest' | 'popular' | 'views' | 'comments' = 'latest'
) => {
  try {
    let constraints = [
      where('type', '==', 'regional'),
      where('regions.sido', '==', sido),
      where('regions.sigungu', '==', sigungu),
      where('status.isDeleted', '==', false),
      where('status.isHidden', '==', false),
      orderBy('status.isPinned', 'desc')
    ];

    // 정렬 조건 추가
    switch (sortBy) {
      case 'popular':
        constraints.push(orderBy('stats.likeCount', 'desc'));
        break;
      case 'views':
        constraints.push(orderBy('stats.viewCount', 'desc'));
        break;
      case 'comments':
        constraints.push(orderBy('stats.commentCount', 'desc'));
        break;
      default:
        constraints.push(orderBy('createdAt', 'desc'));
    }
    
    const result = await getPaginatedDocumentsWithCount<Post>('posts', constraints, pageSize, page);
    
    // 프로필 이미지 정보 업데이트
    if (result.items && result.items.length > 0) {
      result.items = await updatePostsAuthorInfo(result.items);
    }
    
    return result;
  } catch (error) {
    console.error('페이지네이션 지역별 게시글 목록 가져오기 오류:', error);
    throw new Error('지역별 게시글 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

// 게시글 수정
export const updatePost = async (postId: string, data: PostFormData) => {
  try {
    // poll 필드를 완전히 제거하여 기존 poll 데이터 보존
    const { poll, ...dataWithoutPoll } = data;
    console.log('🔥 Original data:', JSON.stringify(data, null, 2));
    console.log('🔥 Data without poll:', JSON.stringify(dataWithoutPoll, null, 2));
    
    // 게시글 정보 가져오기
    const postDoc = await getDocument('posts', postId);
    
    if (!postDoc) {
      throw new Error('게시글을 찾을 수 없습니다.');
    }

    // 수정할 데이터 준비
    const updateData: any = {
      title: dataWithoutPoll.title,
      content: dataWithoutPoll.content,
      tags: dataWithoutPoll.tags || [],
      updatedAt: serverTimestamp(),
      'authorInfo.isAnonymous': dataWithoutPoll.isAnonymous
    };
    
    // 익명 설정에 따른 작성자 정보 업데이트
    if (dataWithoutPoll.isAnonymous) {
      updateData['authorInfo.displayName'] = '익명';
      updateData['authorInfo.profileImageUrl'] = '';
    } else {
      // 사용자 정보 다시 가져오기
      const userDoc = await getDocument('users', (postDoc as any).authorId);
      if (userDoc) {
        updateData['authorInfo.displayName'] = (userDoc as any).profile?.userName || '사용자';
        updateData['authorInfo.profileImageUrl'] = (userDoc as any).profile?.profileImageUrl || '';
      }
    }
    
    // poll 필드는 완전히 처리하지 않음 - 기존 상태 그대로 유지
    // data에서 poll 필드를 제거했으므로 poll 관련 업데이트 없음
    
    // undefined 값들을 제거하는 함수
    const removeUndefined = (obj: any): any => {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          if (value && typeof value === 'object' && !Array.isArray(value) && 
              !(value as any).toDate && typeof (value as any).delete !== 'function') {
            const cleanedNested = removeUndefined(value);
            if (Object.keys(cleanedNested).length > 0) {
              cleaned[key] = cleanedNested;
            }
          } else {
            cleaned[key] = value;
          }
        }
      }
      return cleaned;
    };
    
    // undefined 값 제거
    console.log('🔥 updateData before cleaning:', JSON.stringify(updateData, null, 2));
    // removeUndefined 함수를 일시적으로 비활성화하여 테스트
    // const cleanedUpdateData = removeUndefined(updateData);
    const cleanedUpdateData = updateData;
    console.log('🔥 cleanedUpdateData after cleaning:', JSON.stringify(cleanedUpdateData, null, 2));
    
    // poll 필드가 있다면 완전히 제거 (Firebase가 처리하지 않도록)
    if ('poll' in cleanedUpdateData) {
      delete cleanedUpdateData.poll;
      console.log('🔥 poll 필드를 제거했습니다.');
    }
    
    console.log('🔥 Final update data:', JSON.stringify(cleanedUpdateData, null, 2));
    
    // 게시글 업데이트
    await updateDocument('posts', postId, cleanedUpdateData);
    
    return postId;
  } catch (error) {
    console.error('게시글 수정 오류:', error);
    throw new Error('게시글을 수정하는 중 오류가 발생했습니다.');
  }
};

// 안전한 게시글 수정 - poll 필드를 절대 건드리지 않음
export const updatePostSafe = async (postId: string, data: {
  title: string;
  content: string;
  isAnonymous: boolean;
  tags: string[];
}) => {
  try {
    console.log('🔥🔥🔥 updatePostSafe called with:', { postId, data });
    
    // 게시글 정보 가져오기
    const postDoc = await getDocument('posts', postId);
    
    if (!postDoc) {
      throw new Error('게시글을 찾을 수 없습니다.');
    }

    // poll 필드를 포함한 기존 데이터를 완전히 보존
    const existingData = postDoc as any;
    const existingPoll = existingData.poll;
    
    console.log('🔥🔥🔥 Existing poll data:', JSON.stringify(existingPoll, null, 2));

    // 업데이트할 필드들만 명시적으로 지정
    const updateFields: Record<string, any> = {
      title: data.title,
      content: data.content,
      tags: data.tags,
      updatedAt: serverTimestamp(),
      'authorInfo.isAnonymous': data.isAnonymous
    };
    
    // 익명 설정에 따른 작성자 정보 업데이트
    if (data.isAnonymous) {
      updateFields['authorInfo.displayName'] = '익명';
      updateFields['authorInfo.profileImageUrl'] = '';
    } else {
      // 사용자 정보 다시 가져오기
      const userDoc = await getDocument('users', existingData.authorId);
      if (userDoc) {
        updateFields['authorInfo.displayName'] = (userDoc as any).profile?.userName || '사용자';
        updateFields['authorInfo.profileImageUrl'] = (userDoc as any).profile?.profileImageUrl || '';
      }
    }
    
    console.log('🔥🔥🔥 Update fields (no poll):', JSON.stringify(updateFields, null, 2));
    
    // Firestore 업데이트 - poll 필드는 절대 포함하지 않음
    const postRef = doc(db, 'posts', postId);
    
    console.log('🔥🔥🔥 About to call updateDoc with postRef:', postRef.path);
    console.log('🔥🔥🔥 updateFields contains poll?', 'poll' in updateFields);
    
    await updateDoc(postRef, updateFields);
    
    console.log('🔥🔥🔥 updateDoc completed, checking result...');
    
    // 업데이트 후 문서 상태 확인
    const updatedDoc = await getDoc(postRef);
    if (updatedDoc.exists()) {
      const updatedData = updatedDoc.data();
      console.log('🔥🔥🔥 Document after update:', JSON.stringify(updatedData.poll, null, 2));
    }
    
    console.log('🔥🔥🔥 updatePostSafe completed successfully');
    
    return postId;
  } catch (error) {
    console.error('안전한 게시글 수정 오류:', error);
    throw new Error('게시글을 수정하는 중 오류가 발생했습니다.');
  }
};

// 게시글 스크랩 토글 (이중 저장 방식)
export const togglePostScrap = async (postId: string, userId: string): Promise<{ scrapped: boolean; scrapCount: number }> => {
  try {
    // 스크랩 상태 확인
    const scrapsRef = collection(db, 'posts', postId, 'scraps');
    const q = query(scrapsRef, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    
    const postRef = doc(db, 'posts', postId);
    const userRef = doc(db, 'users', userId);
    
    const [postDoc, userDoc] = await Promise.all([
      getDoc(postRef),
      getDoc(userRef)
    ]);
    
    if (!postDoc.exists()) {
      throw new Error('존재하지 않는 게시글입니다.');
    }
    
    if (!userDoc.exists()) {
      throw new Error('존재하지 않는 사용자입니다.');
    }
    
    const postData = postDoc.data();
    const userData = userDoc.data();
    const userScraps = userData.scraps || [];
    
    // 트랜잭션으로 일관성 보장
    const batch = writeBatch(db);
    
    if (!querySnapshot.empty) {
      // 스크랩 취소
      const scrapDoc = querySnapshot.docs[0];
      batch.delete(doc(db, 'posts', postId, 'scraps', scrapDoc.id));
      
      // 게시글 스크랩 수 감소
      batch.update(postRef, {
        'stats.scrapCount': increment(-1),
        updatedAt: serverTimestamp()
      });
      
      // 사용자 스크랩 목록에서 제거
      const updatedScraps = userScraps.filter((id: string) => id !== postId);
      batch.update(userRef, {
        scraps: updatedScraps,
        updatedAt: serverTimestamp()
      });
      
      await batch.commit();
      
      return {
        scrapped: false,
        scrapCount: (postData.stats?.scrapCount || 0) - 1
      };
    } else {
      // 스크랩 추가
      const newScrapRef = doc(scrapsRef);
      batch.set(newScrapRef, {
        userId,
        postId,
        createdAt: serverTimestamp()
      });
      
      // 게시글 스크랩 수 증가
      batch.update(postRef, {
        'stats.scrapCount': increment(1),
        updatedAt: serverTimestamp()
      });
      
      // 사용자 스크랩 목록에 추가 (중복 방지)
      const updatedScraps = userScraps.includes(postId) 
        ? userScraps 
        : [...userScraps, postId];
      batch.update(userRef, {
        scraps: updatedScraps,
        updatedAt: serverTimestamp()
      });
      
      await batch.commit();
      
      return {
        scrapped: true,
        scrapCount: (postData.stats?.scrapCount || 0) + 1
      };
    }
  } catch (error) {
    console.error('북마크 토글 오류:', error);
    throw new Error('북마크 처리에 실패했습니다.');
  }
};

// 좋아요 상태 확인
export const checkLikeStatus = async (postId: string, userId: string): Promise<boolean> => {
  try {
    const likesRef = collection(db, 'posts', postId, 'likes');
    const q = query(likesRef, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    
    return !querySnapshot.empty;
  } catch (error) {
    console.error('좋아요 상태 확인 오류:', error);
    return false;
  }
};

// 스크랩 상태 확인 (users 컬렉션 기반으로 빠른 조회)
export const checkScrapStatus = async (postId: string, userId: string): Promise<boolean> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return false;
    }
    
    const userData = userDoc.data();
    const scraps = userData.scraps || [];
    return scraps.includes(postId);
  } catch (error) {
    console.error('스크랩 상태 확인 오류:', error);
    return false;
  }
};

// 스크랩된 게시글 목록 가져오기 (users 컬렉션 기반)
export const getScrappedPosts = async (userId: string, page = 1, pageSize = 20): Promise<Post[]> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return [];
    }
    
    const userData = userDoc.data();
    const scraps = userData.scraps || [];
    
    if (scraps.length === 0) {
      return [];
    }
    
    // 페이징 적용
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedScraps = scraps.slice(startIndex, endIndex);
    
    // 게시글 정보 가져오기
    const posts: Post[] = [];
    for (const postId of paginatedScraps) {
      try {
        const post = await getDocument<Post>('posts', postId);
        if (post && !post.status.isDeleted) {
          posts.push(serializeObject(post as any, ['createdAt', 'updatedAt', 'deletedAt']));
        }
      } catch (error) {
        console.error(`게시글 ${postId} 조회 실패:`, error);
      }
    }
    
    return posts;
  } catch (error) {
    console.error('스크랩된 게시글 조회 오류:', error);
    throw new Error('스크랩된 게시글을 가져오는 중 오류가 발생했습니다.');
  }
};

// 사용자가 북마크한 게시글 개수 가져오기
export const getScrappedPostsCount = async (userId: string): Promise<number> => {
  try {
    // 사용자 문서에서 스크랩 목록 가져오기
    const userDoc = await getDocument('users', userId);
    if (!userDoc) {
      return 0;
    }
    
    const userData = userDoc as User & { scraps?: string[] };
    const scraps = userData.scraps || [];
    
    if (scraps.length === 0) {
      return 0;
    }
    
    // 유효한 게시글 개수 확인
    let validCount = 0;
    for (const postId of scraps) {
      try {
        const post = await getDocument('posts', postId);
        if (post && !(post as any).status?.isDeleted) {
          validCount++;
        }
      } catch (error) {
        console.warn(`게시글 ${postId} 조회 실패:`, error);
      }
    }
    
    return validCount;
  } catch (error) {
    console.error('스크랩 개수 조회 오류:', error);
    return 0;
  }
};

// 잘못된 poll 필드 정리 함수 (개발/관리용)
export const cleanupInvalidPollFields = async (): Promise<void> => {
  try {
    // 모든 posts 문서 조회
    const postsSnapshot = await getDocs(collection(db, 'posts'));
    const batch = writeBatch(db);
    let updateCount = 0;
    
    postsSnapshot.forEach((doc) => {
      const data = doc.data();
      
      // poll._methodName이 "deleteField"인 경우 poll 필드 전체를 삭제
      if (data.poll && typeof data.poll === 'object' && data.poll._methodName === 'deleteField') {
        const docRef = doc.ref;
        batch.update(docRef, {
          poll: deleteField(),
          updatedAt: serverTimestamp()
        });
        updateCount++;
        console.log(`정리 대상 게시글: ${doc.id}`);
      }
    });
    
    if (updateCount > 0) {
      await batch.commit();
      console.log(`${updateCount}개의 게시글에서 잘못된 poll 필드를 정리했습니다.`);
    } else {
      console.log('정리할 대상이 없습니다.');
    }
  } catch (error) {
    console.error('poll 필드 정리 중 오류:', error);
    throw new Error('poll 필드 정리 중 오류가 발생했습니다.');
  }
};

// 손상된 poll 데이터 복구 함수
export const repairDamagedPoll = async (postId: string) => {
  try {
    console.log('🔧 Repairing damaged poll for post:', postId);
    
    const postRef = doc(db, 'posts', postId);
    const postDoc = await getDoc(postRef);
    
    if (!postDoc.exists()) {
      throw new Error('게시글을 찾을 수 없습니다.');
    }
    
    const data = postDoc.data();
    
    // poll 필드가 손상되었는지 확인
    if (data.poll && typeof data.poll === 'object' && data.poll._methodName === 'deleteField') {
      console.log('🔧 Found damaged poll field, removing it...');
      
      // 손상된 poll 필드 완전히 제거
      await updateDoc(postRef, {
        poll: deleteField(),
        updatedAt: serverTimestamp()
      });
      
      console.log('🔧 Damaged poll field removed successfully');
      return true;
    } else {
      console.log('🔧 Poll field is not damaged');
      return false;
    }
  } catch (error) {
    console.error('Poll 복구 오류:', error);
    throw error;
  }
};

// 빠른 모드용 게시글 상세 정보 가져오기 (최소한의 처리)
export const getPostDetailFast = async (postId: string) => {
  try {
    // 게시글과 댓글을 병렬로 가져오기
    const [post, comments] = await Promise.all([
      getDocument<Post>('posts', postId),
      getCommentsByPost(postId)
    ]);
    
    if (!post) {
      throw new Error('게시글을 찾을 수 없습니다.');
    }
    
    console.log('=== getPostDetailFast 디버깅 ===');
    console.log('게시글 ID:', postId);
    console.log('작성자 ID:', post.authorId);
    console.log('기존 authorInfo:', post.authorInfo);
    
    // authorInfo가 없거나 profileImageUrl이 없는 경우 사용자 정보 업데이트
    if (!post.authorInfo?.profileImageUrl && !post.authorInfo?.isAnonymous && post.authorId) {
      console.log('사용자 정보 업데이트 시도...');
      try {
        const userDoc = await getDocument('users', post.authorId);
        console.log('사용자 문서:', userDoc);
        if (userDoc && (userDoc as any).profile) {
          post.authorInfo = {
            ...post.authorInfo,
            displayName: post.authorInfo?.displayName || (userDoc as any).profile.userName || '사용자',
            profileImageUrl: (userDoc as any).profile.profileImageUrl || '',
            isAnonymous: post.authorInfo?.isAnonymous || false
          };
          console.log('업데이트된 authorInfo:', post.authorInfo);
        } else {
          // 사용자 문서가 존재하지 않는 경우 (계정 삭제됨)
          post.authorInfo = {
            ...post.authorInfo,
            displayName: '삭제된 계정',
            profileImageUrl: '',
            isAnonymous: true
          };
          console.log('삭제된 계정으로 처리:', post.authorInfo);
        }
      } catch (userError) {
        console.warn('사용자 정보 업데이트 실패 (계정 삭제 가능성):', userError);
        // 사용자를 찾을 수 없는 경우 삭제된 계정으로 처리
        post.authorInfo = {
          ...post.authorInfo,
          displayName: '삭제된 계정',
          profileImageUrl: '',
          isAnonymous: true
        };
      }
    } else {
      console.log('사용자 정보 업데이트 건너뜀 - 이유:', {
        hasProfileImage: !!post.authorInfo?.profileImageUrl,
        isAnonymous: !!post.authorInfo?.isAnonymous,
        hasAuthorId: !!post.authorId
      });
    }
    
    // 최소한의 authorInfo 처리 (fallback)
    if (!post.authorInfo) {
      post.authorInfo = {
        displayName: '사용자',
        profileImageUrl: '',
        isAnonymous: false
      };
    }
    
    // 빠른 직렬화 (필수 필드만)
    const serializedPost = {
      ...post,
      createdAt: post.createdAt instanceof Date ? post.createdAt : 
                 (post.createdAt as any)?.toDate ? (post.createdAt as any).toDate() : 
                 new Date(post.createdAt),
      updatedAt: post.updatedAt instanceof Date ? post.updatedAt : 
                 (post.updatedAt as any)?.toDate ? (post.updatedAt as any).toDate() : 
                 post.updatedAt ? new Date(post.updatedAt) : new Date(post.createdAt)
    };
    
    return { post: serializedPost, comments };
  } catch (error) {
    console.error('빠른 모드 게시글 정보 가져오기 오류:', error);
    throw new Error('게시글 정보를 가져오는 중 오류가 발생했습니다.');
  }
};
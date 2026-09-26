import { communityCommand } from './community-client';
import { db } from './firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  doc, 
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  limit,
  Timestamp,
  writeBatch,
  increment,
  serverTimestamp,
  runTransaction,
  startAfter,
  DocumentSnapshot
} from 'firebase/firestore';
import { Board, BoardType, Post } from '../types';
import { toTimestamp } from '../utils/timeUtils';

/**
 * 타입별 게시판 목록 가져오기
 */
export const getBoardsByType = async (type: BoardType): Promise<Board[]> => {
  try {
    const q = query(
      collection(db, 'boards'),
      where('type', '==', type),
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
        description: boardData.description,
        icon: boardData.icon,
        type: boardData.type,
        code: boardData.code,
        isActive: boardData.isActive,
        order: boardData.order,
        stats: boardData.stats || { postCount: 0 },
        accessLevel: boardData.accessLevel || { read: 'all', write: 'all' },
        settings: boardData.settings,
        createdAt: boardData.createdAt,
        updatedAt: boardData.updatedAt
      } as Board);
    });
    
    return boards;
  } catch (error) {
    console.error('게시판 목록 조회 오류:', error);
    throw new Error('게시판 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 게시판 상세 정보 가져오기
 */
export const getBoardById = async (boardId: string): Promise<Board | null> => {
  try {
    const boardRef = doc(db, 'boards', boardId);
    const boardDoc = await getDoc(boardRef);
    
    if (boardDoc.exists()) {
      const boardData = boardDoc.data();
      return {
        id: boardDoc.id,
        name: boardData.name,
        description: boardData.description,
        icon: boardData.icon,
        type: boardData.type,
        code: boardData.code,
        isActive: boardData.isActive,
        order: boardData.order,
        stats: boardData.stats || { postCount: 0 },
        accessLevel: boardData.accessLevel || { read: 'all', write: 'all' },
        settings: boardData.settings,
        createdAt: boardData.createdAt,
        updatedAt: boardData.updatedAt
      } as Board;
    } else {
      return null;
    }
  } catch (error) {
    console.error('게시판 정보 조회 오류:', error);
    throw new Error('게시판 정보를 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 게시판 코드로 게시판 찾기 (단일 함수)
 */
export const getBoard = async (code: string): Promise<Board | null> => {
  try {
    const q = query(
      collection(db, 'boards'),
      where('code', '==', code),
      where('isActive', '==', true)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const boardData = doc.data();
      
      return {
        id: doc.id,
        name: boardData.name,
        description: boardData.description,
        icon: boardData.icon,
        type: boardData.type,
        code: boardData.code,
        isActive: boardData.isActive,
        order: boardData.order,
        stats: boardData.stats || { postCount: 0 },
        accessLevel: boardData.accessLevel || { read: 'all', write: 'all' },
        settings: boardData.settings,
        categories: boardData.categories || [],
        createdAt: boardData.createdAt,
        updatedAt: boardData.updatedAt
      } as Board;
    }
    
    return null;
  } catch (error) {
    console.error('게시판 조회 오류:', error);
    throw new Error('게시판을 찾는 중 오류가 발생했습니다.');
  }
};

/**
 * 게시판 코드로 게시판 찾기
 */
export const getBoardByCode = async (code: string, type: BoardType): Promise<Board | null> => {
  try {
    const q = query(
      collection(db, 'boards'),
      where('code', '==', code),
      where('type', '==', type),
      where('isActive', '==', true)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const boardData = doc.data();
      
      return {
        id: doc.id,
        name: boardData.name,
        description: boardData.description,
        icon: boardData.icon,
        type: boardData.type,
        code: boardData.code,
        isActive: boardData.isActive,
        order: boardData.order,
        stats: boardData.stats || { postCount: 0 },
        accessLevel: boardData.accessLevel || { read: 'all', write: 'all' },
        settings: boardData.settings,
        createdAt: boardData.createdAt,
        updatedAt: boardData.updatedAt
      } as Board;
    }
    
    return null;
  } catch (error) {
    console.error('게시판 코드 조회 오류:', error);
    throw new Error('게시판을 찾는 중 오류가 발생했습니다.');
  }
};

/**
 * 기본 게시판 데이터 초기화 (관리자용)
 */
export const initializeDefaultBoards = async (): Promise<void> => {
  try {
    const defaultBoards = [
      // 학교 게시판
      {
        name: '자유게시판',
        description: '자유롭게 이야기해요',
        icon: '💬',
        type: 'school',
        code: 'free',
        isActive: true,
        order: 1,
        stats: { postCount: 0 },
        accessLevel: { read: 'all', write: 'all' },
        settings: { allowAnonymous: true, allowAttachment: true, maxAttachmentSize: 10 },
        createdAt: serverTimestamp()
      },
      {
        name: '질문/답변',
        description: '궁금한 것들을 물어보세요',
        icon: '❓',
        type: 'school',
        code: 'qa',
        isActive: true,
        order: 2,
        stats: { postCount: 0 },
        accessLevel: { read: 'all', write: 'all' },
        settings: { allowAnonymous: true, allowAttachment: true, maxAttachmentSize: 10 },
        createdAt: serverTimestamp()
      },
      {
        name: '정보공유',
        description: '유용한 정보를 나눠요',
        icon: '📢',
        type: 'school',
        code: 'info',
        isActive: true,
        order: 3,
        stats: { postCount: 0 },
        accessLevel: { read: 'all', write: 'all' },
        settings: { allowAnonymous: false, allowAttachment: true, maxAttachmentSize: 10 },
        createdAt: serverTimestamp()
      },
      {
        name: '동아리',
        description: '동아리 활동 이야기',
        icon: '🎭',
        type: 'school',
        code: 'club',
        isActive: true,
        order: 4,
        stats: { postCount: 0 },
        accessLevel: { read: 'all', write: 'all' },
        settings: { allowAnonymous: false, allowAttachment: true, maxAttachmentSize: 10 },
        createdAt: serverTimestamp()
      },
      
      // 지역 게시판
      {
        name: '맛집추천',
        description: '우리 동네 맛집을 소개해요',
        icon: '🍕',
        type: 'regional',
        code: 'restaurant',
        isActive: true,
        order: 1,
        stats: { postCount: 0 },
        accessLevel: { read: 'all', write: 'all' },
        settings: { allowAnonymous: false, allowAttachment: true, maxAttachmentSize: 10 },
        createdAt: serverTimestamp()
      },
      {
        name: '학원정보',
        description: '학원 정보를 공유해요',
        icon: '📚',
        type: 'regional',
        code: 'academy',
        isActive: true,
        order: 2,
        stats: { postCount: 0 },
        accessLevel: { read: 'all', write: 'all' },
        settings: { allowAnonymous: false, allowAttachment: true, maxAttachmentSize: 10 },
        createdAt: serverTimestamp()
      },
      {
        name: '동네소식',
        description: '우리 동네 소식을 알려요',
        icon: '🏠',
        type: 'regional',
        code: 'local',
        isActive: true,
        order: 3,
        stats: { postCount: 0 },
        accessLevel: { read: 'all', write: 'all' },
        settings: { allowAnonymous: false, allowAttachment: true, maxAttachmentSize: 10 },
        createdAt: serverTimestamp()
      },
      {
        name: '함께해요',
        description: '같이 할 일을 찾아요',
        icon: '🤝',
        type: 'regional',
        code: 'together',
        isActive: true,
        order: 4,
        stats: { postCount: 0 },
        accessLevel: { read: 'all', write: 'all' },
        settings: { allowAnonymous: false, allowAttachment: true, maxAttachmentSize: 10 },
        createdAt: serverTimestamp()
      },
      
      // 전국 게시판
      {
        name: '입시정보',
        description: '입시 관련 정보를 나눠요',
        icon: '🎓',
        type: 'national',
        code: 'exam',
        isActive: true,
        order: 1,
        stats: { postCount: 0 },
        accessLevel: { read: 'all', write: 'all' },
        settings: { allowAnonymous: false, allowAttachment: true, maxAttachmentSize: 10 },
        createdAt: serverTimestamp()
      },
      {
        name: '진로상담',
        description: '진로에 대해 상담해요',
        icon: '💼',
        type: 'national',
        code: 'career',
        isActive: true,
        order: 2,
        stats: { postCount: 0 },
        accessLevel: { read: 'all', write: 'all' },
        settings: { allowAnonymous: true, allowAttachment: true, maxAttachmentSize: 10 },
        createdAt: serverTimestamp()
      },
      {
        name: '대학생활',
        description: '대학생활 경험을 공유해요',
        icon: '🏛️',
        type: 'national',
        code: 'university',
        isActive: true,
        order: 3,
        stats: { postCount: 0 },
        accessLevel: { read: 'all', write: 'all' },
        settings: { allowAnonymous: false, allowAttachment: true, maxAttachmentSize: 10 },
        createdAt: serverTimestamp()
      },
      {
        name: '취미생활',
        description: '취미 활동을 공유해요',
        icon: '🎨',
        type: 'national',
        code: 'hobby',
        isActive: true,
        order: 4,
        stats: { postCount: 0 },
        accessLevel: { read: 'all', write: 'all' },
        settings: { allowAnonymous: false, allowAttachment: true, maxAttachmentSize: 10 },
        createdAt: serverTimestamp()
      }
    ];

    const boardsCollection = collection(db, 'boards');
    
    for (const board of defaultBoards) {
      await addDoc(boardsCollection, board);
    }
    
    console.log('기본 게시판 데이터가 성공적으로 초기화되었습니다.');
  } catch (error) {
    console.error('기본 게시판 초기화 오류:', error);
    throw new Error('기본 게시판을 초기화하는 중 오류가 발생했습니다.');
  }
};

/**
 * 관리자용 게시판 관리 API
 */

/**
 * 모든 게시판 조회 (관리자용)
 */
export const getAllBoards = async (): Promise<Board[]> => {
  try {
    // 색인 없이 전체 데이터 조회 후 클라이언트에서 정렬
    const querySnapshot = await getDocs(collection(db, 'boards'));
    const boards: Board[] = [];
    
    querySnapshot.forEach((doc) => {
      const boardData = doc.data();
      boards.push({
        id: doc.id,
        name: boardData.name,
        description: boardData.description,
        icon: boardData.icon,
        type: boardData.type,
        code: boardData.code,
        isActive: boardData.isActive,
        order: boardData.order,
        stats: boardData.stats || { postCount: 0, memberCount: 0, todayPostCount: 0 },
        accessLevel: boardData.accessLevel || { read: 'all', write: 'all' },
        settings: boardData.settings,
        createdAt: boardData.createdAt,
        updatedAt: boardData.updatedAt
      } as Board);
    });
    
    // 클라이언트에서 정렬: type -> order 순
    return boards.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }
      return (a.order || 0) - (b.order || 0);
    });
  } catch (error) {
    console.error('전체 게시판 조회 오류:', error);
    throw new Error('게시판 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 게시판 생성 (관리자용)
 */
export const createBoard = async (boardData: Omit<Board, 'id' | 'createdAt' | 'updatedAt'>): Promise<Board> => {
  try {
    const newBoardData = {
      ...boardData,
      createdAt: serverTimestamp(),
      stats: boardData.stats || { postCount: 0, memberCount: 0, todayPostCount: 0 },
    };
    
    const docRef = await addDoc(collection(db, 'boards'), newBoardData);
    
    return {
      id: docRef.id,
      ...newBoardData,
    } as Board;
  } catch (error) {
    console.error('게시판 생성 오류:', error);
    throw new Error('게시판 생성 중 오류가 발생했습니다.');
  }
};

/**
 * 게시판 수정 (관리자용)
 */
export const updateBoard = async (boardId: string, boardData: Partial<Board>): Promise<void> => {
  try {
    const boardRef = doc(db, 'boards', boardId);
    await updateDoc(boardRef, {
      ...boardData,
      updatedAt: serverTimestamp(),
    } as any);
  } catch (error) {
    console.error('게시판 수정 오류:', error);
    throw new Error('게시판 수정 중 오류가 발생했습니다.');
  }
};

/**
 * 게시판 삭제 (관리자용)
 */
export const deleteBoard = async (boardId: string): Promise<void> => {
  try {
    const boardRef = doc(db, 'boards', boardId);
    await deleteDoc(boardRef);
  } catch (error) {
    console.error('게시판 삭제 오류:', error);
    throw new Error('게시판 삭제 중 오류가 발생했습니다.');
  }
};

/**
 * 게시판 활성화/비활성화 (관리자용)
 */
export const toggleBoardStatus = async (boardId: string, isActive: boolean): Promise<void> => {
  try {
    const boardRef = doc(db, 'boards', boardId);
    await updateDoc(boardRef, {
      isActive,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('게시판 상태 변경 오류:', error);
    throw new Error('게시판 상태 변경 중 오류가 발생했습니다.');
  }
};

/**
 * 특정 게시판의 게시글 목록 가져오기 (커뮤니티 페이지용)
 */
export const getPostsByBoardType = async (
  type: BoardType,
  code: string,
  pageSize = 20,
  schoolId?: string,
  regions?: { sido: string; sigungu: string }
): Promise<Post[]> => {
  try {
    let q = query(
      collection(db, 'posts'),
      where('type', '==', type),
      where('boardCode', '==', code),
      where('status.isDeleted', '==', false),
      where('status.isHidden', '==', false)
    );
    
    // 학교 커뮤니티인 경우 schoolId 필터링 추가
    if (type === 'school' && schoolId) {
      q = query(q, where('schoolId', '==', schoolId));
    }
    
    // 지역 커뮤니티인 경우 지역 필터링 추가
    if (type === 'regional' && regions?.sido && regions?.sigungu) {
      q = query(q, where('regions.sido', '==', regions.sido));
      q = query(q, where('regions.sigungu', '==', regions.sigungu));
    }
    
    // 정렬 조건 추가
    q = query(q, orderBy('status.isPinned', 'desc'));
    q = query(q, orderBy('createdAt', 'desc'));
    q = query(q, limit(pageSize));
    
    const querySnapshot = await getDocs(q);
    const posts: Post[] = [];
    
    querySnapshot.forEach((doc) => {
      const postData = doc.data();
      posts.push({
        id: doc.id,
        title: postData.title,
        content: postData.content,
        authorId: postData.authorId,
        authorInfo: postData.authorInfo,
        boardCode: postData.boardCode || postData.code,
        type: postData.type || postData.boardType,
        category: postData.category,
        createdAt: postData.createdAt,
        updatedAt: postData.updatedAt,
        schoolId: postData.schoolId,
        regions: postData.regions,
        attachments: postData.attachments || [],
        tags: postData.tags || [],
        stats: postData.stats,
        status: postData.status,
        poll: postData.poll // poll 필드 추가
      } as Post);
    });
    
    return posts;
  } catch (error) {
    console.error('게시글 목록 가져오기 오류:', error);
    throw new Error('게시글 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 모든 게시판의 게시글 가져오기 (커뮤니티 페이지용)
 */
export const getAllPostsByType = async (
  type: BoardType,
  pageSize = 50
): Promise<Post[]> => {
  try {
    const q = query(
      collection(db, 'posts'),
      where('type', '==', type),
      where('status.isDeleted', '==', false),
      where('status.isHidden', '==', false),
      orderBy('status.isPinned', 'desc'),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );
    
    const querySnapshot = await getDocs(q);
    const posts: Post[] = [];
    
    querySnapshot.forEach((doc) => {
      const postData = doc.data();
      posts.push({
        id: doc.id,
        title: postData.title,
        content: postData.content,
        authorId: postData.authorId,
        authorInfo: postData.authorInfo,
        boardCode: postData.boardCode || postData.code,
        type: postData.type || postData.boardType,
        category: postData.category,
        createdAt: postData.createdAt,
        updatedAt: postData.updatedAt,
        schoolId: postData.schoolId,
        regions: postData.regions,
        attachments: postData.attachments || [],
        tags: postData.tags || [],
        stats: postData.stats,
        status: postData.status,
        poll: postData.poll // poll 필드 추가
      } as Post);
    });
    
    return posts.sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt));
  } catch (error) {
    console.error('전체 게시글 목록 가져오기 오류:', error);
    throw new Error('게시글 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 특정 학교의 게시글 목록 가져오기 (커뮤니티 페이지용)
 */
export const getAllPostsBySchool = async (
  schoolId: string,
  pageSize = 50
): Promise<Post[]> => {
  try {
    const q = query(
      collection(db, 'posts'),
      where('type', '==', 'school'),
      where('schoolId', '==', schoolId),
      where('status.isDeleted', '==', false),
      where('status.isHidden', '==', false),
      orderBy('status.isPinned', 'desc'),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );
    
    const querySnapshot = await getDocs(q);
    const posts: Post[] = [];
    
    querySnapshot.forEach((doc) => {
      const postData = doc.data();
      posts.push({
        id: doc.id,
        title: postData.title,
        content: postData.content,
        authorId: postData.authorId,
        authorInfo: postData.authorInfo,
        boardCode: postData.boardCode || postData.code,
        type: postData.type || postData.boardType,
        category: postData.category,
        createdAt: postData.createdAt,
        updatedAt: postData.updatedAt,
        schoolId: postData.schoolId,
        regions: postData.regions,
        attachments: postData.attachments || [],
        tags: postData.tags || [],
        stats: postData.stats,
        status: postData.status,
        poll: postData.poll // poll 필드 추가
      } as Post);
    });
    
    return posts;
  } catch (error) {
    console.error('학교 게시글 목록 가져오기 오류:', error);
    throw new Error('학교 게시글 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 특정 지역의 게시글 목록 가져오기 (커뮤니티 페이지용)
 */
export const getAllPostsByRegion = async (
  sido: string,
  sigungu: string,
  pageSize = 50
): Promise<Post[]> => {
  try {
    const q = query(
      collection(db, 'posts'),
      where('type', '==', 'regional'),
      where('regions.sido', '==', sido),
      where('regions.sigungu', '==', sigungu),
      where('status.isDeleted', '==', false),
      where('status.isHidden', '==', false),
      orderBy('status.isPinned', 'desc'),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );
    
    const querySnapshot = await getDocs(q);
    const posts: Post[] = [];
    
    querySnapshot.forEach((doc) => {
      const postData = doc.data();
      posts.push({
        id: doc.id,
        title: postData.title,
        content: postData.content,
        authorId: postData.authorId,
        authorInfo: postData.authorInfo,
        boardCode: postData.boardCode || postData.code,
        type: postData.type || postData.boardType,
        category: postData.category,
        createdAt: postData.createdAt,
        updatedAt: postData.updatedAt,
        schoolId: postData.schoolId,
        regions: postData.regions,
        attachments: postData.attachments || [],
        tags: postData.tags || [],
        stats: postData.stats,
        status: postData.status,
        poll: postData.poll // poll 필드 추가
      } as Post);
    });
    
    return posts;
  } catch (error) {
    console.error('지역 게시글 목록 가져오기 오류:', error);
    throw new Error('지역 게시글 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 페이지네이션과 서버 사이드 정렬을 지원하는 게시글 목록 가져오기
 */
type SortOption = 'latest' | 'popular' | 'views' | 'comments';

interface GetPostsWithPaginationParams {
  type: BoardType;
  boardCode?: string; // 'all'이면 전체 게시판
  pageSize?: number;
  sortBy?: SortOption;
  lastDoc?: DocumentSnapshot | null;
  schoolId?: string;
  regions?: { sido: string; sigungu: string };
}

export const getPostsWithPagination = async ({
  type,
  boardCode,
  pageSize = 30,
  sortBy = 'latest',
  lastDoc = null,
  schoolId,
  regions
}: GetPostsWithPaginationParams): Promise<{ posts: Post[], lastDoc: DocumentSnapshot | null, hasMore: boolean }> => {
  try {
    // 기본 where 조건
    let constraints: any[] = [
      where('type', '==', type),
      where('status.isDeleted', '==', false),
      where('status.isHidden', '==', false)
    ];

    // 특정 게시판인 경우
    if (boardCode && boardCode !== 'all') {
      constraints.push(where('boardCode', '==', boardCode));
    }

    // 학교 필터
    if (type === 'school' && schoolId) {
      constraints.push(where('schoolId', '==', schoolId));
    }

    // 지역 필터
    if (type === 'regional' && regions?.sido && regions?.sigungu) {
      constraints.push(where('regions.sido', '==', regions.sido));
      constraints.push(where('regions.sigungu', '==', regions.sigungu));
    }

    // 고정 게시글은 항상 먼저
    constraints.push(orderBy('status.isPinned', 'desc'));

    // 정렬 조건 (서버 사이드 정렬)
    switch (sortBy) {
      case 'popular':
        constraints.push(orderBy('stats.likeCount', 'desc'));
        constraints.push(orderBy('createdAt', 'desc')); // 동일한 좋아요 수일 때 최신순
        break;
      case 'views':
        constraints.push(orderBy('stats.viewCount', 'desc'));
        constraints.push(orderBy('createdAt', 'desc'));
        break;
      case 'comments':
        constraints.push(orderBy('stats.commentCount', 'desc'));
        constraints.push(orderBy('createdAt', 'desc'));
        break;
      case 'latest':
      default:
        constraints.push(orderBy('createdAt', 'desc'));
        break;
    }

    // 페이지네이션 커서
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    // limit 추가 (+ 1개 더 가져와서 hasMore 확인)
    constraints.push(limit(pageSize + 1));

    const q = query(collection(db, 'posts'), ...constraints);
    const querySnapshot = await getDocs(q);
    
    const posts: Post[] = [];
    let newLastDoc: DocumentSnapshot | null = null;
    let hasMore = false;

    // pageSize + 1개를 가져왔는지 확인
    if (querySnapshot.docs.length > pageSize) {
      hasMore = true;
      querySnapshot.docs.slice(0, pageSize).forEach((doc) => {
        posts.push(convertDocToPost(doc));
      });
      newLastDoc = querySnapshot.docs[pageSize - 1];
    } else {
      querySnapshot.forEach((doc) => {
        posts.push(convertDocToPost(doc));
      });
      if (querySnapshot.docs.length > 0) {
        newLastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
      }
    }

    return { posts, lastDoc: newLastDoc, hasMore };
  } catch (error) {
    console.error('페이지네이션 게시글 로드 오류:', error);
    throw new Error('게시글 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

// Document를 Post로 변환하는 헬퍼 함수
const convertDocToPost = (doc: DocumentSnapshot): Post => {
  const postData = doc.data();
  return {
    id: doc.id,
    title: postData!.title,
    content: postData!.content,
    authorId: postData!.authorId,
    authorInfo: postData!.authorInfo,
    boardCode: postData!.boardCode || postData!.code,
    type: postData!.type || postData!.boardType,
    category: postData!.category,
    createdAt: postData!.createdAt,
    updatedAt: postData!.updatedAt,
    schoolId: postData!.schoolId,
    regions: postData!.regions,
    attachments: postData!.attachments || [],
    tags: postData!.tags || [],
    stats: postData!.stats,
    status: postData!.status,
    poll: postData!.poll
  } as Post;
};

/**
 * 홈 화면용 인기 게시글 가져오기 (14일 내 조회수 기준)
 */
export const getPopularPostsForHome = async (count = 10): Promise<Post[]> => {
  try {
    // 14일 전 Timestamp 계산
    const fourteenDaysAgo = Timestamp.fromDate(new Date(Date.now() - (14 * 24 * 60 * 60 * 1000)));
    
    const q = query(
      collection(db, 'posts'),
      where('createdAt', '>=', fourteenDaysAgo),
      where('status.isDeleted', '==', false),
      where('status.isHidden', '==', false),
      where('type', '==', 'national'), // 전국 커뮤니티만
      orderBy('createdAt', 'desc'), // 최신순으로 정렬
      limit(count * 3) // 더 많은 게시글을 가져와서 클라이언트에서 필터링
    );
    
    const querySnapshot = await getDocs(q);
    const posts: Post[] = [];
    
    // 게시판 정보를 캐시할 맵
    const boardsMap = new Map<string, Board>();
    
    querySnapshot.forEach((doc) => {
      const postData = doc.data();
      posts.push({
        id: doc.id,
        title: postData.title,
        content: postData.content,
        authorId: postData.authorId,
        authorInfo: postData.authorInfo,
        boardCode: postData.boardCode || postData.code,
        type: postData.type || postData.boardType,
        category: postData.category,
        createdAt: postData.createdAt,
        updatedAt: postData.updatedAt,
        schoolId: postData.schoolId,
        regions: postData.regions,
        attachments: postData.attachments || [],
        tags: postData.tags || [],
        stats: postData.stats,
        status: postData.status,
        poll: postData.poll // poll 필드 추가
      } as Post);
    });
    
    // 게시판 정보 가져오기
    for (const post of posts) {
      if (post.boardCode && !boardsMap.has(post.boardCode)) {
        try {
          const board = await getBoardByCode(post.boardCode, 'national');
          if (board) {
            boardsMap.set(post.boardCode, board);
          }
        } catch (error) {
          console.warn(`게시판 정보 조회 실패: ${post.boardCode}`, error);
        }
      }
    }
    
    // HTML을 텍스트로 변환하면서 줄바꿈 보존하는 함수
    const parseContentWithLineBreaks = (content: string): string => {
      if (!content) return '';
      
      return content
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<p[^>]*>/gi, '')
        .replace(/<\/div>/gi, '\n')
        .replace(/<div[^>]*>/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .trim();
    };

    // 조회수 기준으로 정렬하고 상위 게시글만 선택 (클라이언트 사이드)
    const sortedPosts = posts
      .sort((a, b) => (b.stats?.viewCount || 0) - (a.stats?.viewCount || 0))
      .slice(0, count)
      .map(post => ({
        ...post,
        boardName: boardsMap.get(post.boardCode)?.name || post.boardCode,
        previewContent: parseContentWithLineBreaks(post.content).slice(0, 100) || ''
      }));
    
    return sortedPosts;
  } catch (error) {
    console.error('홈 화면 인기 게시글 가져오기 오류:', error);
    throw new Error('인기 게시글을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 게시글 작성 파라미터 타입
 */
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
  tags?: string[];
  isAnonymous?: boolean;
}

/**
 * 게시글 작성
 */
export const createPost = async (userId: string, params: CreatePostParams): Promise<Post> => {
  const result = await communityCommand('post.create', { ...params, boardCode: params.code }, userId);
  const snapshot = await getDoc(doc(db, 'posts', result.id));
  return { ...snapshot.data(), id: snapshot.id } as Post;
};

/**
 * 댓글 좋아요 토글
 */
export const toggleCommentLike = async (
  postId: string,
  commentId: string,
  userId: string
): Promise<{ liked: boolean; likeCount: number }> => {
  return communityCommand('comment.like', { postId, commentId }, userId);
};

/**
 * 댓글 좋아요 상태 확인
 */
export const checkCommentLikeStatus = async (
  postId: string,
  commentId: string,
  userId: string
): Promise<boolean> => {
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

/**
 * 여러 댓글의 좋아요 상태를 한번에 확인
 */
export const checkMultipleCommentLikeStatus = async (
  postId: string,
  commentIds: string[],
  userId: string
): Promise<Record<string, boolean>> => {
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

/**
 * 게시글 스크랩 토글 (이중 저장 방식)
 */
export const togglePostScrap = async (postId: string, userId: string): Promise<{ scrapped: boolean; scrapCount: number }> => {
  return communityCommand('post.scrap', { postId }, userId);
};

/**
 * 스크랩 상태 확인 (users 컬렉션 기반으로 빠른 조회)
 */
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

/**
 * 사용자가 스크랩한 게시글 목록 가져오기 (users 컬렉션 기반)
 */
export const getScrappedPosts = async (userId: string): Promise<Post[]> => {
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
    
    // 게시글 정보 가져오기
    const posts: Post[] = [];
    for (const postId of scraps) {
      try {
        const postRef = doc(db, 'posts', postId);
        const postDoc = await getDoc(postRef);
        
        if (postDoc.exists()) {
          const postData = postDoc.data();
          if (!postData.status?.isDeleted) {
            posts.push({
              id: postDoc.id,
              ...postData
            } as Post);
          }
        }
      } catch (error) {
        console.warn(`게시글 ${postId} 조회 실패:`, error);
      }
    }
    
    // 최신순으로 정렬 (createdAt 기준)
    return posts.sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt));
  } catch (error) {
    console.error('스크랩 목록 조회 오류:', error);
    throw new Error('스크랩 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자가 북마크한 게시글 개수 가져오기
 */
export const getScrappedPostsCount = async (userId: string): Promise<number> => {
  try {
    // 사용자 문서에서 스크랩 목록 가져오기
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return 0;
    }
    
    const userData = userDoc.data();
    const scraps = userData.scraps || [];
    
    return scraps.length;
  } catch (error) {
    console.error('스크랩 개수 조회 오류:', error);
    return 0;
  }
}; 

// 댓글 작성하기
export const createComment = async (
  postId: string,
  content: string,
  userId: string,
  isAnonymous: boolean,
  parentId?: string
) => {
  const result = await communityCommand('comment.create', { postId, content, isAnonymous, parentId }, userId);
  return result.id as string;
}; 

// 4자리 비밀번호를 해시화합니다. (React Native용)
// 웹과 호환성을 위해 동일한 해시 알고리즘 사용
const hashPassword = async (password: string): Promise<string> => {
  const data = password + 'inschoolz_salt'; // 간단한 솔트 추가
  return simpleHash(data);
};

// 간단한 해시 함수 (웹과 앱 호환)
const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32비트 정수로 변환
  }
  return Math.abs(hash).toString(16);
};

// 비밀번호를 검증합니다.
const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  const hashedInput = await hashPassword(password);
  return hashedInput === hash;
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

// 익명 댓글의 비밀번호를 검증합니다.
export const verifyAnonymousCommentPassword = async (
  postId: string,
  commentId: string,
  password: string
): Promise<boolean> => {
  try {
    const commentDoc = await getDoc(doc(db, 'posts', postId, 'comments', commentId));
    
    if (!commentDoc.exists()) {
      return false;
    }

    const comment = commentDoc.data();
    
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

// 익명 댓글을 수정합니다.
export const updateAnonymousComment = async (
  postId: string,
  commentId: string,
  content: string,
  password: string
): Promise<void> => {
  try {
    // 비밀번호 검증
    const isValidPassword = await verifyAnonymousCommentPassword(postId, commentId, password);
    
    if (!isValidPassword) {
      throw new Error('비밀번호가 일치하지 않습니다.');
    }

    // 댓글 수정
    const commentRef = doc(db, 'posts', postId, 'comments', commentId);
    await updateDoc(commentRef, {
      content,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('익명 댓글 수정 실패:', error);
    throw error;
  }
};

// 대댓글 존재 여부 확인 함수
const hasReplies = async (postId: string, commentId: string): Promise<boolean> => {
  try {
    const repliesQuery = query(
      collection(db, 'posts', postId, 'comments'),
      where('parentId', '==', commentId)
    );
    const repliesSnapshot = await getDocs(repliesQuery);
    return !repliesSnapshot.empty;
  } catch (error) {
    console.error('대댓글 확인 오류:', error);
    return false;
  }
};

// 익명 댓글을 삭제합니다.
export const deleteAnonymousComment = async (
  postId: string,
  commentId: string,
  password: string
): Promise<{ hasReplies: boolean }> => {
  try {
    // 비밀번호 검증
    const isValidPassword = await verifyAnonymousCommentPassword(postId, commentId, password);
    
    if (!isValidPassword) {
      throw new Error('비밀번호가 일치하지 않습니다.');
    }

    // 대댓글 존재 여부 확인
    const hasRepliesExist = await hasReplies(postId, commentId);

    // 트랜잭션으로 댓글 삭제 및 게시글 댓글 수 감소
    await runTransaction(db, async (transaction) => {
      const commentRef = doc(db, 'posts', postId, 'comments', commentId);
      const postRef = doc(db, 'posts', postId);
      
      if (hasRepliesExist) {
        // 대댓글이 있는 경우: 소프트 삭제 (내용만 변경, 카운트는 유지)
        transaction.update(commentRef, {
          content: '삭제된 댓글입니다.',
          'status.isDeleted': true,
          deletedAt: serverTimestamp(),
        });
        // 대댓글이 있는 경우 카운트는 감소시키지 않음
      } else {
        // 대댓글이 없는 경우: 소프트 삭제 및 카운트 감소
        transaction.update(commentRef, {
          'status.isDeleted': true,
          content: '삭제된 댓글입니다.',
          deletedAt: serverTimestamp(),
        });
        
        // 게시글의 댓글 수 감소 (대댓글이 없는 경우에만)
        transaction.update(postRef, {
          'stats.commentCount': increment(-1),
        });
      }
    });

    return { hasReplies: hasRepliesExist };
  } catch (error) {
    console.error('익명 댓글 삭제 실패:', error);
    throw error;
  }
}; 

/**
 * 일반 댓글 삭제
 */
export const deleteComment = async (
  postId: string,
  commentId: string,
  userId: string
): Promise<{ hasReplies: boolean }> => {
  return communityCommand('comment.delete', { postId, commentId }, userId);
};
/** Edit a member comment through the authenticated server. */
export const updateComment = async (postId: string, commentId: string, content: string, userId: string): Promise<void> => {
  await communityCommand('comment.update', { postId, commentId, content }, userId);
};

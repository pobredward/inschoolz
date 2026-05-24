import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  addDoc,
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  increment,
  getCountFromServer,
  Timestamp,
  FieldValue,
  QueryConstraint,
  collectionGroup
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { User, Post, Comment, FirebaseTimestamp } from '@/types';
import { EnhancedAdminUserListParams, AdminActionLog, SuspensionSettings } from '@/types/admin';
import { getBoardsByType } from '@/lib/api/boards';
import { generatePreviewContent } from '@/lib/utils';
import { getSchoolById } from '@/lib/api/schools';
import { toTimestamp } from '@/lib/utils';

// UserRelationship 타입 정의  
interface UserRelationship {
  id: string;
  userId: string;
  targetId: string;
  type: 'friend' | 'follow' | 'block';
  status: 'pending' | 'accepted' | 'blocked' | 'active';
  createdAt: FirebaseTimestamp;
  updatedAt?: FirebaseTimestamp;
}

// Post 데이터 타입 정의
interface PostData {
  boardCode?: string;
  type?: 'national' | 'regional' | 'school';
  schoolId?: string;
  content?: string;
  regions?: {
    sido: string;
    sigungu: string;
  };
  [key: string]: unknown;
}

// 확장된 Post 타입
interface ExtendedPost extends Omit<Post, 'boardName' | 'boardCode' | 'type'> {
  boardName: string;
  schoolName?: string;
  previewContent?: string;
  type: 'national' | 'regional' | 'school';
  boardCode: string;
  schoolId?: string;
  regions?: {
    sido: string;
    sigungu: string;
  };
}

/**
 * 사용자 정보 조회
 */
export const getUserById = async (userId: string): Promise<User | null> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      return { 
        ...userDoc.data(),
        uid: userDoc.id
      } as User;
    } else {
      return null;
    }
  } catch (error) {
    console.error('사용자 정보 조회 오류:', error);
    throw new Error('사용자 정보를 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * userName으로 사용자 정보 조회
 */
export const getUserByUserName = async (userName: string): Promise<User | null> => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('profile.userName', '==', userName),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      return { 
        ...userDoc.data(),
        uid: userDoc.id
      } as User;
    } else {
      return null;
    }
  } catch (error) {
    console.error('사용자 정보 조회 오류:', error);
    throw new Error('사용자 정보를 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자 작성 게시글 조회
 */
export const getUserPosts = async (
  userId: string, 
  page = 1, 
  pageSize = 10,
  sortBy: 'latest' | 'popular' = 'latest'
): Promise<{ posts: Post[], totalCount: number, hasMore: boolean }> => {
  try {
    if (!userId) {
      return {
        posts: [],
        totalCount: 0,
        hasMore: false
      };
    }

    const postsRef = collection(db, 'posts');
    let q;
    
    if (sortBy === 'latest') {
      q = query(
        postsRef,
        where('authorId', '==', userId),
        where('status.isDeleted', '==', false),
        orderBy('createdAt', 'desc'),
        limit(pageSize + 1) // hasMore 판단을 위해 1개 더 가져옴
      );
    } else {
      q = query(
        postsRef,
        where('authorId', '==', userId),
        where('status.isDeleted', '==', false),
        orderBy('stats.likeCount', 'desc'),
        limit(pageSize + 1) // hasMore 판단을 위해 1개 더 가져옴
      );
    }
    
    const querySnapshot = await getDocs(q);
    const posts: ExtendedPost[] = [];
    
    // 게시판 정보 캐시
    const boardCache: { [key: string]: string } = {};
    // 학교 정보 캐시
    const schoolCache: { [key: string]: { name: string } } = {};
    
    // hasMore 판단
    const hasMore = querySnapshot.docs.length > pageSize;
    
    // 실제로는 pageSize만큼만 처리
    const docsToProcess = querySnapshot.docs.slice(0, pageSize);
    
    // 게시글 정보 처리
    for (const doc of docsToProcess) {
      const postData = doc.data() as PostData; // PostData 타입 사용
      let boardName = (postData as Record<string, unknown>).boardName as string || '알 수 없는 게시판';
      let schoolName = undefined;
      
      // postData에 boardName이 없는 경우에만 게시판 정보 조회 (캐싱 사용)
      if (!postData.boardName && postData.boardCode && postData.type) {
        const cacheKey = `${postData.type}-${postData.boardCode}`;
        
        if (boardCache[cacheKey]) {
          boardName = boardCache[cacheKey];
        } else {
          try {
            const boards = await getBoardsByType(postData.type as 'national' | 'regional' | 'school');
            const board = boards.find(b => b.code === postData.boardCode);
            boardName = board?.name || `게시판 (${postData.boardCode})`;
            boardCache[cacheKey] = boardName;
          } catch (error) {
            console.error('게시판 정보 조회 실패:', error);
            boardName = postData.boardCode || '알 수 없는 게시판';
          }
        }
      }
      
      // 학교 정보 조회 (캐싱 사용)
      if (postData.type === 'school' && postData.schoolId) {
        if (schoolCache[postData.schoolId]) {
          schoolName = schoolCache[postData.schoolId].name;
        } else {
          try {
            const school = await getSchoolById(postData.schoolId);
            schoolName = school?.name || '알 수 없는 학교';
            schoolCache[postData.schoolId] = { name: schoolName };
          } catch (error) {
            console.error('학교 정보 조회 실패:', error);
            schoolName = '알 수 없는 학교';
          }
        }
      }
      
      // 미리보기 내용 생성
      const previewContent = generatePreviewContent(postData.content || '');
      
      posts.push({
        id: doc.id,
        ...postData,
        boardName,
        schoolName,
        previewContent,
        regions: postData.regions,
        type: postData.type,
        boardCode: postData.boardCode,
        schoolId: postData.schoolId
      } as ExtendedPost);
    }
    
    return {
      posts: posts,
      totalCount: 0, // totalCount는 비용이 많이 들므로 제공하지 않음
      hasMore: hasMore
    };
  } catch (error) {
    console.error('사용자 게시글 조회 오류:', error);
    throw new Error('사용자 게시글을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자 작성 댓글 조회 (Collection Group Query 사용)
 */
export const getUserComments = async (
  userId: string,
  page = 1,
  pageSize = 10
): Promise<{ comments: Comment[], totalCount: number, hasMore: boolean }> => {
  try {
    if (!userId) {
      return {
        comments: [],
        totalCount: 0,
        hasMore: false
      };
    }
    
    // Collection Group Query를 사용하여 모든 posts의 comments 하위 컬렉션을 한 번에 조회
    const commentsQuery = query(
      collectionGroup(db, 'comments'),
      where('authorId', '==', userId),
      where('status.isDeleted', '==', false),
      orderBy('createdAt', 'desc'),
      limit(pageSize + 1) // hasMore 판단을 위해 1개 더 가져옴
    );
    
    const commentsSnapshot = await getDocs(commentsQuery);
    
    // hasMore 판단
    const hasMore = commentsSnapshot.docs.length > pageSize;
    const comments = commentsSnapshot.docs.slice(0, pageSize);
    
    // 게시글 정보 캐시 (중복 조회 방지)
    const postCache: { [key: string]: any } = {};
    
    const processedComments: Comment[] = [];
    
    for (const commentDoc of comments) {
      const commentData = commentDoc.data();
      const postId = commentDoc.ref.parent.parent?.id;
      
      if (!postId) continue;
      
      // 게시글 정보 가져오기 (캐시 사용)
      let postData = postCache[postId];
      if (!postData) {
        try {
          const postRef = doc(db, 'posts', postId);
          const postDoc = await getDoc(postRef);
          if (postDoc.exists()) {
            postData = postDoc.data();
            postCache[postId] = postData;
          } else {
            postData = null;
          }
        } catch (error) {
          console.error('게시글 정보 조회 실패:', error);
          postData = null;
        }
      }
      
      // 게시판 이름 가져오기
      let boardName = postData?.boardName || '게시판';
      if (!postData?.boardName && postData?.boardCode) {
        try {
          const boardRef = doc(db, 'boards', postData.boardCode);
          const boardDoc = await getDoc(boardRef);
          if (boardDoc.exists()) {
            boardName = boardDoc.data()?.name || postData.boardCode;
          }
        } catch (error) {
          console.error('게시판 정보 조회 실패:', error);
        }
      }
      
      processedComments.push({ 
        id: commentDoc.id, 
        ...commentData,
        postId: postId,
        postData: postData ? {
          title: postData.title || '제목 없음',
          type: postData.type,
          boardCode: postData.boardCode,
          boardName: boardName,
          schoolId: postData.schoolId,
          regions: postData.regions
        } : {
          title: '삭제된 게시글',
          type: 'national' as const,
          boardCode: '',
          boardName: '게시판'
        }
      } as Comment & { 
        postData: {
          title?: string;
          type?: 'national' | 'regional' | 'school';
          boardCode?: string;
          boardName?: string;
          schoolId?: string;
          regions?: {
            sido: string;
            sigungu: string;
          };
        }
      });
    }
    
    // Timestamp 직렬화
    const serializedComments = processedComments.map(comment => ({
      ...comment,
      createdAt: toTimestamp(comment.createdAt),
      updatedAt: comment.updatedAt ? toTimestamp(comment.updatedAt) : undefined,
    }));
    
    return {
      comments: serializedComments,
      totalCount: 0, // totalCount는 비용이 많이 들므로 제공하지 않음
      hasMore: hasMore
    };
  } catch (error) {
    console.error('사용자 댓글 조회 오류:', error);
    throw new Error('사용자 댓글을 가져오는 중 오류가 발생했습니다.');
  }
};



/**
 * 팔로우 상태 확인
 */
export const checkFollowStatus = async (
  userId: string,
  targetId: string
): Promise<boolean> => {
  try {
    const relationshipsRef = collection(db, 'userRelationships');
    const q = query(
      relationshipsRef,
      where('userId', '==', userId),
      where('targetId', '==', targetId),
      where('type', '==', 'follow'),
      where('status', '==', 'active')
    );
    
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('팔로우 상태 확인 오류:', error);
    throw new Error('팔로우 상태를 확인하는 중 오류가 발생했습니다.');
  }
};

/**
 * 팔로워 수 조회 (나를 팔로우하는 사용자)
 */
export const getFollowersCount = async (userId: string): Promise<number> => {
  try {
    const relationshipsRef = collection(db, 'userRelationships');
    const q = query(
      relationshipsRef,
      where('targetId', '==', userId),
      where('type', '==', 'follow'),
      where('status', '==', 'active')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error('팔로워 수 조회 오류:', error);
    throw new Error('팔로워 수를 조회하는 중 오류가 발생했습니다.');
  }
};

/**
 * 팔로잉 수 조회 (내가 팔로우하는 사용자)
 */
export const getFollowingCount = async (userId: string): Promise<number> => {
  try {
    const relationshipsRef = collection(db, 'userRelationships');
    const q = query(
      relationshipsRef,
      where('userId', '==', userId),
      where('type', '==', 'follow'),
      where('status', '==', 'active')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error('팔로잉 수 조회 오류:', error);
    throw new Error('팔로잉 수를 조회하는 중 오류가 발생했습니다.');
  }
};

/**
 * 팔로워 목록 조회 (나를 팔로우하는 사용자)
 */
export const getFollowers = async (
  userId: string,
  page = 1,
  pageSize = 20
): Promise<{ users: User[], totalCount: number, hasMore: boolean }> => {
  try {
    const relationshipsRef = collection(db, 'userRelationships');
    const q = query(
      relationshipsRef,
      where('targetId', '==', userId),
      where('type', '==', 'follow'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(pageSize * page)
    );
    
    const querySnapshot = await getDocs(q);
    const relationships = querySnapshot.docs.map(doc => doc.data() as UserRelationship);
    
    // 팔로워 사용자 정보 조회
    const users: User[] = [];
    for (const relationship of relationships) {
      const user = await getUserById(relationship.userId);
      if (user) {
        users.push(user);
      }
    }
    
    // 전체 팔로워 수 조회
    const totalCount = await getFollowersCount(userId);
    
    // 페이징 처리
    const startIndex = (page - 1) * pageSize;
    const paginatedUsers = users.slice(startIndex, startIndex + pageSize);
    
    return {
      users: paginatedUsers,
      totalCount,
      hasMore: totalCount > page * pageSize
    };
  } catch (error) {
    console.error('팔로워 목록 조회 오류:', error);
    throw new Error('팔로워 목록을 조회하는 중 오류가 발생했습니다.');
  }
};

/**
 * 팔로잉 목록 조회 (내가 팔로우하는 사용자)
 */
export const getFollowings = async (
  userId: string,
  page = 1,
  pageSize = 20
): Promise<{ users: User[], totalCount: number, hasMore: boolean }> => {
  try {
    const relationshipsRef = collection(db, 'userRelationships');
    const q = query(
      relationshipsRef,
      where('userId', '==', userId),
      where('type', '==', 'follow'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(pageSize * page)
    );
    
    const querySnapshot = await getDocs(q);
    const relationships = querySnapshot.docs.map(doc => doc.data() as UserRelationship);
    
    // 팔로잉 사용자 정보 조회
    const users: User[] = [];
    for (const relationship of relationships) {
      const user = await getUserById(relationship.targetId);
      if (user) {
        users.push(user);
      }
    }
    
    // 전체 팔로잉 수 조회
    const totalCount = await getFollowingCount(userId);
    
    // 페이징 처리
    const startIndex = (page - 1) * pageSize;
    const paginatedUsers = users.slice(startIndex, startIndex + pageSize);
    
    return {
      users: paginatedUsers,
      totalCount,
      hasMore: totalCount > page * pageSize
    };
  } catch (error) {
    console.error('팔로잉 목록 조회 오류:', error);
    throw new Error('팔로잉 목록을 조회하는 중 오류가 발생했습니다.');
  }
};

/**
 * 팔로우/언팔로우 토글
 */
export const toggleFollow = async (
  userId: string,
  targetId: string
): Promise<{ isFollowing: boolean }> => {
  try {
    // 자기 자신을 팔로우할 수 없음
    if (userId === targetId) {
      throw new Error('자기 자신을 팔로우할 수 없습니다.');
    }
    
    // 대상 사용자 존재 여부 확인
    const targetUser = await getUserById(targetId);
    if (!targetUser) {
      throw new Error('존재하지 않는 사용자입니다.');
    }
    
    // 현재 팔로우 상태 확인
    const relationshipsRef = collection(db, 'userRelationships');
    const q = query(
      relationshipsRef,
      where('userId', '==', userId),
      where('targetId', '==', targetId),
      where('type', '==', 'follow')
    );
    
    const querySnapshot = await getDocs(q);
    
    // 팔로우 관계가 존재하면 상태 변경 또는 제거
    if (!querySnapshot.empty) {
      const relationshipDoc = querySnapshot.docs[0];
      const relationship = relationshipDoc.data() as UserRelationship;
      
      if (relationship.status === 'active') {
        // 활성 상태면 비활성화 (언팔로우)
        await updateDoc(doc(db, 'userRelationships', relationshipDoc.id), {
          status: 'inactive',
          updatedAt: serverTimestamp()
        });
        return { isFollowing: false };
      } else {
        // 비활성 상태면 활성화 (다시 팔로우)
        await updateDoc(doc(db, 'userRelationships', relationshipDoc.id), {
          status: 'active',
          updatedAt: serverTimestamp()
        });
        return { isFollowing: true };
      }
    } else {
      // 팔로우 관계가 없으면 새로 생성
      const newRelationship: UserRelationship = {
        id: '',
        userId,
        targetId,
        type: 'follow',
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const relationshipRef = await addDoc(relationshipsRef, newRelationship);
      
      // ID 업데이트
      await updateDoc(relationshipRef, {
        id: relationshipRef.id
      });
      
      return { isFollowing: true };
    }
  } catch (error) {
    console.error('팔로우 토글 오류:', error);
    throw new Error('팔로우 상태를 변경하는 중 오류가 발생했습니다.');
  }
};

/**
 * 차단 상태 확인
 */
export const checkBlockStatus = async (
  userId: string,
  targetId: string
): Promise<boolean> => {
  try {
    const relationshipsRef = collection(db, 'userRelationships');
    const q = query(
      relationshipsRef,
      where('userId', '==', userId),
      where('targetId', '==', targetId),
      where('type', '==', 'block'),
      where('status', '==', 'active')
    );
    
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('차단 상태 확인 오류:', error);
    throw new Error('차단 상태를 확인하는 중 오류가 발생했습니다.');
  }
};

/**
 * 차단/차단해제 토글
 */
export const toggleBlock = async (
  userId: string,
  targetId: string
): Promise<{ isBlocked: boolean }> => {
  try {
    // 자기 자신을 차단할 수 없음
    if (userId === targetId) {
      throw new Error('자기 자신을 차단할 수 없습니다.');
    }
    
    // 대상 사용자 존재 여부 확인
    const targetUser = await getUserById(targetId);
    if (!targetUser) {
      throw new Error('존재하지 않는 사용자입니다.');
    }
    
    // 현재 차단 상태 확인
    const relationshipsRef = collection(db, 'userRelationships');
    const q = query(
      relationshipsRef,
      where('userId', '==', userId),
      where('targetId', '==', targetId),
      where('type', '==', 'block')
    );
    
    const querySnapshot = await getDocs(q);
    
    // 차단 관계가 존재하면 상태 변경 또는 제거
    if (!querySnapshot.empty) {
      const relationshipDoc = querySnapshot.docs[0];
      const relationship = relationshipDoc.data() as UserRelationship;
      
      if (relationship.status === 'active') {
        // 활성 상태면 비활성화 (차단 해제)
        await updateDoc(doc(db, 'userRelationships', relationshipDoc.id), {
          status: 'inactive',
          updatedAt: serverTimestamp()
        });
        return { isBlocked: false };
      } else {
        // 비활성 상태면 활성화 (다시 차단)
        await updateDoc(doc(db, 'userRelationships', relationshipDoc.id), {
          status: 'active',
          updatedAt: serverTimestamp()
        });
        return { isBlocked: true };
      }
    } else {
      // 차단 관계가 없으면 새로 생성
      const newRelationship: UserRelationship = {
        id: '',
        userId,
        targetId,
        type: 'block',
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const relationshipRef = await addDoc(relationshipsRef, newRelationship);
      
      // ID 업데이트
      await updateDoc(relationshipRef, {
        id: relationshipRef.id
      });
      
      // 차단하면 자동으로 팔로우 관계 비활성화
      const followQ = query(
        relationshipsRef,
        where('userId', '==', userId),
        where('targetId', '==', targetId),
        where('type', '==', 'follow'),
        where('status', '==', 'active')
      );
      
      const followSnapshot = await getDocs(followQ);
      
      if (!followSnapshot.empty) {
        const followDoc = followSnapshot.docs[0];
        await updateDoc(doc(db, 'userRelationships', followDoc.id), {
          status: 'inactive',
          updatedAt: serverTimestamp()
        });
      }
      
      return { isBlocked: true };
    }
  } catch (error) {
    console.error('차단 토글 오류:', error);
    throw new Error('차단 상태를 변경하는 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자가 차단한 사용자 목록 조회
 */
export const getBlockedUsers = async (
  userId: string,
  page = 1,
  pageSize = 20
): Promise<{ users: User[]; totalCount: number; hasMore: boolean }> => {
  try {
    const relationshipsRef = collection(db, 'userRelationships');
    const q = query(
      relationshipsRef,
      where('userId', '==', userId),
      where('type', '==', 'block'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(pageSize * page)
    );
    
    const querySnapshot = await getDocs(q);
    const relationships = querySnapshot.docs.map(doc => doc.data() as UserRelationship);
    
    // 차단된 사용자 정보 조회
    const users: User[] = [];
    for (const relationship of relationships) {
      const user = await getUserById(relationship.targetId);
      if (user) {
        users.push({
          ...user,
          // 차단 날짜 추가
          blockedAt: relationship.createdAt
        } as User & { blockedAt: FirebaseTimestamp });
      }
    }
    
    // 전체 차단 사용자 수 조회
    const countQuery = query(
      relationshipsRef,
      where('userId', '==', userId),
      where('type', '==', 'block'),
      where('status', '==', 'active')
    );
    const countSnapshot = await getDocs(countQuery);
    const totalCount = countSnapshot.size;
    
    // 페이징 처리
    const startIndex = (page - 1) * pageSize;
    const paginatedUsers = users.slice(startIndex, startIndex + pageSize);
    
    return {
      users: paginatedUsers,
      totalCount,
      hasMore: totalCount > page * pageSize
    };
  } catch (error) {
    console.error('차단된 사용자 목록 조회 오류:', error);
    throw new Error('차단된 사용자 목록을 조회하는 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자가 차단한 사용자 ID 목록만 빠르게 조회
 */
export const getBlockedUserIds = async (userId: string): Promise<string[]> => {
  try {
    const relationshipsRef = collection(db, 'userRelationships');
    const q = query(
      relationshipsRef,
      where('userId', '==', userId),
      where('type', '==', 'block'),
      where('status', '==', 'active')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data().targetId);
  } catch (error) {
    console.error('차단된 사용자 ID 목록 조회 오류:', error);
    return [];
  }
};

/**
 * 여러 사용자의 차단 상태를 한번에 확인
 */
export const checkMultipleBlockStatus = async (
  userId: string,
  targetIds: string[]
): Promise<Record<string, boolean>> => {
  try {
    if (!targetIds.length) return {};
    
    const relationshipsRef = collection(db, 'userRelationships');
    const q = query(
      relationshipsRef,
      where('userId', '==', userId),
      where('type', '==', 'block'),
      where('status', '==', 'active'),
      where('targetId', 'in', targetIds.slice(0, 10)) // Firestore 'in' 쿼리 제한
    );
    
    const querySnapshot = await getDocs(q);
    const blockStatus: Record<string, boolean> = {};
    
    // 모든 targetId를 false로 초기화
    targetIds.forEach(id => {
      blockStatus[id] = false;
    });
    
    // 차단된 사용자들을 true로 설정
    querySnapshot.docs.forEach(doc => {
      const data = doc.data() as UserRelationship;
      blockStatus[data.targetId] = true;
    });
    
    return blockStatus;
  } catch (error) {
    console.error('다중 차단 상태 확인 오류:', error);
    throw new Error('차단 상태를 확인하는 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자 활동 요약 정보 조회
 */
export const getUserActivitySummary = async (userId: string) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }

    const userData = userDoc.data() as User;
    
    // 다음 레벨까지 필요한 경험치 계산
    const calculateNextLevelXP = (currentLevel: number): number => {
      return currentLevel * 10; // 1->2레벨: 10XP, 2->3레벨: 20XP, ...
    };

    const level = userData.stats?.level || 1;
    const currentExp = userData.stats?.currentExp || 0;
    const totalExperience = userData.stats?.totalExperience || 0;
    const nextLevelXP = calculateNextLevelXP(level);
    
    return {
      level,
      currentExp,
      totalExperience,
      nextLevelXP,
      totalPosts: userData.stats?.postCount || 0,
      totalComments: userData.stats?.commentCount || 0,
      totalLikes: userData.stats?.likeCount || 0,
      totalViews: 0, // 추후 구현
      streak: userData.stats?.streak || 0
    };
  } catch (error) {
    console.error('사용자 활동 요약 조회 오류:', error);
    throw new Error('사용자 활동 요약을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 게임 기록 조회
 */
export const getUserGameStats = async (userId: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }
    
    const userData = userDoc.data() as User;
    
    // 게임 통계 정보가 없으면 빈 객체 반환
    return userData.gameStats || {};
  } catch (error) {
    console.error('게임 기록 조회 오류:', error);
    throw new Error('게임 기록을 조회하는 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자 프로필 업데이트
 */
export const updateUserProfile = async (
  userId: string,
  profileData: {
    userName?: string;
    realName?: string;
    gender?: string;
    birthYear?: string | number;
    birthMonth?: string | number;
    birthDay?: string | number;
    phoneNumber?: string;
    referrerId?: string;
    sido?: string;
    sigungu?: string;
    address?: string;
  }
): Promise<boolean> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }
    
    const updates: Record<string, FieldValue | string | number | boolean | object | null> = {};
    
    // 프로필 필드 업데이트
    if (profileData.userName) {
      updates['profile.userName'] = profileData.userName;
    }
    
    if (profileData.realName !== undefined) {
      updates['profile.realName'] = profileData.realName;
    }
    
    if (profileData.gender !== undefined) {
      updates['profile.gender'] = profileData.gender;
    }
    
    if (profileData.birthYear !== undefined) {
      updates['profile.birthYear'] = Number(profileData.birthYear) || null;
    }
    
    if (profileData.birthMonth !== undefined) {
      updates['profile.birthMonth'] = Number(profileData.birthMonth) || null;
    }
    
    if (profileData.birthDay !== undefined) {
      updates['profile.birthDay'] = Number(profileData.birthDay) || null;
    }
    
    if (profileData.phoneNumber !== undefined) {
      updates['profile.phoneNumber'] = profileData.phoneNumber;
    }
    
    // 추천인 업데이트
    if (profileData.referrerId !== undefined) {
      updates['referrerId'] = profileData.referrerId;
    }
    
    // 지역 정보 업데이트
    if (profileData.sido || profileData.sigungu || profileData.address) {
      // 지역 정보가 아직 없는 경우 초기화
      if (!userDoc.data()?.regions) {
        updates['regions'] = {
          sido: '',
          sigungu: '',
          address: ''
        };
      }
      
      if (profileData.sido !== undefined) {
        updates['regions.sido'] = profileData.sido;
      }
      
      if (profileData.sigungu !== undefined) {
        updates['regions.sigungu'] = profileData.sigungu;
      }
      
      if (profileData.address !== undefined) {
        updates['regions.address'] = profileData.address;
      }
    }
    
    // searchTokens 업데이트 (닉네임, 실명 변경 시)
    if (profileData.userName !== undefined || profileData.realName !== undefined) {
      const userData = userDoc.data();
      const currentUserName = profileData.userName || userData?.profile?.userName;
      const currentRealName = profileData.realName !== undefined ? profileData.realName : userData?.profile?.realName;
      const currentSchoolName = userData?.school?.name;
      
      // 검색 토큰 재생성
      const { generateUserSearchTokens } = await import('@/utils/search-tokens');
      const newSearchTokens = generateUserSearchTokens(
        currentUserName,
        currentRealName,
        currentSchoolName
      );
      
      updates['searchTokens'] = newSearchTokens;
    }
    
    // 변경된 필드가 있는 경우에만 업데이트
    if (Object.keys(updates).length > 0) {
      updates.updatedAt = serverTimestamp();
      await updateDoc(userRef, updates);
    }
    
    // 닉네임이 변경된 경우, 해당 사용자의 모든 게시물의 작성자 정보 업데이트
    if (profileData.userName !== undefined) {
      const userData = userDoc.data();
      const newUserName = profileData.userName;
      
      // 익명이 아닌 게시물의 작성자 정보 업데이트
      await updateUserPostsAuthorInfo(userId, newUserName, userData?.profile?.profileImageUrl);
      
      // 댓글의 작성자 정보도 업데이트 (필요시 주석 해제)
      // await updateUserCommentsAuthorInfo(userId, newUserName, userData?.profile?.profileImageUrl);
    }
    
    return true;
  } catch (error) {
    console.error('사용자 프로필 업데이트 오류:', error);
    throw new Error('프로필을 업데이트하는 중 오류가 발생했습니다.');
  }
};

/**
 * 프로필 이미지 업로드 및 업데이트
 */
export const updateProfileImage = async (
  userId: string,
  imageFile: File
): Promise<{ success: boolean; url?: string; error?: string }> => {
  try {
    if (!imageFile) {
      return { success: false, error: '이미지 파일이 제공되지 않았습니다.' };
    }

    // 파일 크기 검증 (5MB 제한)
    if (imageFile.size > 5 * 1024 * 1024) {
      return { success: false, error: '이미지 크기는 5MB 이하여야 합니다.' };
    }

    // 파일 형식 검증
    if (!imageFile.type.startsWith('image/')) {
      return { success: false, error: '이미지 파일만 업로드 가능합니다.' };
    }

    // 이전 프로필 이미지 URL 가져오기 (삭제를 위해)
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return { success: false, error: '사용자를 찾을 수 없습니다.' };
    }
    
    const userData = userDoc.data();
    const oldImageUrl = userData?.profile?.profileImageUrl;
    
    // Firebase Storage 경로 설정
    const fileExtension = imageFile.name.split('.').pop();
    const fileName = `${userId}_${Date.now()}.${fileExtension}`;
    const storageRef = ref(storage, `profile_images/${fileName}`);
    
    // 이미지 업로드
    await uploadBytes(storageRef, imageFile);
    
    // 다운로드 URL 가져오기
    const downloadUrl = await getDownloadURL(storageRef);
    
    // Firestore 업데이트
    await updateDoc(userRef, {
      'profile.profileImageUrl': downloadUrl,
      updatedAt: serverTimestamp()
    });
    
    // 이전 이미지가 있고 기본 이미지가 아니라면 삭제
    if (oldImageUrl && !oldImageUrl.includes('default-profile')) {
      try {
        // URL에서 파일 경로 추출
        const oldImagePath = decodeURIComponent(oldImageUrl.split('?')[0].split('/o/')[1]);
        const oldImageRef = ref(storage, oldImagePath);
        await deleteObject(oldImageRef);
      } catch (err) {
        console.error('이전 프로필 이미지 삭제 오류:', err);
        // 이전 이미지 삭제 실패해도 계속 진행
      }
    }
    
    return { success: true, url: downloadUrl };
  } catch (error) {
    console.error('프로필 이미지 업로드 오류:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '프로필 이미지를 업로드하는 중 오류가 발생했습니다.' 
    };
  }
}; 

/**
 * 관리자용 사용자 관리 기능들
 */

export interface AdminUserListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: 'all' | 'admin' | 'user';
  status?: 'all' | 'active' | 'inactive' | 'suspended';
  sortBy?: 'createdAt' | 'lastActiveAt' | 'totalExperience' | 'userName';
  sortOrder?: 'asc' | 'desc';
}

export interface AdminUserListResponse {
  users: User[];
  totalCount: number;
  hasMore: boolean;
  currentPage: number;
}

/**
 * 개선된 관리자용 사용자 목록 조회 (다중 필드 검색 지원)
 */
export const getEnhancedUsersList = async (params: EnhancedAdminUserListParams = {}): Promise<AdminUserListResponse> => {
  try {
    const {
      page = 1,
      pageSize = 20,
      search = '',
      searchType = 'all',
      role = 'all',
      status = 'all',
      fake = 'all',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      dateRange,
      levelRange,
      experienceRange,
      regions,
      hasWarnings
    } = params;

    const usersRef = collection(db, 'users');
    const constraints: QueryConstraint[] = [];

    // 역할 필터
    if (role !== 'all') {
      constraints.push(where('role', '==', role));
    }

    // 상태 필터
    if (status !== 'all') {
      constraints.push(where('status', '==', status));
    }

    // fake 필터 (봇 사용자만 서버에서 필터링)
    if (fake === 'fake') {
      constraints.push(where('fake', '==', true));
    } else if (fake === 'real') {
      // 실제 사용자: fake가 false이거나 존재하지 않는 경우
      // Firestore 제약으로 서버에서는 fake == false만 쿼리하고
      // fake가 없는 사용자는 클라이언트에서 추가로 가져옴
      constraints.push(where('fake', '==', false));
    }

    // 검색 조건 (다중 필드 지원)
    if (search.trim()) {
      const searchTerm = search.trim();
      
      if (searchType === 'all') {
        // 모든 필드에서 검색 (OR 조건)
        // Firestore의 제한으로 인해 클라이언트 측에서 필터링
        // 서버에서는 userName으로만 검색하고 클라이언트에서 추가 필터링
        constraints.push(where('profile.userName', '>=', searchTerm));
        constraints.push(where('profile.userName', '<=', searchTerm + '\uf8ff'));
      } else if (searchType === 'userName') {
        constraints.push(where('profile.userName', '>=', searchTerm));
        constraints.push(where('profile.userName', '<=', searchTerm + '\uf8ff'));
      } else if (searchType === 'realName') {
        constraints.push(where('profile.realName', '>=', searchTerm));
        constraints.push(where('profile.realName', '<=', searchTerm + '\uf8ff'));
      } else if (searchType === 'email') {
        constraints.push(where('email', '>=', searchTerm.toLowerCase()));
        constraints.push(where('email', '<=', searchTerm.toLowerCase() + '\uf8ff'));
      } else if (searchType === 'school') {
        constraints.push(where('school.name', '>=', searchTerm));
        constraints.push(where('school.name', '<=', searchTerm + '\uf8ff'));
      }
    }

    // 날짜 범위 필터
    if (dateRange) {
      if (dateRange.from) {
        constraints.push(where('createdAt', '>=', Timestamp.fromDate(dateRange.from)));
      }
      if (dateRange.to) {
        constraints.push(where('createdAt', '<=', Timestamp.fromDate(dateRange.to)));
      }
    }

    // 레벨 범위 필터
    if (levelRange) {
      if (levelRange.min) {
        constraints.push(where('stats.level', '>=', levelRange.min));
      }
      if (levelRange.max) {
        constraints.push(where('stats.level', '<=', levelRange.max));
      }
    }

    // 경험치 범위 필터
    if (experienceRange) {
      if (experienceRange.min) {
        constraints.push(where('stats.totalExperience', '>=', experienceRange.min));
      }
      if (experienceRange.max) {
        constraints.push(where('stats.totalExperience', '<=', experienceRange.max));
      }
    }

    // 지역 필터
    if (regions) {
      if (regions.sido) {
        constraints.push(where('regions.sido', '==', regions.sido));
      }
      if (regions.sigungu) {
        constraints.push(where('regions.sigungu', '==', regions.sigungu));
      }
    }

    // 경고 여부 필터
    if (hasWarnings !== undefined) {
      if (hasWarnings) {
        constraints.push(where('warnings.count', '>', 0));
      } else {
        constraints.push(where('warnings.count', '==', 0));
      }
    }

    // 정렬 추가 (필드 경로 매핑)
    let sortField: string = sortBy;
    if (sortBy === 'totalExperience') {
      sortField = 'stats.totalExperience';
    }
    constraints.push(orderBy(sortField, sortOrder));

    // 클라이언트 사이드 필터링이 필요한지 확인
    const needsClientFiltering = (search.trim() && searchType === 'all');
    
    // 클라이언트 필터링이 필요한 경우 더 많은 데이터를 가져옴
    const fetchLimit = needsClientFiltering ? Math.max(pageSize * 10, 200) : pageSize * 2;
    constraints.push(limit(fetchLimit));

    const q = query(usersRef, ...constraints);
    const querySnapshot = await getDocs(q);
    let allUsers: User[] = [];
    
    querySnapshot.forEach((doc) => {
      allUsers.push({ 
        uid: doc.id, 
        ...doc.data() 
      } as User);
    });

    console.log('Before filtering - Total users fetched:', allUsers.length);
    console.log('Fake filter value:', fake);
    
    // fake === 'real'인 경우 fake 필드가 없는 사용자도 추가로 가져오기
    if (fake === 'real') {
      // fake 필드가 없는 사용자들 가져오기
      const noFakeConstraints = constraints.filter(c => {
        // where('fake', '==', false) 제약조건 제거
        const constraintStr = JSON.stringify(c);
        return !constraintStr.includes('"fake"');
      });
      
      // fake 필드가 존재하지 않는 문서 찾기
      // Firestore는 필드가 없는 문서를 직접 쿼리할 수 없으므로
      // 모든 사용자를 가져와서 fake 필드 체크
      const allUsersQuery = query(usersRef, orderBy(sortField, sortOrder), limit(500));
      const allUsersSnapshot = await getDocs(allUsersQuery);
      
      allUsersSnapshot.forEach((doc) => {
        const userData = doc.data();
        // fake 필드가 없거나 명시적으로 false인 경우만
        if (userData.fake === undefined || userData.fake === null || userData.fake === false) {
          const userExists = allUsers.some(u => u.uid === doc.id);
          if (!userExists) {
            allUsers.push({ 
              uid: doc.id, 
              ...userData 
            } as User);
          }
        }
      });
      
      console.log('After adding users without fake field - Total users:', allUsers.length);
    }

    // 클라이언트 측 추가 필터링 (다중 필드 검색용)
    if (search.trim() && searchType === 'all') {
      const searchTerm = search.trim().toLowerCase();
      allUsers = allUsers.filter(user => {
        const userName = user.profile?.userName?.toLowerCase() || '';
        const realName = user.profile?.realName?.toLowerCase() || '';
        const email = user.email?.toLowerCase() || '';
        const schoolName = user.school?.name?.toLowerCase() || '';
        
        return userName.includes(searchTerm) || 
               realName.includes(searchTerm) || 
               email.includes(searchTerm) || 
               schoolName.includes(searchTerm);
      });
      console.log('After search filtering:', allUsers.length);
    }

    // fake 필터링 (클라이언트 사이드 - 실제 사용자만)
    if (fake === 'real') {
      console.log('Before fake filtering - Total users:', allUsers.length);
      console.log('Sample users before filtering:', allUsers.slice(0, 5).map(u => ({ 
        uid: u.uid, 
        userName: u.profile?.userName, 
        fake: u.fake 
      })));
      
      // fake가 true가 아닌 모든 사용자 (false, null, undefined 포함)
      allUsers = allUsers.filter(user => user.fake !== true);
      
      console.log('After fake filtering - Real users count:', allUsers.length);
      console.log('Sample real users:', allUsers.slice(0, 5).map(u => ({ 
        uid: u.uid, 
        userName: u.profile?.userName, 
        fake: u.fake 
      })));
    }

    // 페이지네이션 적용
    const offset = (page - 1) * pageSize;
    const users = allUsers.slice(offset, offset + pageSize);

    // 전체 개수 계산
    let totalCount: number;
    let hasMore: boolean;
    
    if (needsClientFiltering) {
      // 클라이언트 필터링이 적용된 경우
      totalCount = allUsers.length;
      hasMore = totalCount > page * pageSize;
      
      // 만약 가져온 데이터가 fetchLimit와 같다면, 더 많은 데이터가 있을 가능성이 있음
      if (allUsers.length === 0 && fetchLimit > pageSize) {
        // 필터링 결과가 없지만 더 많은 데이터를 확인해야 할 수도 있음
        hasMore = false;
      }
    } else {
      // 서버 쿼리만 사용한 경우, 서버에서 카운트 조회
      const countConstraints = constraints.slice(0, -2); // orderBy, limit 제거
      const countQuery = countConstraints.length > 0 
        ? query(usersRef, ...countConstraints)
        : query(usersRef);
      const countSnapshot = await getCountFromServer(countQuery);
      totalCount = countSnapshot.data().count;
      hasMore = totalCount > page * pageSize;
    }

    console.log('Final result - users:', users.length, 'totalCount:', totalCount, 'hasMore:', hasMore);

    return {
      users,
      totalCount,
      hasMore,
      currentPage: page
    };
  } catch (error) {
    console.error('개선된 사용자 목록 조회 오류:', error);
    throw new Error('사용자 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 관리자 작업 로그 기록
 */
export const logAdminAction = async (actionData: Omit<AdminActionLog, 'id' | 'timestamp'>): Promise<void> => {
  try {
    await addDoc(collection(db, 'adminActionLogs'), {
      ...actionData,
      timestamp: serverTimestamp(),
      ipAddress: await getClientIP(),
      userAgent: navigator.userAgent
    });
  } catch (error) {
    console.error('관리자 작업 로그 기록 오류:', error);
    // 로그 기록 실패는 주요 작업을 중단시키지 않음
  }
};

/**
 * 클라이언트 IP 주소 가져오기 (간단한 버전)
 */
const getClientIP = async (): Promise<string> => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch {
    return 'unknown';
  }
};

/**
 * 개선된 사용자 상태 변경 (정지 기간 지원)
 */
export const updateUserStatusEnhanced = async (
  userId: string, 
  newStatus: 'active' | 'inactive' | 'suspended', 
  settings?: SuspensionSettings,
  adminId?: string
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }

    const userData = userDoc.data() as User;
    const oldStatus = userData.status;

    const updateData: Record<string, FieldValue | string | number | boolean | object | null> = {
      status: newStatus,
      updatedAt: serverTimestamp()
    };

    if (newStatus === 'suspended' && settings) {
      updateData.suspensionReason = settings.reason;
      updateData.suspendedAt = serverTimestamp();
      
      if (settings.type === 'temporary' && settings.duration) {
        const suspendedUntil = new Date();
        suspendedUntil.setDate(suspendedUntil.getDate() + settings.duration);
        updateData.suspendedUntil = Timestamp.fromDate(suspendedUntil);
        updateData.autoRestore = settings.autoRestore;
      }
      
      updateData.notifyUser = settings.notifyUser;
    } else if (newStatus === 'active') {
      // 정지 해제 시 관련 필드 정리
      updateData.suspensionReason = null;
      updateData.suspendedAt = null;
      updateData.suspendedUntil = null;
      updateData.autoRestore = null;
    }

    await updateDoc(userRef, updateData);

    // 정지 알림 발송
    if (newStatus === 'suspended' && settings && settings.notifyUser) {
      try {
        const { createSanctionNotification } = await import('./notifications');
        
        let duration = '';
        if (settings.type === 'temporary' && settings.duration) {
          duration = `${settings.duration}일`;
        } else if (settings.type === 'permanent') {
          duration = '영구';
        }

        await createSanctionNotification(
          userId,
          'suspension',
          settings.reason,
          duration
        );

        console.log('정지 알림 발송 완료:', userId);
      } catch (notificationError) {
        console.error('정지 알림 발송 실패:', notificationError);
        // 알림 발송 실패는 정지 처리 자체를 실패시키지 않음
      }
    }

    // 관리자 작업 로그 기록
    await logAdminAction({
      adminId: adminId || 'current_admin', // 실제로는 현재 관리자 ID
      adminName: 'Admin', // 실제로는 현재 관리자 이름
      action: 'status_change',
      targetUserId: userId,
      targetUserName: userData.profile?.userName || userData.email || '',
      oldValue: oldStatus || 'active',
      newValue: newStatus,
      reason: settings?.reason
    });

    console.log('사용자 상태 업데이트 완료:', { userId, oldStatus, newStatus });
  } catch (error) {
    console.error('사용자 상태 업데이트 오류:', error);
    throw error;
  }
};

/**
 * 기존 getUsersList 함수 (호환성 유지)
 */
export const getUsersList = async (params: AdminUserListParams = {}): Promise<AdminUserListResponse> => {
  try {
    const {
      page = 1,
      pageSize = 20,
      search = '',
      role = 'all',
      status = 'all',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = params;

    const usersRef = collection(db, 'users');
    const constraints: QueryConstraint[] = [];

    // 역할 필터
    if (role !== 'all') {
      constraints.push(where('role', '==', role));
    }

    // 상태 필터
    if (status !== 'all') {
      constraints.push(where('status', '==', status));
    }

    // 검색 (userName 기준)
    if (search) {
      constraints.push(where('profile.userName', '>=', search));
      constraints.push(where('profile.userName', '<=', search + '\uf8ff'));
    }

    // 정렬
    constraints.push(orderBy(sortBy, sortOrder));

    // 페이지네이션
    const offset = (page - 1) * pageSize;
    constraints.push(limit(pageSize + offset));

    const q = query(usersRef, ...constraints);
    const querySnapshot = await getDocs(q);
    const allUsers: User[] = [];
    
    querySnapshot.forEach((doc) => {
      allUsers.push({ 
        uid: doc.id, 
        ...doc.data() 
      } as User);
    });

    // 페이지네이션 적용
    const users = allUsers.slice(offset, offset + pageSize);

    // 전체 개수 조회
    const countQuery = query(usersRef);
    const countSnapshot = await getCountFromServer(countQuery);
    const totalCount = countSnapshot.data().count;

    return {
      users,
      totalCount,
      hasMore: totalCount > page * pageSize,
      currentPage: page
    };
  } catch (error) {
    console.error('관리자 사용자 목록 조회 오류:', error);
    throw new Error('사용자 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 관리자용 사용자 상세 정보 조회
 */
export const getUserDetail = async (userId: string): Promise<User & {
  activityStats: {
    totalPosts: number;
    totalComments: number;
    totalLikes: number;
    warningCount: number;
  };
  recentActivity: {
    lastLoginAt?: number;
    lastActiveAt?: number;
    recentPosts: Post[];
    recentComments: Comment[];
  };
}> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }

    const userData = { uid: userDoc.id, ...userDoc.data() } as User;

    // 활동 통계 조회
    const postsQuery = query(
      collection(db, 'posts'),
      where('authorId', '==', userId),
      where('status.isDeleted', '==', false)
    );
    const postsSnapshot = await getDocs(postsQuery);
    const totalPosts = postsSnapshot.size;

    // 최근 게시글 (최대 5개)
    const recentPostsQuery = query(
      collection(db, 'posts'),
      where('authorId', '==', userId),
      where('status.isDeleted', '==', false),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const recentPostsSnapshot = await getDocs(recentPostsQuery);
    const recentPosts: Post[] = [];
    recentPostsSnapshot.forEach((doc) => {
      recentPosts.push({ id: doc.id, ...doc.data() } as Post);
    });

    // 댓글 수 계산 (간단화된 버전)
    const totalComments = 0;
    const totalLikes = 0;
    
    // 경고 수 계산
    const warningsQuery = query(
      collection(db, 'users', userId, 'warningHistory'),
      where('status', '==', 'active')
    );
    const warningsSnapshot = await getDocs(warningsQuery);
    const warningCount = warningsSnapshot.size;

    return {
      ...userData,
      activityStats: {
        totalPosts,
        totalComments,
        totalLikes,
        warningCount
      },
      recentActivity: {
        lastLoginAt: userData.lastLoginAt ? toTimestamp(userData.lastLoginAt) : undefined,
        recentPosts,
        recentComments: [] // 간단화
      }
    };
  } catch (error) {
    console.error('사용자 상세 정보 조회 오류:', error);
    throw new Error('사용자 상세 정보를 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자 역할 변경
 */
export const updateUserRole = async (userId: string, newRole: 'admin' | 'user'): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      role: newRole,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('사용자 역할 변경 오류:', error);
    throw new Error('사용자 역할을 변경하는 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자 상태 변경
 */
export const updateUserStatus = async (
  userId: string,
  status: 'active' | 'inactive' | 'suspended',
  suspensionSettings?: SuspensionSettings,
  adminId?: string
): Promise<void> => {
  if (!userId) {
    throw new Error('사용자 ID가 필요합니다.');
  }

  try {
    console.log('사용자 상태 업데이트 시작:', { userId, status, suspensionSettings });
    
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }

    const userData = userDoc.data();
    const updateData: Record<string, FieldValue | string | number | boolean | object | null> = {
      status,
      updatedAt: serverTimestamp(),
    };

    // 정지인 경우 추가 필드 설정
    if (status === 'suspended' && suspensionSettings) {
      updateData.suspensionReason = suspensionSettings.reason;
      
      if (suspensionSettings.type === 'temporary' && suspensionSettings.duration) {
        const suspendedUntil = new Date();
        suspendedUntil.setDate(suspendedUntil.getDate() + suspensionSettings.duration);
        updateData.suspendedUntil = toTimestamp(suspendedUntil);
        updateData.suspendedAt = serverTimestamp();
      } else {
        // 영구 정지인 경우 suspendedUntil을 null로 설정
        updateData.suspendedUntil = null;
        updateData.suspendedAt = serverTimestamp();
      }
    } else if (status === 'active') {
      // 정지 해제 시 정지 관련 필드 제거
      updateData.suspensionReason = null;
      updateData.suspendedUntil = null;
      updateData.suspendedAt = null;
    }

    await updateDoc(userRef, updateData);

    // 정지 알림 발송
    if (status === 'suspended' && suspensionSettings) {
      try {
        const { createSanctionNotification } = await import('./notifications');
        
        let duration = '';
        if (suspensionSettings.type === 'temporary' && suspensionSettings.duration) {
          duration = `${suspensionSettings.duration}일`;
        } else if (suspensionSettings.type === 'permanent') {
          duration = '영구';
        }

        await createSanctionNotification(
          userId,
          'suspension',
          suspensionSettings.reason,
          duration
        );

        console.log('정지 알림 발송 완료:', userId);
      } catch (notificationError) {
        console.error('정지 알림 발송 실패:', notificationError);
        // 알림 발송 실패는 정지 처리 자체를 실패시키지 않음
      }
    }

    // 관리자 로그 기록
    if (adminId) {
      try {
        await logAdminAction({
          adminId,
          adminName: 'Admin', // TODO: 실제 관리자 이름 가져오기
          action: 'status_change',
          targetUserId: userId,
          targetUserName: userData?.profile?.userName || '',
          oldValue: userData?.status || 'active',
          newValue: status,
          reason: suspensionSettings?.reason,
          ipAddress: '', // 서버에서는 IP 추적이 어려움
          userAgent: ''
        });
      } catch (logError) {
        console.error('관리자 로그 기록 실패:', logError);
      }
    }

    console.log('사용자 상태 업데이트 완료');
  } catch (error) {
    console.error('사용자 상태 업데이트 오류:', error);
    throw error;
  }
};

/**
 * 관리자용 사용자 경험치 수정
 */
export const updateUserExperienceAdmin = async (userId: string, newExperience: number, reason: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    
    // 경험치 시스템 함수 사용
    const { calculateCurrentLevelProgress } = await import('../experience');
    const progress = calculateCurrentLevelProgress(newExperience);
    
    await updateDoc(userRef, {
      'stats.totalExperience': newExperience,
      // 'stats.experience': newExperience, // experience 필드 제거
      'stats.level': progress.level,
      'stats.currentExp': progress.currentExp,
      'stats.currentLevelRequiredXp': progress.currentLevelRequiredXp,
      updatedAt: serverTimestamp()
    });

    // 경험치 변경 로그 추가
    await addDoc(collection(db, 'users', userId, 'experienceHistory'), {
      type: 'admin_adjustment',
      amount: newExperience,
      reason,
      adminId: 'current_admin', // 실제로는 현재 관리자 ID
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error('사용자 경험치 수정 오류:', error);
    throw new Error('사용자 경험치를 수정하는 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자 경고 추가
 */
export const addUserWarning = async (userId: string, reason: string): Promise<void> => {
  try {
    // 경고 추가
    await addDoc(collection(db, 'users', userId, 'warningHistory'), {
      reason,
      status: 'active',
      adminId: 'current_admin', // 실제로는 현재 관리자 ID
      createdAt: serverTimestamp()
    });

    // 사용자 경고 수 업데이트
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      'warnings.count': increment(1),
      'warnings.lastWarningAt': serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('사용자 경고 추가 오류:', error);
    throw new Error('사용자 경고를 추가하는 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자 삭제
 */
export const deleteUser = async (userId: string): Promise<void> => {
  try {
    // 사용자 문서 삭제
    await deleteDoc(doc(db, 'users', userId));

    // 관련 데이터 정리는 Cloud Functions에서 처리하는 것이 좋음
    // 여기서는 기본적인 삭제만 수행
  } catch (error) {
    console.error('사용자 삭제 오류:', error);
    throw new Error('사용자를 삭제하는 중 오류가 발생했습니다.');
  }
};

/**
 * 대량 사용자 업데이트
 */
export const bulkUpdateUsers = async (userIds: string[], updates: {
  role?: 'admin' | 'user';
  status?: 'active' | 'inactive' | 'suspended';
  reason?: string;
}): Promise<void> => {
  try {
    const batch = [];
    
    for (const userId of userIds) {
      const userRef = doc(db, 'users', userId);
      const updateData: Record<string, FieldValue | string | number | boolean | object | null> = {
        ...updates,
        updatedAt: serverTimestamp()
      };

      if (updates.status === 'suspended' && updates.reason) {
        updateData.suspensionReason = updates.reason;
        updateData.suspendedAt = serverTimestamp();
      }

      batch.push(updateDoc(userRef, updateData));
    }

    await Promise.all(batch);
  } catch (error) {
    console.error('대량 사용자 업데이트 오류:', error);
    throw new Error('사용자들을 업데이트하는 중 오류가 발생했습니다.');
  }
}; 

/**
 * 추천인 검색 함수
 * @param searchTerm 검색어 (userName)
 * @returns 검색된 사용자 목록
 */
export const searchUsers = async (searchTerm: string): Promise<Array<{
  uid: string;
  userName: string;
  realName: string;
}>> => {
  try {
    if (!searchTerm || searchTerm.trim().length < 2) {
      return [];
    }

    const usersRef = collection(db, 'users');
    
    // userName으로 부분 일치 검색 (Firestore의 제한으로 인해 클라이언트에서 필터링)
    const q = query(
      usersRef,
      where('profile.userName', '>=', searchTerm.trim()),
      where('profile.userName', '<=', searchTerm.trim() + '\uf8ff'),
      limit(10) // 최대 10개 결과
    );
    
    const querySnapshot = await getDocs(q);
    const users: Array<{
      uid: string;
      userName: string;
      realName: string;
    }> = [];
    
    querySnapshot.forEach((doc) => {
      const userData = doc.data();
      if (userData.profile?.userName && userData.profile?.realName) {
        users.push({
          uid: doc.id,
          userName: userData.profile.userName,
          realName: userData.profile.realName
        });
      }
    });
    
    return users;
  } catch (error) {
    console.error('사용자 검색 오류:', error);
    return [];
  }
}; 

/**
 * 이메일 중복 확인 함수
 * @param email 확인할 이메일 주소
 * @returns 사용 가능 여부와 메시지
 */
export const checkEmailAvailability = async (email: string): Promise<{
  isAvailable: boolean;
  message: string;
}> => {
  try {
    if (!email || email.trim() === '') {
      return { isAvailable: false, message: '이메일을 입력해주세요.' };
    }

    // 이메일 형식 검증 (더 엄격한 검증)
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!emailRegex.test(email)) {
      return { isAvailable: false, message: '올바른 이메일 형식이 아닙니다. (예: user@example.com)' };
    }

    // Firestore에서 중복 확인
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('email', '==', email.trim().toLowerCase()),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      return { isAvailable: false, message: '이미 가입된 이메일 주소입니다.' };
    }

    return { isAvailable: true, message: '사용 가능한 이메일입니다.' };
  } catch (error) {
    console.error('이메일 중복 확인 오류:', error);
    return { isAvailable: false, message: '이메일 확인 중 오류가 발생했습니다.' };
  }
};

/**
 * userName 중복 확인 함수
 * @param userName 확인할 사용자명
 * @returns 사용 가능 여부와 메시지
 */
export const checkUserNameAvailability = async (userName: string): Promise<{
  isAvailable: boolean;
  message: string;
}> => {
  try {
    if (!userName || userName.trim() === '') {
      return { isAvailable: false, message: '사용자명을 입력해주세요.' };
    }

    // 사용자명 유효성 검증
    if (userName.length < 5 || userName.length > 20) {
      return { isAvailable: false, message: '사용자명은 5-20자 사이여야 합니다.' };
    }

    if (!/^[a-zA-Z0-9]+$/.test(userName)) {
      return { isAvailable: false, message: '사용자명은 영문자와 숫자만 사용 가능합니다.' };
    }

    // Firestore에서 중복 확인
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('profile.userName', '==', userName.trim()),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      return { isAvailable: false, message: '이미 사용 중인 사용자명입니다.' };
    }

    return { isAvailable: true, message: '사용 가능한 사용자명입니다.' };
  } catch (error) {
    console.error('사용자명 중복 확인 오류:', error);
    return { isAvailable: false, message: '사용자명 확인 중 오류가 발생했습니다.' };
  }
};

/**
 * 사용자의 모든 게시물의 작성자 정보 업데이트
 */
const updateUserPostsAuthorInfo = async (
  userId: string,
  newUserName: string,
  profileImageUrl?: string
): Promise<void> => {
  try {
    const postsRef = collection(db, 'posts');
    
    // 해당 사용자의 익명이 아닌 모든 게시물 조회
    const q = query(
      postsRef,
      where('authorId', '==', userId),
      where('authorInfo.isAnonymous', '==', false)
    );
    
    const querySnapshot = await getDocs(q);
    
    // 배치 업데이트
    const updatePromises = querySnapshot.docs.map((postDoc) => {
      const postRef = doc(db, 'posts', postDoc.id);
      return updateDoc(postRef, {
        'authorInfo.displayName': newUserName,
        'authorInfo.profileImageUrl': profileImageUrl || '',
        'updatedAt': serverTimestamp()
      });
    });
    
    await Promise.all(updatePromises);
    
    console.log(`✅ ${querySnapshot.size}개의 게시물 작성자 정보 업데이트 완료`);
  } catch (error) {
    console.error('게시물 작성자 정보 업데이트 오류:', error);
    // 에러가 발생해도 프로필 업데이트는 성공한 것으로 처리
  }
};

/**
 * 사용자의 모든 댓글의 작성자 정보 업데이트
 */
const updateUserCommentsAuthorInfo = async (
  userId: string,
  newUserName: string,
  profileImageUrl?: string
): Promise<void> => {
  try {
    const commentsRef = collection(db, 'comments');
    
    // 해당 사용자의 익명이 아닌 모든 댓글 조회
    const q = query(
      commentsRef,
      where('authorId', '==', userId),
      where('authorInfo.isAnonymous', '==', false)
    );
    
    const querySnapshot = await getDocs(q);
    
    // 배치 업데이트
    const updatePromises = querySnapshot.docs.map((commentDoc) => {
      const commentRef = doc(db, 'comments', commentDoc.id);
      return updateDoc(commentRef, {
        'authorInfo.displayName': newUserName,
        'authorInfo.profileImageUrl': profileImageUrl || '',
        'updatedAt': serverTimestamp()
      });
    });
    
    await Promise.all(updatePromises);
    
    console.log(`✅ ${querySnapshot.size}개의 댓글 작성자 정보 업데이트 완료`);
  } catch (error) {
    console.error('댓글 작성자 정보 업데이트 오류:', error);
    // 에러가 발생해도 프로필 업데이트는 성공한 것으로 처리
  }
};

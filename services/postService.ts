import {
  Post,
  CreatePostData as CreatePostDataType,
  User,
  VoteOption,
} from "../types";
import { db } from "../lib/firebase";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  increment,
  getDoc,
  deleteDoc,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { deletePostImages } from "./imageService";

export async function fetchPostsByCategory(
  categoryId: string,
): Promise<Post[]> {
  const postsRef = collection(db, "posts");
  let q = query(postsRef, where("categoryId", "==", categoryId));

  const querySnapshot = await getDocs(q);
  const posts = querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as Post,
  );

  return posts;
}

export async function fetchFilteredPosts(
  categoryId: string,
  user: User,
): Promise<Post[]> {
  const posts = await fetchPostsByCategory(categoryId);

  if (categoryId.startsWith("regional")) {
    return posts.filter(
      (post) =>
        post.address1 === user.address1 && post.address2 === user.address2,
    );
  } else if (categoryId.startsWith("school")) {
    return posts.filter((post) => post.schoolId === user.schoolId);
  }

  return posts;
}

export interface CreatePostData {
  title: string;
  content: string;
  categoryId: string;
  author: string;
  authorId: string;
  address1?: string;
  address2?: string;
  schoolId?: string;
  schoolName?: string;
  imageUrls?: string[];
  isVotePost: boolean;
  voteOptions?: VoteOption[] | null;
}

export async function createPost(postData: CreatePostData) {
  if (!postData.authorId) {
    throw new Error("Author ID is required");
  }

  const postsRef = collection(db, "posts");
  const now = Timestamp.now();
  const newPost = {
    ...postData,
    createdAt: now,
    updatedAt: now,
    likes: 0,
    comments: 0,
    views: 0,
    likedBy: [],
    scraps: 0,
    voteResults:
      postData.isVotePost && postData.voteOptions
        ? postData.voteOptions.reduce(
            (acc, _, index) => {
              acc[index] = 0;
              return acc;
            },
            {} as { [key: number]: number },
          )
        : null,
    voterIds: [],
    isReportPending: true,
    reportCount: 0,
    reports: [],
  };

  try {
    const docRef = await addDoc(postsRef, newPost);

    const userPostRef = doc(db, `users/${postData.authorId}/posts`, docRef.id);
    await setDoc(userPostRef, {
      createdAt: now,
      postId: docRef.id,
    });

    return docRef.id; // 게시글 ID 반환
  } catch (error) {
    console.error("Error creating post:", error);
    throw error;
  }
}

export async function updatePost(postId: string, updateData: Partial<Post>) {
  const postRef = doc(db, "posts", postId);
  const updatedData = {
    ...updateData,
    updatedAt: new Date(),
  };
  return updateDoc(postRef, updatedData);
}

export async function scrapPost(userId: string, postId: string) {
  const scrapRef = doc(db, `users/${userId}/scraps/${postId}`);
  const postRef = doc(db, `posts/${postId}`);

  await setDoc(scrapRef, { createdAt: new Date() });
  await updateDoc(postRef, { scraps: increment(1) });
}

export async function unscrapPost(userId: string, postId: string) {
  const scrapRef = doc(db, `users/${userId}/scraps/${postId}`);
  const postRef = doc(db, `posts/${postId}`);

  await deleteDoc(scrapRef);
  await updateDoc(postRef, { scraps: increment(-1) });
}

export async function isPostScrapped(
  userId: string,
  postId: string,
): Promise<boolean> {
  const scrapRef = doc(db, `users/${userId}/scraps/${postId}`);
  const scrapDoc = await getDoc(scrapRef);
  return scrapDoc.exists();
}

export async function fetchUserScraps(userId: string): Promise<Post[]> {
  const scrapsRef = collection(db, `users/${userId}/scraps`);
  const scrapsSnapshot = await getDocs(scrapsRef);

  const scrappedPosts = await Promise.all(
    scrapsSnapshot.docs.map(async (scrapDoc) => {
      const postRef = doc(db, "posts", scrapDoc.id);
      const postSnap = await getDoc(postRef);
      return { id: postSnap.id, ...postSnap.data() } as Post;
    }),
  );

  return scrappedPosts;
}

export async function deletePost(postId: string, authorId: string) {
  try {
    // 1. posts 컬렉션에서 게시글 삭제
    const postRef = doc(db, "posts", postId);
    await deleteDoc(postRef);

    // 2. 사용자의 posts 서브컬렉션에서 게시글 참조 삭제
    const userPostRef = doc(db, `users/${authorId}/posts`, postId);
    await deleteDoc(userPostRef);

    // 3. 게시글과 관련된 이미지 삭제 (선택적)
    await deletePostImages(postId);

    // 4. 게시글과 관련된 댓글 삭제 (선택적)
    const commentsRef = collection(db, "comments");
    const commentsQuery = query(commentsRef, where("postId", "==", postId));
    const commentsSnapshot = await getDocs(commentsQuery);

    const deleteCommentPromises = commentsSnapshot.docs.map((commentDoc) =>
      deleteDoc(doc(db, "comments", commentDoc.id)),
    );
    await Promise.all(deleteCommentPromises);

    console.log("Post and related data deleted successfully");
  } catch (error) {
    console.error("Error deleting post: ", error);
    throw error;
  }
}

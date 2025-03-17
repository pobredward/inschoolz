import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useRecoilValue, useRecoilState } from "recoil";
import { userState, categoriesState } from "../../store/atoms";
import Layout from "../../components/Layout";
import styled from "@emotion/styled";
import {
  collection,
  query,
  getDocs,
  getDoc,
  doc,
  limit,
  orderBy,
  startAfter,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { formatDate } from "../../utils/dateUtils";

interface Comment {
  id: string;
  content: string;
  createdAt: any;
  isReply: boolean;
  parentId?: string;
}

interface Post {
  id: string;
  title: string;
  content: string;
  createdAt: any;
  author: string;
  comments: number;
  likes: number;
  views: number;
  userComments: Comment[];
  categoryId: string;
}

const CommentsPage: React.FC = () => {
  const user = useRecoilValue(userState);
  const router = useRouter();
  const [categories] = useRecoilState(categoriesState);
  const [posts, setPosts] = useState<Post[]>([]);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCommentedPosts();
  }, []);

  const fetchCommentedPosts = async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      console.log("댓글 데이터 가져오기 시작...");
      
      // 1. 사용자의 모든 댓글을 가져옵니다
      const commentsRef = collection(db, `users/${user.uid}/comments`);
      const q = query(commentsRef, orderBy("createdAt", "desc"), limit(20));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.log("댓글 데이터가 없습니다.");
        setLoading(false);
        return;
      }

      console.log(`총 ${querySnapshot.docs.length}개의 댓글을 가져왔습니다.`);
      
      // 마지막 문서 설정 (페이징용)
      if (querySnapshot.docs.length > 0) {
        setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
      }

      // 2. 댓글들이 속한 게시글의 고유 ID 목록을 추출합니다
      const postIds = new Set<string>();
      const commentsData: any[] = [];
      
      querySnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.postId) {
          postIds.add(data.postId);
          commentsData.push({
            id: doc.id,
            ...data
          });
        }
      });
      
      console.log(`댓글이 속한 고유 게시글 수: ${postIds.size}개`);
      console.log("게시글 ID 목록:", Array.from(postIds));
      
      if (postIds.size === 0) {
        console.log("유효한 게시글이 없습니다.");
        setLoading(false);
        return;
      }
      
      // 3. 각 게시글 정보를 별도로 가져옵니다
      const postsData: Post[] = [];
      
      for (const postId of Array.from(postIds)) {
        try {
          const postDoc = await getDoc(doc(db, "posts", postId));
          
          if (postDoc.exists()) {
            const postData = postDoc.data();
            console.log(`게시글 [${postId}] 제목: ${postData.title}`);
            
            // 이 게시글에 속한 사용자 댓글들 필터링
            const postComments = commentsData
              .filter(comment => comment.postId === postId)
              .map(comment => ({
                id: comment.id,
                content: comment.content || "(내용 없음)",
                createdAt: comment.createdAt,
                isReply: !!comment.parentId,
                parentId: comment.parentId
              }));
            
            console.log(`게시글 [${postId}]에 속한 댓글 수: ${postComments.length}개`);
            
            // 게시글 객체 생성
            postsData.push({
              id: postId,
              title: postData.title || "제목 없음",
              content: postData.content || "",
              createdAt: postData.createdAt,
              author: postData.author || "작성자 없음",
              comments: postData.comments || 0,
              likes: postData.likes || 0,
              views: postData.views || 0,
              categoryId: postData.categoryId || "",
              userComments: postComments
            });
          } else {
            console.log(`게시글 [${postId}]이 존재하지 않습니다.`);
          }
        } catch (error) {
          console.error(`게시글 [${postId}] 로딩 중 오류:`, error);
        }
      }
      
      console.log(`최종 로드된 게시글 수: ${postsData.length}개`);
      postsData.forEach(post => {
        console.log(`- 게시글 [${post.id}]: ${post.title}, 댓글 ${post.userComments.length}개`);
      });
      
      // 4. UI에 표시할 최종 데이터 설정
      setPosts(postsData);
    } catch (error) {
      console.error("댓글 로딩 중 오류 발생:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMoreCommentedPosts = async () => {
    if (!user || !lastVisible) return;
    setLoading(true);
    
    try {
      // 1. 다음 페이지의 댓글을 가져옵니다
      const commentsRef = collection(db, `users/${user.uid}/comments`);
      const q = query(
        commentsRef,
        orderBy("createdAt", "desc"),
        startAfter(lastVisible),
        limit(20)
      );
      const querySnapshot = await getDocs(q);
      
      // 마지막 문서 갱신
      if (querySnapshot.docs.length > 0) {
        setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
      } else {
        console.log("더 이상 댓글이 없습니다.");
        setLoading(false);
        return;
      }
      
      // 2. 댓글들이 속한 게시글의 고유 ID 목록 추출
      const postIds = new Set<string>();
      const commentsData: any[] = [];
      
      querySnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.postId) {
          postIds.add(data.postId);
          commentsData.push({
            id: doc.id,
            ...data
          });
        }
      });
      
      // 3. 현재 로드된 게시글들의 ID 목록
      const existingPostIds = new Set(posts.map(post => post.id));
      const newPostIds = Array.from(postIds).filter(id => !existingPostIds.has(id));
      
      // 4. 새 게시글 정보와 기존 게시글의 새 댓글 처리
      const updatedPosts = [...posts];
      
      // 이미 로드된 게시글에 새 댓글 추가
      for (const postId of Array.from(postIds)) {
        // 이 게시글에 속한 댓글들
        const postComments = commentsData
          .filter(comment => comment.postId === postId)
          .map(comment => ({
            id: comment.id,
            content: comment.content || "(내용 없음)",
            createdAt: comment.createdAt,
            isReply: !!comment.parentId,
            parentId: comment.parentId
          }));
        
        // 이미 로드된 게시글이면 댓글만 추가
        const existingPostIndex = updatedPosts.findIndex(p => p.id === postId);
        if (existingPostIndex >= 0) {
          // ID 기준으로 중복 댓글은 제외하고 추가
          const existingCommentIds = new Set(updatedPosts[existingPostIndex].userComments.map(c => c.id));
          const newComments = postComments.filter(c => !existingCommentIds.has(c.id));
          
          updatedPosts[existingPostIndex].userComments = [
            ...updatedPosts[existingPostIndex].userComments,
            ...newComments
          ];
        } 
        // 새 게시글이면 게시글 정보를 가져와서 추가
        else if (newPostIds.includes(postId)) {
          try {
            const postDoc = await getDoc(doc(db, "posts", postId));
            
            if (postDoc.exists()) {
              const postData = postDoc.data();
              
              updatedPosts.push({
                id: postId,
                title: postData.title || "제목 없음",
                content: postData.content || "",
                createdAt: postData.createdAt,
                author: postData.author || "작성자 없음",
                comments: postData.comments || 0,
                likes: postData.likes || 0,
                views: postData.views || 0,
                categoryId: postData.categoryId || "",
                userComments: postComments
              });
            }
          } catch (error) {
            console.error(`게시글 [${postId}] 로딩 중 오류:`, error);
          }
        }
      }
      
      // 5. 최종 데이터 설정
      setPosts(updatedPosts);
    } catch (error) {
      console.error("추가 댓글 로딩 중 오류:", error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryName = (categoryId: string) => {
    for (let cat of categories) {
      if (cat.subcategories) {
        for (let subcat of cat.subcategories) {
          if (subcat.id === categoryId) {
            return `${cat.name} | ${subcat.name}`;
          }
        }
      }
    }
    return "";
  };

  const countReplies = (comments: Comment[]) => {
    return comments.filter((comment) => comment.parentId).length;
  };

  const stripHtmlTags = (html: string) => {
    if (!html) return '';
    return html.replace(/<\/?[^>]+(>|$)/g, "");
  };

  return (
    <Layout>
      <Container>
        <h1>내 댓글</h1>
        <PostContainer>
          {posts.map((post) => (
            <PostItem key={post.id}>
              <PostHeader onClick={() => router.push(`/community/${post.categoryId}/${post.id}`)}>
                <PostTitle>{post.title}</PostTitle>
                <PostCategory>{getCategoryName(post.categoryId)}</PostCategory>
              </PostHeader>
              <PostContent onClick={() => router.push(`/community/${post.categoryId}/${post.id}`)}>
                {getPostContentSnippet(post.content)}
              </PostContent>
              <CommentSection>
                <CommentHeader>
                  내 댓글: {post.userComments.length}개
                </CommentHeader>
              </CommentSection>
              <PostFooter onClick={() => router.push(`/community/${post.categoryId}/${post.id}`)}>
                <PostDateAuthor>
                  {formatDate(post.createdAt)} | {post.author}
                </PostDateAuthor>
                <PostActions>
                  <ActionItem>👍 {post.likes || 0}</ActionItem>
                  <ActionItem>💬 {post.comments || 0}</ActionItem>
                  <ActionItem>👁️ {post.views || 0}</ActionItem>
                </PostActions>
              </PostFooter>
            </PostItem>
          ))}
        </PostContainer>
        {lastVisible && (
          <LoadMoreButton onClick={fetchMoreCommentedPosts} disabled={loading}>
            {loading ? "로딩 중..." : "더 보기"}
          </LoadMoreButton>
        )}
      </Container>
    </Layout>
  );
};

const getPostContentSnippet = (content: string) => {
  const paragraphs = content
    .split(/<\/?p[^>]*>/g)
    .filter((paragraph) => paragraph.trim() !== "");
  const firstParagraph = paragraphs[0] || "";
  const plainText = firstParagraph.replace(/<[^>]+>/g, "");
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
  const sliceLength = isMobile ? 20 : 45;
  return plainText.length > sliceLength
    ? plainText.slice(0, sliceLength) + "..."
    : plainText;
};

const Container = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
`;

const PostContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
`;

const PostItem = styled.div`
  padding: 1.5rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  box-shadow: 0 3px 5px rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  background-color: white;
  margin-bottom: 1rem;

  &:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.12);
    transform: translateY(-2px);
    transition: all 0.2s ease;
  }
`;

const PostHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const PostTitle = styled.h4`
  margin: 0;
  flex-grow: 1;
`;

const PostCategory = styled.span`
  font-size: 0.8rem;
  color: #6c757d;

  @media (max-width: 769px) {
    font-size: 0.6rem;
  }
`;

const PostContent = styled.p`
  margin: 0.5rem 0;
  color: #666;
`;

const CommentSection = styled.div`
  margin-top: 0.8rem;
  padding: 1rem;
  background-color: #f5f5f5;
  border-radius: 4px;
  border: 1px solid #eaeaea;
`;

const CommentHeader = styled.h5`
  margin: 0 0 0.8rem 0;
  color: #333;
  font-size: 1rem;
  border-bottom: 1px solid #ddd;
  padding-bottom: 0.5rem;
  font-weight: 600;
`;

const PostFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.5rem;
`;

const PostDateAuthor = styled.span`
  font-size: 0.8rem;
  color: #666;
`;

const PostActions = styled.div`
  display: flex;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #666;
`;

const ActionItem = styled.span`
  display: flex;
  align-items: center;
`;

const LoadMoreButton = styled.button`
  width: 100%;
  padding: 10px;
  margin-top: 1rem;
  background-color: #0070f3;
  color: white;
  border: none;
  cursor: pointer;

  &:disabled {
    background-color: #ccc;
  }
`;

export default CommentsPage;

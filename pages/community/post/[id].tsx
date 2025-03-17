import { GetServerSideProps } from "next";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

// /community/post/[id] 경로의 게시글을 적절한 카테고리로 리디렉트
export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id } = context.params as { id: string };
  
  try {
    // 게시글 데이터 가져오기
    const postDoc = await getDoc(doc(db, "posts", id));
    
    if (!postDoc.exists()) {
      return {
        notFound: true,
      };
    }
    
    const postData = postDoc.data();
    const categoryId = postData.categoryId;
    
    // 적절한 카테고리 페이지로 리디렉트만 하고 데이터는 전달하지 않음
    return {
      redirect: {
        destination: `/community/${categoryId}/${id}`,
        permanent: false,
      },
    };
  } catch (error) {
    console.error("Error fetching post:", error);
    return {
      notFound: true,
    };
  }
};

// 페이지 컴포넌트 - 실제로는 사용되지 않음 (리디렉션됨)
const PostRedirectPage = () => {
  return <div>Redirecting...</div>;
};

export default PostRedirectPage; 
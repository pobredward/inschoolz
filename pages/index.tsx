import { NextPage } from "next";
import Head from "next/head";
import styled from "@emotion/styled";
import Layout from "../components/Layout";
import { useRecoilValue } from "recoil";
import { userState } from "../store/atoms";
import { useRouter } from "next/router";

const HomePage: NextPage = () => {
  const user = useRecoilValue(userState);
  const router = useRouter();

  const handleAdminClick = () => {
    router.push("/admin");
  };

  return (
    <Layout>
      <Head>
        <title>인스쿨즈 - 대한민국 학생들을 위한 올인원 커뮤니티</title>
        <meta
          name="description"
          content="인스쿨즈에서 학교생활, 학업, 진로에 대한 정보를 공유하고 소통하세요. 게시판, 미니게임, 랭킹 시스템을 통해 즐거운 학교생활을 만들어갑니다."
        />
        <meta
          name="keywords"
          content="인스쿨즈, 학생 커뮤니티, 학교생활, 진로, 게시판, 미니게임, 랭킹"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <meta
          property="og:title"
          content="인스쿨즈 - 대한민국 학생들을 위한 올인원 커뮤니티"
        />
        <meta
          property="og:description"
          content="인스쿨즈에서 학교생활, 학업, 진로에 대한 정보를 공유하고 소통하세요."
        />
        <meta property="og:image" content="/og-image.jpg" />
        <meta property="og:url" content="https://www.inschoolz.com" />
        <script type="application/ld+json">
          {`
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "인스쿨즈",
              "url": "https://www.inschoolz.com",
              "description": "대한민국 학생들을 위한 올인원 커뮤니티",
              "potentialAction": {
                "@type": "SearchAction",
                "target": "https://www.inschoolz.com/search?q={search_term_string}",
                "query-input": "required name=search_term_string"
              }
            }
          `}
        </script>
      </Head>

      <Main>
        <h1>인스쿨즈</h1>
        <p>초중등 재학생 및 졸업생을 위한 올인원 커뮤니티</p>
        {user && user.isAdmin && (
          <AdminButton onClick={handleAdminClick}>관리자 페이지</AdminButton>
        )}

        <TestNotice>
          <h2>테스트 기간: 09/01~09/15</h2>
          <ul>
            <li>활성화된 커뮤니티처럼 보이는 것이 목표입니다.</li>
            <li>
              테스트 기간 동안 다양한 학교 게시판과 마이너 갤러리에 게시글을
              작성해 주세요.
            </li>
            <li>전화번호 인증 과정이 없어 계정도 여러 개 만들 수 있습니다.</li>
            <li>
              작성하신 게시글은 구글 검색 결과 상단에 노출될 수 있으니, 도배성
              게시글보다는 <b>양질의 내용을 작성</b>해 주시기 바랍니다.
            </li>
            <li>현재는 디자인 작업 없이 기능 구현에 중점을 두었습니다.</li>
            <li>
              기타 버그사항 및 개선점 발견 시 마이너 갤러리의{" "}
              <b>제안사항 게시판</b>에 작성 부탁드립니다.
            </li>
          </ul>
        </TestNotice>
      </Main>
    </Layout>
  );
};

const Main = styled.main`
  padding: 4rem;
  text-align: center;

  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

const AdminButton = styled.button`
  margin-top: 2rem;
  padding: 0.5rem 1rem;
  background-color: var(--primary-button);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.3s;

  &:hover {
    background-color: var(--primary-hover);
  }
`;

const TestNotice = styled.div`
  margin-top: 3rem;
  padding: 1rem;
  border-radius: 4px;
  border: 1px solid #ccc;
  text-align: left;

  h2 {
    color: var(--primary-button);
    margin-bottom: 1rem;
    margin-left: 1rem;
  }

  ol {
    padding-left: 1.5rem;
  }

  li {
    margin-bottom: 0.5rem;
  }
`;

export default HomePage;

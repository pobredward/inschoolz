import { NextPage } from "next";
import Head from "next/head";
import styled from "@emotion/styled";
import Layout from "../components/Layout";
import HotPostsPreview from "../components/HotPostsPreview";

const HomePage: NextPage = () => {
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
        <p>대한민국 학생을 위한 웹사이트</p>
      </Main>
    </Layout>
  );
};

const Main = styled.main`
  padding: 4rem;
  text-align: center;
`;

export default HomePage;

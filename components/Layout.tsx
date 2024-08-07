// components/Layout.tsx
import React from "react";
import Head from "next/head";
import styled from "@emotion/styled";
import Navbar from "./Navbar";
import Footer from "./Footer";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <LayoutWrapper>
      <Head>
        <title>인스쿨즈</title>
        <meta
          name="description"
          content="대한민국 학생들을 위한 올인원 페이지"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Navbar />
      <Main>{children}</Main>
      <Footer />
    </LayoutWrapper>
  );
};

const LayoutWrapper = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
`;

const Main = styled.main`
  flex: 1;
  width: 100%;
  max-width: 1200px;
  margin: 20px auto;
  padding: 1rem;
  box-sizing: border-box;
  padding-top: 60px; // Navbar의 높이만큼 패딩을 추가
`;

export default Layout;

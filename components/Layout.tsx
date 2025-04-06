import React from "react";
import styled from "@emotion/styled";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { loadingState } from "../store/atoms";
import { useRecoilValue } from "recoil";
import ClimbingBoxLoader from "react-spinners/ClimbingBoxLoader";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const isLoading = useRecoilValue(loadingState);

  return (
    <LayoutWrapper>
      <Navbar />
      <Main>
        {isLoading && (
          <LoadingOverlay>
            <ClimbingBoxLoader color="#50ad3d" size={30} />
          </LoadingOverlay>
        )}
        {children}
      </Main>
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
  margin: 10px auto;
  padding: 1rem;
  box-sizing: border-box;
  padding-top: 60px; // Navbar의 높이 + 여유 공간

  @media (max-width: 768px) {
    padding: 0.8rem;
    padding-top: 50px; // 모바일 Navbar의 높이 + 여유 공간
    padding-bottom: 80px; // Bottom Navigation의 높이 + 여유 공간
  }
`;

const LoadingOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
`;

export default Layout;

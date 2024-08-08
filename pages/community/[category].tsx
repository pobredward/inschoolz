import React, { useEffect, useRef, useState } from "react";
import Layout from "../../components/Layout";
import CategoryList from "../../components/CategoryList";
import PostList from "../../components/PostList";
import { useRecoilState, useRecoilValue } from "recoil";
import {
  selectedCategoryState,
  userState,
  categoriesState,
} from "../../store/atoms";
import { useRouter } from "next/router";
import styled from "@emotion/styled";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";
import Link from 'next/link';

const CategoryPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useRecoilState(
    selectedCategoryState,
  );
  const router = useRouter();
  const { category } = router.query;
  const user = useRecoilValue(userState);
  const categories = useRecoilValue(categoriesState);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (category) {
      setSelectedCategory(category as string);
    }
  }, [category, setSelectedCategory]);

  const getCategoryPath = () => {
    let categoryPath = "전국";
    categories.forEach((cat) => {
      cat.subcategories?.forEach((subcat) => {
        if (subcat.id === category) {
          categoryPath = `${cat.name} > ${subcat.name}`;
          if (cat.id === "regional") {
            categoryPath = `${user?.address1} ${user?.address2} > ${subcat.name}`;
          } else if (cat.id === "school") {
            categoryPath = `${user?.schoolName} > ${subcat.name}`;
          }
        }
      });
    });
    return categoryPath;
  };

  const toggleCategory = () => {
    setIsCategoryOpen(!isCategoryOpen);
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setIsCategoryOpen(false);
    router.push(`/community/${categoryId}`);
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
      setIsCategoryOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const isNationalCategory = selectedCategory.startsWith("national-");

  return (
    <Layout>
      <Container>
        <DesktopCategoryPanel>
          <CategoryList onSelectCategory={handleCategorySelect} />
        </DesktopCategoryPanel>
        <MobileCategoryWrapper ref={wrapperRef}>
          <CategoryToggle onClick={toggleCategory} isOpen={isCategoryOpen}>
            <span>{getCategoryPath()}</span>
            {isCategoryOpen ? <FaChevronUp /> : <FaChevronDown />}
          </CategoryToggle>
          <CategoryDropdown isOpen={isCategoryOpen}>
            <CategoryList onSelectCategory={handleCategorySelect} />
          </CategoryDropdown>
        </MobileCategoryWrapper>
        <ContentSection>
          {(user || isNationalCategory) ? (
            <>
              <CategoryHeader>
                <CategoryTitle>{getCategoryPath()}</CategoryTitle>
                {user && (
                  <CreatePostButton
                    onClick={() =>
                      router.push(`/community/${selectedCategory}/create-post`)
                    }
                  >
                    글 작성
                  </CreatePostButton>
                )}
              </CategoryHeader>
              <PostList 
                selectedCategory={selectedCategory} 
                isLoggedIn={!!user}
                isNationalCategory={isNationalCategory}
              />
            </>
          ) : (
            <LoginPromptContainer>
              <LoginPromptText>로그인이 필요합니다</LoginPromptText>
              <LoginButton href="/login">로그인</LoginButton>
            </LoginPromptContainer>
          )}
        </ContentSection>
      </Container>
    </Layout>
  );
};

const Container = styled.div`
  display: flex;
  max-width: 100%;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const DesktopCategoryPanel = styled.div`
  width: 250px;
  padding: 1rem;
  border-right: 1px solid #e0e0e0;
  background-color: #f8f9fa;
  overflow-y: auto;
  position: relative;
  min-height: calc(80vh - 60px);

  @media (max-width: 768px) {
    display: none;
  }
`;

const CategoryTitle = styled.div`
  font-size: 1.2rem;
  font-weight: bold;
  padding: 0.2rem 0.5rem;
`;

const MobileCategoryWrapper = styled.div`
  position: relative;
  z-index: 10;
  margin-bottom: 1rem;

  @media (min-width: 769px) {
    display: none;
  }
`;

const CategoryToggle = styled.button<{ isOpen: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.75rem 1rem;
  background-color: white;
  border: 1px solid #e0e0e0;
  border-radius: ${({ isOpen }) => (isOpen ? "8px 8px 0 0" : "8px")};
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background-color: #f8f8f8;
  }

  svg {
    margin-left: 0.5rem;
    transition: transform 0.3s ease;
    transform: ${({ isOpen }) => (isOpen ? "rotate(180deg)" : "rotate(0)")};
  }
`;

const CategoryDropdown = styled.div<{ isOpen: boolean }>`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e0e0e0;
  border-top: none;
  border-radius: 0 0 8px 8px;
  max-height: ${({ isOpen }) => (isOpen ? "300px" : "0")};
  overflow-y: auto;
  transition: max-height 0.3s ease;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

const ContentSection = styled.div`
  flex: 1;
  padding: 1rem;
  overflow-y: auto;

  @media (max-width: 769px) {
    padding: 0rem;
  }
`;

const CategoryHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
`;

const CreatePostButton = styled.button`
  padding: 0.5rem 1rem;
  background-color: #0070f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: bold;
  transition: background-color 0.3s ease;

  &:hover {
    background-color: #0056b3;
  }
`;

const LoginPromptContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
`;

const LoginPromptText = styled.p`
  font-size: 18px;
  margin-bottom: 20px;
`;

const LoginButton = styled(Link)`
  padding: 10px 20px;
  background-color: #0070f3;
  color: white;
  text-decoration: none;
  border-radius: 5px;
  font-weight: bold;

  &:hover {
    background-color: #0056b3;
  }
`;

export default CategoryPage;
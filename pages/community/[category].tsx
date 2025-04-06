import React, { useEffect, useRef, useState } from "react";
import Layout from "../../components/Layout";
import PostList from "../../components/PostList";
import { useRecoilState, useRecoilValue } from "recoil";
import {
  selectedCategoryState,
  userState,
  categoriesState,
  selectedSchoolState,
} from "../../store/atoms";
import { useRouter } from "next/router";
import styled from "@emotion/styled";
import { FaPen } from "react-icons/fa";
import Link from "next/link";
import { Category } from "../../types";
import SchoolSelector from "../../components/SchoolSelector";
import CategoryTabs from "../../components/CategoryTabs";
import SubcategoryMenu from "../../components/SubcategoryMenu";

const CategoryPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useRecoilState(
    selectedCategoryState
  );
  const router = useRouter();
  const { category } = router.query;
  const [user, setUser] = useRecoilState(userState);
  const categories = useRecoilValue(categoriesState);
  const selectedSchool = useRecoilValue(selectedSchoolState);
  const [activeMajorCategory, setActiveMajorCategory] = useState("national");
  const pageRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredGalleries, setFilteredGalleries] = useState<Category[]>([]);
  const [allMinorGalleries, setAllMinorGalleries] = useState<Category[]>([]);

  useEffect(() => {
    const minorGalleries =
      categories
        .find((cat) => cat.id === "national")
        ?.subcategories?.find((subcat) => subcat.id === "national-minor")
        ?.subcategories || [];
    setAllMinorGalleries(minorGalleries);
    setFilteredGalleries(minorGalleries);
  }, [categories]);

  const handleSearch = () => {
    const filtered = allMinorGalleries.filter((gallery) =>
      gallery.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredGalleries(filtered);
  };

  useEffect(() => {
    if (category) {
      setSelectedCategory(category as string);
      setActiveMajorCategory(category.toString().split("-")[0]);
    }
  }, [category, setSelectedCategory]);

  const getCategoryName = (categoryId: string) => {
    for (let cat of categories) {
      if (cat.subcategories) {
        for (let subcat of cat.subcategories) {
          if (subcat.id === categoryId) {
            if (cat.id === "school") {
              const schoolName = selectedSchool ? selectedSchool.KOR_NAME : (user ? user.schoolName : "학교");
              return `${schoolName} > ${subcat.name}`;
            } else if (cat.id === "regional") {
              return user
                ? `${user.address1} ${user.address2} > ${subcat.name}`
                : `지역 > ${subcat.name}`;
            } else {
              return `${cat.name} > ${subcat.name}`;
            }
          }
          if (subcat.subcategories) {
            for (let minorGallery of subcat.subcategories) {
              if (minorGallery.id === categoryId) {
                return `${cat.name} > ${minorGallery.name} 게시판`;
              }
            }
          }
        }
      }
    }
    return "";
  };

  const handleMajorCategorySelect = (categoryId: string) => {
    setActiveMajorCategory(categoryId);
    
    // 해당 메이저 카테고리의 첫 번째 서브카테고리로 이동
    const firstSubcategory = categories
      .find((cat) => cat.id === categoryId)
      ?.subcategories?.[0];
      
    if (firstSubcategory) {
      handleCategorySelect(firstSubcategory.id);
    }
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    router.push(`/community/${categoryId}`);
  };

  const isNationalCategory = selectedCategory.startsWith("national-");
  const isSchoolCategory = selectedCategory === "school-student" || selectedCategory === "school-graduate";

  return (
    <Layout>
      <PageContainer ref={pageRef}>
        <ContentWrapper>
          {/* 데스크탑 및 모바일 공통 카테고리 탭 */}
          <CategoryTabs
            activeMajorCategory={activeMajorCategory}
            onSelectMajorCategory={handleMajorCategorySelect}
          />
          
          {/* 데스크탑 및 모바일 공통 서브카테고리 메뉴 */}
          <SubcategoryMenu
            activeMajorCategory={activeMajorCategory}
            selectedCategory={selectedCategory}
            onSelectCategory={handleCategorySelect}
            isOpen={true}
          />
          
          <MainContent>
            {user || isNationalCategory ? (
              <>
                <CategoryHeader>
                  <CategoryTitle>
                    {getCategoryName(selectedCategory)}
                  </CategoryTitle>
                  {user && selectedCategory !== "national-hot" && (
                    <CreatePostButton
                      onClick={() =>
                        router.push(
                          `/community/${selectedCategory}/create-post`
                        )
                      }
                    >
                      <FaPen />
                    </CreatePostButton>
                  )}
                </CategoryHeader>
                
                {isSchoolCategory && (
                  <SchoolSelectorWrapper>
                    <SchoolSelector />
                  </SchoolSelectorWrapper>
                )}
                
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
          </MainContent>
        </ContentWrapper>
      </PageContainer>
    </Layout>
  );
};

const PageContainer = styled.div`
  position: relative;
  overflow-x: hidden;
`;

const ContentWrapper = styled.div`
  display: flex;
  flex-direction: column;
`;

const MainContent = styled.div`
  flex: 1;
  padding: 1rem;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;

  @media (max-width: 768px) {
    padding: 0.7rem 0.5rem;
  }
`;

const CategoryHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  width: 100%;
  max-width: 1200px;
`;

const SchoolSelectorWrapper = styled.div`
  width: 100%;
  max-width: 1200px;
  margin-bottom: 1.5rem;
  background-color: white;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const CategoryTitle = styled.h2`
  margin: 0;
  @media (max-width: 768px) {
    display: none;
  }
`;

const CreatePostButton = styled.button`
  padding: 0.5rem 1rem;
  background-color: var(--primary-button);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover {
    background-color: var(--primary-hover);
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
  background-color: var(--primary-color);
  color: white;
  text-decoration: none;
  border-radius: 5px;
  font-weight: bold;

  &:hover {
    background-color: var(--hover-color);
  }
`;

export default CategoryPage;

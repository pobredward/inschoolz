import React from "react";
import styled from "@emotion/styled";
import { useRecoilValue } from "recoil";
import { categoriesState } from "../store/atoms";

interface CategoryTabsProps {
  activeMajorCategory: string;
  onSelectMajorCategory: (categoryId: string) => void;
}

const CategoryTabs: React.FC<CategoryTabsProps> = ({
  activeMajorCategory,
  onSelectMajorCategory,
}) => {
  const categories = useRecoilValue(categoriesState);

  return (
    <TabsContainer>
      <TabsWrapper>
        {categories.map((category) => (
          <TabItem
            key={category.id}
            isActive={activeMajorCategory === category.id}
            onClick={() => onSelectMajorCategory(category.id)}
          >
            {category.name}
          </TabItem>
        ))}
      </TabsWrapper>
    </TabsContainer>
  );
};

const TabsContainer = styled.div`
  display: flex;
  width: 100%;
  background-color: white;
  border-bottom: 1px solid #eaeaea;
  position: sticky;
  top: 0;
  z-index: 999;
  justify-content: center;
`;

const TabsWrapper = styled.div`
  display: flex;
  width: 100%;
  max-width: 1200px;
  
  @media (min-width: 769px) {
    padding: 0 1rem;
  }
`;

const TabItem = styled.div<{ isActive: boolean }>`
  flex: 1;
  text-align: center;
  padding: 1rem 0;
  cursor: pointer;
  font-weight: ${({ isActive }) => (isActive ? "bold" : "normal")};
  color: ${({ isActive }) => (isActive ? "var(--primary-button)" : "#555")};
  border-bottom: ${({ isActive }) =>
    isActive ? "3px solid var(--primary-button)" : "3px solid transparent"};
  transition: all 0.2s ease;
  
  &:hover {
    background-color: #f9f9f9;
    color: var(--primary-button);
  }
  
  @media (min-width: 769px) {
    max-width: 180px;
  }
  
  @media (max-width: 768px) {
    padding: 0.5rem 0;
    font-size: 0.7rem;
  }
`;

export default CategoryTabs; 
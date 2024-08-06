import React from "react";
import styled from "@emotion/styled";
import { useRouter } from "next/router";
import { useRecoilState } from "recoil";
import { categoriesState, selectedCategoryState } from "../store/atoms";

const CategoryList: React.FC = () => {
  const [categories] = useRecoilState(categoriesState);
  const [selectedCategory, setSelectedCategory] = useRecoilState(selectedCategoryState);
  const router = useRouter();

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    router.push(`/community/${categoryId}`);
  };

  return (
    <CategoryContainer>
      {categories.map((category) => (
        <div key={category.id}>
          <CategoryTitle>{category.name}</CategoryTitle>
          {category.subcategories?.map((subcategory) => (
            <CategoryItem
              key={subcategory.id}
              onClick={() => handleCategorySelect(subcategory.id)}
              selected={selectedCategory === subcategory.id}
            >
              {subcategory.name}
            </CategoryItem>
          ))}
        </div>
      ))}
    </CategoryContainer>
  );
};

const CategoryContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

const CategoryTitle = styled.h3`
  margin: 0;
  padding: 0.5rem;
  background-color: #f8f9fa;
`;

const CategoryItem = styled.div<{ selected: boolean }>`
  padding: 0.5rem;
  cursor: pointer;
  background-color: ${({ selected }) => (selected ? "#e9ecef" : "transparent")};

  &:hover {
    background-color: #e9ecef;
  }
`;

export default CategoryList;

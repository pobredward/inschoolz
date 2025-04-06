import React, { useState } from "react";
import styled from "@emotion/styled";
import { useRecoilValue } from "recoil";
import { categoriesState, userState } from "../store/atoms";
import { FaSearch } from "react-icons/fa";

interface SubcategoryMenuProps {
  activeMajorCategory: string;
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
  isOpen: boolean;
}

const SubcategoryMenu: React.FC<SubcategoryMenuProps> = ({
  activeMajorCategory,
  selectedCategory,
  onSelectCategory,
  isOpen,
}) => {
  const categories = useRecoilValue(categoriesState);
  const user = useRecoilValue(userState);
  const [searchTerm, setSearchTerm] = useState("");

  const activeCategory = categories.find((cat) => cat.id === activeMajorCategory);
  
  const subcategories = activeCategory?.subcategories || [];
  
  const filteredSubcategories = searchTerm
    ? subcategories.filter((subcat) =>
        subcat.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : subcategories;

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  return (
    <MenuContainer>
      <MenuWrapper>
        {/* 게시판 검색 주석 처리
        <SearchBar>
          <SearchInput
            type="text"
            placeholder="게시판 검색"
            value={searchTerm}
            onChange={handleSearch}
          />
          <SearchIcon>
            <FaSearch />
          </SearchIcon>
        </SearchBar>
        */}

        <SubcategoryList>
          {filteredSubcategories.map((subcat) => (
            <SubcategoryItem
              key={subcat.id}
              isActive={selectedCategory === subcat.id}
              onClick={() => onSelectCategory(subcat.id)}
            >
              {subcat.name}
            </SubcategoryItem>
          ))}
        </SubcategoryList>
      </MenuWrapper>
    </MenuContainer>
  );
};

const MenuContainer = styled.div`
  display: flex;
  justify-content: center;
  background-color: white;
  border-bottom: 1px solid #eaeaea;
  padding: 0.5rem 0;
`;

const MenuWrapper = styled.div`
  width: 100%;
  max-width: 1200px;
  padding: 0 1rem;
  
  @media (max-width: 768px) {
    max-height: 300px;
    overflow-y: auto;
  }
`;

const SearchBar = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
  max-width: 300px;
`;

const SearchInput = styled.input`
  flex: 1;
  padding: 0.7rem;
  border: none;
  outline: none;
`;

const SearchIcon = styled.div`
  padding: 0 0.8rem;
  color: #777;
`;

const SubcategoryList = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 0.5rem;
  
  @media (max-width: 768px) {
    gap: 0.4rem;
    // justify-content: center;
  }
`;

const SubcategoryItem = styled.div<{ isActive: boolean }>`
  padding: 0.5rem 0.8rem;
  cursor: pointer;
  background-color: ${({ isActive }) => (isActive ? "#f0f0f0" : "transparent")};
  border-radius: 4px;
  font-weight: ${({ isActive }) => (isActive ? "bold" : "normal")};
  flex: 0 0 auto;
  margin-bottom: 0.5rem;
  border: 1px solid #eaeaea;
  font-size: 0.8rem;
  
  ${({ isActive }) => isActive && `
    border-color: var(--primary-button);
  `}
  
  @media (max-width: 768px) {
    padding: 0.4rem 0.6rem;
    font-size: 0.7rem;
  }
  
  &:hover {
    background-color: #f5f5f5;
    border-color: var(--primary-button);
  }
`;

export default SubcategoryMenu; 
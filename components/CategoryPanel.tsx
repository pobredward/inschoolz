// components/CategoryPanel.tsx

import React, { useState, useEffect } from "react";
import { useRecoilState, useRecoilValue } from "recoil";
import {
  categoriesState,
  selectedCategoryState,
  userState,
} from "../store/atoms";
import { Category } from "../types";
import { useRouter } from "next/router";
import styled from "@emotion/styled";
import { FaStar, FaSearch, FaUndo } from "react-icons/fa";
import { toggleFavoriteMinorGallery } from "../services/userService";

interface CategoryPanelProps {
  isOpen: boolean;
}

const CategoryPanel: React.FC<CategoryPanelProps> = ({ isOpen }) => {
  const [selectedCategory, setSelectedCategory] = useRecoilState(
    selectedCategoryState
  );
  const categories = useRecoilValue(categoriesState);
  const [user, setUser] = useRecoilState(userState);
  const router = useRouter();

  const [activeMajorCategory, setActiveMajorCategory] = useState("national");
  const [isMinorGalleryOpen, setIsMinorGalleryOpen] = useState(false);
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

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    router.push(`/community/${categoryId}`);
  };

  const toggleMinorGallery = () => {
    setIsMinorGalleryOpen(!isMinorGalleryOpen);
  };

  const handleMinorGallerySelect = (galleryId: string) => {
    handleCategorySelect(galleryId);
    setIsMinorGalleryOpen(false);
  };

  const handleToggleFavorite = async (galleryId: string) => {
    if (user) {
      const isFavorite = user.favoriteGalleries?.includes(galleryId) || false;
      const favoriteGalleries = user.favoriteGalleries || [];
      const updatedFavorites = isFavorite
        ? favoriteGalleries.filter((id) => id !== galleryId)
        : [...favoriteGalleries, galleryId];

      setUser({
        ...user,
        favoriteGalleries: updatedFavorites,
      });

      // Firestore 업데이트
      await toggleFavoriteMinorGallery(user.uid, galleryId);
    }
  };

  const handleSearch = () => {
    const filtered = allMinorGalleries.filter((gallery) =>
      gallery.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredGalleries(filtered);
  };

  const handleReset = () => {
    setSearchTerm("");
    setFilteredGalleries(allMinorGalleries);
  };

  return (
    <CategorySection isOpen={isOpen}>
      <MajorCategoryList>
        {categories.map((cat) => (
          <MajorCategoryItem
            key={cat.id}
            onClick={() => setActiveMajorCategory(cat.id)}
            isActive={activeMajorCategory === cat.id}
          >
            {cat.name}
          </MajorCategoryItem>
        ))}
      </MajorCategoryList>
      <SubcategoryList>
        {categories
          .find((cat) => cat.id === activeMajorCategory)
          ?.subcategories?.map((subcat) =>
            subcat.id === "national-minor" ? (
              <MinorGalleryContainer key={subcat.id}>
                <MinorGalleryToggle onClick={toggleMinorGallery}>
                  {subcat.name}
                  {isMinorGalleryOpen ? " ▲" : " ▼"}
                </MinorGalleryToggle>
                {isMinorGalleryOpen && (
                  <>
                    <FavoriteGalleriesSection>
                      {user?.favoriteGalleries?.map((galleryId) => {
                        const gallery = allMinorGalleries.find(
                          (g) => g.id === galleryId
                        );
                        return (
                          gallery && (
                            <SubcategoryItem
                              key={gallery.id}
                              onClick={() => handleCategorySelect(gallery.id)}
                              isActive={selectedCategory === gallery.id}
                            >
                              <span>{gallery.name}</span>
                              <StarIcon
                                isFavorite={true}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleFavorite(gallery.id);
                                }}
                              >
                                <FaStar />
                              </StarIcon>
                            </SubcategoryItem>
                          )
                        );
                      })}
                    </FavoriteGalleriesSection>
                    <SearchContainer>
                      <SearchInput
                        type="text"
                        placeholder="게시판 검색"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                      />
                      <SearchButton onClick={handleSearch}>
                        <FaSearch />
                      </SearchButton>
                      <ResetButton onClick={handleReset}>
                        <FaUndo />
                      </ResetButton>
                    </SearchContainer>
                    <MinorGalleryList>
                      {filteredGalleries.map((minorGallery) => (
                        <SubcategoryItem
                          key={minorGallery.id}
                          onClick={() =>
                            handleMinorGallerySelect(minorGallery.id)
                          }
                          isActive={selectedCategory === minorGallery.id}
                        >
                          <span>{minorGallery.name}</span>
                          <StarIcon
                            isFavorite={user?.favoriteGalleries?.includes(
                              minorGallery.id
                            ) || false}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFavorite(minorGallery.id);
                            }}
                          >
                            <FaStar />
                          </StarIcon>
                        </SubcategoryItem>
                      ))}
                    </MinorGalleryList>
                  </>
                )}
              </MinorGalleryContainer>
            ) : (
              <SubcategoryItem
                key={subcat.id}
                onClick={() => handleCategorySelect(subcat.id)}
                isActive={selectedCategory === subcat.id}
              >
                {subcat.name}
              </SubcategoryItem>
            )
          )}
      </SubcategoryList>
    </CategorySection>
  );
};

const FavoriteGalleriesSection = styled.div`
  margin-bottom: 1rem;
  margin-left: 1rem;
`;

const SearchContainer = styled.div`
  display: flex;
  margin-bottom: 1rem;
  margin-left: 1rem;
`;

const SearchInput = styled.input`
  flex-grow: 1;
  max-width: 80px;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px 0 0 4px;
`;

const SearchButton = styled.button`
  padding: 0.5rem;
  background-color: var(--primary-button);
  color: white;
  border: none;
  cursor: pointer;
`;

const ResetButton = styled(SearchButton)`
  border-radius: 0 4px 4px 0;
  background-color: #6c757d;
`;

const StarIcon = styled.span<{ isFavorite?: boolean }>`
  color: ${({ isFavorite }) => (isFavorite ? "gold" : "#ccc")};
  cursor: pointer;
  font-size: 1rem;
`;

const MinorGalleryContainer = styled.div`
  margin-bottom: 10px;
`;

const MinorGalleryToggle = styled.div`
  padding: 0.5rem;
  cursor: pointer;
  &:hover {
    background-color: #f0f0f0;
  }
`;

const MinorGalleryList = styled.div`
  margin-left: 1rem;
  transition: max-height 0.3s ease-in-out;
`;

const CategorySection = styled.div<{ isOpen: boolean }>`
  display: flex;
  width: 250px;
  height: calc(100vh - 150px);
  background-color: white;
  transition: transform 0.3s ease-in-out;

  @media (max-width: 768px) {
    position: fixed;
    top: 60px;
    left: 0;
    transform: ${({ isOpen }) =>
      isOpen ? "translateX(0)" : "translateX(-100%)"};
    z-index: 1000;
  }
`;

const MajorCategoryList = styled.div`
  width: 50px;
  border-right: 1px solid #e0e0e0;
  overflow-y: auto;
`;

const SubcategoryList = styled.div`
  flex: 1;
  padding: 0.5rem;
  overflow-y: auto;
`;

const SubcategoryItem = styled.div<{ isActive: boolean }>`
  padding: 0.5rem;
  cursor: pointer;
  background-color: ${({ isActive }) => (isActive ? "#f0f0f0" : "transparent")};
  display: flex;
  justify-content: space-between;
  align-items: center;

  &:hover {
    background-color: #f0f0f0;
  }
`;

const MajorCategoryItem = styled.div<{ isActive: boolean }>`
  padding: 1rem;
  cursor: pointer;
  background-color: ${({ isActive }) => (isActive ? "#f0f0f0" : "transparent")};
  &:hover {
    background-color: #f0f0f0;
  }
`;

export default CategoryPanel;

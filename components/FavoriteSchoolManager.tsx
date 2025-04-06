import React, { useState, useEffect } from "react";
import styled from "@emotion/styled";
import { useRecoilState } from "recoil";
import { userState } from "../store/atoms";
import { doc, getDoc, collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import { toggleFavoriteSchool } from "../services/userService";
import { FaSearch, FaStar, FaRegStar, FaSchool, FaInfoCircle, FaTimes } from "react-icons/fa";
import DefaultModal from "./modal/DefaultModal";

interface School {
  id: string;
  KOR_NAME: string;
  ADDRESS: string;
}

const MAX_FAVORITE_SCHOOLS = 5; // 즐겨찾기 학교 최대 개수

const FavoriteSchoolManager: React.FC = () => {
  const [user, setUser] = useRecoilState(userState);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<School[]>([]);
  const [favoriteSchools, setFavoriteSchools] = useState<School[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    const fetchFavoriteSchools = async () => {
      if (user && user.favoriteSchools && user.favoriteSchools.length > 0) {
        const schoolPromises = user.favoriteSchools.map(async (schoolId) => {
          const schoolDoc = await getDoc(doc(db, "schools", schoolId));
          if (schoolDoc.exists()) {
            const data = schoolDoc.data();
            return {
              id: schoolDoc.id,
              KOR_NAME: data.KOR_NAME,
              ADDRESS: data.ADDRESS
            };
          }
          return null;
        });

        const schools = (await Promise.all(schoolPromises)).filter(school => school !== null) as School[];
        setFavoriteSchools(schools);
      }
    };

    fetchFavoriteSchools();
  }, [user]);

  const handleSearch = async () => {
    if (!searchTerm) return;
    
    setIsSearching(true);
    try {
      // 학교 검색 로직 구현
      const schoolsRef = collection(db, "schools");
      const q = query(
        schoolsRef,
        where("KOR_NAME", ">=", searchTerm),
        where("KOR_NAME", "<=", searchTerm + '\uf8ff'),
        limit(10)
      );
      
      const querySnapshot = await getDocs(q);
      const results: School[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        results.push({
          id: doc.id,
          KOR_NAME: data.KOR_NAME,
          ADDRESS: data.ADDRESS
        });
      });
      
      setSearchResults(results);
    } catch (error) {
      console.error("Error searching schools:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearchResults = () => {
    setSearchResults([]);
    setSearchTerm("");
  };

  const handleToggleFavorite = async (schoolId: string) => {
    if (!user) return;
    
    // 이미 즐겨찾기에 있는 경우 -> 제거할 때
    const isRemoving = user.favoriteSchools?.includes(schoolId);
    
    // 추가하려는 경우 -> 최대 개수 체크
    if (!isRemoving && user.favoriteSchools && user.favoriteSchools.length >= MAX_FAVORITE_SCHOOLS) {
      alert(`즐겨찾기 학교는 최대 ${MAX_FAVORITE_SCHOOLS}개까지 추가할 수 있습니다.`);
      return;
    }
    
    try {
      await toggleFavoriteSchool(user.uid, schoolId);
      
      // 로컬 상태 업데이트 (user.favoriteSchools는 string[] 타입)
      const userFavoriteSchools = user.favoriteSchools || [];
      const updatedUserFavorites = isRemoving
        ? userFavoriteSchools.filter(id => id !== schoolId)
        : [...userFavoriteSchools, schoolId];
      
      setUser({
        ...user,
        favoriteSchools: updatedUserFavorites,
      });
      
      // 즐겨찾기 학교 목록 다시 가져오기 (favoriteSchools는 School[] 타입)
      const updatedSchool = searchResults.find(school => school.id === schoolId);
      
      if (updatedSchool) {
        if (isRemoving) {
          // 즐겨찾기에서 제거
          setFavoriteSchools(prevFavoriteSchools => 
            prevFavoriteSchools.filter(school => school.id !== schoolId)
          );
        } else {
          // 즐겨찾기에 추가
          setFavoriteSchools(prevFavoriteSchools => 
            [...prevFavoriteSchools, updatedSchool]
          );
        }
      }
    } catch (error) {
      console.error("Error toggling favorite school:", error);
    }
  };

  const schoolInfoContent = `
    📚 즐겨찾기 학교 안내 📚

    - 즐겨찾기 학교는 최대 5개까지 등록할 수 있습니다.
    - 내 학교 외에도 다양한 학교를 즐겨찾기에 추가하여 학교 게시판을 쉽게 볼 수 있습니다.
    - 초등학교, 중학교, 고등학교 등 여러 학교를 등록하여 이용할 수 있습니다.
    - 즐겨찾기한 학교는 '학교' 게시판에서 쉽게 전환하여 볼 수 있습니다.
  `;

  return (
    <Container>
      <TitleContainer>
        <SectionTitle>즐겨찾기 학교</SectionTitle>
        <InfoIcon onClick={() => setShowInfoModal(true)}>
          <FaInfoCircle />
        </InfoIcon>
      </TitleContainer>
      
      <SearchContainer>
        <SearchInput
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="학교 이름 검색..."
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        />
        <SearchButton onClick={handleSearch} disabled={isSearching}>
          {isSearching ? "검색 중..." : <FaSearch />}
        </SearchButton>
      </SearchContainer>

      {searchResults.length > 0 && (
        <ResultsSection>
          <HeaderContainer>
            <SectionSubtitle>검색 결과</SectionSubtitle>
            <ClearButton onClick={clearSearchResults}>
              <FaTimes /> 초기화
            </ClearButton>
          </HeaderContainer>
          <SchoolList>
            {searchResults.map((school) => {
              const isFavorite = user?.favoriteSchools?.includes(school.id) || false;
              return (
                <SchoolItem key={school.id}>
                  <SchoolInfo>
                    <SchoolName>{school.KOR_NAME}</SchoolName>
                    <SchoolAddress>{school.ADDRESS}</SchoolAddress>
                  </SchoolInfo>
                  <FavoriteButton 
                    onClick={() => handleToggleFavorite(school.id)}
                    isFavorite={isFavorite}
                    disabled={!isFavorite && favoriteSchools.length >= MAX_FAVORITE_SCHOOLS}
                    title={!isFavorite && favoriteSchools.length >= MAX_FAVORITE_SCHOOLS 
                      ? `즐겨찾기 학교는 최대 ${MAX_FAVORITE_SCHOOLS}개까지 추가할 수 있습니다.` 
                      : ''}
                  >
                    {isFavorite ? (
                      <FaStar />
                    ) : (
                      <FaRegStar />
                    )}
                  </FavoriteButton>
                </SchoolItem>
              );
            })}
          </SchoolList>
        </ResultsSection>
      )}

      <FavoritesSection>
        <HeaderContainer>
          <SectionSubtitle>즐겨찾기한 학교</SectionSubtitle>
          <FavoriteCount>{favoriteSchools.length}/{MAX_FAVORITE_SCHOOLS}</FavoriteCount>
        </HeaderContainer>
        {favoriteSchools.length > 0 ? (
          <SchoolList>
            {favoriteSchools.map((school) => (
              <SchoolItem key={school.id}>
                <SchoolIcon>
                  <FaSchool />
                </SchoolIcon>
                <SchoolInfo>
                  <SchoolName>{school.KOR_NAME}</SchoolName>
                  <SchoolAddress>{school.ADDRESS}</SchoolAddress>
                </SchoolInfo>
                <FavoriteButton 
                  onClick={() => handleToggleFavorite(school.id)}
                  isFavorite={true}
                >
                  <FaStar />
                </FavoriteButton>
              </SchoolItem>
            ))}
          </SchoolList>
        ) : (
          <EmptyMessage>즐겨찾기한 학교가 없습니다</EmptyMessage>
        )}
      </FavoritesSection>
      
      <DefaultModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title="즐겨찾기 학교 안내"
        message={schoolInfoContent}
      />
    </Container>
  );
};

const Container = styled.div`
  margin: 20px 0;
`;

const TitleContainer = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 20px;
`;

const SectionTitle = styled.h2`
  font-size: 1.5rem;
  color: #333;
  margin-right: 10px;
  margin-bottom: 0;
`;

const InfoIcon = styled.div`
  color: #4a6dff;
  cursor: pointer;
  font-size: 1.2rem;
  
  &:hover {
    color: #2a4ddf;
  }
`;

const HeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
`;

const FavoriteCount = styled.span`
  font-size: 0.9rem;
  color: #666;
  font-weight: 500;
`;

const ClearButton = styled.button`
  background-color: transparent;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 5px;
  
  &:hover {
    color: #333;
  }
`;

const SectionSubtitle = styled.h3`
  font-size: 1.2rem;
  color: #555;
  margin-bottom: 0;
`;

const SearchContainer = styled.div`
  display: flex;
  margin-bottom: 20px;
`;

const SearchInput = styled.input`
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px 0 0 4px;
  font-size: 1rem;
`;

const SearchButton = styled.button`
  padding: 10px 15px;
  background-color: #4a6dff;
  color: white;
  border: none;
  border-radius: 0 4px 4px 0;
  cursor: pointer;
  
  &:disabled {
    background-color: #a0a0a0;
  }
`;

const ResultsSection = styled.div`
  margin-bottom: 30px;
`;

const FavoritesSection = styled.div`
  margin-top: 20px;
`;

const SchoolList = styled.ul`
  list-style: none;
  padding: 0;
`;

const SchoolItem = styled.li`
  display: flex;
  align-items: center;
  padding: 15px;
  border: 1px solid #eee;
  border-radius: 4px;
  margin-bottom: 10px;
  background-color: white;
`;

const SchoolIcon = styled.div`
  margin-right: 15px;
  color: #4a6dff;
  font-size: 1.2rem;
`;

const SchoolInfo = styled.div`
  flex: 1;
`;

const SchoolName = styled.div`
  font-weight: 500;
  margin-bottom: 5px;
`;

const SchoolAddress = styled.div`
  font-size: 0.8rem;
  color: #777;
`;

const FavoriteButton = styled.button<{ isFavorite: boolean; disabled?: boolean }>`
  background: transparent;
  border: none;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  color: ${props => props.disabled ? '#ccc' : props.isFavorite ? '#FFD700' : '#aaa'};
  font-size: 1.2rem;
  
  &:hover {
    color: ${props => props.disabled ? '#ccc' : props.isFavorite ? '#FFB700' : '#888'};
  }
`;

const EmptyMessage = styled.div`
  padding: 20px;
  text-align: center;
  color: #777;
  background-color: #f9f9f9;
  border-radius: 4px;
`;

export default FavoriteSchoolManager; 
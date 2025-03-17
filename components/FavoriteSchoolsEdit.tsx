import React, { useState, useEffect } from "react";
import styled from "@emotion/styled";
import { useRecoilState } from "recoil";
import { userState } from "../store/atoms";
import { doc, getDoc, collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import { toggleFavoriteSchool } from "../services/userService";
import { FaSearch, FaStar, FaRegStar, FaSchool } from "react-icons/fa";

interface School {
  id: string;
  KOR_NAME: string;
  ADDRESS: string;
}

interface FavoriteSchoolsEditProps {
  onFavoriteSchoolsChange?: (favoriteSchools: string[]) => void;
}

const FavoriteSchoolsEdit: React.FC<FavoriteSchoolsEditProps> = ({
  onFavoriteSchoolsChange
}) => {
  const [user, setUser] = useRecoilState(userState);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<School[]>([]);
  const [favoriteSchools, setFavoriteSchools] = useState<School[]>([]);
  const [isSearching, setIsSearching] = useState(false);

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

  const handleToggleFavorite = async (schoolId: string) => {
    if (!user) return;
    
    try {
      await toggleFavoriteSchool(user.uid, schoolId);
      
      // 로컬 상태 업데이트
      const updatedFavorites = user.favoriteSchools?.includes(schoolId)
        ? user.favoriteSchools.filter(id => id !== schoolId)
        : [...(user.favoriteSchools || []), schoolId];
      
      // 전역 상태 업데이트
      setUser({
        ...user,
        favoriteSchools: updatedFavorites
      });
      
      // 부모 컴포넌트에 즐겨찾기 변경 알림
      if (onFavoriteSchoolsChange) {
        onFavoriteSchoolsChange(updatedFavorites);
      }
      
      // 즐겨찾기 학교 목록 다시 가져오기
      const updatedSchool = searchResults.find(school => school.id === schoolId);
      
      if (updatedSchool) {
        if (user.favoriteSchools?.includes(schoolId)) {
          // 즐겨찾기에서 제거
          setFavoriteSchools(favoriteSchools.filter(school => school.id !== schoolId));
        } else {
          // 즐겨찾기에 추가
          setFavoriteSchools([...favoriteSchools, updatedSchool]);
        }
      }
    } catch (error) {
      console.error("Error toggling favorite school:", error);
    }
  };

  return (
    <Container>
      <SearchContainer>
        <SearchInput
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="학교 이름 검색..."
        />
        <SearchButton onClick={handleSearch} disabled={isSearching}>
          {isSearching ? "검색 중..." : <FaSearch />}
        </SearchButton>
      </SearchContainer>

      {searchResults.length > 0 && (
        <ResultsSection>
          <SectionSubtitle>검색 결과</SectionSubtitle>
          <SchoolList>
            {searchResults.map((school) => (
              <SchoolItem key={school.id}>
                <SchoolInfo>
                  <SchoolName>{school.KOR_NAME}</SchoolName>
                  <SchoolAddress>{school.ADDRESS}</SchoolAddress>
                </SchoolInfo>
                <FavoriteButton 
                  onClick={() => handleToggleFavorite(school.id)}
                  isFavorite={user?.favoriteSchools?.includes(school.id) || false}
                >
                  {user?.favoriteSchools?.includes(school.id) ? (
                    <FaStar />
                  ) : (
                    <FaRegStar />
                  )}
                </FavoriteButton>
              </SchoolItem>
            ))}
          </SchoolList>
        </ResultsSection>
      )}

      <FavoritesSection>
        <SectionSubtitle>즐겨찾기한 학교</SectionSubtitle>
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
    </Container>
  );
};

const Container = styled.div`
  width: 100%;
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

const SectionSubtitle = styled.h3`
  font-size: 1.2rem;
  margin-bottom: 10px;
  color: #555;
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

const FavoriteButton = styled.button<{ isFavorite: boolean }>`
  background: transparent;
  border: none;
  cursor: pointer;
  color: ${props => props.isFavorite ? '#FFD700' : '#aaa'};
  font-size: 1.2rem;
  
  &:hover {
    color: ${props => props.isFavorite ? '#FFB700' : '#888'};
  }
`;

const EmptyMessage = styled.div`
  padding: 20px;
  text-align: center;
  color: #777;
  background-color: #f9f9f9;
  border-radius: 4px;
`;

export default FavoriteSchoolsEdit; 
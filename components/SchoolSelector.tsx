import React, { useState, useEffect } from "react";
import styled from "@emotion/styled";
import { useRecoilState } from "recoil";
import { userState, selectedSchoolState } from "../store/atoms";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { FaSchool, FaChevronDown } from "react-icons/fa";

interface SchoolInfo {
  id: string;
  KOR_NAME: string;
  ADDRESS: string;
}

const SchoolSelector: React.FC = () => {
  const [user] = useRecoilState(userState);
  const [selectedSchool, setSelectedSchool] = useRecoilState(selectedSchoolState);
  const [favoriteSchools, setFavoriteSchools] = useState<SchoolInfo[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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

        const schools = (await Promise.all(schoolPromises)).filter(school => school !== null) as SchoolInfo[];
        setFavoriteSchools(schools);
        
        // 선택된 학교가 없으면 첫 번째 학교를 기본으로 선택
        if (selectedSchool === "" && schools.length > 0) {
          setSelectedSchool(schools[0].id);
        }
      }
    };

    fetchFavoriteSchools();
  }, [user, setSelectedSchool, selectedSchool]);

  const handleSchoolSelect = (schoolId: string) => {
    setSelectedSchool(schoolId);
    setIsDropdownOpen(false);
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const getCurrentSchoolName = () => {
    const school = favoriteSchools.find(s => s.id === selectedSchool);
    return school ? school.KOR_NAME : "학교 선택";
  };

  if (!user || !user.favoriteSchools || user.favoriteSchools.length === 0) {
    return null;
  }

  return (
    <Container>
      <SelectorButton onClick={toggleDropdown}>
        <FaSchool />
        <SchoolName>{getCurrentSchoolName()}</SchoolName>
        <FaChevronDown />
      </SelectorButton>
      
      {isDropdownOpen && (
        <DropdownMenu>
          {favoriteSchools.map((school) => (
            <SchoolItem 
              key={school.id}
              onClick={() => handleSchoolSelect(school.id)}
              isSelected={school.id === selectedSchool}
            >
              {school.KOR_NAME}
            </SchoolItem>
          ))}
        </DropdownMenu>
      )}
    </Container>
  );
};

const Container = styled.div`
  position: relative;
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
  padding: 10px 0;
`;

const SelectorButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 15px;
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background-color: #eaeaea;
  }
  
  svg {
    margin-right: 8px;
    color: #4a6dff;
  }
  
  &:last-child {
    margin-left: 8px;
  }
`;

const SchoolName = styled.span`
  flex: 1;
  text-align: left;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const DropdownMenu = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  max-height: 300px;
  overflow-y: auto;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 5px;
  z-index: 10;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
`;

const SchoolItem = styled.div<{ isSelected: boolean }>`
  padding: 10px 15px;
  cursor: pointer;
  transition: background-color 0.2s;
  background-color: ${(props) => (props.isSelected ? "#eef2ff" : "white")};
  font-weight: ${(props) => (props.isSelected ? "600" : "normal")};
  
  &:hover {
    background-color: ${(props) => (props.isSelected ? "#eef2ff" : "#f9f9f9")};
  }
`;

export default SchoolSelector; 
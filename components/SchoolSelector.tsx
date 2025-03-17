import React, { useState, useEffect } from "react";
import styled from "@emotion/styled";
import { userState, selectedSchoolState } from "../store/atoms";
import { useRecoilState, useRecoilValue } from "recoil";
import { useAuth } from "../hooks/useAuth";
import { FaSchool, FaCaretDown } from "react-icons/fa";
import { db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { School } from "../types";

interface SchoolInfo {
  id: string;
  KOR_NAME: string;
  ADDRESS: string;
}

const SchoolSelector: React.FC = () => {
  const { user } = useAuth();
  const [selectedSchool, setSelectedSchool] = useRecoilState(selectedSchoolState);
  const [schools, setSchools] = useState<School[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const fetchFavoriteSchools = async () => {
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const favoriteSchoolIds = userDoc.data().favoriteSchools || [];
          const favoriteSchoolDocs = await Promise.all(
            favoriteSchoolIds.map((id: string) => getDoc(doc(db, "schools", id)))
          );
          const fetchedSchools = favoriteSchoolDocs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as School));
          setSchools(fetchedSchools);

          // 선택된 학교가 없으면 첫 번째 학교를 기본으로 선택
          if (selectedSchool === null && fetchedSchools.length > 0) {
            setSelectedSchool(fetchedSchools[0]);
          }
        }
      }
    };

    fetchFavoriteSchools();
  }, [user, setSelectedSchool, selectedSchool]);

  const handleSchoolSelect = (school: School) => {
    setSelectedSchool(school);
    setIsDropdownOpen(false);
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const getCurrentSchoolName = () => {
    if (selectedSchool) {
      return selectedSchool.KOR_NAME;
    }
    return "학교 선택";
  };

  if (!user || !user.favoriteSchools || user.favoriteSchools.length === 0) {
    return null;
  }

  return (
    <Container>
      <SelectorButton onClick={toggleDropdown}>
        <FaSchool />
        <SchoolName>{getCurrentSchoolName()}</SchoolName>
        <FaCaretDown />
      </SelectorButton>
      
      {isDropdownOpen && (
        <DropdownMenu>
          {schools.map((school) => (
            <SchoolItem 
              key={school.id}
              onClick={() => handleSchoolSelect(school)}
              isSelected={selectedSchool !== null && school.id === selectedSchool.id}
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
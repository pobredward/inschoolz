import React, { useEffect, useState } from "react";
import styled from "@emotion/styled";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  startAfter,
  where,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import Layout from "../components/Layout";
import { useAuth } from "../hooks/useAuth";
import { FaUserCircle } from "react-icons/fa";
import Head from "next/head";

interface UserRank {
  userId: string;
  schoolName: string;
  address1: string;
  address2: string;
  level: number;
  experience: number;
  profileImageUrl?: string;
  rank?: number;
}

const ITEMS_PER_PAGE = 10;

const RankingPage: React.FC = () => {
  const [rankings, setRankings] = useState<UserRank[]>([]);
  const [activeTab, setActiveTab] = useState<"national" | "school">("national");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false);
  const { user } = useAuth();
  const [lastVisible, setLastVisible] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  const fetchRankings = async () => {
    if (!user && activeTab === "school") {
      console.error("User not logged in for school rankings");
      return;
    }

    const usersRef = collection(db, "users");
    let q;

    if (activeTab === "national") {
      if (currentPage === 1) {
        q = query(
          usersRef,
          orderBy("level", "desc"),
          orderBy("experience", "desc"),
          limit(ITEMS_PER_PAGE)
        );
      } else if (lastVisible) {
        q = query(
          usersRef,
          orderBy("level", "desc"),
          orderBy("experience", "desc"),
          startAfter(lastVisible),
          limit(ITEMS_PER_PAGE)
        );
      } else {
        return; // Cannot fetch data without lastVisible
      }
    } else if (activeTab === "school" && user?.schoolId) {
      if (currentPage === 1) {
        q = query(
          usersRef,
          where("schoolId", "==", user.schoolId),
          orderBy("level", "desc"),
          orderBy("experience", "desc"),
          limit(ITEMS_PER_PAGE)
        );
      } else if (lastVisible) {
        q = query(
          usersRef,
          where("schoolId", "==", user.schoolId),
          orderBy("level", "desc"),
          orderBy("experience", "desc"),
          startAfter(lastVisible),
          limit(ITEMS_PER_PAGE)
        );
      } else {
        return; // Cannot fetch data without lastVisible
      }
    } else {
      console.error("Invalid activeTab or missing user schoolId");
      return;
    }

    try {
      const querySnapshot = await getDocs(q);
      const rankingsData: UserRank[] = [];
      querySnapshot.forEach((doc) => {
        rankingsData.push({
          ...(doc.data() as UserRank),
          rank: (currentPage - 1) * ITEMS_PER_PAGE + rankingsData.length + 1,
        });
      });

      setRankings(rankingsData);
      setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);

      const countQuery =
        activeTab === "national"
          ? query(usersRef)
          : query(usersRef, where("schoolId", "==", user?.schoolId));
      const countSnapshot = await getDocs(countQuery);
      setTotalPages(Math.ceil(countSnapshot.size / ITEMS_PER_PAGE));
    } catch (error) {
      console.error("Error fetching rankings:", error);
    }
  };

  useEffect(() => {
    fetchRankings();
  }, [activeTab, currentPage, user]);

  const handleSearch = () => {
    if (!searchTerm) return;

    const filteredData = rankings.filter((entry) =>
      entry.userId.toLowerCase().includes(searchTerm.toLowerCase())
    );

    setRankings(filteredData);
    setIsSearchActive(true);
  };

  const handleReset = () => {
    setSearchTerm("");
    setIsSearchActive(false);
    setCurrentPage(1);
    fetchRankings(); // 랭킹을 원래 상태로 초기화
  };

  const handleTabChange = (tab: "national" | "school") => {
    setActiveTab(tab);
    setCurrentPage(1);
    setLastVisible(null);
    setIsSearchActive(false);
    setSearchTerm("");
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    if (page === 1) {
      setLastVisible(null);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <Layout>
      <Head>
        <title>랭킹</title>
        <meta property="og:title" content="랭킹" />
        <meta
          property="og:description"
          content="다양한 학교에 속한 학생들의 순위를 확인하세요."
        />
        <meta property="og:url" content="https://www.inschoolz.com/ranking" />
      </Head>
      <RankingContainer>
        {/* <h1>랭킹</h1> */}
        <TabContainer>
          <Tab
            active={activeTab === "national"}
            onClick={() => handleTabChange("national")}
          >
            전국 랭킹
          </Tab>
          <Tab
            active={activeTab === "school"}
            onClick={() => handleTabChange("school")}
          >
            우리학교 랭킹
          </Tab>
        </TabContainer>
        <SearchContainer>
          <SearchInput
            type="text"
            placeholder="사용자 ID 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={handleKeyPress} // 엔터키로 검색 실행
          />
          <ButtonWrapper>
            <SearchButton onClick={handleSearch}>검색</SearchButton>
            <ResetButton onClick={handleReset}>초기화</ResetButton>
          </ButtonWrapper>
        </SearchContainer>
        <UserCardContainer>
          {rankings.map((user) => (
            <UserCard key={user.userId}>
              <Rank>{user.rank}</Rank>
              {user.profileImageUrl ? (
                <ProfileImage
                  src={user.profileImageUrl}
                  alt={`${user.profileImageUrl} 프로필`}
                />
              ) : (
                <DefaultProfileIcon />
              )}
              <UserInfo>
                <UserName>{user.userId}</UserName>
                <UserDetails>
                  {user.schoolName} | {user.address1} {user.address2}
                </UserDetails>
              </UserInfo>
              <Level>Lv.{user.level}</Level>
            </UserCard>
          ))}
        </UserCardContainer>
        {!isSearchActive && (
          <Pagination>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <PageButton
                key={page}
                active={currentPage === page}
                onClick={() => handlePageChange(page)}
              >
                {page}
              </PageButton>
            ))}
          </Pagination>
        )}
      </RankingContainer>
    </Layout>
  );
};

const RankingContainer = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  padding: 1rem;

  @media (max-width: 768px) {
    padding: 0.5rem;
  }
`;

const TabContainer = styled.div`
  display: flex;
  margin-bottom: 1rem;
`;

const Tab = styled.button<{ active: boolean }>`
  padding: 0.5rem 1rem;
  background-color: ${(props) =>
    props.active ? `var(--primary-button)` : "#f2f2f2"};
  color: ${(props) => (props.active ? "white" : "black")};
  border: none;
  cursor: pointer;
  margin-right: 0.5rem;
`;

const SearchContainer = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
`;

const SearchInput = styled.input`
  flex-grow: 1;
  padding: 0.5rem;
  margin-right: 0.5rem;

  @media (max-width: 768px) {
    max-width: 120px;
  }
`;

const ButtonWrapper = styled.div`
  display: flex;
  gap: 2px;
`;

const SearchButton = styled.button`
  padding: 0.5rem 1rem;
  background-color: var(--primary-button);
  color: white;
  border: none;
  cursor: pointer;

  &:hover {
    background-color: var(--primary-hover);
  }
`;

const ResetButton = styled.button`
  padding: 0.5rem 1rem;
  background-color: #f44336;
  color: white;
  border: none;
  cursor: pointer;
  margin-left: 0.5rem;
`;

const UserCardContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  @media (max-width: 768px) {
    gap: 0.3rem;
  }
`;

const UserCard = styled.div`
  display: flex;
  align-items: center;
  padding: 1rem;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 0px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  @media (max-width: 768px) {
    padding: 0.7rem;
  }
`;

const Rank = styled.div`
  font-weight: bold;
  margin-right: 1rem;

  @media (max-width: 768px) {
    margin-right: 0.5rem;
  }
`;

const ProfileImage = styled.img`
  width: 50px;
  height: 50px;
  border-radius: 50%;
  margin-right: 0.5rem;
`;

const DefaultProfileIcon = styled(FaUserCircle)`
  width: 50px;
  height: 50px;
  border-radius: 50%;
  margin-right: 0.5rem;
`;

const UserInfo = styled.div`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
`;

const UserName = styled.div`
  font-weight: bold;
  margin-bottom: 0.5rem;
`;

const UserDetails = styled.div`
  color: #777;
  font-size: 0.9rem;

  @media (max-width: 768px) {
    font-size: 0.7rem;
  }
`;

const Level = styled.div`
  font-weight: bold;
  font-size: 1rem;
  color: #333;
`;

const Pagination = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 1rem;
`;

const PageButton = styled.button<{ active: boolean }>`
  padding: 0.5rem 1rem;
  margin: 0 0.25rem;
  background-color: ${(props) =>
    props.active ? `var(--primary-button)` : "#f2f2f2"};
  color: ${(props) => (props.active ? "white" : "black")};
  border: none;
  cursor: pointer;
`;

export default RankingPage;

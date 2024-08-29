import React, { useState, useEffect } from "react";
import Link from "next/link";
import Layout from "../../components/Layout";
import Leaderboard from "../../components/Leaderboard";
import styled from "@emotion/styled";
import { FaBolt, FaFeather, FaTh, FaInfoCircle } from "react-icons/fa";
import DefaultModal from "../../components/modal/DefaultModal";
import {
  getExperienceSettings,
  ExperienceSettings,
} from "../../utils/experience";
import Head from "next/head";

const GamePage: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [experienceSettings, setExperienceSettings] =
    useState<ExperienceSettings | null>(null);

  useEffect(() => {
    const fetchExperienceSettings = async () => {
      const settings = await getExperienceSettings();
      setExperienceSettings(settings);
    };
    fetchExperienceSettings();
  }, []);

  const handleInfoClick = () => {
    setShowModal(true);
  };

  const modalContent = experienceSettings
    ? `
    반응속도 게임: ${experienceSettings.reactionGameThreshold}ms 이하로 클리어 시 ${experienceSettings.reactionGameExperience}XP 획득
    타일 게임: ${experienceSettings.tileGameThreshold}점 이상 획득 시 ${experienceSettings.tileGameExperience}XP 획득
    플래피 버드: ${experienceSettings.flappyBirdThreshold}점 이상 획득 시 ${experienceSettings.flappyBirdExperience}XP 획득
  `
    : "게임 정보를 불러오는 중...";

  return (
    <Layout>
      <Head>
        <title>미니게임</title>
        <meta
          property="og:title"
          content="미니게임"
        />
        <meta
          property="og:description"
          content="다른 학교 친구들과 미니게임을 통해 경쟁하세요."
        />
        <meta property="og:url" content="https://www.inschoolz.com/game" />
      </Head>
      <GameContainer>
        <TitleContainer>
          <GameTitle>미니게임</GameTitle>
          <InfoIcon onClick={handleInfoClick}>
            <FaInfoCircle size={24} />
          </InfoIcon>
        </TitleContainer>
        <GameSection>
          <GameCard href="/game/reactiongame">
            <IconWrapper>
              <FaBolt size={24} />
            </IconWrapper>
            <GameText>반응속도 게임</GameText>
          </GameCard>
          <GameCard href="/game/tilegame">
            <IconWrapper>
              <FaTh size={24} />
            </IconWrapper>
            <GameText>타일 게임</GameText>
          </GameCard>
          <GameCard href="/game/flappybird">
            <IconWrapper>
              <FaFeather size={24} />
            </IconWrapper>
            <GameText>플래피 버드</GameText>
          </GameCard>
        </GameSection>
        <LeaderboardSection>
          <Leaderboard />
        </LeaderboardSection>
      </GameContainer>
      <DefaultModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="경험치 획득 조건"
        message={modalContent}
      />
    </Layout>
  );
};

const GameContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  max-width: 800px;
  margin: 0 auto;

  @media (max-width: 768px) {
    padding: 0.5rem;
  }
`;

const TitleContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  position: relative;
  margin-bottom: 1rem;
`;

const GameTitle = styled.h2`
  text-align: center;
  margin-bottom: 1rem;
`;

const InfoIcon = styled.div`
  position: absolute;
  right: 0;
  cursor: pointer;
  color: #666;

  &:hover {
    color: #333;
  }
`;

const SectionTitle = styled.h2`
  text-align: center;
  margin-bottom: 1rem;
  width: 100%;
`;

const GameSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  margin-bottom: 2rem;
`;

const GameCard = styled(Link)`
  display: flex;
  align-items: center;
  padding: 1.5rem;
  background-color: white;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  text-decoration: none;
  color: #333;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
  }
`;

const IconWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  background-color: #f0f0f0;
  border-radius: 50%;
  margin-right: 1rem;
`;

const GameText = styled.span`
  font-size: 1.2rem;
  font-weight: bold;
`;

const LeaderboardSection = styled.div`
  width: 100%;
`;

export default GamePage;

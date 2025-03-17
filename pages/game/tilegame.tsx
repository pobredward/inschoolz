import React, { useState, useEffect, useRef } from "react";
import Layout from "../../components/Layout";
import styled from "@emotion/styled";
import { useAuth } from "../../hooks/useAuth";
import { db } from "../../lib/firebase";
import { doc, setDoc, getDoc, updateDoc, increment } from "firebase/firestore";
import Link from "next/link";
import DefaultModal from "../../components/modal/DefaultModal";
import ExperienceModal from "../../components/modal/ExperienceModal";
import {
  updateUserExperience,
  getExperienceSettings,
} from "../../utils/experience";
import { useSetRecoilState, useRecoilState } from "recoil";
import { userExperienceState, userLevelState } from "../../store/atoms";

const TileGame: React.FC = () => {
  const [tiles, setTiles] = useState<number[]>([]);
  const [gameState, setGameState] = useState<
    "waiting" | "playing" | "gameover"
  >("waiting");
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState({ title: "", message: "" });
  const [remainingPlays, setRemainingPlays] = useState<number | null>(null);
  const [timer, setTimer] = useState(0.8);
  const { user } = useAuth();
  const [showExpModal, setShowExpModal] = useState(false);
  const [expGained, setExpGained] = useState(0);
  const [newLevel, setNewLevel] = useState<number | undefined>(undefined);
  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const setUserExperience = useSetRecoilState(userExperienceState);
  const [userLevel, setUserLevel] = useRecoilState(userLevelState);
  const [lastLevelUp, setLastLevelUp] = useState<number | null>(null);

  useEffect(() => {
    if (user) {
      fetchBestScore();
      updateRemainingPlays();
    } else {
      const localBestScore = localStorage.getItem("tileGameBestScore");
      if (localBestScore) {
        setBestScore(parseInt(localBestScore));
      }
      const localRemainingPlays = localStorage.getItem(
        "tileGameRemainingPlays"
      );
      setRemainingPlays(
        localRemainingPlays ? parseInt(localRemainingPlays) : 5
      );
    }
  }, [user]);

  useEffect(() => {
    if (gameState === "playing") {
      intervalRef.current = window.setInterval(() => {
        setTimer((prev) => Math.max(prev - 0.01, 0));
      }, 10);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [gameState]);

  useEffect(() => {
    if (timer === 0 && gameState === "playing") {
      endGame();
    }
  }, [timer]);

  const fetchBestScore = async () => {
    if (user) {
      const scoreDoc = await getDoc(doc(db, "tileGameScores", user.uid));
      if (scoreDoc.exists()) {
        setBestScore(scoreDoc.data().bestScore);
      }
    }
  };

  const getUserGameInfo = async (userId: string) => {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) {
      throw new Error("User data not found");
    }
    const gameInfo = userDoc.data().gameInfo || {
      tileGamePlays: 0,
    };

    const today = new Date().toISOString().split("T")[0];
    if (gameInfo.lastResetDate !== today) {
      gameInfo.tileGamePlays = 0;
      gameInfo.lastResetDate = today;

      await updateDoc(doc(db, "users", userId), {
        "gameInfo.tileGamePlays": 0,
        "gameInfo.lastResetDate": today,
      });
    }

    return gameInfo;
  };

  const updateRemainingPlays = async () => {
    if (user) {
      const gameInfo = await getUserGameInfo(user.uid);
      const settings = await getExperienceSettings();

      const remaining = settings.maxDailyGames - gameInfo.tileGamePlays;
      setRemainingPlays(remaining);
    }
  };

  const startGame = () => {
    if (remainingPlays === 0) {
      setModalContent({
        title: "게임 불가",
        message: user
          ? "오늘의 게임 횟수를 모두 사용했습니다."
          : "게임 횟수를 모두 사용했습니다. 로그인하여 내 점수를 기록하고 친구들과 비교해보세요!",
      });
      setShowModal(true);
      return;
    }

    setGameState("playing");
    setScore(0);
    setTimer(0.8);
    generateTiles();
  };

  const generateTiles = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const newTiles = Array(8).fill(0);
    const blackTileIndex = Math.floor(Math.random() * 8);
    newTiles[blackTileIndex] = 1;
    setTiles(newTiles);

    timeoutRef.current = window.setTimeout(() => {
      endGame();
    }, 800);
  };

  const handleTileClick = async (index: number) => {
    if (gameState !== "playing") return;

    if (tiles[index] === 1) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      setScore((prev) => prev + 1);
      setTimer(0.8);
      generateTiles();
    } else {
      endGame();
    }
  };

  const endGame = async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setGameState("gameover");

    if (user) {
      try {
        await handleGameScore(user.uid, score);

        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
          "gameInfo.tileGamePlays": increment(1),
        });

        await updateRemainingPlays();
        showResult(score);
      } catch (error) {
        if (error instanceof Error) {
          setModalContent({
            title: "오류",
            message: error.message,
          });
          setShowModal(true);
        }
      }
    } else {
      const newRemainingPlays = (remainingPlays || 5) - 1;
      setRemainingPlays(newRemainingPlays);
      localStorage.setItem(
        "tileGameRemainingPlays",
        newRemainingPlays.toString()
      );
      showResult(score);
    }
  };

  const handleGameScore = async (userId: string, score: number) => {
    const settings = await getExperienceSettings();
    if (score >= settings.tileGameThreshold) {
      const result = await updateUserExperience(
        userId,
        settings.tileGameExperience,
        "타일 게임 성공"
      );
      setExpGained(result.expGained);
      setUserExperience(result.newExperience);
      setUserLevel(result.newLevel);

      if (result.levelUp && result.newLevel !== lastLevelUp) {
        setLastLevelUp(result.newLevel);
        setNewLevel(result.newLevel);
      } else {
        setNewLevel(undefined);
      }

      setShowExpModal(true);
    }
  };

  const showResult = async (gameScore: number) => {
    if (user) {
      if (!bestScore || gameScore > bestScore) {
        await setDoc(doc(db, "tileGameScores", user.uid), {
          userId: user.userId,
          schoolName: user.schoolName,
          address1: user.address1,
          address2: user.address2,
          bestScore: gameScore,
        });
        setBestScore(gameScore);
        setModalContent({
          title: "새로운 최고 기록!",
          message: `축하합니다! 새로운 최고 점수: ${gameScore}`,
        });
      } else {
        setModalContent({
          title: "게임 종료",
          message: `점수: ${gameScore}\n최고 점수: ${bestScore}`,
        });
      }
    } else {
      const localBestScore = localStorage.getItem("tileGameBestScore");
      if (!localBestScore || gameScore > parseInt(localBestScore)) {
        localStorage.setItem("tileGameBestScore", gameScore.toString());
        setBestScore(gameScore);
        setModalContent({
          title: "새로운 최고 기록!",
          message: `축하합니다! 새로운 최고 점수: ${gameScore}\n회원가입하여 기록을 저장하고 랭킹에 등록하세요!`,
        });
      } else {
        setModalContent({
          title: "게임 종료",
          message: `점수: ${gameScore}\n최고 점수: ${localBestScore}`,
        });
      }
    }
    setShowModal(true);
  };

  return (
    <Layout>
      <GameContainer>
        <GameTitle>타일 게임</GameTitle>
        <GameArea>
          {tiles.map((tile, index) => (
            <TileButton
              key={index}
              onClick={() => handleTileClick(index)}
              isBlack={tile === 1}
              disabled={gameState !== "playing"}
            />
          ))}
        </GameArea>
        <ScoreBoard>
          <ScoreText>타이머: {timer.toFixed(2)}초</ScoreText>
          <ScoreText>점수: {score}</ScoreText>
          {bestScore !== null && <ScoreText>최고 점수: {bestScore}</ScoreText>}
          <ScoreText>남은 플레이 횟수: {remainingPlays}</ScoreText>
        </ScoreBoard>
        <StartButton onClick={startGame} disabled={gameState === "playing"}>
          게임 시작
        </StartButton>
        <BackButton href="/game">메인 메뉴로 돌아가기</BackButton>
      </GameContainer>
      <DefaultModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={modalContent.title}
        message={modalContent.message}
      />
      <ExperienceModal
        isOpen={showExpModal}
        onClose={() => setShowExpModal(false)}
        expGained={expGained}
        newLevel={newLevel}
      />
    </Layout>
  );
};

const GameContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  /* background-color: #f0f8ff; */
  border-radius: 15px;
  /* box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); */
  max-width: 500px;
  margin: 0rem auto;
`;

const GameTitle = styled.h1`
  font-size: 1.5rem;
  color: #2c3e50;
  margin-bottom: 2rem;
  text-align: center;
`;

const GameArea = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 70px);
  grid-gap: 10px;
  margin-bottom: 2rem;
  background-color: #ffffff;
  padding: 20px;
  border-radius: 10px;
  /* box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); */
`;

const TileButton = styled.button<{
  isBlack: boolean;
  disabled?: boolean;
}>`
  width: 70px;
  height: 70px;
  background-color: ${(props) => (props.isBlack ? "#333" : "#fff")};
  border: 2px solid #ccc;
  border-radius: 5px;
  cursor: ${(props) => (props.disabled ? "default" : "pointer")};
  transition: all 0.3s ease;

  &:hover {
    transform: ${(props) => (props.disabled ? "none" : "scale(1.05)")};
    box-shadow: ${(props) =>
      props.disabled ? "none" : "0 4px 8px rgba(0, 0, 0, 0.2)"};
  }
`;

const ScoreBoard = styled.div`
  background-color: #ffffff;
  padding: 1rem;
  border-radius: 10px;
  margin-top: 1rem;
  width: 100%;
  max-width: 300px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const ScoreText = styled.p`
  font-size: 1rem;
  color: #34495e;
  margin: 0.5rem 0;
  text-align: center;
`;

const StartButton = styled.button`
  margin-top: 1.5rem;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  background-color: var(--primary-button);
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s;
  font-weight: bold;

  &:disabled {
    background-color: #95a5a6;
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    background-color: var(--primary-hover);
  }
`;

const BackButton = styled(Link)`
  margin-top: 1rem;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  background-color: #ecf0f1;
  color: #34495e;
  text-decoration: none;
  border-radius: 5px;
  transition: background-color 0.3s;
  font-weight: bold;

  &:hover {
    background-color: #bdc3c7;
  }
`;

export default TileGame;

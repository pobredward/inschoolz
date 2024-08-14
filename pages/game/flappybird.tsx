import React, { useState, useEffect, useRef } from "react";
import Layout from "../../components/Layout";
import styled from "@emotion/styled";
import { useAuth } from "../../hooks/useAuth";
import { db } from "../../lib/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import Link from "next/link";
import DefaultModal from "../../components/modal/DefaultModal";
import { useMediaQuery } from "react-responsive";
import {
  updateUserExperience,
  getExperienceSettings,
} from "../../utils/experience";
import ExperienceModal from "../../components/modal/ExperienceModal";

// 상수 정의
const GRAVITY = 0.2;
const JUMP_STRENGTH = -6;
const PIPE_SPEED = 1.5;
const PIPE_WIDTH = 50;
const PIPE_GAP = 200;

const FlappyBird: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameOver, setGameOver] = useState(true);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState({ title: "", message: "" });
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });

  const birdRef = useRef({ y: 250, velocity: 0 });
  const pipesRef = useRef<{ x: number; topHeight: number }[]>([]);
  const scoreRef = useRef(0);
  const gameOverRef = useRef(true);
  const animationFrameId = useRef<number | null>(null);
  const [showExpModal, setShowExpModal] = useState(false);
  const [expGained, setExpGained] = useState(0);
  const [newLevel, setNewLevel] = useState<number | undefined>(undefined);
  const [showDefaultModal, setShowDefaultModal] = useState(false);
  const [defaultModalContent, setDefaultModalContent] = useState({
    title: "",
    message: "",
  });

  useEffect(() => {
    if (user) {
      fetchBestScore();
    }
  }, [user]);

  const fetchBestScore = async () => {
    if (user) {
      const scoreDoc = await getDoc(doc(db, "flappyBirdScores", user.uid));
      if (scoreDoc.exists()) {
        setBestScore(scoreDoc.data().bestScore);
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const gameLoop = () => {
      if (gameOverRef.current) {
        if (animationFrameId.current !== null) {
          cancelAnimationFrame(animationFrameId.current);
        }
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update bird position
      birdRef.current.velocity += GRAVITY;
      birdRef.current.y += birdRef.current.velocity;

      // Update pipes
      const pipeSpeed = isMobile ? PIPE_SPEED * 0.8 : PIPE_SPEED;
      const pipeGap = isMobile ? PIPE_GAP * 1.2 : PIPE_GAP;

      pipesRef.current.forEach((pipe) => {
        pipe.x -= pipeSpeed;
      });

      // Remove off-screen pipes
      pipesRef.current = pipesRef.current.filter(
        (pipe) => pipe.x > -PIPE_WIDTH,
      );

      // Add new pipes
      if (
        pipesRef.current.length === 0 ||
        pipesRef.current[pipesRef.current.length - 1].x < canvas.width - 200
      ) {
        const topHeight = Math.random() * (canvas.height - pipeGap - 100) + 50;
        pipesRef.current.push({ x: canvas.width, topHeight });
      }

      // Check collisions
      const bird = birdRef.current;
      pipesRef.current.forEach((pipe) => {
        if (
          bird.y < pipe.topHeight ||
          bird.y > pipe.topHeight + pipeGap ||
          bird.y > canvas.height - 20 ||
          bird.y < 0
        ) {
          if (pipe.x < 50 && pipe.x + PIPE_WIDTH > 30) {
            endGame();
          }
        }
      });

      // Update score
      pipesRef.current.forEach((pipe) => {
        if (pipe.x + PIPE_WIDTH < 30 && pipe.x + PIPE_WIDTH >= 28) {
          scoreRef.current++;
          setScore(scoreRef.current);
        }
      });

      // Draw bird
      ctx.fillStyle = "yellow";
      ctx.fillRect(30, bird.y, 20, 20);

      // Draw pipes
      ctx.fillStyle = "green";
      pipesRef.current.forEach((pipe) => {
        ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
        ctx.fillRect(
          pipe.x,
          pipe.topHeight + pipeGap,
          PIPE_WIDTH,
          canvas.height - pipe.topHeight - pipeGap,
        );
      });

      // Draw score
      ctx.fillStyle = "black";
      ctx.font = "24px Arial";
      ctx.fillText(`Score: ${scoreRef.current}`, 10, 30);

      animationFrameId.current = requestAnimationFrame(gameLoop);
    };

    if (!gameOverRef.current) {
      gameLoop();
    }

    return () => {
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [gameOver, isMobile]);

  const startGame = () => {
    setGameOver(false);
    gameOverRef.current = false;
    setScore(0);
    scoreRef.current = 0;
    birdRef.current = { y: 250, velocity: 0 };
    pipesRef.current = [];
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
    requestAnimationFrame(gameLoop);
  };

  const gameLoop = () => {
    if (gameOverRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update bird position
    birdRef.current.velocity += GRAVITY;
    birdRef.current.y += birdRef.current.velocity;

    // Update pipes
    const pipeSpeed = isMobile ? PIPE_SPEED * 0.8 : PIPE_SPEED;
    const pipeGap = isMobile ? PIPE_GAP * 1.2 : PIPE_GAP;

    pipesRef.current.forEach((pipe) => {
      pipe.x -= pipeSpeed;
    });

    // Remove off-screen pipes
    pipesRef.current = pipesRef.current.filter((pipe) => pipe.x > -PIPE_WIDTH);

    // Add new pipes
    if (
      pipesRef.current.length === 0 ||
      pipesRef.current[pipesRef.current.length - 1].x < canvas.width - 200
    ) {
      const topHeight = Math.random() * (canvas.height - pipeGap - 100) + 50;
      pipesRef.current.push({ x: canvas.width, topHeight });
    }

    // Check collisions
    const bird = birdRef.current;
    pipesRef.current.forEach((pipe) => {
      if (
        bird.y < pipe.topHeight ||
        bird.y > pipe.topHeight + pipeGap ||
        bird.y > canvas.height - 20 ||
        bird.y < 0
      ) {
        if (pipe.x < 50 && pipe.x + PIPE_WIDTH > 30) {
          endGame();
          return;
        }
      }
    });

    // Update score
    pipesRef.current.forEach((pipe) => {
      if (pipe.x + PIPE_WIDTH < 30 && pipe.x + PIPE_WIDTH >= 28) {
        scoreRef.current++;
        setScore(scoreRef.current);
      }
    });

    // Draw bird
    ctx.fillStyle = "yellow";
    ctx.fillRect(30, bird.y, 20, 20);

    // Draw pipes
    ctx.fillStyle = "green";
    pipesRef.current.forEach((pipe) => {
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
      ctx.fillRect(
        pipe.x,
        pipe.topHeight + pipeGap,
        PIPE_WIDTH,
        canvas.height - pipe.topHeight - pipeGap,
      );
    });

    // Draw score
    ctx.fillStyle = "black";
    ctx.font = "24px Arial";
    ctx.fillText(`Score: ${scoreRef.current}`, 10, 30);

    requestAnimationFrame(gameLoop);
  };

  const endGame = async () => {
    if (gameOverRef.current) return;

    gameOverRef.current = true;
    setGameOver(true);

    let message = `점수: ${scoreRef.current}\n최고 점수: ${bestScore}`;
    let newBestScore = false;

    if (user && scoreRef.current > bestScore) {
      await setDoc(doc(db, "flappyBirdScores", user.uid), {
        userId: user.userId,
        schoolName: user.schoolName,
        address1: user.address1,
        address2: user.address2,
        bestScore: scoreRef.current,
      });
      setBestScore(scoreRef.current);
      newBestScore = true;
      message += "\n새로운 최고 점수를 달성했습니다!";
    }

    setDefaultModalContent({
      title: "게임 오버",
      message: message,
    });
    setShowDefaultModal(true);

    if (user) {
      try {
        await handleGameScore(user.uid, scoreRef.current);
      } catch (error) {
        console.error("Error updating experience:", error);
      }
    }
  };

  const handleGameScore = async (userId: string, score: number) => {
    const settings = await getExperienceSettings();
    if (score >= settings.flappyBirdThreshold) {
      const result = await updateUserExperience(
        userId,
        settings.flappyBirdExperience,
        "Flappy Bird 게임 성공",
      );
      setExpGained(result.expGained);
      if (result.levelUp) {
        setNewLevel(result.newLevel);
      }
      setShowExpModal(true);
    }
  };

  const handleExpModalClose = () => {
    setShowExpModal(false);
  };

  const handleDefaultModalClose = () => {
    setShowDefaultModal(false);
    // 게임 재시작 로직 추가
  };

  const handleJump = () => {
    if (!gameOverRef.current) {
      birdRef.current.velocity = JUMP_STRENGTH;
    }
  };

  return (
    <Layout>
      <GameContainer>
        <h1>Flappy Bird</h1>
        <Canvas
          ref={canvasRef}
          width={isMobile ? 300 : 400}
          height={isMobile ? 450 : 600}
          onClick={handleJump}
        />
        {gameOver && <StartButton onClick={startGame}>게임 시작</StartButton>}
        <p>최고 점수: {bestScore}</p>
        <BackButton href="/game">메인 메뉴로 돌아가기</BackButton>
      </GameContainer>
      <ExperienceModal
        isOpen={showExpModal}
        onClose={handleExpModalClose}
        expGained={expGained}
        newLevel={newLevel}
      />
      <DefaultModal
        isOpen={showDefaultModal}
        onClose={handleDefaultModalClose}
        title={defaultModalContent.title}
        message={defaultModalContent.message}
      />
    </Layout>
  );
};

const GameContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
`;

const Canvas = styled.canvas<{ width: number; height: number }>`
  border: 1px solid black;
  width: ${(props) => props.width}px;
  height: ${(props) => props.height}px;
`;

const StartButton = styled.button`
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  font-size: 18px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;

  &:hover {
    background-color: #45a049;
  }
`;

const BackButton = styled(Link)`
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  font-size: 16px;
  background-color: #f0f0f0;
  color: #333;
  text-decoration: none;
  border-radius: 5px;
  transition: background-color 0.3s;

  &:hover {
    background-color: #e0e0e0;
  }
`;

export default FlappyBird;

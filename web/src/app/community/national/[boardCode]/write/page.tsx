import React from "react";
import { Metadata } from "next";
import { BoardType } from "@/types/board";
import WritePageClient from "@/components/board/WritePageClient";

interface WritePageProps {
  params: Promise<{
    boardCode: string;
  }>;
}

export async function generateMetadata({ params }: WritePageProps): Promise<Metadata> {
  const { boardCode } = await params;
  
  return {
    title: `새 글쓰기 - 전국 커뮤니티 - Inschoolz`,
    description: `전국 커뮤니티에서 새로운 게시글을 작성해보세요.`,
    robots: 'noindex, nofollow', // 글쓰기 페이지는 검색엔진에서 제외
  };
}

export default async function NationalBoardWritePage({ params }: WritePageProps) {
  const { boardCode } = await params;
  
  return (
    <WritePageClient 
      type={"national" as BoardType} 
      code={boardCode} 
    />
  );
} 
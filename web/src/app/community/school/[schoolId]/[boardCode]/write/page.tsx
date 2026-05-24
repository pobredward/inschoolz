import React from "react";
import { Metadata } from "next";
import { BoardType } from "@/types/board";
import WritePageClient from "@/components/board/WritePageClient";

interface WritePageProps {
  params: Promise<{
    schoolId: string;
    boardCode: string;
  }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `새 글쓰기 - 학교 커뮤니티 - Inschoolz`,
    description: `학교 커뮤니티에서 새로운 게시글을 작성해보세요.`,
    robots: 'noindex, nofollow', // 글쓰기 페이지는 검색엔진에서 제외
  };
}

export default async function SchoolBoardWritePage({ params }: WritePageProps) {
  const { schoolId, boardCode } = await params;
  
  return (
    <WritePageClient 
      type={"school" as BoardType} 
      code={boardCode} 
      schoolId={schoolId}
    />
  );
} 
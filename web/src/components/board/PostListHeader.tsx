"use client";

import React from "react";
import Link from "next/link";
import { ChevronLeft, Star, PenLine } from "lucide-react";
import { BoardType } from "@/types/board";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PostListHeaderProps {
  board: {
    code: string;
    name: string;
    description?: string;
    stats?: {
      postCount: number;
      activeUserCount: number;
    };
  }; // 게시판 정보
  type: BoardType;
}

export default function PostListHeader({ board, type }: PostListHeaderProps) {
  const [isFavorite, setIsFavorite] = React.useState(false);
  
  const toggleFavorite = () => {
    // 즐겨찾기 토글 로직
    setIsFavorite(!isFavorite);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/board/${type}`} className="flex items-center hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4 mr-1" />
          게시판 목록
        </Link>
        <span className="mx-1">›</span>
        <span className="font-medium text-foreground">{board.name}</span>
      </div>
      
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{board.name}</h1>
          <p className="mt-2 text-muted-foreground">{board.description}</p>
          
          <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <span>게시글</span>
              <span className="font-semibold text-foreground">{board.stats?.postCount || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <span>활성 사용자</span>
              <span className="font-semibold text-foreground">{board.stats?.activeUserCount || 0}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFavorite}
            className={cn(
              "transition-all",
              isFavorite && "text-yellow-500 hover:text-yellow-600"
            )}
          >
            <Star className={cn("h-5 w-5", isFavorite && "fill-yellow-500")} />
            <span className="sr-only">즐겨찾기 {isFavorite ? '해제' : '추가'}</span>
          </Button>
          
          <Button asChild>
            <Link href={`/board/${type}/${board.code}/write`}>
              <PenLine className="h-4 w-4 mr-2" />
              글쓰기
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
} 
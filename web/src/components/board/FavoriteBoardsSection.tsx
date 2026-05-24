"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Star } from "lucide-react";
import { BoardType } from "@/types/board";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface FavoriteBoardsSectionProps {
  type: BoardType;
}

export default function FavoriteBoardsSection({ type }: FavoriteBoardsSectionProps) {
  const router = useRouter();
  
  // 임시 데이터 (실제로는 API 호출로 대체)
  const favoriteBoards = [
    {
      id: "1",
      code: "free",
      name: "자유게시판",
      description: "자유롭게 이야기를 나누는 공간입니다.",
      stats: {
        postCount: 1245,
      }
    },
    {
      id: "2",
      code: "study",
      name: "공부 정보",
      description: "공부와 관련된 정보를 공유하는 공간입니다.",
      stats: {
        postCount: 872,
      }
    }
  ];
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">즐겨찾는 게시판</h2>
      </div>
      
      {favoriteBoards.length > 0 ? (
        <div className="space-y-2">
          {favoriteBoards.map((board) => (
            <Card 
              key={board.id}
              className="transition-all hover:shadow-md cursor-pointer"
              onClick={() => router.push(`/community/${type}/${board.code}`)}
            >
              <CardHeader className="p-4 pb-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{board.name}</CardTitle>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => {
                    e.stopPropagation(); // 부모 카드의 클릭 이벤트 전파 방지
                    // 즐겨찾기 삭제 로직
                  }}>
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="sr-only">즐겨찾기 해제</span>
                  </Button>
                </div>
                <CardDescription className="line-clamp-1">
                  {board.description}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="p-4 pt-2">
                <div className="flex items-center text-sm text-muted-foreground">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  <span>{board.stats.postCount}개의 게시글</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="py-6 text-center bg-muted rounded-lg">
          <p className="text-muted-foreground text-sm">즐겨찾는 게시판이 없습니다.</p>
          <p className="text-muted-foreground text-xs mt-1">
            게시판 목록에서 ⭐ 버튼을 클릭하여 
            <br />
            즐겨찾기에 추가할 수 있습니다.
          </p>
        </div>
      )}
    </div>
  );
} 
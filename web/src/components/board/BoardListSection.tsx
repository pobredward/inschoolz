"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Board } from "@/types";
import { AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PostList from "@/components/board/PostList";
import { BoardType } from "@/types/board";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface BoardListSectionProps {
  boards?: Board[];
}

export default function BoardListSection({ 
  boards = []
}: BoardListSectionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // URL에서 boardCode 파라미터 가져오기
  const boardCodeParam = searchParams.get("boardCode");
  
  // 초기 선택 게시판 결정 (URL에서 가져오거나 첫 번째 게시판 선택)
  const initialBoardCode = useMemo(() => {
    if (boardCodeParam && boards.some(board => board.code === boardCodeParam)) {
      return boardCodeParam;
    }
    return boards.length > 0 ? boards[0].code : null;
  }, [boardCodeParam, boards]);
  
  const [selectedBoardCode, setSelectedBoardCode] = useState<string | null>(initialBoardCode);
  
  // URL 파라미터 변경 시 선택된 게시판 업데이트
  useEffect(() => {
    if (boardCodeParam && boardCodeParam !== selectedBoardCode) {
      setSelectedBoardCode(boardCodeParam);
    }
  }, [boardCodeParam, selectedBoardCode]);
  
  const selectedBoard = useMemo(() => 
    boards.find(board => board.code === selectedBoardCode),
    [boards, selectedBoardCode]
  );
  
  // 게시판 유형 추출
  const type = useMemo(() => {
    if (!boards.length) return "national" as BoardType;
    const firstBoard = boards[0];
    if (firstBoard.type === "national" || firstBoard.type === "regional" || firstBoard.type === "school") {
      return firstBoard.type;
    }
    return "national" as BoardType;
  }, [boards]);
  
  // 소주제 변경 시 URL 업데이트
  const handleBoardChange = (boardCode: string) => {
    if (boardCode === selectedBoardCode) return;
    
    // 현재 URL에서 새 searchParams 생성
    const params = new URLSearchParams(searchParams);
    params.set("boardCode", boardCode);
    
    // 라우팅 업데이트
    router.push(`${pathname}?${params.toString()}`);
    setSelectedBoardCode(boardCode);
  };
  
  return (
    <div className="space-y-6">
      <Tabs 
        defaultValue={selectedBoardCode || "default"} 
        value={selectedBoardCode || undefined}
        className="w-full"
      >
        <TabsList className="flex flex-wrap h-auto mb-6 w-full bg-transparent justify-start">
          {boards.map(board => (
            <TabsTrigger 
              key={board.code} 
              value={board.code}
              onClick={() => handleBoardChange(board.code)}
              className="px-4 py-2 mr-2 mb-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {board.name}
            </TabsTrigger>
          ))}
        </TabsList>
        
        {boards.map(board => (
          <TabsContent key={board.code} value={board.code} className="mt-0">
            {selectedBoard && (
              <PostList 
                boardCode={board.code}
                type={type}
                page={1}
                sort="latest"
                keyword=""
                filter="all"
              />
            )}
          </TabsContent>
        ))}
        
        {boards.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            <AlertTriangle className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>게시판 목록을 불러올 수 없습니다.</p>
            <p className="text-sm">잠시 후 다시 시도해주세요.</p>
          </div>
        )}
      </Tabs>
    </div>
  );
} 
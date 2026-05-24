"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import BoardListSection from "@/components/board/BoardListSection";
import { Board } from "@/types";

type BoardType = "national" | "school" | "regional";

// 임시 목 데이터 (실제 환경에서는 API에서 가져옴)
const MOCK_BOARDS: Record<BoardType, Board[]> = {
  national: [
    
  ],
  school: [
  ],
  regional: [
  ]
};

export default function BoardsPage() {
  const [activeTab, setActiveTab] = useState<BoardType>("national");
  const [isLoading, setIsLoading] = useState(true);
  const [boards, setBoards] = useState<Board[]>([]);

  useEffect(() => {
    // 실제 환경에서는 API 호출을 통해 데이터를 가져옵니다
    const fetchBoards = async () => {
      setIsLoading(true);
      try {
        // 실제 API 호출 코드로 대체 예정
        // const response = await fetch(`/api/boards?type=${activeTab}`);
        // const data = await response.json();
        
        // 임시 데이터 사용
        setTimeout(() => {
          setBoards(MOCK_BOARDS[activeTab]);
          setIsLoading(false);
        }, 500); // 로딩 시뮬레이션
      } catch (error) {
        console.error("게시판 데이터를 불러오는데 실패했습니다:", error);
        setIsLoading(false);
      }
    };

    fetchBoards();
  }, [activeTab]);

  return (
    <main className="container py-6 max-w-5xl">
      <h1 className="text-3xl font-bold mb-2">게시판</h1>
      <p className="text-muted-foreground mb-6">
        다양한 주제의 게시판에서 소통하고 정보를 나눠보세요.
      </p>
      
      <Separator className="my-6" />
      
      <Tabs defaultValue="national" onValueChange={(value) => setActiveTab(value as BoardType)}>
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="national">전국 게시판</TabsTrigger>
          <TabsTrigger value="regional">지역 게시판</TabsTrigger>
          <TabsTrigger value="school">학교 게시판</TabsTrigger>
        </TabsList>
        
        {/* 전국 게시판 */}
        <TabsContent value="national" className="mt-0">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <BoardListSection 
              boards={boards}
            />
          )}
        </TabsContent>
        
        {/* 학교 게시판 */}
        <TabsContent value="school" className="mt-0">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <BoardListSection 
              boards={boards}
            />
          )}
        </TabsContent>
        
        {/* 지역 게시판 */}
        <TabsContent value="regional" className="mt-0">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <BoardListSection 
              boards={boards}
            />
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
} 
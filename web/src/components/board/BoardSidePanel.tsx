import React from "react";
import Link from "next/link";
import { Users, TrendingUp, Hash } from "lucide-react";
import { BoardType } from "@/types/board";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BoardSidePanelProps {
  boardCode: string;
  type: BoardType;
}

export default function BoardSidePanel({ boardCode, type }: BoardSidePanelProps) {
  // 실제 환경에서는 API 호출로 데이터 가져오기
  
  // 임시 데이터
  const activeUsers = 128;
  const popularTags = [
    { name: "수학", count: 42 },
    { name: "영어", count: 38 },
    { name: "대학입시", count: 35 },
    { name: "급식", count: 27 },
    { name: "자율학습", count: 24 },
    { name: "반수", count: 22 },
    { name: "동아리", count: 19 },
    { name: "수행평가", count: 18 },
  ];
  
  const relatedBoards = [
    { code: "exam", name: "시험정보" },
    { code: "self_study", name: "자습 꿀팁" },
    { code: "career", name: "진로 상담" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center">
            <Users className="h-4 w-4 mr-2" />
            현재 활동 사용자
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-bold">{activeUsers}명</p>
          <p className="text-xs text-muted-foreground mt-1">
            지금 이 게시판을 보고 있는 사용자 수입니다
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center">
            <Hash className="h-4 w-4 mr-2" />
            인기 태그
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {popularTags.map((tag) => (
              <Badge 
                key={tag.name} 
                variant="secondary"
                className="px-2 py-1 font-normal text-xs"
              >
                <Link href={`/board/${type}/${boardCode}?tag=${tag.name}`}>
                  #{tag.name} <span className="ml-1 opacity-60">({tag.count})</span>
                </Link>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center">
            <TrendingUp className="h-4 w-4 mr-2" />
            관련 게시판
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y">
            {relatedBoards.map((board) => (
              <li key={board.code}>
                <Link
                  href={`/board/${type}/${board.code}`}
                  className="block px-6 py-2.5 hover:bg-muted transition-colors"
                >
                  {board.name}
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
} 
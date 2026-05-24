"use client";

import React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

interface PostListFilterProps {
  sort: string;
  filter: string;
  board: {
    code: string;
    name: string;
    type: string;
  }; // 게시판 정보
}

export default function PostListFilter({ sort, filter, board }: PostListFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [keyword, setKeyword] = React.useState("");
  const [searchTarget, setSearchTarget] = React.useState("all");
  const [isAdvancedOpen, setIsAdvancedOpen] = React.useState(false);
  const [hasImage, setHasImage] = React.useState(false);
  const [hasPoll, setHasPoll] = React.useState(false);
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 검색 파라미터 구성
    const params = new URLSearchParams(searchParams);
    
    if (keyword) {
      params.set("keyword", keyword);
      params.set("target", searchTarget);
    } else {
      params.delete("keyword");
      params.delete("target");
    }
    
    // 고급 검색 옵션
    if (hasImage) {
      params.set("hasImage", "true");
    } else {
      params.delete("hasImage");
    }
    
    if (hasPoll) {
      params.set("hasPoll", "true");
    } else {
      params.delete("hasPoll");
    }
    
    // 정렬 옵션 유지
    if (sort !== "latest") {
      params.set("sort", sort);
    }
    
    // 시간 필터 유지
    if (filter !== "all") {
      params.set("filter", filter);
    }
    
    router.push(`${pathname}?${params.toString()}`);
  };
  
  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    
    if (value !== "latest") {
      params.set("sort", value);
    } else {
      params.delete("sort");
    }
    
    router.push(`${pathname}?${params.toString()}`);
  };
  
  const handleFilterChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    
    if (value !== "all") {
      params.set("filter", value);
    } else {
      params.delete("filter");
    }
    
    router.push(`${pathname}?${params.toString()}`);
  };
  
  React.useEffect(() => {
    // URL 파라미터에서 값 복원
    const keywordParam = searchParams.get("keyword") || "";
    const targetParam = searchParams.get("target") || "all";
    const hasImageParam = searchParams.get("hasImage") === "true";
    const hasPollParam = searchParams.get("hasPoll") === "true";
    
    setKeyword(keywordParam);
    setSearchTarget(targetParam);
    setHasImage(hasImageParam);
    setHasPoll(hasPollParam);
    
    // 고급 검색이 활성화되었는지 확인
    setIsAdvancedOpen(hasImageParam || hasPollParam);
  }, [searchParams]);

  return (
    <div className="space-y-4 bg-card border rounded-lg p-4">
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="flex gap-2">
          <Select
            value={searchTarget}
            onValueChange={setSearchTarget}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="검색 대상" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="title">제목</SelectItem>
              <SelectItem value="content">내용</SelectItem>
              <SelectItem value="author">작성자</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="relative flex-1">
            <Input
              type="text"
              placeholder="검색어를 입력하세요"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="pr-10"
            />
            {keyword && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={() => setKeyword("")}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">지우기</span>
              </Button>
            )}
          </div>
          
          <Button type="submit" variant="default">
            <Search className="h-4 w-4 mr-2" />
            검색
          </Button>
        </div>
        
        <Collapsible
          open={isAdvancedOpen}
          onOpenChange={setIsAdvancedOpen}
          className="space-y-2"
        >
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center p-0 h-auto">
                <SlidersHorizontal className="h-4 w-4 mr-1" />
                <span>고급 검색</span>
              </Button>
            </CollapsibleTrigger>
            
            {(hasImage || hasPoll) && (
              <div className="flex gap-1">
                {hasImage && (
                  <Badge variant="outline" className="text-xs">
                    이미지 첨부
                  </Badge>
                )}
                {hasPoll && (
                  <Badge variant="outline" className="text-xs">
                    투표 포함
                  </Badge>
                )}
              </div>
            )}
          </div>
          
          <CollapsibleContent className="space-y-4">
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="text-sm font-medium">포함 옵션</h3>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="hasImage"
                      checked={hasImage}
                      onCheckedChange={(checked) => setHasImage(checked as boolean)}
                    />
                    <label
                      htmlFor="hasImage"
                      className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      이미지 첨부 게시글
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="hasPoll"
                      checked={hasPoll}
                      onCheckedChange={(checked) => setHasPoll(checked as boolean)}
                    />
                    <label
                      htmlFor="hasPoll"
                      className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      투표 게시글
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </form>
      
      <Separator />
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">정렬:</span>
            <Select value={sort} onValueChange={handleSortChange}>
              <SelectTrigger className="w-[120px] h-8">
                <SelectValue placeholder="정렬 방식" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">최신순</SelectItem>
                <SelectItem value="popular">인기순</SelectItem>
                <SelectItem value="comments">댓글 많은순</SelectItem>
                <SelectItem value="views">조회수순</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">기간:</span>
            <Select value={filter} onValueChange={handleFilterChange}>
              <SelectTrigger className="w-[100px] h-8">
                <SelectValue placeholder="기간" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="today">오늘</SelectItem>
                <SelectItem value="week">이번 주</SelectItem>
                <SelectItem value="month">이번 달</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="text-sm text-muted-foreground">
          총 <span className="font-medium text-foreground">{(board as any).stats?.postCount || 0}</span>개의 게시글
        </div>
      </div>
    </div>
  );
} 
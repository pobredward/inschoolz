"use client";

import React from "react";
import { BoardType } from "@/types/board";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { useRouter } from "next/navigation";

interface BoardHeaderProps {
  type: BoardType;
}

export default function BoardHeader({ type }: BoardHeaderProps) {
  const router = useRouter();

  const handleTypeChange = (value: string) => {
    if (value && value !== type) {
      router.push(`/community/${value}`);
    }
  };

  return (
    <div>
      <ToggleGroup 
        type="single" 
        value={type} 
        onValueChange={handleTypeChange}
        className="border rounded-lg"
      >
        <ToggleGroupItem value="common" aria-label="전국 게시판" className="px-4">
          전국
        </ToggleGroupItem>
        <ToggleGroupItem value="regional" aria-label="지역 게시판" className="px-4">
          지역
        </ToggleGroupItem>
        <ToggleGroupItem value="school" aria-label="학교 게시판" className="px-4">
          학교
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
} 
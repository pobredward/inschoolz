"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight 
} from "lucide-react";

interface CommunityPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export default function CommunityPagination({
  currentPage,
  totalPages,
  onPageChange,
  className = ""
}: CommunityPaginationProps) {
  // 페이지 번호들을 계산하는 함수
  const getPageNumbers = () => {
    const maxVisiblePages = 10;
    const pages: number[] = [];
    
    if (totalPages <= maxVisiblePages) {
      // 전체 페이지가 10개 이하인 경우 모든 페이지 표시
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // 전체 페이지가 10개를 초과하는 경우
      const halfVisible = Math.floor(maxVisiblePages / 2);
      
      let startPage = Math.max(1, currentPage - halfVisible);
      let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
      
      // 끝쪽에서 조정
      if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  };

  const pageNumbers = getPageNumbers();

  const handlePageClick = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  };

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className={`flex items-center justify-center space-x-1 ${className}`}>
      {/* 처음 페이지로 */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => handlePageClick(1)}
        disabled={currentPage === 1}
        className="h-8 w-8 p-0"
        aria-label="첫 페이지"
      >
        <ChevronsLeft className="h-4 w-4" />
      </Button>
      
      {/* 이전 페이지 */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => handlePageClick(currentPage - 1)}
        disabled={currentPage === 1}
        className="h-8 w-8 p-0"
        aria-label="이전 페이지"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* 페이지 번호들 */}
      {pageNumbers.map((page) => (
        <Button
          key={page}
          variant={page === currentPage ? "default" : "outline"}
          size="sm"
          onClick={() => handlePageClick(page)}
          className="h-8 w-8 p-0"
          aria-label={`페이지 ${page}`}
          aria-current={page === currentPage ? "page" : undefined}
        >
          {page}
        </Button>
      ))}

      {/* 다음 페이지 */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => handlePageClick(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="h-8 w-8 p-0"
        aria-label="다음 페이지"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      
      {/* 마지막 페이지로 */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => handlePageClick(totalPages)}
        disabled={currentPage === totalPages}
        className="h-8 w-8 p-0"
        aria-label="마지막 페이지"
      >
        <ChevronsRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// 페이지네이션 정보 컴포넌트
interface PaginationInfoProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  className?: string;
}

export function PaginationInfo({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  className = ""
}: PaginationInfoProps) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className={`text-sm text-gray-600 ${className}`}>
      전체 {totalCount.toLocaleString()}개 중 {startItem.toLocaleString()}-{endItem.toLocaleString()}개 표시
      {totalPages > 1 && ` (${currentPage}/${totalPages} 페이지)`}
    </div>
  );
}

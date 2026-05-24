'use client';

import { useEffect, useState } from 'react';
import { parseHtmlContent, stripHtmlTags } from '@/lib/utils';

interface HtmlContentProps {
  content: string;
  className?: string;
  fallbackToText?: boolean;
}

export function HtmlContent({ content, className = '', fallbackToText = true }: HtmlContentProps) {
  const [parsedContent, setParsedContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const parseContent = async () => {
      try {
        setIsLoading(true);
        const parsed = await parseHtmlContent(content);
        setParsedContent(parsed);
      } catch (error) {
        console.error('HTML 파싱 오류:', error);
        // 파싱 실패 시 텍스트만 표시
        if (fallbackToText) {
          setParsedContent(stripHtmlTags(content));
        } else {
          setParsedContent(content);
        }
      } finally {
        setIsLoading(false);
      }
    };

    parseContent();
  }, [content, fallbackToText]);

  if (isLoading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      </div>
    );
  }

  // 이미지 클릭 핸들러
  const handleImageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.tagName === 'IMG') {
      const img = target as HTMLImageElement;
      window.open(img.src, '_blank');
    }
  };

  // HTML 태그가 포함되어 있는지 확인
  const hasHtmlTags = parsedContent.includes('<') && parsedContent.includes('>');

  if (hasHtmlTags) {
    // HTML 태그가 있는 경우 dangerouslySetInnerHTML 사용
    return (
      <div 
        className={`prose prose-sm max-w-none whitespace-pre-wrap break-words overflow-wrap-anywhere ${className}`}
        dangerouslySetInnerHTML={{ __html: parsedContent }}
        onClick={handleImageClick}
        style={{ 
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflowWrap: 'anywhere'
        }}
      />
    );
  } else {
    // 텍스트만 있는 경우 whitespace-pre-wrap 사용
    return (
      <div 
        className={`whitespace-pre-wrap leading-relaxed break-words overflow-wrap-anywhere ${className}`}
        onClick={handleImageClick}
        style={{ 
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflowWrap: 'anywhere'
        }}
      >
        {parsedContent}
      </div>
    );
  }
}

// 서버사이드에서 사용할 수 있는 동기 버전
export function HtmlContentSync({ content, className = '' }: Omit<HtmlContentProps, 'fallbackToText'>) {
  // 서버사이드에서는 HTML 태그 제거
  const textContent = stripHtmlTags(content);
  
  return (
    <div 
      className={`whitespace-pre-wrap leading-relaxed break-words overflow-wrap-anywhere ${className}`}
      style={{ 
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflowWrap: 'anywhere'
      }}
    >
      {textContent}
    </div>
  );
} 
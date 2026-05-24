/**
 * 게시글 URL 생성 유틸리티
 * 커뮤니티 계층 구조에 따라 올바른 게시글 URL을 생성합니다.
 */

import { Post, Comment } from '@/types';

export interface PostUrlData {
  id: string;
  type?: 'national' | 'regional' | 'school';
  boardCode?: string;
  schoolId?: string;
  regions?: {
    sido: string;
    sigungu: string;
  };
}

export interface CommentWithPostData extends Comment {
  postData?: {
    title?: string;
    type?: 'national' | 'regional' | 'school';
    boardCode?: string;
    schoolId?: string;
    regions?: {
      sido: string;
      sigungu: string;
    };
  };
}

/**
 * 게시글 데이터를 기반으로 올바른 커뮤니티 URL을 생성합니다.
 */
export function generatePostUrl(postData: PostUrlData): string {
  const { id, type, boardCode, schoolId, regions } = postData;

  // 필수 정보가 없으면 기본 URL 반환
  if (!type || !boardCode) {
    console.warn('게시글 URL 생성에 필요한 정보가 부족합니다:', postData);
    return `/community/national/free/${id}`;
  }

  switch (type) {
    case 'national':
      return `/community/national/${boardCode}/${id}`;
    
    case 'regional':
      if (!regions?.sido || !regions?.sigungu) {
        console.warn('지역 게시글 URL 생성에 필요한 지역 정보가 부족합니다:', postData);
        return `/community/national/free/${id}`;
      }
      return `/community/region/${encodeURIComponent(regions.sido)}/${encodeURIComponent(regions.sigungu)}/${boardCode}/${id}`;
    
    case 'school':
      if (!schoolId) {
        console.warn('학교 게시글 URL 생성에 필요한 학교 ID가 부족합니다:', postData);
        return `/community/national/free/${id}`;
      }
      return `/community/school/${schoolId}/${boardCode}/${id}`;
    
    default:
      console.warn('알 수 없는 게시글 타입입니다:', type);
      return `/community/national/free/${id}`;
  }
}

/**
 * 댓글 데이터를 기반으로 해당 게시글의 URL을 생성합니다.
 */
export function generateCommentPostUrl(comment: CommentWithPostData): string {
  if (!comment.postId) {
    console.warn('댓글에 게시글 ID가 없습니다:', comment);
    return '/community';
  }

  if (!comment.postData) {
    console.warn('댓글에 게시글 데이터가 없습니다:', comment);
    return `/community/national/free/${comment.postId}`;
  }

  return generatePostUrl({
    id: comment.postId,
    type: comment.postData.type,
    boardCode: comment.postData.boardCode,
    schoolId: comment.postData.schoolId,
    regions: comment.postData.regions
  });
}

/**
 * 게시글 타입을 한국어로 변환합니다.
 */
export function getPostTypeLabel(type?: string): string {
  switch (type) {
    case 'national':
      return '전국';
    case 'regional':
      return '지역';
    case 'school':
      return '학교';
    default:
      return '커뮤니티';
  }
}

/**
 * 게시글의 위치 정보를 문자열로 변환합니다.
 */
export function getPostLocationLabel(postData: PostUrlData): string {
  const { type, regions, schoolId } = postData;

  switch (type) {
    case 'national':
      return '전국';
    case 'regional':
      if (regions?.sido && regions?.sigungu) {
        return `${regions.sido} ${regions.sigungu}`;
      }
      return '지역';
    case 'school':
      return '학교'; // 실제로는 학교명을 가져와야 함
    default:
      return '';
  }
}

import { Board as BaseBoard, Post as BasePost, Comment as BaseComment, FirebaseTimestamp } from ".";

export type BoardType = 'national' | 'regional' | 'school';

export type Board = BaseBoard;
export type Post = BasePost;
export type Comment = BaseComment;

export interface BoardWithStats extends Board {
  stats: {
    postCount: number;
    viewCount: number;
    activeUserCount: number;
  };
}

export interface PostWithAuthor extends Post {
  author: {
    id: string;
    displayName: string;
    profileImageUrl?: string;
    isAnonymous: boolean;
  };
}

export interface CommentWithAuthor extends Comment {
  author: {
    id: string;
    displayName: string;
    profileImageUrl?: string;
    isAnonymous: boolean;
  };
  replies?: CommentWithAuthor[];
}

export interface PopularPost {
  id: string;
  title: string;
  boardCode: string;
  boardType: BoardType;
  thumbnailUrl?: string;
  author: {
    displayName: string;
    isAnonymous: boolean;
  };
  stats: {
    viewCount: number;
    likeCount: number;
    commentCount: number;
  };
  createdAt: FirebaseTimestamp;
}

export interface BoardFilterOptions {
  keyword?: string;
  searchTarget?: 'title' | 'content' | 'author' | 'all';
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  hasImage?: boolean;
  hasPoll?: boolean;
  sortBy?: 'latest' | 'popular' | 'comments' | 'views';
  timeFilter?: 'all' | 'today' | 'week' | 'month';
  category?: string;
}

export interface PostFormData {
  title: string;
  content: string;
  isAnonymous: boolean;
  tags: string[];
  category?: string;
  attachments?: {
    type: 'image' | 'file';
    url: string;
    name: string;
    size: number;
  }[];
  poll?: {
    question: string;
    options: {
      text: string;
      imageUrl?: string;
    }[];
    expiresAt?: Date;
    multipleChoice: boolean;
  };
} 
import { atom } from "recoil";

export interface User {
  uid: string;
  address1?: string;
  address2?: string;
  birthDay?: number;
  birthMonth?: number;
  birthYear?: number;
  email: string | null;
  experience: number;
  level: number;
  name: string;
  schoolId?: string;
  schoolName?: string;
  phoneNumber?: string;
  userId: string;
  totalExperience: number;
}

export const userState = atom<User | null>({
  key: "userState",
  default: null,
});

export interface Post {
  id: string;
  address1?: string;
  address2?: string;
  author: string;
  authorId: string;
  categoryId: string;
  comments?: number;
  content: string;
  createdAt: any;
  updatedAt: any;
  likedBy: string[];
  schoolId?: string;
  schoolName?: string;
  likes?: number;
  scraps?: number;
  title: string;
  views?: number;
  imageUrls?: string[];
}

export const postsState = atom<Post[]>({
  key: "postsState",
  default: [],
});

export interface Category {
  id: string;
  name: string;
  subcategories?: Category[];
}

export const categoriesState = atom<Category[]>({
  key: "categoriesState",
  default: [
    {
      id: "national",
      name: "전국",
      subcategories: [
        { id: "national-free", name: "자유 게시판" },
        { id: "national-study", name: "공부/진로" },
        { id: "national-popular", name: "HOT 게시글" },
      ],
    },
    {
      id: "regional",
      name: "지역",
      subcategories: [
        { id: "regional-free", name: "자유 게시판" },
        { id: "regional-share", name: "나눔 게시판" },
        { id: "regional-academy", name: "학원 공유" },
      ],
    },
    {
      id: "school",
      name: "학교",
      subcategories: [
        { id: "school-free", name: "자유 게시판" },
        { id: "school-graduate", name: "졸업생 게시판" },
      ],
    },
  ],
});

export const selectedCategoryState = atom<string>({
  key: "selectedCategoryState",
  default: "national-all",
});

export interface School {
  id: string;
  KOR_NAME: string;
  ADDRESS: string;
}

export const searchResultsState = atom<School[]>({
  key: "searchResultsState",
  default: [],
});

export const selectedSchoolState = atom<School | null>({
  key: "selectedSchoolState",
  default: null,
});

// 댓글 상태 관리 아톰
export const commentsState = atom({
  key: "commentsState",
  default: [],
});

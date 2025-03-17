import { atom } from "recoil";
import { User, Post, Comment, Category, School } from "../types";

export const loadingState = atom({
  key: "loadingState",
  default: false,
});

export const userState = atom<User | null>({
  key: "userState",
  default: null,
});

export const userExperienceState = atom<number>({
  key: "userExperienceState",
  default: 0,
});

export const userLevelState = atom<number>({
  key: "userLevelState",
  default: 1,
});

export const postsState = atom<Post[]>({
  key: "postsState",
  default: [],
});

// 댓글 상태 관리 아톰
export const commentsState = atom<Comment[]>({
  key: "commentsState",
  default: [],
});

export const categoriesState = atom<Category[]>({
  key: "categoriesState",
  default: [
    {
      id: "national",
      name: "전국",
      subcategories: [
        { id: "national-free", name: "자유 게시판" },
        { id: "national-hot", name: "HOT 게시판" },
        {
          id: "national-minor",
          name: "서브 게시판",
          subcategories: [
            { id: "national-minor-develop", name: "제안사항" },

            { id: "national-minor-humor", name: "유머/밈" },
            { id: "national-minor-esports", name: "모바일/PC게임" },
            { id: "national-minor-webtoon", name: "웹툰/만화" },
            { id: "national-minor-webtoon", name: "애니" },
            { id: "national-minor-movie", name: "영화/드라마" },
            { id: "national-minor-kpop", name: "아이돌/KPOP" },

            { id: "national-minor-love", name: "연애" },
            { id: "national-minor-sports", name: "운동" },
            { id: "national-minor-trip", name: "여행" },
            { id: "national-minor-food", name: "맛집/요리" },
            { id: "national-minor-animal", name: "반려동물/동물" },

            { id: "national-minor-study", name: "공부/입시" },
            { id: "national-minor-career", name: "진로/취업" },
            { id: "national-minor-language", name: "영어/외국어" },
            { id: "national-minor-coding", name: "코딩/IT" },
          ],
        },
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
        { id: "school-student", name: "재학생 게시판" },
        { id: "school-graduate", name: "졸업생 게시판" },
      ],
    },
  ],
});

export const selectedCategoryState = atom<string>({
  key: "selectedCategoryState",
  default: "national-all",
});

export const selectedSchoolState = atom<School | null>({
  key: "selectedSchoolState",
  default: null,
});

export const searchResultsState = atom<School[]>({
  key: "searchResultsState",
  default: [],
});

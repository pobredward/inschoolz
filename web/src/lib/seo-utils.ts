import { Post } from "@/types";

// 한국어 불용어 목록 (검색에 중요하지 않은 단어들)
const STOP_WORDS = new Set([
  '이', '그', '저', '것', '들', '는', '은', '이다', '입니다', '했다', '합니다', 
  '하다', '있다', '없다', '되다', '같다', '다른', '많다', '적다', '크다', '작다',
  '좋다', '나쁘다', '그리고', '하지만', '그런데', '그래서', '또한', '또는',
  '의해', '에서', '에게', '으로', '로', '과', '와', '이나', '나', '부터', '까지'
]);

// 학생/교육 관련 키워드
const EDUCATION_KEYWORDS = [
  '학생', '학교', '교육', '수업', '공부', '시험', '성적', '진로', '입시', '대학',
  '고등학교', '중학교', '초등학교', '선생님', '친구', '동급생', '선배', '후배',
  '학급', '반', '동아리', '축제', '체육대회', '수학여행', '급식', '방학', '개학'
];

// 게시글 내용에서 키워드 추출
export function extractKeywords(content: string, title: string): string[] {
  const keywords = new Set<string>();
  
  // 제목에서 키워드 추출
  const titleWords = title.split(/[\s\W]+/).filter(word => 
    word.length >= 2 && !STOP_WORDS.has(word)
  );
  titleWords.forEach(word => keywords.add(word));
  
  // 내용에서 키워드 추출 (2글자 이상, 빈도 높은 단어)
  const contentWords = content.split(/[\s\W]+/).filter(word => 
    word.length >= 2 && !STOP_WORDS.has(word)
  );
  
  // 단어 빈도 계산
  const wordFreq = new Map<string, number>();
  contentWords.forEach(word => {
    wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
  });
  
  // 빈도 높은 단어들 선택 (최대 10개)
  const frequentWords = Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
  
  frequentWords.forEach(word => keywords.add(word));
  
  return Array.from(keywords);
}

// SEO 최적화된 제목 생성
export function generateSeoTitle(
  post: Post, 
  boardName: string, 
  communityType: 'national' | 'school' | 'regional',
  locationInfo?: { name: string; address?: string }
): string {
  const titleKeywords = extractKeywords(post.content, post.title).slice(0, 2);
  const keywordPrefix = titleKeywords.length > 0 ? `[${titleKeywords.join(' ')}] ` : '';
  
  let suffix = '';
  switch (communityType) {
    case 'national':
      suffix = `${boardName} 전국 커뮤니티 - 인스쿨즈`;
      break;
    case 'school':
      suffix = `${locationInfo?.name} ${boardName} - 학교 커뮤니티 인스쿨즈`;
      break;
    case 'regional':
      const region = locationInfo?.address || locationInfo?.name || '';
      suffix = `${region} ${boardName} - 지역 커뮤니티 인스쿨즈`;
      break;
  }
  
  // 제목이 너무 길어지지 않도록 조정
  const baseTitle = `${keywordPrefix}${post.title}`;
  const maxTitleLength = 60;
  const remainingLength = maxTitleLength - suffix.length - 3; // " - " 길이
  
  const truncatedTitle = baseTitle.length > remainingLength 
    ? baseTitle.slice(0, remainingLength - 3) + '...'
    : baseTitle;
    
  return `${truncatedTitle} - ${suffix}`;
}

// SEO 최적화된 설명문 생성
export function generateSeoDescription(
  post: Post,
  cleanContent: string,
  authorName: string,
  createdDate: string,
  communityType: 'national' | 'school' | 'regional',
  locationInfo?: { name: string; address?: string }
): string {
  const contentPreview = cleanContent.slice(0, 100);
  const keywords = extractKeywords(post.content, post.title).slice(0, 3);
  
  let contextInfo = '';
  switch (communityType) {
    case 'national':
      contextInfo = '전국 학생 커뮤니티';
      break;
    case 'school':
      contextInfo = `${locationInfo?.name} 학교 커뮤니티`;
      break;
    case 'regional':
      contextInfo = `${locationInfo?.address || locationInfo?.name} 지역 커뮤니티`;
      break;
  }
  
  const keywordText = keywords.length > 0 ? ` #${keywords.join(' #')}` : '';
  
  return `${contentPreview}... ${contextInfo}에서 ${authorName}이 ${createdDate}에 작성.${keywordText} | 인스쿨즈`;
}

// SEO 키워드 배열 생성
export function generateSeoKeywords(
  post: Post,
  boardName: string,
  communityType: 'national' | 'school' | 'regional',
  locationInfo?: { name: string; address?: string }
): string[] {
  const keywords = new Set<string>();
  
  // 기본 키워드
  keywords.add('인스쿨즈');
  keywords.add('학생 커뮤니티');
  keywords.add(boardName);
  
  // 커뮤니티 타입별 키워드
  switch (communityType) {
    case 'national':
      keywords.add('전국 커뮤니티');
      keywords.add('전국 학생');
      break;
    case 'school':
      if (locationInfo?.name) {
        keywords.add(locationInfo.name);
        keywords.add(`${locationInfo.name} 커뮤니티`);
        
        // 학교 레벨 추출 (초등학교, 중학교, 고등학교)
        if (locationInfo.name.includes('초등학교')) {
          keywords.add('초등학생');
          keywords.add('초등학교');
        } else if (locationInfo.name.includes('중학교')) {
          keywords.add('중학생');
          keywords.add('중학교');
        } else if (locationInfo.name.includes('고등학교')) {
          keywords.add('고등학생');
          keywords.add('고등학교');
        }
      }
      keywords.add('학교 커뮤니티');
      break;
    case 'regional':
      if (locationInfo?.name) {
        keywords.add(locationInfo.name);
      }
      if (locationInfo?.address) {
        keywords.add(locationInfo.address);
        // 시/구 단위 키워드 추가
        const addressParts = locationInfo.address.split(' ');
        addressParts.forEach(part => {
          if (part.length > 1) keywords.add(part);
        });
      }
      keywords.add('지역 커뮤니티');
      break;
  }
  
  // 게시글에서 추출한 키워드
  const contentKeywords = extractKeywords(post.content, post.title);
  contentKeywords.forEach(keyword => keywords.add(keyword));
  
  // 게시글 태그
  if (post.tags) {
    post.tags.forEach(tag => keywords.add(tag));
  }
  
  // 교육 관련 키워드 (게시글 내용과 관련 있는 것만)
  const lowerContent = post.content.toLowerCase();
  EDUCATION_KEYWORDS.forEach(keyword => {
    if (lowerContent.includes(keyword)) {
      keywords.add(keyword);
    }
  });
  
  return Array.from(keywords).slice(0, 20); // 최대 20개로 제한
}

// 게시글 카테고리/주제 분류
export function categorizePost(title: string, content: string): string[] {
  const categories: string[] = [];
  const lowerTitle = title.toLowerCase();
  const lowerContent = content.toLowerCase();
  
  // 주제별 키워드 매핑
  const topicKeywords = {
    '공부': ['공부', '시험', '성적', '과제', '숙제', '학습', '교과서'],
    '진로': ['진로', '대학', '입시', '취업', '전공', '미래', '꿈'],
    '친구': ['친구', '우정', '관계', '사귀', '만남'],
    '연애': ['연애', '사랑', '좋아', '데이트', '고백'],
    '생활': ['일상', '생활', '하루', '루틴', '습관'],
    '고민': ['고민', '걱정', '스트레스', '힘들', '우울'],
    '학교생활': ['학교', '선생님', '수업', '급식', '동아리', '축제'],
    '게임': ['게임', '롤', '배그', '오버워치', 'PC방'],
    '연예': ['아이돌', '가수', '배우', '드라마', '영화', '연예인'],
    '패션': ['옷', '스타일', '패션', '뷰티', '화장'],
    '음식': ['음식', '맛집', '카페', '요리', '먹방'],
    '여행': ['여행', '놀러', '나들이', '관광', '휴가'],
    '운동': ['운동', '체육', '축구', '농구', '헬스', '다이어트'],
    '정보': ['정보', '꿀팁', '추천', '후기', '리뷰']
  };
  
  Object.entries(topicKeywords).forEach(([category, keywords]) => {
    const hasKeyword = keywords.some(keyword => 
      lowerTitle.includes(keyword) || lowerContent.includes(keyword)
    );
    if (hasKeyword) {
      categories.push(category);
    }
  });
  
  return categories.length > 0 ? categories : ['일반'];
} 
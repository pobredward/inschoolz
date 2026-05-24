/**
 * 학교 커뮤니티 게시글 템플릿 및 주제 생성기
 * scripts/content-templates.js 로직을 TypeScript로 이관
 */

interface Template {
  category: string;
  topics: string[];
  tones: string[];
}

interface TopicResult {
  topic: string;
  tone: string;
  category: string;
  schoolName: string;
  region: string;
  schoolType: 'elementary' | 'middle' | 'high';
}

export class ContentTemplates {
  private templates: Record<string, Template[]>;

  constructor() {
    this.templates = {
      자유게시판: this.getFreeboardTemplates(),
      정보공유: this.getInfoTemplates(),
      질문: this.getQuestionTemplates()
    };
  }

  /**
   * 자유게시판 템플릿
   */
  private getFreeboardTemplates(): Template[] {
    return [
      {
        category: '학교생활',
        topics: [
          '오늘 점심시간 느낀 점',
          '우리 학교 다니면서 느끼는 것',
          '학교생활 중 기억에 남는 순간',
          '친구들과 이야기하다 생긴 일',
          '학교에서 좋아하는 시간',
          '선생님들 보면서 드는 생각',
          '교복 입으면서 느끼는 기분',
          '급식 먹으면서 드는 생각',
          '방과후 시간 보내는 방법',
          '체육시간에 느끼는 감정'
        ],
        tones: ['친근한', '유머러스한', '감성적인', '일상적인']
      },
      {
        category: '계절/날씨',
        topics: [
          '봄 날씨에 대한 생각',
          '여름 더위 어떻게 견디는지',
          '가을 날씨 좋을 때 기분',
          '겨울 추위 느끼는 순간',
          '비 오는 날 드는 생각',
          '더운 날 교실에서 느끼는 것',
          '추운 날 등교하면서 드는 생각',
          '벚꽃 볼 때 드는 감정'
        ],
        tones: ['서정적인', '감성적인', '활기찬']
      },
      {
        category: '취미/관심사',
        topics: [
          '요즘 하고 있는 게임 어떤지',
          '좋아하는 K-POP 아이돌 누구인지',
          '최근 본 드라마/영화 후기',
          '읽고 있는 웹툰/소설 추천',
          '취미 생활 어떻게 하는지',
          '운동 관련 고민이나 팁',
          '음악 취향 공유',
          '책 읽는 습관에 대한 생각'
        ],
        tones: ['열정적인', '추천하는', '공유하는']
      },
      {
        category: '건강/라이프스타일',
        topics: [
          '요즘 피부 관리 어떻게 하는지',
          '다이어트 고민이나 팁',
          '수면 패턴 관련 고민',
          '스트레스 해소 방법',
          '건강한 식습관에 대한 생각',
          '운동 루틴 어떻게 짜는지',
          '멘탈 케어 방법',
          '생활 패턴 개선 고민'
        ],
        tones: ['진솔한', '공감하는', '조언하는']
      },
      {
        category: '엔터테인먼트',
        topics: [
          '최신 애니메이션 추천',
          '넷플릭스 드라마 후기',
          '유튜브 채널 추천',
          '최근 본 영화 감상평',
          '좋아하는 예능 프로그램',
          '웹드라마 추천',
          '팟캐스트 추천',
          'OTT 플랫폼 비교'
        ],
        tones: ['흥미진진한', '추천하는', '리뷰하는']
      },
      {
        category: '디지털/테크',
        topics: [
          '모바일 게임 추천',
          'PC 게임 후기',
          '앱 추천',
          '스마트폰 사용 팁',
          'SNS 사용 패턴',
          '온라인 쇼핑 후기',
          '디지털 기기 고민',
          '인터넷 문화 이야기'
        ],
        tones: ['정보 공유하는', '경험 나누는', '추천하는']
      },
      {
        category: '심리/성격',
        topics: [
          'MBTI 결과 어떻게 나왔는지',
          '성격 테스트 후기',
          '인간관계 고민',
          '자기계발 관련 생각',
          '스트레스 받을 때 대처법',
          '감정 관리 어떻게 하는지',
          '소통 스타일에 대한 고민',
          '자존감 관련 이야기'
        ],
        tones: ['진솔한', '공감하는', '성찰하는']
      },
      {
        category: '경제/소비',
        topics: [
          '용돈 관리 어떻게 하는지',
          '알바 경험 이야기',
          '온라인 쇼핑 후기',
          '가성비 좋은 제품 추천',
          '절약 팁 공유',
          '투자나 경제에 대한 관심',
          '브랜드 제품 후기',
          '소비 패턴 고민'
        ],
        tones: ['실용적인', '경험 공유하는', '조언하는']
      },
      {
        category: '여행/외출',
        topics: [
          '가고 싶은 여행지',
          '주말에 갈 만한 곳',
          '맛집 탐방 후기',
          '카페 추천',
          '데이트 코스 추천',
          '혼자 가기 좋은 장소',
          '사진 찍기 좋은 곳',
          '교통편 이용 팁'
        ],
        tones: ['설레는', '추천하는', '경험 공유하는']
      },
      {
        category: '창작/문화',
        topics: [
          '웹툰 추천 및 후기',
          '소설이나 책 이야기',
          '그림 그리기 취미',
          '음악 만들기나 연주',
          '사진 촬영 팁',
          '글쓰기 관련 이야기',
          '디자인 관련 관심사',
          '예술 작품 감상 후기'
        ],
        tones: ['창의적인', '감성적인', '영감을 주는']
      }
    ];
  }

  /**
   * 정보공유 템플릿
   */
  private getInfoTemplates(): Template[] {
    return [
      {
        category: '학습정보',
        topics: [
          '효과적인 공부 방법 공유',
          '시험 준비 노하우',
          '집중력 높이는 팁',
          '노트 정리 방법',
          '암기 요령 공유',
          '인터넷 강의 후기',
          '학습 앱 추천',
          '공부 환경 만들기'
        ],
        tones: ['도움이 되는', '경험 공유하는', '조언하는']
      },
      {
        category: '라이프 정보',
        topics: [
          '건강 관리 팁 공유',
          '피부 관리 방법',
          '다이어트 경험담',
          '운동 루틴 추천',
          '수면 패턴 개선법',
          '스트레스 해소법',
          '시간 관리 노하우',
          '생활 습관 개선 팁'
        ],
        tones: ['실용적인', '경험 기반', '도움이 되는']
      },
      {
        category: '취미/엔터 정보',
        topics: [
          '게임 공략 및 팁',
          '드라마/영화 추천',
          '웹툰 추천 리스트',
          '음악 플레이리스트 공유',
          '유튜브 채널 추천',
          '앱 사용 후기',
          '온라인 쇼핑 꿀팁',
          '취미 활동 정보'
        ],
        tones: ['추천하는', '흥미로운', '공유하는']
      },
      {
        category: '경제/소비 정보',
        topics: [
          '용돈 관리 노하우',
          '알바 정보 공유',
          '가성비 제품 추천',
          '온라인 쇼핑 팁',
          '절약 방법 공유',
          '투자 기초 정보',
          '브랜드 제품 후기',
          '할인 정보 공유'
        ],
        tones: ['실용적인', '경험 공유하는', '절약하는']
      }
    ];
  }

  /**
   * 질문 템플릿
   */
  private getQuestionTemplates(): Template[] {
    return [
      {
        category: '학습/진로 질문',
        topics: [
          '공부 방법 어떻게 하는지',
          '진로 선택 고민 상담',
          '성적 향상 방법 문의',
          '집중력 높이는 법',
          '시간 관리 어떻게 하는지',
          '스터디 그룹 만들기',
          '학습 앱 추천 요청',
          '진로 정보 궁금한 점'
        ],
        tones: ['진지한', '간절한', '협력적인']
      },
      {
        category: '라이프스타일 질문',
        topics: [
          '다이어트 방법 문의',
          '피부 관리 어떻게 하는지',
          '운동 루틴 추천 요청',
          '수면 패턴 개선법',
          '스트레스 해소 방법',
          '건강 관리 팁 궁금',
          '생활 습관 개선 방법',
          '멘탈 케어 어떻게 하는지'
        ],
        tones: ['진솔한', '고민하는', '조언 구하는']
      },
      {
        category: '취미/엔터 질문',
        topics: [
          '게임 추천 요청',
          '드라마/영화 추천해줘',
          '웹툰 추천 부탁',
          '음악 플레이리스트 공유',
          'MBTI 결과 어떻게 나왔는지',
          '유튜브 채널 추천',
          '취미 활동 추천 요청',
          '앱 사용법 궁금한 점'
        ],
        tones: ['궁금한', '흥미로운', '공유하고 싶은']
      },
      {
        category: '소비/경제 질문',
        topics: [
          '용돈 관리 어떻게 하는지',
          '알바 정보 궁금한 점',
          '가성비 제품 추천 요청',
          '온라인 쇼핑 팁',
          '절약 방법 문의',
          '브랜드 제품 후기 궁금',
          '투자 관련 질문',
          '할인 정보 공유 요청'
        ],
        tones: ['실용적인', '경험 묻는', '정보 구하는']
      },
      {
        category: '인간관계 질문',
        topics: [
          '친구 관계 고민 상담',
          '소통 방법 어떻게 하는지',
          '갈등 해결 방법',
          '새로운 사람 만나는 법',
          '인간관계 스트레스 해소',
          '성격 차이 극복 방법',
          '소셜 스킬 향상법',
          '자존감 높이는 방법'
        ],
        tones: ['진솔한', '고민하는', '도움 요청하는']
      }
    ];
  }

  /**
   * 랜덤 템플릿 선택
   */
  public getRandomTemplate(postType: string): { category: string; topic: string; tone: string } {
    const templates = this.templates[postType] || this.templates['자유게시판'];
    const randomCategory = templates[Math.floor(Math.random() * templates.length)];
    const randomTopic = randomCategory.topics[Math.floor(Math.random() * randomCategory.topics.length)];
    const randomTone = randomCategory.tones[Math.floor(Math.random() * randomCategory.tones.length)];

    return {
      category: randomCategory.category,
      topic: randomTopic,
      tone: randomTone
    };
  }

  /**
   * 학교 타입별 특화 주제 생성
   */
  public getSchoolSpecificTopics(schoolType: 'elementary' | 'middle' | 'high'): string[] {
    const specificTopics = {
      elementary: [
        '급식 먹을 때 드는 생각',
        '방과후 시간 보내는 법',
        '친구들과 놀 때 느끼는 기분',
        '선생님께 느끼는 감정',
        '학교에서 재미있었던 순간',
        '공부하면서 드는 생각'
      ],
      middle: [
        '시험 볼 때 느끼는 스트레스',
        '동아리에 대한 관심',
        '체육시간 좋아하는 이유',
        '진로에 대한 고민',
        '친구 관계에서 느끼는 것',
        '중학생활 어떤지'
      ],
      high: [
        '공부 압박감 어떻게 견디는지',
        '대학에 대한 생각',
        '진로 고민하는 마음',
        '취업에 대한 걱정',
        '동아리 활동 어떤지',
        '고등학생으로서 느끼는 것'
      ]
    };

    return specificTopics[schoolType] || specificTopics['middle'];
  }

  /**
   * 지역별 특화 주제 생성
   */
  public getRegionSpecificTopics(region: string): string {
    const regionKeywords: Record<string, string[]> = {
      '서울': ['지하철', '버스', '도심', '한강'],
      '부산': ['바다', '해운대', '부산역', '국제시장'],
      '대구': ['동성로', '팔공산', '대구역'],
      '인천': ['인천공항', '차이나타운', '송도'],
      '광주': ['무등산', '광주역', '상무지구'],
      '대전': ['유성', '대전역', '엑스포'],
      '울산': ['현대', '태화강', '울산역'],
      '세종': ['세종시', '정부청사', '호수공원'],
      '경기': ['수도권', '전철', '신도시'],
      '강원': ['산', '스키장', '바다', '자연'],
      '충북': ['청주', '충주', '제천'],
      '충남': ['천안', '아산', '공주'],
      '전북': ['전주', '한옥마을', '비빔밥'],
      '전남': ['목포', '여수', '순천'],
      '경북': ['경주', '안동', '포항'],
      '경남': ['창원', '진주', '통영'],
      '제주': ['한라산', '바다', '관광지', '감귤']
    };

    const keywords = regionKeywords[region] || ['우리 지역'];
    return keywords[Math.floor(Math.random() * keywords.length)];
  }

  /**
   * 시간대별 주제 생성
   */
  public getTimeBasedTopics(): string[] {
    const hour = new Date().getHours();
    
    if (hour >= 6 && hour < 9) {
      return ['등교길 이야기', '아침 일찍 일어나기', '조회시간 이야기'];
    } else if (hour >= 9 && hour < 12) {
      return ['1교시 수업', '쉬는시간 이야기', '오전 수업 후기'];
    } else if (hour >= 12 && hour < 14) {
      return ['점심시간', '급식 후기', '친구들과 점심'];
    } else if (hour >= 14 && hour < 17) {
      return ['오후 수업', '체육시간', '동아리 활동'];
    } else if (hour >= 17 && hour < 20) {
      return ['하교길', '방과후 활동', '학원 가는 길'];
    } else {
      return ['저녁 시간', '숙제하기', '내일 준비'];
    }
  }

  /**
   * 계절별 주제 생성
   */
  public getSeasonalTopics(): string[] {
    const month = new Date().getMonth() + 1;
    
    if (month >= 3 && month <= 5) {
      return ['봄 날씨 좋아하는 이유', '벚꽃 보면서 드는 생각', '새 학기 적응하는 기분'];
    } else if (month >= 6 && month <= 8) {
      return ['여름 더위 어떻게 견디는지', '시원한 것 찾는 이유', '방학 기다리는 마음'];
    } else if (month >= 9 && month <= 11) {
      return ['가을 날씨에 드는 감정', '단풍 보면서 느끼는 것', '공부 스트레스 어떤지'];
    } else {
      return ['겨울 추위 느끼는 순간', '눈 보면서 드는 생각', '연말 분위기 어떤지'];
    }
  }

  /**
   * 종합 주제 생성기
   */
  public generateComprehensiveTopic(
    schoolName: string, 
    region: string, 
    schoolType: 'elementary' | 'middle' | 'high', 
    postType: string = '자유게시판'
  ): TopicResult {
    const template = this.getRandomTemplate(postType);
    const schoolSpecific = this.getSchoolSpecificTopics(schoolType);
    const regionSpecific = this.getRegionSpecificTopics(region);
    const timeBased = this.getTimeBasedTopics();
    const seasonal = this.getSeasonalTopics();

    // 랜덤하게 다양한 요소 조합
    const elements = [
      template.topic,
      ...schoolSpecific,
      regionSpecific,
      ...timeBased,
      ...seasonal
    ];

    const selectedTopic = elements[Math.floor(Math.random() * elements.length)];

    return {
      topic: selectedTopic,
      tone: template.tone,
      category: template.category,
      schoolName,
      region,
      schoolType
    };
  }
}

export default ContentTemplates;

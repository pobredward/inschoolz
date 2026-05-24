import OpenAI from 'openai';
import TopicDiversityManager from './topic-diversity-manager';

interface TrendTopic {
  category: string;
  topic: string;
  keywords: string[];
  tone: 'casual' | 'funny' | 'excited' | 'curious';
  targetAge: 'elementary' | 'middle' | 'high';
  popularity: number; // 1-10
}

interface TrendAnalysis {
  currentTrends: TrendTopic[];
  seasonalTopics: TrendTopic[];
  schoolLifeTopics: TrendTopic[];
  entertainmentTopics: TrendTopic[];
  generatedAt: Date;
}

export class TrendService {
  private openai: OpenAI;
  private trendCache: Map<string, { data: TrendAnalysis; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 1000 * 60 * 15; // 15분 캐시 (더 자주 새로운 트렌드 생성)
  
  // 전역 다양성 관리자 사용
  private diversityManager: TopicDiversityManager;
  
  // 대량 생성 감지
  private bulkGenerationMode: boolean = false;
  private bulkStartTime: number = 0;
  private readonly BULK_DETECTION_THRESHOLD = 50; // 50개 이상 생성 시 대량 모드
  
  // 트렌드 생성 다양성 강화
  private trendGenerationAttempts: number = 0;
  private readonly MAX_TREND_ATTEMPTS = 3; // 최대 3번까지 다른 트렌드 생성 시도

  // 실제 존재하는 인기 콘텐츠 (대규모 데이터셋)
  private readonly VERIFIED_CONTENT = {
    // 게임 (PC/모바일/콘솔)
    games: [
      // PC 게임
      "리그 오브 레전드", "발로란트", "오버워치 2", "배틀그라운드", "스타크래프트", "카트라이더", 
      "메이플스토리", "던전앤파이터", "로스트아크", "디아블로 4", "사이버펑크 2077", "위쳐 3",
      "GTA 5", "마인크래프트", "테라리아", "스팀덱", "카운터 스트라이크 2", "도타 2",
      "월드 오브 워크래프트", "파이널 판타지 14", "어몽 어스", "폴 가이즈", "로켓 리그",
      
      // 모바일 게임
      "원신", "붕괴: 스타레일", "리니지 M", "바람의나라: 연", "검은사막 모바일", "쿠키런: 킹덤",
      "클래시 로얄", "클래시 오브 클랜", "브롤스타즈", "포켓몬 GO", "카카오배틀그라운드",
      "FIFA 모바일", "NBA 2K 모바일", "로블록스", "마인크래프트 PE", "어쌔신 크리드 미라지",
      
      // 콘솔 게임
      "피파 24", "NBA 2K24", "콜 오브 듀티", "포르자 호라이즌", "젤다의 전설", "마리오 카트",
      "스파이더맨", "갓 오브 워", "호라이즌", "라스트 오브 어스", "언차티드", "레드 데드 리뎀션"
    ],

    // 드라마 (한국/해외)
    dramas: [
      // 최신 한국 드라마
      "더 글로리", "웰컴 투 삼달리", "이상한 변호사 우영우", "스위트홈", "오징어 게임",
      "킹덤", "사랑의 불시착", "도깨비", "태양의 후예", "SKY 캐슬", "펜트하우스",
      "이태원 클라쓰", "호텔 델루나", "사이코지만 괜찮아", "스타트업", "빈센조",
      "슬기로운 의사생활", "슬기로운 감빵생활", "미스터 션샤인", "시그널", "터널",
      "나의 아저씨", "응답하라 1988", "응답하라 1997", "응답하라 1994", "쌈 마이웨이",
      "역도요정 김복주", "치킨 너겟", "무브 투 헤븐", "D.P.", "지옥", "마이네임",
      "오늘의 웹툰", "갯마을 차차차", "홈타운스 차차차", "런 온", "스타트업",
      
      // 해외 드라마
      "스트레인저 띵스", "위쳐", "왕좌의 게임", "브레이킹 배드", "프렌즈", "오피스",
      "셜록", "닥터 후", "마블 드라마", "스타워즈 드라마", "하우스 오브 카드"
    ],

    // 영화 (한국/해외/애니메이션)
    movies: [
      // 한국 영화
      "기생충", "미나리", "범죄도시", "범죄도시 2", "범죄도시 3", "극한직업", "신과함께",
      "부산행", "부산행 2", "타짜", "올드보이", "아가씨", "버닝", "마더", "살인의 추억",
      "괴물", "옥자", "아이캔스피크", "1987", "택시운전사", "군함도", "암살", "베테랑",
      "국제시장", "명량", "광해", "왕의 남자", "실미도", "태극기 휘날리며", "친구",
      
      // 해외 영화
      "아바타", "아바타 2", "탑건 매버릭", "스파이더맨", "어벤져스", "아이언맨", "토르",
      "캡틴 아메리카", "블랙 팬서", "닥터 스트레인지", "가디언즈 오브 갤럭시", "앤트맨",
      "배트맨", "슈퍼맨", "원더우먼", "아쿠아맨", "조커", "다크 나이트", "인셉션",
      "인터스텔라", "덩케르크", "테넷", "매트릭스", "존 윅", "미션 임파서블", "007",
      "분노의 질주", "쥬라기 공원", "스타워즈", "해리포터", "반지의 제왕", "호빗",
      
      // 애니메이션
      "겨울왕국", "토이 스토리", "인크레더블", "니모를 찾아서", "몬스터 주식회사",
      "코코", "소울", "루카", "터닝 레드", "엔칸토", "모아나", "주토피아", "빅 히어로"
    ],

    // 브랜드 (음식/패션/테크/생활)
    brands: [
      // 패스트푸드
      "맥도날드", "버거킹", "KFC", "롯데리아", "맘스터치", "서브웨이", "도미노피자",
      "피자헛", "파파존스", "미스터피자", "치킨플러스", "교촌치킨", "BBQ", "네네치킨",
      "굽네치킨", "처갓집양념치킨", "호식이두마리치킨", "페리카나", "푸라닭", "멕시카나",
      
      // 카페/음료
      "스타벅스", "투썸플레이스", "이디야", "커피빈", "할리스", "엔젤리너스", "빽다방",
      "메가커피", "컴포즈커피", "더벤티", "카페베네", "공차", "코카콜라", "펩시",
      "레드불", "몬스터", "게토레이", "포카리스웨트", "비타민워터", "토레타",
      
      // 편의점/마트
      "CU", "GS25", "세븐일레븐", "이마트24", "미니스톱", "이마트", "롯데마트", "홈플러스",
      "코스트코", "현대백화점", "롯데백화점", "신세계백화점", "갤러리아", "AK플라자",
      
      // 패션/뷰티
      "나이키", "아디다스", "뉴발란스", "컨버스", "반스", "푸마", "아식스", "언더아머",
      "유니클로", "자라", "H&M", "무지", "스파오", "탑텐", "에잇세컨즈", "지오다노",
      "아모레퍼시픽", "LG생활건강", "애터미", "더페이스샵", "이니스프리", "에뛰드하우스",
      
      // 테크/전자
      "삼성", "LG", "애플", "소니", "닌텐도", "플레이스테이션", "Xbox", "구글",
      "네이버", "카카오", "라인", "인스타그램", "틱톡", "유튜브", "넷플릭스", "디즈니플러스"
    ],

    // 유튜버/인플루언서 (분야별)
    youtubers: [
      // 먹방/요리
      "쯔양", "문복희", "밴쯔", "떵개떵", "야식이", "입짧은햇님", "승우아빠", "백종원",
      "조보아", "김사원세끼", "히밥", "나도", "정라레", "슈기", "꽃빵", "달지",
      
      // 게임
      "김계란", "도티", "잠뜰", "태경", "풍월량", "김나성", "서새봄", "악어", "루태",
      "빅헤드", "콩콩", "마인크래프트", "로블록스", "포트나이트", "배그", "롤",
      
      // 예능/토크
      "침착맨", "주호민", "이말년", "김풍", "딩고", "자이언트TV", "워크맨", "문명특급",
      "놀면뭐하니", "런닝맨", "무한도전", "1박2일", "아는형님", "라디오스타",
      
      // 뷰티/패션
      "이사배", "씬님", "다또아", "소연", "이지금", "한별", "서은", "이채영",
      "올리브영", "화장품덕후", "뷰티유튜버", "메이크업", "스킨케어", "헤어",
      
      // 일상/브이로그
      "한국언니", "영국남자", "국가비", "소근커플", "쏘영", "밍꼬발랄", "김이브",
      "조던", "데이브", "올리", "가비", "조시", "댄", "맥스", "루크"
    ],

    // 웹툰/웹소설
    webtoons: [
      "신의 탑", "나 혼자만 레벨업", "외모지상주의", "유미의 세포들", "치즈인더트랩",
      "마음의 소리", "덴마", "갓 오브 하이스쿨", "노블레스", "하이브", "언덕위의 제임스",
      "여신강림", "연애혁명", "프리드로우", "윈드브레이커", "헬퍼", "이태원 클라쓰",
      "김부장", "미생", "송곳", "이끼", "26년", "은밀하게 위대하게", "7급 공무원",
      "전지적 독자 시점", "화산귀환", "무한동력", "천마육성", "나노마신", "절대검감"
    ],

    // 음악/아이돌
    music: [
      // K-POP 그룹
      "BTS", "블랙핑크", "트와이스", "레드벨벳", "에스파", "뉴진스", "아이브", "르세라핌",
      "스트레이 키즈", "세븐틴", "엔시티", "있지", "여자아이들", "마마무", "오마이걸",
      "에버글로우", "아이즈원", "케플러", "아이들", "미연", "소연", "우기", "슈화",
      
      // 솔로 아티스트
      "아이유", "태연", "지드래곤", "빅뱅", "싸이", "비", "보아", "이효리", "선미",
      "청하", "화사", "솔라", "문별", "휘인", "제시", "효린", "씨엘", "산다라박",
      
      // 해외 아티스트
      "테일러 스위프트", "아리아나 그란데", "빌리 아일리시", "올리비아 로드리고",
      "BTS", "블랙핑크", "드레이크", "저스틴 비버", "셀레나 고메즈", "두아 리파"
    ],

    // 앱/플랫폼
    apps: [
      "카카오톡", "인스타그램", "틱톡", "유튜브", "넷플릭스", "디즈니플러스", "웨이브",
      "티빙", "쿠팡플레이", "네이버", "다음", "구글", "페이스북", "트위터", "스냅챗",
      "디스코드", "슬랙", "줌", "스카이프", "라인", "텔레그램", "위챗", "카카오뱅크",
      "토스", "페이코", "삼성페이", "엘지페이", "네이버페이", "쿠팡", "배달의민족",
      "요기요", "배민", "당근마켓", "번개장터", "중고나라", "11번가", "G마켓", "옥션"
    ]
  };

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey: apiKey
    });
    this.diversityManager = TopicDiversityManager.getInstance();
  }

  /**
   * 검증된 콘텐츠에서 랜덤 선택
   */
  private getVerifiedContent(category: keyof typeof this.VERIFIED_CONTENT, count: number = 3): string[] {
    const items = this.VERIFIED_CONTENT[category];
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * 최신 트렌드 분석 및 주제 생성 (검증된 콘텐츠 포함)
   */
  async getCurrentTrends(forceRefresh: boolean = false): Promise<TrendAnalysis> {
    // 대량 생성 시에는 매번 새로운 트렌드 생성
    const cacheKey = this.bulkGenerationMode ? 
      `current_trends_${this.trendGenerationAttempts}` : 
      'current_trends';
    
    const cached = this.trendCache.get(cacheKey);
    
    if (!forceRefresh && cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      const currentDate = new Date().toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      });

      const currentMonth = new Date().getMonth() + 1;
      const currentSeason = this.getCurrentSeason(currentMonth);

      const systemPrompt = `당신은 한국의 10대~20대 사이에서 인기 있는 최신 트렌드를 분석하는 전문가입니다.

현재 날짜: ${currentDate}
현재 계절: ${currentSeason}

다음 JSON 형식으로 응답해주세요:
{
  "currentTrends": [
    {
      "category": "카테고리명",
      "topic": "구체적인 주제",
      "keywords": ["키워드1", "키워드2", "키워드3"],
      "tone": "casual|funny|excited|curious",
      "targetAge": "elementary|middle|high", 
      "popularity": 1-10
    }
  ],
  "seasonalTopics": [...],
  "schoolLifeTopics": [...],
  "entertainmentTopics": [...]
}

각 카테고리별로 8-12개씩 다양하게 생성해주세요. 
반복적이거나 뻔한 주제는 피하고, 구체적이고 독창적인 주제로 만들어주세요.`;

      // 검증된 콘텐츠 샘플링 (카테고리별 적절한 수량)
      const sampleGames = this.getVerifiedContent('games', 6);
      const sampleDramas = this.getVerifiedContent('dramas', 5);
      const sampleMovies = this.getVerifiedContent('movies', 5);
      const sampleBrands = this.getVerifiedContent('brands', 6);
      const sampleYoutubers = this.getVerifiedContent('youtubers', 5);
      const sampleWebtoons = this.getVerifiedContent('webtoons', 4);
      const sampleMusic = this.getVerifiedContent('music', 5);
      const sampleApps = this.getVerifiedContent('apps', 4);

      const userPrompt = `${currentDate} 기준 한국 학생들 사이에서 인기 있는 트렌드를 분석해주세요:

**참고할 수 있는 실제 인기 콘텐츠 (이 중에서만 선택하거나 이와 비슷한 수준의 확실한 것만):**
- 게임: ${sampleGames.join(', ')}
- 드라마: ${sampleDramas.join(', ')}
- 영화: ${sampleMovies.join(', ')}
- 브랜드: ${sampleBrands.join(', ')}
- 유튜버: ${sampleYoutubers.join(', ')}
- 웹툰: ${sampleWebtoons.join(', ')}
- 음악: ${sampleMusic.join(', ')}
- 앱: ${sampleApps.join(', ')}

**중요: 다음과 같은 뻔한 주제는 피해주세요:**
- "오늘 학교에서 있었던 일"
- "오늘 학교에서 일어난 사건"
- "학교에서 있었던 개꿀잼 사건"
- "오늘 하루 어땠는지"
등 막연하고 일반적인 표현

**대신 구체적이고 독립적인 주제로 만들어주세요:**

1. **현재 트렌드 (currentTrends)**:
   - 인기 게임 관련 (예: "롤 시즌 업데이트", "피파 신버전")
   - SNS/앱 트렌드 (예: "인스타 릴스 챌린지", "틱톡 신기능")
   - 브랜드/제품 (예: "편의점 신상품", "패스트푸드 한정메뉴")
   - 사회 이슈나 화제 (단, 확실한 사실만)

2. **계절별 주제 (seasonalTopics)**:
   - 구체적인 시험명 (예: "중간고사 망한 과목", "수능 D-30")
   - 특정 행사 (예: "체육대회 응원전", "축제 부스 추천")
   - 계절 음식/옷차림 (예: "가을 카페 신메뉴", "겨울 패딩 추천")

3. **학교생활 주제 (schoolLifeTopics)**:
   - 구체적인 급식 메뉴나 브랜드
   - 특정 동아리나 활동
   - 구체적인 시설이나 장소
   - 명확한 고민이나 상황

4. **엔터테인먼트 주제 (entertainmentTopics)**:
   - 인기 드라마/영화 장르나 트렌드
   - 유튜브/스트리밍 플랫폼 관련
   - 웹툰/소설 장르나 플랫폼 관련
   - K-POP이나 음악 트렌드 (구체적 그룹명보다는 장르나 트렌드)

**중요한 제약사항:**
- 존재하지 않는 게임 캐릭터, 드라마, 제품 등을 만들어내지 마세요
- 불확실한 정보보다는 일반적이고 안전한 주제를 선택하세요
- 구체적인 이름을 사용할 때는 확실히 존재하는 것만 사용하세요

각 주제는 독립적이고 구체적이어야 하며, 학생들이 바로 공감하고 댓글을 달 수 있는 명확한 내용이어야 합니다.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // 더 나은 품질과 적절한 비용
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 2000,
        temperature: 0.7,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('OpenAI 응답이 비어있습니다.');
      }

      const trendData = JSON.parse(content) as Omit<TrendAnalysis, 'generatedAt'>;
      const analysis: TrendAnalysis = {
        ...trendData,
        generatedAt: new Date()
      };

      // 캐시에 저장
      this.trendCache.set(cacheKey, {
        data: analysis,
        timestamp: Date.now()
      });

      console.log(`✅ 트렌드 분석 완료: ${analysis.currentTrends.length + analysis.seasonalTopics.length + analysis.schoolLifeTopics.length + analysis.entertainmentTopics.length}개 주제 생성`);

      return analysis;

    } catch (error) {
      console.error('트렌드 분석 실패:', error);
      throw new Error(`트렌드 분석 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 특정 학교 타입과 상황에 맞는 주제 선택 (전역 중복 방지)
   */
  async selectTopicForSchool(
    schoolType: 'elementary' | 'middle' | 'high',
    postType: 'free' | 'info' | 'question' = 'free',
    bulkSize?: number // 대량 생성 시 전체 크기 전달
  ): Promise<TrendTopic> {
    const trends = await this.getCurrentTrends();
    
    // 모든 주제를 하나의 배열로 합치기
    const allTopics = [
      ...trends.currentTrends,
      ...trends.seasonalTopics,
      ...trends.schoolLifeTopics,
      ...trends.entertainmentTopics
    ];

    // 반복적이고 뻔한 주제 필터링
    const filteredTopics = allTopics.filter(topic => !this.isGenericTopic(topic.topic));

    // 학교 타입에 맞는 주제 필터링
    let suitableTopics = filteredTopics.filter(topic => 
      topic.targetAge === schoolType || topic.targetAge === 'middle' // middle을 기본값으로
    );

    // 게시판 타입에 따른 추가 필터링
    if (postType === 'info') {
      suitableTopics = suitableTopics.filter(topic => 
        topic.tone === 'casual' || topic.category.includes('학교') || topic.category.includes('정보')
      );
    } else if (postType === 'question') {
      suitableTopics = suitableTopics.filter(topic => 
        topic.tone === 'curious' || topic.category.includes('질문') || topic.category.includes('고민')
      );
    }

    // 🔥 전역 다양성 관리자를 통한 중복 방지
    this.detectBulkGeneration(bulkSize);
    
    // 1차: 사용 가능한 주제 필터링
    const availableTopics = suitableTopics.filter(topic => 
      this.diversityManager.canUseTopic(topic.topic, topic.category)
    );

    let topicsToUse = availableTopics;

    // 사용 가능한 주제가 부족하면 단계별 완화
    if (topicsToUse.length < 3) {
      console.log(`⚠️ [TREND] 사용 가능한 주제 부족 (${topicsToUse.length}개), 완화 모드 적용`);
      
      if (this.bulkGenerationMode) {
        // 대량 생성 시 완화 모드
        this.diversityManager.enableBulkMode();
        topicsToUse = suitableTopics.filter(topic => 
          this.diversityManager.canUseTopic(topic.topic, topic.category)
        );
      }
      
      // 여전히 부족하면 새로운 트렌드 생성 시도
      if (topicsToUse.length < 3 && this.trendGenerationAttempts < this.MAX_TREND_ATTEMPTS) {
        console.log('🔄 [TREND] 새로운 트렌드 생성 시도...');
        this.trendGenerationAttempts++;
        const newTrends = await this.getCurrentTrends(true); // 강제 새로고침
        
        const newAllTopics = [
          ...newTrends.currentTrends,
          ...newTrends.seasonalTopics,
          ...newTrends.schoolLifeTopics,
          ...newTrends.entertainmentTopics
        ];
        
        const newSuitableTopics = newAllTopics
          .filter(topic => !this.isGenericTopic(topic.topic))
          .filter(topic => topic.targetAge === schoolType || topic.targetAge === 'middle');
          
        const newAvailableTopics = newSuitableTopics.filter(topic => 
          this.diversityManager.canUseTopic(topic.topic, topic.category)
        );
        
        if (newAvailableTopics.length > 0) {
          topicsToUse = newAvailableTopics;
        }
      }
    }

    // 최종적으로 사용할 주제가 없으면 기본 주제 사용
    if (topicsToUse.length === 0) {
      console.log('🚨 [TREND] 모든 필터 해제, 기본 주제 사용');
      const fallbackTopics = this.getFallbackTopics(schoolType);
      const availableFallbacks = fallbackTopics.filter(topic => 
        this.diversityManager.canUseTopic(topic.topic, topic.category)
      );
      
      topicsToUse = availableFallbacks.length > 0 ? availableFallbacks : fallbackTopics;
    }

    // 🔥 균등한 랜덤 선택 (인기도 가중치 최소화)
    const selectedTopic = topicsToUse[Math.floor(Math.random() * topicsToUse.length)];
    
    // 전역 다양성 관리자에 사용 기록
    this.diversityManager.recordTopicUsage(selectedTopic.topic, selectedTopic.category);
    
    console.log(`✅ [TREND] 주제 선택: "${selectedTopic.topic}" (카테고리: ${selectedTopic.category})`);

    return selectedTopic;
  }

  /**
   * 뻔하고 반복적인 주제인지 확인
   */
  private isGenericTopic(topic: string): boolean {
    const genericPatterns = [
      /오늘.*학교.*있었던.*일/,
      /학교.*일어난.*사건/,
      /오늘.*하루.*어땠/,
      /학교.*개꿀잼.*사건/,
      /오늘.*무슨.*일/,
      /학교.*재미있는.*일/,
      /오늘.*학교.*어떻/,
      /학교생활.*이야기/,
      /오늘.*있었던.*재미있는/
    ];

    return genericPatterns.some(pattern => pattern.test(topic));
  }

  /**
   * 기본 주제 목록 반환 (다양성 확보)
   */
  private getFallbackTopics(schoolType: 'elementary' | 'middle' | 'high'): TrendTopic[] {
    const commonTopics = [
      {
        category: '게임',
        topic: '요즘 하고 있는 게임 추천',
        keywords: ['게임', '추천', '재미'],
        tone: 'excited' as const,
        targetAge: schoolType,
        popularity: 7
      },
      {
        category: '음식',
        topic: '편의점 신상 먹어봤는데',
        keywords: ['편의점', '신상', '맛'],
        tone: 'casual' as const,
        targetAge: schoolType,
        popularity: 6
      },
      {
        category: '연예',
        topic: '최근에 본 드라마/영화 후기',
        keywords: ['드라마', '영화', '후기'],
        tone: 'casual' as const,
        targetAge: schoolType,
        popularity: 8
      },
      {
        category: '패션',
        topic: '요즘 유행하는 스타일',
        keywords: ['패션', '스타일', '유행'],
        tone: 'curious' as const,
        targetAge: schoolType,
        popularity: 6
      },
      {
        category: '취미',
        topic: '새로 시작한 취미 이야기',
        keywords: ['취미', '새로운', '경험'],
        tone: 'excited' as const,
        targetAge: schoolType,
        popularity: 5
      },
      {
        category: '일상',
        topic: '주말에 뭐하고 지내세요?',
        keywords: ['주말', '일상', '계획'],
        tone: 'curious' as const,
        targetAge: schoolType,
        popularity: 7
      },
      {
        category: '음악',
        topic: '요즘 자주 듣는 노래',
        keywords: ['음악', '노래', '플레이리스트'],
        tone: 'casual' as const,
        targetAge: schoolType,
        popularity: 8
      },
      {
        category: '운동',
        topic: '운동 시작하려는데 추천 있나요?',
        keywords: ['운동', '추천', '건강'],
        tone: 'curious' as const,
        targetAge: schoolType,
        popularity: 5
      }
    ];

    // 학교 타입별 추가 주제
    if (schoolType === 'high') {
      commonTopics.push(
        {
          category: '진로',
          topic: '대학 전공 고민 중',
          keywords: ['대학', '전공', '진로'],
          tone: 'curious' as const,
          targetAge: schoolType,
          popularity: 6
        },
        {
          category: '알바',
          topic: '알바 경험담 공유',
          keywords: ['알바', '경험', '일'],
          tone: 'casual' as const,
          targetAge: schoolType,
          popularity: 7
        }
      );
    } else if (schoolType === 'middle') {
      commonTopics.push(
        {
          category: '동아리',
          topic: '동아리 활동 어때요?',
          keywords: ['동아리', '활동', '친구'],
          tone: 'curious' as const,
          targetAge: schoolType,
          popularity: 6
        }
      );
    }

    return commonTopics;
  }

  /**
   * 디시인사이드 스타일 게시글 생성
   */
  async generateDCInsideStylePost(
    schoolName: string,
    selectedTopic: TrendTopic,
    authorNickname: string
  ): Promise<{ title: string; content: string; metadata: any }> {
    
    const schoolType = this.getSchoolType(schoolName);
    const ageGroup = this.getAgeGroupStyle(schoolType);

    const systemPrompt = `당신은 디시인사이드에서 활동하는 한국 ${ageGroup.description}입니다.

출력 형식: JSON
{
  "title": "게시글 제목",
  "content": "게시글 내용",
  "metadata": {
    "style": "사용된 스타일",
    "trendUsed": "활용된 트렌드",
    "engagement": "참여 유도 요소"
  }
}

**중요: 다음과 같은 뻔한 제목/내용은 절대 사용하지 마세요:**
- "오늘 학교에서 있었던 일"
- "학교에서 일어난 개꿀잼 사건"
- "오늘 하루 어땠는지"
- "학교생활 이야기"
등 막연하고 일반적인 표현

**대신 구체적이고 독창적인 내용으로:**
- 주어진 주제에 정확히 맞는 구체적인 제목
- 확실히 존재하는 브랜드명, 제품명만 사용 (불확실하면 일반적 표현 사용)
- 명확하고 독립적인 상황이나 경험
- 학생들이 바로 공감할 수 있는 구체적인 내용

**절대 금지:**
- 존재하지 않는 게임 캐릭터, 업데이트, 제품 등을 만들어내지 마세요
- 불확실한 정보는 사용하지 마세요

자연스러운 학생 말투 사용:
- 건전한 인터넷 슬랭: ㅋㅋ, ㄹㅇ, ㅇㅈ, 레알, 진심, 갓, 띵작, 완전, 대박 등
- 건전한 줄임말: 그냥→그냥, 진짜→진짜/ㄹㅇ, 완전→완전, 너무→너무
- 반말 사용, 직설적이지만 예의 있는 표현
- 이모티콘 적절히 사용: ㅠㅠ, ㅜㅜ, ㅎㅎ, ㅋㅋㅋ
- ${ageGroup.slang}

금지사항:
- 구체적 장소명/상호명 지어내기 (학교마다 지역이 다름)
- 실명, 연락처, 개인정보
- 혐오, 차별, 성적 내용
- 비속어 및 욕설 완전 금지: "존나", "개", "지랄", "ㅅㅂ", "ㅈㄴ", "ㅂㅅ" 등 및 모든 초성 표현 금지

권장사항:
- 확실히 존재하는 브랜드명, 콘텐츠명만 사용 (불확실하면 일반적 표현 사용)
- 자연스러운 학생 일상 표현
- 댓글 유도하는 질문이나 공감 포인트 포함
- 150-300자 내외의 적절한 길이

**사실성 검증:**
- 구체적인 게임 업데이트, 신캐릭터, 신제품 등을 언급할 때는 매우 주의하세요
- 불확실한 정보보다는 일반적이고 안전한 표현을 사용하세요`;

    const userPrompt = `학교: ${schoolName}
주제: ${selectedTopic.topic}
카테고리: ${selectedTopic.category}
키워드: ${selectedTopic.keywords.join(', ')}
톤: ${selectedTopic.tone}
작성자: ${authorNickname}

위 정보를 바탕으로 디시인사이드 스타일의 자연스러운 게시글을 작성해주세요.
주제와 관련된 최신 트렌드나 유행을 자연스럽게 녹여내고, 
실제 학생이 쓸 법한 솔직하고 재미있는 내용으로 만들어주세요.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 800,
        temperature: 0.8,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('OpenAI 응답이 비어있습니다.');
      }

      const result = JSON.parse(content);
      
      // 메타데이터 보강
      result.metadata = {
        ...result.metadata,
        trendTopic: selectedTopic,
        schoolType: schoolType,
        generatedAt: new Date().toISOString(),
        model: 'gpt-4o-mini'
      };

      return result;

    } catch (error) {
      console.error('디시 스타일 게시글 생성 실패:', error);
      throw new Error(`게시글 생성 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 현재 계절 반환
   */
  private getCurrentSeason(month: number): string {
    if (month >= 3 && month <= 5) return '봄';
    if (month >= 6 && month <= 8) return '여름';
    if (month >= 9 && month <= 11) return '가을';
    return '겨울';
  }

  /**
   * 학교 타입 추출
   */
  private getSchoolType(schoolName: string): 'elementary' | 'middle' | 'high' {
    if (schoolName.includes('초등학교')) return 'elementary';
    if (schoolName.includes('고등학교') || schoolName.includes('고교')) return 'high';
    return 'middle';
  }

  /**
   * 연령대별 스타일 가이드
   */
  private getAgeGroupStyle(schoolType: 'elementary' | 'middle' | 'high') {
    switch (schoolType) {
      case 'elementary':
        return {
          description: '초등학생',
          slang: '순수하고 밝은 표현, 간단한 이모티콘 사용'
        };
      case 'middle':
        return {
          description: '중학생',
          slang: '또래 문화 반영, 유행어 적극 사용, 솔직한 표현'
        };
      case 'high':
        return {
          description: '고등학생',
          slang: '세련된 인터넷 슬랭, 입시/진로 관련 고민 표현, 성숙한 유머'
        };
    }
  }

  /**
   * 캐시 클리어
   */
  clearCache(): void {
    this.trendCache.clear();
    console.log('트렌드 캐시가 클리어되었습니다.');
  }

  /**
   * 캐시 상태 확인
   */
  /**
   * 검증된 콘텐츠 업데이트 (관리자용)
   */
  updateVerifiedContent(category: keyof typeof this.VERIFIED_CONTENT, items: string[]) {
    // 타입 안전성을 위해 새 객체 생성
    (this.VERIFIED_CONTENT as any)[category] = [...items];
    console.log(`✅ ${category} 콘텐츠 업데이트 완료: ${items.length}개 항목`);
    
    // 캐시 무효화 (새 콘텐츠 반영을 위해)
    this.trendCache.clear();
  }

  /**
   * 특정 카테고리에 콘텐츠 추가 (관리자용)
   */
  addVerifiedContent(category: keyof typeof this.VERIFIED_CONTENT, newItems: string[]) {
    const currentItems = this.VERIFIED_CONTENT[category];
    const uniqueNewItems = newItems.filter(item => !currentItems.includes(item));
    
    if (uniqueNewItems.length > 0) {
      (this.VERIFIED_CONTENT as any)[category] = [...currentItems, ...uniqueNewItems];
      console.log(`✅ ${category}에 ${uniqueNewItems.length}개 항목 추가: ${uniqueNewItems.join(', ')}`);
      this.trendCache.clear();
    } else {
      console.log(`⚠️ ${category}: 모든 항목이 이미 존재합니다.`);
    }
  }

  /**
   * 콘텐츠 통계 조회
   */
  getContentStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    Object.entries(this.VERIFIED_CONTENT).forEach(([category, items]) => {
      stats[category] = items.length;
    });
    return stats;
  }

  /**
   * 현재 검증된 콘텐츠 조회
   */
  getVerifiedContentList(): typeof this.VERIFIED_CONTENT {
    return { ...this.VERIFIED_CONTENT };
  }

  getCacheStatus(): { size: number; entries: string[] } {
    return {
      size: this.trendCache.size,
      entries: Array.from(this.trendCache.keys())
    };
  }


  /**
   * 대량 생성 모드 감지
   */
  private detectBulkGeneration(bulkSize?: number): void {
    const now = Date.now();
    
    if (bulkSize && bulkSize >= this.BULK_DETECTION_THRESHOLD) {
      if (!this.bulkGenerationMode) {
        this.bulkGenerationMode = true;
        this.bulkStartTime = now;
        console.log(`🚀 [TREND] 대량 생성 모드 활성화 (${bulkSize}개)`);
      }
    } else if (this.bulkGenerationMode) {
      // 대량 생성이 끝났는지 확인 (30분 후 자동 해제)
      if (now - this.bulkStartTime > 30 * 60 * 1000) {
        this.bulkGenerationMode = false;
        this.bulkStartTime = 0;
        console.log('⏰ [TREND] 대량 생성 모드 자동 해제');
      }
    }
  }

  /**
   * 대량 생성 모드 수동 설정
   */
  public setBulkGenerationMode(enabled: boolean, estimatedSize?: number): void {
    this.bulkGenerationMode = enabled;
    if (enabled) {
      this.bulkStartTime = Date.now();
      this.trendGenerationAttempts = 0;
      if (estimatedSize) {
        console.log(`🚀 [TREND] 대량 생성 모드 수동 활성화 (${estimatedSize}개 예상)`);
      }
    } else {
      console.log(`🛑 [TREND] 대량 생성 모드 비활성화`);
      this.trendGenerationAttempts = 0;
    }
  }

  /**
   * 통계 조회 (다양성 관리자 위임)
   */
  public getTopicUsageStats(): any {
    return this.diversityManager.getStats();
  }

  /**
   * 주제 사용 기록 초기화 (다양성 관리자 위임)
   */
  public clearTopicUsageHistory(): void {
    this.diversityManager.clearAllRecords();
  }
}

export default TrendService;

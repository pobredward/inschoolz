import FirebaseService from './firebase-service';
import { generateNickname as generateNicknameUtil, getSchoolTypeFromName } from '@/lib/utils/nickname-generator';

// 타입 정의
interface BotCreationResult {
  id: string;
  nickname: string;
  schoolType: string;
}

interface BotCreationSummary {
  totalCreated: number;
  summary: {
    elementary: number;
    middle: number;
    high: number;
  };
  schoolsProcessed: number;
}

interface BotDeletionResult {
  deletedCount: number;
  stats: {
    elementary: number;
    middle: number;
    high: number;
    schoolsAffected: number;
  };
  deletedPosts?: number;
  deletedComments?: number;
}

interface ProgressCallback {
  (current: number, total: number, message?: string): void;
}

/**
 * 닉네임용 검색 토큰 생성 함수 (한글 지원)
 */
function generateNicknameTokens(nickname: string): string[] {
  if (!nickname) return [];
  
  const tokens = new Set<string>();
  const cleanText = nickname.toLowerCase().trim();
  
  // 전체 닉네임
  tokens.add(cleanText);
  
  // 모든 부분 문자열 생성 (1글자부터 전체까지)
  for (let i = 0; i < cleanText.length; i++) {
    for (let j = i + 1; j <= cleanText.length; j++) {
      const substring = cleanText.substring(i, j);
      if (substring.length >= 1 && substring.length <= 8) { // 1-8글자만
        tokens.add(substring);
      }
    }
  }
  
  return Array.from(tokens);
}

/**
 * 학교명용 검색 토큰 생성 함수 (효율적인 부분 매칭)
 */
function generateSchoolTokens(schoolName: string): string[] {
  if (!schoolName) return [];
  
  const tokens = new Set<string>();
  const cleanText = schoolName.toLowerCase().trim();
  
  // 전체 학교명
  tokens.add(cleanText);
  
  // 의미있는 부분 문자열만 생성 (2글자 이상, 연속된 부분)
  for (let i = 0; i < cleanText.length; i++) {
    for (let j = i + 2; j <= Math.min(i + 5, cleanText.length); j++) { // 2-4글자만
      const substring = cleanText.substring(i, j);
      tokens.add(substring);
    }
  }
  
  return Array.from(tokens);
}

/**
 * 봇 계정 생성 및 관리 서비스
 * 루트 스크립트의 create-school-bots.js와 delete-all-bots.js 로직을 통합
 */
export class BotService {
  private firebaseService: FirebaseService;
  private db: FirebaseFirestore.Firestore;
  private FieldValue: typeof FirebaseFirestore.FieldValue;

  // 학교 유형별 닉네임 풀
  private nicknameComponents = {
    elementary: {
      animals: [
        '토끼', '코알라', '햄스터', '펭귄', '강아지', '고양이', '판다', '곰돌이', '다람쥐', '나비',
        '꿀벌', '사자', '호랑이', '기린', '코끼리', '원숭이', '여우', '늑대', '사슴', '말',
        '돼지', '양', '염소', '닭', '오리', '거북이', '물고기', '상어', '고래', '돌고래',
        '새', '독수리', '부엉이', '까마귀', '참새', '비둘기', '앵무새', '카나리아', '개구리', '뱀',
        '도마뱀', '거미', '개미', '벌', '잠자리', '메뚜기', '귀뚜라미', '무당벌레', '나비', '애벌레'
      ],
      characters: [
        '피카츄', '뽀로로', '크롱', '도라에몽', '미니언즈', '포켓몬', '아기공룡', '헬로키티',
        '마이멜로디', '쿠로미', '시나모롤', '폼폼푸린', '배드바츠마루', '케로피', '라이언',
        '어피치', '프로도', '네오', '튜브', '제이지', '콘', '무지', '짱구', '철수',
        '유리', '맹구', '훈이', '수지', '보니', '흰둥이', '짱아', '신형만', '봉미선',
        '디즈니', '미키', '미니', '도널드', '구피', '플루토', '칩', '데일', '스티치'
      ],
      colors: [
        '빨강', '파랑', '노랑', '초록', '보라', '분홍', '주황', '검정', '하양', '회색',
        '금색', '은색', '무지개', '별빛', '달빛', '햇빛', '구름', '하늘', '바다', '숲',
        '꽃', '나무', '잎사귀', '열매', '씨앗', '뿌리', '가지', '줄기', '꽃잎', '꽃봉오리'
      ],
      foods: [
        '초콜릿', '사탕', '젤리', '쿠키', '케이크', '아이스크림', '딸기', '사과', '바나나', '포도',
        '오렌지', '수박', '메론', '복숭아', '배', '체리', '블루베리', '키위', '망고', '파인애플',
        '우유', '요거트', '치즈', '버터', '꿀', '잼', '빵', '도넛', '마카롱', '와플',
        '팬케이크', '푸딩', '젤라또', '솜사탕', '츄러스', '프레첼', '팝콘', '과자', '비스킷', '크래커'
      ],
      suffixes: ['공주', '왕자', '맨', '이', '짱', '뀽', '팬더', '푸', '야', '님', '킹', '퀸', '베이비', '꼬마', '미니', '맥스', '슈퍼', '울트라']
    },
    middle: {
      school: [
        '공부', '시험', '숙제', '과제', '발표', '수행평가', '중간고사', '기말고사', '모의고사',
        '내신', '생기부', '동아리', '학급', '반장', '부반장', '학생회', '방과후', '야자', '보충',
        '체육', '음악', '미술', '과학', '수학', '국어', '영어', '사회', '역사', '지리',
        '급식', '매점', '도서관', '운동장', '교실', '복도', '계단', '화장실', '보건실', '교무실',
        '선생님', '친구', '선배', '후배', '짝꿍', '조별과제', '청소', '당번', '출석', '지각',
        '조회', '종례', '쉬는시간', '점심시간', '하교', '등교', '버스', '지하철', '도보', '자전거'
      ],
      emotions: [
        '행복', '슬픔', '화남', '짜증', '스트레스', '피곤', '졸림', '배고픔', '목마름', '추위',
        '더위', '아픔', '기쁨', '신남', '우울', '불안', '걱정', '두려움', '놀람', '당황',
        '실망', '후회', '부러움', '질투', '미움', '사랑', '좋아함', '싫어함', '관심', '무관심',
        '집중', '산만', '열정', '의욕', '무기력', '활기', '침울', '밝음', '어둠', '희망'
      ],
      hobbies: [
        '게임', '만화', '애니', '드라마', '영화', '음악', '댄스', '노래', '랩', '힙합',
        '아이돌', '케이팝', '팝송', '발라드', '록', '재즈', '클래식', '트로트', '인디', '밴드',
        '기타', '피아노', '드럼', '바이올린', '첼로', '플루트', '색소폰', '하모니카', '우쿨렐레', '베이스',
        '축구', '농구', '야구', '배구', '탁구', '테니스', '배드민턴', '수영', '태권도', '유도',
        '검도', '복싱', '레슬링', '체조', '육상', '마라톤', '사이클', '스케이트', '스키', '스노보드'
      ],
      suffixes: ['학생', '라이프', '싫어', '왕', '시간', '망함', '최고', '무서워', '짱', '부장', '회장', '킹', '러버', '헬', '고사', '걱정', '관리', '나무', '맨', '러', '족', '충']
    },
    high: {
      entrance: [
        '수능', '내신', '생기부', '학종', '정시', '수시', '모의고사', '전국연합', '교육청', '평가원',
        '국어', '수학', '영어', '탐구', '과탐', '사탐', '한국사', '제2외국어', '한문', '논술',
        '면접', '자소서', '포트폴리오', '실기', '적성', '입학사정관', '학교추천', '일반전형', '특별전형', '지역균형',
        '의대', '치대', '한의대', '약대', '수의대', '간호대', '공대', '경영', '경제', '법대',
        '사범대', '예체능', '미대', '음대', '체대', '연극영화', '신문방송', '컴공', '전자', '기계',
        '화공', '건축', '토목', '환경', '생명', '화학', '물리', '지구과학', '생물', '심리'
      ],
      university: [
        '대학', '캠퍼스', '학과', '전공', '복수전공', '부전공', '교양', '전선', '전필', '학점',
        '출석', '과제', '레포트', '발표', '팀플', '중간', '기말', '재시', '계절학기', '휴학',
        '복학', '졸업', '취업', '대학원', '석사', '박사', '연구', '논문', '학회', '인턴',
        '동아리', '학생회', '축제', '엠티', '새터', '오티', '종강', '개강', '수강신청', '폐강'
      ],
      future: [
        '꿈', '목표', '비전', '계획', '미래', '희망', '도전', '성공', '실패', '노력',
        '열정', '의지', '각오', '다짐', '결심', '포기', '극복', '인내', '끈기', '집중',
        '취업', '창업', '사업', '직장', '회사', '공무원', '교사', '의사', '변호사', '엔지니어',
        '디자이너', '개발자', '프로그래머', '연구원', '교수', '기자', '작가', '예술가', '운동선수', '연예인',
        'CEO', '임원', '팀장', '대리', '과장', '부장', '이사', '사장', '회장', '대표'
      ],
      suffixes: ['전사', '킬러', '장인', '준비생', '파이터', '왕', '달인', '중독', '부족', '맥스', '갈거야', '크게', '이다', '힘들어', '고민', '없음', '소중해', '감사', '맛없어', '싫어', '짧아', '최고', '기원', '러', '족']
    }
  };

  constructor() {
    console.log('🏗️ [BOT-SERVICE] BotService 생성자 시작');
    
    try {
      console.log('🔥 [BOT-SERVICE] FirebaseService 인스턴스 가져오는 중...');
      this.firebaseService = FirebaseService.getInstance();
      console.log('✅ [BOT-SERVICE] FirebaseService 인스턴스 획득 완료');
      
      console.log('📊 [BOT-SERVICE] Firestore 인스턴스 가져오는 중...');
      this.db = this.firebaseService.getFirestore();
      console.log('✅ [BOT-SERVICE] Firestore 인스턴스 획득 완료');
      
      console.log('🔧 [BOT-SERVICE] FieldValue 가져오는 중...');
      this.FieldValue = this.firebaseService.getFieldValue();
      console.log('✅ [BOT-SERVICE] FieldValue 획득 완료');
      
      console.log('🎉 [BOT-SERVICE] BotService 생성자 완료');
    } catch (error) {
      console.error('❌ [BOT-SERVICE] BotService 생성자 실패:', error);
      console.error('❌ [BOT-SERVICE] 오류 스택:', error instanceof Error ? error.stack : 'No stack');
      throw error;
    }
  }

  /**
   * 학교 이름으로부터 학교 유형 판별
   */
  private getSchoolType(schoolName: string): 'elementary' | 'middle' | 'high' {
    if (schoolName.includes('초등학교') || schoolName.includes('초교')) {
      return 'elementary';
    } else if (schoolName.includes('중학교') || schoolName.includes('중교')) {
      return 'middle';
    } else if (schoolName.includes('고등학교') || schoolName.includes('고교') || schoolName.includes('고')) {
      return 'high';
    }
    return 'middle'; // 기본값
  }

  /**
   * 닉네임 생성 (공통 유틸리티 사용)
   */
  private generateNickname(schoolType: 'elementary' | 'middle' | 'high'): string {
    return generateNicknameUtil(schoolType);
  }

  /**
   * 닉네임 전역 중복 체크
   */
  private async checkNicknameExists(nickname: string): Promise<boolean> {
    try {
      const query = await this.db
        .collection('users')
        .where('profile.userName', '==', nickname)
        .limit(1)
        .get();
      
      return !query.empty;
    } catch (error) {
      console.warn(`닉네임 중복 체크 실패 (${nickname}):`, (error as Error).message);
      return false; // 오류 시 중복 없다고 가정
    }
  }

  /**
   * 학교의 memberCount와 favoriteCount 업데이트
   */
  private async updateSchoolCounts(
    schoolId: string, 
    memberCountDelta: number, 
    favoriteCountDelta: number
  ): Promise<void> {
    try {
      const schoolRef = this.db.collection('schools').doc(schoolId);
      const schoolDoc = await schoolRef.get();
      
      if (!schoolDoc.exists) {
        console.warn(`⚠️ 학교 ${schoolId}를 찾을 수 없습니다. 카운트 업데이트 스킵.`);
        return;
      }

      const schoolData = schoolDoc.data()!;
      const currentMemberCount = schoolData.memberCount || 0;
      const currentFavoriteCount = schoolData.favoriteCount || 0;
      
      const newMemberCount = Math.max(0, currentMemberCount + memberCountDelta);
      const newFavoriteCount = Math.max(0, currentFavoriteCount + favoriteCountDelta);

      await schoolRef.update({
        memberCount: newMemberCount,
        favoriteCount: newFavoriteCount,
        updatedAt: this.FieldValue.serverTimestamp()
      });

      console.log(`   📊 학교 카운트 업데이트: memberCount ${currentMemberCount} → ${newMemberCount}, favoriteCount ${currentFavoriteCount} → ${newFavoriteCount}`);
      
    } catch (error) {
      console.error(`❌ 학교 카운트 업데이트 실패 (${schoolId}):`, error);
      // 카운트 업데이트 실패해도 봇 생성/삭제는 계속 진행
    }
  }

  /**
   * 학교별 봇 계정 생성
   */
  public async createBotsForSchool(
    schoolId: string, 
    schoolName: string, 
    botCount: number = 3,
    onProgress?: ProgressCallback
  ): Promise<BotCreationResult[]> {
    try {
      const schoolType = this.getSchoolType(schoolName);
      
      // 기존 봇 계정 확인
      const existingBotsQuery = await this.db
        .collection('users')
        .where('fake', '==', true)
        .where('schoolId', '==', schoolId)
        .get();
      
      const existingCount = existingBotsQuery.size;
      
      // 기존 봇이 너무 많으면 제한 (예: 10개 이상)
      if (existingCount >= 10) {
        console.log(`   ⚠️ ${schoolName}에 이미 ${existingCount}개의 봇이 있습니다. 더 이상 생성하지 않습니다.`);
        return [];
      }
      
      // 요청된 수만큼 추가 생성 (기존 봇 수와 관계없이)
      const needToCreate = botCount;
      console.log(`   📝 ${schoolName}: ${existingCount}개 존재, ${needToCreate}개 추가 생성 예정`);
      
      const createdBots: BotCreationResult[] = [];

      for (let i = 1; i <= needToCreate; i++) {
        // Firebase 스타일 UID 생성
        const botId = await this.firebaseService.generateUniqueFirebaseUID();
        
        // 닉네임 생성 (전역 중복 방지)
        let nickname: string;
        let attempts = 0;
        do {
          nickname = this.generateNickname(schoolType);
          attempts++;
          
          // 1. 현재 학교 내 중복 체크
          const localDuplicate = createdBots.some(bot => bot.nickname === nickname);
          
          // 2. 전체 데이터베이스 중복 체크
          const globalDuplicate = await this.checkNicknameExists(nickname);
          
          if (!localDuplicate && !globalDuplicate) {
            break; // 중복 없음, 사용 가능
          }
        } while (attempts < 50);
        
        if (attempts >= 50) {
          console.warn(`⚠️ ${schoolName}: 유니크한 닉네임 생성 실패, 강제로 숫자 추가`);
          nickname = this.generateNickname(schoolType) + '_' + Date.now().toString().slice(-6);
        }

        // 검색 토큰 생성
        const allTokens = new Set<string>();
        
        // nickname 토큰 (전체 부분 문자열)
        if (nickname) {
          const nicknameTokens = generateNicknameTokens(nickname);
          nicknameTokens.forEach(token => allTokens.add(token));
        }
        
        // schoolName 토큰 (효율적인 부분 문자열만)
        if (schoolName) {
          const schoolTokens = generateSchoolTokens(schoolName);
          schoolTokens.forEach(token => allTokens.add(token));
        }
        
        // 토큰 배열로 변환 (최대 50개로 제한 - 이메일 제거로 크기 감소)
        const searchTokens = Array.from(allTokens).slice(0, 50);

        const email = `${botId}@bot.inschoolz.com`;

        // 봇 계정 데이터
        const botData = {
          uid: botId,
          email: email,
          role: 'student',
          status: 'active',
          isVerified: true,
          
          profile: {
            userName: nickname,
            realName: '',
            profileImageUrl: '',
            createdAt: this.FieldValue.serverTimestamp(),
            isAdmin: false
          },
          
          stats: {
            level: 1,
            totalExperience: 0,
            currentExp: 0,
            currentLevelRequiredXp: 100,
            postCount: 0,
            commentCount: 0,
            likeCount: 0,
            streak: 0
          },
          
          agreements: {
            terms: true,
            privacy: true,
            location: false,
            marketing: false
          },
          
          // 학교 정보 (User 타입과 일치하도록 school 객체로 저장)
          school: {
            id: schoolId,
            name: schoolName,
            grade: null,
            classNumber: null,
            studentNumber: null,
            isGraduate: false
          },
          
          // 하위 호환성을 위한 개별 필드 (기존 코드와의 호환성)
          schoolId: schoolId,
          schoolName: schoolName,
          schoolType: schoolType,
          
          // 봇 구분자
          fake: true,
          
          // 검색 토큰 (자동 생성)
          searchTokens: searchTokens,
          
          createdAt: this.FieldValue.serverTimestamp(),
          updatedAt: this.FieldValue.serverTimestamp()
        };

        // Firestore에 봇 계정 생성
        await this.db.collection('users').doc(botId).set(botData);
        
        createdBots.push({
          id: botId,
          nickname: nickname,
          schoolType: schoolType
        });

        console.log(`   ✅ 봇 생성: ${nickname} (${botId}) - ${schoolName}`);
        
        if (onProgress) {
          onProgress(i, needToCreate, `봇 계정 생성 중... (${i}/${needToCreate})`);
        }
      }

      // 학교 통계 업데이트 (마지막에 한 번만)
      if (createdBots.length > 0) {
        try {
          console.log(`📊 [BOT-SERVICE] 학교 통계 업데이트: ${schoolName} (+${createdBots.length})`);
          await this.updateSchoolCounts(schoolId, createdBots.length, createdBots.length);
        } catch (statsError) {
          console.warn(`⚠️ [BOT-SERVICE] 학교 통계 업데이트 실패:`, statsError);
          // 통계 업데이트 실패해도 봇 생성은 성공으로 처리
        }
      }

      return createdBots;
      
    } catch (error) {
      console.error(`❌ ${schoolName} 봇 생성 실패:`, error);
      return [];
    }
  }

  /**
   * 여러 학교에 대해 봇 계정 생성 (개선된 버전)
   */
  public async createBotsForSchools(
    schoolLimit: number = 50, 
    botsPerSchool: number = 3,
    onProgress?: ProgressCallback
  ): Promise<BotCreationSummary> {
    console.log(`🚀 [BOT-SERVICE] createBotsForSchools 시작`);
    
    const isRandomMode = botsPerSchool === -1;
    if (isRandomMode) {
      console.log(`📊 [BOT-SERVICE] 파라미터:`, { schoolLimit, botsPerSchool: '2~4개 랜덤' });
    } else {
      console.log(`📊 [BOT-SERVICE] 파라미터:`, { schoolLimit, botsPerSchool });
    }
    
    try {
      console.log(`🤖 [BOT-SERVICE] 학교별 봇 계정 생성 시작...`);
      if (isRandomMode) {
        console.log(`📊 [BOT-SERVICE] 설정: ${schoolLimit}개 학교, 학교당 2~4개 봇 (랜덤)\n`);
      } else {
        console.log(`📊 [BOT-SERVICE] 설정: ${schoolLimit}개 학교, 학교당 ${botsPerSchool}개 봇\n`);
      }

      // 1단계: 전체 학교 목록 가져오기
      console.log('🏫 [BOT-SERVICE] 전체 학교 목록 조회 중...');
      const queryStart = Date.now();
      
      const allSchoolsQuery = await this.db
        .collection('schools')
        .get();

      const queryEnd = Date.now();
      console.log(`📊 [BOT-SERVICE] 학교 조회 완료 (${queryEnd - queryStart}ms): ${allSchoolsQuery.size}개 학교 발견`);

      if (allSchoolsQuery.empty) {
        console.log('❌ [BOT-SERVICE] 학교 데이터가 없습니다.');
        return {
          totalCreated: 0,
          summary: { elementary: 0, middle: 0, high: 0 },
          schoolsProcessed: 0
        };
      }

      // 2단계: 학교 목록 준비
      const allSchools: Array<{id: string, name: string, address: string, region: string}> = [];
      allSchoolsQuery.docs.forEach(doc => {
        const data = doc.data();
        allSchools.push({
          id: doc.id,
          name: data.KOR_NAME,
          address: data.ADDRESS,
          region: data.REGION || '서울'
        });
      });

      console.log(`📊 전체 학교: ${allSchools.length}개`);

      // 3단계: 요청된 수만큼 학교 선택 (랜덤 셔플)
      const shuffledSchools = allSchools.sort(() => Math.random() - 0.5);
      const selectedSchools = shuffledSchools.slice(0, Math.min(schoolLimit, allSchools.length));

      console.log(`📋 선택된 학교: ${selectedSchools.length}개 (전체 학교 중에서 랜덤 선택)\n`);

      let totalCreated = 0;
      const summary = {
        elementary: 0,
        middle: 0,
        high: 0
      };

      // 4단계: 각 학교별로 봇 생성 (대량 생성 시 병렬 처리)
      console.log(`🚀 [BOT-SERVICE] 봇 생성 루프 시작: ${selectedSchools.length}개 학교 처리`);
      
      // 대량 생성을 위한 배치 크기 최적화
      const batchSize = selectedSchools.length >= 5000 ? 50 : 
                       selectedSchools.length >= 1000 ? 25 : 
                       selectedSchools.length > 100 ? 10 : 
                       selectedSchools.length > 50 ? 5 : 1;
      console.log(`📦 [BOT-SERVICE] 배치 크기: ${batchSize} (총 ${Math.ceil(selectedSchools.length / batchSize)}개 배치)`);
      
      for (let batchIndex = 0; batchIndex < selectedSchools.length; batchIndex += batchSize) {
        const batch = selectedSchools.slice(batchIndex, batchIndex + batchSize);
        const batchNumber = Math.floor(batchIndex / batchSize) + 1;
        const totalBatches = Math.ceil(selectedSchools.length / batchSize);
        
        console.log(`🔄 [BOT-SERVICE] 배치 ${batchNumber}/${totalBatches} 처리 중... (${batch.length}개 학교)`);
        
        // 배치 내 학교들을 병렬로 처리
        const batchPromises = batch.map(async (school, schoolIndex) => {
          const globalIndex = batchIndex + schoolIndex;
          
          console.log(`🏫 [BOT-SERVICE] [${globalIndex + 1}/${selectedSchools.length}] ${school.name} 처리 중...`);
          
          const schoolStart = Date.now();
          
          try {
            // 랜덤 모드인 경우 2~4개 중 랜덤 선택
            const actualBotsPerSchool = isRandomMode 
              ? Math.floor(Math.random() * 3) + 2  // 2~4 사이의 랜덤 숫자
              : botsPerSchool;
              
            const createdBots = await this.createBotsForSchool(
              school.id, 
              school.name, 
              actualBotsPerSchool
            );

            const schoolEnd = Date.now();
            const schoolDuration = schoolEnd - schoolStart;

            if (isRandomMode) {
              console.log(`✅ [BOT-SERVICE] ${school.name} 완료 (${schoolDuration}ms): ${createdBots.length}개 봇 생성 (랜덤: ${actualBotsPerSchool}개 요청)`);
            } else {
              console.log(`✅ [BOT-SERVICE] ${school.name} 완료 (${schoolDuration}ms): ${createdBots.length}개 봇 생성`);
            }
            
            return { school, createdBots, globalIndex };
          } catch (error) {
            console.error(`❌ [BOT-SERVICE] ${school.name} 실패:`, error);
            return { school, createdBots: [], globalIndex };
          }
        });
        
        // 배치 완료 대기
        const batchResults = await Promise.all(batchPromises);
        
        // 결과 처리
        batchResults.forEach(({ createdBots, globalIndex }) => {
          totalCreated += createdBots.length;
          
          // 학교 유형별 통계
          createdBots.forEach(bot => {
            summary[bot.schoolType as keyof typeof summary]++;
          });

          // 진행률 콜백 호출
          if (onProgress) {
            onProgress(globalIndex + 1, selectedSchools.length, `학교 처리 중... (${globalIndex + 1}/${selectedSchools.length})`);
          }
        });
        
        console.log(`✅ [BOT-SERVICE] 배치 ${batchNumber}/${totalBatches} 완료`);
        
        // 배치 간 딜레이 (API 부하 방지) - 대량 생성 시 최적화
        if (batchIndex + batchSize < selectedSchools.length) {
          const delay = selectedSchools.length >= 5000 ? 200 : 
                       selectedSchools.length >= 1000 ? 300 : 
                       selectedSchools.length > 100 ? 500 : 
                       selectedSchools.length > 50 ? 200 : 100;
          console.log(`⏳ [BOT-SERVICE] 배치 간 딜레이: ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // 최종 결과 출력
      console.log('🎉 [BOT-SERVICE] 봇 계정 생성 완료!\n');
      console.log('📊 [BOT-SERVICE] 생성 결과:');
      console.log(`   - 총 봇 계정: ${totalCreated}개`);
      console.log(`   - 초등학교 봇: ${summary.elementary}개`);
      console.log(`   - 중학교 봇: ${summary.middle}개`);
      console.log(`   - 고등학교 봇: ${summary.high}개`);
      console.log(`   - 처리된 학교: ${selectedSchools.length}개\n`);

      const finalResult = {
        totalCreated,
        summary,
        schoolsProcessed: selectedSchools.length
      };

      console.log('📤 [BOT-SERVICE] 반환 결과:', finalResult);
      return finalResult;

    } catch (error) {
      console.error('❌ [BOT-SERVICE] 봇 계정 생성 프로세스 실패:', error);
      console.error('❌ [BOT-SERVICE] 오류 스택:', error instanceof Error ? error.stack : 'No stack');
      console.error('❌ [BOT-SERVICE] 오류 세부사항:', {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown',
        cause: error instanceof Error ? error.cause : undefined
      });
      throw error;
    }
  }

  /**
   * 모든 봇 계정 삭제
   */
  public async deleteAllBots(onProgress?: ProgressCallback): Promise<BotDeletionResult> {
    try {
      console.log('🤖 모든 봇 계정 삭제 시작...\n');

      // 1단계: 모든 봇 계정 조회
      console.log('🔍 봇 계정 조회 중...');
      const botsQuery = await this.db
        .collection('users')
        .where('fake', '==', true)
        .get();

      if (botsQuery.empty) {
        console.log('📝 삭제할 봇 계정이 없습니다.');
        return { 
          deletedCount: 0,
          stats: { elementary: 0, middle: 0, high: 0, schoolsAffected: 0 }
        };
      }

      const totalBots = botsQuery.size;
      console.log(`📊 총 ${totalBots}개의 봇 계정을 찾았습니다.`);

      // 2단계: 봇별 통계 수집 및 학교별 카운트 수집
      const stats = {
        elementary: 0,
        middle: 0,
        high: 0,
        schools: new Set<string>(),
        schoolBotCounts: new Map<string, number>() // schoolId -> 삭제될 봇 수
      };

      const botIds: string[] = [];
      botsQuery.docs.forEach(doc => {
        const data = doc.data();
        botIds.push(doc.id);
        
        if (data.schoolType) {
          stats[data.schoolType as keyof Omit<typeof stats, 'schools' | 'schoolBotCounts'>]++;
        }
        if (data.schoolId) {
          stats.schools.add(data.schoolId);
          // 학교별 삭제될 봇 수 카운트
          const currentCount = stats.schoolBotCounts.get(data.schoolId) || 0;
          stats.schoolBotCounts.set(data.schoolId, currentCount + 1);
        }
      });

      console.log('📈 삭제 대상 봇 통계:');
      console.log(`   - 초등학교 봇: ${stats.elementary}개`);
      console.log(`   - 중학교 봇: ${stats.middle}개`);
      console.log(`   - 고등학교 봇: ${stats.high}개`);
      console.log(`   - 관련 학교: ${stats.schools.size}개\n`);

      // 3단계: 배치 삭제 실행
      console.log('🗑️  봇 계정 삭제 중...');
      let deletedCount = 0;

      await this.firebaseService.executeBatch(
        botIds,
        500, // Firestore 배치 제한
        async (batchIds: string[]) => {
          const batch = this.db.batch();
          
          batchIds.forEach(botId => {
            const botRef = this.db.collection('users').doc(botId);
            batch.delete(botRef);
          });

          await batch.commit();
          deletedCount += batchIds.length;
        },
        (processed, total) => {
          if (onProgress) {
            onProgress(processed, total, `봇 계정 삭제 중... (${processed}/${total}개 삭제됨)`);
          }
        }
      );

      console.log('\n🎉 모든 봇 계정 삭제 완료!');
      console.log('📊 삭제 결과:');
      console.log(`   - 삭제된 봇 계정: ${deletedCount}개`);
      console.log(`   - 초등학교 봇: ${stats.elementary}개`);
      console.log(`   - 중학교 봇: ${stats.middle}개`);
      console.log(`   - 고등학교 봇: ${stats.high}개`);
      console.log(`   - 영향받은 학교: ${stats.schools.size}개\n`);

      // 4단계: 학교별 memberCount와 favoriteCount 감소
      console.log('📊 학교 카운트 업데이트 중...');
      for (const [schoolId, botCount] of stats.schoolBotCounts) {
        await this.updateSchoolCounts(schoolId, -botCount, -botCount);
      }
      console.log('✅ 학교 카운트 업데이트 완료\n');

      return {
        deletedCount,
        stats: {
          elementary: stats.elementary,
          middle: stats.middle,
          high: stats.high,
          schoolsAffected: stats.schools.size
        }
      };

    } catch (error) {
      console.error('❌ 봇 계정 삭제 실패:', error);
      throw error;
    }
  }

  /**
   * 봇이 작성한 게시글과 댓글도 함께 삭제
   */
  public async deleteBotsAndPosts(onProgress?: ProgressCallback): Promise<BotDeletionResult> {
    try {
      console.log('🤖 봇 계정 및 관련 데이터 삭제 시작...\n');

      // 1단계: 봇 계정 삭제
      const botResult = await this.deleteAllBots(onProgress);

      // 2단계: 봇이 작성한 게시글 삭제
      console.log('📝 봇이 작성한 게시글 삭제 중...');
      const postsQuery = await this.db
        .collection('posts')
        .where('fake', '==', true)
        .get();

      let deletedPosts = 0;
      const postIds: string[] = [];

      if (!postsQuery.empty) {
        const totalPosts = postsQuery.size;
        console.log(`📊 총 ${totalPosts}개의 봇 게시글을 찾았습니다.`);

        // 게시글 ID 수집
        postsQuery.docs.forEach(doc => {
          postIds.push(doc.id);
        });

        await this.firebaseService.executeBatch(
          postsQuery.docs,
          500,
          async (batchDocs) => {
            const batch = this.db.batch();
            
            batchDocs.forEach(doc => {
              batch.delete(doc.ref);
            });

            await batch.commit();
            deletedPosts += batchDocs.length;
          },
          (processed, total) => {
            const progress = (processed / total * 100).toFixed(1);
            console.log(`📈 게시글 삭제 진행률: ${progress}% (${processed}/${total}개)`);
          }
        );

        console.log(`✅ ${deletedPosts}개의 봇 게시글이 삭제되었습니다.`);
      } else {
        console.log('📝 삭제할 봇 게시글이 없습니다.');
      }

      // 3단계: AI 댓글 삭제
      console.log('\n💬 AI 댓글 삭제 중...');
      const commentsQuery = await this.db
        .collection('comments')
        .where('fake', '==', true)
        .get();

      let deletedComments = 0;

      if (!commentsQuery.empty) {
        const totalComments = commentsQuery.size;
        console.log(`📊 총 ${totalComments}개의 AI 댓글을 찾았습니다.`);

        await this.firebaseService.executeBatch(
          commentsQuery.docs,
          500,
          async (batchDocs) => {
            const batch = this.db.batch();
            
            batchDocs.forEach(doc => {
              batch.delete(doc.ref);
            });

            await batch.commit();
            deletedComments += batchDocs.length;
          },
          (processed, total) => {
            const progress = (processed / total * 100).toFixed(1);
            console.log(`📈 댓글 삭제 진행률: ${progress}% (${processed}/${total}개)`);
          }
        );

        console.log(`✅ ${deletedComments}개의 AI 댓글이 삭제되었습니다.`);
      } else {
        console.log('💬 삭제할 AI 댓글이 없습니다.');
      }

      // 4단계: 삭제된 게시글에 달린 일반 댓글 정리 (orphan 댓글 방지)
      if (postIds.length > 0) {
        console.log('\n🧹 삭제된 게시글의 orphan 댓글 정리 중...');
        
        let orphanComments = 0;

        await this.firebaseService.executeBatch(
          postIds,
          10, // postId로 쿼리하므로 작은 배치 사용
          async (batchPostIds: string[]) => {
            for (const postId of batchPostIds) {
              try {
                // 해당 게시글의 모든 댓글 조회 (fake가 아닌 일반 댓글들)
                const orphanQuery = await this.db
                  .collection('comments')
                  .where('postId', '==', postId)
                  .where('fake', '==', false)
                  .get();

                if (!orphanQuery.empty) {
                  const batch = this.db.batch();
                  orphanQuery.docs.forEach(doc => {
                    batch.delete(doc.ref);
                  });
                  await batch.commit();
                  
                  orphanComments += orphanQuery.size;
                  console.log(`   🗑️ 게시글 ${postId}의 orphan 댓글 ${orphanQuery.size}개 삭제`);
                }
              } catch (error) {
                console.warn(`⚠️ 게시글 ${postId}의 orphan 댓글 정리 실패:`, (error as Error).message);
              }
            }
          }
        );

        if (orphanComments > 0) {
          console.log(`✅ ${orphanComments}개의 orphan 댓글이 정리되었습니다.`);
        } else {
          console.log('✅ 정리할 orphan 댓글이 없습니다.');
        }
      }

      console.log('\n🎉 모든 봇 데이터 삭제 완료!');
      console.log('📊 최종 삭제 결과:');
      console.log(`   - 삭제된 봇 계정: ${botResult.deletedCount}개`);
      console.log(`   - 삭제된 봇 게시글: ${deletedPosts}개`);
      console.log(`   - 삭제된 AI 댓글: ${deletedComments}개`);
      
      return {
        ...botResult,
        deletedPosts,
        deletedComments
      };

    } catch (error) {
      console.error('❌ 봇 데이터 삭제 실패:', error);
      throw error;
    }
  }

  /**
   * 기존 봇 계정 통계 조회
   */
  public async getBotStats(): Promise<{
    total: number;
    byType: { elementary: number; middle: number; high: number };
    bySchool: Record<string, number>;
  }> {
    try {
      console.log('📊 기존 봇 계정 현황 조회...\n');

      const botsQuery = await this.db
        .collection('users')
        .where('fake', '==', true)
        .get();

      if (botsQuery.empty) {
        console.log('✅ 기존 봇 계정이 없습니다.\n');
        return { total: 0, byType: { elementary: 0, middle: 0, high: 0 }, bySchool: {} };
      }

      const stats = {
        total: botsQuery.size,
        byType: { elementary: 0, middle: 0, high: 0 },
        bySchool: {} as Record<string, number>
      };

      botsQuery.docs.forEach(doc => {
        const data = doc.data();
        const schoolType = data.schoolType || 'middle';
        const schoolName = data.schoolName || '알 수 없는 학교';

        stats.byType[schoolType as keyof typeof stats.byType]++;
        
        if (!stats.bySchool[schoolName]) {
          stats.bySchool[schoolName] = 0;
        }
        stats.bySchool[schoolName]++;
      });

      console.log('📈 현재 봇 계정 현황:');
      console.log(`   - 총 봇 계정: ${stats.total}개`);
      console.log(`   - 초등학교 봇: ${stats.byType.elementary}개`);
      console.log(`   - 중학교 봇: ${stats.byType.middle}개`);
      console.log(`   - 고등학교 봇: ${stats.byType.high}개\n`);

      return stats;

    } catch (error) {
      console.error('❌ 봇 통계 조회 실패:', error);
      return { total: 0, byType: { elementary: 0, middle: 0, high: 0 }, bySchool: {} };
    }
  }
}

export default BotService;

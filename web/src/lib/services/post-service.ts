import FirebaseService from './firebase-service';
import { ContentTemplates } from './content-templates';
import TrendService from './trend-service';

// 타입 정의
interface Bot {
  uid: string;
  nickname: string;
  profileImage?: string;
  schoolId: string;
  schoolName: string;
}

interface School {
  id: string;
  name: string;
  address: string;
  region: string;
}

interface PostData {
  title: string;
  content: string;
  meta?: {
    promptVersion: string;
    diversity?: { funAnecdote: boolean; engagementQuestion: boolean };
    policyPass: boolean;
    style?: string;
  };
}

// 모델 표준 출력 스키마
interface PostAIResult {
  title: string;
  content: string;
  style?: string;
  safety?: { blocked: boolean; reason?: string };
}

interface PostGenerationResult {
  totalGenerated: number;
  schoolsProcessed: number;
  summary: {
    elementary: number;
    middle: number;
    high: number;
  };
}

interface ProgressCallback {
  (current: number, total: number, message?: string): void;
}

// OpenAI 타입 정의
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * AI 게시글 생성 서비스
 * 기존 AutoPostGenerator 로직을 통합
 */
export class PostService {
  private firebaseService: FirebaseService;
  private db: FirebaseFirestore.Firestore;
  private FieldValue: typeof FirebaseFirestore.FieldValue;
  private boardCode: string;
  private boardName: string;
  private contentTemplates: ContentTemplates;
  private trendService: TrendService;

  constructor() {
    this.firebaseService = FirebaseService.getInstance();
    this.db = this.firebaseService.getFirestore();
    this.FieldValue = this.firebaseService.getFieldValue();
    this.boardCode = 'free';
    this.boardName = '자유';
    this.contentTemplates = new ContentTemplates();
    
    // TrendService 초기화
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다.');
    }
    this.trendService = new TrendService(openaiApiKey);
  }

  /**
   * OpenAI API 호출
   */
  private async callOpenAI(messages: OpenAIMessage[]): Promise<string> {
    try {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      
      if (!openaiApiKey) {
        throw new Error('OpenAI API 키가 설정되지 않았습니다.');
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',  // gpt-3.5-turbo에서 업그레이드
          messages,
          max_tokens: 500,       // 300에서 500으로 증가
          temperature: 0.7       // 0.8에서 0.7로 약간 낮춤 (더 안정적)
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API 오류: ${response.statusText}`);
      }

      const data: OpenAIResponse = await response.json();
      return data.choices[0].message.content.trim();

    } catch (error) {
      console.error('OpenAI API 호출 실패:', error);
      throw error;
    }
  }

  // JSON 안전 파서
  private parsePostJson(raw: string): PostAIResult | null {
    const tryTrim = raw.trim();
    const jsonMatch = tryTrim.match(/\{[\s\S]*\}$/);
    const candidate = jsonMatch ? jsonMatch[0] : tryTrim;
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') return parsed as PostAIResult;
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 봇 성격 분석 및 말투 스타일 반환
   */
  private getBotPersonality(
    nickname: string,
    schoolType: 'elementary' | 'middle' | 'high'
  ): string {
    const personalities = {
      cute: {
        keywords: ['펭귄', '판다', '포켓몬', '곰돌이', '토끼', '고양이', '강아지', '꿀벌', '나비', '공주', '왕자'],
        style: `
- 친근하고 귀여운 말투
- 기본 줄임말 사용 (ㅋㅋ, ㅎㅎ, ㅠㅠ)
- 이모티콘 최대 1개까지만 허용
- "~해", "~야", "~지" 같은 반말 위주
- 간단하고 자연스럽게`
      },
      realistic: {
        keywords: ['무서워', '싫어', '망함', '피곤', '스트레스', '짜증', '걱정', '헬', '고사'],
        style: `
- 솔직하고 현실적인 말투
- 반말 위주 ("~해", "~야", "~임")
- 줄임말 자연스럽게 (ㅋㅋ, ㄹㅇ, 개, 진짜)
- 이모티콘 거의 사용 안함
- 푸념이나 솔직한 감정 표현`
      },
      energetic: {
        keywords: ['짱', '왕', '최고', '신나', '킹', '퀸', '맥스', '슈퍼', '울트라'],
        style: `
- 활발하고 에너지 넘치는 말투
- 반말 위주 ("~해", "~야", "~다")
- 줄임말 많이 사용 (ㅋㅋㅋ, ㄹㅇ, 개, 갓)
- 느낌표 적당히 사용
- 긍정적이고 신나는 톤`
      }
    };

    // 학교급 기본값 설정
    let selectedPersonality =
      schoolType === 'elementary'
        ? personalities.cute
        : schoolType === 'high'
        ? personalities.energetic
        : personalities.realistic;
    
    for (const [type, data] of Object.entries(personalities)) {
      if (data.keywords.some(keyword => nickname.includes(keyword))) {
        selectedPersonality = personalities[type as keyof typeof personalities];
        break;
      }
    }

    return selectedPersonality.style;
  }

  /**
   * 게시글 생성 프롬프트 생성 (ContentTemplates 사용)
   */
  private async createPrompt(schoolName: string, botNickname?: string): Promise<string> {
    // 학교 유형 판별
    let schoolType: 'elementary' | 'middle' | 'high' = 'middle';
    if (schoolName.includes('초등학교')) {
      schoolType = 'elementary';
    } else if (schoolName.includes('고등학교') || schoolName.includes('고교')) {
      schoolType = 'high';
    }

    // 지역 정보 (기본값 설정)
    const region = '서울'; // 실제로는 학교 정보에서 가져와야 함

    // ContentTemplates를 사용한 종합 주제 생성
    const topicResult = this.contentTemplates.generateComprehensiveTopic(
      schoolName,
      region,
      schoolType,
      '자유게시판'
    );

    // 봇별 개성 있는 말투 적용
    let styleGuide = '';
    if (botNickname) {
      const personalityStyle = this.getBotPersonality(botNickname, schoolType);
      styleGuide = `
${botNickname}의 개성 있는 말투: ${personalityStyle}`;
    } else {
      // 기본 스타일
      if (schoolType === 'elementary') {
        styleGuide = `
스타일 가이드:
- 초등학생 말투: 반말 위주 ("~해", "~야", "~지")
- 기본 줄임말만 사용 (ㅋㅋ, ㅎㅎ, ㅠㅠ)
- 이모티콘 최대 1개까지만
- 자연스럽고 친근하게
- 2-3줄로 간단하게`;
      } else if (schoolType === 'middle') {
        styleGuide = `
스타일 가이드:
- 중학생 말투: 자연스러운 반말 ("~해", "~임", "~다")
- 건전한 줄임말 사용 (ㅋㅋ, ㄹㅇ, 진짜, 완전, 레알)
- 이모티콘 거의 사용 안함
- 솔직하고 현실적으로
- 2-3줄로 간결하게`;
      } else {
        styleGuide = `
스타일 가이드:
- 고등학생 말투: 자연스러운 반말 ("~해", "~임", "~다")
- 건전한 인터넷 슬랭 사용 (ㅋㅋ, ㄹㅇ, 진짜, 완전, 레알, 갓, 대박)
- 이모티콘 거의 사용 안함
- 솔직하고 직설적으로
- 2-3줄로 간결하게`;
      }
    }

    // 시스템/유저 분리 메시지의 유저 페이로드로 사용
    return JSON.stringify({
      schoolName,
      region,
      schoolType,
      topic: topicResult.topic,
      category: topicResult.category,
      tone: topicResult.tone,
      styleGuide: styleGuide.trim()
    });
  }

  /**
   * 트렌드 기반 개선된 게시글 생성
   */
  private async generateTrendBasedPost(schoolName: string, botNickname?: string, bulkSize?: number): Promise<PostData> {
    try {
      // 학교 타입 판별
      let schoolType: 'elementary' | 'middle' | 'high' = 'middle';
      if (schoolName.includes('초등학교')) {
        schoolType = 'elementary';
      } else if (schoolName.includes('고등학교') || schoolName.includes('고교')) {
        schoolType = 'high';
      }

      // 트렌드 기반 주제 선택 (대량 생성 정보 전달)
      const selectedTopic = await this.trendService.selectTopicForSchool(schoolType, 'free', bulkSize);
      
      // 디시인사이드 스타일 게시글 생성
      const result = await this.trendService.generateDCInsideStylePost(
        schoolName,
        selectedTopic,
        botNickname || '익명'
      );

      return {
        title: result.title,
        content: result.content,
        meta: {
          promptVersion: 'trend-based-v2.0',
          diversity: {
            funAnecdote: selectedTopic.tone === 'funny',
            engagementQuestion: selectedTopic.tone === 'curious'
          },
          policyPass: true,
          style: result.metadata?.style || 'dc-inside'
        }
      };

    } catch (error) {
      console.error('트렌드 기반 게시글 생성 실패, 기존 방식으로 대체:', error);
      // 실패 시 기존 방식으로 대체
      return this.generateSchoolPost(schoolName, botNickname);
    }
  }

  /**
   * 학교별 게시글 생성 (기존 방식)
   */
  private async generateSchoolPost(schoolName: string, botNickname?: string): Promise<PostData> {
    const userPayload = await this.createPrompt(schoolName, botNickname);

    // 다양성 힌트: 가끔 가벼운 재미있는 썰 + 참여 유도 질문
    let payloadObj: Record<string, unknown>;
    try {
      payloadObj = JSON.parse(userPayload);
    } catch {
      payloadObj = {};
    }
    const funAnecdote = Math.random() < 0.2; // 20% 확률로 재미있는 썰
    const engagementQuestion = Math.random() < 0.3; // 30% 확률로 질문형 마무리
    payloadObj.diversity = { funAnecdote, engagementQuestion };
    const finalUserPayload = JSON.stringify(payloadObj);

    // 공통 시스템 프롬프트
    const systemPrompt = [
      '역할: 한국 학생 커뮤니티 게시글 생성기',
      '출력: JSON 한 줄 {"title": string, "content": string, "style": string, "safety": {"blocked": boolean, "reason": string}}',
      '',
      '절대 금지사항:',
      '- 구체적 장소명 지어내기: "OOO 카페", "XXX 맛집", "△△ 학원" 등 금지 (학교마다 지역이 다름)',
      '- 학교 행사/시설 단정: 소풍/운동회/급식실/매점 등 존재 가정 금지',
      '- 실명/연락처/식별정보, 혐오/차별/성적 내용, 폭력 조장, 광고/스팸',
      '',
      '자연스러운 학생 말투 필수:',
      '- 반말 위주 사용: "~해", "~야", "~임", "~다" (존댓말 금지)',
      '- 이모티콘 최대 1개까지만 허용 (없어도 됨)',
      '- 건전한 줄임말 사용: ㅋㅋ, ㄹㅇ, 진짜, 완전, 레알, 갓 등',
      '- AI 같은 정중한 표현 금지: "~해요", "~입니다", "~하세요" 등',
      '- 과도한 감탄사나 의성어 금지',
      '- 비속어 및 욕설 사용 금지: "존나", "개", "지랄", "ㅅㅂ", "ㅈㄴ" 등 및 초성 표현도 금지',
      '',
      '허용 및 권장사항:',
      '- 실제 콘텐츠명 언급 가능: "지금 우리 학교" 드라마, "원피스" 웹툰, "리그 오브 레전드" 게임 등',
      '- 실제 브랜드명 언급 가능: "삼성", "애플", "나이키" 등',
      '- 실제 연예인/인플루언서 이름 언급 가능: 최신 트렌드 반영',
      '- 일반적 표현: "우리 동네 카페", "학교 근처 맛집" (구체적 이름 없이)',
      '',
      '형식 규칙:',
      '- 길이: title≤50자, content≤300자, 2~3문장 권장',
      '- 학교급별 톤 적용, 자연스러운 학생 말투 필수',
      '- 다양성: diversity.funAnecdote=true면 가벼운 재미있는 일화(안전하고 보편적)로 작성',
      '- 참여유도: diversity.engagementQuestion=true면 마지막을 짧은 질문형으로 마무리',
      '- 출력은 오직 JSON 한 줄(설명/마크다운 금지)',
      '',
      '안전성: 의심스러우면 safety.blocked=true로 설정'
    ].join('\n');

    // 1차 시도
    const messagesPrimary: OpenAIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: finalUserPayload }
    ];

    const fallbackDefaults: PostData[] = [
      { title: '오늘 학교에서 있었던 일', content: '별일은 없었는데 소소하게 재밌었음. 다들 어땠음?' },
      { title: '요즘 생각', content: '학교생활 하다 보니 이것저것 고민됨. 비슷한 친구 있냐?' },
      { title: '소소한 잡담', content: '오늘 컨디션 어떤지 공유해보자 ㅋㅋ 난 그냥 무난함' }
    ];

    try {
      const raw = await this.callOpenAI(messagesPrimary);
      let parsed = this.parsePostJson(raw);

      // 2차 시도(형식 문제/차단 시 간단 스타일로 재시도)
      if (!parsed || parsed?.safety?.blocked) {
        const messagesBackup: OpenAIMessage[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: finalUserPayload.replace(/\"tone\"\s*:\s*\".*?\"/, '\"tone\": \"neutral\"') }
        ];
        const raw2 = await this.callOpenAI(messagesBackup);
        parsed = this.parsePostJson(raw2) || parsed;
      }

      // 최종 검증 및 강제 제한
      if (parsed && !parsed.safety?.blocked && parsed.title && parsed.content) {
        let title = String(parsed.title).trim();
        let content = String(parsed.content).trim();

        if (title.length > 50) title = title.substring(0, 47) + '...';
        if (content.length > 300) content = content.substring(0, 297) + '...';

        // 비어있으면 폴백
        if (!title || !content) {
          const fb = fallbackDefaults[Math.floor(Math.random() * fallbackDefaults.length)];
          return {
            ...fb,
            meta: {
              promptVersion: 'v2-json-2025-10-07',
              diversity: { funAnecdote, engagementQuestion },
              policyPass: false
            }
          };
        }

        return {
          title,
          content,
          meta: {
            promptVersion: 'v2-json-2025-10-07',
            diversity: { funAnecdote, engagementQuestion },
            policyPass: true,
            style: parsed.style
          }
        };
      }

      const fb = fallbackDefaults[Math.floor(Math.random() * fallbackDefaults.length)];
      return {
        ...fb,
        meta: {
          promptVersion: 'v2-json-2025-10-07',
          diversity: { funAnecdote, engagementQuestion },
          policyPass: false
        }
      };
    } catch (error) {
      console.error('게시글 생성 실패:', error);
      const fb = fallbackDefaults[Math.floor(Math.random() * fallbackDefaults.length)];
      return {
        ...fb,
        meta: {
          promptVersion: 'v2-json-2025-10-07',
          diversity: { funAnecdote, engagementQuestion },
          policyPass: false
        }
      };
    }
  }

  /**
   * 게시글 저장
   */
  private async savePost(
    postData: PostData,
    author: Bot,
    schoolInfo: School
  ): Promise<string> {
    try {
      const postId = this.db.collection('posts').doc().id;
      
      const postDoc = {
        title: postData.title,
        content: postData.content,
        authorId: author.uid,
        authorNickname: author.nickname,
        authorInfo: {
          displayName: author.nickname,
          profileImageUrl: author.profileImage || '',
          isAnonymous: false
        },
        
        // 게시판 정보
        boardCode: this.boardCode,
        boardName: this.boardName,
        
        // 학교 정보
        schoolId: schoolInfo.id,
        schoolName: schoolInfo.name,
        region: schoolInfo.region,
        
        // 통계
        stats: {
          viewCount: 0,
          likeCount: 0,
          commentCount: 0,
          shareCount: 0
        },
        
        // 상태
        status: {
          isDeleted: false,
          isHidden: false,
          isBlocked: false,
          isPinned: false
        },
        
        // 추가 정보
        tags: [], // AI 게시글은 태그 없음
        type: 'school', // 학교 게시판 타입
        fake: true, // AI 생성 게시글 표시
        aiMeta: postData.meta || null,
        
        createdAt: this.FieldValue.serverTimestamp(),
        updatedAt: this.FieldValue.serverTimestamp()
      };

      await this.db.collection('posts').doc(postId).set(postDoc);
      
      console.log(`✅ 게시글 생성: "${postData.title}" by ${author.nickname} (${schoolInfo.name})`);
      return postId;

    } catch (error) {
      console.error('게시글 저장 실패:', error);
      throw error;
    }
  }

  /**
   * 학교의 봇들 조회
   */
  private async getSchoolBots(schoolId: string): Promise<Bot[]> {
    try {
      const botsQuery = await this.db
        .collection('users')
        .where('fake', '==', true)
        .where('schoolId', '==', schoolId)
        .get();

      const bots: Bot[] = [];
      botsQuery.docs.forEach(doc => {
        const data = doc.data();
        bots.push({
          uid: doc.id,
          nickname: data.profile?.userName || data.nickname,
          profileImage: data.profile?.profileImageUrl || '',
          schoolId: data.schoolId,
          schoolName: data.schoolName
        });
      });

      return bots;
    } catch (error) {
      console.error('봇 조회 실패:', error);
      return [];
    }
  }

  /**
   * 학교 정보 조회
   */
  private async getSchoolInfo(schoolId: string): Promise<School | null> {
    try {
      const schoolDoc = await this.db.collection('schools').doc(schoolId).get();
      
      if (!schoolDoc.exists) {
        return null;
      }

      const data = schoolDoc.data()!;
      return {
        id: schoolDoc.id,
        name: data.KOR_NAME,
        address: data.ADDRESS,
        region: data.REGION || '서울'
      };
    } catch (error) {
      console.error('학교 정보 조회 실패:', error);
      return null;
    }
  }

  /**
   * 여러 학교에 대해 게시글 생성
   */
  public async generatePostsForSchools(
    schoolLimit: number = 10, 
    postsPerSchool: number = 1, 
    delayBetweenPosts: number = 3000,
    onProgress?: ProgressCallback
  ): Promise<PostGenerationResult> {
    try {
      console.log('🤖 AI 게시글 생성 시작...');
      console.log(`📊 설정: ${schoolLimit}개 학교, 학교당 ${postsPerSchool}개 게시글, 게시글간 ${delayBetweenPosts}ms 딜레이\n`);
      
      // 🔥 대량 생성 모드 활성화
      const totalPosts = schoolLimit * postsPerSchool;
      if (totalPosts >= 50) {
        this.trendService.setBulkGenerationMode(true, totalPosts);
        console.log(`🚀 [POST-SERVICE] 대량 생성 모드 활성화 (총 ${totalPosts}개 게시글)`);
      }

      // 1단계: 봇이 있는 학교들 조회
      const botsQuery = await this.db
        .collection('users')
        .where('fake', '==', true)
        .get();

      if (botsQuery.empty) {
        console.log('❌ 봇 계정이 없습니다.');
        return {
          totalGenerated: 0,
          schoolsProcessed: 0,
          summary: { elementary: 0, middle: 0, high: 0 }
        };
      }

      const schoolsWithBots = new Set<string>();
      botsQuery.docs.forEach(doc => {
        const data = doc.data();
        if (data.schoolId) {
          schoolsWithBots.add(data.schoolId);
        }
      });

      console.log(`📊 봇이 있는 학교: ${schoolsWithBots.size}개`);

      // 2단계: 학교 선택 (랜덤)
      const schoolIds = Array.from(schoolsWithBots)
        .sort(() => Math.random() - 0.5)
        .slice(0, schoolLimit);

      console.log(`📋 선택된 학교: ${schoolIds.length}개\n`);

      let totalGenerated = 0;
      const summary = {
        elementary: 0,
        middle: 0,
        high: 0
      };

      // 3단계: 각 학교별로 게시글 생성
      for (let schoolIndex = 0; schoolIndex < schoolIds.length; schoolIndex++) {
        const schoolId = schoolIds[schoolIndex];
        
        try {
          // 학교 정보 조회
          const schoolInfo = await this.getSchoolInfo(schoolId);
          if (!schoolInfo) {
            console.warn(`⚠️ 학교 ${schoolId} 정보를 찾을 수 없습니다.`);
            continue;
          }

          console.log(`🏫 [${schoolIndex + 1}/${schoolIds.length}] ${schoolInfo.name} 처리 중...`);

          // 해당 학교의 봇들 조회
          const schoolBots = await this.getSchoolBots(schoolId);
          if (schoolBots.length === 0) {
            console.warn(`⚠️ ${schoolInfo.name}에 봇이 없습니다.`);
            continue;
          }

          // 학교 유형 판별
          let schoolType: 'elementary' | 'middle' | 'high' = 'middle';
          if (schoolInfo.name.includes('초등학교')) {
            schoolType = 'elementary';
          } else if (schoolInfo.name.includes('고등학교') || schoolInfo.name.includes('고교')) {
            schoolType = 'high';
          }

          // 해당 학교에서 게시글 생성
          for (let postIndex = 0; postIndex < postsPerSchool; postIndex++) {
            try {
              // 랜덤하게 봇 선택
              const randomBot = schoolBots[Math.floor(Math.random() * schoolBots.length)];
              
              // 게시글 생성 (트렌드 기반, 대량 생성 정보 전달)
              const postData = await this.generateTrendBasedPost(schoolInfo.name, randomBot.nickname, totalPosts);
              
              // 게시글 저장
              await this.savePost(postData, randomBot, schoolInfo);
              
              totalGenerated++;
              summary[schoolType]++;

              // 딜레이 (API 부하 방지) - 대량 생성 시 최적화
              if (delayBetweenPosts > 0) {
                const totalPosts = schoolLimit * postsPerSchool;
                const optimizedDelay = totalPosts >= 5000 ? Math.max(delayBetweenPosts * 0.3, 1000) : 
                                     totalPosts >= 1000 ? Math.max(delayBetweenPosts * 0.5, 1500) : 
                                     delayBetweenPosts;
                await new Promise(resolve => setTimeout(resolve, optimizedDelay));
              }

            } catch (postError) {
              console.error(`게시글 생성 실패 (${schoolInfo.name}):`, postError);
            }
          }

          // 진행률 콜백 호출
          if (onProgress) {
            onProgress(
              schoolIndex + 1, 
              schoolIds.length, 
              `학교 처리 중... (${schoolIndex + 1}/${schoolIds.length})`
            );
          }

        } catch (schoolError) {
          console.error(`학교 처리 실패 (${schoolId}):`, schoolError);
        }
      }

      console.log('\n🎉 AI 게시글 생성 완료!');
      console.log('📊 생성 결과:');
      console.log(`   - 총 게시글: ${totalGenerated}개`);
      console.log(`   - 초등학교 게시글: ${summary.elementary}개`);
      console.log(`   - 중학교 게시글: ${summary.middle}개`);
      console.log(`   - 고등학교 게시글: ${summary.high}개`);
      console.log(`   - 처리된 학교: ${schoolIds.length}개\n`);

      // 🔥 대량 생성 모드 해제
      if (totalPosts >= 50) {
        this.trendService.setBulkGenerationMode(false);
        console.log(`🛑 [POST-SERVICE] 대량 생성 모드 해제`);
      }

      return {
        totalGenerated,
        schoolsProcessed: schoolIds.length,
        summary
      };

    } catch (error) {
      console.error('❌ AI 게시글 생성 프로세스 실패:', error);
      
      // 🔥 에러 시에도 대량 생성 모드 해제
      const totalPosts = schoolLimit * postsPerSchool;
      if (totalPosts >= 50) {
        this.trendService.setBulkGenerationMode(false);
        console.log(`🛑 [POST-SERVICE] 대량 생성 모드 해제 (에러)`);
      }
      
      throw error;
    }
  }

  /**
   * 랜덤 학교들에 게시글 생성 (배치 처리용)
   */
  public async generatePostsForRandomSchools(
    postCount: number,
    onProgress?: ProgressCallback
  ): Promise<number> {
    try {
      console.log(`🤖 랜덤 학교들에 ${postCount}개 게시글 생성 시작...`);

      // 봇이 있는 학교들 조회
      const botsQuery = await this.db
        .collection('users')
        .where('fake', '==', true)
        .get();

      if (botsQuery.empty) {
        throw new Error('봇 계정이 없습니다.');
      }

      const schoolsWithBots = new Set<string>();
      botsQuery.docs.forEach(doc => {
        const data = doc.data();
        if (data.schoolId) {
          schoolsWithBots.add(data.schoolId);
        }
      });

      if (schoolsWithBots.size === 0) {
        throw new Error('봇이 있는 학교가 없습니다.');
      }

      const schoolIds = Array.from(schoolsWithBots);
      let generatedCount = 0;

      for (let i = 0; i < postCount; i++) {
        try {
          // 랜덤하게 학교 선택
          const randomSchoolId = schoolIds[Math.floor(Math.random() * schoolIds.length)];
          
          // 학교 정보 조회
          const schoolInfo = await this.getSchoolInfo(randomSchoolId);
          if (!schoolInfo) {
            console.warn(`학교 ${randomSchoolId} 정보를 찾을 수 없습니다.`);
            continue;
          }

          // 해당 학교의 봇들 조회
          const schoolBots = await this.getSchoolBots(randomSchoolId);
          if (schoolBots.length === 0) {
            console.warn(`${schoolInfo.name}에 봇이 없습니다.`);
            continue;
          }

          // 랜덤하게 봇 선택
          const randomBot = schoolBots[Math.floor(Math.random() * schoolBots.length)];
          
          // 게시글 생성 (트렌드 기반)
          const postData = await this.generateTrendBasedPost(schoolInfo.name, randomBot.nickname);
          
          // 게시글 저장
          await this.savePost(postData, randomBot, schoolInfo);
          
          generatedCount++;

          if (onProgress) {
            onProgress(i + 1, postCount, `게시글 생성 중... (${i + 1}/${postCount})`);
          }

          // 딜레이 (API 부하 방지)
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (postError) {
          console.error(`게시글 생성 실패:`, postError);
        }
      }

      console.log(`✅ ${generatedCount}개 게시글 생성 완료`);
      return generatedCount;

    } catch (error) {
      console.error('랜덤 게시글 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 특정 학교에 게시글 생성
   */
  public async generatePostsForSchool(
    schoolId: string, 
    postCount: number = 1,
    onProgress?: ProgressCallback
  ): Promise<number> {
    try {
      console.log(`🤖 학교 ${schoolId}에 ${postCount}개 게시글 생성 시작...`);

      // 학교 정보 조회
      const schoolInfo = await this.getSchoolInfo(schoolId);
      if (!schoolInfo) {
        throw new Error(`학교 ${schoolId} 정보를 찾을 수 없습니다.`);
      }

      // 해당 학교의 봇들 조회
      const schoolBots = await this.getSchoolBots(schoolId);
      if (schoolBots.length === 0) {
        throw new Error(`${schoolInfo.name}에 봇이 없습니다.`);
      }

      let generatedCount = 0;

      for (let i = 0; i < postCount; i++) {
        try {
          // 랜덤하게 봇 선택
          const randomBot = schoolBots[Math.floor(Math.random() * schoolBots.length)];
          
          // 게시글 생성 (트렌드 기반)
          const postData = await this.generateTrendBasedPost(schoolInfo.name, randomBot.nickname);
          
          // 게시글 저장
          await this.savePost(postData, randomBot, schoolInfo);
          
          generatedCount++;

          if (onProgress) {
            onProgress(i + 1, postCount, `게시글 생성 중... (${i + 1}/${postCount})`);
          }

          // 딜레이 (API 부하 방지)
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (postError) {
          console.error(`게시글 생성 실패:`, postError);
        }
      }

      console.log(`✅ ${generatedCount}개 게시글 생성 완료`);
      return generatedCount;

    } catch (error) {
      console.error('학교별 게시글 생성 실패:', error);
      throw error;
    }
  }
}

export default PostService;

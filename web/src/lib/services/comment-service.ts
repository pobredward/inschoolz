import FirebaseService from './firebase-service';

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

// 모델 표준 출력 스키마
interface CommentAIResult {
  content: string;
  isReply?: boolean;
  parentId?: string | null;
  style?: string;
  safety?: { blocked: boolean; reason?: string };
}

interface GeneratedComment {
  content: string;
  meta?: {
    promptVersion: string;
    diversity?: { lightJoke: boolean; engagementQuestion: boolean };
    policyPass: boolean;
    style?: string;
    isReply?: boolean;
    parentId?: string | null;
  };
}

interface Bot {
  uid: string;
  nickname: string;
  profileImage?: string;
  schoolId: string;
  schoolName: string;
}

interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorNickname: string;
  schoolId: string;
  schoolName: string;
  commentCount: number;
  createdAt: FirebaseFirestore.Timestamp | Date;
  fake?: boolean;
}

interface Comment {
  id: string;
  content: string;
  authorId: string;
  authorNickname: string;
  isReply?: boolean;
  parentCommentId?: string;
  fake?: boolean;
}

interface ProgressCallback {
  (current: number, total: number, message?: string): void;
}

/**
 * AI 댓글 생성 및 관리 서비스
 * 루트 스크립트의 comment-generator.js 로직을 통합
 */
export class CommentService {
  private firebaseService: FirebaseService;
  private db: FirebaseFirestore.Firestore;
  private FieldValue: typeof FirebaseFirestore.FieldValue;

  // 댓글 유형별 설정
  private commentTypes = {
    own_post: {
      probability: 0.3, // 30% 확률로 본인 글에 댓글
      styles: ['추가설명', '정정', '업데이트', '보충정보']
    },
    others_post: {
      probability: 0.7, // 70% 확률로 타인 글에 댓글
      styles: ['공감', '질문', '경험공유', '조언', '반박', '칭찬']
    },
    reply: {
      probability: 0.4, // 40% 확률로 대댓글
      styles: ['동의', '반박', '추가질문', '감사', '농담']
    }
  };

  constructor() {
    this.firebaseService = FirebaseService.getInstance();
    this.db = this.firebaseService.getFirestore();
    this.FieldValue = this.firebaseService.getFieldValue();
  }

  /**
   * 학교 유형 판별
   */
  private getSchoolType(schoolName: string): 'elementary' | 'middle' | 'high' {
    if (schoolName.includes('초등학교') || schoolName.includes('초교')) {
      return 'elementary';
    } else if (schoolName.includes('중학교') || schoolName.includes('중교')) {
      return 'middle';
    } else {
      return 'high';
    }
  }

  /**
   * 댓글을 달 게시글 선택 (스마트 선택)
   */
  private async selectPostsForComments(
    schoolLimit: number = 5, 
    commentsPerSchool: number = 3
  ): Promise<Post[]> {
    try {
      console.log('📝 댓글을 달 게시글 선택 중...');

      // 1단계: 봇이 있는 학교들 조회
      const botsQuery = await this.db
        .collection('users')
        .where('fake', '==', true)
        .get();

      if (botsQuery.empty) {
        console.log('❌ 봇 계정이 없습니다.');
        return [];
      }

      const schoolsWithBots = new Set<string>();
      botsQuery.docs.forEach(doc => {
        const data = doc.data();
        if (data.schoolId) {
          schoolsWithBots.add(data.schoolId);
        }
      });

      console.log(`📊 봇이 있는 학교: ${schoolsWithBots.size}개`);
      console.log(`🔍 봇이 있는 학교 ID들:`, Array.from(schoolsWithBots).slice(0, 5));

      // 2단계: 봇이 있는 학교 중 랜덤 선택
      const selectedPosts: Post[] = [];
      const allSchoolIds = Array.from(schoolsWithBots);
      
      // 학교들을 랜덤하게 섞어서 선택
      const shuffledSchoolIds = allSchoolIds.sort(() => Math.random() - 0.5);
      const schoolIds = shuffledSchoolIds.slice(0, Math.min(schoolLimit, shuffledSchoolIds.length));
      
      console.log(`🎲 랜덤 선택된 학교들: ${schoolIds.length}개`);
      console.log(`🏫 선택된 학교 ID들:`, schoolIds);

      for (const schoolId of schoolIds) {
        try {
          console.log(`🔍 ${schoolId} 학교의 게시글 조회 중...`);
          
          // 해당 학교의 최근 게시글 조회 (댓글 수 고려)
          const postsQuery = await this.db
            .collection('posts')
            .where('schoolId', '==', schoolId)
            .where('status.isDeleted', '==', false)
            .orderBy('createdAt', 'desc')
            .limit(50) // 최근 50개 게시글 중에서 선택
            .get();

          console.log(`   📝 ${schoolId} 학교 게시글 수: ${postsQuery.docs.length}개`);

          if (!postsQuery.empty) {
            const posts: Post[] = [];
            postsQuery.docs.forEach(doc => {
              const data = doc.data();
              posts.push({
                id: doc.id,
                title: data.title,
                content: data.content,
                authorId: data.authorId,
                authorNickname: data.authorNickname,
                schoolId: data.schoolId,
                schoolName: data.schoolName || '알 수 없는 학교',
                commentCount: data.stats?.commentCount || 0,
                createdAt: data.createdAt,
                fake: data.fake || false
              });
            });

            // 댓글이 적은 게시글 우선 선택 (0-5개 댓글인 게시글 선호)
            const suitablePosts = posts.filter(post => (post.commentCount || 0) <= 5);
            const postsToSelect = suitablePosts.length > 0 ? suitablePosts : posts.slice(0, 15);
            
            // 댓글 수 기반 스코어링 (댓글이 적을수록 높은 점수)
            const scoredPosts = postsToSelect.map(post => {
              const commentCount = post.commentCount || 0;
              // 댓글 0개: 10점, 1개: 8점, 2개: 6점, 3개: 4점, 4개: 2점, 5개: 1점
              const commentScore = Math.max(1, 11 - (commentCount * 2));
              return {
                ...post,
                score: commentScore
              };
            });
            
            // 스코어 기반 정렬 후 선택
            scoredPosts.sort((a, b) => b.score - a.score);
            const selectedFromSchool = scoredPosts.slice(0, Math.min(commentsPerSchool, scoredPosts.length));
            selectedPosts.push(...selectedFromSchool);
          }
        } catch (error) {
          console.warn(`학교 ${schoolId} 게시글 조회 실패:`, error);
        }
      }

      console.log(`📊 선택된 게시글: ${selectedPosts.length}개`);
      return selectedPosts;

    } catch (error) {
      console.error('게시글 선택 실패:', error);
      return [];
    }
  }

  /**
   * OpenAI API 호출 (간단한 fetch 구현)
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
          max_tokens: 300,       // 150에서 300으로 증가
          temperature: 0.7       // 0.8에서 0.7로 약간 낮춤
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
  private parseCommentJson(raw: string): CommentAIResult | null {
    const tryTrim = raw.trim();
    const jsonMatch = tryTrim.match(/\{[\s\S]*\}$/);
    const candidate = jsonMatch ? jsonMatch[0] : tryTrim;
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') return parsed as CommentAIResult;
      return null;
    } catch {
      return null;
    }
  }

  /**
   * GPT를 이용한 대댓글 생성
   */
  private async generateReplyComment(
    post: Post,
    commenter: Bot,
    parentComment: Comment,
    isPostAuthor: boolean = false
  ): Promise<GeneratedComment> {
    try {
      const schoolType = this.getSchoolType(post.schoolName);
      const style = this.commentTypes.reply.styles[Math.floor(Math.random() * this.commentTypes.reply.styles.length)];

      // 기존 댓글·대댓글 요약
      const existingReplies = await this.getRepliesForComment(parentComment.id);
      // 다양성 힌트(가벼운 농담/질문형 마무리)
      const lightJoke = Math.random() < 0.15;
      const engagementQuestion = Math.random() < 0.2;

      const userPayload = JSON.stringify({
        mode: 'reply',
        schoolType,
        schoolName: post.schoolName,
        post: { title: post.title, content: post.content },
        commenter: { nickname: commenter.nickname, isPostAuthor },
        parent: { id: parentComment.id, author: parentComment.authorNickname, content: parentComment.content },
        existing: (existingReplies || []).slice(0, 10).map(r => ({ author: r.authorNickname, content: r.content })),
        styleHint: style,
        diversity: { lightJoke, engagementQuestion },
        constraints: { maxLen: 120 }
      });

      const systemPrompt = [
        '역할: 학생 커뮤니티 대댓글 생성기',
        '출력: JSON 한 줄 {"content": string, "isReply": boolean, "parentId": string|null, "style": string, "safety": {"blocked": boolean, "reason": string}}',
        '',
        '절대 금지사항:',
        '- 구체적 장소명 지어내기: "OOO 카페", "XXX 맛집", "△△ 학원" 등 금지 (학교마다 지역이 다름)',
        '- 실명/연락처/식별정보, 혐오/차별/성적, 폭력 조장, 광고/스팸',
        '- 논리적 모순: 게시글 작성자가 자기 글에 "댓글 달아줘서 고마워", "댓글 많이 달아주세요" 등 금지',
        '',
        '허용 및 권장사항:',
        '- 실제 콘텐츠명 언급 가능: "지금 우리 학교" 드라마, "원피스" 웹툰, "리그 오브 레전드" 게임 등',
        '- 실제 브랜드명 언급 가능: "삼성", "애플", "나이키" 등',
        '- 실제 연예인/인플루언서 이름 언급 가능: 최신 트렌드 반영',
        '',
        '대댓글 작성 규칙:',
        '- 길이: ≤120자, 1~2문장, 부모 댓글에 직접 응답',
        '- 자연스러운 반응: 동의, 반박, 추가 질문, 감사, 가벼운 농담 등',
        '- 작성자 구분:',
        '  * isPostAuthor=true: 게시글 작성자 → 추가 설명, 정정, 업데이트, 보충 정보 위주',
        '    예시: "아 그리고 추가로...", "정정하자면...", "좋은 지적이네요", "맞아요 그 부분은..."',
        '    금지: "댓글 달아줘서 고마워", "댓글 많이 달아주세요" 등 일반적 감사',
        '  * isPostAuthor=false: 다른 학생 → 공감, 질문, 경험 공유, 조언, 반박, 칭찬 위주',
        '- 다양성: diversity.lightJoke=true면 가벼운 무해한 농담을 한 구절 내 허용',
        '- 참여유도: diversity.engagementQuestion=true면 짧은 질문형으로 마무리 가능',
        '- 기존 대댓글과 표현·논지 중복 금지',
        '- 출력은 오직 JSON 한 줄(설명/마크다운 금지)',
        '',
        '안전성: 의심스러우면 safety.blocked=true로 설정'
      ].join('\n');

      // 1차 시도
      const messages: OpenAIMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPayload }
      ];

      let parsed = this.parseCommentJson(await this.callOpenAI(messages));

      // 2차 백업(차단/형식 실패 시)
      if (!parsed || parsed?.safety?.blocked) {
        const backupPayload = userPayload.replace(/"styleHint"\s*:\s*"[^"]*"/, '"styleHint":"동의"');
        const raw2 = await this.callOpenAI([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: backupPayload }
        ]);
        parsed = this.parseCommentJson(raw2) || parsed;
      }

      // 최종 검증 및 강제 제한
      if (parsed && !parsed.safety?.blocked && parsed.content) {
        let content = String(parsed.content).trim();
        const maxLen = 120;
        if (content.length > maxLen) content = content.substring(0, maxLen - 3) + '...';
        return {
          content,
          meta: {
            promptVersion: 'v2-json-2025-10-07',
            diversity: { lightJoke, engagementQuestion },
            policyPass: true,
            style: parsed.style,
            isReply: true,
            parentId: parentComment.id
          }
        };
      }

      // 폴백
      const defaults = ['맞는 말인 것 같아요!', '이 부분 공감됩니다', '자세한 이야기 궁금하네요', '좋은 정보네요', '고마워요!'];
      const content = defaults[Math.floor(Math.random() * defaults.length)];
      return {
        content,
        meta: {
          promptVersion: 'v2-json-2025-10-07',
          diversity: { lightJoke, engagementQuestion },
          policyPass: false,
          isReply: true,
          parentId: parentComment.id
        }
      };
    } catch (error) {
      console.error('대댓글 생성 실패:', error);
      const defaults = ['좋은 의견이네요', '공감합니다', '도움됐어요'];
      const content = defaults[Math.floor(Math.random() * defaults.length)];
      return {
        content,
        meta: {
          promptVersion: 'v2-json-2025-10-07',
          policyPass: false,
          isReply: true,
          parentId: parentComment.id
        }
      };
    }
  }

  /**
   * GPT를 이용한 댓글 생성
   */
  private async generateComment(
    post: Post, 
    commenter: Bot, 
    commentType: string, 
    existingComments: Comment[] = [],
    isPostAuthor: boolean = false
  ): Promise<GeneratedComment> {
    try {
      const schoolType = this.getSchoolType(post.schoolName);
      const isOwnPost = isPostAuthor; // 파라미터로 받은 값 사용

      // 댓글 스타일 결정
      let style: string, context: string;
      if (isOwnPost) {
        style = this.commentTypes.own_post.styles[Math.floor(Math.random() * this.commentTypes.own_post.styles.length)];
        context = '본인글';
      } else {
        style = this.commentTypes.others_post.styles[Math.floor(Math.random() * this.commentTypes.others_post.styles.length)];
        context = '타인글';
      }

      // 다양성 힌트(가벼운 농담/질문형 마무리)
      const lightJoke = Math.random() < 0.15;
      const engagementQuestion = Math.random() < 0.2;

      const userPayload = JSON.stringify({
        mode: 'comment',
        schoolType,
        schoolName: post.schoolName,
        post: { title: post.title, content: post.content, author: post.authorNickname },
        commenter: { nickname: commenter.nickname, isPostAuthor },
        existing: (existingComments || []).slice(0, 10).map(c => ({ author: c.authorNickname, content: c.content })),
        styleHint: style,
        context,
        diversity: { lightJoke, engagementQuestion },
        constraints: { maxLen: 120 }
      });

      const systemPrompt = [
        '역할: 한국 학생 커뮤니티 댓글 생성기',
        '출력: JSON 한 줄 {"content": string, "isReply": boolean, "parentId": string|null, "style": string, "safety": {"blocked": boolean, "reason": string}}',
        '',
        '절대 금지사항:',
        '- 구체적 장소명 지어내기: "OOO 카페", "XXX 맛집", "△△ 학원" 등 금지 (학교마다 지역이 다름)',
        '- 실명/연락처/식별정보, 혐오/차별/성적, 폭력 조장, 광고/스팸',
        '- 비속어 및 욕설 완전 금지: "존나", "개", "지랄", "ㅅㅂ", "ㅈㄴ", "ㅂㅅ" 등 및 모든 초성 표현 금지',
        '- 논리적 모순: 게시글 작성자가 자기 글에 "댓글 달아줘서 고마워", "댓글 많이 달아주세요" 등 금지',
        '',
        '허용 및 권장사항:',
        '- 실제 콘텐츠명 언급 가능: "지금 우리 학교" 드라마, "원피스" 웹툰, "리그 오브 레전드" 게임 등',
        '- 실제 브랜드명 언급 가능: "삼성", "애플", "나이키" 등',
        '- 실제 연예인/인플루언서 이름 언급 가능: 최신 트렌드 반영',
        '',
        '댓글 작성 규칙:',
        '- 길이: ≤120자, 1~2문장, 게시글과 직접 관련',
        '- 자연스러운 반응: 공감, 질문, 경험 공유, 조언 등',
        '- 건전한 학생 말투: 반말 사용, 건전한 줄임말(ㅋㅋ, ㄹㅇ, 진짜, 완전, 레알, 갓 등) 허용',
        '- 작성자 구분:',
        '  * isPostAuthor=true: 게시글 작성자 → 추가 설명, 정정, 업데이트, 보충 정보 위주',
        '    예시: "아 그리고 추가로...", "정정하자면...", "보충하면..."',
        '    금지: "댓글 달아줘서 고마워", "댓글 많이 달아주세요", "관심 가져줘서 감사" 등',
        '  * isPostAuthor=false: 다른 학생 → 공감, 질문, 경험 공유, 조언, 반박, 칭찬 위주',
        '- 다양성: diversity.lightJoke=true면 가벼운 무해한 농담을 한 구절 내 허용',
        '- 참여유도: diversity.engagementQuestion=true면 짧은 질문형으로 마무리 가능',
        '- 기존 댓글과 표현·논지 중복 금지',
        '- 출력은 오직 JSON 한 줄(설명/마크다운 금지)',
        '',
        '안전성: 의심스러우면 safety.blocked=true로 설정'
      ].join('\n');

      // 1차
      const messages: OpenAIMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPayload }
      ];

      let parsed = this.parseCommentJson(await this.callOpenAI(messages));

      // 백업(차단/형식 실패 시)
      if (!parsed || parsed?.safety?.blocked) {
        const backupPayload = userPayload.replace(/"styleHint"\s*:\s*"[^"]*"/, '"styleHint":"공감"');
        const raw2 = await this.callOpenAI([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: backupPayload }
        ]);
        parsed = this.parseCommentJson(raw2) || parsed;
      }

      if (parsed && !parsed.safety?.blocked && parsed.content) {
        let content = String(parsed.content).trim();
        const maxLen = 120;
        if (content.length > maxLen) content = content.substring(0, maxLen - 3) + '...';
        return {
          content,
          meta: {
            promptVersion: 'v2-json-2025-10-07',
            diversity: { lightJoke, engagementQuestion },
            policyPass: true,
            style: parsed.style,
            isReply: false,
            parentId: null
          }
        };
      }

      const defaults = ['좋은 글이네요!', '공감해요', '저도 비슷했어요', '재밌네요', '정보 고마워요'];
      const content = defaults[Math.floor(Math.random() * defaults.length)];
      return {
        content,
        meta: {
          promptVersion: 'v2-json-2025-10-07',
          diversity: { lightJoke, engagementQuestion },
          policyPass: false,
          isReply: false,
          parentId: null
        }
      };
    } catch (error) {
      console.error('댓글 생성 실패:', error);
      const defaults = ['좋은 글이네요!', '공감해요', '도움됐어요'];
      const content = defaults[Math.floor(Math.random() * defaults.length)];
      return {
        content,
        meta: {
          promptVersion: 'v2-json-2025-10-07',
          policyPass: false,
          isReply: false,
          parentId: null
        }
      };
    }
  }

  /**
   * 학교 유형별 댓글 가이드라인
   */
  private getCommentGuidelines(
    schoolType: 'elementary' | 'middle' | 'high', 
    style: string
  ): string {
    const baseGuidelines = {
      elementary: {
        추가설명: '게시글에 빠진 내용을 귀엽게 추가 설명',
        감사인사: '댓글 달아준 친구들에게 고마워하는 마음 표현',
        공감: '와! 저도요! 같은 느낌으로 공감 표현',
        질문: '궁금한 것을 순수하게 질문',
        경험공유: '비슷한 경험을 간단하게 공유',
        칭찬: '친구를 칭찬하는 따뜻한 말'
      },
      middle: {
        추가설명: '게시글 내용에 대한 추가 정보나 설명',
        감사인사: '댓글에 대한 감사 표현',
        공감: '완전 공감이에요, 저도 그래요 스타일',
        질문: '구체적이고 실용적인 질문',
        경험공유: '자신의 경험을 구체적으로 공유',
        반박: '다른 의견을 정중하게 표현',
        조언: '도움이 될 만한 조언 제공'
      },
      high: {
        추가설명: '게시글의 부족한 부분을 보완하는 설명',
        감사인사: '진심어린 감사 표현',
        공감: '깊이 있는 공감과 이해 표현',
        질문: '심도 있는 질문이나 토론 유도',
        경험공유: '자세한 경험담과 교훈 공유',
        반박: '논리적이고 건설적인 반박',
        조언: '실질적이고 도움되는 조언'
      }
    };

    return baseGuidelines[schoolType][style as keyof typeof baseGuidelines[typeof schoolType]] || '자연스럽고 친근한 댓글 작성';
  }

  /**
   * 댓글 생성 및 저장
   */
  private async createComment(
    postId: string, 
    commentContent: string, 
    commenter: Bot, 
    parentCommentId?: string,
    meta?: GeneratedComment['meta']
  ): Promise<string> {
    try {
      const commentData = {
        postId,
        content: commentContent,
        authorId: commenter.uid,
        authorNickname: commenter.nickname,
        authorInfo: {
          displayName: commenter.nickname,
          profileImageUrl: commenter.profileImage || '',
          isAnonymous: false
        },
        parentId: parentCommentId || null, // types/index.ts의 Comment 인터페이스에 맞춤
        isAnonymous: false,
        stats: {
          likeCount: 0,
          replyCount: 0
        },
        status: {
          isDeleted: false,
          isHidden: false,
          isBlocked: false
        },
        fake: true, // AI 생성 댓글 표시
        aiMeta: {
          ...meta,
          generatedAt: this.FieldValue.serverTimestamp(),
          version: '1.0',
          model: 'gpt-3.5-turbo', // 실제 사용 중인 모델로 변경
          source: 'comment-service'
        },
        createdAt: this.FieldValue.serverTimestamp(),
        updatedAt: this.FieldValue.serverTimestamp()
      };

      // 댓글 저장
      const commentRef = await this.db.collection('comments').add(commentData);
      
      // 게시글의 댓글 수 증가
      await this.db.collection('posts').doc(postId).update({
        'stats.commentCount': this.FieldValue.increment(1),
        updatedAt: this.FieldValue.serverTimestamp()
      });

      // 대댓글인 경우 부모 댓글의 대댓글 수 증가
      if (parentCommentId) {
        await this.db.collection('comments').doc(parentCommentId).update({
          'stats.replyCount': this.FieldValue.increment(1),
          updatedAt: this.FieldValue.serverTimestamp()
        });
      }

      console.log(`✅ 댓글 생성: ${commenter.nickname} → "${commentContent.substring(0, 30)}..."`);
      return commentRef.id;

    } catch (error) {
      console.error('댓글 저장 실패:', error);
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
   * 기존 댓글들 조회 (계층 구조 고려)
   */
  private async getExistingComments(postId: string): Promise<Comment[]> {
    try {
      const commentsQuery = await this.db
        .collection('comments')
        .where('postId', '==', postId)
        .where('status.isDeleted', '==', false)
        .orderBy('createdAt', 'asc')
        .limit(20) // 더 많은 댓글 조회
        .get();

      const comments: Comment[] = [];
      commentsQuery.docs.forEach(doc => {
        const data = doc.data();
        comments.push({
          id: doc.id,
          content: data.content,
          authorId: data.authorId,
          authorNickname: data.authorNickname,
          isReply: !!data.parentId, // parentId가 있으면 대댓글
          parentCommentId: data.parentId,
          fake: data.fake || false
        });
      });

      return comments;
    } catch (error) {
      console.error('댓글 조회 실패:', error);
      return [];
    }
  }

  /**
   * 특정 댓글의 모든 대댓글 조회
   */
  private async getRepliesForComment(commentId: string): Promise<Comment[]> {
    try {
      const repliesQuery = await this.db
        .collection('comments')
        .where('parentId', '==', commentId)
        .where('status.isDeleted', '==', false)
        .orderBy('createdAt', 'asc')
        .get();

      const replies: Comment[] = [];
      repliesQuery.docs.forEach(doc => {
        const data = doc.data();
        replies.push({
          id: doc.id,
          content: data.content,
          authorId: data.authorId,
          authorNickname: data.authorNickname,
          isReply: true,
          parentCommentId: data.parentId,
          fake: data.fake || false
        });
      });

      return replies;

    } catch (error) {
      console.error('대댓글 조회 실패:', error);
      return [];
    }
  }

  /**
   * 댓글 생성 메인 로직
   */
  public async generateCommentsForPosts(
    schoolLimit: number = 5, 
    commentsPerSchool: number = 3, 
    maxCommentsPerPost: number = 2,
    onProgress?: ProgressCallback
  ): Promise<number> {
    try {
      console.log('💬 AI 댓글 생성 시작...');
      console.log(`📊 설정: ${schoolLimit}개 학교, 학교당 ${commentsPerSchool}개 게시글, 게시글당 최대 ${maxCommentsPerPost}개 댓글\n`);

      // 1단계: 댓글을 달 게시글 선택
      const selectedPosts = await this.selectPostsForComments(schoolLimit, commentsPerSchool);
      
      if (selectedPosts.length === 0) {
        console.log('❌ 댓글을 달 게시글이 없습니다.');
        return 0;
      }

      let totalCommentsGenerated = 0;
      const totalPosts = selectedPosts.length;

      // 2단계: 각 게시글에 댓글 생성
      for (let postIndex = 0; postIndex < selectedPosts.length; postIndex++) {
        const post = selectedPosts[postIndex];
        
        try {
          console.log(`\n📝 "${post.title}" (${post.schoolName}) 처리 중...`);

          // 해당 학교의 봇들 조회
          const schoolBots = await this.getSchoolBots(post.schoolId);
          if (schoolBots.length === 0) {
            console.warn(`⚠️ ${post.schoolName}에 봇이 없습니다.`);
            continue;
          }

          // 기존 댓글들 조회
          const existingComments = await this.getExistingComments(post.id);
          
          // 댓글을 달 봇 선택 (같은 게시글에 너무 많은 댓글 방지)
          const botCommentCounts = new Map<string, number>();
          existingComments.forEach(comment => {
            const count = botCommentCounts.get(comment.authorId) || 0;
            botCommentCounts.set(comment.authorId, count + 1);
          });
          
          // 같은 게시글에 3개 이상 댓글을 단 봇은 제외
          const availableBots = schoolBots.filter(bot => 
            (botCommentCounts.get(bot.uid) || 0) < 3
          );

          if (availableBots.length === 0) {
            console.log(`   ⚠️ 댓글을 달 수 있는 봇이 없습니다.`);
            continue;
          }

          // 게시글 작성자가 아닌 다른 봇들 분리
          const otherBots = availableBots.filter(bot => bot.uid !== post.authorId);
          
          // 첫 댓글이 없는 경우 (댓글 수가 0개) 다른 봇이 우선 작성
          const isFirstComment = existingComments.length === 0;
          
          let selectedBots: typeof availableBots = [];
          
          if (isFirstComment && otherBots.length > 0) {
            // 첫 댓글은 작성자가 아닌 다른 봇이 작성
            const shuffledOtherBots = otherBots.sort(() => Math.random() - 0.5);
            selectedBots = shuffledOtherBots.slice(0, 1);
            console.log(`   🎯 첫 댓글: 다른 봇(${selectedBots[0].nickname})이 작성`);
          } else {
            // 일반적인 경우: 랜덤하게 1-2개 댓글 생성
            const commentsToGenerate = Math.min(
              Math.floor(Math.random() * maxCommentsPerPost) + 1,
              availableBots.length
            );
            
            const shuffledBots = availableBots.sort(() => Math.random() - 0.5);
            selectedBots = shuffledBots.slice(0, commentsToGenerate);
          }

          for (const bot of selectedBots) {
            try {
              // 실시간으로 최신 댓글들 다시 조회 (새로 생성된 댓글 반영)
              const currentComments = await this.getExistingComments(post.id);
              
              // 대댓글 생성 여부 결정 (40% 확률)
              const shouldCreateReply = Math.random() < this.commentTypes.reply.probability && currentComments.length > 0;
              
              let generated: GeneratedComment;
              let commentContent: string;
              let parentCommentId: string | undefined;
              
              // 작성자인지 여부 확인
              const isPostAuthor = bot.uid === post.authorId;
              
              if (shouldCreateReply) {
                // 대댓글 생성
                const parentComment = currentComments[Math.floor(Math.random() * currentComments.length)];
                parentCommentId = parentComment.id;
                generated = await this.generateReplyComment(post, bot, parentComment, isPostAuthor);
                commentContent = generated.content;
              } else {
                // 일반 댓글 생성 (작성자 여부에 따라 다른 스타일)
                const commentType = isPostAuthor ? 'own_post' : 'others_post';
                generated = await this.generateComment(post, bot, commentType, currentComments, isPostAuthor);
                commentContent = generated.content;
              }
              
              // 댓글 저장
              await this.createComment(post.id, commentContent, bot, parentCommentId, generated?.meta);
              totalCommentsGenerated++;

              // 자연스러운 시간차 생성 (1-5분 랜덤)
              const naturalDelay = Math.random() * (300000 - 60000) + 60000; // 1-5분
              await new Promise(resolve => setTimeout(resolve, Math.min(naturalDelay, 3000))); // 개발 시에는 최대 3초로 제한

            } catch (commentError) {
              console.error(`댓글 생성 실패 (${bot.nickname}):`, commentError);
            }
          }

          console.log(`   ✅ ${selectedBots.length}개 댓글 생성 완료`);

          // 진행률 콜백 호출
          if (onProgress) {
            onProgress(postIndex + 1, totalPosts, `게시글 처리 중... (${postIndex + 1}/${totalPosts})`);
          }

        } catch (postError) {
          console.error(`게시글 처리 실패 (${post.title}):`, postError);
        }
      }

      console.log(`\n🎉 댓글 생성 완료!`);
      console.log(`📊 총 ${totalCommentsGenerated}개 댓글 생성됨`);
      
      return totalCommentsGenerated;

    } catch (error) {
      console.error('댓글 생성 프로세스 실패:', error);
      throw error;
    }
  }

  /**
   * 랜덤 게시글들에 댓글 생성 (배치 처리용)
   */
  public async generateCommentsForRandomPosts(
    commentCount: number,
    onProgress?: ProgressCallback
  ): Promise<number> {
    try {
      console.log(`💬 랜덤 게시글들에 ${commentCount}개 댓글 생성 시작...`);

      // 댓글이 필요한 게시글들 조회 (최근 게시글 중 댓글 수가 적은 것들)
      const postsQuery = await this.db
        .collection('posts')
        .where('status.isDeleted', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(commentCount * 3) // 여유분 확보하여 최근 게시글들 조회
        .get();

      if (postsQuery.empty) {
        throw new Error('댓글을 달 게시글이 없습니다.');
      }

      const allPosts = postsQuery.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as (Post & { id: string })[];

      // 댓글 수가 적은 게시글들 우선 선택 (0-5개 댓글)
      const lowCommentPosts = allPosts.filter(post => {
        const postData = post as Post & { id: string; stats?: { commentCount?: number } };
        return (postData.stats?.commentCount || 0) <= 5;
      });
      const candidatePosts = lowCommentPosts.length > 0 ? lowCommentPosts : allPosts.slice(0, commentCount * 2);
      
      // 게시글들을 랜덤하게 섞어서 선택
      const shuffledPosts = candidatePosts.sort(() => Math.random() - 0.5);
      const availablePosts = shuffledPosts.slice(0, Math.min(commentCount * 2, shuffledPosts.length));

      console.log(`📊 전체 게시글: ${allPosts.length}개, 댓글 적은 게시글: ${candidatePosts.length}개, 선택된 게시글: ${availablePosts.length}개`);

      let generatedCount = 0;
      let attempts = 0;
      const maxAttempts = availablePosts.length * 2; // 재시도 제한

      while (generatedCount < commentCount && attempts < maxAttempts) {
        const postIndex = attempts % availablePosts.length;
        try {
          const post = availablePosts[postIndex];
          
          // 해당 학교의 봇들 조회
          const schoolBots = await this.getSchoolBots(post.schoolId);
          if (schoolBots.length === 0) {
            console.warn(`${post.schoolName}에 봇이 없습니다.`);
            attempts++;
            continue;
          }

          // 기존 댓글들 조회
          const existingComments = await this.getExistingComments(post.id);
          
          // 댓글을 달 수 있는 봇 선택 (같은 게시글에 너무 많은 댓글 방지)
          const botCommentCounts = new Map<string, number>();
          existingComments.forEach(comment => {
            const count = botCommentCounts.get(comment.authorId) || 0;
            botCommentCounts.set(comment.authorId, count + 1);
          });
          
          // 같은 게시글에 3개 이상 댓글을 단 봇은 제외
          const availableBots = schoolBots.filter(bot => 
            (botCommentCounts.get(bot.uid) || 0) < 3
          );

          if (availableBots.length === 0) {
            console.warn(`게시글 ${post.id}에 댓글을 달 수 있는 봇이 없습니다.`);
            attempts++;
            continue;
          }

          // 랜덤하게 봇 선택
          const randomBot = availableBots[Math.floor(Math.random() * availableBots.length)];
          
          // 실시간으로 최신 댓글들 다시 조회 (새로 생성된 댓글 반영)
          const currentComments = await this.getExistingComments(post.id);
          
          // 작성자인지 여부 확인
          const isPostAuthor = randomBot.uid === post.authorId;
          
          // 대댓글 생성 여부 결정 (40% 확률)
          const shouldCreateReply = Math.random() < this.commentTypes.reply.probability && currentComments.length > 0;
          
          let generated: GeneratedComment;
          let commentContent: string;
          let parentCommentId: string | undefined;
          
          if (shouldCreateReply) {
            // 대댓글 생성
            const parentComment = currentComments[Math.floor(Math.random() * currentComments.length)];
            parentCommentId = parentComment.id;
            generated = await this.generateReplyComment(post as Post, randomBot, parentComment, isPostAuthor);
            commentContent = generated.content;
          } else {
            // 일반 댓글 생성 (작성자 여부에 따라 다른 스타일)
            const commentType = isPostAuthor ? 'own_post' : 'others_post';
            generated = await this.generateComment(
              post as Post, 
              randomBot, 
              commentType, 
              currentComments,
              isPostAuthor
            );
            commentContent = generated.content;
          }
          
          // 댓글 저장
          await this.createComment(post.id, commentContent, randomBot, parentCommentId, generated?.meta);
          generatedCount++;

          if (onProgress) {
            onProgress(generatedCount, commentCount, `댓글 생성 중... (${generatedCount}/${commentCount})`);
          }

          // 딜레이 (API 부하 방지)
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (commentError) {
          console.error(`댓글 생성 실패:`, commentError);
        }
        
        attempts++;
      }

      console.log(`✅ ${generatedCount}개 댓글 생성 완료`);
      return generatedCount;

    } catch (error) {
      console.error('랜덤 댓글 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 특정 게시글에 댓글 생성
   */
  public async generateCommentsForPost(
    postId: string, 
    maxComments: number = 3,
    onProgress?: ProgressCallback
  ): Promise<number> {
    try {
      console.log(`💬 게시글 ${postId}에 댓글 생성 시작...`);

      // 게시글 정보 조회
      const postDoc = await this.db.collection('posts').doc(postId).get();
      if (!postDoc.exists) {
        throw new Error('게시글을 찾을 수 없습니다.');
      }

      const postData = postDoc.data()!;
      const post: Post = {
        id: postDoc.id,
        title: postData.title,
        content: postData.content,
        authorId: postData.authorId,
        authorNickname: postData.authorNickname,
        schoolId: postData.schoolId,
        schoolName: postData.schoolName || '알 수 없는 학교',
        commentCount: postData.stats?.commentCount || 0,
        createdAt: postData.createdAt,
        fake: postData.fake || false
      };

      // 해당 학교의 봇들 조회
      const schoolBots = await this.getSchoolBots(post.schoolId);
      if (schoolBots.length === 0) {
        throw new Error(`${post.schoolName}에 봇이 없습니다.`);
      }

      // 기존 댓글들 조회
      const existingComments = await this.getExistingComments(post.id);
      
      // 댓글을 달 봇 선택
      const availableBots = schoolBots.filter(bot => 
        !existingComments.some(comment => comment.authorId === bot.uid)
      );

      if (availableBots.length === 0) {
        throw new Error('댓글을 달 수 있는 봇이 없습니다.');
      }

      const commentsToGenerate = Math.min(maxComments, availableBots.length);
      const shuffledBots = availableBots.sort(() => Math.random() - 0.5);
      const selectedBots = shuffledBots.slice(0, commentsToGenerate);

      let generatedCount = 0;

      for (let i = 0; i < selectedBots.length; i++) {
        const bot = selectedBots[i];
        
        try {
          // 실시간으로 최신 댓글들 다시 조회 (새로 생성된 댓글 반영)
          const currentComments = await this.getExistingComments(post.id);
          
          // 작성자인지 여부 확인
          const isPostAuthor = bot.uid === post.authorId;
          
          // 대댓글 생성 여부 결정 (40% 확률)
          const shouldCreateReply = Math.random() < this.commentTypes.reply.probability && currentComments.length > 0;
          let commentContent: string;
          let parentCommentId: string | undefined;
          
          if (shouldCreateReply) {
            // 대댓글 생성
            const parentComment = currentComments[Math.floor(Math.random() * currentComments.length)];
            parentCommentId = parentComment.id;
            const generated = await this.generateReplyComment(post, bot, parentComment, isPostAuthor);
            commentContent = generated.content;
            await this.createComment(post.id, commentContent, bot, parentCommentId, generated?.meta);
          } else {
            // 일반 댓글 생성 (작성자 여부에 따라 다른 스타일)
            const commentType = isPostAuthor ? 'own_post' : 'others_post';
            const generated = await this.generateComment(post, bot, commentType, currentComments, isPostAuthor);
            commentContent = generated.content;
            await this.createComment(post.id, commentContent, bot, parentCommentId, generated?.meta);
          }
          generatedCount++;

          if (onProgress) {
            onProgress(i + 1, selectedBots.length, `댓글 생성 중... (${i + 1}/${selectedBots.length})`);
          }

          // 딜레이 (API 부하 방지)
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (commentError) {
          console.error(`댓글 생성 실패 (${bot.nickname}):`, commentError);
        }
      }

      console.log(`✅ ${generatedCount}개 댓글 생성 완료`);
      return generatedCount;

    } catch (error) {
      console.error('게시글 댓글 생성 실패:', error);
      throw error;
    }
  }
}

export default CommentService;

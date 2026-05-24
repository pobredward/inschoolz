import { NextRequest, NextResponse } from 'next/server';
import { BotService, PostService, CommentService, CleanupService } from '@/lib/services';

// Next.js API Route 설정 (단일 배치 처리용)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60초 타임아웃 (Vercel Hobby 플랜)

/**
 * 단일 배치 작업 처리 API
 * 클라이언트에서 배치 단위로 호출하여 서버 제한 시간을 우회
 */
export async function POST(request: NextRequest) {
  console.log('🚀 [SINGLE-BATCH] API 호출 시작');
  
  try {
    const body = await request.json();
    const { type, ...params } = body;
    
    console.log('📋 [SINGLE-BATCH] 요청 파라미터:', { type, params });

    // 환경변수 확인
    const hasFirebaseKey = !!process.env.FIREBASE_PRIVATE_KEY;
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
    
    console.log('🔑 [SINGLE-BATCH] 환경변수 상태:', { hasFirebaseKey, hasOpenAIKey });

    if (!hasFirebaseKey || !hasOpenAIKey) {
      throw new Error('필수 환경변수가 설정되지 않았습니다.');
    }

    let result;

    switch (type) {
      case 'create_bots':
        result = await executeBotCreationBatch(params);
        break;
      
      case 'generate_posts':
        result = await executePostGenerationBatch(params);
        break;
      
      case 'generate_comments':
        result = await executeCommentGenerationBatch(params);
        break;
      
      case 'cleanup':
        result = await executeCleanupBatch();
        break;
      
      default:
        throw new Error(`지원하지 않는 작업 타입: ${type}`);
    }

    console.log('✅ [SINGLE-BATCH] 배치 작업 완료:', result);
    
    return NextResponse.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('❌ [SINGLE-BATCH] 배치 작업 실패:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * 봇 생성 배치 실행
 */
async function executeBotCreationBatch(params: { 
  schoolCount?: number; 
  botsPerSchool: number;
  schoolId?: string;
  schoolName?: string;
}) {
  const { schoolCount, botsPerSchool, schoolId, schoolName } = params;
  
  console.log(`🤖 [BOT-BATCH] 봇 생성 시작:`, params);
  
  const botService = new BotService();
  
  // 특정 학교에 봇 생성
  if (schoolId && schoolName) {
    const result = await botService.createBotsForSchool(schoolId, schoolName, botsPerSchool);
    console.log('✅ [BOT-BATCH] 특정 학교 봇 생성 완료:', result);
    return result;
  }
  
  // 여러 학교에 봇 생성
  const result = await botService.createBotsForSchools(schoolCount || 1, botsPerSchool);
  console.log('✅ [BOT-BATCH] 봇 생성 완료:', result);
  return result;
}

/**
 * 게시글 생성 배치 실행
 */
async function executePostGenerationBatch(params: { postCount: number }) {
  const { postCount } = params;
  
  console.log(`📝 [POST-BATCH] 게시글 생성 시작: ${postCount}개`);
  
  const postService = new PostService();
  const result = await postService.generatePostsForRandomSchools(postCount);
  
  console.log('✅ [POST-BATCH] 게시글 생성 완료:', result);
  return result;
}

/**
 * 댓글 생성 배치 실행
 */
async function executeCommentGenerationBatch(params: { commentCount: number }) {
  const { commentCount } = params;
  
  console.log(`💬 [COMMENT-BATCH] 댓글 생성 시작: ${commentCount}개`);
  
  const commentService = new CommentService();
  
  // 랜덤 게시글에 정확히 commentCount 개수만큼 댓글 생성
  const result = await commentService.generateCommentsForRandomPosts(commentCount);
  
  console.log('✅ [COMMENT-BATCH] 댓글 생성 완료:', result);
  return { generatedCount: result };
}

/**
 * 정리 작업 배치 실행
 */
async function executeCleanupBatch() {
  console.log('🧹 [CLEANUP-BATCH] 정리 작업 시작');
  
  const cleanupService = new CleanupService();
  const result = await cleanupService.cleanupAllFakeData();
  
  console.log('✅ [CLEANUP-BATCH] 정리 작업 완료:', result);
  return result;
}

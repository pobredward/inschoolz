import { guardAdmin } from '@/lib/server/auth';
import { NextRequest, NextResponse } from 'next/server';
import { BotService, PostService, CleanupService, CommentService } from '@/lib/services';

// Next.js API Route 설정 (프로덕션 환경 최적화)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel Hobby 플랜 제한: 60초 이내

interface BulkOperation {
  id: string;
  type: 'create_bots' | 'generate_bots' | 'generate_posts' | 'delete_posts' | 'cleanup' | 'delete_bots' | 'generate_comments';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  total: number;
  message: string;
  startedAt: string;
  completedAt?: string;
  params: any;
}

// 메모리에 작업 상태 저장 (실제 운영에서는 Redis나 DB 사용 권장)
declare global {
  var bulkOperations: Map<string, BulkOperation> | undefined;
}

const operations = globalThis.bulkOperations ?? new Map<string, BulkOperation>();
globalThis.bulkOperations = operations;

/**
 * POST /api/admin/bulk-operations
 * 대량 작업 시작
 */
export async function POST(request: NextRequest) {
  const denied = await guardAdmin(request);
  if (denied) return denied;
  try {
    console.log('🚀 [BULK-OPS] POST 요청 시작');
    
    const body = await request.json();
    const { type, parameters = {}, params = parameters } = body;
    
    console.log('📋 [BULK-OPS] 요청 파라미터:', { type, params });
    console.log('🔍 [BULK-OPS] 작업 타입 확인:', type, typeof type);

    console.log('⚡ [BULK-OPS] 대량 작업 시작:', { type, params });
    console.log('🌍 [BULK-OPS] 환경:', {
      nodeEnv: process.env.NODE_ENV,
      hasFirebaseKey: !!process.env.FIREBASE_PRIVATE_KEY,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY
    });

    // 입력 유효성 검사
    const validationError = validateOperationParams(type, params);
    if (validationError) {
      console.error('❌ [BULK-OPS] 유효성 검사 실패:', validationError);
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400 }
      );
    }

    // 동시 실행 중인 같은 타입의 작업이 있는지 확인
    const runningOperations = Array.from(operations.values()).filter(
      op => op.status === 'running' && op.type === type
    );
    
    if (runningOperations.length > 0) {
      const runningOperation = runningOperations[0];
      console.log('⚠️ [BULK-OPS] 중복 작업 감지:', runningOperation.id);
      return NextResponse.json(
        { 
          success: false, 
          error: `이미 실행 중인 ${getOperationTypeName(type)} 작업이 있습니다.`,
          details: {
            operationId: runningOperation.id,
            progress: runningOperation.progress,
            total: runningOperation.total,
            message: runningOperation.message,
            startedAt: runningOperation.startedAt
          }
        },
        { status: 409 }
      );
    }

    // 작업 ID 생성
    const operationId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('🆔 [BULK-OPS] 작업 ID 생성:', operationId);
    
    // 작업 정보 초기화
    const operation: BulkOperation = {
      id: operationId,
      type,
      status: 'pending',
      progress: 0,
      total: 0,
      message: '작업을 준비하는 중...',
      startedAt: new Date().toISOString(),
      params
    };

    operations.set(operationId, operation);
    console.log('💾 [BULK-OPS] 작업 정보 저장 완료');

    // 백그라운드에서 작업 실행 (즉시 응답을 위해 await 제거)
    console.log('🏃 [BULK-OPS] 백그라운드 작업 시작');
    setImmediate(() => {
      executeOperation(operationId, type, params).catch(error => {
        console.error('❌ [BULK-OPS] 백그라운드 작업 오류:', error);
      });
    });

    console.log('✅ [BULK-OPS] POST 응답 반환');
    return NextResponse.json({
      success: true,
      operationId,
      message: '대량 작업이 시작되었습니다.',
      operation
    });

  } catch (error) {
    console.error('❌ [BULK-OPS] POST 요청 오류:', error);
    console.error('❌ [BULK-OPS] 오류 스택:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json(
      { 
        success: false, 
        error: `대량 작업을 시작할 수 없습니다: ${error instanceof Error ? error.message : 'Unknown error'}` 
      },
      { status: 500 }
    );
  }
}

/**
 * 작업 파라미터 유효성 검사
 */
function validateOperationParams(type: string, params: any): string | null {
  switch (type) {
    case 'create_bots':
    case 'generate_bots':
      if (params.schoolCount && (params.schoolCount < 1 || params.schoolCount > 15000)) {
        return '학교 수는 1개 이상 15,000개 이하여야 합니다.';
      }
      if (params.schoolIds && (!Array.isArray(params.schoolIds) || params.schoolIds.length === 0)) {
        return '학교 ID 목록이 유효하지 않습니다.';
      }
      if (params.botsPerSchool && (params.botsPerSchool < 1 || params.botsPerSchool > 10)) {
        return '학교당 봇 수는 1개 이상 10개 이하여야 합니다.';
      }
      break;
      
    case 'generate_posts':
      if (params.schoolLimit && (params.schoolLimit < 1 || params.schoolLimit > 15000)) {
        return '대상 학교 수는 1개 이상 15,000개 이하여야 합니다.';
      }
      if (params.postsPerSchool && (params.postsPerSchool < 1 || params.postsPerSchool > 10)) {
        return '학교당 게시글 수는 1개 이상 10개 이하여야 합니다.';
      }
      break;
      
    case 'cleanup':
      if (params.olderThanDays && (params.olderThanDays < 1 || params.olderThanDays > 365)) {
        return '삭제 기준 일수는 1일 이상 365일 이하여야 합니다.';
      }
      break;
      
    case 'delete_posts':
      // 모든 게시글 삭제는 특별한 확인이 필요하므로 여기서는 허용
      break;
      
    case 'delete_bots':
      // withPosts 매개변수 검증
      if (params.withPosts !== undefined && typeof params.withPosts !== 'boolean') {
        return 'withPosts 매개변수는 boolean 타입이어야 합니다.';
      }
      break;
      
    case 'generate_comments':
      if (params.schoolLimit && (params.schoolLimit < 1 || params.schoolLimit > 100)) {
        return '학교 수는 1개 이상 100개 이하여야 합니다.';
      }
      if (params.commentsPerSchool && (params.commentsPerSchool < 1 || params.commentsPerSchool > 20)) {
        return '학교당 게시글 수는 1개 이상 20개 이하여야 합니다.';
      }
      if (params.maxCommentsPerPost && (params.maxCommentsPerPost < 1 || params.maxCommentsPerPost > 10)) {
        return '게시글당 댓글 수는 1개 이상 10개 이하여야 합니다.';
      }
      // 목표 댓글 수가 있으면 유효성 검사
      if (params.targetCommentCount && (params.targetCommentCount < 1 || params.targetCommentCount > 1000)) {
        return '목표 댓글 수는 1개 이상 1000개 이하여야 합니다.';
      }
      break;
      
    default:
      return `알 수 없는 작업 유형: ${type}`;
  }
  
  return null;
}

/**
 * 작업 유형 이름 반환
 */
function getOperationTypeName(type: string): string {
  switch (type) {
    case 'create_bots': 
    case 'generate_bots': return '봇 계정 생성';
    case 'generate_posts': return 'AI 게시글 생성';
    case 'delete_posts': return '게시글 삭제';
    case 'cleanup': return '데이터 정리';
    case 'delete_bots': return '봇 삭제';
    case 'generate_comments': return '댓글 생성';
    default: return type;
  }
}

/**
 * GET /api/admin/bulk-operations
 * 모든 대량 작업 상태 조회
 */
export async function GET(request: Request) {
  const denied = await guardAdmin(request);
  if (denied) return denied;
  try {
    const allOperations = Array.from(operations.values())
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 20); // 최근 20개만

    return NextResponse.json({
      success: true,
      data: allOperations,
      total: allOperations.length
    });

  } catch (error) {
    console.error('❌ 대량 작업 목록 조회 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `대량 작업 목록을 조회할 수 없습니다: ${error instanceof Error ? error.message : 'Unknown error'}` 
      },
      { status: 500 }
    );
  }
}

/**
 * 대량 작업 실행 함수
 */
async function executeOperation(operationId: string, type: string, params: any) {
  const operation = operations.get(operationId);
  if (!operation) return;

  try {
    // 상태 업데이트: 실행 중
    operation.status = 'running';
    operation.message = '작업을 실행하는 중...';
    operations.set(operationId, operation);

    console.log(`🔄 [BULK-OPS] 작업 실행 시작: ${type} (${operationId})`);

    switch (type) {
      case 'create_bots':
      case 'generate_bots':
        await executeBotCreation(operationId, params);
        break;
      case 'generate_posts':
        await executePostGeneration(operationId, params);
        break;
      case 'delete_posts':
      case 'cleanup_posts':
        await executePostDeletion(operationId, params);
        break;
      case 'cleanup':
        await executeCleanup(operationId, params);
        break;
      case 'delete_bots':
      case 'cleanup_bots':
        await executeBotDeletion(operationId, params);
        break;
      case 'generate_comments':
        await executeCommentGeneration(operationId, params);
        break;
      case 'cleanup_all_bots':
        await executeBotDeletion(operationId, { all: true });
        break;
      case 'cleanup_all_posts':
        await executePostDeletion(operationId, { all: true });
        break;
      case 'cleanup_all_comments':
        await executeCommentDeletion(operationId, { all: true });
        break;
      case 'cleanup_comments':
        await executeCommentDeletion(operationId, params);
        break;
      default:
        throw new Error(`알 수 없는 작업 유형: ${type}`);
    }

    // 완료 상태 업데이트
    const finalOperation = operations.get(operationId);
    if (finalOperation) {
      finalOperation.status = 'completed';
      finalOperation.completedAt = new Date().toISOString();
      finalOperation.message = '작업이 성공적으로 완료되었습니다.';
      operations.set(operationId, finalOperation);
    }

  } catch (error) {
    console.error(`❌ 대량 작업 실행 오류 (${operationId}):`, error);
    
    const failedOperation = operations.get(operationId);
    if (failedOperation) {
      failedOperation.status = 'failed';
      failedOperation.completedAt = new Date().toISOString();
      failedOperation.message = `작업 실패: ${error instanceof Error ? error.message : 'Unknown error'}`;
      operations.set(operationId, failedOperation);
    }
  }
}

/**
 * 봇 계정 대량 생성
 */
async function executeBotCreation(operationId: string, params: any) {
  const { schoolCount = 100, schoolIds, botsPerSchool = 1, randomBotsPerSchool = false } = params;
  
  console.log(`🚀 [BOT-CREATE] 봇 생성 작업 시작`);
  console.log(`📋 [BOT-CREATE] 작업 ID: ${operationId}`);
  console.log(`📊 [BOT-CREATE] 파라미터:`, { schoolCount, schoolIds, botsPerSchool, randomBotsPerSchool });
  
  try {
    const operation = operations.get(operationId);
    if (!operation) {
      console.error(`❌ [BOT-CREATE] 작업을 찾을 수 없음: ${operationId}`);
      console.error(`📋 [BOT-CREATE] 현재 작업 목록:`, Array.from(operations.keys()));
      throw new Error('작업을 찾을 수 없습니다.');
    }

    console.log(`✅ [BOT-CREATE] 작업 발견:`, {
      id: operation.id,
      type: operation.type,
      status: operation.status,
      progress: operation.progress,
      total: operation.total
    });

    console.log('🏗️ [BOT-CREATE] BotService 인스턴스 생성 중...');
    
    // BotService 인스턴스 생성
    let botService;
    try {
      botService = new BotService();
      console.log('✅ [BOT-CREATE] BotService 인스턴스 생성 완료');
    } catch (serviceError) {
      console.error('❌ [BOT-CREATE] BotService 생성 실패:', serviceError);
      console.error('❌ [BOT-CREATE] 오류 스택:', serviceError instanceof Error ? serviceError.stack : 'No stack');
      throw new Error(`BotService 생성 실패: ${serviceError instanceof Error ? serviceError.message : 'Unknown error'}`);
    }
    
    // 진행률 콜백 함수
    const onProgress = (current: number, total: number, message?: string) => {
      const updatedOperation = operations.get(operationId);
      if (updatedOperation) {
        updatedOperation.progress = current;
        updatedOperation.total = total;
        updatedOperation.message = message || `봇 계정 생성 중... (${current}/${total})`;
        operations.set(operationId, updatedOperation);
        console.log(`📊 [BOT-CREATE] 진행률: ${current}/${total} - ${message}`);
      }
    };

    console.log('🚀 [BOT-CREATE] 봇 생성 실행 시작...');
    console.log(`🎯 [BOT-CREATE] 대상 학교 수: ${schoolIds ? schoolIds.length : schoolCount}`);
    
    if (randomBotsPerSchool) {
      console.log(`🎲 [BOT-CREATE] 학교당 봇 수: 2~4개 랜덤 생성`);
      console.log(`📊 [BOT-CREATE] 예상 총 봇 수: ${(schoolIds ? schoolIds.length : schoolCount) * 2.5} (평균)`);
    } else {
      console.log(`🤖 [BOT-CREATE] 학교당 봇 수: ${botsPerSchool}`);
      console.log(`📊 [BOT-CREATE] 예상 총 봇 수: ${(schoolIds ? schoolIds.length : schoolCount) * botsPerSchool}`);
    }
    
    const startTime = Date.now();
    
    // 봇 생성 실행
    const result = await botService.createBotsForSchools(
      schoolIds ? schoolIds.length : schoolCount, 
      randomBotsPerSchool ? -1 : botsPerSchool, // -1은 랜덤 생성을 의미
      onProgress
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`📊 [BOT-CREATE] 봇 생성 결과 (${duration}ms):`, result);
    console.log(`✅ [BOT-CREATE] 생성된 총 봇 수: ${result.totalCreated}`);
    console.log(`🏫 [BOT-CREATE] 처리된 학교 수: ${result.schoolsProcessed}`);
    console.log(`📈 [BOT-CREATE] 학교 유형별 통계:`, result.summary);

    // 최종 상태 업데이트
    const finalOperation = operations.get(operationId);
    if (finalOperation) {
      finalOperation.progress = result.schoolsProcessed;
      finalOperation.total = result.schoolsProcessed;
      finalOperation.message = `${result.totalCreated}개 봇 계정 생성 완료 (${result.schoolsProcessed}개 학교)`;
      operations.set(operationId, finalOperation);
    }

    console.log(`✅ [BOT-CREATE] 완료: ${result.totalCreated}개 봇, ${result.schoolsProcessed}개 학교`);
    
  } catch (error) {
    console.error(`❌ [BOT-CREATE] 실패 (${operationId}):`, error);
    console.error(`❌ [BOT-CREATE] 오류 스택:`, error instanceof Error ? error.stack : 'No stack');
    throw error;
  }
}

/**
 * AI 게시글 대량 생성
 */
async function executePostGeneration(operationId: string, params: any) {
  const { schoolLimit = 100, postsPerSchool = 1, schoolIds } = params;
  
  try {
    const operation = operations.get(operationId);
    if (!operation) throw new Error('작업을 찾을 수 없습니다.');

    const totalPosts = schoolIds ? 
      schoolIds.length * postsPerSchool : 
      schoolLimit * postsPerSchool;

    operation.total = totalPosts;
    operation.message = `${totalPosts}개 AI 게시글을 생성하는 중...`;
    operations.set(operationId, operation);

    // PostService 인스턴스 생성
    const postService = new PostService();
    
    // 진행률 콜백 함수
    const onProgress = (current: number, total: number, message?: string) => {
      const updatedOperation = operations.get(operationId);
      if (updatedOperation) {
        updatedOperation.progress = current;
        updatedOperation.total = total;
        updatedOperation.message = message || `게시글 생성 중... (${current}/${total})`;
        operations.set(operationId, updatedOperation);
      }
    };

    // 게시글 생성 실행 (대량 생성 시 딜레이 최적화)
    const optimizedDelay = totalPosts >= 5000 ? 300 : totalPosts >= 1000 ? 400 : 500;
    const result = await postService.generatePostsForSchools(
      schoolIds ? schoolIds.length : schoolLimit,
      postsPerSchool,
      optimizedDelay,
      onProgress
    );

    // 최종 상태 업데이트
    const finalOperation = operations.get(operationId);
    if (finalOperation) {
      finalOperation.progress = result.totalGenerated;
      finalOperation.total = result.totalGenerated;
      finalOperation.message = `${result.totalGenerated}개 AI 게시글 생성 완료 (${result.schoolsProcessed}개 학교)`;
      operations.set(operationId, finalOperation);
    }

    console.log(`✅ 게시글 생성 완료: ${result.totalGenerated}개 게시글, ${result.schoolsProcessed}개 학교`);
    
  } catch (error) {
    console.error('❌ 게시글 생성 실패:', error);
    throw error;
  }
}

/**
 * AI 게시글 대량 삭제
 */
async function executePostDeletion(operationId: string, params: any) {
  const { all = false, olderThanDays } = params;
  
  try {
    const operation = operations.get(operationId);
    if (!operation) throw new Error('작업을 찾을 수 없습니다.');

    operation.total = 100; // 예상 삭제 수 (실제로는 먼저 카운트해야 함)
    operation.message = 'AI 게시글을 삭제하는 중...';
    operations.set(operationId, operation);

    // CleanupService 인스턴스 생성
    const cleanupService = new CleanupService();
    
    // 진행률 콜백 함수
    const onProgress = (current: number, total: number, message?: string) => {
      const updatedOperation = operations.get(operationId);
      if (updatedOperation) {
        updatedOperation.progress = current;
        updatedOperation.total = total;
        updatedOperation.message = message || `AI 게시글 삭제 중... (${current}/${total})`;
        operations.set(operationId, updatedOperation);
      }
    };

    let result;
    if (all) {
      // 모든 AI 게시글 삭제
      result = await cleanupService.cleanupAllFakePosts(onProgress);
    } else {
      // 특정 날짜 이전 게시글 삭제
      result = await cleanupService.cleanupFakePostsByDate(olderThanDays || 7, onProgress);
    }

    // 최종 상태 업데이트
    const finalOperation = operations.get(operationId);
    if (finalOperation) {
      finalOperation.progress = result.deletedCount;
      finalOperation.total = result.deletedCount;
      finalOperation.message = `${result.deletedCount}개 AI 게시글 삭제 완료 (${result.protectedCount}개 보호됨)`;
      operations.set(operationId, finalOperation);
    }

    console.log(`✅ 게시글 삭제 완료: ${result.deletedCount}개 삭제, ${result.protectedCount}개 보호`);
    
  } catch (error) {
    console.error('❌ 게시글 삭제 실패:', error);
    throw error;
  }
}

/**
 * 데이터 정리
 */
async function executeCleanup(operationId: string, params: any) {
  const { olderThanDays = 30 } = params;
  
  try {
    const operation = operations.get(operationId);
    if (!operation) throw new Error('작업을 찾을 수 없습니다.');

    // CleanupService 인스턴스 생성
    const cleanupService = new CleanupService();
    
    // 진행률 콜백 함수
    const onProgress = (current: number, total: number, message?: string) => {
      const updatedOperation = operations.get(operationId);
      if (updatedOperation) {
        updatedOperation.progress = current;
        updatedOperation.total = total;
        updatedOperation.message = message || `데이터 정리 중... (${current}/${total})`;
        operations.set(operationId, updatedOperation);
      }
    };

    // 전체 AI 데이터 정리
    const result = await cleanupService.cleanupAllFakeData(onProgress);

    // 최종 상태 업데이트
    const finalOperation = operations.get(operationId);
    if (finalOperation) {
      const totalDeleted = result.deletedBots + result.deletedPosts + result.deletedComments;
      finalOperation.progress = totalDeleted;
      finalOperation.total = totalDeleted;
      finalOperation.message = `전체 AI 데이터 정리 완료 (봇: ${result.deletedBots}, 게시글: ${result.deletedPosts}, 댓글: ${result.deletedComments})`;
      operations.set(operationId, finalOperation);
    }

    console.log(`✅ 전체 데이터 정리 완료: 봇 ${result.deletedBots}개, 게시글 ${result.deletedPosts}개, 댓글 ${result.deletedComments}개`);
    
  } catch (error) {
    console.error('❌ 데이터 정리 실패:', error);
    throw error;
  }
}

/**
 * 봇 삭제 작업 실행
 */
async function executeBotDeletion(operationId: string, params: any): Promise<void> {
  const { withPosts = false } = params;
  
  try {
    const operation = operations.get(operationId);
    if (!operation) throw new Error('작업을 찾을 수 없습니다.');

    operation.total = 100; // 예상 봇 수 (실제로는 먼저 카운트해야 함)
    operation.message = withPosts ? '모든 봇과 게시글을 삭제하는 중...' : '모든 봇을 삭제하는 중...';
    operations.set(operationId, operation);

    // BotService 인스턴스 생성
    const botService = new BotService();
    
    // 진행률 콜백 함수
    const onProgress = (current: number, total: number, message?: string) => {
      const updatedOperation = operations.get(operationId);
      if (updatedOperation) {
        updatedOperation.progress = current;
        updatedOperation.total = total;
        updatedOperation.message = message || (withPosts 
          ? `봇과 게시글 삭제 중... (${current}/${total})` 
          : `봇 삭제 중... (${current}/${total})`);
        operations.set(operationId, updatedOperation);
      }
    };

    let result;
    if (withPosts) {
      // 봇과 게시글 모두 삭제
      result = await botService.deleteBotsAndPosts(onProgress);
    } else {
      // 봇만 삭제
      result = await botService.deleteAllBots(onProgress);
    }

    // 최종 상태 업데이트
    const finalOperation = operations.get(operationId);
    if (finalOperation) {
      finalOperation.progress = result.deletedCount;
      finalOperation.total = result.deletedCount;
      finalOperation.message = withPosts 
        ? `${result.deletedCount}개 봇과 관련 데이터 삭제 완료` 
        : `${result.deletedCount}개 봇 삭제 완료`;
      operations.set(operationId, finalOperation);
    }

    console.log(`✅ 봇 삭제 완료: ${result.deletedCount}개 봇${withPosts ? ' 및 관련 데이터' : ''} 삭제`);
    
  } catch (error) {
    console.error('❌ 봇 삭제 실패:', error);
    throw error;
  }
}

/**
 * 댓글 생성 실행
 */
async function executeCommentGeneration(operationId: string, params: any) {
  try {
    console.log(`💬 댓글 생성 시작 (${operationId}):`, params);
    
    const operation = operations.get(operationId);
    if (!operation) throw new Error('작업을 찾을 수 없습니다.');

    const { 
      targetCommentCount,
      useRandomPosts = false,
      // 기존 방식 파라미터들 (하위 호환성)
      schoolLimit = 5, 
      commentsPerSchool = 3, 
      maxCommentsPerPost = 2
    } = params;
    
    // 댓글 수 설정
    const expectedComments = targetCommentCount || (schoolLimit * commentsPerSchool * maxCommentsPerPost);
    operation.total = expectedComments;
    operation.message = `${expectedComments}개 AI 댓글을 생성하는 중...`;
    operations.set(operationId, operation);

    // CommentService 인스턴스 생성
    const commentService = new CommentService();
    
    // 진행률 콜백 함수
    const onProgress = (current: number, total: number, message?: string) => {
      const updatedOperation = operations.get(operationId);
      if (updatedOperation) {
        updatedOperation.progress = current;
        updatedOperation.total = total;
        updatedOperation.message = message || `댓글 생성 중... (${current}/${total})`;
        operations.set(operationId, updatedOperation);
      }
    };

    let generatedCount: number;

    if (useRandomPosts && targetCommentCount) {
      // 새로운 방식: 랜덤 게시글에 정확한 개수만큼 댓글 생성
      console.log(`🎯 랜덤 게시글 모드: ${targetCommentCount}개 댓글 생성`);
      generatedCount = await commentService.generateCommentsForRandomPosts(
        targetCommentCount,
        onProgress
      );
    } else {
      // 기존 방식: 학교별 게시글에 댓글 생성
      console.log(`🏫 학교별 모드: ${schoolLimit}개 학교, 학교당 ${commentsPerSchool}개 게시글`);
      generatedCount = await commentService.generateCommentsForPosts(
        schoolLimit,
        commentsPerSchool,
        maxCommentsPerPost,
        onProgress
      );
    }

    // 최종 상태 업데이트
    const finalOperation = operations.get(operationId);
    if (finalOperation) {
      finalOperation.progress = generatedCount;
      finalOperation.total = generatedCount;
      finalOperation.message = `${generatedCount}개 AI 댓글 생성 완료`;
      operations.set(operationId, finalOperation);
    }

    console.log(`✅ 댓글 생성 완료: ${generatedCount}개 댓글`);
    
  } catch (error) {
    console.error('❌ 댓글 생성 실패:', error);
    throw error;
  }
}

/**
 * 댓글 삭제 작업 실행
 */
async function executeCommentDeletion(operationId: string, params: any) {
  const { all = false, olderThanDays } = params;
  
  try {
    const operation = operations.get(operationId);
    if (!operation) throw new Error('작업을 찾을 수 없습니다.');

    operation.total = 100; // 예상 삭제 수 (실제로는 먼저 카운트해야 함)
    operation.message = all ? '모든 AI 댓글을 삭제하는 중...' : 'AI 댓글을 삭제하는 중...';
    operations.set(operationId, operation);

    // CleanupService 인스턴스 생성
    const cleanupService = new CleanupService();
    
    // 진행률 콜백 함수
    const onProgress = (current: number, total: number, message?: string) => {
      const updatedOperation = operations.get(operationId);
      if (updatedOperation) {
        updatedOperation.progress = current;
        updatedOperation.total = total;
        updatedOperation.message = message || `AI 댓글 삭제 중... (${current}/${total})`;
        operations.set(operationId, updatedOperation);
      }
    };

    let result;
    if (all) {
      // 모든 AI 댓글 삭제
      result = await cleanupService.cleanupFakeComments(onProgress);
    } else {
      // 특정 날짜 이전 댓글 삭제 (현재는 모든 댓글 삭제로 대체)
      result = await cleanupService.cleanupFakeComments(onProgress);
    }

    // 최종 상태 업데이트
    const finalOperation = operations.get(operationId);
    if (finalOperation) {
      const deletedCount = typeof result === 'number' ? result : (result as any)?.deletedCount || 0;
      finalOperation.progress = deletedCount;
      finalOperation.total = deletedCount;
      finalOperation.message = `${deletedCount}개 AI 댓글 삭제 완료`;
      operations.set(operationId, finalOperation);
    }

    const deletedCount = typeof result === 'number' ? result : (result as any)?.deletedCount || 0;
    console.log(`✅ 댓글 삭제 완료: ${deletedCount}개 삭제`);
    
  } catch (error) {
    console.error('❌ 댓글 삭제 실패:', error);
    throw error;
  }
}

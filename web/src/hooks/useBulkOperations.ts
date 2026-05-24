import { useState, useCallback } from 'react';

export interface BulkOperationProgress {
  id: string;
  type: 'create_bots' | 'generate_posts' | 'generate_comments' | 'cleanup';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  total: number;
  currentItem?: string;
  message?: string;
  error?: string;
}

interface UseBulkOperationsReturn {
  operations: Map<string, BulkOperationProgress>;
  startBotCreation: (schoolCount: number, botsPerSchool: number) => Promise<string>;
  startPostGeneration: (schoolCount: number, postsPerSchool: number) => Promise<string>;
  startCommentGeneration: (commentCount: number) => Promise<string>;
  startCleanup: () => Promise<string>;
  getOperationStatus: (operationId: string) => BulkOperationProgress | undefined;
}

/**
 * 클라이언트 사이드에서 대량 작업을 관리하는 훅
 * 서버의 60초 제한을 우회하기 위해 배치 단위로 작업을 분할
 */
export function useBulkOperations(): UseBulkOperationsReturn {
  const [operations, setOperations] = useState<Map<string, BulkOperationProgress>>(new Map());

  const updateOperation = useCallback((operationId: string, updates: Partial<BulkOperationProgress>) => {
    setOperations(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(operationId);
      if (existing) {
        newMap.set(operationId, { ...existing, ...updates });
      }
      return newMap;
    });
  }, []);

  const createOperation = useCallback((type: BulkOperationProgress['type'], total: number): string => {
    const operationId = `${type}_${Date.now()}`;
    const operation: BulkOperationProgress = {
      id: operationId,
      type,
      status: 'pending',
      progress: 0,
      total,
      message: '작업 준비 중...'
    };
    
    setOperations(prev => new Map(prev).set(operationId, operation));
    return operationId;
  }, []);

  /**
   * 단일 배치 작업 실행 (서버 API 호출)
   */
  const executeSingleBatch = useCallback(async (
    endpoint: string, 
    params: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown; error?: string }> => {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify(params)
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      return { success: true, data: result };
    } catch (error) {
      console.error('배치 실행 오류:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }, []);

  /**
   * 봇 생성 (배치 단위로 분할 실행)
   */
  const startBotCreation = useCallback(async (
    schoolCount: number, 
    botsPerSchool: number
  ): Promise<string> => {
    const operationId = createOperation('create_bots', schoolCount);
    
    // 배치 크기 (서버 제한 고려) - 대량 생성 시 더 큰 배치 사용
    const BATCH_SIZE = schoolCount >= 1000 ? 50 : schoolCount >= 100 ? 20 : 5;
    const batches = Math.ceil(schoolCount / BATCH_SIZE);
    
    updateOperation(operationId, { 
      status: 'running', 
      message: `${batches}개 배치로 봇 생성 시작...` 
    });

    // 백그라운드에서 배치 실행
    (async () => {
      try {
        let completedSchools = 0;
        
        for (let i = 0; i < batches; i++) {
          const batchSchoolCount = Math.min(BATCH_SIZE, schoolCount - completedSchools);
          
          updateOperation(operationId, {
            progress: completedSchools,
            message: `배치 ${i + 1}/${batches}: ${batchSchoolCount}개 학교 처리 중...`
          });

          // 서버 API 호출 (단일 배치)
          const result = await executeSingleBatch('/api/admin/bulk-operations/single-batch', {
            type: 'create_bots',
            schoolCount: batchSchoolCount,
            botsPerSchool
          });

          if (!result.success) {
            throw new Error(result.error || '배치 실행 실패');
          }

          completedSchools += batchSchoolCount;
          
          updateOperation(operationId, {
            progress: completedSchools,
            message: `배치 ${i + 1}/${batches} 완료`
          });

          // 배치 간 딜레이 (서버 부하 방지) - 대량 생성 시 딜레이 조정
          if (i < batches - 1) {
            const delay = schoolCount >= 5000 ? 1000 : schoolCount >= 1000 ? 1500 : 2000;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }

        updateOperation(operationId, {
          status: 'completed',
          progress: schoolCount,
          message: `✅ 총 ${schoolCount}개 학교에 봇 생성 완료`
        });

      } catch (error) {
        console.error('봇 생성 실패:', error);
        updateOperation(operationId, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          message: '❌ 봇 생성 실패'
        });
      }
    })();

    return operationId;
  }, [createOperation, updateOperation, executeSingleBatch]);

  /**
   * 게시글 생성 (배치 단위로 분할 실행)
   */
  const startPostGeneration = useCallback(async (
    schoolCount: number, 
    postsPerSchool: number
  ): Promise<string> => {
    const totalPosts = schoolCount * postsPerSchool;
    const operationId = createOperation('generate_posts', totalPosts);
    
    // 배치 크기 (대량 생성 시 더 큰 배치 사용)
    const BATCH_SIZE = totalPosts >= 5000 ? 100 : totalPosts >= 1000 ? 50 : totalPosts >= 100 ? 20 : 10;
    const batches = Math.ceil(totalPosts / BATCH_SIZE);
    
    updateOperation(operationId, { 
      status: 'running', 
      message: `${batches}개 배치로 게시글 생성 시작...` 
    });

    // 백그라운드에서 배치 실행
    (async () => {
      try {
        let completedPosts = 0;
        
        for (let i = 0; i < batches; i++) {
          const batchPostCount = Math.min(BATCH_SIZE, totalPosts - completedPosts);
          
          updateOperation(operationId, {
            progress: completedPosts,
            message: `배치 ${i + 1}/${batches}: ${batchPostCount}개 게시글 생성 중...`
          });

          const result = await executeSingleBatch('/api/admin/bulk-operations/single-batch', {
            type: 'generate_posts',
            postCount: batchPostCount
          });

          if (!result.success) {
            throw new Error(result.error || '배치 실행 실패');
          }

          completedPosts += batchPostCount;
          
          updateOperation(operationId, {
            progress: completedPosts,
            message: `배치 ${i + 1}/${batches} 완료`
          });

          // 배치 간 딜레이 (OpenAI API 제한 고려) - 대량 생성 시 딜레이 조정
          if (i < batches - 1) {
            const delay = totalPosts >= 5000 ? 2000 : totalPosts >= 1000 ? 2500 : 3000;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }

        updateOperation(operationId, {
          status: 'completed',
          progress: totalPosts,
          message: `✅ 총 ${totalPosts}개 게시글 생성 완료`
        });

      } catch (error) {
        console.error('게시글 생성 실패:', error);
        updateOperation(operationId, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          message: '❌ 게시글 생성 실패'
        });
      }
    })();

    return operationId;
  }, [createOperation, updateOperation, executeSingleBatch]);

  /**
   * 댓글 생성 (배치 단위로 분할 실행)
   */
  const startCommentGeneration = useCallback(async (commentCount: number): Promise<string> => {
    const operationId = createOperation('generate_comments', commentCount);
    
    const BATCH_SIZE = 20; // 한 번에 20개 댓글씩 처리
    const batches = Math.ceil(commentCount / BATCH_SIZE);
    
    updateOperation(operationId, { 
      status: 'running', 
      message: `${batches}개 배치로 댓글 생성 시작...` 
    });

    // 백그라운드에서 배치 실행
    (async () => {
      try {
        let completedComments = 0;
        
        for (let i = 0; i < batches; i++) {
          const batchCommentCount = Math.min(BATCH_SIZE, commentCount - completedComments);
          
          updateOperation(operationId, {
            progress: completedComments,
            message: `배치 ${i + 1}/${batches}: ${batchCommentCount}개 댓글 생성 중...`
          });

          const result = await executeSingleBatch('/api/admin/bulk-operations/single-batch', {
            type: 'generate_comments',
            commentCount: batchCommentCount
          });

          if (!result.success) {
            throw new Error(result.error || '배치 실행 실패');
          }

          // 실제 생성된 댓글 수 사용 (result.result.generatedCount)
          const actualGenerated = result.result?.generatedCount || batchCommentCount;
          completedComments += actualGenerated;
          
          updateOperation(operationId, {
            progress: completedComments,
            message: `배치 ${i + 1}/${batches} 완료`
          });

          // 배치 간 딜레이
          if (i < batches - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }

        updateOperation(operationId, {
          status: 'completed',
          progress: commentCount,
          message: `✅ 총 ${commentCount}개 댓글 생성 완료`
        });

      } catch (error) {
        console.error('댓글 생성 실패:', error);
        updateOperation(operationId, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          message: '❌ 댓글 생성 실패'
        });
      }
    })();

    return operationId;
  }, [createOperation, updateOperation, executeSingleBatch]);

  /**
   * 정리 작업
   */
  const startCleanup = useCallback(async (): Promise<string> => {
    const operationId = createOperation('cleanup', 1);
    
    updateOperation(operationId, { 
      status: 'running', 
      message: '정리 작업 시작...' 
    });

    // 백그라운드에서 실행
    (async () => {
      try {
        const result = await executeSingleBatch('/api/admin/bulk-operations/single-batch', {
          type: 'cleanup'
        });

        if (!result.success) {
          throw new Error(result.error || '정리 작업 실패');
        }

        updateOperation(operationId, {
          status: 'completed',
          progress: 1,
          message: '✅ 정리 작업 완료'
        });

      } catch (error) {
        console.error('정리 작업 실패:', error);
        updateOperation(operationId, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          message: '❌ 정리 작업 실패'
        });
      }
    })();

    return operationId;
  }, [createOperation, updateOperation, executeSingleBatch]);

  const getOperationStatus = useCallback((operationId: string): BulkOperationProgress | undefined => {
    return operations.get(operationId);
  }, [operations]);

  return {
    operations,
    startBotCreation,
    startPostGeneration,
    startCommentGeneration,
    startCleanup,
    getOperationStatus
  };
}

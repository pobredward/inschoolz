import { NextRequest, NextResponse } from 'next/server';

interface BulkOperation {
  id: string;
  type: 'create_bots' | 'generate_posts' | 'delete_posts' | 'cleanup';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  total: number;
  message: string;
  startedAt: string;
  completedAt?: string;
  params: any;
}

// 전역 operations Map 접근
declare global {
  var bulkOperations: Map<string, BulkOperation> | undefined;
}

const operations = globalThis.bulkOperations ?? new Map<string, BulkOperation>();

/**
 * GET /api/admin/bulk-operations/[id]
 * 특정 대량 작업 상태 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const operationId = params.id;
    
    if (!operationId) {
      return NextResponse.json(
        { success: false, error: '작업 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const operation = operations.get(operationId);
    
    if (!operation) {
      return NextResponse.json(
        { success: false, error: '작업을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: operation
    });

  } catch (error) {
    console.error('❌ 대량 작업 상태 조회 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `작업 상태를 조회할 수 없습니다: ${error instanceof Error ? error.message : 'Unknown error'}` 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/bulk-operations/[id]
 * 특정 대량 작업 취소/삭제
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const operationId = params.id;
    
    if (!operationId) {
      return NextResponse.json(
        { success: false, error: '작업 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const operation = operations.get(operationId);
    
    if (!operation) {
      return NextResponse.json(
        { success: false, error: '작업을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 실행 중인 작업은 취소, 완료된 작업은 기록 삭제
    if (operation.status === 'running') {
      // 실행 중인 작업 취소 처리
      operation.status = 'failed';
      operation.message = '사용자에 의해 취소됨';
      operation.completedAt = new Date().toISOString();
      operations.set(operationId, operation);
      
      // TODO: 실제 프로세스 종료 로직 추가 (child process kill 등)
      console.log(`⏹️ 작업 취소됨: ${operationId}`);
      
      return NextResponse.json({
        success: true,
        message: '작업이 취소되었습니다. 진행 중인 프로세스가 완전히 종료되는데 시간이 걸릴 수 있습니다.'
      });
    } else {
      // 완료된 작업 기록 삭제
      operations.delete(operationId);
      
      return NextResponse.json({
        success: true,
        message: '작업 기록이 삭제되었습니다.'
      });
    }

  } catch (error) {
    console.error('❌ 대량 작업 삭제 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `작업을 삭제할 수 없습니다: ${error instanceof Error ? error.message : 'Unknown error'}` 
      },
      { status: 500 }
    );
  }
}

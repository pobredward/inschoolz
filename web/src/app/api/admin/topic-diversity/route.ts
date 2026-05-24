import { NextRequest, NextResponse } from 'next/server';
import TopicDiversityManager from '@/lib/services/topic-diversity-manager';

export async function GET(request: NextRequest) {
  try {
    const diversityManager = TopicDiversityManager.getInstance();
    const stats = diversityManager.getStats();

    return NextResponse.json({
      success: true,
      data: stats,
      message: '주제 다양성 통계를 조회했습니다.'
    });

  } catch (error) {
    console.error('주제 다양성 통계 조회 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `통계 조회 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}` 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const diversityManager = TopicDiversityManager.getInstance();

    switch (action) {
      case 'clear':
        diversityManager.clearAllRecords();
        return NextResponse.json({
          success: true,
          message: '모든 주제 사용 기록이 초기화되었습니다.'
        });

      case 'enable_bulk_mode':
        diversityManager.enableBulkMode();
        return NextResponse.json({
          success: true,
          message: '대량 생성을 위한 완화 모드가 활성화되었습니다.'
        });

      default:
        return NextResponse.json(
          { success: false, error: '지원하지 않는 액션입니다.' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('주제 다양성 관리 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `처리 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}` 
      },
      { status: 500 }
    );
  }
}

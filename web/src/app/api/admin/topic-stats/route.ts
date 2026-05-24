import { NextRequest, NextResponse } from 'next/server';
import TrendService from '@/lib/services/trend-service';

export async function GET(request: NextRequest) {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        { success: false, error: 'OpenAI API 키가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const trendService = new TrendService(openaiApiKey);
    
    // 주제 사용 통계 조회
    const usageStats = trendService.getTopicUsageStats();
    const cacheStatus = trendService.getCacheStatus();
    const contentStats = trendService.getContentStats();

    return NextResponse.json({
      success: true,
      data: {
        topicUsage: usageStats,
        cache: cacheStatus,
        verifiedContent: contentStats,
        timestamp: new Date().toISOString()
      },
      message: '주제 통계 조회가 완료되었습니다.'
    });

  } catch (error) {
    console.error('주제 통계 조회 API 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `주제 통계 조회 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}` 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        { success: false, error: 'OpenAI API 키가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const trendService = new TrendService(openaiApiKey);
    
    // 주제 사용 기록 초기화
    trendService.clearTopicUsageHistory();

    return NextResponse.json({
      success: true,
      message: '주제 사용 기록이 초기화되었습니다.'
    });

  } catch (error) {
    console.error('주제 기록 초기화 API 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `주제 기록 초기화 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}` 
      },
      { status: 500 }
    );
  }
}

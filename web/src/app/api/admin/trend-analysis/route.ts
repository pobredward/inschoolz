import { NextRequest, NextResponse } from 'next/server';
import TrendService from '@/lib/services/trend-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        { success: false, error: 'OpenAI API 키가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const trendService = new TrendService(openaiApiKey);
    const trends = await trendService.getCurrentTrends(forceRefresh);

    return NextResponse.json({
      success: true,
      data: trends,
      message: '트렌드 분석이 완료되었습니다.',
      stats: {
        currentTrends: trends.currentTrends.length,
        seasonalTopics: trends.seasonalTopics.length,
        schoolLifeTopics: trends.schoolLifeTopics.length,
        entertainmentTopics: trends.entertainmentTopics.length,
        totalTopics: trends.currentTrends.length + trends.seasonalTopics.length + 
                    trends.schoolLifeTopics.length + trends.entertainmentTopics.length
      }
    });

  } catch (error) {
    console.error('트렌드 분석 API 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `트렌드 분석 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}` 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { schoolType = 'middle', postType = 'free' } = body;

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        { success: false, error: 'OpenAI API 키가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const trendService = new TrendService(openaiApiKey);
    const selectedTopic = await trendService.selectTopicForSchool(schoolType, postType);

    return NextResponse.json({
      success: true,
      data: selectedTopic,
      message: '주제 선택이 완료되었습니다.'
    });

  } catch (error) {
    console.error('주제 선택 API 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `주제 선택 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}` 
      },
      { status: 500 }
    );
  }
}

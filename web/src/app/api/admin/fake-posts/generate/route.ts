import { NextRequest, NextResponse } from 'next/server';
import { PostService } from '@/lib/services/post-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { schoolLimit = 10, postsPerSchool = 1, delayBetweenPosts = 3000 } = body;

    console.log('🚀 AI 게시글 생성 시작 (개선된 PostService 사용):', { 
      schoolLimit, 
      postsPerSchool, 
      delayBetweenPosts 
    });

    const postService = new PostService();
    
    // 백그라운드에서 실행
    postService.generatePostsForSchools(schoolLimit, postsPerSchool, delayBetweenPosts)
      .then((result) => {
        console.log(`✅ 백그라운드 생성 완료: ${result.totalGenerated}개 게시글`);
        console.log(`📊 학교 통계 - 초등: ${result.summary.elementary}, 중학: ${result.summary.middle}, 고등: ${result.summary.high}`);
      })
      .catch((error) => {
        console.error('❌ 백그라운드 생성 실패:', error);
      });
    
    return NextResponse.json({
      success: true,
      message: 'AI 게시글 생성이 백그라운드에서 시작되었습니다. (트렌드 기반 개선된 시스템 적용)',
      config: {
        schoolLimit,
        postsPerSchool,
        delayBetweenPosts,
        expectedPosts: schoolLimit * postsPerSchool
      },
      improvements: [
        '🔥 GPT-4o-mini 모델 사용으로 품질 향상',
        '📊 실시간 트렌드 분석 및 주제 생성',
        '💬 디시인사이드 스타일 말투 개선',
        '🎯 주제 다양성 대폭 확장 (40+ 새로운 주제)',
        '📝 토큰 수 증가 (500 → 800)로 더 풍부한 내용',
        '🔧 JSON 구조화된 출력으로 안정성 향상',
        '⚡ 트렌드 캐싱으로 성능 최적화'
      ]
    });

  } catch (error) {
    console.error('AI 게시글 생성 API 오류:', error);
    return NextResponse.json(
      { success: false, error: `AI 게시글 생성을 시작할 수 없습니다: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';

/**
 * 카카오 Authorization Code를 Access Token으로 교환
 * POST /api/auth/kakao/exchange
 */
export async function POST(request: NextRequest) {
  try {
    const { code, redirect_uri } = await request.json();

    if (!code || !redirect_uri) {
      return NextResponse.json(
        { error: 'code와 redirect_uri가 필요합니다.' },
        { status: 400 }
      );
    }

    const KAKAO_APP_KEY = process.env.NEXT_PUBLIC_KAKAO_APP_KEY;
    const KAKAO_SECRET_KEY = process.env.KAKAO_SECRET_KEY; // Kakao REST API 키 (선택사항)

    if (!KAKAO_APP_KEY) {
      return NextResponse.json(
        { error: 'KAKAO_APP_KEY가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    // 카카오 토큰 교환 API 호출
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: KAKAO_APP_KEY,
      redirect_uri: redirect_uri,
      code: code,
    });

    // Secret Key가 있으면 추가
    if (KAKAO_SECRET_KEY) {
      tokenParams.append('client_secret', KAKAO_SECRET_KEY);
    }

    const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ 카카오 토큰 교환 실패:', errorText);
      return NextResponse.json(
        { error: '카카오 토큰 교환에 실패했습니다.' },
        { status: tokenResponse.status }
      );
    }

    const tokenData = await tokenResponse.json();

    console.log('✅ 카카오 토큰 교환 성공');

    return NextResponse.json({
      access_token: tokenData.access_token,
      token_type: tokenData.token_type,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      scope: tokenData.scope,
      refresh_token_expires_in: tokenData.refresh_token_expires_in,
    });

  } catch (error) {
    console.error('❌ 카카오 토큰 교환 오류:', error);
    return NextResponse.json(
      { error: '토큰 교환 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}


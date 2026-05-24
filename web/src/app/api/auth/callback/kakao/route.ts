import { NextRequest, NextResponse } from 'next/server';

interface KakaoTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  refresh_token_expires_in: number;
}

/**
 * 카카오 인증 코드로 액세스 토큰 획득
 */
async function getKakaoAccessToken(code: string, requestUrl: string): Promise<KakaoTokenResponse> {
  try {
    const tokenUrl = 'https://kauth.kakao.com/oauth/token';
    const clientId = process.env.NEXT_PUBLIC_KAKAO_APP_KEY;

    if (!clientId) {
      throw new Error('KAKAO_APP_KEY가 설정되지 않았습니다.');
    }

    // 요청 URL에서 환경 감지하여 리다이렉트 URI 설정
    const getRedirectUri = (url: string) => {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const protocol = urlObj.protocol;
      const port = urlObj.port;
      
      // 개발 환경 (localhost)
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `${protocol}//${hostname}${port ? `:${port}` : ''}/api/auth/callback/kakao`;
      }
      
      // 프로덕션 환경
      return process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI || 'https://inschoolz.com/api/auth/callback/kakao';
    };

    const redirectUri = getRedirectUri(requestUrl);

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: redirectUri,
      code: code,
    });

    console.log('🔍 카카오 토큰 요청 설정:', {
      clientId: clientId?.substring(0, 8) + '...',
      redirectUri,
      code: code?.substring(0, 8) + '...'
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('카카오 토큰 요청 실패:', response.status, errorText);
      throw new Error(`카카오 토큰 요청 실패: ${response.status}`);
    }

    const tokenData: KakaoTokenResponse = await response.json();
    console.log('✅ 카카오 액세스 토큰 획득 성공');
    
    return tokenData;
  } catch (error) {
    console.error('❌ 카카오 액세스 토큰 획득 실패:', error);
    throw error;
  }
}

/**
 * GET /api/auth/callback/kakao
 * 카카오 로그인 콜백 처리
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // 에러 처리
    if (error) {
      console.error('❌ 카카오 로그인 에러:', error, errorDescription);
      
      // 에러 페이지로 리다이렉트
      const errorUrl = new URL('/auth/kakao/error', request.url);
      errorUrl.searchParams.set('error', error);
      if (errorDescription) {
        errorUrl.searchParams.set('description', errorDescription);
      }
      
      return NextResponse.redirect(errorUrl);
    }

    if (!code) {
      console.error('❌ 카카오 인증 코드가 없습니다.');
      const errorUrl = new URL('/auth/kakao/error', request.url);
      errorUrl.searchParams.set('error', 'no_code');
      errorUrl.searchParams.set('description', '인증 코드가 없습니다.');
      
      return NextResponse.redirect(errorUrl);
    }

    // 1. 카카오 액세스 토큰 획득
    const tokenData = await getKakaoAccessToken(code, request.url);

    // 2. 성공 페이지로 리다이렉트하면서 액세스 토큰 전달
    const successUrl = new URL('/auth/kakao/success', request.url);
    successUrl.searchParams.set('access_token', tokenData.access_token);
    
    return NextResponse.redirect(successUrl);

  } catch (error) {
    console.error('❌ 카카오 콜백 처리 오류:', error);
    
    // 에러 페이지로 리다이렉트
    const errorUrl = new URL('/auth/kakao/error', request.url);
    errorUrl.searchParams.set('error', 'callback_error');
    errorUrl.searchParams.set('description', error instanceof Error ? error.message : '콜백 처리 중 오류가 발생했습니다.');
    
    return NextResponse.redirect(errorUrl);
  }
}

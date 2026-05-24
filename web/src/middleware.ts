import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 인증이 필요 없는 공개 경로 목록
const publicRoutes = [
  '/auth',
  '/auth/reset-password',
  '/login',
  '/signup',
  '/',
  '/about',
  '/terms',
  '/privacy',
  '/sitemap.xml',
  '/robots.txt',
  '/ads.txt',
  '/app-ads.txt',
  '/youth-protection',
  '/help',
  '/support',
  '/community', // 커뮤니티 메인 페이지는 공개 접근 허용
  '/ranking', // 랭킹 페이지는 공개 접근 허용 (전국 랭킹은 누구나 볼 수 있음)
  '/games', // 게임 메인 페이지는 공개 접근 허용 (게임 목록은 누구나 볼 수 있음)
  '/my', // 마이페이지도 일단 공개 경로로 설정 (클라이언트에서 인증 처리)
  '/app', // 앱 다운로드 리다이렉트 페이지 (프리미엄 버전)
  '/download', // 앱 다운로드 리다이렉트 페이지 (스탠다드 버전)
  '/get', // 앱 다운로드 리다이렉트 페이지 (미니멀 버전)
];

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // 레거시 로그인/회원가입 쿼리 파라미터 처리
  if (path === '/auth') {
    const tab = request.nextUrl.searchParams.get('tab');
    const redirect = request.nextUrl.searchParams.get('redirect');
    
    if (tab === 'signup') {
      const redirectUrl = redirect ? `/signup?redirect=${encodeURIComponent(redirect)}` : '/signup';
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    } else {
      const redirectUrl = redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login';
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }
  }
  
  // SEO용 커뮤니티 게시글 경로는 공개 접근 허용
  if (path.match(/^\/community\/(national|school|region)\/.*\/[a-zA-Z0-9]+$/)) {
    return NextResponse.next();
  }
  
  // 인증이 필요 없는 경로는 통과
  const isPublicRoute = publicRoutes.some(route => path === route || path.startsWith(`${route}/`));
  if (isPublicRoute) {
    return NextResponse.next();
  }
  
  // 클라이언트 측 인증 쿠키 확인
  const authCookie = request.cookies.get('authToken');
  const uidCookie = request.cookies.get('uid');
  const userIdCookie = request.cookies.get('userId'); // 백업 쿠키
  
  // 프로덕션 환경에서 쿠키 동기화 문제를 고려한 더 관대한 검증
  const isProduction = process.env.NODE_ENV === 'production';
  
  const hasValidUidCookie = uidCookie || userIdCookie;
  
  if (!authCookie || !hasValidUidCookie) {
    // 프로덕션 환경에서는 한 번 더 관대하게 처리 (쿠키 동기화 지연 고려)
    if (isProduction && !authCookie && hasValidUidCookie) {
      const response = NextResponse.next();
      response.headers.set('X-Auth-Warning', 'missing-auth-token');
      return response;
    }
    
    return NextResponse.redirect(new URL(`/login?redirect=${encodeURIComponent(path)}`, request.url));
  }
  
  // 쿠키 값 검증 (빈 값 체크) - 백업 쿠키도 확인
  const authTokenValue = authCookie?.value?.trim();
  const uidValue = uidCookie?.value?.trim() || userIdCookie?.value?.trim();
  
  if (!authTokenValue || !uidValue) {
    return NextResponse.redirect(new URL(`/login?redirect=${encodeURIComponent(path)}`, request.url));
  }
  
  // 관리자 페이지 접근 제한 (관리자 역할 확인)
  if (path.startsWith('/admin')) {
    const userRoleCookie = request.cookies.get('userRole');
    const userRole = userRoleCookie?.value;
    
    if (userRole !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }
  
  return NextResponse.next();
}

// 미들웨어가 적용될 경로 설정
export const config = {
  matcher: [
    /*
     * 다음은 미들웨어가 적용되는 경로 패턴:
     * - 모든 경로에 적용됨
     * - _next, api, 정적 파일(이미지/폰트/아이콘 등)은 제외
     */
    '/((?!_next/|api/|.*\\.(?:ico|png|jpg|jpeg|gif|webp|svg|css|js|woff|woff2|ttf|eot|map|json|txt|xml)).*)',
  ],
};

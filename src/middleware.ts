import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 인증이 필요 없는 공개 경로 목록
const publicRoutes = [
  '/auth',
  '/auth/reset-password',
  '/',
  '/about',
  '/terms',
  '/privacy',
  '/sitemap.xml',
  '/robots.txt',
  '/youth-protection',
  '/help',
  '/support',
  '/community', // 커뮤니티 메인 페이지는 공개 접근 허용
  '/ranking', // 랭킹 페이지는 공개 접근 허용 (전국 랭킹은 누구나 볼 수 있음)
  '/games', // 게임 메인 페이지는 공개 접근 허용 (게임 목록은 누구나 볼 수 있음)
];

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  console.log(`🚀 Middleware: ${path} - 요청 시작`);
  
  // 기존 /login 및 /signup 경로를 /auth로 리디렉션
  if (path === '/login') {
    console.log(`🔄 Middleware: ${path} -> /auth?tab=login 리다이렉트`);
    return NextResponse.redirect(new URL('/auth?tab=login', request.url));
  }
  
  if (path === '/signup') {
    console.log(`🔄 Middleware: ${path} -> /auth?tab=signup 리다이렉트`);
    return NextResponse.redirect(new URL('/auth?tab=signup', request.url));
  }
  
  // SEO용 커뮤니티 게시글 경로는 공개 접근 허용
  if (path.match(/^\/community\/(national|school|region)\/.*\/[a-zA-Z0-9]+$/)) {
    console.log(`✅ Middleware: ${path} - SEO 커뮤니티 경로 허용`);
    return NextResponse.next();
  }
  
  // 인증이 필요 없는 경로는 통과
  const isPublicRoute = publicRoutes.some(route => path === route || path.startsWith(`${route}/`));
  if (isPublicRoute) {
    console.log(`✅ Middleware: ${path} - 공개 경로 허용`);
    return NextResponse.next();
  }
  
  // 클라이언트 측 인증 쿠키 확인
  const authCookie = request.cookies.get('authToken');
  console.log(`🔐 Middleware: ${path} - 인증 쿠키 확인: ${authCookie ? '있음' : '없음'}`);
  
  // 인증 토큰이 없는 경우 로그인 페이지로 리디렉션
  if (!authCookie) {
    console.log(`🚫 Middleware: ${path} -> /auth?tab=login 리다이렉트 (인증 필요)`);
    return NextResponse.redirect(new URL(`/auth?tab=login&redirect=${encodeURIComponent(path)}`, request.url));
  }
  
  // 관리자 페이지 접근 제한 (관리자 역할 확인)
  if (path.startsWith('/admin')) {
    const userRoleCookie = request.cookies.get('userRole');
    const userRole = userRoleCookie?.value;
    
    console.log(`👤 Middleware: ${path} - 사용자 role: ${userRole || '없음'}`);
    
    // 관리자가 아닌 경우 홈페이지로 리디렉션
    if (userRole !== 'admin') {
      console.log(`🚫 Middleware: ${path} -> / 리다이렉트 (관리자 아님, role: ${userRole})`);
      return NextResponse.redirect(new URL('/', request.url));
    }
    
    console.log(`✅ Middleware: ${path} - 관리자 접근 허용`);
  }
  
  console.log(`✅ Middleware: ${path} - 통과`);
  return NextResponse.next();
}

// 미들웨어가 적용될 경로 설정
export const config = {
  matcher: [
    /*
     * 다음은 미들웨어가 적용되는 경로 패턴:
     * - 모든 경로에 적용됨
     * - _next, api, public 등은 제외
     */
    '/((?!_next/|api/|favicon.ico).*)',
  ],
}; 
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { 
  Home, 
  MessageSquare, 
  Gamepad2, 
  Trophy, 
  User as UserIcon, 
  LogIn, 
  LogOut, 
  UserPlus, 
  Settings,
  Menu,
  Bell,
  AlertCircle,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useAuth } from '@/providers/AuthProvider';
import { useExperience } from '@/providers/experience-provider';
import { User } from '@/types';
import { getUnreadNotificationCount } from '@/lib/api/notifications';

// 메뉴 아이템 정의 (PRD 요구사항에 맞게 수정)
const menuItems = [
  { name: '홈', path: '/', icon: <Home className="h-5 w-5" />, ariaLabel: '홈 페이지로 이동' },
  { name: '커뮤니티', path: '/community', icon: <MessageSquare className="h-5 w-5" />, ariaLabel: '커뮤니티 페이지로 이동' },
  { name: '미니게임', path: '/games', icon: <Gamepad2 className="h-5 w-5" />, ariaLabel: '미니게임 페이지로 이동' },
  { name: '랭킹', path: '/ranking', icon: <Trophy className="h-5 w-5" />, ariaLabel: '랭킹 페이지로 이동' },
];

// Sticky 헤더를 위한 커스텀 훅
const useSticky = () => {
  const stickyRef = useRef<HTMLElement>(null);
  const [sticky, setSticky] = useState(false);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!stickyRef.current) {
      return;
    }
    setOffset(stickyRef.current.offsetTop);
  }, [stickyRef, setOffset]);

  useEffect(() => {
    const handleScroll = () => {
      if (!stickyRef.current) {
        return;
      }
      setSticky(window.scrollY > offset);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [setSticky, stickyRef, offset]);
  
  return { stickyRef, sticky };
};

// 경험치/레벨 컴포넌트 - 실시간 업데이트 지원
function ExperienceDisplay({ user }: { user?: User }) {
  const { userStats } = useExperience();
  
  if (!user && !userStats) return null;

  // 실시간 stats 우선 사용, 없으면 user 데이터 사용
  const level = userStats?.level || user?.stats?.level || 1;
  const currentExp = userStats?.currentExp || user?.stats?.currentExp || 0;
  const currentLevelRequiredXp = userStats?.currentLevelRequiredXp || user?.stats?.currentLevelRequiredXp || (level * 10);
  
  const xpPercentage = Math.min((currentExp / currentLevelRequiredXp) * 100, 100);

  return (
    <div className="flex items-center gap-2" aria-label={`레벨 ${level}, 경험치 ${currentExp}/${currentLevelRequiredXp}`}>
      <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-md border-2 border-yellow-300">
        Lv.{level}
      </div>
      <div className="flex items-center gap-2">
        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden border-2 border-gray-300 shadow-inner">
          <div 
            className="h-full bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500 transition-all duration-300 ease-out relative overflow-hidden"
            style={{ width: `${Math.max(xpPercentage, 3)}%` }}
            aria-label={`경험치 진행률 ${xpPercentage.toFixed(1)}%`}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
          </div>
        </div>
        <span className="text-xs text-gray-700 font-semibold whitespace-nowrap">
          {currentExp.toLocaleString()}/{currentLevelRequiredXp.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

// 알림 버튼 컴포넌트
function NotificationButton({ user }: { user?: User }) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchUnreadCount = async () => {
      try {
        const count = await getUnreadNotificationCount(user.uid);
        setUnreadCount(count);
      } catch (error) {
        console.error('읽지 않은 알림 개수 조회 실패:', error);
      }
    };

    fetchUnreadCount();

    // 정기적으로 알림 개수 업데이트 (30초마다)
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => clearInterval(interval);
  }, [user]);

  if (!user) return null;

  return (
    <Link href="/notifications">
      <Button 
        variant="ghost" 
        size="icon" 
        className="relative hover:bg-pastel-green-100 focus:ring-2 focus:ring-pastel-green-400"
        aria-label={`알림 확인 ${unreadCount > 0 ? `(${unreadCount}개 안읽음)` : ''}`}
      >
        <Bell className="h-5 w-5 text-pastel-green-600" />
        {unreadCount > 0 && (
          <span 
            className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1"
            aria-label={`${unreadCount}개의 새 알림`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>
    </Link>
  );
}

// 에러 표시 컴포넌트
function ErrorAlert({ error, onDismiss }: { error: string; onDismiss: () => void }) {
  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[99999] max-w-md w-full mx-4">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 pr-12 relative">
        <div className="flex items-center">
          <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-red-100"
          onClick={onDismiss}
          aria-label="오류 메시지 닫기"
        >
          <X className="h-4 w-4 text-red-600" />
        </Button>
      </div>
    </div>
  );
}

export function Header() {
  const { user, signOut, isLoading, error, resetError } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  
  // Sticky 훅 사용
  const { sticky, stickyRef } = useSticky();
  
  // 사용자 프로필 경로 설정 - 항상 /my로 이동
  const myMenuItem = { 
    name: '마이페이지', 
    path: '/my', 
    icon: <UserIcon className="h-5 w-5" />, 
    ariaLabel: '마이페이지로 이동' 
  };
  
  // 전체 메뉴 아이템 (기본 메뉴 + 프로필 메뉴)
  const allMenuItems = [...menuItems, myMenuItem];

  // 로그아웃 처리 (에러 처리 개선)
  const handleSignOut = async () => {
    if (isSigningOut) return; // 중복 실행 방지
    
    try {
      setIsSigningOut(true);
      resetError?.(); // 기존 에러 초기화
      await signOut();
      router.push('/'); // 홈페이지로 리디렉션
    } catch (error) {
      console.error('로그아웃 오류:', error);
      // 에러는 AuthProvider에서 관리되므로 여기서는 추가 처리 불필요
    } finally {
      setIsSigningOut(false);
    }
  };

  // 키보드 네비게이션 지원
  const handleKeyDown = (event: React.KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };

  // 모바일 메뉴 닫기
  const handleMobileMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

  // 에러 처리
  const handleErrorDismiss = () => {
    resetError?.();
  };

  return (
    <>
      {/* 에러 표시 */}
      {error && <ErrorAlert error={error} onDismiss={handleErrorDismiss} />}

      {/* Sticky 헤더 - 게임 스타일 */}
      <header 
        ref={stickyRef}
        className={`sticky top-0 left-0 w-full z-[99999] transition-all duration-300 ${
          sticky 
            ? 'bg-gradient-to-r from-emerald-50 via-white to-emerald-50 backdrop-blur-xl shadow-lg border-b-2 border-emerald-200' 
            : 'bg-gradient-to-r from-emerald-50/80 via-white/95 to-emerald-50/80 backdrop-blur-lg shadow-md border-b border-emerald-100'
        }`}
        style={{
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div className="container h-16 mx-auto flex items-center justify-between px-4">
          {/* 왼쪽: 햄버거 메뉴 + 로고 */}
          <div className="flex items-center gap-3">
            {/* 모바일 메뉴 트리거 - md 미만에서만 표시 */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="hover:bg-pastel-green-100"
                  aria-label="모바일 메뉴 열기"
                  disabled={isLoading}
                >
                  <Menu className="h-5 w-5 text-pastel-green-600" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <SheetHeader className="mb-4">
                  <SheetTitle>메뉴</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col space-y-1" role="navigation" aria-label="모바일 메뉴">
                  {user && (
                    <div className="mb-4 p-4 bg-gradient-to-r from-pastel-green-50 to-pastel-green-100 rounded-lg border border-pastel-green-200">
                      <div className="flex items-center gap-3 mb-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage 
                            src={user.profile?.profileImageUrl} 
                            alt={user.profile?.userName || '사용자'} 
                          />
                          <AvatarFallback className="bg-pastel-green-200 text-pastel-green-800 text-lg">
                            {user.profile?.userName?.substring(0, 2) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-pastel-green-800 truncate">
                            {user.profile?.userName || '사용자'}님
                          </p>
                          <p className="text-xs text-pastel-green-600 truncate">{user.email}</p>
                        </div>
                      </div>
                      <ExperienceDisplay user={user} />
                    </div>
                  )}
                  {allMenuItems.map((item) => (
                    <Link key={item.path} href={item.path} onClick={handleMobileMenuClose}>
                      <Button
                        variant={pathname === item.path ? "default" : "ghost"}
                        className={`w-full justify-start ${
                          pathname === item.path 
                            ? 'bg-green-100 text-green-800 border border-green-300' 
                            : 'hover:bg-pastel-green-100'
                        }`}
                        aria-label={item.ariaLabel}
                      >
                        {item.icon}
                        <span className="ml-2">{item.name}</span>
                      </Button>
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>

            {/* 로고 - 게임 스타일 */}
            <Link 
              href="/" 
              className="flex items-center gap-2 group hover:scale-105 transition-transform focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 rounded-lg px-2 py-1"
              aria-label="인스쿨즈 홈페이지로 이동"
            >
              <span className="text-2xl group-hover:rotate-12 transition-transform">📚</span>
              <span className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent font-jammin group-hover:from-emerald-700 group-hover:to-green-700 transition-all">
                InSchoolz
              </span>
            </Link>
          </div>

          {/* 데스크탑 네비게이션 - 게임 스타일 */}
          <nav className="hidden md:flex items-center space-x-2" role="navigation" aria-label="주 메뉴">
            {allMenuItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <Button
                  variant={pathname === item.path ? "default" : "ghost"}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 ${
                    pathname === item.path 
                      ? 'bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-800 hover:from-emerald-200 hover:to-green-200 border-2 border-emerald-300 shadow-md font-semibold scale-105' 
                      : 'hover:bg-emerald-50 hover:text-emerald-700 border border-transparent hover:border-emerald-200 hover:scale-105'
                  }`}
                  aria-label={item.ariaLabel}
                  aria-current={pathname === item.path ? 'page' : undefined}
                >
                  {item.icon}
                  <span>{item.name}</span>
                </Button>
              </Link>
            ))}
          </nav>

          {/* 헤더 오른쪽 - 경험치, 알림, 프로필 */}
          <div className="flex items-center gap-3">
            {/* 경험치/레벨 표시 - 로그인 시에만 표시 */}
            {user && (
              <div className="hidden md:block">
                <ExperienceDisplay user={user} />
              </div>
            )}

            {/* 알림 버튼 - 로그인 시에만 표시 */}
            <NotificationButton user={user || undefined} />

            {/* 프로필 아이콘 & 드롭다운 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-full hover:bg-pastel-green-100 focus:ring-2 focus:ring-pastel-green-400 p-1"
                  aria-label="사용자 메뉴 열기"
                  aria-haspopup="true"
                  disabled={isLoading}
                >
                  {user ? (
                    <Avatar className="h-8 w-8">
                      <AvatarImage 
                        src={user.profile?.profileImageUrl} 
                        alt={user.profile?.userName || '사용자'} 
                      />
                      <AvatarFallback className="bg-pastel-green-100 text-pastel-green-700 text-sm">
                        {user.profile?.userName?.substring(0, 2) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <UserIcon className="h-5 w-5 text-pastel-green-600" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="w-56" 
                style={{ zIndex: 1000000 }}
              >
                {user ? (
                  <>
                    <div className="flex items-center gap-3 px-2 py-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage 
                          src={user.profile?.profileImageUrl} 
                          alt={user.profile?.userName || '사용자'} 
                        />
                        <AvatarFallback className="bg-pastel-green-100 text-pastel-green-700 text-sm">
                          {user.profile?.userName?.substring(0, 2) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{user.profile?.userName || '사용자'}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link 
                        href="/my" 
                        className="cursor-pointer"
                        onClick={(e) => {
                          // 인증 상태 확인 후 안전하게 라우팅
                          if (!user) {
                            e.preventDefault();
                            console.log('🚫 Header: 비인증 상태에서 마이페이지 접근 시도 차단');
                            router.push('/login?redirect=/my');
                          }
                        }}
                      >
                        <UserIcon className="mr-2 h-4 w-4" />
                        <span>내 프로필</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/notifications" className="cursor-pointer">
                        <Bell className="mr-2 h-4 w-4" />
                        <span>알림</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/my/settings" className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>설정</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className={`cursor-pointer ${isSigningOut ? 'opacity-50' : ''}`}
                      onClick={handleSignOut}
                      onKeyDown={(e) => handleKeyDown(e, handleSignOut)}
                      disabled={isSigningOut}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>{isSigningOut ? '로그아웃 중...' : '로그아웃'}</span>
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/login" className="cursor-pointer">
                        <LogIn className="mr-2 h-4 w-4" />
                        <span>로그인</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/signup" className="cursor-pointer">
                        <UserPlus className="mr-2 h-4 w-4" />
                        <span>회원가입</span>
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* sticky 헤더에 맞춰 content 여백 조정 */}
      {sticky && (
        <div style={{ height: `${stickyRef.current?.clientHeight || 64}px` }} />
      )}

      {/* 모바일 하단 네비게이션 - 게임 스타일 */}
      <nav 
        className="md:hidden fixed bottom-0 left-0 right-0 z-[99999] bg-gradient-to-t from-emerald-50/98 via-white/95 to-white/95 backdrop-blur-lg border-t-2 border-emerald-200 shadow-2xl"
        style={{
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
        role="navigation"
        aria-label="하단 네비게이션"
      >
        <div className="flex justify-around items-center h-16 px-2 pb-2">
          {allMenuItems.map((item) => {
            // 마이페이지 항목인 경우 특별한 처리
            if (item.path === '/my') {
              return (
                <Link 
                  key={item.path} 
                  href={item.path} 
                  className="flex-1 min-w-0"
                  aria-label={item.ariaLabel}
                  onClick={(e) => {
                    // 인증 상태 확인 후 안전하게 라우팅
                    if (!user) {
                      e.preventDefault();
                      console.log('🚫 MobileNav: 비인증 상태에서 마이페이지 접근 시도 차단');
                      router.push('/login?redirect=/my');
                    }
                  }}
                >
                  <div 
                    className={`flex flex-col items-center justify-center py-2 px-1 transition-all duration-200 rounded-lg mx-1 ${
                      pathname === item.path 
                        ? 'text-pastel-green-600 bg-pastel-green-50 scale-105 shadow-sm' 
                        : 'text-gray-500 hover:text-pastel-green-500 hover:bg-pastel-green-50/50'
                    }`}
                  >
                    <div className={`transition-transform duration-200 ${pathname === item.path ? 'scale-110' : ''}`}>
                      {item.icon}
                    </div>
                    <span className={`text-xs mt-1 font-medium transition-all duration-200 ${
                      pathname === item.path ? 'font-semibold' : ''
                    }`}>
                      {item.name}
                    </span>
                    {pathname === item.path && (
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-pastel-green-600 rounded-full" />
                    )}
                  </div>
                </Link>
              );
            }
            
            // 일반 항목들은 기본 처리
            return (
              <Link 
                key={item.path} 
                href={item.path} 
                className="flex-1 min-w-0"
                aria-label={item.ariaLabel}
              >
                <div 
                  className={`flex flex-col items-center justify-center py-2 px-1 transition-all duration-200 rounded-xl mx-0.5 ${
                    pathname === item.path 
                      ? 'text-emerald-700 bg-gradient-to-b from-emerald-100 to-emerald-50 scale-110 shadow-lg border-2 border-emerald-300' 
                      : 'text-gray-500 hover:text-emerald-600 hover:bg-emerald-50/50'
                  }`}
                >
                  <div className={`transition-transform duration-200 ${pathname === item.path ? 'scale-125' : ''}`}>
                    {item.icon}
                  </div>
                  <span className={`text-xs mt-1 font-medium transition-all duration-200 ${
                    pathname === item.path ? 'font-bold' : ''
                  }`}>
                    {item.name}
                  </span>
                  {pathname === item.path && (
                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-gradient-to-r from-emerald-400 to-green-400 rounded-full shadow-md" />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
} 
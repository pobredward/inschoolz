"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { 
  LayoutDashboard, 
  Users, 
  LayoutList, 
  ShieldAlert, 
  Flag,
  School,
  Gamepad2,
  Settings,
  LogOut,
  ExternalLink,
  Bell,
  Bot
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const AdminSidebarLink = ({
  href,
  icon: Icon,
  label,
  active
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
}) => (
  <Link 
    href={href}
    className={cn(
      "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm",
      active 
        ? "bg-primary text-white font-medium" 
        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
    )}
  >
    <Icon className="h-4 w-4" />
    <span>{label}</span>
  </Link>
);

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const loginTime = new Date();
  
  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('로그아웃 오류:', error);
    }
  };
  
  const navigationItems = [
    { href: '/admin', icon: LayoutDashboard, label: '대시보드' },
    { href: '/admin/users', icon: Users, label: '사용자 관리' },
    { href: '/admin/boards', icon: LayoutList, label: '게시판 관리' },
    { href: '/admin/content', icon: ShieldAlert, label: '콘텐츠 모더레이션' },
    { href: '/admin/reports', icon: Flag, label: '신고 관리' },
    { href: '/admin/schools', icon: School, label: '학교 관리' },
    { href: '/admin/fake-posts', icon: Bot, label: 'AI 게시글 관리' },
    { href: '/admin/games', icon: Gamepad2, label: '게임 설정' },
    { href: '/admin/notifications', icon: Bell, label: '알림 설정' },
    { href: '/admin/settings', icon: Settings, label: '시스템 설정' },
  ];
  
  return (
    <div className="w-64 h-screen bg-card border-r shrink-0 flex flex-col">
      <div className="p-4">
        <h1 className="text-xl font-bold">인스쿨즈 관리자</h1>
        <p className="text-sm text-muted-foreground mt-1">시스템 관리 페이지</p>
      </div>
      
      <Separator />
      
      <div className="p-4 flex-1 overflow-auto">
        <nav className="space-y-1">
          {navigationItems.map((item) => (
            <AdminSidebarLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={
                item.href === '/admin'
                  ? pathname === '/admin'
                  : pathname.startsWith(item.href)
              }
            />
          ))}
        </nav>
      </div>
      
      <Separator />
      
      <div className="p-4 bg-muted/20">
        <div className="flex flex-col space-y-1 mb-3">
          <span className="text-sm font-medium">{user?.profile.userName || user?.email}</span>
          <span className="text-xs text-muted-foreground">
            로그인: {format(loginTime, 'yyyy년 MM월 dd일 HH:mm', { locale: ko })}
          </span>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href="/">
              <ExternalLink className="h-4 w-4 mr-1" />
              사이트로 이동
            </Link>
          </Button>
          <Button 
            variant="destructive" 
            size="sm" 
            className="w-full"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-1" />
            로그아웃
          </Button>
        </div>
      </div>
    </div>
  );
} 
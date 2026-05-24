'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Mail } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';
import { loginWithEmail, loginWithGoogle } from '@/lib/auth';
import { loginWithKakaoRedirect } from '@/lib/kakao';
import { waitForCookies, getRecommendedWaitTime } from '@/lib/cookie-utils';
import Link from 'next/link';
// 스키마 정의
const emailLoginSchema = z.object({
  email: z.string().email('올바른 이메일 형식이 아닙니다.'),
  password: z.string().min(1, '비밀번호를 입력해주세요.'),
});

interface LoginFormProps {
  showTitle?: boolean;
}

export function LoginForm({ showTitle = false }: LoginFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // 이메일 로그인 폼 상태
  const [emailForm, setEmailForm] = useState({
    email: '',
    password: ''
  });

  // 이메일 로그인
  const handleEmailLogin = async () => {
    try {
      const validated = emailLoginSchema.parse(emailForm);
      setIsLoading(true);
      
      await loginWithEmail(validated.email, validated.password);
      
      // ✅ 쿠키가 실제로 설정될 때까지 대기
      console.log('🍪 쿠키 설정 대기 중...');
      const cookiesReady = await waitForCookies(getRecommendedWaitTime());
      
      if (!cookiesReady) {
        console.warn('⚠️ 쿠키 설정이 지연되고 있지만 진행합니다.');
      }
      
      const redirectUrl = searchParams.get('redirect') || '/';
      console.log('🔄 리다이렉트:', redirectUrl);
      router.push(redirectUrl);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        toast.error(firstError.message);
      } else {
        console.error('이메일 로그인 실패:', error);
        toast.error(error instanceof Error ? error.message : '로그인에 실패했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 카카오 로그인 핸들러
  const handleKakaoLogin = () => {
    try {
      loginWithKakaoRedirect();
    } catch (error) {
      console.error('카카오 로그인 실패:', error);
      toast.error('카카오 로그인 중 오류가 발생했습니다.');
    }
  };

  // Google 로그인 핸들러
  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      await loginWithGoogle();
      
      // ✅ 쿠키가 실제로 설정될 때까지 대기
      console.log('🍪 쿠키 설정 대기 중...');
      const cookiesReady = await waitForCookies(getRecommendedWaitTime());
      
      if (!cookiesReady) {
        console.warn('⚠️ 쿠키 설정이 지연되고 있지만 진행합니다.');
      }
      
      const redirectUrl = searchParams.get('redirect') || '/';
      console.log('🔄 리다이렉트:', redirectUrl);
      router.push(redirectUrl);
    } catch (error) {
      console.error('Google 로그인 실패:', error);
      
      // 팝업 차단 감지
      if (error instanceof Error && error.message.includes('popup')) {
        toast.error('팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.');
      } else {
        toast.error(error instanceof Error ? error.message : 'Google 로그인 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 키보드 엔터 핸들러
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      e.preventDefault();
      handleEmailLogin();
    }
  };

  return (
    <div className="w-full space-y-6">
      {showTitle && (
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">로그인</h1>
          <p className="text-gray-600">계정에 로그인하여 인스쿨즈를 시작하세요</p>
        </div>
      )}

      {/* 로그인 폼 */}
      <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                이메일
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={emailForm.email}
                onChange={(e) => setEmailForm(prev => ({ ...prev, email: e.target.value }))}
                onKeyDown={handleKeyDown}
                className="h-11"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                비밀번호
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="비밀번호를 입력하세요"
                  value={emailForm.password}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, password: e.target.value }))}
                  onKeyDown={handleKeyDown}
                  className="h-11 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-11 px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Link href="/auth/reset-password" className="text-sm text-green-600 hover:text-green-800">
                비밀번호를 잊으셨나요?
              </Link>
            </div>
            
            <Button 
              onClick={handleEmailLogin} 
              className="w-full h-11 bg-green-600 hover:bg-green-700" 
              disabled={isLoading}
            >
              {isLoading ? '로그인 중...' : '로그인'}
            </Button>
      </div>
      
      {/* 구분선 */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-4 text-gray-500">또는</span>
        </div>
      </div>
      
      {/* 소셜 로그인 버튼들 */}
      <div className="space-y-3">
        {/* 카카오 로그인 */}
        <Button 
          onClick={handleKakaoLogin}
          className="w-full h-11 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-medium"
          disabled={isLoading}
        >
          <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3C7.03 3 3 6.58 3 11c0 2.91 2.05 5.47 5 6.48v2.58c0 .25.33.4.55.26L11.09 18H12c4.97 0 9-3.58 9-8s-4.03-8-9-8z"/>
          </svg>
          카카오로 계속하기
        </Button>

        {/* Google 로그인 */}
        <Button 
          onClick={handleGoogleLogin}
          variant="outline" 
          className="w-full h-11 border-gray-300 hover:bg-gray-50"
          disabled={isLoading}
        >
          <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Google로 계속하기
        </Button>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, EyeOff, Mail, Check, X, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';
import { registerWithEmail, checkUserNameAvailability, checkEmailExists, loginWithGoogle } from '@/lib/auth';
import { loginWithKakaoRedirect } from '@/lib/kakao';
import Link from 'next/link';
import { ReferralSearch } from '@/components/ui/referral-search';
import { generateNickname } from '@/lib/utils/nickname-generator';
// 스키마 정의 (userName 제거)
const emailSignupSchema = z.object({
  email: z.string().email('올바른 이메일 형식이 아닙니다.'),
  password: z.string().min(6, '비밀번호는 최소 6자 이상이어야 합니다.'),
  confirmPassword: z.string(),
  referral: z.string().optional(),
  agreeTerms: z.boolean().refine(val => val === true, {
    message: '이용약관에 동의해주세요.',
  }),
  agreePrivacy: z.boolean().refine(val => val === true, {
    message: '개인정보처리방침에 동의해주세요.',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "비밀번호가 일치하지 않습니다.",
  path: ["confirmPassword"],
});

type EmailSignupFormData = z.infer<typeof emailSignupSchema>;

interface SignupFormProps {
  showTitle?: boolean;
}

export function SignupForm({ showTitle = false }: SignupFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();

  // 이메일 회원가입 폼 데이터 (userName 제거)
  const [emailFormData, setEmailFormData] = useState<Partial<EmailSignupFormData>>({
    email: '',
    password: '',
    confirmPassword: '',
    referral: '',
    agreeTerms: false,
    agreePrivacy: false,
  });

  // 추천인 검색 상태
  const [selectedReferralUser, setSelectedReferralUser] = useState<any>(null);

  // 자동 생성된 닉네임 상태
  const [generatedNickname, setGeneratedNickname] = useState<string>('');

  // 이메일 폼 데이터 업데이트
  const updateEmailFormData = (key: keyof EmailSignupFormData, value: EmailSignupFormData[keyof EmailSignupFormData]) => {
    setEmailFormData(prev => ({ ...prev, [key]: value }));
  };

  // 닉네임 자동 생성 및 중복 확인
  const generateAndCheckNickname = async (): Promise<string> => {
    let attempts = 0;
    let nickname: string;
    
    do {
      nickname = generateNickname('middle'); // 기본값으로 중학교 설정
      attempts++;
      
      const isAvailable = await checkUserNameAvailability(nickname);
      if (isAvailable) {
        return nickname;
      }
    } while (attempts < 10);
    
    // 10번 시도해도 실패하면 타임스탬프 추가
    return generateNickname('middle') + '_' + Date.now().toString().slice(-4);
  };



  // 이메일 회원가입
  const handleEmailSignup = async () => {
    try {
      const validated = emailSignupSchema.parse(emailFormData);
      
      setIsLoading(true);
      
      // 이메일 중복 확인
      const emailExists = await checkEmailExists(validated.email);
      if (emailExists) {
        toast.error('이미 가입된 이메일입니다. 로그인 화면에서 로그인 바랍니다.');
        setIsLoading(false);
        return;
      }
      
      // 닉네임 자동 생성 및 중복 확인
      const userName = await generateAndCheckNickname();
      setGeneratedNickname(userName);
      
      await registerWithEmail({
        email: validated.email,
        password: validated.password,
        userName: userName,
        referral: selectedReferralUser?.userName || validated.referral
      });
      
      toast.success('회원가입이 완료되었습니다!');
      
      // 회원가입 성공 후 잠시 기다린 후 홈으로 이동
      await new Promise(resolve => setTimeout(resolve, 1000));
      router.push('/');
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        toast.error(firstError.message);
      } else {
        console.error('이메일 회원가입 실패:', error);
        toast.error(error instanceof Error ? error.message : '회원가입에 실패했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 카카오 회원가입 핸들러
  const handleKakaoSignup = () => {
    try {
      loginWithKakaoRedirect();
    } catch (error) {
      console.error('카카오 회원가입 실패:', error);
      toast.error('카카오 회원가입 중 오류가 발생했습니다.');
    }
  };

  // Google 회원가입 핸들러
  const handleGoogleSignup = async () => {
    try {
      setIsLoading(true);
      await loginWithGoogle();
      
      // 회원가입 성공 후 홈으로 이동
      await new Promise(resolve => setTimeout(resolve, 1000));
      router.push('/');
    } catch (error) {
      console.error('Google 회원가입 실패:', error);
      toast.error(error instanceof Error ? error.message : 'Google 회원가입 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 키보드 엔터 핸들러
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      e.preventDefault();
      handleEmailSignup();
    }
  };

  return (
    <div className="w-full space-y-6">
      {showTitle && (
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">회원가입</h1>
          <p className="text-gray-600">인스쿨즈에 오신 것을 환영합니다</p>
        </div>
      )}

      {/* 회원가입 폼 */}
      <div className="space-y-4">
            {/* 이메일 */}
            <div className="space-y-2">
              <Label htmlFor="signup-email" className="text-sm font-medium text-gray-700">
                이메일
              </Label>
              <Input
                id="signup-email"
                type="email"
                placeholder="name@example.com"
                value={emailFormData.email || ''}
                onChange={(e) => updateEmailFormData('email', e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-11"
              />
            </div>

            {/* 비밀번호 */}
            <div className="space-y-2">
              <Label htmlFor="signup-password" className="text-sm font-medium text-gray-700">
                비밀번호
              </Label>
              <div className="relative">
                <Input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="비밀번호 (6자 이상)"
                  value={emailFormData.password || ''}
                  onChange={(e) => updateEmailFormData('password', e.target.value)}
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

            {/* 비밀번호 확인 */}
            <div className="space-y-2">
              <Label htmlFor="signup-confirmPassword" className="text-sm font-medium text-gray-700">
                비밀번호 확인
              </Label>
              <div className="relative">
                <Input
                  id="signup-confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="비밀번호를 다시 입력하세요"
                  value={emailFormData.confirmPassword || ''}
                  onChange={(e) => updateEmailFormData('confirmPassword', e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-11 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-11 px-3 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                </Button>
              </div>
            </div>

            {/* 추천인 아이디 */}
            <div className="space-y-2">
              <Label htmlFor="signup-referral" className="text-sm font-medium text-gray-700">
                추천인 아이디 (선택사항)
              </Label>
              <ReferralSearch
                value={emailFormData.referral || ''}
                onSelect={(user) => {
                  setSelectedReferralUser(user);
                  if (user) {
                    updateEmailFormData('referral', user.userName);
                  } else {
                    updateEmailFormData('referral', '');
                  }
                }}
                placeholder="추천인 아이디를 검색하세요"
                className="w-full"
              />
            </div>

            {/* 약관 동의 */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="email-agreeTerms"
                  checked={emailFormData.agreeTerms || false}
                  onCheckedChange={(checked) => updateEmailFormData('agreeTerms', checked as boolean)}
                />
                <Label htmlFor="email-agreeTerms" className="text-sm text-gray-700">
                  <Link href="/terms" className="text-green-600 hover:underline">이용약관</Link>에 동의합니다
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="email-agreePrivacy"
                  checked={emailFormData.agreePrivacy || false}
                  onCheckedChange={(checked) => updateEmailFormData('agreePrivacy', checked as boolean)}
                />
                <Label htmlFor="email-agreePrivacy" className="text-sm text-gray-700">
                  <Link href="/privacy" className="text-green-600 hover:underline">개인정보처리방침</Link>에 동의합니다
                </Label>
              </div>
            </div>

            <Button 
              onClick={handleEmailSignup} 
              className="w-full h-11 bg-green-600 hover:bg-green-700" 
              disabled={isLoading}
            >
              {isLoading ? '회원가입 중...' : '회원가입'}
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
      
      {/* 소셜 회원가입 버튼들 */}
      <div className="space-y-3">
        {/* 카카오 회원가입 */}
        <Button 
          onClick={handleKakaoSignup}
          className="w-full h-11 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-medium"
          disabled={isLoading}
        >
          <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3C7.03 3 3 6.58 3 11c0 2.91 2.05 5.47 5 6.48v2.58c0 .25.33.4.55.26L11.09 18H12c4.97 0 9-3.58 9-8s-4.03-8-9-8z"/>
          </svg>
          카카오로 계속하기
        </Button>

        {/* Google 회원가입 */}
        <Button 
          onClick={handleGoogleSignup}
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

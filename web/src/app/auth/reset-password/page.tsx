'use client';

import { useState } from 'react';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { auth } from '@/lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { ArrowLeft, CheckCircle } from 'lucide-react';

const resetPasswordSchema = z.object({
  email: z.string().email({
    message: '유효한 이메일 주소를 입력해주세요.',
  }),
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (values: ResetPasswordFormValues) => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      await sendPasswordResetEmail(auth, values.email);
      setIsSuccess(true);
    } catch (error: unknown) {
      console.error('비밀번호 재설정 이메일 전송 오류:', error);
      const firebaseError = error as { code?: string };
      
      if (firebaseError.code === 'auth/user-not-found') {
        setError('해당 이메일로 등록된 계정을 찾을 수 없습니다.');
      } else {
        setError('비밀번호 재설정 요청 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-xl shadow-lg">
          <div className="text-center mb-6">
            <Link href="/" className="inline-block">
              <h1 className="text-2xl font-bold text-green-600">인스쿨즈</h1>
            </Link>
            <p className="mt-2 text-gray-600">비밀번호 재설정</p>
          </div>

          {isSuccess ? (
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <CheckCircle className="h-16 w-16 text-green-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold">이메일이 전송되었습니다</h2>
                <p className="text-gray-600">
                  입력하신 이메일로 비밀번호 재설정 링크를 보냈습니다. 
                  이메일을 확인하고 링크를 클릭하여 비밀번호를 재설정해주세요.
                </p>
              </div>
              <Button asChild className="mt-4">
                <Link href="/login">
                  로그인 페이지로 돌아가기
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="text-sm text-gray-600 mb-6">
                <p>계정에 등록된 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다.</p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>이메일</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            placeholder="example@email.com" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {error && (
                    <div className="text-red-500 text-sm">{error}</div>
                  )}
                  
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? '처리 중...' : '비밀번호 재설정 이메일 받기'}
                  </Button>
                </form>
              </Form>
              
              <div className="text-center mt-4">
                <Button variant="link" asChild>
                  <Link href="/login" className="flex items-center text-green-600">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    로그인으로 돌아가기
                  </Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 
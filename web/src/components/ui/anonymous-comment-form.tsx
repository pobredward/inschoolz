'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, MessageSquare } from 'lucide-react';

interface AnonymousCommentFormProps {
  onSubmit: (data: {
    nickname: string;
    password: string;
    content: string;
  }) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  placeholder?: string;
}

export default function AnonymousCommentForm({
  onSubmit,
  onCancel,
  isSubmitting = false,
  placeholder = "댓글을 입력하세요..."
}: AnonymousCommentFormProps) {
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [content, setContent] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!nickname.trim()) {
      newErrors.nickname = '닉네임을 입력해주세요.';
    } else if (nickname.length < 2 || nickname.length > 10) {
      newErrors.nickname = '닉네임은 2~10자로 입력해주세요.';
    }

    if (!password) {
      newErrors.password = '비밀번호를 입력해주세요.';
    } else if (!/^\d{4}$/.test(password)) {
      newErrors.password = '4자리 숫자로 입력해주세요.';
    }

    if (!content.trim()) {
      newErrors.content = '댓글 내용을 입력해주세요.';
    } else if (content.length > 1000) {
      newErrors.content = '댓글은 1000자 이하로 입력해주세요.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit({
        nickname: nickname.trim(),
        password,
        content: content.trim()
      });
      
      // 성공 시 폼 초기화
      setNickname('');
      setPassword('');
      setContent('');
      setErrors({});
    } catch (error) {
      console.error('댓글 작성 실패:', error);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          익명 댓글 작성
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          로그인하지 않고도 댓글을 작성할 수 있습니다. 수정/삭제 시 비밀번호가 필요합니다.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 닉네임 입력 */}
          <div className="space-y-2">
            <Label htmlFor="nickname">닉네임</Label>
            <Input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="익명123"
              maxLength={10}
              className={errors.nickname ? 'border-red-500' : ''}
            />
            {errors.nickname && (
              <p className="text-xs text-red-500">{errors.nickname}</p>
            )}
          </div>

          {/* 비밀번호 입력 */}
          <div className="space-y-2">
            <Label htmlFor="password">비밀번호 (4자리 숫자)</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="1234"
                maxLength={4}
                className={`pr-10 ${errors.password ? 'border-red-500' : ''}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {errors.password && (
              <p className="text-xs text-red-500">{errors.password}</p>
            )}
            <p className="text-xs text-muted-foreground">
              댓글 수정 및 삭제 시 필요합니다.
            </p>
          </div>

          {/* 댓글 내용 */}
          <div className="space-y-2">
            <Label htmlFor="content">댓글 내용</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={placeholder}
              maxLength={1000}
              rows={4}
              className={errors.content ? 'border-red-500' : ''}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{errors.content && <span className="text-red-500">{errors.content}</span>}</span>
              <span>{content.length}/1000</span>
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-green-500 hover:bg-green-600"
            >
              {isSubmitting ? '작성 중...' : '댓글 작성'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
} 
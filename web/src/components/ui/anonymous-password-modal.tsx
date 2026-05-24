'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Eye, EyeOff, Lock } from 'lucide-react';

interface AnonymousPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => Promise<boolean>;
  title: string;
  description: string;
  isLoading?: boolean;
}

export default function AnonymousPasswordModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  isLoading = false
}: AnonymousPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!/^\d{4}$/.test(password)) {
      setError('4자리 숫자를 입력해주세요.');
      return;
    }

    setError('');
    
    try {
      const isValid = await onConfirm(password);
      if (isValid) {
        setPassword('');
        onClose();
      } else {
        setError('비밀번호가 일치하지 않습니다.');
        setPassword(''); // 비밀번호 입력 필드 초기화
        // 입력 필드에 다시 포커스
        setTimeout(() => {
          passwordInputRef.current?.focus();
        }, 100);
      }
    } catch (error) {
      console.error('비밀번호 확인 실패:', error);
      setError('비밀번호 확인 중 오류가 발생했습니다.');
      setPassword(''); // 오류 시에도 입력 필드 초기화
    }
  };

  const handleClose = () => {
    setPassword('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">비밀번호 (4자리 숫자)</Label>
            <div className="relative">
              <Input
                ref={passwordInputRef}
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="1234"
                maxLength={4}
                className={`pr-10 ${error ? 'border-red-500' : ''}`}
                autoFocus
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
            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !password}
            >
              {isLoading ? '확인 중...' : '확인'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 
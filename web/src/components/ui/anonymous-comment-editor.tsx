'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Edit2 } from 'lucide-react';

interface AnonymousCommentEditorProps {
  initialContent: string;
  onSave: (content: string) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export default function AnonymousCommentEditor({
  initialContent,
  onSave,
  onCancel,
  isSubmitting = false
}: AnonymousCommentEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      setError('댓글 내용을 입력해주세요.');
      return;
    }

    if (content.length > 1000) {
      setError('댓글은 1000자 이하로 입력해주세요.');
      return;
    }

    setError('');
    onSave(content.trim());
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Edit2 className="h-5 w-5" />
          댓글 수정
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="댓글 내용을 입력하세요..."
              maxLength={1000}
              rows={4}
              className={error ? 'border-red-500' : ''}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{error && <span className="text-red-500">{error}</span>}</span>
              <span>{content.length}/1000</span>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
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
            >
              {isSubmitting ? '수정 중...' : '수정 완료'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
} 
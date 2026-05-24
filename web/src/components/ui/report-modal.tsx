'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ReportType, ReportReason } from '@/types';
import { createReport } from '@/lib/api/reports';
import { useAuth } from '@/providers/AuthProvider';
import { toast } from 'sonner';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string;
  targetType: ReportType;
  targetContent?: string;
  postId?: string; // 댓글 신고 시 필요
  onSuccess: () => void;
  boardCode?: string;
  schoolId?: string;
  regions?: {
    sido: string;
    sigungu: string;
  };
}

// 신고 사유 옵션
const REPORT_REASONS: { value: ReportReason; label: string; description: string }[] = [
  { value: 'spam', label: '스팸/도배', description: '반복적인 광고나 의미없는 내용' },
  { value: 'inappropriate', label: '부적절한 내용', description: '커뮤니티 규칙에 어긋나는 내용' },
  { value: 'harassment', label: '괴롭힘/욕설', description: '타인을 모독하거나 괴롭히는 내용' },
  { value: 'fake', label: '허위정보', description: '거짓 정보나 잘못된 정보' },
  { value: 'copyright', label: '저작권 침해', description: '타인의 저작물을 무단으로 사용' },
  { value: 'privacy', label: '개인정보 노출', description: '개인정보나 사생활 침해' },
  { value: 'violence', label: '폭력적 내용', description: '폭력을 조장하거나 위협하는 내용' },
  { value: 'sexual', label: '성적 내용', description: '성적으로 부적절한 내용' },
  { value: 'hate', label: '혐오 발언', description: '차별이나 혐오를 조장하는 내용' },
  { value: 'other', label: '기타', description: '위에 해당하지 않는 기타 사유' },
];

export function ReportModal({
  isOpen,
  onClose,
  targetId,
  targetType,
  targetContent,
  postId,
  onSuccess,
  boardCode,
  schoolId,
  regions,
}: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<ReportReason>('inappropriate');
  const [customReason, setCustomReason] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async () => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    if (selectedReason === 'other' && !customReason.trim()) {
      toast.error('기타 사유를 입력해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      await createReport({
        reason: selectedReason,
        customReason: selectedReason === 'other' ? customReason : undefined,
        description: description.trim() || undefined,
        targetId,
        targetType,
        targetContent,
        postId: targetType === 'comment' ? postId : undefined,
        reporterId: user.uid,
        reporterInfo: {
          displayName: user.profile.userName,
          profileImageUrl: user.profile.profileImageUrl,
        },
        boardCode,
        schoolId,
        regions,
      });

      onSuccess();
    } catch (error) {
      console.error('신고 제출 실패:', error);
      toast.error('신고 제출에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTargetTypeName = () => {
    switch (targetType) {
      case 'post':
        return '게시글';
      case 'comment':
        return '댓글';
      case 'user':
        return '사용자';
      default:
        return '내용';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            {getTargetTypeName()} 신고
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* 신고 사유 선택 */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">신고 사유를 선택해주세요</Label>
            <RadioGroup
              value={selectedReason}
              onValueChange={(value: string) => setSelectedReason(value as ReportReason)}
              className="space-y-2"
            >
              {REPORT_REASONS.map((reason) => (
                <div key={reason.value} className="flex items-start space-x-3">
                  <RadioGroupItem value={reason.value} id={reason.value} className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor={reason.value} className="font-medium cursor-pointer">
                      {reason.label}
                    </Label>
                    <p className="text-sm text-gray-500 mt-1">{reason.description}</p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* 기타 사유 입력 */}
          {selectedReason === 'other' && (
            <div className="space-y-2">
              <Label htmlFor="customReason" className="text-sm font-medium">
                기타 사유 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="customReason"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="신고 사유를 입력해주세요"
                maxLength={100}
              />
              <p className="text-xs text-gray-500">{customReason.length}/100</p>
            </div>
          )}

          {/* 상세 설명 */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              상세 설명 (선택사항)
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="신고 내용에 대한 상세한 설명을 입력해주세요"
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-gray-500">{description.length}/500</p>
          </div>

          {/* 24시간 내 처리 안내 */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs">!</span>
              </div>
              <div>
                <p className="text-sm font-medium text-blue-800">신고 처리 안내</p>
                <p className="text-sm text-blue-700 mt-1">
                  모든 신고는 <strong>24시간 이내</strong>에 검토되며, 처리 결과는 알림으로 안내됩니다.
                </p>
              </div>
            </div>
          </div>

          {/* 안내 메시지 */}
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              허위 신고는 제재 대상이 될 수 있습니다. 신중히 신고해주세요.
            </p>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isSubmitting ? '신고 중...' : '신고하기'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 
"use client";

import React from 'react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  Clock, 
  Ban, 
  Mail, 
  LogOut,
  Calendar,
  MessageCircle
} from 'lucide-react';
import { SuspensionStatus } from '@/lib/auth/suspension-check';

interface SuspensionNoticeProps {
  suspensionStatus: SuspensionStatus;
  onContactSupport?: () => void;
  onLogout?: () => void;
  className?: string;
}

export function SuspensionNotice({ 
  suspensionStatus, 
  onContactSupport, 
  onLogout,
  className = ""
}: SuspensionNoticeProps) {
  if (!suspensionStatus.isSuspended) {
    return null;
  }

  const isPermanent = suspensionStatus.isPermanent;
  const remainingDays = suspensionStatus.remainingDays || 0;
  const suspendedUntil = suspensionStatus.suspendedUntil;
  const reason = suspensionStatus.reason || '정책 위반';

  return (
    <div className={`min-h-screen bg-gray-50 flex items-center justify-center p-4 ${className}`}>
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {isPermanent ? (
              <Ban className="h-16 w-16 text-red-500" />
            ) : (
              <Clock className="h-16 w-16 text-orange-500" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            계정이 {isPermanent ? '영구' : '임시'} 정지되었습니다
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* 정지 상태 요약 */}
          <Alert className={isPermanent ? "border-red-200 bg-red-50" : "border-orange-200 bg-orange-50"}>
            <AlertTriangle className={`h-4 w-4 ${isPermanent ? 'text-red-600' : 'text-orange-600'}`} />
            <AlertTitle className={isPermanent ? 'text-red-800' : 'text-orange-800'}>
              {isPermanent ? '영구 정지' : '임시 정지'}
            </AlertTitle>
            <AlertDescription className={isPermanent ? 'text-red-700' : 'text-orange-700'}>
              {isPermanent 
                ? '계정이 영구적으로 정지되어 모든 서비스 이용이 불가능합니다.'
                : `계정이 임시적으로 정지되어 대부분의 서비스 이용이 제한됩니다.`
              }
            </AlertDescription>
          </Alert>

          {/* 정지 상세 정보 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                정지 사유
              </h3>
              <Badge variant="destructive" className="text-sm">
                {reason}
              </Badge>
            </div>
            
            {!isPermanent && suspendedUntil && (
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  정지 해제일
                </h3>
                <div className="text-sm">
                  <div className="font-medium">{suspendedUntil.toLocaleDateString('ko-KR')}</div>
                  <div className="text-gray-600">남은 기간: {remainingDays}일</div>
                </div>
              </div>
            )}
          </div>

          {/* 제한 사항 안내 */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-3">정지 기간 동안 제한되는 기능</h3>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
              <div>• 게시글 작성</div>
              <div>• 댓글 작성</div>
              <div>• 좋아요 및 반응</div>
              <div>• 게임 플레이</div>
              <div>• 프로필 수정</div>
              <div>• 팔로우/친구 기능</div>
              <div>• 경험치 획득</div>
              <div>• 출석 체크</div>
            </div>
          </div>

          {!isPermanent && (
            <Alert className="border-blue-200 bg-blue-50">
              <Clock className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800">자동 해제 안내</AlertTitle>
              <AlertDescription className="text-blue-700">
                정지 기간이 만료되면 자동으로 계정이 복구됩니다. 
                별도의 조치가 필요하지 않습니다.
              </AlertDescription>
            </Alert>
          )}

          {/* 액션 버튼 */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            {onContactSupport && (
              <Button 
                onClick={onContactSupport}
                variant="outline" 
                className="flex-1"
              >
                <Mail className="h-4 w-4 mr-2" />
                고객지원 문의
              </Button>
            )}
            
            {onLogout && (
              <Button 
                onClick={onLogout}
                variant="secondary" 
                className="flex-1"
              >
                <LogOut className="h-4 w-4 mr-2" />
                로그아웃
              </Button>
            )}
          </div>

          {/* 추가 안내 */}
          <div className="text-xs text-gray-500 text-center border-t pt-4">
            정지 처분에 대해 이의가 있으시면 고객지원팀에 문의해주세요.
            <br />
            부정한 방법으로 정지를 우회하려는 시도는 추가 제재를 받을 수 있습니다.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * 간단한 정지 배너 (페이지 상단에 표시용)
 */
export function SuspensionBanner({ 
  suspensionStatus, 
  onDismiss 
}: { 
  suspensionStatus: SuspensionStatus;
  onDismiss?: () => void;
}) {
  if (!suspensionStatus.isSuspended) {
    return null;
  }

  const isPermanent = suspensionStatus.isPermanent;
  const remainingDays = suspensionStatus.remainingDays || 0;

  return (
    <Alert className={`mb-4 ${isPermanent ? 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-50'}`}>
      <AlertTriangle className={`h-4 w-4 ${isPermanent ? 'text-red-600' : 'text-orange-600'}`} />
      <AlertTitle className={isPermanent ? 'text-red-800' : 'text-orange-800'}>
        계정 {isPermanent ? '영구' : '임시'} 정지
      </AlertTitle>
      <AlertDescription className={`${isPermanent ? 'text-red-700' : 'text-orange-700'} flex items-center justify-between`}>
        <span>
          {isPermanent 
            ? `사유: ${suspensionStatus.reason || '정책 위반'}`
            : `남은 기간: ${remainingDays}일 (사유: ${suspensionStatus.reason || '정책 위반'})`
          }
        </span>
        {onDismiss && (
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            ✕
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
} 
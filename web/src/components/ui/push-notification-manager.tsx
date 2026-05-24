'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, Smartphone, Monitor, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { 
  registerWebPushNotifications, 
  removeWebPushTokenFromUser,
  getWebPushPermissionStatus,
  isWebPushSupported 
} from '@/lib/web-push-notifications';

interface PushNotificationManagerProps {
  className?: string;
}

export function PushNotificationManager({ className }: PushNotificationManagerProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [webPushStatus, setWebPushStatus] = useState<'unknown' | 'granted' | 'denied' | 'default'>('unknown');
  const [isSupported, setIsSupported] = useState(false);
  const [registrationResult, setRegistrationResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    // 브라우저 지원 여부 확인
    setIsSupported(isWebPushSupported());
    
    // 현재 권한 상태 확인
    if (isWebPushSupported()) {
      setWebPushStatus(getWebPushPermissionStatus());
    }
  }, []);

  const handleRegisterWebPush = async () => {
    if (!user) {
      setRegistrationResult({
        success: false,
        message: '로그인이 필요합니다.'
      });
      return;
    }

    setIsLoading(true);
    setRegistrationResult(null);

    try {
      const result = await registerWebPushNotifications(user.uid);
      
      if (result.success) {
        setWebPushStatus('granted');
        setRegistrationResult({
          success: true,
          message: '웹 푸시 알림이 성공적으로 등록되었습니다!'
        });
      } else {
        setRegistrationResult({
          success: false,
          message: result.error || '웹 푸시 알림 등록에 실패했습니다.'
        });
      }
    } catch (error) {
      setRegistrationResult({
        success: false,
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableWebPush = async () => {
    if (!user) return;

    setIsLoading(true);
    setRegistrationResult(null);

    try {
      await removeWebPushTokenFromUser(user.uid);
      setWebPushStatus('default');
      setRegistrationResult({
        success: true,
        message: '웹 푸시 알림이 비활성화되었습니다.'
      });
    } catch (error) {
      setRegistrationResult({
        success: false,
        message: '웹 푸시 알림 비활성화에 실패했습니다.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = () => {
    switch (webPushStatus) {
      case 'granted':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />활성화됨</Badge>;
      case 'denied':
        return <Badge variant="destructive"><BellOff className="w-3 h-3 mr-1" />차단됨</Badge>;
      case 'default':
        return <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" />미설정</Badge>;
      default:
        return <Badge variant="outline">확인 중...</Badge>;
    }
  };

  const getStatusDescription = () => {
    switch (webPushStatus) {
      case 'granted':
        return '웹 브라우저에서 푸시 알림을 받을 수 있습니다.';
      case 'denied':
        return '브라우저 설정에서 알림 권한을 허용해주세요.';
      case 'default':
        return '웹 푸시 알림을 활성화하면 브라우저에서도 실시간 알림을 받을 수 있습니다.';
      default:
        return '푸시 알림 상태를 확인하고 있습니다...';
    }
  };

  if (!isSupported) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="w-5 h-5" />
            웹 푸시 알림
          </CardTitle>
          <CardDescription>
            이 브라우저는 웹 푸시 알림을 지원하지 않습니다.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          푸시 알림 설정
        </CardTitle>
        <CardDescription>
          다양한 플랫폼에서 실시간 알림을 받아보세요.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* 웹 푸시 알림 섹션 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              <span className="font-medium">웹 브라우저</span>
              {getStatusBadge()}
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground">
            {getStatusDescription()}
          </p>

          <div className="flex gap-2">
            {webPushStatus === 'granted' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisableWebPush}
                disabled={isLoading}
              >
                <BellOff className="w-4 h-4 mr-2" />
                비활성화
              </Button>
            ) : (
              <Button
                onClick={handleRegisterWebPush}
                disabled={isLoading || webPushStatus === 'denied'}
                size="sm"
              >
                <Bell className="w-4 h-4 mr-2" />
                {isLoading ? '등록 중...' : '웹 푸시 활성화'}
              </Button>
            )}
          </div>
        </div>

        {/* 모바일 앱 알림 안내 */}
        <div className="space-y-3 pt-4 border-t">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            <span className="font-medium">모바일 앱</span>
            <Badge variant="outline">자동 등록</Badge>
          </div>
          
          <p className="text-sm text-muted-foreground">
            인스쿨즈 모바일 앱을 설치하고 로그인하면 자동으로 푸시 알림이 등록됩니다.
          </p>
        </div>

        {/* 등록 결과 메시지 */}
        {registrationResult && (
          <div className={`p-3 rounded-lg text-sm ${
            registrationResult.success 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            <div className="flex items-center gap-2">
              {registrationResult.success ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              {registrationResult.message}
            </div>
          </div>
        )}

        {/* 브라우저 권한 차단 시 안내 */}
        {webPushStatus === 'denied' && (
          <div className="p-3 rounded-lg bg-yellow-50 text-yellow-800 border border-yellow-200 text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5" />
              <div>
                <p className="font-medium">알림이 차단되어 있습니다</p>
                <p className="mt-1">브라우저 주소창의 자물쇠 아이콘을 클릭하여 알림 권한을 허용해주세요.</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

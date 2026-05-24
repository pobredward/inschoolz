'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Send, TestTube, Users, User } from 'lucide-react';
import { sendDirectPushNotification, sendTestPushNotification, sendPushNotificationToUser } from '@/lib/unified-push-notification-sender';
import { NotificationType } from '@/types';

interface TestResult {
  success: boolean;
  error?: string;
  message: string;
}

export function PushNotificationTester() {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [userId, setUserId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [notificationType, setNotificationType] = useState<NotificationType>('system');
  const [testMode, setTestMode] = useState<'direct' | 'userId'>('direct');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const handleDirectSend = async () => {
    if (!expoPushToken.trim()) {
      setResult({
        success: false,
        error: 'Expo Push Token이 필요합니다',
        message: 'Expo Push Token을 입력해주세요'
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await sendDirectPushNotification(
        expoPushToken.trim(),
        title || '테스트 알림',
        body || '웹 관리자 패널에서 발송된 푸시 알림입니다.',
        {
          testType: 'direct-send',
          timestamp: Date.now(),
          source: 'web-admin'
        }
      );

      if (response.success) {
        setResult({
          success: true,
          message: '✅ 푸시 알림이 성공적으로 발송되었습니다!'
        });
      } else {
        setResult({
          success: false,
          error: response.error,
          message: '❌ 푸시 알림 발송에 실패했습니다.'
        });
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        message: '❌ 네트워크 오류가 발생했습니다.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUserIdSend = async () => {
    if (!userId.trim()) {
      setResult({
        success: false,
        error: 'User ID가 필요합니다',
        message: 'User ID를 입력해주세요'
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await sendPushNotificationToUser(
        userId.trim(),
        notificationType,
        title || '관리자 알림',
        body || '관리자로부터 발송된 알림입니다.',
        {
          testType: 'user-id-send',
          timestamp: Date.now(),
          source: 'web-admin'
        }
      );

      if (response.success) {
        setResult({
          success: true,
          message: '✅ 사용자에게 푸시 알림이 성공적으로 발송되었습니다!'
        });
      } else {
        setResult({
          success: false,
          error: response.error,
          message: '❌ 푸시 알림 발송에 실패했습니다.'
        });
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        message: '❌ 네트워크 오류가 발생했습니다.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickTest = async () => {
    const testToken = 'ExponentPushToken[AAAAAAAAAAAAAAAAAAAAAA]'; // 예시 토큰
    
    setLoading(true);
    setResult(null);

    try {
      const response = await sendDirectPushNotification(
        testToken,
        '🧪 빠른 테스트',
        '이것은 웹에서 보내는 빠른 테스트 알림입니다.',
        {
          quickTest: true,
          timestamp: Date.now()
        }
      );

      setResult({
        success: response.success,
        error: response.error,
        message: response.success 
          ? '✅ 빠른 테스트 완료!' 
          : '❌ 테스트 실패 (유효한 토큰이 필요합니다)'
      });
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        message: '❌ 테스트 실행 중 오류가 발생했습니다.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            푸시 알림 테스터
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 테스트 모드 선택 */}
          <div className="space-y-2">
            <Label>테스트 모드</Label>
            <Select value={testMode} onValueChange={(value: 'direct' | 'userId') => setTestMode(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="direct">
                  <div className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    직접 토큰으로 발송
                  </div>
                </SelectItem>
                <SelectItem value="userId">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    사용자 ID로 발송
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Expo Push Token 입력 (직접 모드) */}
          {testMode === 'direct' && (
            <div className="space-y-2">
              <Label htmlFor="expoPushToken">Expo Push Token</Label>
              <Input
                id="expoPushToken"
                placeholder="ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
                value={expoPushToken}
                onChange={(e) => setExpoPushToken(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                💡 앱에서 로그인 후 콘솔 로그에서 토큰을 확인하거나, Firebase 사용자 문서에서 찾을 수 있습니다.
              </p>
            </div>
          )}

          {/* User ID 입력 (사용자 ID 모드) */}
          {testMode === 'userId' && (
            <div className="space-y-2">
              <Label htmlFor="userId">사용자 ID</Label>
              <Input
                id="userId"
                placeholder="Firebase 사용자 UID"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="font-mono text-sm"
              />
              <div className="space-y-2">
                <Label htmlFor="notificationType">알림 타입</Label>
                <Select 
                  value={notificationType} 
                  onValueChange={(value: NotificationType) => setNotificationType(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">시스템 알림</SelectItem>
                    <SelectItem value="post_comment">게시글 댓글</SelectItem>
                    <SelectItem value="comment_reply">댓글 답글</SelectItem>
                    <SelectItem value="referral">추천인 알림</SelectItem>
                    <SelectItem value="warning">경고</SelectItem>
                    <SelectItem value="suspension">계정 정지</SelectItem>
                    <SelectItem value="report_received">신고 접수</SelectItem>
                    <SelectItem value="report_resolved">신고 처리</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* 알림 제목 */}
          <div className="space-y-2">
            <Label htmlFor="title">알림 제목</Label>
            <Input
              id="title"
              placeholder="알림 제목을 입력하세요"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* 알림 내용 */}
          <div className="space-y-2">
            <Label htmlFor="body">알림 내용</Label>
            <Textarea
              id="body"
              placeholder="알림 내용을 입력하세요"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
            />
          </div>

          {/* 버튼들 */}
          <div className="flex gap-2">
            <Button 
              onClick={testMode === 'direct' ? handleDirectSend : handleUserIdSend}
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  발송 중...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  푸시 알림 발송
                </>
              )}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleQuickTest}
              disabled={loading}
            >
              <TestTube className="mr-2 h-4 w-4" />
              빠른 테스트
            </Button>
          </div>

          {/* 결과 표시 */}
          {result && (
            <Alert className={result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <AlertDescription>
                <div className="space-y-2">
                  <p className={result.success ? 'text-green-800' : 'text-red-800'}>
                    {result.message}
                  </p>
                  {result.error && (
                    <p className="text-xs text-red-600 font-mono">
                      오류: {result.error}
                    </p>
                  )}
                  {result.success && (
                    <p className="text-xs text-green-600">
                      📱 기기에서 알림을 확인해보세요. 화면을 끄고 테스트도 해보세요!
                    </p>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 사용법 안내 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">📋 사용법 안내</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            <h4 className="font-medium text-foreground mb-1">1. 직접 토큰으로 발송</h4>
            <p>Expo Push Token을 직접 입력하여 발송합니다. 테스트나 디버깅에 유용합니다.</p>
          </div>
          
          <div>
            <h4 className="font-medium text-foreground mb-1">2. 사용자 ID로 발송</h4>
            <p>Firebase 사용자 UID를 입력하여 해당 사용자의 모든 기기에 발송합니다.</p>
          </div>
          
          <div>
            <h4 className="font-medium text-foreground mb-1">3. 토큰 확인 방법</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>앱 로그인 후 개발자 콘솔에서 확인</li>
              <li>Firebase Console → Firestore → users → [userId] → pushTokens</li>
              <li><a href="https://expo.dev/notifications" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Expo Push Notifications Tool</a>에서 테스트</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { sendPushNotificationToUser, sendDirectPushNotification } from '@/lib/unified-push-notification-sender';

export default function DebugPushPage() {
  const [userId, setUserId] = useState('kgffWa3onhhCBh2sLxiUWw19JWR2');
  const [token, setToken] = useState('ExponentPushToken[rbeXluMvIYC00bSztq8s5T]');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testUserIdPush = async () => {
    setLoading(true);
    setResult(null);
    
    console.log('🧪 사용자 ID로 푸시 테스트 시작');
    try {
      const response = await sendPushNotificationToUser(
        userId,
        'system',
        '🔍 사용자 ID 테스트',
        '사용자 ID를 통한 푸시 알림 테스트입니다.',
        {
          testType: 'userId-debug',
          timestamp: Date.now()
        }
      );
      
      console.log('📊 사용자 ID 테스트 결과:', response);
      setResult({ type: 'userId', ...response });
    } catch (error) {
      console.error('❌ 사용자 ID 테스트 실패:', error);
      setResult({ 
        type: 'userId', 
        success: false, 
        error: error instanceof Error ? error.message : '알 수 없는 오류' 
      });
    } finally {
      setLoading(false);
    }
  };

  const testDirectPush = async () => {
    setLoading(true);
    setResult(null);
    
    console.log('🧪 직접 토큰 푸시 테스트 시작');
    try {
      const response = await sendDirectPushNotification(
        token,
        '🎯 직접 토큰 테스트',
        '토큰을 직접 사용한 푸시 알림 테스트입니다.',
        {
          testType: 'direct-token-debug',
          timestamp: Date.now()
        }
      );
      
      console.log('📊 직접 토큰 테스트 결과:', response);
      setResult({ type: 'direct', ...response });
    } catch (error) {
      console.error('❌ 직접 토큰 테스트 실패:', error);
      setResult({ 
        type: 'direct', 
        success: false, 
        error: error instanceof Error ? error.message : '알 수 없는 오류' 
      });
    } finally {
      setLoading(false);
    }
  };

  const testRawFetch = async () => {
    setLoading(true);
    setResult(null);
    
    console.log('🧪 Raw Fetch 테스트 시작');
    try {
      const message = {
        to: token,
        title: '🛠 Raw Fetch 테스트',
        body: 'fetch API를 직접 사용한 테스트입니다.',
        data: {
          testType: 'raw-fetch-debug',
          timestamp: Date.now()
        },
        sound: 'default',
        priority: 'high'
      };

      console.log('📤 발송할 메시지:', message);

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      console.log('📡 HTTP 응답:', response.status, response.statusText);

      const result = await response.json();
      console.log('📄 응답 데이터:', result);

      setResult({ 
        type: 'raw', 
        success: response.ok,
        httpStatus: response.status,
        response: result 
      });
    } catch (error) {
      console.error('❌ Raw Fetch 테스트 실패:', error);
      setResult({ 
        type: 'raw', 
        success: false, 
        error: error instanceof Error ? error.message : '알 수 없는 오류' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">🔍 푸시 알림 디버깅</h1>
      
      <div className="space-y-6">
        {/* 설정 */}
        <Card>
          <CardHeader>
            <CardTitle>테스트 설정</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">사용자 ID</label>
              <Input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Firebase 사용자 UID"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">푸시 토큰</label>
              <Input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ExponentPushToken[...]"
              />
            </div>
          </CardContent>
        </Card>

        {/* 테스트 버튼들 */}
        <Card>
          <CardHeader>
            <CardTitle>테스트 실행</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                onClick={testUserIdPush}
                disabled={loading || !userId}
                variant="outline"
              >
                👤 사용자 ID 테스트
              </Button>
              
              <Button 
                onClick={testDirectPush}
                disabled={loading || !token}
                variant="outline"
              >
                🎯 직접 토큰 테스트
              </Button>
              
              <Button 
                onClick={testRawFetch}
                disabled={loading || !token}
                variant="outline"
              >
                🛠 Raw Fetch 테스트
              </Button>
            </div>
            
            <p className="text-sm text-gray-600">
              💡 브라우저 개발자 도구 (F12) → Console 탭에서 상세한 로그를 확인하세요!
            </p>
          </CardContent>
        </Card>

        {/* 결과 표시 */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                {result.success ? '✅' : '❌'} 테스트 결과 ({result.type})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert className={result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <AlertDescription>
                  <div className="space-y-2">
                    <p className={result.success ? 'text-green-800' : 'text-red-800'}>
                      상태: {result.success ? '성공' : '실패'}
                    </p>
                    
                    {result.error && (
                      <p className="text-red-600 font-mono text-sm">
                        오류: {result.error}
                      </p>
                    )}
                    
                    {result.httpStatus && (
                      <p className="text-gray-600 text-sm">
                        HTTP 상태: {result.httpStatus}
                      </p>
                    )}
                    
                    {result.response && (
                      <details className="mt-4">
                        <summary className="cursor-pointer text-sm font-medium">
                          상세 응답 보기
                        </summary>
                        <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                          {JSON.stringify(result.response, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* 안내 */}
        <Card>
          <CardHeader>
            <CardTitle>📋 디버깅 가이드</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <h4 className="font-medium mb-1">1. 사용자 ID 테스트</h4>
              <p>Firebase에서 사용자 문서를 조회하고 저장된 푸시 토큰으로 발송합니다.</p>
            </div>
            
            <div>
              <h4 className="font-medium mb-1">2. 직접 토큰 테스트</h4>
              <p>푸시 토큰을 직접 사용하여 발송합니다.</p>
            </div>
            
            <div>
              <h4 className="font-medium mb-1">3. Raw Fetch 테스트</h4>
              <p>래퍼 함수 없이 fetch API를 직접 사용하여 Expo API를 호출합니다.</p>
            </div>
            
            <div>
              <h4 className="font-medium mb-1">🔍 콘솔 로그 확인</h4>
              <p>브라우저 개발자 도구에서 상세한 디버깅 정보를 확인할 수 있습니다.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

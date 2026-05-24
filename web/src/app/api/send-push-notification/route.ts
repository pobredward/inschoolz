import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { NotificationType } from '@/types';

interface ExpoMessage {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
  icon?: string;
  android?: {
    channelId?: string;
    sound?: boolean;
    priority?: 'default' | 'normal' | 'high';
    vibrate?: boolean;
    color?: string;
    icon?: string;
    largeIcon?: string;
  };
  ios?: {
    sound?: boolean;
    _displayInForeground?: boolean;
    attachments?: Array<{
      url: string;
      type?: string;
    }>;
  };
}

/**
 * 서버 사이드에서 Expo Push API 호출
 */
async function sendExpoPushNotificationServer(message: ExpoMessage): Promise<{
  success: boolean;
  error?: string;
  receipt?: any;
}> {
  try {
    console.log('📡 [SERVER] Expo API 호출 시작:', {
      to: Array.isArray(message.to) ? message.to[0]?.substring(0, 30) + '...' : message.to.substring(0, 30) + '...',
      title: message.title,
    });
    
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
        // 필요시 Access Token 추가
        // 'Authorization': `Bearer ${process.env.EXPO_ACCESS_TOKEN}`
      },
      body: JSON.stringify(message),
    });

    console.log('📡 [SERVER] HTTP 응답 상태:', response.status, response.statusText);

    const result = await response.json();
    console.log('📄 [SERVER] 응답 데이터:', result);
    
    if (response.ok) {
      if (result.data?.status === 'ok') {
        console.log('✅ [SERVER] Expo API 성공:', result.data.id);
        return { success: true, receipt: result };
      } else {
        console.warn('⚠️ [SERVER] Expo API 응답이 이상함:', result);
        return { success: false, error: `Unexpected response: ${JSON.stringify(result)}` };
      }
    } else {
      console.error('❌ [SERVER] Expo API HTTP 오류:', result);
      return { success: false, error: result.errors?.[0]?.message || `HTTP ${response.status}` };
    }
  } catch (error) {
    console.error('🚨 [SERVER] 네트워크 예외:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Network error' 
    };
  }
}

/**
 * 알림 타입별 채널 ID 매핑
 */
function getChannelIdForNotificationType(type: NotificationType): string {
  const channelMap: Record<NotificationType, string> = {
    'post_comment': 'comments',
    'comment_reply': 'comments', 
    'referral': 'referral',
    'system': 'system',
    'report_received': 'system',
    'report_resolved': 'system',
    'warning': 'system',
    'suspension': 'system',
  };
  
  return channelMap[type] || 'default';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, notificationType, title, body: messageBody, data } = body;

    console.log('🔄 [SERVER] 통합 푸시 발송 요청:', { userId, notificationType, title });

    // 입력 값 검증
    if (!userId || !notificationType || !title || !messageBody) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 직접 토큰 테스트인 경우
    if (userId === 'direct-token-test' && data?.directToken) {
      console.log('🧪 [SERVER] 직접 토큰 테스트 모드');
      const directToken = data.directToken;
      
      const channelId = getChannelIdForNotificationType(notificationType as NotificationType);
      const expoMessage: ExpoMessage = {
        to: directToken,
        title,
        body: messageBody,
        data: {
          type: notificationType,
          testMode: true,
          ...data,
        },
        sound: 'default',
        priority: 'high',
        channelId,
        icon: 'https://inschoolz.com/android-icon-96x96.png',
        android: {
          channelId,
          sound: true,
          priority: 'high',
          vibrate: true,
          color: '#FF231F7C',
          icon: 'https://inschoolz.com/android-icon-96x96.png',
          largeIcon: 'https://inschoolz.com/android-icon-192x192.png',
        },
        ios: {
          sound: true,
          _displayInForeground: true,
          attachments: [{
            url: 'https://inschoolz.com/apple-icon-180x180.png',
            type: 'image'
          }],
        },
      };

      const result = await sendExpoPushNotificationServer(expoMessage);
      
      if (result.success) {
        console.log('✅ [SERVER] 직접 토큰 테스트 성공');
        return NextResponse.json({ 
          success: true, 
          results: [{ platform: 'direct', ...result }] 
        });
      } else {
        console.error('❌ [SERVER] 직접 토큰 테스트 실패:', result.error);
        return NextResponse.json(
          { 
            success: false, 
            error: result.error, 
            results: [{ platform: 'direct', ...result }] 
          },
          { status: 500 }
        );
      }
    }

    // 일반 사용자 푸시 알림 처리
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      console.error('❌ [SERVER] 사용자를 찾을 수 없음:', userId);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const pushTokens = userData.pushTokens;
    
    console.log('👤 [SERVER] 사용자 정보:', { 
      userId, 
      userName: userData?.profile?.userName,
      hasPushTokens: !!pushTokens,
      availableTokens: pushTokens ? Object.keys(pushTokens) : []
    });

    if (!pushTokens || Object.keys(pushTokens).length === 0) {
      console.log('📱 [SERVER INFO] 푸시 토큰이 없음 (정상 - 토큰 미등록 사용자):', userId);
      
      // 개발 환경에서는 Mock 알림으로 처리
      if (process.env.NODE_ENV === 'development') {
        console.log('🔔 [SERVER MOCK] 가상 푸시 알림 생성:', {
          userId,
          userName: userData?.profile?.userName,
          title,
          body: messageBody,
          message: '실제 기기가 없어 푸시를 보낼 수 없지만, Firestore에는 알림이 저장되었습니다.',
          mockToken: 'ExponentPushToken[MOCK-TOKEN-FOR-DEVELOPMENT]'
        });
        
        return NextResponse.json({ 
          success: true,
          results: [{
            platform: 'mock',
            success: true,
            message: 'Mock push notification (development only)'
          }]
        });
      }
      
      console.error('❌ [SERVER] 푸시 토큰이 없음 (프로덕션):', userId);
      return NextResponse.json(
        { error: 'No push tokens found' },
        { status: 404 }
      );
    }

    const results: any[] = [];
    let hasSuccess = false;
    const errors: string[] = [];

    // 각 플랫폼별 토큰에 알림 발송
    for (const [platform, tokenData] of Object.entries(pushTokens)) {
      if (!tokenData || !(tokenData as any)?.token) {
        console.warn(`⚠️ [SERVER] ${platform} 토큰이 유효하지 않음`);
        continue;
      }

      const token = (tokenData as any).token;
      console.log(`🚀 [SERVER] ${platform} 토큰으로 발송 준비:`, token.substring(0, 30) + '...');

      if (platform === 'web') {
        // 웹 푸시는 별도 처리 (FCM Admin SDK 필요)
        console.log('🌐 [SERVER] 웹 푸시는 FCM Admin SDK로 처리 필요');
        // TODO: FCM Admin SDK를 통한 웹 푸시 구현
        continue;
      } else {
        // Expo 푸시 알림 발송 (iOS/Android)
        const channelId = getChannelIdForNotificationType(notificationType as NotificationType);
        const expoMessage: ExpoMessage = {
          to: token,
          title,
          body: messageBody,
          data: {
            type: notificationType,
            userId,
            ...data,
          },
          sound: 'default',
          priority: 'high',
          channelId,
          icon: 'https://inschoolz.com/android-icon-96x96.png',
          android: {
            channelId,
            sound: true,
            priority: 'high',
            vibrate: true,
            color: '#FF231F7C',
            icon: 'https://inschoolz.com/android-icon-96x96.png',
            largeIcon: 'https://inschoolz.com/android-icon-192x192.png',
          },
          ios: {
            sound: true,
            _displayInForeground: true,
            attachments: [{
              url: 'https://inschoolz.com/apple-icon-180x180.png',
              type: 'image'
            }],
          },
        };

        const result = await sendExpoPushNotificationServer(expoMessage);
        results.push({ platform, ...result });
        
        if (result.success) {
          hasSuccess = true;
          console.log(`✅ [SERVER] ${platform} 푸시 발송 성공`);
        } else {
          console.warn(`⚠️ [SERVER] ${platform} 푸시 발송 실패:`, result.error);
          errors.push(`${platform}: ${result.error}`);
        }
      }
    }

    if (hasSuccess) {
      console.log('✅ [SERVER] 통합 푸시 발송 성공');
      return NextResponse.json({ 
        success: true, 
        results 
      });
    } else {
      console.error('❌ [SERVER] 모든 플랫폼 푸시 발송 실패');
      return NextResponse.json(
        { 
          success: false, 
          error: errors.join(', '), 
          results 
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('🚨 [SERVER] 통합 푸시 API 오류:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

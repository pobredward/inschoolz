/**
 * 통합 푸시 알림 발송 시스템
 * Expo 푸시 알림과 웹 푸시 알림을 모두 지원합니다.
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { NotificationType } from '@/types';

// FCM Admin SDK import (서버 사이드에서만 사용)
let admin: any = null;
if (typeof window === 'undefined') {
  try {
    admin = require('firebase-admin');
  } catch (error) {
    console.warn('Firebase Admin SDK를 불러올 수 없습니다. FCM 웹 푸시가 제한될 수 있습니다.');
  }
}

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

interface WebPushMessage {
  token: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  icon?: string;
  badge?: string;
  image?: string;
  requireInteraction?: boolean;
  tag?: string;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

/**
 * Expo Push API를 사용하여 푸시 알림 발송
 */
export async function sendExpoPushNotification(message: ExpoMessage): Promise<{
  success: boolean;
  error?: string;
  receipt?: any;
}> {
  try {
    console.log('📡 [DEBUG] Expo API 호출 시작:', {
      to: Array.isArray(message.to) ? message.to[0]?.substring(0, 30) + '...' : message.to.substring(0, 30) + '...',
      title: message.title,
      url: 'https://exp.host/--/api/v2/push/send'
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

    console.log('📡 [DEBUG] HTTP 응답 상태:', response.status, response.statusText);

    const result = await response.json();
    console.log('📄 [DEBUG] 응답 데이터:', result);
    
    if (response.ok) {
      if (result.data?.status === 'ok') {
        console.log('✅ [DEBUG] Expo API 성공:', result.data.id);
        return { success: true, receipt: result };
      } else {
        console.warn('⚠️ [DEBUG] Expo API 응답이 이상함:', result);
        return { success: false, error: `Unexpected response: ${JSON.stringify(result)}` };
      }
    } else {
      console.error('❌ [DEBUG] Expo API HTTP 오류:', result);
      return { success: false, error: result.errors?.[0]?.message || `HTTP ${response.status}` };
    }
  } catch (error) {
    console.error('🚨 [DEBUG] 네트워크 예외:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Network error' 
    };
  }
}

/**
 * FCM을 사용하여 웹 푸시 알림 발송
 */
export async function sendWebPushNotification(message: WebPushMessage): Promise<{
  success: boolean;
  error?: string;
  messageId?: string;
}> {
  try {
    console.log('🌐 [DEBUG] 웹 푸시 발송 시작:', {
      token: message.token.substring(0, 30) + '...',
      title: message.title
    });

    // 서버 사이드에서만 실행
    if (typeof window !== 'undefined') {
      return { 
        success: false, 
        error: '웹 푸시는 서버 사이드에서만 발송할 수 있습니다.' 
      };
    }

    if (!admin) {
      return { 
        success: false, 
        error: 'Firebase Admin SDK가 초기화되지 않았습니다.' 
      };
    }

    const fcmMessage = {
      token: message.token,
      notification: {
        title: message.title,
        body: message.body,
        icon: message.icon || '/android-icon-192x192.png',
      },
      data: message.data || {},
      webpush: {
        notification: {
          title: message.title,
          body: message.body,
          icon: message.icon || '/android-icon-192x192.png',
          badge: message.badge || '/android-icon-96x96.png',
          image: message.image,
          requireInteraction: message.requireInteraction || false,
          tag: message.tag || 'inschoolz-notification',
          actions: message.actions || [
            {
              action: 'open',
              title: '확인하기'
            },
            {
              action: 'close',
              title: '닫기'
            }
          ]
        },
        fcm_options: {
          link: '/' // 클릭 시 이동할 URL
        }
      }
    };

    const messageId = await admin.messaging().send(fcmMessage);
    
    console.log('✅ [DEBUG] 웹 푸시 발송 성공:', messageId);
    return { success: true, messageId };

  } catch (error) {
    console.error('❌ [DEBUG] 웹 푸시 발송 실패:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * 통합 푸시 알림 발송 - 모든 플랫폼 지원
 */
export async function sendUnifiedPushNotification(
  userId: string,
  notificationType: NotificationType,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ success: boolean; error?: string; results?: any[] }> {
  try {
    console.log('🔄 [DEBUG] 통합 푸시 발송 시작:', { userId, notificationType, title });
    
    // 사용자의 푸시 토큰 가져오기
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      console.error('❌ [DEBUG] 사용자를 찾을 수 없음:', userId);
      return { success: false, error: 'User not found' };
    }

    const userData = userDoc.data();
    const pushTokens = userData.pushTokens;
    
    console.log('👤 [DEBUG] 사용자 정보:', { 
      userId, 
      userName: userData?.profile?.userName,
      hasPushTokens: !!pushTokens,
      availableTokens: pushTokens ? Object.keys(pushTokens) : []
    });

    if (!pushTokens || Object.keys(pushTokens).length === 0) {
      console.log('📱 [INFO] 푸시 토큰이 없음 (정상 - 토큰 미등록 사용자):', userId);
      
      // 개발 환경에서는 Mock 알림 로그 출력
      if (process.env.NODE_ENV === 'development') {
        console.log('🔔 [MOCK] 가상 푸시 알림 생성:', {
          userId,
          userName: userData?.profile?.userName,
          title,
          body,
          message: '실제 기기가 없어 푸시를 보낼 수 없지만, Firestore에는 알림이 저장되었습니다.',
          mockToken: 'ExponentPushToken[MOCK-TOKEN-FOR-DEVELOPMENT]'
        });
        
        return {
          success: true, // Mock에서는 성공으로 처리
          results: [{
            platform: 'mock',
            success: true,
            message: 'Mock push notification (development only)'
          }]
        };
      }
      
      return { 
        success: false, 
        error: 'No push tokens found - user may not have app installed or push permission denied' 
      };
    }

    const sendPromises: Promise<any>[] = [];
    const results: any[] = [];

    // 각 플랫폼별 토큰에 알림 발송
    for (const [platform, tokenData] of Object.entries(pushTokens)) {
      if (!tokenData || !(tokenData as any)?.token) {
        console.warn(`⚠️ [DEBUG] ${platform} 토큰이 유효하지 않음`);
        continue;
      }

      const token = (tokenData as any).token;
      console.log(`🚀 [DEBUG] ${platform} 토큰으로 발송 준비:`, token.substring(0, 30) + '...');

      if (platform === 'web') {
        // 웹 푸시 알림 발송
        const webMessage: WebPushMessage = {
          token,
          title,
          body,
          data: {
            type: notificationType,
            userId,
            ...data,
          },
          icon: '/android-icon-192x192.png',
          badge: '/android-icon-96x96.png',
          tag: 'inschoolz-notification',
          requireInteraction: false,
          actions: [
            {
              action: 'open',
              title: '확인하기'
            },
            {
              action: 'close',
              title: '닫기'
            }
          ]
        };

        sendPromises.push(
          sendWebPushNotification(webMessage).then(result => ({
            platform,
            ...result
          }))
        );
      } else {
        // Expo 푸시 알림 발송 (iOS/Android)
        const channelId = getChannelIdForNotificationType(notificationType);
        const expoMessage: ExpoMessage = {
          to: token,
          title,
          body,
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

        sendPromises.push(
          sendExpoPushNotification(expoMessage).then(result => ({
            platform,
            ...result
          }))
        );
      }
    }

    if (sendPromises.length === 0) {
      return { success: false, error: 'No valid push tokens found' };
    }

    // 모든 플랫폼에 발송
    const allResults = await Promise.allSettled(sendPromises);
    
    // 결과 처리
    let hasSuccess = false;
    const errors: string[] = [];

    for (const result of allResults) {
      if (result.status === 'fulfilled') {
        const platformResult = result.value;
        results.push(platformResult);
        
        if (platformResult.success) {
          hasSuccess = true;
          console.log(`✅ [DEBUG] ${platformResult.platform} 푸시 발송 성공`);
        } else {
          console.warn(`⚠️ [DEBUG] ${platformResult.platform} 푸시 발송 실패:`, platformResult.error);
          errors.push(`${platformResult.platform}: ${platformResult.error}`);
        }
      } else {
        console.error('❌ [DEBUG] 푸시 발송 중 예외:', result.reason);
        errors.push(`Exception: ${result.reason}`);
      }
    }

    if (hasSuccess) {
      console.log('✅ [DEBUG] 통합 푸시 발송 성공 (최소 하나 이상 성공)');
      return { success: true, results };
    } else {
      console.error('❌ [DEBUG] 모든 플랫폼 푸시 발송 실패');
      return { 
        success: false, 
        error: errors.join(', '), 
        results 
      };
    }

  } catch (error) {
    console.error('🚨 [DEBUG] 통합 푸시 발송 중 예외:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * 클라이언트에서 서버 API를 통해 푸시 알림 발송
 */
export async function sendPushNotificationToUser(
  userId: string,
  notificationType: NotificationType,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('🔄 [CLIENT] 서버 API를 통한 푸시 발송 요청:', { userId, notificationType, title });

    // 클라이언트에서는 서버 API 엔드포인트 호출
    const response = await fetch('/api/send-push-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        notificationType,
        title,
        body,
        data
      }),
    });

    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('✅ [CLIENT] 서버 API 푸시 발송 성공');
      return { success: true };
    } else {
      console.warn('⚠️ [CLIENT] 서버 API 푸시 발송 실패:', result.error);
      return { 
        success: false, 
        error: result.error || `HTTP ${response.status}` 
      };
    }
  } catch (error) {
    console.error('🚨 [CLIENT] 서버 API 호출 중 예외:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Network error' 
    };
  }
}

// 알림 타입별 채널 ID 매핑
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

/**
 * 직접 푸시 토큰으로 알림 발송 (테스트용)
 */
export async function sendDirectPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  // 클라이언트에서는 서버 API를 통해 발송
  try {
    const response = await fetch('/api/send-push-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: 'direct-token-test',
        notificationType: 'system',
        title,
        body,
        data: {
          ...data,
          directToken: expoPushToken
        }
      }),
    });

    const result = await response.json();
    
    if (response.ok && result.success) {
      return { success: true };
    } else {
      return { 
        success: false, 
        error: result.error || `HTTP ${response.status}` 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Network error' 
    };
  }
}

/**
 * 테스트 푸시 알림 발송 (관리자 도구용)
 */
export async function sendTestPushNotification(
  token: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  return sendDirectPushNotification(token, title, body, data);
}

/**
 * 웹에서 서버 측 푸시 알림을 발송하기 위한 유틸리티 함수들
 * 관리자 패널이나 백엔드 API에서 사용할 수 있습니다.
 */

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
  // 아이콘 설정
  icon?: string;
  // Android 특화 설정
  android?: {
    channelId?: string;
    sound?: boolean | string;
    priority?: 'min' | 'low' | 'default' | 'high' | 'max';
    vibrate?: boolean | number[];
    color?: string;
    icon?: string;
    largeIcon?: string;
  };
  // iOS 특화 설정
  ios?: {
    sound?: boolean | string;
    badge?: number;
    _displayInForeground?: boolean;
    attachments?: Array<{
      url: string;
      type?: string;
    }>;
  };
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
 * 단일 사용자에게 푸시 알림 발송 (웹에서 사용)
 */
export async function sendPushNotificationToUser(
  userId: string,
  notificationType: NotificationType,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('🔍 [DEBUG] 푸시 발송 시작:', { userId, notificationType, title });
    
    // 사용자의 푸시 토큰 가져오기
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      console.error('❌ [DEBUG] 사용자를 찾을 수 없음:', userId);
      return { success: false, error: 'User not found' };
    }

    const userData = userDoc.data();
    console.log('👤 [DEBUG] 사용자 정보:', { 
      userId, 
      userName: userData?.profile?.userName,
      hasPushTokens: !!userData.pushTokens 
    });
    
    const pushTokens = userData.pushTokens;

    if (!pushTokens) {
      console.error('❌ [DEBUG] 푸시 토큰이 없음:', userId);
      console.log('💡 [INFO] 해당 사용자는 앱을 설치하지 않았거나 푸시 권한을 허용하지 않았습니다.');
      console.log('💡 [INFO] 향후 개선: 웹 푸시 알림 또는 이메일 알림 시스템 구축 권장');
      return { success: false, error: 'No push tokens found - user may not have app installed or push permission denied' };
    }

    console.log('📊 [DEBUG] 푸시 토큰 개수:', Object.keys(pushTokens).length);
    Object.entries(pushTokens).forEach(([platform, tokenData]) => {
      console.log(`📱 [DEBUG] ${platform}:`, {
        hasToken: !!(tokenData as any)?.token,
        tokenPreview: (tokenData as any)?.token?.substring(0, 30) + '...'
      });
    });

    // 모든 플랫폼의 토큰에 알림 발송
    const sendPromises: Promise<any>[] = [];
    
    Object.entries(pushTokens).forEach(([platform, tokenData]: [string, any]) => {
      if (tokenData?.token) {
        console.log(`🚀 [DEBUG] ${platform} 토큰으로 발송 준비:`, tokenData.token.substring(0, 30) + '...');
        
        const channelId = getChannelIdForNotificationType(notificationType);
        const message: ExpoMessage = {
          to: tokenData.token,
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
          // 기본 아이콘 설정 (모든 플랫폼)
          icon: 'https://inschoolz.com/android-icon-96x96.png',
          // Android 특화 설정 - 화면 꺼져있을 때도 소리와 진동
          android: {
            channelId,
            sound: true,
            priority: 'high',
            vibrate: true,
            color: '#FF231F7C', // 인스쿨즈 브랜드 컬러
            icon: 'https://inschoolz.com/android-icon-96x96.png', // 작은 아이콘
            largeIcon: 'https://inschoolz.com/android-icon-192x192.png', // 큰 아이콘
          },
          // iOS 특화 설정 - 백그라운드에서도 소리
          ios: {
            sound: true,
            _displayInForeground: true,
            attachments: [{
              url: 'https://inschoolz.com/apple-icon-180x180.png',
              type: 'image'
            }],
          },
        };

        console.log(`📤 [DEBUG] ${platform} 메시지 준비 완료:`, { 
          to: tokenData.token.substring(0, 30) + '...', 
          title, 
          body,
          channelId 
        });
        
        sendPromises.push(sendExpoPushNotification(message));
      } else {
        console.warn(`⚠️ [DEBUG] ${platform} 토큰이 유효하지 않음:`, tokenData);
      }
    });

    if (sendPromises.length === 0) {
      console.error('❌ [DEBUG] 유효한 푸시 토큰이 없음');
      return { success: false, error: 'No valid push tokens found' };
    }

    console.log(`📊 [DEBUG] 총 ${sendPromises.length}개 토큰으로 발송 시작`);

    // 모든 토큰에 발송
    const results = await Promise.allSettled(sendPromises);
    
    console.log('📋 [DEBUG] 발송 결과 상세:');
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          console.log(`✅ [DEBUG] 토큰 ${index + 1}: 성공 -`, result.value.receipt?.data?.id || 'ID 없음');
        } else {
          console.error(`❌ [DEBUG] 토큰 ${index + 1}: 실패 -`, result.value.error);
        }
      } else {
        console.error(`🚨 [DEBUG] 토큰 ${index + 1}: 예외 -`, result.reason);
      }
    });
    
    // 최소 하나라도 성공하면 성공으로 처리
    const hasSuccess = results.some(result => 
      result.status === 'fulfilled' && result.value.success
    );

    if (hasSuccess) {
      console.log('✅ [DEBUG] 최종 결과: 성공');
      return { success: true };
    } else {
      const errors = results
        .filter(result => result.status === 'rejected' || !result.value.success)
        .map(result => 
          result.status === 'rejected' 
            ? result.reason 
            : result.value.error
        )
        .join(', ');
      
      console.error('❌ [DEBUG] 최종 결과: 실패 -', errors);
      return { success: false, error: errors };
    }
  } catch (error) {
    console.error('사용자 푸시 알림 발송 실패:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * 여러 사용자에게 동시에 푸시 알림 발송 (웹에서 사용)
 */
export async function sendPushNotificationToMultipleUsers(
  userIds: string[],
  notificationType: NotificationType,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{
  success: boolean;
  successCount: number;
  failureCount: number;
  errors: string[];
}> {
  const results = {
    success: true,
    successCount: 0,
    failureCount: 0,
    errors: [] as string[],
  };

  // 배치 크기 설정 (동시에 너무 많은 요청을 보내지 않도록)
  const batchSize = 10;
  
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    
    const batchPromises = batch.map(userId =>
      sendPushNotificationToUser(userId, notificationType, title, body, data)
        .then(result => ({ userId, ...result }))
        .catch(error => ({ userId, success: false, error: error.message }))
    );

    const batchResults = await Promise.allSettled(batchPromises);
    
    batchResults.forEach(result => {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          results.successCount++;
        } else {
          results.failureCount++;
          results.errors.push(`${result.value.userId}: ${result.value.error}`);
        }
      } else {
        results.failureCount++;
        results.errors.push(`Unknown user: ${result.reason}`);
      }
    });

    // 배치 간 짧은 딜레이
    if (i + batchSize < userIds.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  results.success = results.successCount > 0;
  return results;
}

/**
 * 알림 타입에 따른 Android 채널 ID 반환
 */
function getChannelIdForNotificationType(type: NotificationType): string {
  const channelMap: Record<NotificationType, string> = {
    post_comment: 'comments',      // 게시글 댓글
    comment_reply: 'comments',     // 댓글 대댓글
    system: 'system',              // 시스템 알림
    general: 'general',            // 일반 알림
    event: 'events',               // 이벤트 알림
    referral: 'social',            // 추천인 설정
    warning: 'warnings',           // 경고 조치
    suspension: 'warnings',        // 정지 조치
    report_received: 'reports',    // 신고 접수
    report_resolved: 'reports',    // 신고 처리
    like: 'social',                // 좋아요 (미구현)
    comment: 'comments',           // 댓글 (미구현)
    reply: 'comments',             // 답글 (미구현)
    follow: 'social',              // 팔로우 (미구현)
  };

  const channelId = channelMap[type] || 'default';
  console.log(`📱 [DEBUG] 알림 타입 ${type} → 채널 ${channelId}`);
  return channelId;
}

/**
 * 즉시 테스트 푸시 알림 발송 (개발/테스트용)
 */
export async function sendTestPushNotification(
  userId: string,
  title: string = '웹에서 보내는 테스트 알림',
  body: string = '웹 관리자 패널에서 발송된 푸시 알림입니다.'
): Promise<{ success: boolean; error?: string }> {
  return sendPushNotificationToUser(
    userId,
    'system',
    title,
    body,
    {
      test: true,
      source: 'web-admin',
      timestamp: Date.now(),
    }
  );
}

/**
 * 알림 설정에 따른 필터링
 */
export async function shouldSendNotificationToUser(
  userId: string,
  notificationType: NotificationType
): Promise<boolean> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return false;
    }

    const userData = userDoc.data();
    const notificationSettings = userData.notificationSettings || {};

    // 기본적으로 모든 알림 허용
    const defaultSettings = {
      post_comment: true,
      comment_reply: true,
      system: true,
      referral: true,
      warning: true,
      suspension: true,
      report_received: true,
      report_resolved: true,
    };

    const settings = { ...defaultSettings, ...notificationSettings };
    return settings[notificationType] !== false;
  } catch (error) {
    console.error('알림 설정 확인 실패:', error);
    // 에러가 발생하면 기본적으로 알림 허용
    return true;
  }
}

/**
 * 웹에서 사용할 수 있는 통합 알림 발송 함수
 */
export async function sendNotificationWithChecks(
  userId: string,
  notificationType: NotificationType,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  try {
    // 사용자가 해당 알림을 허용했는지 확인
    const shouldSend = await shouldSendNotificationToUser(userId, notificationType);
    
    if (!shouldSend) {
      return { success: true, skipped: true };
    }

    // 푸시 알림 발송
    return await sendPushNotificationToUser(userId, notificationType, title, body, data);
  } catch (error) {
    console.error('알림 발송 체크 실패:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * 직접 Expo Push Token으로 발송 (토큰을 직접 알고 있을 때)
 */
export async function sendDirectPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  const message: ExpoMessage = {
    to: expoPushToken,
    title,
    body,
    data: data || {},
    sound: 'default',
    priority: 'high',
    android: {
      channelId: 'default',
      sound: true,
      priority: 'high',
      vibrate: true,
      color: '#FF231F7C',
    },
    ios: {
      sound: true,
      _displayInForeground: true,
    },
  };

  const result = await sendExpoPushNotification(message);
  return {
    success: result.success,
    error: result.error,
  };
}

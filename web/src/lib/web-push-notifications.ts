import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Firebase 설정에서 VAPID 키 가져오기
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || 'BK8jJ5X9Y5Z6X5Z6X5Z6X5Z6X5Z6X5Z6X5Z6X5Z6X5Z6X5Z6X5Z6X5Z6X5Z6X5Z6X5Z6X5Z6X5Z6X5Z6X5Z6X5Z6X5Z6X5Z6X5Z6';

export interface WebPushToken {
  token: string;
  platform: 'web';
  deviceId: string;
  userAgent: string;
  createdAt: Date;
}

/**
 * 웹 푸시 알림 권한 요청 및 토큰 등록
 */
export async function registerWebPushNotifications(userId: string): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    // 브라우저 지원 확인
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { 
        success: false, 
        error: '이 브라우저는 푸시 알림을 지원하지 않습니다.' 
      };
    }

    // Service Worker 등록 확인
    const registration = await navigator.serviceWorker.ready;
    if (!registration) {
      return { 
        success: false, 
        error: 'Service Worker가 등록되지 않았습니다.' 
      };
    }

    // 푸시 알림 권한 요청
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { 
        success: false, 
        error: '푸시 알림 권한이 거부되었습니다.' 
      };
    }

    // Firebase Messaging 초기화
    const messaging = getMessaging();
    
    // FCM 토큰 가져오기
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    });

    if (!token) {
      return { 
        success: false, 
        error: '푸시 토큰을 가져올 수 없습니다.' 
      };
    }

    // 사용자 문서에 웹 푸시 토큰 저장
    await saveWebPushTokenToUser(userId, token);

    // 포그라운드 메시지 리스너 설정
    onMessage(messaging, (payload) => {
      console.log('포그라운드 메시지 수신:', payload);
      
      // 포그라운드에서도 알림 표시
      if (payload.notification) {
        const notificationTitle = payload.notification.title || '인스쿨즈';
        const notificationOptions = {
          body: payload.notification.body,
          icon: '/android-icon-192x192.png',
          badge: '/android-icon-96x96.png',
          tag: 'inschoolz-notification',
          data: payload.data,
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

        registration.showNotification(notificationTitle, notificationOptions);
      }
    });

    console.log('✅ 웹 푸시 알림 등록 성공:', token.substring(0, 20) + '...');
    return { success: true, token };

  } catch (error) {
    console.error('❌ 웹 푸시 알림 등록 실패:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '알 수 없는 오류' 
    };
  }
}

/**
 * 사용자 문서에 웹 푸시 토큰 저장
 */
async function saveWebPushTokenToUser(userId: string, token: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('사용자 문서가 존재하지 않습니다.');
    }

    const userData = userDoc.data();
    const existingPushTokens = userData.pushTokens || {};

    // 디바이스 정보 생성
    const deviceId = `web-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const webTokenData: WebPushToken = {
      token,
      platform: 'web',
      deviceId,
      userAgent: navigator.userAgent,
      createdAt: new Date(),
    };

    // 웹 푸시 토큰을 pushTokens에 추가
    const updatedPushTokens = {
      ...existingPushTokens,
      web: webTokenData,
    };

    await updateDoc(userRef, {
      pushTokens: updatedPushTokens,
      updatedAt: new Date(),
    });

    console.log('✅ 웹 푸시 토큰 저장 완료:', userId);
  } catch (error) {
    console.error('❌ 웹 푸시 토큰 저장 실패:', error);
    throw error;
  }
}

/**
 * 웹 푸시 토큰 제거 (로그아웃 시)
 */
export async function removeWebPushTokenFromUser(userId: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.warn('사용자 문서가 존재하지 않습니다:', userId);
      return;
    }

    const userData = userDoc.data();
    const pushTokens = userData.pushTokens || {};
    
    // 웹 푸시 토큰 제거
    delete pushTokens.web;

    await updateDoc(userRef, {
      pushTokens,
      updatedAt: new Date(),
    });

    console.log('✅ 웹 푸시 토큰 제거 완료:', userId);
  } catch (error) {
    console.error('❌ 웹 푸시 토큰 제거 실패:', error);
    throw error;
  }
}

/**
 * 웹 푸시 알림 권한 상태 확인
 */
export function getWebPushPermissionStatus(): NotificationPermission {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * 웹 푸시 알림 지원 여부 확인
 */
export function isWebPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

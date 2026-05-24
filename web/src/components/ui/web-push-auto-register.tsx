'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { registerWebPushNotifications, isWebPushSupported } from '@/lib/web-push-notifications';

/**
 * 웹 푸시 알림 자동 등록 컴포넌트
 * 로그인한 사용자에게 자동으로 웹 푸시 등록을 제안합니다.
 */
export function WebPushAutoRegister() {
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    // 로그인하지 않았거나 웹 푸시를 지원하지 않는 경우 스킵
    if (!isAuthenticated || !user || !isWebPushSupported()) {
      return;
    }

    // 이미 권한이 있는지 확인
    if (Notification.permission === 'granted') {
      // 이미 권한이 있다면 토큰을 등록해야 하는지 확인
      checkAndRegisterIfNeeded();
    } else if (Notification.permission === 'default') {
      // 권한을 요청한 적이 없다면 일정 시간 후 제안
      const timer = setTimeout(() => {
        promptForWebPushRegistration();
      }, 5000); // 5초 후 제안

      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user]);

  const checkAndRegisterIfNeeded = async () => {
    if (!user) return;

    try {
      // 사용자가 이미 웹 푸시 토큰을 가지고 있는지 확인하는 로직을 추가할 수 있습니다.
      // 여기서는 단순히 토큰 등록을 시도합니다.
      await registerWebPushNotifications(user.uid);
    } catch (error) {
      console.warn('자동 웹 푸시 등록 실패:', error);
    }
  };

  const promptForWebPushRegistration = () => {
    if (!user) return;

    // 사용자에게 푸시 알림 등록을 제안하는 토스트나 모달을 표시할 수 있습니다.
    // 여기서는 간단한 confirm으로 구현합니다.
    const shouldRegister = window.confirm(
      '인스쿨즈에서 실시간 알림을 받으시겠습니까?\n' +
      '댓글, 답글, 추천인 등록 등의 알림을 브라우저에서 받을 수 있습니다.'
    );

    if (shouldRegister) {
      registerWebPushNotifications(user.uid)
        .then((result) => {
          if (result.success) {
            // 성공 메시지를 표시할 수 있습니다.
            console.log('✅ 웹 푸시 알림이 활성화되었습니다!');
          } else {
            console.warn('⚠️ 웹 푸시 알림 등록 실패:', result.error);
          }
        })
        .catch((error) => {
          console.error('❌ 웹 푸시 등록 중 오류:', error);
        });
    }
  };

  // 이 컴포넌트는 UI를 렌더링하지 않습니다.
  return null;
}

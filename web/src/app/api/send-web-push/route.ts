import { NextRequest, NextResponse } from 'next/server';
import { sendWebPushNotification } from '@/lib/unified-push-notification-sender';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { NotificationType } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, notificationType, title, body: messageBody, data } = body;

    // 입력 값 검증
    if (!userId || !notificationType || !title || !messageBody) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 사용자의 웹 푸시 토큰 확인
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const webPushToken = userData.pushTokens?.web?.token;

    if (!webPushToken) {
      return NextResponse.json(
        { error: 'No web push token found for user' },
        { status: 404 }
      );
    }

    // 웹 푸시 알림 발송
    const result = await sendWebPushNotification({
      token: webPushToken,
      title,
      body: messageBody,
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
    });

    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        messageId: result.messageId 
      });
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('웹 푸시 API 오류:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

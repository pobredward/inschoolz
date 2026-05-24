// Firebase Admin SDK 초기화 (서버 사이드 전용)
import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    // 환경 변수에서 서비스 계정 키 가져오기
    const serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });

    console.log('✅ Firebase Admin SDK 초기화 완료');
  } catch (error) {
    console.error('❌ Firebase Admin SDK 초기화 실패:', error);
  }
}

export { admin };

// Lazily get admin.messaging() to avoid initialization errors during import time in some envs
export const messaging = admin.messaging();
export const firestore = admin.firestore();

// Compatibility helpers for existing routes expecting factory-style getters
export const adminFirestore = () => admin.firestore();
export const adminAuth = () => admin.auth();
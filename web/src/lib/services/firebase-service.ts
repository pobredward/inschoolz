import * as admin from 'firebase-admin';

/**
 * Firebase Admin SDK 통합 서비스
 * 모든 서비스에서 공통으로 사용하는 Firebase 초기화 및 유틸리티
 */
export class FirebaseService {
  private static instance: FirebaseService;
  private admin: typeof admin;

  private constructor() {
    this.admin = admin;
    this.initializeFirebaseAdmin();
  }

  public static getInstance(): FirebaseService {
    if (!FirebaseService.instance) {
      FirebaseService.instance = new FirebaseService();
    }
    return FirebaseService.instance;
  }

  /**
   * Firebase Admin SDK 초기화
   */
  private initializeFirebaseAdmin() {
    if (this.admin.apps.length === 0) {
      try {
        // 환경변수에서 서비스 계정 정보 가져오기
        const serviceAccount = {
          type: 'service_account',
          project_id: process.env.FIREBASE_PROJECT_ID,
          private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
          private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          client_email: process.env.FIREBASE_CLIENT_EMAIL,
          client_id: process.env.FIREBASE_CLIENT_ID,
          auth_uri: 'https://accounts.google.com/o/oauth2/auth',
          token_uri: 'https://oauth2.googleapis.com/token',
          auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
          client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL?.replace('@', '%40')}`,
          universe_domain: 'googleapis.com'
        };

        this.admin.initializeApp({
          credential: this.admin.credential.cert(serviceAccount as admin.ServiceAccount),
          databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://inschoolz-default-rtdb.asia-southeast1.firebasedatabase.app'
        });

        console.log('✅ Firebase Admin SDK 초기화 완료');
      } catch (error) {
        console.error('❌ Firebase Admin 초기화 오류:', error);
        throw error;
      }
    }
  }

  /**
   * Firestore 인스턴스 반환
   */
  public getFirestore(): admin.firestore.Firestore {
    return this.admin.firestore();
  }

  /**
   * FieldValue 반환 (서버 타임스탬프 등)
   */
  public getFieldValue(): typeof admin.firestore.FieldValue {
    return this.admin.firestore.FieldValue;
  }

  /**
   * Admin 인스턴스 반환
   */
  public getAdmin(): typeof admin {
    return this.admin;
  }

  /**
   * Firebase 스타일 UID 생성 (28자 영숫자)
   */
  public generateFirebaseStyleUID(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < 28; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }

  /**
   * UID 중복 확인
   */
  public async isUIDUnique(uid: string): Promise<boolean> {
    try {
      const userDoc = await this.getFirestore().collection('users').doc(uid).get();
      return !userDoc.exists;
    } catch (error) {
      console.error('UID 중복 확인 실패:', error);
      return false;
    }
  }

  /**
   * 고유한 Firebase 스타일 UID 생성
   */
  public async generateUniqueFirebaseUID(): Promise<string> {
    let attempts = 0;
    let uid: string;
    
    do {
      uid = this.generateFirebaseStyleUID();
      attempts++;
      
      if (attempts > 10) {
        throw new Error('고유한 UID 생성에 실패했습니다.');
      }
    } while (!(await this.isUIDUnique(uid)));
    
    return uid;
  }

  /**
   * 배치 작업 도우미
   */
  public async executeBatch<T>(
    items: T[],
    batchSize: number,
    processor: (batch: T[]) => Promise<void>,
    onProgress?: (processed: number, total: number) => void
  ): Promise<void> {
    const total = items.length;
    let processed = 0;

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      await processor(batch);
      processed += batch.length;
      
      if (onProgress) {
        onProgress(Math.min(processed, total), total);
      }

      // API 부하 방지를 위한 딜레이
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }
}

export default FirebaseService;

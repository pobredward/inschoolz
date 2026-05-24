import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { v4 as uuidv4 } from 'uuid';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Firebase 앱 초기화 (SSR 환경에서 중복 초기화 방지)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

// Firebase Auth 지속성 설정 (브라우저 환경에서만 실행)
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence)
    .then(() => {
      console.log('✅ Firebase Auth 지속성 설정 완료 (LocalStorage)');
    })
    .catch((error) => {
      console.warn('⚠️ Firebase Auth 지속성 설정 실패:', error);
    });
}

// 클라이언트 측 분석 설정 (SSR 환경에서는 실행되지 않음)
let analytics = null;
if (typeof window !== 'undefined') {
  // 브라우저 환경에서만 실행
  isSupported().then(yes => yes && (analytics = getAnalytics(app)));
}

// 이미지 업로드 함수
export const uploadImage = async (file: File): Promise<string> => {
  try {
    // 파일 크기 검증 (10MB 제한)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('이미지 크기는 10MB 이하여야 합니다.');
    }

    // 파일 형식 검증
    const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error('JPG, PNG, GIF, WebP 형식의 이미지만 업로드 가능합니다.');
    }

    const fileName = `${uuidv4()}_${file.name}`;
    const storageRef = ref(storage, `images/${fileName}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
      // 타임아웃 설정 (30초)
      const timeoutId = setTimeout(() => {
        uploadTask.cancel();
        reject(new Error('업로드 시간이 초과되었습니다. 다시 시도해주세요.'));
      }, 30000);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // 업로드 진행 상태 관리 (필요시 구현)
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`Upload progress: ${progress}%`);
        },
        (error) => {
          clearTimeout(timeoutId);
          console.error('Upload error:', error);
          
          // Firebase Storage 에러 메시지 변환
          let errorMessage = '이미지 업로드에 실패했습니다.';
          if (error.code === 'storage/unauthorized') {
            errorMessage = '업로드 권한이 없습니다. 로그인을 확인해주세요.';
          } else if (error.code === 'storage/canceled') {
            errorMessage = '업로드가 취소되었습니다.';
          } else if (error.code === 'storage/quota-exceeded') {
            errorMessage = '저장 공간이 부족합니다. 관리자에게 문의해주세요.';
          } else if (error.code === 'storage/retry-limit-exceeded') {
            errorMessage = '업로드 재시도 횟수를 초과했습니다. 인터넷 연결을 확인해주세요.';
          }
          
          reject(new Error(errorMessage));
        },
        async () => {
          clearTimeout(timeoutId);
          try {
            // 업로드 완료 후 URL 획득
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          } catch (error) {
            reject(new Error('다운로드 URL을 가져오는데 실패했습니다.'));
          }
        }
      );
    });
  } catch (error) {
    console.error('이미지 업로드 실패:', error);
    throw error;
  }
};

export { app, db, storage, auth, analytics }; 
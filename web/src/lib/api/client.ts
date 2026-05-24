import axios, { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { getAuth } from 'firebase/auth';

// API 기본 설정
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.inschoolz.com';

// axios 인스턴스 생성
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터 설정
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (user) {
      try {
        // 토큰이 만료되었을 가능성이 있으므로 강제 새로고침 시도
        const token = await user.getIdToken(false); // 캐시된 토큰 사용, 만료시 자동 갱신
        if (config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        console.log('🔑 API 요청에 토큰 추가됨');
      } catch (error) {
        console.error('❌ API 토큰 획득 실패:', error);
      }
    }
    
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터 설정
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error: AxiosError) => {
    // 에러 처리 로직
    if (error.response) {
      // 서버 응답이 있는 에러 (4xx, 5xx 상태 코드)
      console.error('API 오류:', error.response.data);
      
      // 401 Unauthorized 에러 처리 - 토큰 재발급 시도
      if (error.response.status === 401) {
        const auth = getAuth();
        const user = auth.currentUser;
        
        if (user) {
          try {
            console.log('🔄 401 오류 감지, 토큰 재발급 시도');
            const newToken = await user.getIdToken(true); // 강제 새로고침
            
            // 원래 요청을 재시도
            if (error.config) {
              error.config.headers = error.config.headers || {};
              error.config.headers.Authorization = `Bearer ${newToken}`;
              console.log('🔃 토큰 갱신 후 요청 재시도');
              return apiClient.request(error.config);
            }
          } catch (refreshError) {
            console.error('❌ 토큰 재발급 실패:', refreshError);
            // 토큰 재발급도 실패한 경우 로그인 페이지로 리다이렉트
            window.location.href = '/login';
          }
        } else {
          // 사용자가 없는 경우 로그인 페이지로 리다이렉트
          window.location.href = '/login';
        }
      }
    } else if (error.request) {
      // 서버로 요청이 전송되었으나 응답이 없는 경우
      console.error('응답 없음:', error.request);
    } else {
      // 요청 설정 중 에러 발생
      console.error('요청 오류:', error.message);
    }
    
    return Promise.reject(error);
  }
);

export default apiClient; 
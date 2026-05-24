# Inschoolz Web Application

Inschoolz의 Next.js 웹 애플리케이션입니다.

## 🚀 기술 스택

- **Next.js**: 15.1.6
- **React**: 19.0.0
- **TypeScript**: 5.8.3
- **Firebase**: 11.10.0
- **Tailwind CSS**: 3.4.1
- **Shadcn UI**: 컴포넌트 라이브러리
- **Zustand**: 상태 관리
- **React Query**: 서버 상태 관리

## 🌐 주요 기능

- **3계층 커뮤니티**: 학교, 지역, 전국 커뮤니티
- **서버사이드 렌더링 (SSR)**: SEO 최적화
- **실시간 업데이트**: Firebase 실시간 리스너
- **경험치 시스템**: 활동 기반 레벨업
- **미니게임**: 반응속도, 타일 맞추기 등
- **관리자 대시보드**: 사용자 및 콘텐츠 관리

## 🛠️ 개발 환경 설정

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수 설정
`.env.local` 파일을 생성하고 Firebase 설정을 추가하세요:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Firebase Admin SDK (서버사이드)
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=your_client_email
FIREBASE_ADMIN_PRIVATE_KEY=your_private_key
```

### 3. 개발 서버 실행
```bash
npm run dev
```

### 4. 빌드 및 배포
```bash
# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm start

# 린팅
npm run lint
```

## 📂 프로젝트 구조

```
inschoolz-web/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── community/         # 커뮤니티 페이지
│   │   ├── auth/              # 인증 관련 페이지
│   │   ├── admin/             # 관리자 페이지
│   │   └── api/               # API 라우트
│   ├── components/            # 재사용 가능한 컴포넌트
│   │   ├── ui/                # Shadcn UI 컴포넌트
│   │   ├── board/             # 게시판 관련 컴포넌트
│   │   └── layout/            # 레이아웃 컴포넌트
│   ├── lib/                   # 유틸리티 및 API
│   ├── store/                 # 상태 관리 (Zustand)
│   ├── types/                 # TypeScript 타입 정의
│   └── providers/             # Context Providers
├── public/                    # 정적 파일
└── components.json            # Shadcn UI 설정
```

## 🎨 디자인 시스템

- **컬러**: 파스텔 그린 계열
- **폰트**: 잼민이 스타일 (귀여운 손글씨)
- **UI 프레임워크**: Tailwind CSS + Shadcn UI
- **반응형**: 모바일 퍼스트 디자인

## 📋 주요 스크립트

- `npm run dev`: 개발 서버 시작
- `npm run build`: 프로덕션 빌드
- `npm start`: 프로덕션 서버 실행
- `npm run lint`: 코드 린팅
- `npm run type-check`: TypeScript 타입 검사

## 🌍 배포

### Vercel 배포 (권장)
```bash
# Vercel CLI 설치
npm install -g vercel

# 배포
vercel --prod
```

### 환경 변수 설정
Vercel 대시보드에서 다음 환경 변수를 설정하세요:
- `NEXT_PUBLIC_FIREBASE_*`: Firebase 클라이언트 설정
- `FIREBASE_ADMIN_*`: Firebase Admin SDK 설정

## 🔍 SEO 최적화

- **메타 태그**: 동적 메타 태그 생성
- **Open Graph**: SNS 공유 최적화
- **구조화 데이터**: JSON-LD 스키마
- **사이트맵**: 자동 생성
- **로봇 텍스트**: 크롤링 제어

## 🚀 성능 최적화

- **이미지 최적화**: Next.js Image 컴포넌트
- **코드 분할**: 동적 import
- **캐싱**: React Query + Firebase 캐싱
- **번들 분석**: `npm run analyze`

## 📱 반응형 지원

- **모바일**: 320px+
- **태블릿**: 768px+
- **데스크톱**: 1024px+
- **와이드**: 1440px+

## 🔐 보안

- **Firebase Security Rules**: 데이터 접근 제어
- **CSP**: Content Security Policy
- **CORS**: Cross-Origin Resource Sharing
- **XSS 방지**: 입력 검증 및 이스케이핑

## 🤝 기여하기

1. 이 저장소를 포크하세요
2. 새로운 기능 브랜치를 만드세요 (`git checkout -b feature/AmazingFeature`)
3. 변경사항을 커밋하세요 (`git commit -m 'Add some AmazingFeature'`)
4. 브랜치에 푸시하세요 (`git push origin feature/AmazingFeature`)
5. Pull Request를 생성하세요

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 🌟 주요 특징

- **SSR/SSG**: 검색 엔진 최적화
- **실시간 업데이트**: Firebase 실시간 리스너
- **PWA 지원**: 오프라인 기능 (예정)
- **다크 모드**: 사용자 선호도 기반 테마
- **접근성**: WCAG 2.1 AA 준수

---

**Inschoolz** - 학생들을 위한 안전하고 재미있는 커뮤니티 플랫폼
# Git sync test for web

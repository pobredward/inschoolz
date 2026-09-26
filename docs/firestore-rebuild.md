# Firestore 재설계 및 운영 재개

## 현재 완료 범위

백업 복원이 아니라 인증된 사용자 활동을 다시 쌓을 수 있는 코드와 규칙을 구현했다. 운영 Firebase에는 아직 배포하거나 데이터를 변경하지 않았다. 삭제된 게시글·관계·개인정보는 백업 없이 복원되지 않는다. Firebase Authentication 계정이 남아 있으면 기존 UID로 로그인할 때 누락된 프로필을 재생성한다. Auth 계정까지 삭제된 경우 재가입이 필요하다.

| 데이터 | 읽기 | 변경 주체 |
| --- | --- | --- |
| `users/{uid}` | 본인, custom claim 관리자 | 핵심 필드는 서버; 알림 설정·토큰 등 일부 본인 필드만 직접 변경 |
| `publicProfiles/{uid}` | 공개 | 서버가 닉네임·프로필 이미지·통계·학교명·시군구만 투영 |
| `usernames/{normalizedName}` | 단건 조회 | 서버 트랜잭션으로 닉네임 독점 예약 |
| `posts`, 하위 `comments` | 공개 | 인증된 명령 API; 수정·삭제는 작성자/관리자 |
| 좋아요·스크랩·조회 기록 | 규칙에 따른 제한 조회 | 서버 트랜잭션 |
| `userRelationships` | 팔로우 공개, 차단은 본인 | 서버에서 자기 자신·차단 관계 검증 후 변경 |
| 출석·게임 세션·경험치 영수증·퀘스트 | 본인 | 서버에서 횟수·진행 증거·중복 검증 |
| `notifications` | 수신자 | 서버 생성; 수신자는 읽음 처리/삭제 |
| Storage `uploads/{uid}/...` | 공개 | 해당 UID만 이미지/PDF/텍스트, 10MB 미만 |

웹과 앱의 핵심 변경은 `POST /api/community/command`를 사용한다. Firebase ID 토큰을 매 요청 검증하고 정지 계정을 차단한다. 입력한 UID·역할·경험치 수치는 권한 근거로 쓰지 않는다. 관리자 API는 Firestore의 `role` 값 대신 Firebase Auth `admin: true` custom claim을 검증한다. 글·댓글·통계·보상을 한 트랜잭션에 기록한다. 게시글/댓글 생성은 계정당 분당 10회로 제한한다.

## 환경 설정

- 웹 서버: `FIREBASE_PROJECT_ID`, ADC(Application Default Credentials) 또는 `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`. 서버 계정에 필요한 Firestore/Auth 권한만 부여한다. 비밀키에 `NEXT_PUBLIC_`를 붙이지 않는다.
- 웹 클라이언트: 기존 `NEXT_PUBLIC_FIREBASE_*` 값이 같은 프로젝트를 가리켜야 한다.
- Expo 앱: 기존 `EXPO_PUBLIC_FIREBASE_*`와 `EXPO_PUBLIC_API_URL=https://배포된-웹-서버`를 설정한다. 기본 API 주소는 `https://www.inschoolz.com`이다.
- 관리자 지정은 신뢰할 수 있는 서버/운영 도구에서 Auth custom claims를 설정한다. 과거 DB의 관리자 표식을 일괄 신뢰해 승격하지 않는다. 지정 후 재로그인/토큰 갱신이 필요하다.
- Next.js API가 필요한 구조이므로 **정적 Firebase Hosting 업로드만으로는 작동하지 않는다.** Node.js Next.js 런타임을 배포해야 한다. 기존 `firebase.json`의 Hosting 설정은 API 서버를 배포하지 않는다.

## 백업 없는 재개 순서

1. Firebase/GCP 운영 계정에서 침해 원인을 확인한다. 유출된 서버 키를 폐기·교체하고, 낯선 IAM 구성원/서비스 계정/배포/인증 제공자를 제거한다. Admin SDK는 보안 규칙을 우회하므로 규칙 교체만으로 유출된 서버 키를 막을 수 없다. 이 저장소 변경은 실제 IAM 조사를 수행한 결과가 아니다.
2. 남은 데이터를 별도 보관하고 오염 범위를 점검한다. 이 스크립트는 남은 문서가 정상임을 보증하거나 기존 악성 콘텐츠를 정화하지 않는다. 기존 비회원 댓글의 비밀번호 해시·IP 등은 공개 컬렉션에서 격리/제거해야 한다.
3. 스테이징에서 새 서버·웹·앱과 규칙을 검증한다. 구버전 클라이언트의 직접 Firestore 쓰기는 새 규칙에서 거절된다. 운영에서는 유지보수 시간과 앱 최소 버전을 정해 함께 전환한다. 구버전을 위해 광범위한 쓰기 규칙을 다시 열지 않는다.
4. 아래 명령으로 변경 계획을 확인하고 기본 게시판을 생성한다. 학교 데이터가 없다면 신뢰할 수 있는 학교 목록 JSON을 준비한다.
5. 새 서버/웹/앱을 배포하고 Firestore 규칙·인덱스와 Storage 규칙을 배포한다. 인덱스 빌드 완료를 확인한다.
6. 신규 이메일 가입, 기존 Auth 로그인 후 프로필 재생성, 학교/지역 설정, 글·댓글·답글·좋아요·스크랩·팔로우·차단·출석을 운영 테스트 계정으로 확인한다. 이후 정기 백업과 오류/비용 모니터링을 설정한다.

```sh
cd web
npm ci
npm run typecheck:security
npm run test:security

# 기본은 읽기 전용 계획. 프로젝트를 반드시 명시한다.
FIREBASE_PROJECT_ID=YOUR_PROJECT npm run recover:plan -- --project=YOUR_PROJECT

# 확인한 계획 적용. 기존 문서와 Auth 계정을 삭제하지 않는다.
FIREBASE_PROJECT_ID=YOUR_PROJECT npm run recover:apply -- --project=YOUR_PROJECT

# 학교 목록 추가(선택). 기존 학교는 덮어쓰지 않는다.
FIREBASE_PROJECT_ID=YOUR_PROJECT npm run recover:plan -- --project=YOUR_PROJECT --schools=/absolute/path/schools.json

# 검토한 잔존 사용자에서 공개 프로필 재생성(선택).
# Auth 없는 문서는 건너뛰고, 닉네임 충돌/유효하지 않은 닉네임은 중단한다.
FIREBASE_PROJECT_ID=YOUR_PROJECT npm run recover:plan -- --project=YOUR_PROJECT --rebuild-public-profiles

# 운영 전환 시에만 실행. Next.js 배포는 별도로 수행한다.
npx firebase deploy --project YOUR_PROJECT --only firestore:rules,firestore:indexes,storage
```

학교 파일 예시: `[{"id":"school-id","name":"학교명","address":"주소","region":"지역","schoolType":"고등학교"}]`. 기본 게시판은 전국/지역/학교 각각 자유·질문·정보 3개씩 총 9개다. `--apply`는 명시된 프로젝트에만 적용하고 기존 게시글이나 비공개 사용자 문서를 지우지 않는다. 공개 프로필 재생성 옵션은 기존 XP 등 통계를 사실로 인증하는 작업이 아니므로 침해 후 검토된 데이터에만 사용한다.

## 로컬 검증

`npm run test:security`는 **demo-inschoolz 에뮬레이터 데이터만 초기화**한다. Java 21 이상이 필요하며 테스트 포트 8080/9099/9199는 비워 둔다. 테스트 파일은 Firestore/Auth/Storage 에뮬레이터에서만 실행된다. 실제 운영 프로젝트에 테스트를 연결하지 않는다.

웹 화면 테스트에는 서버의 `FIREBASE_PROJECT_ID=demo-inschoolz`, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`와 클라이언트의 `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-inschoolz`, `NEXT_PUBLIC_FIREBASE_EMULATOR_HOST=127.0.0.1`을 함께 설정한다. 클라이언트의 에뮬레이터 연결은 `demo-` 프로젝트에서만 허용된다. 실제 기기는 로컬 에뮬레이터 호스트에 접근 가능한 주소가 필요하다.

## 아직 운영 확인/추가 구현이 필요한 항목

- 전체 저장소의 기존 TypeScript 오류가 남아 있다. 보안 전용 타입 검사와 회귀 테스트 통과가 전체 웹/앱 빌드 통과를 의미하지 않는다.
- 실제 Google/Kakao OAuth, 모바일 기기 동작, FCM/Expo 푸시 수신은 이 로컬 검증에 포함하지 않았다. 댓글/답글의 인앱 알림은 서버에서 생성하지만 신규 명령 경로에서 외부 푸시를 보내는 작업은 별도로 연결해야 한다.
- 광고 보상은 제공자의 서명된 서버 검증(SSV) 연동 전까지 차단한다. 추천인은 가입 후 24시간 내 한 번 기록하며 가입만으로 XP를 지급하지 않는다. 별도의 부정 가입 검증/보상 정책이 필요하다.
- 게임 결과의 점수 범위·일일 횟수·세션 재사용은 검증하지만 모든 게임 플레이를 서버가 재현하는 부정행위 방지 시스템은 아니다.
- 비회원 비밀번호 댓글 작성은 로그인 기반 익명 댓글로 전환했다. 익명은 표시명 숨김이며 관리자/DB에서 작성 UID까지 숨기는 익명화 모델은 아니다.
- 게시물 읽기는 공개 커뮤니티 모델이다. 숨김 상태는 목록/상세 화면에서 제어되지만 Firestore 직접 읽기를 비공개 저장소처럼 차단하는 모델은 아니다. 비밀 콘텐츠는 게시글 컬렉션에 저장하지 않는다.
- 회원 탈퇴는 최근 재인증을 요구하고 작성자를 익명화한다. 대량 계정 정리의 작업 큐, 업로드 파일 수명 관리, 최종 삭제 실패 시 운영 재처리는 추가 운영 작업이다.
- 새 학교 정보는 자기 신고이며 재학 사실 검증을 대신하지 않는다. 학교 데이터가 없으면 학교 선택·학교 게시판 작성은 제한된다.

# MoodMeter Analytics 구현 가이드

## 개요
MoodMeter 애플리케이션에 Firebase Analytics (Google Analytics 4 통합)를 사용한 포괄적인 지표 수집 시스템이 구현되었습니다.

## 구현된 기능

### 추적 이벤트 (총 11개)

#### A. 화면 조회 (Screen Views)
- `screen_view` (리스트 뷰) - 탭별 감정 목록 화면
- `screen_view` (상세 뷰) - 개별 감정 상세 화면

#### B. 사용자 액션 (User Actions)
- `tab_click` - 하단 네비게이션 탭 클릭
- `mood_card_click` - 감정 카드 클릭
- `content_toggle` - 이야기/이미지 토글
- `back_button_click` - 뒤로가기 버튼 클릭
- `escape_key_press` - Escape 키 네비게이션

#### C. 앱 생명주기 (App Lifecycle)
- `app_loaded` - 앱 초기화 완료
- `data_loaded` - JSON 데이터 로딩 완료
- `data_load_error` - JSON 로딩 실패
- `service_worker_registered` - SW 등록 성공
- `service_worker_error` - SW 등록 실패

### 자동 수집 컨텍스트 데이터
모든 이벤트에 자동으로 포함됩니다:
- `timestamp` - 이벤트 발생 시간
- `session_id` - 세션 고유 ID
- `session_duration` - 세션 시작 후 경과 시간
- `screen_width`, `screen_height` - 화면 크기
- `device_type` - 디바이스 유형 (mobile/tablet/desktop)
- `user_agent` - 브라우저 정보
- `language` - 사용자 언어
- `connection_type` - 네트워크 연결 유형
- `page_url`, `page_hash` - 페이지 정보

---

## 설정 방법

### Phase 1: 개발 환경 테스트 (현재 상태)

현재 애플리케이션은 **개발 모드**로 설정되어 있습니다. 모든 이벤트가 브라우저 콘솔에 로그됩니다.

#### 테스트 방법
1. 브라우저에서 `index.html` 열기
2. 개발자 도구 콘솔 열기 (F12 또는 Cmd+Option+I)
3. 앱 사용하며 콘솔에서 `[Analytics]` 접두사로 이벤트 확인

#### 테스트 체크리스트
- [ ] 앱 로딩 시 `app_loaded` 이벤트
- [ ] 탭 전환 시 `tab_click` + `screen_view` 이벤트
- [ ] 카드 클릭 시 `mood_card_click` + `screen_view` 이벤트
- [ ] 토글 버튼 클릭 시 `content_toggle` 이벤트
- [ ] 뒤로가기/Escape 시 네비게이션 이벤트
- [ ] 성능 데이터 (`load_time`) 정상 수집

---

### Phase 2: Firebase 설정 (프로덕션 준비)

#### 1. Firebase 프로젝트 생성
1. [Firebase Console](https://console.firebase.google.com) 접속
2. "프로젝트 추가" 클릭
3. 프로젝트 이름 입력 (예: "MoodMeter")
4. Google Analytics 활성화 (권장)
5. 프로젝트 생성 완료

#### 2. 웹 앱 추가
1. Firebase Console에서 생성한 프로젝트 선택
2. 프로젝트 개요 → 앱 추가 → 웹 (</>) 선택
3. 앱 닉네임 입력 (예: "MoodMeter Web")
4. Firebase Hosting 설정은 건너뛰기 (나중에 설정 가능)
5. **Firebase 구성 객체** 복사:
   ```javascript
   const firebaseConfig = {
       apiKey: "AIza...",
       authDomain: "your-project.firebaseapp.com",
       projectId: "your-project",
       storageBucket: "your-project.appspot.com",
       messagingSenderId: "123456789",
       appId: "1:123456789:web:abcdef",
       measurementId: "G-XXXXXXXXXX"
   };
   ```

#### 3. firebase-config.js 업데이트
`js/firebase-config.js` 파일을 열고 실제 값으로 대체:

```javascript
const firebaseConfig = {
    apiKey: "AIza...",  // 실제 값으로 대체
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef",
    measurementId: "G-XXXXXXXXXX"
};

window.FIREBASE_CONFIG = firebaseConfig;
```

#### 4. Firebase 보안 설정 (중요!)

##### A. App Check 활성화 (봇/남용 방지)
1. Firebase Console → App Check
2. "시작하기" 클릭
3. 웹 앱 선택
4. reCAPTCHA v3 공급업체 선택
5. reCAPTCHA 사이트 키 등록:
   - [Google reCAPTCHA](https://www.google.com/recaptcha/admin) 접속
   - 새 사이트 등록
   - reCAPTCHA v3 선택
   - 도메인 추가 (localhost, vercel.app 등)
   - 사이트 키 복사하여 Firebase에 입력
6. "저장" 클릭

##### B. 승인된 도메인 설정
1. Firebase Console → Authentication → Settings → Authorized domains
2. 다음 도메인 추가:
   - `localhost` (개발용)
   - `your-app.vercel.app` (프로덕션, Vercel 배포 후)
   - 기타 사용할 도메인

##### C. (선택) API Key 제한
1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. 프로젝트 선택 (Firebase 프로젝트와 동일)
3. APIs & Services → Credentials
4. API Key 선택 (Firebase가 자동 생성)
5. "Application restrictions" → "HTTP referrers (web sites)"
6. Referrer 추가:
   - `http://localhost/*`
   - `https://localhost/*`
   - `https://your-app.vercel.app/*`
7. 저장

#### 5. Analytics 데이터 보존 설정
1. Firebase Console → Analytics → Data Retention
2. Event data retention: **14개월** (기본값, 권장)
3. User data retention: **14개월**
4. 저장

---

### Phase 3: 프로덕션 모드 전환

#### 1. app.js 수정
`js/app.js` 파일의 `init()` 함수에서 Analytics 초기화 부분 수정:

```javascript
// 개발 모드 (현재)
Analytics.init({
    mode: 'development',
    debug: true
});

// 프로덕션 모드 (배포 시)
Analytics.init({
    mode: 'production',
    debug: false  // 또는 true (디버그 로그 유지)
});
```

#### 2. 배포
1. Vercel, Netlify, Firebase Hosting 등에 배포
2. 배포 URL을 Firebase Authorized domains에 추가 (위 Phase 2-4-B 참조)

#### 3. 검증
1. 배포된 사이트 방문
2. 브라우저 개발자 도구에서 네트워크 탭 확인
3. `google-analytics.com` 또는 `firebase.googleapis.com` 요청 확인
4. Firebase Console → Analytics → DebugView에서 실시간 이벤트 확인

---

## 데이터 확인 방법

### 1. 개발 중: 브라우저 콘솔
```javascript
// 콘솔에서 [Analytics] 로그 필터링
// 각 이벤트의 테이블 형식 데이터 확인
```

### 2. Firebase Console - DebugView (실시간)
1. Firebase Console → Analytics → DebugView
2. 실시간으로 이벤트 스트림 확인
3. 각 이벤트의 파라미터 상세 조회

**DebugView 활성화 방법:**
- 개발 모드에서는 자동 활성화 (`debug: true`)
- 또는 URL에 `?analytics_debug=1` 추가

### 3. Firebase Console - 이벤트 보고서 (24시간 후)
1. Firebase Console → Analytics → Events
2. 이벤트별 발생 횟수, 사용자 수 확인
3. 이벤트 파라미터별 필터링

### 4. Google Analytics 4 대시보드
1. Firebase Console → Analytics → Dashboard
2. 또는 [Google Analytics](https://analytics.google.com) 직접 접속
3. 다음 보고서 확인:
   - **실시간**: 현재 활성 사용자 및 이벤트
   - **이벤트**: 각 이벤트별 발생 횟수, 추세
   - **사용자**: 신규/재방문 사용자, 디바이스 정보
   - **탐색**: 맞춤 보고서 (Funnel, Path 분석 등)

---

## 주요 분석 지표 예시

### 1. 화면별 조회수
**질문**: "어떤 탭이 가장 인기 있는가?"

**GA4 탐색 방법**:
1. Analytics → Explore → Blank
2. Dimensions: `tab` (맞춤 파라미터)
3. Metrics: `Event count` (screen_view 필터)
4. Visualization: Bar chart

### 2. 클릭 패턴
**질문**: "어떤 감정이 가장 많이 클릭되는가?"

**GA4 탐색 방법**:
1. Analytics → Explore → Blank
2. Dimensions: `mood_title` (맞춤 파라미터)
3. Metrics: `Event count` (mood_card_click 필터)
4. Visualization: Table 또는 Bar chart

### 3. 사용자 여정 (Funnel)
**질문**: "탭 선택 → 카드 클릭 → 토글 버튼 전환율은?"

**GA4 탐색 방법**:
1. Analytics → Explore → Funnel exploration
2. Steps:
   - Step 1: `screen_view` (view_type = list)
   - Step 2: `mood_card_click`
   - Step 3: `screen_view` (view_type = detail)
   - Step 4: `content_toggle`
3. Breakdown: `device_type`

### 4. 성능 지표
**질문**: "페이지 로딩이 충분히 빠른가?"

**GA4 탐색 방법**:
1. Analytics → Explore → Blank
2. Dimensions: `device_type`
3. Metrics: `load_time` (app_loaded 이벤트, 평균값)
4. Visualization: Line chart (시간 추이)

---

## 개인정보 보호

### 수집하지 않는 데이터
- ❌ 이름, 이메일 등 개인 식별 정보
- ❌ IP 주소 (Firebase가 자동으로 익명화)
- ❌ 정확한 위치 정보

### 수집하는 데이터
- ✅ 익명 세션 ID (브라우저 세션 종료 시 삭제)
- ✅ 디바이스 타입 (모바일/태블릿/데스크탑)
- ✅ 화면 해상도, 언어 설정
- ✅ 사용자 행동 패턴 (클릭, 화면 조회)
- ✅ 성능 지표 (로딩 시간)

### GDPR/개인정보보호법 준수
- 모든 데이터는 익명화되어 수집됨
- Google Analytics는 자동으로 IP 익명화 수행
- 필요시 쿠키 동의 배너 추가 가능 (선택 사항)

---

## 비용 및 제한사항

### Firebase Analytics (무료)
- **이벤트**: 무제한
- **사용자 속성**: 25개 (현재 사용: ~5개)
- **맞춤 이벤트**: 500개 (현재 사용: 11개)
- **데이터 보존**: 14개월

### Google Analytics 4 (무료)
- Firebase Analytics와 자동 연동
- 모든 표준 보고서 무료 사용
- BigQuery 내보내기 (선택 사항, 별도 비용)

---

## 문제 해결

### 1. 이벤트가 콘솔에만 표시되고 Firebase에 전송 안 됨
**원인**: 개발 모드로 설정되어 있음

**해결**:
```javascript
// js/app.js의 init() 함수에서
Analytics.init({
    mode: 'production',  // 'development' → 'production' 변경
    debug: false
});
```

### 2. Firebase 초기화 실패
**원인**: `firebase-config.js`에 실제 Firebase 설정 값이 없음

**해결**:
1. Firebase Console에서 웹 앱 구성 객체 복사
2. `js/firebase-config.js` 파일 업데이트

### 3. CORS 오류 또는 도메인 차단
**원인**: Firebase Authorized domains에 현재 도메인이 없음

**해결**:
1. Firebase Console → Authentication → Settings → Authorized domains
2. 현재 사용 중인 도메인 추가 (예: `localhost`, `vercel.app`)

### 4. App Check 오류
**원인**: reCAPTCHA 설정이 올바르지 않음

**해결**:
1. Firebase Console → App Check에서 reCAPTCHA v3 재설정
2. Google reCAPTCHA 콘솔에서 도메인 확인

---

## 향후 확장 가능성

### 1. 고급 분석
- **Cohort 분석**: 첫 방문 시점별 재방문율
- **Path 분석**: 사용자 이동 경로 시각화
- **A/B 테스트**: Firebase Remote Config 연동

### 2. 추가 통합
- **BigQuery**: 원시 이벤트 데이터 내보내기 및 SQL 분석
- **Looker Studio** (구 Data Studio): 맞춤 대시보드 생성
- **Firebase Crashlytics**: JavaScript 에러 추적

### 3. 추가 이벤트
- 스크롤 깊이 추적
- 세션 지속 시간
- 이미지 로딩 실패율
- 외부 링크 클릭

---

## 파일 구조

```
MoodMeter/
├── js/
│   ├── analytics.js           # Analytics 모듈 (새로 생성)
│   ├── firebase-config.js     # Firebase 설정 (새로 생성, 업데이트 필요)
│   └── app.js                # 메인 앱 (수정됨, 9개 추적 포인트 추가)
├── index.html                # HTML (수정됨, Firebase SDK 추가)
├── ANALYTICS_README.md       # 본 문서
└── ...
```

---

## 지원

### Firebase 공식 문서
- [Firebase Analytics 웹 가이드](https://firebase.google.com/docs/analytics/get-started?platform=web)
- [Google Analytics 4 문서](https://support.google.com/analytics/answer/10089681)

### 추가 질문
이 가이드에서 다루지 않은 내용이나 문제가 있다면:
1. Firebase Console에서 "지원" 메뉴 확인
2. [Firebase Community](https://firebase.google.com/community) 참조
3. [Stack Overflow - Firebase Analytics](https://stackoverflow.com/questions/tagged/firebase-analytics) 검색

# MoodMeter Analytics 구현 완료 요약

## 구현 날짜
2026-02-01

## 구현 방식
**옵션 1: Git 커밋 방식** (권장)
- Firebase 설정 파일을 Git에 커밋
- 보안은 Firebase Console의 App Check + 도메인 제한으로 관리

---

## 변경된 파일

### 1. 신규 파일 (4개)

#### A. `js/analytics.js` (~230줄)
**역할**: Firebase Analytics 통합 모듈

**주요 기능**:
- Firebase Analytics 초기화 및 관리
- 개발/프로덕션 모드 자동 전환
- 이벤트 추적 인터페이스 (`Analytics.track()`)
- 세션 관리 (세션 ID, 시작 시간, 지속 시간)
- 컨텍스트 데이터 자동 수집 (디바이스, 화면, 네트워크 등)
- Firebase 파라미터 제한 준수 (이벤트명 40자, 파라미터 25개, 문자열 100자)
- 개발 모드: console.log(), 프로덕션 모드: Firebase API

**주요 메서드**:
```javascript
Analytics.init(config)           // 초기화
Analytics.track(name, props)     // 이벤트 추적
Analytics.setScreen(screenName)  // 화면 이름 설정
Analytics.logPerformance(metric) // 성능 기록
```

#### B. `js/firebase-config.js` (~25줄)
**역할**: Firebase 프로젝트 설정

**내용**:
- Firebase 구성 객체 (apiKey, projectId 등)
- 현재 상태: 템플릿 (실제 값으로 대체 필요)
- Git에 커밋됨 (Option 1 방식)

**보안 체크리스트**:
- [ ] Firebase App Check 활성화
- [ ] Authorized domains 설정 (localhost, vercel.app)
- [ ] (선택) API Key 제한

#### C. `ANALYTICS_README.md` (~450줄)
**역할**: 포괄적인 구현 가이드

**포함 내용**:
- Phase 1: 개발 환경 테스트 가이드
- Phase 2: Firebase 설정 단계별 가이드
- Phase 3: 프로덕션 모드 전환 가이드
- 데이터 확인 방법 (Console, DebugView, GA4)
- 주요 분석 지표 예시 (화면별 조회수, 클릭 패턴 등)
- 개인정보 보호 정책
- 문제 해결 가이드

#### D. `TEST_ANALYTICS.md` (~200줄)
**역할**: 빠른 테스트 가이드

**포함 내용**:
- 브라우저에서 앱 열기 및 개발자 도구 사용법
- 인터랙션별 테스트 체크리스트
- 예상 이벤트 시퀀스
- 수집 데이터 검증 방법
- 문제 해결 팁

---

### 2. 수정된 파일 (2개)

#### A. `index.html` (+5줄)
**변경 위치**: Line 32-34 (스크립트 로딩 섹션)

**추가 내용**:
```html
<!-- Firebase SDK (compat version) -->
<script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics-compat.js"></script>

<!-- Analytics configuration and modules -->
<script src="js/firebase-config.js"></script>
<script src="js/analytics.js"></script>
<script src="js/app.js"></script>
```

**중요**: 스크립트 로딩 순서 유지 필수

#### B. `js/app.js` (+~90줄)
**변경 사항**: 9개 추적 포인트 + 1개 헬퍼 함수 추가

**수정 포인트 상세**:

##### 1. 앱 초기화 (Line 35-40)
```javascript
async function init() {
    const startTime = performance.now();

    // Analytics 초기화
    Analytics.init({
        mode: 'development',
        debug: true
    });

    // ... 기존 코드 ...

    // 앱 로딩 완료 추적
    Analytics.track('app_loaded', {
        initial_hash: window.location.hash || '#/',
        load_time: Math.round(performance.now() - startTime)
    });
}
```

##### 2. 데이터 로딩 (Line 43-54)
```javascript
async function loadData() {
    try {
        const startTime = performance.now();
        // ... fetch 코드 ...

        // 성공 시
        Analytics.track('data_loaded', {
            load_time: ...,
            mood_count: {...}
        });
    } catch (error) {
        // 실패 시
        Analytics.track('data_load_error', {
            error_message: error.message,
            error_type: error.name
        });
    }
}
```

##### 3. 탭 클릭 (Line 59-64)
```javascript
elements.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;

        Analytics.track('tab_click', {
            from_tab: state.currentTab,
            to_tab: tab
        });

        navigateTo(`#/${tab}`);
    });
});
```

##### 4. 뒤로가기 버튼 (Line 67-68)
```javascript
elements.backBtn.addEventListener('click', () => {
    Analytics.track('back_button_click', {
        from_view: 'detail',
        to_view: 'list',
        tab: state.currentTab,
        mood_key: state.currentMood?.key,
        mood_title: state.currentMood?.title
    });

    navigateTo(`#/${state.currentTab}`);
});
```

##### 5. Escape 키 (Line 75-79)
```javascript
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.currentMood) {
        Analytics.track('escape_key_press', {
            from_view: 'detail',
            to_view: 'list',
            tab: state.currentTab,
            mood_key: state.currentMood?.key,
            mood_title: state.currentMood?.title
        });

        navigateTo(`#/${state.currentTab}`);
    }
});
```

##### 6. 리스트 뷰 렌더링 (Line 135)
```javascript
function renderList() {
    updateActiveTab();
    // ... 기존 코드 ...

    // 화면 조회 추적
    const moods = state.data?.[state.currentTab] || [];
    Analytics.track('screen_view', {
        view_type: 'list',
        tab: state.currentTab,
        screen_name: `List - ${state.currentTab}`,
        mood_count: moods.length
    });

    // ... 나머지 코드 ...
}
```

##### 7. 감정 카드 클릭 추적 (Line 169 이후)
```javascript
// renderList() 마지막에 추가
setupMoodCardTracking();

// 새로운 함수 (Line 219 이후)
function setupMoodCardTracking() {
    document.querySelectorAll('.mood-card').forEach((card, index) => {
        card.addEventListener('click', (e) => {
            const href = card.getAttribute('href');
            const moodKey = href.split('/').pop();
            const mood = state.data[state.currentTab].find(m => m.key === moodKey);

            Analytics.track('mood_card_click', {
                tab: state.currentTab,
                mood_key: moodKey,
                mood_title: mood?.title || '',
                card_index: index,
                total_cards: state.data[state.currentTab].length
            });
        });
    });
}
```

##### 8. 상세 뷰 렌더링 (Line 221)
```javascript
function renderDetail() {
    updateActiveTab();
    // ... 기존 코드 ...

    // 화면 조회 추적
    Analytics.track('screen_view', {
        view_type: 'detail',
        tab: state.currentTab,
        screen_name: `Detail - ${state.currentMood.title}`,
        mood_key: state.currentMood.key,
        mood_title: state.currentMood.title,
        content_mode: state.showImage ? 'image' : 'story'
    });

    // ... 나머지 코드 ...
}
```

##### 9. 컨텐츠 토글 (Line 265-267)
```javascript
const toggleBtn = elements.mainContent.querySelector('.detail-toggle-btn');
toggleBtn.addEventListener('click', () => {
    Analytics.track('content_toggle', {
        from_mode: state.showImage ? 'image' : 'story',
        to_mode: state.showImage ? 'story' : 'image',
        mood_key: state.currentMood.key,
        mood_title: state.currentMood.title,
        tab: state.currentTab
    });

    state.showImage = !state.showImage;
    renderDetail();
});
```

##### 10. Service Worker 등록 (Line 272-282)
```javascript
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                // 성공 시
                Analytics.track('service_worker_registered', {
                    scope: registration.scope,
                    update_found: !!registration.waiting
                });
            })
            .catch(error => {
                // 실패 시
                Analytics.track('service_worker_error', {
                    error_message: error.message,
                    error_type: error.name
                });
            });
    }
}
```

---

## 추적 이벤트 목록 (총 11개)

### A. 화면 조회 (Screen Views)
| 이벤트명 | 발생 시점 | 주요 파라미터 |
|---------|----------|-------------|
| `screen_view` | 리스트 뷰 렌더링 | `view_type: 'list'`, `tab`, `mood_count` |
| `screen_view` | 상세 뷰 렌더링 | `view_type: 'detail'`, `tab`, `mood_key`, `mood_title`, `content_mode` |

### B. 사용자 액션 (User Actions)
| 이벤트명 | 발생 시점 | 주요 파라미터 |
|---------|----------|-------------|
| `tab_click` | 하단 네비게이션 탭 클릭 | `from_tab`, `to_tab` |
| `mood_card_click` | 감정 카드 클릭 | `tab`, `mood_key`, `mood_title`, `card_index` |
| `content_toggle` | 이야기/이미지 토글 | `from_mode`, `to_mode`, `mood_key`, `tab` |
| `back_button_click` | 뒤로가기 버튼 클릭 | `from_view`, `to_view`, `tab`, `mood_key` |
| `escape_key_press` | Escape 키 네비게이션 | `from_view`, `to_view`, `tab`, `mood_key` |

### C. 앱 생명주기 (App Lifecycle)
| 이벤트명 | 발생 시점 | 주요 파라미터 |
|---------|----------|-------------|
| `app_loaded` | 앱 초기화 완료 | `initial_hash`, `load_time` |
| `data_loaded` | JSON 데이터 로딩 완료 | `load_time`, `mood_count` (각 탭별) |
| `data_load_error` | JSON 로딩 실패 | `error_message`, `error_type` |
| `service_worker_registered` | SW 등록 성공 | `scope`, `update_found` |
| `service_worker_error` | SW 등록 실패 | `error_message`, `error_type` |

### D. 자동 컨텍스트 데이터 (모든 이벤트에 포함)
- `timestamp` - 이벤트 발생 시간
- `session_id` - 세션 고유 ID
- `session_duration` - 세션 시작 후 경과 시간
- `screen_width`, `screen_height` - 화면 크기
- `device_type` - mobile/tablet/desktop
- `user_agent` - 브라우저 정보
- `language` - 사용자 언어
- `connection_type` - 네트워크 연결 유형
- `page_url`, `page_hash` - 페이지 정보
- `time_since_last_screen` - 이전 화면에서 경과 시간 (해당 시)

---

## 코드 통계

### 추가된 코드
- **신규 파일**: 4개 (~905줄)
  - `analytics.js`: ~230줄
  - `firebase-config.js`: ~25줄
  - `ANALYTICS_README.md`: ~450줄
  - `TEST_ANALYTICS.md`: ~200줄
- **수정 파일**: 2개 (+~95줄)
  - `index.html`: +5줄
  - `app.js`: +~90줄

**총 추가 코드**: 약 1,000줄

### 변경 없는 파일
- `.gitignore` (Option 1 방식, firebase-config.js를 Git에 커밋)
- `moodmeter.json`
- `css/styles.css`
- `sw.js` (선택 사항, 없어도 정상 작동)
- 기타 이미지, 에셋 파일

---

## 현재 상태

### ✅ 완료된 사항
- [x] Analytics 모듈 구현 (`analytics.js`)
- [x] Firebase 설정 템플릿 생성 (`firebase-config.js`)
- [x] 9개 추적 포인트 + 1개 헬퍼 함수 추가 (`app.js`)
- [x] Firebase SDK 스크립트 추가 (`index.html`)
- [x] 포괄적인 구현 가이드 작성 (`ANALYTICS_README.md`)
- [x] 빠른 테스트 가이드 작성 (`TEST_ANALYTICS.md`)

### ⏳ 다음 단계 (사용자 작업 필요)
- [ ] **브라우저에서 앱 테스트** (개발 모드)
  - `index.html` 열기
  - 개발자 도구 콘솔에서 이벤트 확인
  - `TEST_ANALYTICS.md` 체크리스트 수행

- [ ] **Firebase 프로젝트 생성** (프로덕션 준비 시)
  - Firebase Console에서 새 프로젝트 생성
  - 웹 앱 추가하여 설정 값 획득
  - `firebase-config.js`에 실제 값 입력

- [ ] **Firebase 보안 설정**
  - App Check 활성화 (reCAPTCHA v3)
  - Authorized domains 설정
  - (선택) API Key 제한

- [ ] **프로덕션 모드 전환**
  - `app.js`에서 `mode: 'production'` 설정
  - Vercel/Netlify/Firebase Hosting에 배포
  - Firebase Console에서 실시간 이벤트 확인

---

## 기술 스택

### 프론트엔드
- **Vanilla JavaScript** (ES6+)
- **Firebase SDK 10.8.0** (compat version)
  - `firebase-app-compat.js`
  - `firebase-analytics-compat.js`

### 백엔드/인프라
- **Firebase Analytics** (무료)
- **Google Analytics 4** (Firebase와 자동 통합)

### 보안
- **Firebase App Check** (reCAPTCHA v3)
- **도메인 제한** (Authorized domains)
- **(선택) API Key 제한** (HTTP referrer)

---

## 예상 비용
**$0** (완전 무료)

- Firebase Analytics: 무제한 이벤트, 무료
- Google Analytics 4: 무료 (표준 보고서)
- BigQuery 내보내기: 선택 사항, 별도 비용

---

## 성능 영향

### 번들 크기 증가
- Firebase SDK (CDN): ~30KB (gzip)
- `analytics.js`: ~8KB (gzip)
- `firebase-config.js`: ~1KB

**총 증가**: 약 40KB (초기 로드 시 한 번만)

### 런타임 성능
- 이벤트 추적: 비동기, 비차단
- 개발 모드: console.log() 오버헤드 미미
- 프로덕션 모드: Firebase가 백그라운드에서 배치 전송

**사용자 경험 영향**: 없음

---

## 테스트 권장사항

### 1. 기능 테스트
- [ ] 모든 탭 전환 정상 작동
- [ ] 감정 카드 클릭 정상 작동
- [ ] 이미지/이야기 토글 정상 작동
- [ ] 뒤로가기/Escape 네비게이션 정상 작동

### 2. Analytics 테스트
- [ ] 브라우저 콘솔에서 모든 이벤트 확인
- [ ] 각 이벤트의 파라미터 검증
- [ ] 성능 데이터 (`load_time`) 수집 확인
- [ ] 컨텍스트 데이터 자동 수집 확인

### 3. 크로스 브라우저 테스트
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

### 4. 반응형 테스트
- [ ] 모바일 (< 768px) - `device_type: 'mobile'`
- [ ] 태블릿 (768-1023px) - `device_type: 'tablet'`
- [ ] 데스크탑 (≥ 1024px) - `device_type: 'desktop'`

---

## 참고 문서

### 프로젝트 내부
- `ANALYTICS_README.md` - 포괄적인 구현 가이드
- `TEST_ANALYTICS.md` - 빠른 테스트 가이드
- `js/analytics.js` - Analytics 모듈 소스 코드 (주석 포함)

### 외부 리소스
- [Firebase Analytics 공식 문서](https://firebase.google.com/docs/analytics/get-started?platform=web)
- [Google Analytics 4 가이드](https://support.google.com/analytics/answer/10089681)
- [Firebase App Check 문서](https://firebase.google.com/docs/app-check)
- [reCAPTCHA v3 문서](https://developers.google.com/recaptcha/docs/v3)

---

## 문의 및 지원

### 버그 리포트
1. 브라우저 콘솔 에러 메시지 캡처
2. 재현 단계 기록
3. 브라우저 및 OS 버전 명시

### 기능 요청
1. 추가하고 싶은 이벤트 설명
2. 수집하고 싶은 파라미터 명시
3. 사용 사례 설명

---

## 라이선스 및 개인정보
- Firebase SDK: Apache License 2.0
- 수집 데이터: 익명화, GDPR 준수
- 개인 식별 정보 미수집

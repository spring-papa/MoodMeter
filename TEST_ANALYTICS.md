# Analytics 테스트 가이드

## 빠른 테스트 방법

### 1. 브라우저에서 앱 열기
```bash
# 터미널에서 실행 (MoodMeter 디렉토리에서)
open index.html

# 또는 로컬 서버 실행 (권장)
python3 -m http.server 8000
# 그 다음 브라우저에서 http://localhost:8000 접속
```

### 2. 개발자 도구 열기
- **Chrome/Edge**: F12 또는 Cmd+Option+I (Mac)
- **Firefox**: F12 또는 Cmd+Option+I (Mac)
- **Safari**: Cmd+Option+I (Mac, 먼저 개발자 메뉴 활성화 필요)

### 3. Console 탭에서 이벤트 확인

페이지가 로드되면 다음과 같은 로그가 표시됩니다:

```
[Analytics 2026-02-01T...] Analytics initialized in development mode (console logging only)
[Analytics 2026-02-01T...] Event: data_loaded
┌─────────────────────┬──────────────────────────────────┐
│ (index)             │ Values                           │
├─────────────────────┼──────────────────────────────────┤
│ load_time           │ 123                              │
│ mood_count          │ {"yellow":8,"green":8,...}       │
│ timestamp           │ 1738425600000                    │
│ session_id          │ session_1738425600000_abc123     │
│ ...                 │ ...                              │
└─────────────────────┴──────────────────────────────────┘

[Analytics 2026-02-01T...] Event: screen_view
┌─────────────────────┬──────────────────────────────────┐
│ (index)             │ Values                           │
├─────────────────────┼──────────────────────────────────┤
│ view_type           │ list                             │
│ tab                 │ yellow                           │
│ screen_name         │ List - yellow                    │
│ mood_count          │ 8                                │
│ ...                 │ ...                              │
└─────────────────────┴──────────────────────────────────┘

[Analytics 2026-02-01T...] Event: app_loaded
┌─────────────────────┬──────────────────────────────────┐
│ (index)             │ Values                           │
├─────────────────────┼──────────────────────────────────┤
│ initial_hash        │ #/                               │
│ load_time           │ 456                              │
│ ...                 │ ...                              │
└─────────────────────┴──────────────────────────────────┘
```

### 4. 인터랙션 테스트 체크리스트

다음 작업을 수행하며 콘솔에서 이벤트를 확인하세요:

#### ✅ 앱 로딩
- [x] `data_loaded` - JSON 데이터 로딩 완료
- [x] `screen_view` (view_type: list) - 첫 화면 표시
- [x] `app_loaded` - 앱 초기화 완료
- [x] `service_worker_registered` - Service Worker 등록 (성공 시)

#### ✅ 탭 전환
1. 하단에서 "초록" 탭 클릭
   - [x] `tab_click` (from_tab: yellow, to_tab: green)
   - [x] `screen_view` (view_type: list, tab: green)

2. "파랑" 탭 클릭
   - [x] `tab_click` (from_tab: green, to_tab: blue)
   - [x] `screen_view` (view_type: list, tab: blue)

#### ✅ 감정 카드 클릭
1. 아무 감정 카드 클릭
   - [x] `mood_card_click` (mood_key, mood_title, card_index)
   - [x] `screen_view` (view_type: detail, mood_key, mood_title)

#### ✅ 컨텐츠 토글
1. 상세 화면에서 "이미지 보기" 버튼 클릭
   - [x] `content_toggle` (from_mode: story, to_mode: image)
   - [x] `screen_view` (view_type: detail, content_mode: image)

2. "이야기 보기" 버튼 클릭
   - [x] `content_toggle` (from_mode: image, to_mode: story)
   - [x] `screen_view` (view_type: detail, content_mode: story)

#### ✅ 뒤로가기
1. 뒤로가기 버튼 (←) 클릭
   - [x] `back_button_click` (from_view: detail, to_view: list)
   - [x] `screen_view` (view_type: list)

2. 또는 Escape 키 누르기
   - [x] `escape_key_press` (from_view: detail, to_view: list)
   - [x] `screen_view` (view_type: list)

### 5. 예상 이벤트 시퀀스

정상적인 사용자 여정:

```
1. 페이지 로드
   → data_loaded
   → screen_view (list, yellow)
   → app_loaded
   → service_worker_registered

2. 탭 전환 (yellow → green)
   → tab_click
   → screen_view (list, green)

3. 감정 카드 클릭 (예: "안정된")
   → mood_card_click
   → screen_view (detail, "안정된")

4. 이미지 보기
   → content_toggle
   → screen_view (detail, image mode)

5. 뒤로가기
   → back_button_click (또는 escape_key_press)
   → screen_view (list, green)
```

### 6. 수집되는 컨텍스트 데이터 확인

각 이벤트의 테이블에서 다음 데이터가 자동으로 포함되는지 확인:

- ✅ `timestamp` - 이벤트 발생 시간 (Unix timestamp)
- ✅ `session_id` - 세션 고유 ID
- ✅ `session_duration` - 세션 시작 후 경과 시간 (ms)
- ✅ `screen_width`, `screen_height` - 화면 크기
- ✅ `device_type` - mobile/tablet/desktop
- ✅ `user_agent` - 브라우저 정보
- ✅ `language` - 사용자 언어 (예: ko-KR)
- ✅ `page_url` - 현재 URL
- ✅ `page_hash` - URL 해시 (예: #/green)

### 7. 성능 데이터 확인

- ✅ `app_loaded.load_time` - 앱 로딩 시간 (ms)
- ✅ `data_loaded.load_time` - JSON 로딩 시간 (ms)
- ✅ `screen_view.time_since_last_screen` - 이전 화면에서 경과 시간 (ms)

---

## 다음 단계

### 개발 모드가 정상 작동하면:

1. **Firebase 프로젝트 생성**
   - [Firebase Console](https://console.firebase.google.com) 접속
   - 새 프로젝트 생성
   - 웹 앱 추가하여 설정 값 획득

2. **firebase-config.js 업데이트**
   - Firebase Console에서 받은 실제 값으로 대체
   - `apiKey`, `projectId`, `appId` 등

3. **프로덕션 모드 전환**
   ```javascript
   // js/app.js의 init() 함수에서
   Analytics.init({
       mode: 'production',  // 'development' → 'production' 변경
       debug: false
   });
   ```

4. **Firebase Console에서 확인**
   - Analytics → DebugView (실시간)
   - Analytics → Events (24시간 후)

---

## 문제 해결

### 이벤트가 콘솔에 표시되지 않음
1. 브라우저 콘솔에서 JavaScript 오류 확인
2. `Analytics is not defined` 오류:
   - `index.html`에서 스크립트 로딩 순서 확인
   - `firebase-config.js` → `analytics.js` → `app.js` 순서 유지

### Service Worker 오류
- `sw.js` 파일이 없으면 정상 (선택 사항)
- `service_worker_error` 이벤트는 예상된 동작

### 성능 데이터가 이상함
- 첫 로드 시 `load_time`이 높을 수 있음 (캐시 없음)
- 새로고침 후 `load_time`이 감소하면 정상

---

## 추가 테스트 (고급)

### 1. 네트워크 시뮬레이션
1. 개발자 도구 → Network 탭
2. "Slow 3G" 또는 "Offline" 선택
3. 페이지 새로고침
4. `data_load_error` 이벤트 확인 (오프라인 시)
5. `load_time` 증가 확인 (느린 네트워크)

### 2. 다양한 디바이스 테스트
1. 개발자 도구 → Device Toolbar (Toggle device toolbar)
2. iPhone, iPad, Desktop 등 선택
3. `device_type` 파라미터 변화 확인

### 3. 브라우저별 테스트
- Chrome, Firefox, Safari, Edge에서 각각 테스트
- `user_agent` 파라미터 차이 확인

---

## 예상 결과 스크린샷

### Console 로그 예시:
```
[Analytics 2026-02-01T12:00:00.000Z] Analytics initialized in development mode (console logging only)
[Analytics 2026-02-01T12:00:00.123Z] Event: data_loaded
  ┌─────────────────────────┬─────────────────────────────────────┐
  │ load_time               │ 123                                 │
  │ mood_count              │ {"yellow":8,"green":8,"blue":8...}  │
  │ timestamp               │ 1738425600123                       │
  │ session_id              │ session_1738425600000_abc123        │
  │ device_type             │ desktop                             │
  │ screen_width            │ 1920                                │
  │ screen_height           │ 1080                                │
  └─────────────────────────┴─────────────────────────────────────┘
```

모든 이벤트가 이런 형식으로 표시되어야 합니다!

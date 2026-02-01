# 🚀 Analytics 빠른 시작 가이드

## 즉시 테스트하기 (1분)

### 1단계: 앱 열기
```bash
# MoodMeter 디렉토리에서
open index.html

# 또는 로컬 서버 실행 (권장)
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000 접속
```

### 2단계: 개발자 도구 열기
- **Mac**: `Cmd + Option + I`
- **Windows/Linux**: `F12`

### 3단계: Console 탭에서 확인
페이지 로드되면 다음 로그가 표시됩니다:

```
[Analytics ...] Analytics initialized in development mode
[Analytics ...] Event: data_loaded
[Analytics ...] Event: screen_view
[Analytics ...] Event: app_loaded
```

### 4단계: 앱 사용해보기
1. ✅ 탭 클릭 → `tab_click` + `screen_view` 이벤트
2. ✅ 감정 카드 클릭 → `mood_card_click` + `screen_view` 이벤트
3. ✅ 이미지 보기 버튼 → `content_toggle` + `screen_view` 이벤트
4. ✅ 뒤로가기 버튼 → `back_button_click` + `screen_view` 이벤트

**모든 이벤트가 콘솔에 테이블 형식으로 표시되면 성공!** ✨

---

## 다음 단계

### 개발 환경 (현재 상태)
- ✅ 모든 이벤트가 브라우저 콘솔에 로그됨
- ✅ Firebase 설정 없이 테스트 가능
- ✅ 즉시 사용 가능

### 프로덕션 준비 (나중에)
1. **Firebase 프로젝트 생성**
   - [Firebase Console](https://console.firebase.google.com) 접속
   - "프로젝트 추가" 클릭
   - Google Analytics 활성화

2. **firebase-config.js 업데이트**
   - Firebase Console에서 웹 앱 설정 값 복사
   - `js/firebase-config.js` 파일의 `YOUR_API_KEY_HERE` 등을 실제 값으로 대체

3. **프로덕션 모드 전환**
   - `js/app.js`의 `Analytics.init()` 수정:
   ```javascript
   Analytics.init({
       mode: 'production',  // 'development' → 'production'
       debug: false
   });
   ```

4. **배포**
   - Vercel, Netlify, Firebase Hosting 등에 배포
   - Firebase Console에서 실시간 데이터 확인

---

## 상세 가이드
- 📖 **구현 가이드**: `ANALYTICS_README.md`
- 🧪 **테스트 가이드**: `TEST_ANALYTICS.md`
- 📊 **구현 요약**: `IMPLEMENTATION_SUMMARY.md`

---

## 문제 해결

### 이벤트가 안 보여요
1. 브라우저 콘솔에서 JavaScript 오류 확인
2. `index.html`을 로컬 서버로 실행하세요 (파일 프로토콜 `file://`은 일부 기능 제한)

### "Analytics is not defined" 오류
- `index.html`의 스크립트 로딩 순서 확인:
  1. Firebase SDK
  2. `firebase-config.js`
  3. `analytics.js`
  4. `app.js`

### Service Worker 오류는 정상인가요?
- 네, `sw.js` 파일이 없으면 정상입니다 (선택 사항)
- `service_worker_error` 이벤트는 예상된 동작입니다

---

## 수집되는 이벤트 (11개)

| 카테고리 | 이벤트명 | 설명 |
|---------|---------|------|
| 📱 화면 | `screen_view` | 리스트/상세 화면 조회 |
| 🖱️ 액션 | `tab_click` | 탭 전환 |
| 🖱️ 액션 | `mood_card_click` | 감정 카드 클릭 |
| 🖱️ 액션 | `content_toggle` | 이미지/이야기 토글 |
| 🖱️ 액션 | `back_button_click` | 뒤로가기 |
| ⌨️ 액션 | `escape_key_press` | Escape 키 |
| 🔄 생명주기 | `app_loaded` | 앱 초기화 완료 |
| 🔄 생명주기 | `data_loaded` | 데이터 로딩 성공 |
| ❌ 생명주기 | `data_load_error` | 데이터 로딩 실패 |
| ✅ 생명주기 | `service_worker_registered` | SW 등록 성공 |
| ❌ 생명주기 | `service_worker_error` | SW 등록 실패 |

---

**지금 바로 시작하세요!** 🎉

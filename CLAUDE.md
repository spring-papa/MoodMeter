# MoodMeter

감정 인식 교육용 Progressive Web App (PWA)

## 프로젝트 개요

아이들이 다양한 감정을 이해하고 인식할 수 있도록 돕는 교육용 앱입니다.
4가지 색상 카테고리(노랑/초록/파랑/빨강)로 감정을 분류하고, 각 감정에 대한 이야기와 이미지를 제공합니다.

## 기술 스택

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Analytics**: Firebase Analytics + Google Analytics 4
- **PWA**: Service Worker, 오프라인 지원
- **배포**: Vercel (자동 환경 감지)
- **빌드 도구**: 없음 (순수 정적 파일)

## 파일 구조

```
MoodMeter/
├── index.html              # 메인 HTML (SPA 진입점)
├── js/
│   ├── app.js              # 메인 앱 로직 (IIFE 패턴)
│   ├── analytics.js        # Firebase Analytics 모듈
│   └── firebase-config.js  # Firebase 설정
├── css/
│   └── styles.css          # 스타일시트
├── images/                 # 감정별 이미지 (32개)
├── moodmeter.json          # 감정 데이터 (32개 항목)
└── sw.js                   # Service Worker
```

## 개발 명령어

```bash
# 로컬 서버 실행 (개발 모드 - 콘솔 로그)
python3 -m http.server 8000

# 또는
npx serve .

# 브라우저에서 접속
open http://localhost:8000
```

## 아키텍처

### 라우팅 (Hash-based)
- `#/` 또는 `#/yellow` → 리스트 뷰
- `#/yellow/joyful` → 상세 뷰

### 상태 관리 (js/app.js)
```javascript
const state = {
    data: null,           // moodmeter.json 데이터
    currentTab: 'yellow', // 현재 탭 (yellow/green/blue/red)
    currentMood: null,    // 현재 선택된 감정 객체
    showImage: false,     // 이야기/이미지 토글 상태
    loading: true,
    error: null
};
```

### 탭 구조
| 탭 | 색상 | 감정 카테고리 |
|----|------|--------------|
| yellow | 노랑 | 긍정적/활기찬 감정 |
| green | 초록 | 차분한/안정된 감정 |
| blue | 파랑 | 슬픈/우울한 감정 |
| red | 빨강 | 화난/격한 감정 |

### Analytics 이벤트
- `screen_view` - 화면 조회 (리스트/상세)
- `tab_click` - 탭 전환
- `mood_card_click` - 감정 카드 클릭
- `content_toggle` - 이야기/이미지 토글
- `app_loaded`, `data_loaded` - 앱 생명주기

### 환경 감지 (자동)
- localhost/127.0.0.1 → 개발 모드 (콘솔 로그)
- Vercel/기타 도메인 → 프로덕션 모드 (Firebase)

## 코딩 컨벤션

### JavaScript
- **패턴**: IIFE (즉시 실행 함수)로 전역 스코프 오염 방지
- **스타일**: ES6+ 문법 사용 (const/let, arrow functions, async/await)
- **명명**: camelCase (함수/변수), UPPER_SNAKE_CASE (상수)

### CSS
- **단위**: rem 기반 (접근성)
- **색상**: CSS 변수 사용 (`--yellow-bg`, `--green-bg` 등)
- **레이아웃**: Flexbox 기반

### HTML
- **언어**: 한국어 (lang="ko")
- **접근성**: ARIA 속성 사용 (role, aria-label, aria-selected)

## 데이터 구조

### moodmeter.json
```json
{
  "yellow": [
    {
      "key": "joyful",           // URL 식별자
      "title": "기쁜 마음",       // 표시 제목
      "content": "이야기 내용...", // 상세 이야기
      "description": "짧은 설명"  // 카드 설명
    }
  ],
  "green": [...],
  "blue": [...],
  "red": [...]
}
```

### 이미지 규칙
- 경로: `images/{key}.jpg`
- 예: `images/joyful.jpg`

## 주요 함수 (js/app.js)

| 함수 | 설명 |
|------|------|
| `init()` | 앱 초기화 (Analytics, 데이터 로드, 이벤트 설정) |
| `loadData()` | moodmeter.json 로드 |
| `handleRoute()` | URL 해시 기반 라우팅 |
| `renderList()` | 감정 카드 목록 렌더링 |
| `renderDetail()` | 감정 상세 뷰 렌더링 |
| `setupLazyLoading()` | 이미지 지연 로딩 (IntersectionObserver) |

## Analytics 모듈 (js/analytics.js)

```javascript
// 이벤트 추적
Analytics.track('event_name', { param1: 'value1' });

// 초기화 (자동 환경 감지)
Analytics.init({
    mode: 'production',  // 또는 'development'
    debug: false
});
```

## 배포

### Vercel
```bash
# Vercel CLI로 배포
vercel --prod

# 또는 GitHub 연동으로 자동 배포
```

### Firebase Console 설정 필요
1. App Check 활성화 (reCAPTCHA v3)
2. Authorized domains에 Vercel 도메인 추가

## 문서

- `QUICKSTART.md` - 빠른 시작 가이드
- `ANALYTICS_README.md` - Analytics 구현 가이드
- `TEST_ANALYTICS.md` - 테스트 체크리스트
- `README.md` - 일반 프로젝트 설명

## 주의사항

- 빌드 도구가 없으므로 파일 직접 수정
- Firebase 설정은 `js/firebase-config.js`에 포함됨 (보안은 Firebase Console에서 관리)
- Service Worker 수정 시 캐시 버전 업데이트 필요 (`sw.js`의 `CACHE_NAME`)

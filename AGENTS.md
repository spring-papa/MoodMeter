# MoodMeter

감정 인식 교육용 Progressive Web App (PWA)

## 프로젝트 개요

아이들이 다양한 감정을 이해하고 인식할 수 있도록 돕는 정적 웹앱입니다. 4가지 색상 카테고리(노랑/초록/파랑/빨강)로 감정을 분류하고, 각 감정에 대한 이야기와 이미지를 제공합니다.

설정 탭에서 사용자 이름을 변경하면 상세 이야기의 기본 이름("봄이")이 사용자 입력값으로 치환됩니다.

## 기술 스택

- Frontend: Vanilla JavaScript (ES6+), HTML5, CSS3
- PWA: Service Worker, 오프라인 지원
- 배포: GitHub Pages
- 빌드 도구: 없음 (순수 정적 파일)

## 파일 구조

```text
MoodMeter/
├── index.html              # 메인 HTML (SPA 진입점)
├── js/
│   └── app.js              # 메인 앱 로직 (IIFE 패턴)
├── css/
│   └── styles.css          # 스타일시트
├── images/                 # 감정별 이미지
├── moodmeter.json          # 감정 데이터 (100개 항목)
├── manifest.json           # PWA manifest
└── sw.js                   # Service Worker
```

## 개발 명령어

```bash
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000`으로 접속합니다.

## 아키텍처

### 라우팅 (Hash-based)

- `#/` 또는 `#/yellow` -> 리스트 뷰
- `#/yellow/joyful` -> 상세 뷰
- `#/settings` -> 설정 뷰

### 상태 관리 (js/app.js)

```javascript
const state = {
    data: null,
    currentTab: 'yellow',
    currentMood: null,
    showImage: false,
    loading: true,
    error: null,
    userName: '봄이'
};
```

### 탭 구조

| 탭 | 색상 | 감정 카테고리 |
|----|------|--------------|
| yellow | 노랑 | 긍정적/활기찬 감정 |
| green | 초록 | 차분한/안정된 감정 |
| blue | 파랑 | 슬픈/우울한 감정 |
| red | 빨강 | 화난/격한 감정 |
| settings | 회색 | 사용자 설정 |

## 데이터 구조

```json
{
  "yellow": [
    {
      "key": "joyful",
      "title": "기쁜 마음",
      "content": "이야기 내용...",
      "description": "짧은 설명"
    }
  ]
}
```

이미지 경로는 `images/{key}.jpg` 형식을 사용합니다.

## 사용자 설정 저장소

- localStorage key: `moodmeter:userName`
- 기본값: `봄이`
- 상세 콘텐츠 렌더링 시 `content` 문자열의 `봄이`를 현재 사용자 이름으로 치환

## 주요 함수 (js/app.js)

| 함수 | 설명 |
|------|------|
| `init()` | 앱 초기화 |
| `loadUserName()` | localStorage에서 사용자 이름 로드 |
| `loadData()` | moodmeter.json 로드 |
| `handleRoute()` | URL 해시 기반 라우팅 |
| `renderList()` | 감정 카드 목록 렌더링 |
| `renderDetail()` | 감정 상세 뷰 렌더링 |
| `renderSettings()` | 설정 화면 렌더링/저장/초기화 처리 |
| `formatMoodContent()` | 상세 콘텐츠의 이름 치환 |
| `setupLazyLoading()` | 이미지 지연 로딩 |

## 배포

GitHub Pages에서 정적 파일을 그대로 배포합니다. 별도 빌드 과정은 없습니다.

## 주의사항

- 빌드 도구가 없으므로 파일을 직접 수정합니다.
- Service Worker 수정 시 `sw.js`의 `CACHE_NAME`을 업데이트합니다.
- 외부 로깅/분석 스크립트를 사용하지 않습니다.

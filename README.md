# MoodMeter

감정을 측정하고 표현하는 웹 애플리케이션

## 소개

MoodMeter는 102가지 감정을 4가지 에너지 레벨(Yellow, Green, Blue, Red)로 분류하여 시각적으로 표현하는 감정 측정 도구입니다. 각 감정은 대표 이미지와 함께 제공되어 사용자가 자신의 감정 상태를 쉽게 파악하고 표현할 수 있도록 돕습니다.

## 주요 기능

- **4가지 에너지 레벨**: Yellow(높은 유쾌함), Green(낮은 유쾌함), Blue(낮은 불쾌함), Red(높은 불쾌함)
- **102개 감정 카드**: 각 감정마다 고유한 이미지와 설명 제공
- **상세 감정 보기**: 감정 카드 클릭 시 상세 정보 표시
- **반응형 디자인**: 모바일, 태블릿, 데스크톱 모든 화면 크기 지원
- **오프라인 지원**: Service Worker를 통한 PWA(Progressive Web App) 기능
- **한국어 지원**: 모든 감정 이름 및 설명 한국어 제공

## 사용 방법

1. 상단 탭(Yellow, Green, Blue, Red)을 클릭하여 에너지 레벨 선택
2. 해당 레벨의 감정 카드 목록 확인
3. 원하는 감정 카드를 클릭하여 상세 정보 확인
4. 뒤로가기 버튼으로 목록으로 돌아가기

## 기술 스택

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **PWA**: Service Worker를 통한 오프라인 지원
- **Hosting**: GitHub Pages
- **Design**: 반응형 웹 디자인, 모바일 우선

## 배포

이 프로젝트는 GitHub Pages를 통해 배포됩니다.

**배포 URL**: https://spring-papa.github.io/MoodMeter/

## 로컬 실행

```bash
# Python 3 사용
python3 -m http.server 8000

# 브라우저에서 http://localhost:8000 접속
```

## 프로젝트 구조

```
MoodMeter/
├── index.html          # 메인 진입점
├── js/
│   └── app.js          # 애플리케이션 로직
├── css/
│   └── styles.css      # 스타일시트
├── images/             # 102개 감정 이미지
├── moodmeter.json      # 감정 데이터 (한국어)
├── sw.js               # Service Worker
└── README.md           # 프로젝트 문서
```

## 라이선스

이 프로젝트는 개인 학습 및 사용을 위한 프로젝트입니다.

## 기여

이슈 및 개선 제안은 GitHub Issues를 통해 제출해 주세요.

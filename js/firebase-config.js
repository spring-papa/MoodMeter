// Firebase 설정
// 이 파일은 Git에 커밋됩니다
// 보안은 Firebase Console의 App Check + 도메인 제한으로 관리됩니다

const firebaseConfig = {
    apiKey: "AIzaSyAfr1Bb7b5B86umEk9-wa86eLo8L8bRlZg",
    authDomain: "mood-meter-60c83.firebaseapp.com",
    projectId: "mood-meter-60c83",
    storageBucket: "mood-meter-60c83.firebasestorage.app",
    messagingSenderId: "1023852798760",
    appId: "1:1023852798760:web:83d8f5361935f40a85661d",
    measurementId: "G-ZXYQ0SPQSS"
};


// Firebase 초기화는 analytics.js에서 수행됩니다
window.FIREBASE_CONFIG = firebaseConfig;

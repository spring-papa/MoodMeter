import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
    getAnalytics,
    isSupported as isAnalyticsSupported,
    logEvent,
    setUserProperties
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-analytics.js";

import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    collection,
    getDocs,
    writeBatch,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAfr1Bb7b5B86umEk9-wa86eLo8L8bRlZg",
    authDomain: "mood-meter-60c83.firebaseapp.com",
    projectId: "mood-meter-60c83",
    storageBucket: "mood-meter-60c83.firebasestorage.app",
    messagingSenderId: "1023852798760",
    appId: "1:1023852798760:web:83d8f5361935f40a85661d",
    measurementId: "G-ZXYQ0SPQSS"
};

const STORAGE_KEY_USER_NAME = "moodmeter:userName";
const STORAGE_KEY_DISCOVERIES = "moodmeter:discoveries";
const STORAGE_KEY_QUIZ_STATS = "moodmeter:quizStats";
const STORAGE_KEY_SYNC_META = "moodmeter:syncMeta";

let app = null;
let auth = null;
let db = null;
let analytics = null;
let currentUser = null;
let initError = null;
let analyticsReady = false;
let initialized = false;
const userListeners = new Set();

function getDefaultSyncMeta() {
    return {
        lastSyncedAt: "",
        pendingDiscoveryIds: [],
        pendingDeletedDiscoveryIds: [],
        pendingQuizStatIds: [],
        lastCloudUserId: ""
    };
}

function readJson(key, fallback) {
    try {
        const rawValue = localStorage.getItem(key);
        if (!rawValue) return fallback;
        return JSON.parse(rawValue);
    } catch (error) {
        console.warn(`Failed to read ${key} from localStorage:`, error);
        return fallback;
    }
}

function writeJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.warn(`Failed to write ${key} to localStorage:`, error);
        return false;
    }
}

function readSyncMeta() {
    return {
        ...getDefaultSyncMeta(),
        ...readJson(STORAGE_KEY_SYNC_META, {})
    };
}

function writeSyncMeta(meta) {
    return writeJson(STORAGE_KEY_SYNC_META, {
        ...getDefaultSyncMeta(),
        ...meta
    });
}

function uniqueValues(values) {
    return Array.from(new Set(values.filter(Boolean)));
}

function addPending(metaKey, id) {
    const meta = readSyncMeta();
    meta[metaKey] = uniqueValues([...(meta[metaKey] || []), id]);
    writeSyncMeta(meta);
}

function removePending(metaKey, id) {
    const meta = readSyncMeta();
    meta[metaKey] = (meta[metaKey] || []).filter(item => item !== id);
    writeSyncMeta(meta);
}

function isIsoDateString(value) {
    if (typeof value !== "string" || !value) return false;
    return Number.isFinite(Date.parse(value));
}

function latestDate(...values) {
    return values
        .filter(isIsoDateString)
        .sort((a, b) => Date.parse(b) - Date.parse(a))[0] || "";
}

function toSafeMoodStatId(moodId) {
    return String(moodId).replaceAll(":", "__");
}

function fromSafeMoodStatId(safeMoodId) {
    return String(safeMoodId).replaceAll("__", ":");
}

function readDiscoveries() {
    const discoveries = readJson(STORAGE_KEY_DISCOVERIES, []);
    return Array.isArray(discoveries) ? discoveries : [];
}

function writeDiscoveries(discoveries) {
    return writeJson(STORAGE_KEY_DISCOVERIES, discoveries);
}

function readQuizStats() {
    const stats = readJson(STORAGE_KEY_QUIZ_STATS, {});
    return stats && typeof stats === "object" && !Array.isArray(stats) ? stats : {};
}

function writeQuizStats(stats) {
    return writeJson(STORAGE_KEY_QUIZ_STATS, stats);
}

function updateStoredDiscoveryStatus(id, syncStatus) {
    const discoveries = readDiscoveries();
    const nextDiscoveries = discoveries.map(discovery => {
        if (discovery.id !== id) return discovery;
        return { ...discovery, syncStatus };
    });
    writeDiscoveries(nextDiscoveries);
}

function updateStoredQuizStatus(moodId, syncStatus) {
    const stats = readQuizStats();
    if (!stats[moodId]) return;
    stats[moodId] = { ...stats[moodId], syncStatus };
    writeQuizStats(stats);
}

function requireCloudUser() {
    if (!initialized || initError || !auth || !db || !currentUser) return null;
    return currentUser;
}

function toCloudDiscovery(discovery) {
    return {
        target: discovery.target,
        moods: Array.isArray(discovery.moods) ? discovery.moods : [],
        createdAt: discovery.createdAt || "",
        updatedAt: discovery.updatedAt || ""
    };
}

function toLocalDiscovery(discovery) {
    return {
        id: discovery.id,
        target: discovery.target || "",
        moods: Array.isArray(discovery.moods) ? discovery.moods : [],
        createdAt: discovery.createdAt || discovery.updatedAt || new Date().toISOString(),
        updatedAt: discovery.updatedAt || discovery.createdAt || new Date().toISOString(),
        syncStatus: "synced"
    };
}

function toCloudQuizStat(moodId, stat = {}) {
    return {
        shown: Number.isFinite(stat.shown) ? stat.shown : 0,
        correct: Number.isFinite(stat.correct) ? stat.correct : 0,
        wrong: Number.isFinite(stat.wrong) ? stat.wrong : 0,
        lastShownAt: stat.lastShownAt || "",
        lastAnsweredAt: stat.lastAnsweredAt || "",
        lastWrongAt: stat.lastWrongAt || "",
        updatedAt: stat.updatedAt || new Date().toISOString()
    };
}

function toLocalQuizStat(stat = {}) {
    return {
        shown: Number.isFinite(stat.shown) ? Math.max(0, stat.shown) : 0,
        correct: Number.isFinite(stat.correct) ? Math.max(0, stat.correct) : 0,
        wrong: Number.isFinite(stat.wrong) ? Math.max(0, stat.wrong) : 0,
        lastShownAt: stat.lastShownAt || "",
        lastAnsweredAt: stat.lastAnsweredAt || "",
        lastWrongAt: stat.lastWrongAt || "",
        updatedAt: stat.updatedAt || "",
        syncStatus: "synced"
    };
}

async function init() {
    if (initialized) {
        return { available: !initError, error: initError };
    }

    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        await setPersistence(auth, browserLocalPersistence);

        try {
            if (await isAnalyticsSupported()) {
                analytics = getAnalytics(app);
                analyticsReady = true;
                trackEvent("app_open");
            }
        } catch (analyticsError) {
            console.warn("Firebase Analytics is unavailable:", analyticsError);
        }

        initialized = true;

        onAuthStateChanged(auth, async user => {
            currentUser = user || null;
            notifyUserChanged();

            if (!currentUser) return;

            try {
                await syncLocalDataToCloud();
            } catch (error) {
                console.warn("Failed to sync MoodMeter data after sign-in:", error);
            } finally {
                notifyUserChanged();
            }
        });

        return { available: true, analyticsReady, error: null };
    } catch (error) {
        initError = error;
        initialized = true;
        console.warn("Failed to initialize Firebase cloud sync:", error);
        return { available: false, error };
    }
}

function notifyUserChanged() {
    const snapshot = getCurrentUser();
    userListeners.forEach(listener => {
        try {
            listener(snapshot);
        } catch (error) {
            console.warn("MoodMeter cloud listener failed:", error);
        }
    });
}

async function signInWithGoogle() {
    await init();
    if (initError || !auth) {
        return { ok: false, error: initError || new Error("Firebase Auth is unavailable.") };
    }

    try {
        trackEvent("login_start", { method: "google" });
        const provider = new GoogleAuthProvider();
        const credential = await signInWithPopup(auth, provider);
        return handleSignedInUser(credential.user, "google");
    } catch (error) {
        console.warn("Google sign-in failed:", error);
        trackEvent("login_failed", { method: "google", reason: getSafeErrorCode(error) });
        return { ok: false, error };
    }
}

function normalizeEmailInput(value) {
    return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeDisplayName(value) {
    return String(value || "").trim().replace(/\s+/g, " ").slice(0, 20);
}

function isValidPassword(value) {
    return String(value || "").length >= 6;
}

function getAuthErrorMessage(error) {
    switch (error?.code) {
        case "auth/invalid-email":
        case "auth/missing-email":
            return "이메일 주소를 다시 확인해 주세요.";
        case "auth/missing-password":
            return "비밀번호를 입력해 주세요.";
        case "auth/weak-password":
            return "비밀번호는 6자 이상으로 입력해 주세요.";
        case "auth/email-already-in-use":
            return "이미 다른 로그인 방식으로 사용 중인 이메일이에요. 전에 사용하던 방식으로 로그인해 주세요.";
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
            return "이메일과 비밀번호를 다시 확인해 주세요.";
        case "auth/account-exists-with-different-credential":
            return "이미 다른 로그인 방식으로 사용 중인 이메일이에요. 전에 사용하던 방식으로 로그인해 주세요.";
        case "auth/network-request-failed":
            return "인터넷 연결을 확인한 뒤 다시 시도해 주세요.";
        case "auth/popup-closed-by-user":
            return "로그인이 취소되었어요.";
        default:
            return "로그인 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.";
    }
}

async function handleSignedInUser(user, method) {
    currentUser = user || null;
    if (!currentUser) return { ok: false, error: new Error("Signed-in user is unavailable.") };

    await saveUserProfile();
    await syncLocalDataToCloud();
    setAnalyticsUserProperties({ signed_in: "true" });
    trackEvent("login_success", { method });
    notifyUserChanged();
    return { ok: true, user: getCurrentUser() };
}

async function signUpWithEmail(emailInput, passwordInput, displayNameInput = "") {
    await init();
    if (initError || !auth) {
        return { ok: false, error: initError || new Error("Firebase Auth is unavailable.") };
    }

    const email = normalizeEmailInput(emailInput);
    if (!isValidEmail(email)) {
        return { ok: false, code: "auth/invalid-email", message: "이메일 주소를 다시 확인해 주세요." };
    }

    const password = String(passwordInput || "");
    if (!isValidPassword(password)) {
        return { ok: false, code: "auth/weak-password", message: "비밀번호는 6자 이상으로 입력해 주세요." };
    }

    try {
        trackEvent("login_start", { method: "email_password_signup" });
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        const displayName = normalizeDisplayName(displayNameInput);

        if (displayName) {
            await updateProfile(credential.user, { displayName });
        }

        // TODO: 필요하면 linkWithCredential을 사용해 동일 사용자의 여러 로그인 방식을 하나의 Firebase uid에 연결한다.
        // TODO: 보호자 확인이 필요한 정책으로 바뀌면 sendEmailVerification을 추가하고 emailVerified 기준 안내를 강화한다.
        return handleSignedInUser(credential.user, "email_password_signup");
    } catch (error) {
        console.warn("[MoodMeterCloud] Auth error:", error);
        trackEvent("login_failed", { method: "email_password_signup", reason: getSafeErrorCode(error) });
        return { ok: false, error, message: getAuthErrorMessage(error) };
    }
}

async function signInWithEmail(emailInput, passwordInput) {
    await init();
    if (initError || !auth) {
        return { ok: false, error: initError || new Error("Firebase Auth is unavailable.") };
    }

    const email = normalizeEmailInput(emailInput);
    if (!isValidEmail(email)) {
        return { ok: false, code: "auth/invalid-email", message: "이메일 주소를 다시 확인해 주세요." };
    }

    const password = String(passwordInput || "");
    if (!password) {
        return { ok: false, code: "auth/missing-password", message: "비밀번호를 입력해 주세요." };
    }

    try {
        trackEvent("login_start", { method: "email_password" });
        const credential = await signInWithEmailAndPassword(auth, email, password);
        return handleSignedInUser(credential.user, "email_password");
    } catch (error) {
        console.warn("[MoodMeterCloud] Auth error:", error);
        trackEvent("login_failed", { method: "email_password", reason: getSafeErrorCode(error) });
        return { ok: false, error, message: getAuthErrorMessage(error) };
    }
}

async function sendPasswordReset(emailInput) {
    await init();
    if (initError || !auth) {
        return { ok: false, error: initError || new Error("Firebase Auth is unavailable.") };
    }

    const email = normalizeEmailInput(emailInput);
    if (!isValidEmail(email)) {
        return { ok: false, code: "auth/invalid-email", message: "이메일 주소를 다시 확인해 주세요." };
    }

    try {
        await sendPasswordResetEmail(auth, email);
        trackEvent("password_reset_requested");
        return { ok: true };
    } catch (error) {
        console.warn("[MoodMeterCloud] Auth error:", error);
        trackEvent("password_reset_failed", { reason: getSafeErrorCode(error) });
        return { ok: false, error, message: getAuthErrorMessage(error) };
    }
}

async function signOutUser() {
    await init();
    if (!auth) return { ok: false };

    try {
        await signOut(auth);
        currentUser = null;
        setAnalyticsUserProperties({ signed_in: "false" });
        trackEvent("logout");
        notifyUserChanged();
        return { ok: true };
    } catch (error) {
        console.warn("Google sign-out failed:", error);
        return { ok: false, error };
    }
}

function getCurrentUser() {
    if (!currentUser) return null;
    return {
        uid: currentUser.uid,
        displayName: currentUser.displayName || "",
        email: currentUser.email || ""
    };
}

function onUserChanged(listener) {
    if (typeof listener !== "function") return () => {};
    userListeners.add(listener);
    listener(getCurrentUser());
    return () => userListeners.delete(listener);
}

async function saveUserProfile() {
    const user = requireCloudUser();
    if (!user) return { ok: false, skipped: true };

    const profileRef = doc(db, "users", user.uid);
    const userName = localStorage.getItem(STORAGE_KEY_USER_NAME) || "봄이";

    try {
        const existingProfile = await getDoc(profileRef);
        await setDoc(profileRef, {
            displayName: user.displayName || "",
            email: user.email || "",
            userName,
            createdAt: existingProfile.exists() ? existingProfile.data().createdAt : serverTimestamp(),
            updatedAt: serverTimestamp()
        }, { merge: true });
        trackEvent("cloud_profile_saved");
        return { ok: true };
    } catch (error) {
        console.warn("Failed to save user profile to Firestore:", error);
        trackEvent("cloud_profile_save_failed", { reason: getSafeErrorCode(error) });
        return { ok: false, error };
    }
}

async function loadUserProfile() {
    const user = requireCloudUser();
    if (!user) return null;

    try {
        const snapshot = await getDoc(doc(db, "users", user.uid));
        return snapshot.exists() ? snapshot.data() : null;
    } catch (error) {
        console.warn("Failed to load user profile from Firestore:", error);
        return null;
    }
}

async function saveDiscovery(discovery) {
    const user = requireCloudUser();
    if (!user || !discovery?.id) {
        if (discovery?.id) addPending("pendingDiscoveryIds", discovery.id);
        return { ok: false, skipped: true };
    }

    try {
        await setDoc(doc(db, "users", user.uid, "discoveries", discovery.id), toCloudDiscovery(discovery), { merge: true });
        updateStoredDiscoveryStatus(discovery.id, "synced");
        removePending("pendingDiscoveryIds", discovery.id);
        trackEvent("cloud_discovery_saved");
        return { ok: true };
    } catch (error) {
        console.warn("Failed to save discovery to Firestore:", error);
        updateStoredDiscoveryStatus(discovery.id, "failed");
        addPending("pendingDiscoveryIds", discovery.id);
        trackEvent("cloud_discovery_save_failed", { reason: getSafeErrorCode(error) });
        return { ok: false, error };
    }
}

async function deleteDiscovery(discoveryId) {
    const user = requireCloudUser();
    if (!user || !discoveryId) {
        if (discoveryId) addPending("pendingDeletedDiscoveryIds", discoveryId);
        return { ok: false, skipped: true };
    }

    try {
        await deleteDoc(doc(db, "users", user.uid, "discoveries", discoveryId));
        removePending("pendingDeletedDiscoveryIds", discoveryId);
        removePending("pendingDiscoveryIds", discoveryId);
        trackEvent("cloud_discovery_deleted");
        return { ok: true };
    } catch (error) {
        console.warn("Failed to delete discovery from Firestore:", error);
        addPending("pendingDeletedDiscoveryIds", discoveryId);
        trackEvent("cloud_discovery_delete_failed", { reason: getSafeErrorCode(error) });
        return { ok: false, error };
    }
}

async function loadDiscoveries() {
    const user = requireCloudUser();
    if (!user) return [];

    try {
        const snapshot = await getDocs(collection(db, "users", user.uid, "discoveries"));
        return snapshot.docs.map(item => toLocalDiscovery({ id: item.id, ...item.data() }));
    } catch (error) {
        console.warn("Failed to load discoveries from Firestore:", error);
        return [];
    }
}

async function saveQuizStats(moodId, stat) {
    const user = requireCloudUser();
    if (!user || !moodId) {
        if (moodId) addPending("pendingQuizStatIds", moodId);
        return { ok: false, skipped: true };
    }

    try {
        await setDoc(doc(db, "users", user.uid, "quizStats", toSafeMoodStatId(moodId)), toCloudQuizStat(moodId, stat), { merge: true });
        updateStoredQuizStatus(moodId, "synced");
        removePending("pendingQuizStatIds", moodId);
        trackEvent("cloud_quiz_stat_saved");
        return { ok: true };
    } catch (error) {
        console.warn("Failed to save quiz stat to Firestore:", error);
        updateStoredQuizStatus(moodId, "failed");
        addPending("pendingQuizStatIds", moodId);
        trackEvent("cloud_quiz_stat_save_failed", { reason: getSafeErrorCode(error) });
        return { ok: false, error };
    }
}

async function loadQuizStats() {
    const user = requireCloudUser();
    if (!user) return {};

    try {
        const snapshot = await getDocs(collection(db, "users", user.uid, "quizStats"));
        return snapshot.docs.reduce((stats, item) => {
            const data = item.data();
            const moodId = data.moodId || fromSafeMoodStatId(item.id);
            stats[moodId] = toLocalQuizStat(data);
            return stats;
        }, {});
    } catch (error) {
        console.warn("Failed to load quiz stats from Firestore:", error);
        return {};
    }
}

function mergeDiscoveries(localDiscoveries, cloudDiscoveries) {
    const mergedById = new Map();

    [...cloudDiscoveries, ...localDiscoveries].forEach(discovery => {
        if (!discovery?.id) return;
        const existing = mergedById.get(discovery.id);
        if (!existing) {
            mergedById.set(discovery.id, discovery);
            return;
        }

        const existingTime = Date.parse(existing.updatedAt || existing.createdAt || "") || 0;
        const nextTime = Date.parse(discovery.updatedAt || discovery.createdAt || "") || 0;
        if (nextTime >= existingTime) {
            mergedById.set(discovery.id, discovery);
        }
    });

    return Array.from(mergedById.values())
        .map(discovery => ({ ...discovery, syncStatus: "synced" }))
        .sort((a, b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || ""));
}

function mergeQuizStats(localStats, cloudStats) {
    const moodIds = uniqueValues([...Object.keys(localStats), ...Object.keys(cloudStats)]);

    return moodIds.reduce((stats, moodId) => {
        const localStat = localStats[moodId] || {};
        const cloudStat = cloudStats[moodId] || {};
        stats[moodId] = {
            shown: Math.max(localStat.shown || 0, cloudStat.shown || 0),
            correct: Math.max(localStat.correct || 0, cloudStat.correct || 0),
            wrong: Math.max(localStat.wrong || 0, cloudStat.wrong || 0),
            lastShownAt: latestDate(localStat.lastShownAt, cloudStat.lastShownAt),
            lastAnsweredAt: latestDate(localStat.lastAnsweredAt, cloudStat.lastAnsweredAt),
            lastWrongAt: latestDate(localStat.lastWrongAt, cloudStat.lastWrongAt),
            updatedAt: latestDate(localStat.updatedAt, cloudStat.updatedAt),
            syncStatus: "synced"
        };
        return stats;
    }, {});
}

async function mergeCloudDataToLocal() {
    const user = requireCloudUser();
    if (!user) return { ok: false, skipped: true };

    try {
        const profile = await loadUserProfile();
        const localUserName = localStorage.getItem(STORAGE_KEY_USER_NAME) || "";
        if (!localUserName && profile?.userName) {
            localStorage.setItem(STORAGE_KEY_USER_NAME, profile.userName);
        }

        const cloudDiscoveries = await loadDiscoveries();
        const cloudQuizStats = await loadQuizStats();
        const mergedDiscoveries = mergeDiscoveries(readDiscoveries(), cloudDiscoveries);
        const mergedQuizStats = mergeQuizStats(readQuizStats(), cloudQuizStats);

        writeDiscoveries(mergedDiscoveries);
        writeQuizStats(mergedQuizStats);
        return { ok: true, discoveries: mergedDiscoveries, quizStats: mergedQuizStats };
    } catch (error) {
        console.warn("Failed to merge Firestore data into localStorage:", error);
        return { ok: false, error };
    }
}

async function syncLocalDataToCloud() {
    const user = requireCloudUser();
    if (!user) return { ok: false, skipped: true };

    try {
        await saveUserProfile();
        const merged = await mergeCloudDataToLocal();
        const discoveries = merged.discoveries || readDiscoveries();
        const quizStats = merged.quizStats || readQuizStats();
        const batch = writeBatch(db);

        discoveries.forEach(discovery => {
            batch.set(doc(db, "users", user.uid, "discoveries", discovery.id), toCloudDiscovery(discovery), { merge: true });
        });

        Object.entries(quizStats).forEach(([moodId, stat]) => {
            batch.set(doc(db, "users", user.uid, "quizStats", toSafeMoodStatId(moodId)), toCloudQuizStat(moodId, stat), { merge: true });
        });

        const meta = readSyncMeta();
        const pendingDeletedDiscoveryIds = meta.pendingDeletedDiscoveryIds || [];
        pendingDeletedDiscoveryIds.forEach(discoveryId => {
            batch.delete(doc(db, "users", user.uid, "discoveries", discoveryId));
        });

        await batch.commit();

        writeDiscoveries(discoveries.map(discovery => ({ ...discovery, syncStatus: "synced" })));
        writeQuizStats(Object.entries(quizStats).reduce((stats, [moodId, stat]) => {
            stats[moodId] = { ...stat, syncStatus: "synced" };
            return stats;
        }, {}));

        writeSyncMeta({
            ...getDefaultSyncMeta(),
            lastSyncedAt: new Date().toISOString(),
            lastCloudUserId: user.uid
        });

        trackEvent("cloud_sync_completed", {
            discovery_count: discoveries.length,
            quiz_stat_count: Object.keys(quizStats).length
        });
        return { ok: true };
    } catch (error) {
        console.warn("Failed to sync local MoodMeter data to Firestore:", error);
        trackEvent("cloud_sync_failed", { reason: getSafeErrorCode(error) });
        return { ok: false, error };
    }
}

function getSafeErrorCode(error) {
    if (!error || typeof error !== "object") return "unknown";
    return String(error.code || error.name || "unknown").slice(0, 40);
}

function sanitizeEventParams(params = {}) {
    return Object.entries(params).reduce((safeParams, [key, value]) => {
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            safeParams[key] = value;
        }
        return safeParams;
    }, {});
}

function trackEvent(eventName, params = {}) {
    if (!analyticsReady || !analytics) return false;

    try {
        logEvent(analytics, eventName, sanitizeEventParams(params));
        return true;
    } catch (error) {
        console.warn("Failed to log Firebase Analytics event:", error);
        return false;
    }
}

function setAnalyticsUserProperties(properties) {
    if (!analyticsReady || !analytics) return false;

    try {
        setUserProperties(analytics, sanitizeEventParams(properties));
        return true;
    } catch (error) {
        console.warn("Failed to set Firebase Analytics user properties:", error);
        return false;
    }
}

window.MoodMeterCloud = {
    init,
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    sendPasswordReset,
    signOutUser,
    getCurrentUser,
    onUserChanged,
    saveUserProfile,
    loadUserProfile,
    saveDiscovery,
    deleteDiscovery,
    loadDiscoveries,
    saveQuizStats,
    loadQuizStats,
    syncLocalDataToCloud,
    mergeCloudDataToLocal,
    trackEvent
};

window.MoodMeterCloudReady = init();
window.dispatchEvent(new CustomEvent("moodmeter-cloud-ready"));

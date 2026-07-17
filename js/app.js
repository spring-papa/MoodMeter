// MoodMeter App
(function() {
    'use strict';

    const DEFAULT_USER_NAME = '봄이';
    const USER_NAME_MAX_LENGTH = 20;
    const CURRENT_SCHEMA_VERSION = 2;
    const STORAGE_KEY_USER_NAME = 'moodmeter:userName';
    const STORAGE_KEY_CHILD_GENDER = 'moodmeter:childGender';
    const STORAGE_KEY_DISCOVERIES = 'moodmeter:discoveries';
    const STORAGE_KEY_QUIZ_STATS = 'moodmeter:quizStats';
    const STORAGE_KEY_SCHEMA_VERSION = 'moodmeter:schemaVersion';
    const STORAGE_KEY_SYNC_META = 'moodmeter:syncMeta';
    const QUIZ_QUESTION_COUNT_PER_TAB = 2;
    const QUIZ_OPTION_COUNT = 4;
    const CHIP_RIVER_PIXELS_PER_SECOND = 15;
    const MOOD_TABS = ['yellow', 'green', 'blue', 'red'];
    const NAV_TABS = ['discover', ...MOOD_TABS];
    const CHILD_GENDERS = ['girl', 'boy'];
    const DEFAULT_CHILD_GENDER = 'girl';
    const CHILD_GENDER_LABELS = {
        girl: '여자아이',
        boy: '남자아이'
    };
    const CONSTELLATION_SPREAD_RADIUS = 38;
    const CONSTELLATION_SPREAD_MAX_SHIFT = 20;
    const TAB_LABELS = {
        yellow: '노랑',
        green: '초록',
        blue: '파랑',
        red: '빨강'
    };
    const QUIZ_SIMILAR_MOOD_KEY_GROUPS = [
        ['upbeat', 'optimistic', 'hopeful'],
        ['joyful', 'blissful', 'pleasant', 'cheerful', 'happy', 'ecstatic'],
        ['energized', 'hyper', 'exhilarated', 'enthusiastic', 'thrilled', 'lively', 'festive', 'excited'],
        ['motivated', 'elated', 'proud'],
        ['pleased', 'satisfied', 'complacent', 'content', 'fulfilled'],
        ['touched', 'grateful', 'loving', 'mellow', 'blessed'],
        ['serene', 'carefree', 'chill', 'at ease', 'cozy', 'balanced', 'relaxed', 'easygoing', 'restful', 'comfortable', 'tranquil', 'peaceful', 'calm'],
        ['sleepy', 'exhausted', 'spent', 'fatigued', 'drained', 'tired'],
        ['hopeless', 'discouraged', 'pessimistic', 'disappointed', 'despair', 'frustrated', 'down'],
        ['desolate', 'alienated', 'sad', 'morose', 'lonely', 'depressed', 'glum', 'sullen', 'miserable'],
        ['disgusted', 'repulsed'],
        ['annoyed', 'livid', 'enraged', 'furious', 'peeved', 'irritated', 'fuming', 'angry'],
        ['frightened', 'panicked', 'worried', 'uneasy', 'nervous', 'stressed', 'tense', 'restless', 'anxious', 'concerned', 'apprehensive', 'jittery'],
        ['surprised', 'stunned', 'shocked']
    ];

    // App State
    const state = {
        data: null,
        currentTab: 'yellow',
        currentMood: null,
        detailStoryExpanded: false,
        loading: true,
        error: null,
        userName: DEFAULT_USER_NAME,
        childGender: DEFAULT_CHILD_GENDER,
        discoveries: [],
        quizStats: {},
        cloud: {
            available: false,
            syncing: false,
            user: null,
            status: '',
            error: ''
        },
        quizSession: null,
        quizReviewExpandedMoodId: null,
        discoverDraft: {
            target: '',
            selectedMoodKeys: [],
            filter: 'all',
            infoMoodKey: null,
            error: '',
            editingId: null
        }
    };
    let chipRiverFrameId = null;

    // DOM Elements
    const elements = {
        app: document.getElementById('app'),
        header: document.getElementById('header'),
        headerTitle: document.getElementById('header-title'),
        backBtn: document.getElementById('back-btn'),
        quizBtn: document.getElementById('quiz-btn'),
        settingsBtn: document.getElementById('settings-btn'),
        mainContent: document.getElementById('main-content'),
        tabBar: document.getElementById('tab-bar'),
        tabBtns: document.querySelectorAll('.tab-btn')
    };

    // Initialize App
    async function init() {
        migrateLocalStorageIfNeeded();
        loadUserName();
        loadChildGender();
        state.discoveries = loadDiscoveries();
        state.quizStats = loadQuizStats();
        await loadData();
        setupEventListeners();
        setupCloudSyncIfAvailable();
        handleRoute();
        registerServiceWorker();
    }

    function loadUserName() {
        try {
            const storedName = localStorage.getItem(STORAGE_KEY_USER_NAME);
            const normalizedName = normalizeUserName(storedName);
            state.userName = normalizedName || DEFAULT_USER_NAME;
        } catch (error) {
            console.warn('Failed to load user name from localStorage:', error);
            state.userName = DEFAULT_USER_NAME;
        }
    }

    function saveUserName(name) {
        try {
            localStorage.setItem(STORAGE_KEY_USER_NAME, name);
            syncUserProfileToCloud();
            trackCloudEvent('user_name_saved');
            return true;
        } catch (error) {
            console.warn('Failed to save user name to localStorage:', error);
            return false;
        }
    }

    function normalizeUserName(value) {
        if (typeof value !== 'string') return '';
        return value.trim().replace(/\s+/g, ' ');
    }

    function normalizeChildGender(value) {
        return CHILD_GENDERS.includes(value) ? value : DEFAULT_CHILD_GENDER;
    }

    function loadChildGender() {
        try {
            state.childGender = normalizeChildGender(localStorage.getItem(STORAGE_KEY_CHILD_GENDER));
        } catch (error) {
            console.warn('Failed to load child gender from localStorage:', error);
            state.childGender = DEFAULT_CHILD_GENDER;
        }
    }

    function saveChildGender(gender) {
        try {
            localStorage.setItem(STORAGE_KEY_CHILD_GENDER, normalizeChildGender(gender));
            syncUserProfileToCloud();
            trackCloudEvent('child_gender_saved');
            return true;
        } catch (error) {
            console.warn('Failed to save child gender to localStorage:', error);
            return false;
        }
    }

    function getMoodImageUrl(mood) {
        const key = typeof mood === 'string' ? mood : mood?.key;
        return `images/${state.childGender}/${encodeURIComponent(key)}.jpg`;
    }

    function prefersReducedMotion() {
        return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
    }

    function normalizeEmailInput(value) {
        return String(value || '').trim().toLowerCase();
    }

    function isValidEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    function formatMoodContent(content) {
        if (typeof content !== 'string') return '';
        return content.split(DEFAULT_USER_NAME).join(state.userName);
    }

    function getMoodDisplayTitle(title) {
        if (typeof title !== 'string') return '';
        return title.replace(/\s*마음$/u, '');
    }

    function getDefaultSyncMeta() {
        return {
            lastSyncedAt: '',
            pendingDiscoveryIds: [],
            pendingDeletedDiscoveryIds: [],
            pendingQuizStatIds: [],
            lastCloudUserId: ''
        };
    }

    function readSyncMeta() {
        try {
            const rawMeta = localStorage.getItem(STORAGE_KEY_SYNC_META);
            if (!rawMeta) return getDefaultSyncMeta();

            const parsedMeta = JSON.parse(rawMeta);
            if (!parsedMeta || typeof parsedMeta !== 'object' || Array.isArray(parsedMeta)) {
                return getDefaultSyncMeta();
            }

            return {
                ...getDefaultSyncMeta(),
                ...parsedMeta,
                pendingDiscoveryIds: Array.isArray(parsedMeta.pendingDiscoveryIds) ? parsedMeta.pendingDiscoveryIds : [],
                pendingDeletedDiscoveryIds: Array.isArray(parsedMeta.pendingDeletedDiscoveryIds) ? parsedMeta.pendingDeletedDiscoveryIds : [],
                pendingQuizStatIds: Array.isArray(parsedMeta.pendingQuizStatIds) ? parsedMeta.pendingQuizStatIds : []
            };
        } catch (error) {
            console.warn('Failed to load sync metadata from localStorage:', error);
            return getDefaultSyncMeta();
        }
    }

    function saveSyncMeta(meta) {
        try {
            localStorage.setItem(STORAGE_KEY_SYNC_META, JSON.stringify({
                ...getDefaultSyncMeta(),
                ...meta
            }));
            return true;
        } catch (error) {
            console.warn('Failed to save sync metadata to localStorage:', error);
            return false;
        }
    }

    function addPendingSyncId(metaKey, id) {
        if (!id) return;

        const meta = readSyncMeta();
        meta[metaKey] = Array.from(new Set([...(meta[metaKey] || []), id]));
        saveSyncMeta(meta);
    }

    function removePendingSyncId(metaKey, id) {
        const meta = readSyncMeta();
        meta[metaKey] = (meta[metaKey] || []).filter(item => item !== id);
        saveSyncMeta(meta);
    }

    function isIsoDateString(value) {
        if (typeof value !== 'string' || !value) return false;
        return Number.isFinite(Date.parse(value));
    }

    function normalizeStoredMood(mood) {
        if (!mood || typeof mood !== 'object') return null;

        const tab = typeof mood.tab === 'string' ? mood.tab : '';
        const key = typeof mood.key === 'string' ? mood.key : '';
        if (!MOOD_TABS.includes(tab) || !key) return null;

        return {
            tab,
            key,
            title: typeof mood.title === 'string' ? mood.title : '',
            description: typeof mood.description === 'string' ? mood.description : ''
        };
    }

    function normalizeDiscovery(discovery) {
        if (!discovery || typeof discovery !== 'object') return null;

        const now = new Date().toISOString();
        const target = typeof discovery.target === 'string'
            ? normalizeDiscoverTarget(discovery.target)
            : '';
        const moods = Array.isArray(discovery.moods)
            ? discovery.moods.map(normalizeStoredMood).filter(Boolean)
            : [];

        if (!target || !moods.length) return null;

        return {
            id: typeof discovery.id === 'string' && discovery.id
                ? discovery.id
                : `dis_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            target,
            moods,
            createdAt: isIsoDateString(discovery.createdAt) ? discovery.createdAt : now,
            updatedAt: isIsoDateString(discovery.updatedAt)
                ? discovery.updatedAt
                : isIsoDateString(discovery.createdAt)
                    ? discovery.createdAt
                    : now,
            syncStatus: discovery.syncStatus || 'pending'
        };
    }

    function createLocalStorageBackup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            localStorage.setItem(`moodmeter:backup:v1:${timestamp}`, JSON.stringify({
                userName: localStorage.getItem(STORAGE_KEY_USER_NAME),
                childGender: localStorage.getItem(STORAGE_KEY_CHILD_GENDER),
                discoveries: localStorage.getItem(STORAGE_KEY_DISCOVERIES),
                quizStats: localStorage.getItem(STORAGE_KEY_QUIZ_STATS),
                backedUpAt: new Date().toISOString()
            }));
        } catch (error) {
            console.warn('Failed to back up MoodMeter localStorage before migration:', error);
        }
    }

    function migrateLocalStorageIfNeeded() {
        try {
            const schemaVersion = localStorage.getItem(STORAGE_KEY_SCHEMA_VERSION);
            const needsMigration = schemaVersion !== String(CURRENT_SCHEMA_VERSION);

            if (needsMigration) {
                createLocalStorageBackup();

                const discoveries = loadDiscoveries();
                const quizStats = loadQuizStats();
                localStorage.setItem(STORAGE_KEY_DISCOVERIES, JSON.stringify(discoveries));
                localStorage.setItem(STORAGE_KEY_QUIZ_STATS, JSON.stringify(quizStats));
                localStorage.setItem(STORAGE_KEY_SCHEMA_VERSION, String(CURRENT_SCHEMA_VERSION));
            }

            if (!localStorage.getItem(STORAGE_KEY_SYNC_META)) {
                saveSyncMeta(getDefaultSyncMeta());
            }
        } catch (error) {
            console.warn('Failed to migrate MoodMeter localStorage:', error);
        }
    }

    function loadDiscoveries() {
        try {
            const rawDiscoveries = localStorage.getItem(STORAGE_KEY_DISCOVERIES);
            if (!rawDiscoveries) return [];

            const parsedDiscoveries = JSON.parse(rawDiscoveries);
            if (!Array.isArray(parsedDiscoveries)) return [];

            return parsedDiscoveries.map(normalizeDiscovery).filter(Boolean);
        } catch (error) {
            console.warn('Failed to load mood discoveries from localStorage:', error);
            return [];
        }
    }

    function saveDiscoveries(discoveries) {
        try {
            localStorage.setItem(STORAGE_KEY_DISCOVERIES, JSON.stringify(discoveries));
            state.discoveries = discoveries;
            return true;
        } catch (error) {
            console.warn('Failed to save mood discoveries to localStorage:', error);
            return false;
        }
    }

    function loadQuizStats() {
        try {
            const rawStats = localStorage.getItem(STORAGE_KEY_QUIZ_STATS);
            if (!rawStats) return {};

            const parsedStats = JSON.parse(rawStats);
            if (!parsedStats || typeof parsedStats !== 'object' || Array.isArray(parsedStats)) return {};

            return Object.entries(parsedStats).reduce((stats, [moodId, record]) => {
                if (!record || typeof record !== 'object') return stats;

                stats[moodId] = normalizeQuizStat(record);
                return stats;
            }, {});
        } catch (error) {
            console.warn('Failed to load quiz stats from localStorage:', error);
            return {};
        }
    }

    function saveQuizStats() {
        try {
            localStorage.setItem(STORAGE_KEY_QUIZ_STATS, JSON.stringify(state.quizStats));
            return true;
        } catch (error) {
            console.warn('Failed to save quiz stats to localStorage:', error);
            return false;
        }
    }

    function normalizeQuizStat(record = {}) {
        return {
            shown: Number.isFinite(record.shown) ? Math.max(0, record.shown) : 0,
            correct: Number.isFinite(record.correct) ? Math.max(0, record.correct) : 0,
            wrong: Number.isFinite(record.wrong) ? Math.max(0, record.wrong) : 0,
            lastShownAt: typeof record.lastShownAt === 'string' ? record.lastShownAt : '',
            lastAnsweredAt: typeof record.lastAnsweredAt === 'string' ? record.lastAnsweredAt : '',
            lastWrongAt: typeof record.lastWrongAt === 'string' ? record.lastWrongAt : '',
            updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : '',
            syncStatus: record.syncStatus || 'pending'
        };
    }

    function getQuizStat(moodId) {
        if (!state.quizStats[moodId]) {
            state.quizStats[moodId] = normalizeQuizStat();
        }

        return state.quizStats[moodId];
    }

    function recordQuizShown(moods) {
        const now = new Date().toISOString();
        const changedMoodIds = [];
        moods.forEach(mood => {
            const stat = getQuizStat(mood.moodId);
            stat.shown += 1;
            stat.lastShownAt = now;
            stat.updatedAt = now;
            stat.syncStatus = 'pending';
            addPendingSyncId('pendingQuizStatIds', mood.moodId);
            changedMoodIds.push(mood.moodId);
        });
        saveQuizStats();
        changedMoodIds.forEach(moodId => syncQuizStatToCloud(moodId, state.quizStats[moodId]));
    }

    function recordQuizAnswer(mood, isCorrect) {
        const stat = getQuizStat(mood.moodId);
        const now = new Date().toISOString();
        if (isCorrect) {
            stat.correct += 1;
        } else {
            stat.wrong += 1;
            stat.lastWrongAt = now;
        }
        stat.lastAnsweredAt = now;
        stat.updatedAt = now;
        stat.syncStatus = 'pending';
        addPendingSyncId('pendingQuizStatIds', mood.moodId);
        saveQuizStats();
        syncQuizStatToCloud(mood.moodId, stat);
    }

    function createDiscovery(target, selectedMoods) {
        const now = new Date().toISOString();
        const discovery = {
            id: `dis_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            target,
            moods: selectedMoods.map(toStoredMood),
            createdAt: now,
            updatedAt: now,
            syncStatus: 'pending'
        };

        const saved = saveDiscoveries([discovery, ...state.discoveries]);
        if (saved) {
            addPendingSyncId('pendingDiscoveryIds', discovery.id);
            syncDiscoveryToCloud(discovery);
            trackCloudEvent('discovery_created', { mood_count: discovery.moods.length });
        }
        return saved ? discovery : null;
    }

    function updateDiscovery(id, target, selectedMoods) {
        const now = new Date().toISOString();
        const discoveries = state.discoveries.map(discovery => {
            if (discovery.id !== id) return discovery;

            return {
                ...discovery,
                target,
                moods: selectedMoods.map(toStoredMood),
                updatedAt: now,
                syncStatus: 'pending'
            };
        });

        const saved = saveDiscoveries(discoveries);
        if (saved) {
            const discovery = discoveries.find(item => item.id === id);
            addPendingSyncId('pendingDiscoveryIds', id);
            syncDiscoveryToCloud(discovery);
            trackCloudEvent('discovery_updated', { mood_count: discovery?.moods?.length || 0 });
        }
        return saved;
    }

    function deleteDiscovery(id) {
        const discovery = findDiscoveryById(id);
        const saved = saveDiscoveries(state.discoveries.filter(item => item.id !== id));
        if (saved) {
            if (discovery?.syncStatus === 'synced') {
                addPendingSyncId('pendingDeletedDiscoveryIds', id);
            } else {
                removePendingSyncId('pendingDiscoveryIds', id);
            }
            deleteDiscoveryFromCloud(id);
            trackCloudEvent('discovery_deleted');
        }
        return saved;
    }

    function findDiscoveryById(id) {
        return state.discoveries.find(discovery => discovery.id === id) || null;
    }

    function toStoredMood(mood) {
        return {
            tab: mood.tab,
            key: mood.key,
            title: mood.title,
            description: mood.description
        };
    }

    function getAllMoodsWithTabs() {
        if (!state.data) return [];

        return MOOD_TABS.flatMap(tab => {
            return (state.data[tab] || []).map(mood => ({
                ...mood,
                tab,
                moodId: getMoodId(tab, mood.key)
            }));
        });
    }

    function getMoodId(tab, key) {
        return `${tab}:${key}`;
    }

    function getDiscoveredMoodKeySet() {
        const moodKeySet = new Set();

        state.discoveries.forEach(discovery => {
            discovery.moods.forEach(mood => {
                moodKeySet.add(getMoodId(mood.tab, mood.key));
            });
        });

        return moodKeySet;
    }

    function getDiscoveryTargetsForMood(tab, key) {
        const moodId = getMoodId(tab, key);
        const targets = [];
        const seenTargets = new Set();

        state.discoveries.forEach(discovery => {
            const hasMood = discovery.moods.some(mood => getMoodId(mood.tab, mood.key) === moodId);
            if (!hasMood || seenTargets.has(discovery.target)) return;

            seenTargets.add(discovery.target);
            targets.push(discovery.target);
        });

        return targets;
    }

    function findMood(tab, key) {
        return state.data?.[tab]?.find(mood => mood.key === key) || null;
    }

    function hydrateStoredMood(storedMood) {
        const liveMood = findMood(storedMood.tab, storedMood.key);
        return {
            ...storedMood,
            ...(liveMood || {}),
            tab: storedMood.tab,
            key: storedMood.key,
            title: liveMood?.title || storedMood.title,
            description: liveMood?.description || storedMood.description,
            content: liveMood?.content || ''
        };
    }

    function createQuizSession() {
        const allMoods = getAllMoodsWithTabs();
        const questions = shuffleArray(MOOD_TABS.flatMap(tab => {
            const moods = allMoods.filter(mood => mood.tab === tab);
            return pickBalancedRandomMoods(moods, QUIZ_QUESTION_COUNT_PER_TAB);
        })).map(mood => {
            return {
                mood,
                options: createQuizOptions(mood, allMoods),
                selectedMoodId: null,
                answered: false,
                correct: false,
                showStory: false,
                showResultStory: false
            };
        });

        recordQuizShown(questions.map(question => question.mood));

        state.quizSession = {
            questions,
            currentIndex: 0,
            startedAt: new Date().toISOString(),
            completed: false
        };
    }

    function pickBalancedRandomMoods(moods, count) {
        const available = [...moods];
        const selected = [];

        while (selected.length < count && available.length) {
            const lowestShown = Math.min(...available.map(mood => getQuizStat(mood.moodId).shown));
            const balancedPool = available.filter(mood => getQuizStat(mood.moodId).shown <= lowestShown + 1);
            const picked = balancedPool[Math.floor(Math.random() * balancedPool.length)];
            selected.push(picked);
            available.splice(available.findIndex(mood => mood.moodId === picked.moodId), 1);
        }

        return selected;
    }

    function createQuizOptions(correctMood, allMoods) {
        const sameTabCandidates = allMoods.filter(mood => {
            return mood.tab === correctMood.tab && mood.moodId !== correctMood.moodId;
        });
        const otherCandidates = allMoods.filter(mood => {
            return mood.tab !== correctMood.tab && mood.moodId !== correctMood.moodId;
        });
        const sameTabDistractors = shuffleArray(sameTabCandidates.filter(mood => !isQuizSimilarMood(correctMood, mood)));
        const otherDistractors = shuffleArray(otherCandidates.filter(mood => !isQuizSimilarMood(correctMood, mood)));
        const distractors = [...sameTabDistractors.slice(0, 2), ...otherDistractors]
            .filter((mood, index, array) => array.findIndex(item => item.moodId === mood.moodId) === index)
            .slice(0, QUIZ_OPTION_COUNT - 1);

        return shuffleArray([correctMood, ...distractors]);
    }

    function isQuizSimilarMood(correctMood, candidateMood) {
        if (!correctMood || !candidateMood || correctMood.moodId === candidateMood.moodId) return true;

        const correctTitle = normalizeMoodTitleForQuiz(correctMood.title);
        const candidateTitle = normalizeMoodTitleForQuiz(candidateMood.title);
        if (correctTitle && correctTitle === candidateTitle) return true;

        return QUIZ_SIMILAR_MOOD_KEY_GROUPS.some(group => {
            return group.includes(correctMood.key) && group.includes(candidateMood.key);
        });
    }

    function normalizeMoodTitleForQuiz(title) {
        return getMoodDisplayTitle(title)
            .replace(/^마음이\s*/u, '')
            .replace(/\s+/gu, '')
            .trim();
    }

    function shuffleArray(items) {
        const shuffled = [...items];
        for (let index = shuffled.length - 1; index > 0; index -= 1) {
            const randomIndex = Math.floor(Math.random() * (index + 1));
            [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
        }
        return shuffled;
    }

    function getWrongQuizMoods() {
        return getAllMoodsWithTabs()
            .filter(mood => getQuizStat(mood.moodId).wrong > 0)
            .sort((a, b) => {
                const aStat = getQuizStat(a.moodId);
                const bStat = getQuizStat(b.moodId);
                return (bStat.lastWrongAt || '').localeCompare(aStat.lastWrongAt || '')
                    || bStat.wrong - aStat.wrong;
            });
    }

    function getQuizQuestionPrompt(mood) {
        const displayTitle = getMoodDisplayTitle(mood.title);
        const escapedTitle = escapeRegExp(mood.title);
        const escapedDisplayTitle = escapeRegExp(displayTitle);
        const answerLeadPattern = new RegExp(
            `^\\s*(?:${escapedTitle}|${escapedDisplayTitle}\\s*마음|${escapedDisplayTitle})\\s*은\\s*`,
            'u'
        );
        const clue = formatMoodContent(mood.description)
            .replace(answerLeadPattern, '')
            .trim();

        return clue || '그림과 이야기를 살펴보고 어울리는 감정을 골라 보세요.';
    }

    function getQuizStoryPrompt(mood) {
        const displayTitle = getMoodDisplayTitle(mood.title);
        const maskedStory = formatMoodContent(mood.content)
            .replace(new RegExp(`${escapeRegExp(displayTitle)}\\s*마음`, 'gu'), '이런 마음')
            .replace(new RegExp(escapeRegExp(mood.title), 'gu'), '이런 마음')
            .replace(new RegExp(escapeRegExp(displayTitle), 'gu'), '이런')
            .replace(/이런 마음이라고 해요\./gu, '어떤 마음인지 골라 보세요.');

        return maskedStory;
    }

    function escapeRegExp(value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return '';

        return new Intl.DateTimeFormat('ko-KR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }).format(date);
    }

    function escapeHtml(text) {
        if (typeof text !== 'string') return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Load mood data
    async function loadData() {
        try {
            const response = await fetch('moodmeter.json');
            if (!response.ok) throw new Error('Failed to load data');

            state.data = await response.json();
            state.loading = false;
        } catch (error) {
            console.error('Error loading data:', error);
            state.error = '데이터를 불러오는데 실패했습니다.';
            state.loading = false;
        }
    }

    // Setup event listeners
    function setupEventListeners() {
        // Tab buttons
        elements.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                if (!NAV_TABS.includes(tab)) return;

                if (tab === 'discover' && hasDiscoverDraftProgress()) {
                    navigateTo(getDiscoverDraftRoute());
                    return;
                }

                navigateTo(`#/${tab}`);
            });
        });

        // Header settings button
        elements.settingsBtn.addEventListener('click', () => {
            navigateTo('#/settings');
        });

        elements.quizBtn.addEventListener('click', () => {
            navigateTo('#/quiz');
        });

        // Back button
        elements.backBtn.addEventListener('click', () => {
            if (state.currentTab === 'quiz') {
                navigateTo('#/quiz');
                return;
            }

            if (state.currentTab === 'discover') {
                navigateTo('#/discover');
                return;
            }
            navigateTo(`#/${state.currentTab}`);
        });

        // Hash change
        window.addEventListener('hashchange', handleRoute);
        window.addEventListener('resize', scheduleChipRiverSetup);

        // Handle keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && state.discoverDraft.infoMoodKey) {
                state.discoverDraft.infoMoodKey = null;
                if (state.currentTab === 'discover') handleRoute();
                return;
            }

            if (e.key === 'Escape' && state.currentMood) {
                navigateTo(`#/${state.currentTab}`);
            }

            if (e.key === 'Escape' && state.currentTab === 'quiz') {
                navigateTo('#/quiz');
            }
        });
    }

    function getCloud() {
        return window.MoodMeterCloud || null;
    }

    function isSettingsRoute() {
        return (window.location.hash || '#/').slice(2).split('/').filter(Boolean)[0] === 'settings';
    }

    function setupCloudSyncIfAvailable() {
        if (!getCloud() && !window.MoodMeterCloudReady) {
            window.addEventListener('moodmeter-cloud-ready', setupCloudSyncIfAvailable, { once: true });
            return;
        }

        const ready = window.MoodMeterCloudReady || Promise.resolve(getCloud()?.init?.());
        Promise.resolve(ready)
            .then(result => {
                const cloud = getCloud();
                state.cloud.available = Boolean(cloud && result?.available !== false);

                if (!cloud) return;

                cloud.onUserChanged(user => {
                    state.cloud.user = user;
                    state.cloud.status = user
                        ? '기록이 안전하게 보관되고 있어요.'
                        : '지금은 이 기기에만 기록되고 있어요.';
                    state.cloud.error = '';

                    if (user) {
                        refreshLocalDataFromCloud();
                    }

                    if (isSettingsRoute()) renderSettings();
                });
            })
            .catch(error => {
                console.warn('MoodMeter cloud sync is unavailable:', error);
                state.cloud.available = false;
                state.cloud.error = '온라인 보관을 준비하지 못했어요. 이 기기에는 계속 저장돼요.';
                if (isSettingsRoute()) renderSettings();
            });
    }

    function refreshLocalDataFromCloud() {
        const cloud = getCloud();
        const syncCloudData = cloud?.syncLocalDataToCloud || cloud?.mergeCloudDataToLocal;
        if (!syncCloudData) return;

        state.cloud.syncing = true;
        syncCloudData()
            .then(result => {
                if (result?.ok) {
                    loadUserName();
                    loadChildGender();
                    state.discoveries = loadDiscoveries();
                    state.quizStats = loadQuizStats();
                    state.cloud.status = '기록이 안전하게 보관되고 있어요.';
                    state.cloud.error = '';
                    trackCloudEvent('cloud_data_synced');
                } else if (result?.skipped) {
                    state.cloud.status = '지금은 이 기기에만 기록되고 있어요.';
                }
            })
            .catch(error => {
                console.warn('Failed to sync local data with cloud:', error);
                state.cloud.error = '이 기기에는 저장되었지만, 온라인 보관은 잠시 뒤 다시 시도해 주세요.';
            })
            .finally(() => {
                state.cloud.syncing = false;
                if (isSettingsRoute()) renderSettings();
            });
    }

    function syncUserProfileToCloud() {
        const cloud = getCloud();
        if (!cloud?.saveUserProfile || !cloud.getCurrentUser?.()) return;

        cloud.saveUserProfile().then(result => {
            if (!result?.ok) {
                state.cloud.error = '이 기기에는 저장되었지만, 온라인 보관은 잠시 뒤 다시 시도해 주세요.';
            }
            if (isSettingsRoute()) renderSettings();
        });
    }

    function syncDiscoveryToCloud(discovery) {
        const cloud = getCloud();
        if (!cloud?.saveDiscovery || !cloud.getCurrentUser?.() || !discovery) return;

        cloud.saveDiscovery(discovery).then(result => {
            state.discoveries = loadDiscoveries();
            if (result?.ok) {
                removePendingSyncId('pendingDiscoveryIds', discovery.id);
                state.cloud.status = '기록이 안전하게 보관되고 있어요.';
                state.cloud.error = '';
            } else {
                state.cloud.error = '이 기기에는 저장되었지만, 온라인 보관은 잠시 뒤 다시 시도해 주세요.';
            }
            if (state.currentTab === 'discover') handleRoute();
        });
    }

    function deleteDiscoveryFromCloud(id) {
        const cloud = getCloud();
        if (!cloud?.deleteDiscovery || !cloud.getCurrentUser?.() || !id) return;

        cloud.deleteDiscovery(id).then(result => {
            if (result?.ok) {
                removePendingSyncId('pendingDeletedDiscoveryIds', id);
            } else {
                state.cloud.error = '이 기기에서는 지웠지만, 온라인 기록 정리는 잠시 뒤 다시 시도해 주세요.';
            }
            if (isSettingsRoute()) renderSettings();
        });
    }

    function syncQuizStatToCloud(moodId, stat) {
        const cloud = getCloud();
        if (!cloud?.saveQuizStats || !cloud.getCurrentUser?.() || !moodId) return;

        cloud.saveQuizStats(moodId, stat).then(result => {
            state.quizStats = loadQuizStats();
            if (result?.ok) {
                removePendingSyncId('pendingQuizStatIds', moodId);
            } else {
                state.cloud.error = '이 기기에는 저장되었지만, 온라인 보관은 잠시 뒤 다시 시도해 주세요.';
            }
        });
    }

    function trackCloudEvent(eventName, params = {}) {
        const cloud = getCloud();
        if (!cloud?.trackEvent) return;
        cloud.trackEvent(eventName, params);
    }

    // Navigate to a route
    function navigateTo(hash) {
        if (window.location.hash === hash) {
            handleRoute();
            return;
        }

        window.location.hash = hash;
    }

    function decodeRoutePart(value) {
        try {
            return decodeURIComponent(value);
        } catch (error) {
            return value;
        }
    }

    // Handle routing
    function handleRoute() {
        const hash = window.location.hash || '#/';
        const parts = hash.slice(2).split('/').filter(Boolean);
        trackCloudEvent('screen_view', {
            firebase_screen: parts[0] || 'yellow'
        });
        elements.mainContent.classList.remove('detail-main');

        if (parts.length === 0) {
            // Default to yellow
            state.currentTab = 'yellow';
            state.currentMood = null;
            state.detailStoryExpanded = false;
            renderList();
            return;
        }

        if (parts[0] === 'quiz') {
            state.currentTab = 'quiz';
            state.currentMood = null;
            state.detailStoryExpanded = false;

            if (parts.length === 1) {
                renderQuizIntro();
                return;
            }

            if (parts.length === 2 && parts[1] === 'play') {
                renderQuizPlay();
                return;
            }

            if (parts.length === 2 && parts[1] === 'review') {
                renderQuizReview();
                return;
            }

            navigateTo('#/quiz');
            return;
        }

        if (parts[0] === 'discover') {
            state.currentTab = 'discover';
            state.currentMood = null;
            state.detailStoryExpanded = false;

            if (parts.length === 1) {
                renderDiscoverList();
                return;
            }

            if (parts.length === 2 && parts[1] === 'new') {
                renderDiscoverEditor();
                return;
            }

            if (parts.length === 2) {
                renderDiscoverResult(decodeRoutePart(parts[1]));
                return;
            }

            if (parts.length === 3 && parts[2] === 'edit') {
                renderDiscoverEditor(decodeRoutePart(parts[1]));
                return;
            }

            navigateTo('#/discover');
            return;
        }

        if (parts.length === 1 && MOOD_TABS.includes(parts[0])) {
            state.currentTab = parts[0];
            state.currentMood = null;
            state.detailStoryExpanded = false;
            renderList();
            return;
        }

        if (parts.length === 1 && parts[0] === 'settings') {
            state.currentMood = null;
            state.detailStoryExpanded = false;
            renderSettings();
            return;
        }

        if (parts.length === 2) {
            const [tab, key] = parts;
            if (MOOD_TABS.includes(tab)) {
                state.currentTab = tab;
                const mood = state.data?.[tab]?.find(m => m.key === key);
                if (mood) {
                    state.currentMood = mood;
                    state.detailStoryExpanded = false;
                    renderDetail();
                } else {
                    navigateTo(`#/${tab}`);
                }
            } else {
                navigateTo('#/');
            }
            return;
        }

        navigateTo('#/');
    }

    // Update active tab
    function updateActiveTab() {
        elements.tabBtns.forEach(btn => {
            const isActive = btn.dataset.tab === state.currentTab;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive);
        });
    }

    // Render list view
    function renderList() {
        updateActiveTab();
        elements.backBtn.classList.add('hidden');
        elements.quizBtn.classList.remove('hidden');
        elements.settingsBtn.classList.remove('hidden');
        elements.tabBar.classList.remove('hidden');
        elements.headerTitle.textContent = 'Mood Meter';

        const moods = state.data?.[state.currentTab] || [];

        // Reset scroll to top
        window.scrollTo(0, 0);
        elements.mainContent.scrollTop = 0;

        if (state.loading) {
            elements.mainContent.innerHTML = '<div class="loading"></div>';
            return;
        }

        if (state.error) {
            elements.mainContent.innerHTML = `
                <div class="error">
                    <p class="error-title">오류</p>
                    <p>${state.error}</p>
                </div>
            `;
            return;
        }

        elements.mainContent.innerHTML = `
            <div class="mood-list" role="list">
                ${moods.map(mood => renderMoodCard(mood)).join('')}
            </div>
        `;

        scheduleChipRiverSetup();

        // Setup lazy loading for images
        setupLazyLoading();
    }

    function prepareDiscoverShell(title, showBack = false, resetScroll = true) {
        updateActiveTab();
        elements.backBtn.classList.toggle('hidden', !showBack);
        elements.quizBtn.classList.toggle('hidden', showBack);
        elements.settingsBtn.classList.remove('hidden');
        elements.tabBar.classList.remove('hidden');
        elements.headerTitle.textContent = title;
        if (resetScroll) {
            window.scrollTo(0, 0);
            elements.mainContent.scrollTop = 0;
        }
    }

    function resetDiscoverDraft(discovery) {
        state.discoverDraft = {
            target: discovery?.target || '',
            selectedMoodKeys: discovery?.moods?.map(mood => getMoodId(mood.tab, mood.key)) || [],
            filter: 'all',
            infoMoodKey: null,
            error: '',
            editingId: discovery?.id || null
        };
    }

    function renderDiscoverList() {
        prepareDiscoverShell('알아가기');

        const discoveries = state.discoveries;
        const listHtml = discoveries.length ? `
            <div class="discover-list" role="list">
                ${discoveries.map(discovery => {
                    const moods = discovery.moods.map(hydrateStoredMood);

                    return `
                        <a class="discover-card" href="#/discover/${encodeURIComponent(discovery.id)}" role="listitem">
                            <div class="discover-card-main">
                                <h2 class="discover-card-title">${escapeHtml(discovery.target)}</h2>
                                ${renderDiscoverMoodChips(moods)}
                            </div>
                            <time class="discover-card-date" datetime="${escapeHtml(discovery.createdAt)}">${formatDate(discovery.createdAt)}</time>
                        </a>
                    `;
                }).join('')}
            </div>
        ` : `
            <div class="discover-empty">
                <p>새로 알아가기를 눌러 시작해 주세요.</p>
                <p>내 감정들을 알아가며 나를 더 잘 이해할 수 있어요.</p>
            </div>
        `;

        elements.mainContent.innerHTML = `
            <div class="discover-view">
                <div class="discover-top-actions">
                    <button type="button" class="discover-primary-btn" id="discover-new-btn">새로 알아가기</button>
                </div>
                ${listHtml}
            </div>
        `;

        document.getElementById('discover-new-btn').addEventListener('click', () => {
            resetDiscoverDraft();
            navigateTo('#/discover/new');
        });

        scheduleChipRiverSetup();
    }

    function renderDiscoverMoodChips(moods) {
        const chips = moods.map(mood => `
            <span class="discover-mood-chip ${mood.tab}">${escapeHtml(getMoodDisplayTitle(mood.title))}</span>
        `).join('');

        if (prefersReducedMotion()) {
            return `
                <div class="discover-card-moods" aria-label="알아본 감정">
                    ${chips}
                </div>
            `;
        }

        return renderChipRiver({
            className: 'discover-card-moods chip-river chip-river--mood',
            label: '알아본 감정',
            chips
        });
    }

    function renderChipRiver({ className, label, chips }) {
        return `
            <div class="${className}" role="group" tabindex="0" aria-label="${escapeHtml(label)}" data-chip-river>
                <div class="chip-river__track">
                    <div class="chip-river__set">
                        ${chips}
                    </div>
                </div>
            </div>
        `;
    }

    function scheduleChipRiverSetup() {
        if (chipRiverFrameId !== null) {
            cancelAnimationFrame(chipRiverFrameId);
        }

        chipRiverFrameId = requestAnimationFrame(() => {
            chipRiverFrameId = null;
            setupChipRivers();
        });
    }

    function setupChipRivers() {
        if (prefersReducedMotion()) return;

        document.querySelectorAll('[data-chip-river]').forEach(river => {
            const track = river.querySelector('.chip-river__track');
            const set = track?.querySelector('.chip-river__set:not([aria-hidden="true"])');
            if (!track || !set) return;

            track.querySelectorAll('.chip-river__set[aria-hidden="true"]').forEach(clone => clone.remove());
            river.classList.remove('is-flowing');

            const shouldFlow = set.scrollWidth > river.clientWidth + 1;
            if (!shouldFlow) return;

            const clone = set.cloneNode(true);
            clone.setAttribute('aria-hidden', 'true');
            track.appendChild(clone);
            const distance = set.getBoundingClientRect().width;
            const duration = distance / CHIP_RIVER_PIXELS_PER_SECOND;
            river.style.setProperty('--chip-river-distance', `${distance}px`);
            river.style.setProperty('--chip-river-duration', `${duration.toFixed(2)}s`);
            river.classList.add('is-flowing');
        });
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function hasDiscoverDraftProgress() {
        return Boolean(
            state.discoverDraft.target
            || state.discoverDraft.selectedMoodKeys.length
            || state.discoverDraft.infoMoodKey
            || state.discoverDraft.error
            || state.discoverDraft.editingId
            || state.discoverDraft.filter !== 'all'
        );
    }

    function getDiscoverDraftRoute() {
        if (state.discoverDraft.editingId) {
            return `#/discover/${encodeURIComponent(state.discoverDraft.editingId)}/edit`;
        }

        return '#/discover/new';
    }

    function renderDiscoverEditor(discoveryId, focusTarget, resetScroll = true, preservedScrollTop = 0, preservedWindowScrollY = 0) {
        const editingDiscovery = discoveryId ? findDiscoveryById(discoveryId) : null;
        if (discoveryId && !editingDiscovery) {
            navigateTo('#/discover');
            return;
        }

        if (discoveryId && state.discoverDraft.editingId !== discoveryId) {
            resetDiscoverDraft(editingDiscovery);
        }

        prepareDiscoverShell(editingDiscovery ? '다시 수정' : '새로 알아가기', true, resetScroll);

        const allMoods = getAllMoodsWithTabs();
        const selectedMoodSet = new Set(state.discoverDraft.selectedMoodKeys);
        const discoveredMoodSet = getDiscoveredMoodKeySet();
        const selectedMoods = allMoods.filter(mood => selectedMoodSet.has(mood.moodId));
        const filteredMoods = allMoods.filter(mood => {
            if (state.discoverDraft.filter === 'discovered') {
                return discoveredMoodSet.has(mood.moodId);
            }

            if (state.discoverDraft.filter === 'undiscovered') {
                return !discoveredMoodSet.has(mood.moodId);
            }

            return state.discoverDraft.filter === 'all' || mood.tab === state.discoverDraft.filter;
        });
        const infoMood = state.discoverDraft.infoMoodKey
            ? allMoods.find(mood => mood.moodId === state.discoverDraft.infoMoodKey)
            : null;

        elements.mainContent.innerHTML = `
            <div class="discover-view discover-editor">
                <form class="discover-form" id="discover-form">
                    <label class="discover-label" for="discover-target">오늘 마음에 남은 일을 적어볼까요?</label>
                    <input
                        id="discover-target"
                        class="discover-input"
                        type="text"
                        maxlength="60"
                        placeholder="예: 친구와 놀았던 일, 수학 시험, 엄마에게 들은 말"
                        value="${escapeHtml(state.discoverDraft.target)}"
                    >
                    <p class="discover-status ${state.discoverDraft.error ? 'is-error' : ''}" aria-live="polite">${escapeHtml(state.discoverDraft.error)}</p>
                </form>

                ${renderSelectedMoodChips(selectedMoods)}
                ${renderMoodPicker(filteredMoods, selectedMoodSet)}
                ${infoMood ? renderMoodInfoPanel(infoMood, selectedMoodSet.has(infoMood.moodId)) : ''}

                <div class="discover-save-bar">
                    <span>${selectedMoods.length}개 선택됨</span>
                    <button type="button" class="discover-primary-btn" id="discover-save-btn" ${selectedMoods.length ? '' : 'disabled'}>알아가기 완성</button>
                </div>
            </div>
        `;

        bindDiscoverEditorEvents(editingDiscovery);

        if (!resetScroll) {
            elements.mainContent.scrollTop = preservedScrollTop;
            window.scrollTo(0, preservedWindowScrollY);
        }
    }

    function renderSelectedMoodChips(selectedMoods) {
        return `
            <div class="selected-mood-chips" aria-label="선택한 감정">
                ${selectedMoods.length ? selectedMoods.map(mood => `
                    <button type="button" class="selected-mood-chip ${mood.tab}" data-remove-mood="${mood.moodId}">
                        ${escapeHtml(getMoodDisplayTitle(mood.title))}
                        <span aria-hidden="true">×</span>
                    </button>
                `).join('') : '<p class="selected-mood-empty">느낀 마음을 하나 이상 골라 주세요.</p>'}
            </div>
        `;
    }

    function rerenderDiscoverEditor(editingDiscovery, focusTarget) {
        const preservedScrollTop = elements.mainContent.scrollTop;
        const preservedWindowScrollY = window.scrollY;
        renderDiscoverEditor(editingDiscovery?.id, focusTarget, false, preservedScrollTop, preservedWindowScrollY);
    }

    function renderMoodPicker(moods, selectedMoodSet) {
        const filterTabs = [
            { key: 'all', label: '전체' },
            ...MOOD_TABS.map(tab => ({ key: tab, label: TAB_LABELS[tab] })),
            { key: 'discovered', label: '알아본 적 있음' },
            { key: 'undiscovered', label: '알아본 적 없음' }
        ];

        return `
            <section class="mood-picker" aria-label="감정 선택">
                <div class="mood-picker-toolbar">
                    <div class="mood-filter-tabs" role="group" aria-label="감정 필터">
                        ${filterTabs.map(tab => `
                            <button type="button"
                                    class="mood-filter-btn ${state.discoverDraft.filter === tab.key ? 'active' : ''}"
                                    data-filter="${tab.key}">
                                ${tab.label}
                            </button>
                        `).join('')}
                    </div>
                </div>
                <div class="selectable-mood-grid">
                    ${moods.length ? moods.map(mood => {
                        const selected = selectedMoodSet.has(mood.moodId);

                        return `
                            <article class="selectable-mood-card ${mood.tab} ${selected ? 'selected' : ''}">
                                <button type="button"
                                        class="selectable-mood-main"
                                        data-toggle-mood="${mood.moodId}"
                                        aria-pressed="${selected}">
                                    <span class="selectable-mood-title">${escapeHtml(getMoodDisplayTitle(mood.title))}</span>
                                </button>
                                <button type="button" class="mood-info-btn" data-info-mood="${mood.moodId}" aria-label="${escapeHtml(mood.title)} 자세히 보기">?</button>
                            </article>
                        `;
                    }).join('') : '<p class="mood-picker-empty">여기에 보이는 감정이 없어요.</p>'}
                </div>
            </section>
        `;
    }

    function renderMoodInfoPanel(mood, selected) {
        return `
            <div class="mood-info-backdrop" id="mood-info-backdrop">
                <section class="mood-info-panel" aria-label="${escapeHtml(mood.title)} 이야기">
                    <div class="mood-info-panel-header">
                        <h2>${escapeHtml(getMoodDisplayTitle(mood.title))}</h2>
                        <button type="button" class="mood-info-close" id="mood-info-close" aria-label="닫기">×</button>
                    </div>
                    <p class="mood-info-description">${escapeHtml(mood.description)}</p>
                    <p>${escapeHtml(formatMoodContent(mood.content))}</p>
                    <button
                        type="button"
                        class="mood-info-select-btn ${mood.tab} ${selected ? 'selected' : ''}"
                        data-panel-toggle-mood="${mood.moodId}"
                        aria-pressed="${selected}">
                        ${selected ? '선택 해제' : '선택하기'}
                    </button>
                </section>
            </div>
        `;
    }

    function bindDiscoverEditorEvents(editingDiscovery) {
        const form = document.getElementById('discover-form');
        const targetInput = document.getElementById('discover-target');
        const saveBtn = document.getElementById('discover-save-btn');

        targetInput.addEventListener('input', () => {
            state.discoverDraft.target = targetInput.value;
            state.discoverDraft.error = '';
        });

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            saveBtn.click();
        });

        elements.mainContent.querySelectorAll('[data-filter]').forEach(button => {
            button.addEventListener('click', () => {
                state.discoverDraft.filter = button.dataset.filter;
                rerenderDiscoverEditor(editingDiscovery);
            });
        });

        elements.mainContent.querySelectorAll('[data-toggle-mood]').forEach(button => {
            button.addEventListener('click', () => {
                toggleDraftMood(button.dataset.toggleMood);
                rerenderDiscoverEditor(editingDiscovery);
            });
        });

        elements.mainContent.querySelectorAll('[data-remove-mood]').forEach(button => {
            button.addEventListener('click', () => {
                toggleDraftMood(button.dataset.removeMood);
                rerenderDiscoverEditor(editingDiscovery);
            });
        });

        elements.mainContent.querySelectorAll('[data-info-mood]').forEach(button => {
            button.addEventListener('click', () => {
                state.discoverDraft.infoMoodKey = button.dataset.infoMood;
                rerenderDiscoverEditor(editingDiscovery);
            });
        });

        const infoCloseBtn = document.getElementById('mood-info-close');
        if (infoCloseBtn) {
            infoCloseBtn.addEventListener('click', () => {
                state.discoverDraft.infoMoodKey = null;
                rerenderDiscoverEditor(editingDiscovery);
            });
        }

        const infoBackdrop = document.getElementById('mood-info-backdrop');
        if (infoBackdrop) {
            infoBackdrop.addEventListener('click', (event) => {
                if (event.target !== infoBackdrop) return;
                state.discoverDraft.infoMoodKey = null;
                rerenderDiscoverEditor(editingDiscovery);
            });
        }

        const infoSelectBtn = elements.mainContent.querySelector('[data-panel-toggle-mood]');
        if (infoSelectBtn) {
            infoSelectBtn.addEventListener('click', () => {
                toggleDraftMood(infoSelectBtn.dataset.panelToggleMood);
                state.discoverDraft.infoMoodKey = null;
                rerenderDiscoverEditor(editingDiscovery);
            });
        }

        saveBtn.addEventListener('click', () => {
            const target = normalizeDiscoverTarget(targetInput.value);
            const allMoods = getAllMoodsWithTabs();
            const selectedMoodSet = new Set(state.discoverDraft.selectedMoodKeys);
            const selectedMoods = allMoods.filter(mood => selectedMoodSet.has(mood.moodId));

            if (!target) {
                state.discoverDraft.error = '무엇에 대한 마음인지 먼저 적어 주세요.';
                rerenderDiscoverEditor(editingDiscovery);
                return;
            }

            if (!selectedMoods.length) {
                state.discoverDraft.error = '마음을 하나 이상 골라 주세요.';
                rerenderDiscoverEditor(editingDiscovery);
                return;
            }

            if (editingDiscovery) {
                const saved = updateDiscovery(editingDiscovery.id, target, selectedMoods);
                if (saved) {
                    resetDiscoverDraft();
                    navigateTo(`#/discover/${editingDiscovery.id}`);
                } else {
                    state.discoverDraft.error = '저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.';
                    rerenderDiscoverEditor(editingDiscovery);
                }
                return;
            }

            const discovery = createDiscovery(target, selectedMoods);
            if (discovery) {
                resetDiscoverDraft();
                navigateTo(`#/discover/${discovery.id}`);
            } else {
                state.discoverDraft.error = '저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.';
                rerenderDiscoverEditor(editingDiscovery);
            }
        });
    }

    function normalizeDiscoverTarget(value) {
        if (typeof value !== 'string') return '';
        return value.trim().replace(/\s+/g, ' ').slice(0, 60);
    }

    function toggleDraftMood(moodId) {
        const selectedMoodSet = new Set(state.discoverDraft.selectedMoodKeys);
        if (selectedMoodSet.has(moodId)) {
            selectedMoodSet.delete(moodId);
        } else {
            selectedMoodSet.add(moodId);
        }

        state.discoverDraft.selectedMoodKeys = Array.from(selectedMoodSet);
        state.discoverDraft.error = '';
    }

    function renderDiscoverResult(discoveryId) {
        const discovery = findDiscoveryById(discoveryId);
        if (!discovery) {
            navigateTo('#/discover');
            return;
        }

        prepareDiscoverShell('알아가기', true);

        const hydratedDiscovery = {
            ...discovery,
            moods: discovery.moods.map(hydrateStoredMood)
        };

        elements.mainContent.innerHTML = `
            <div class="discover-view constellation-view">
                <div class="constellation-actions">
                    <button type="button" class="discover-secondary-btn" id="discover-edit-btn">감정 다시 고르기</button>
                    <button type="button" class="discover-danger-btn" id="discover-delete-btn">삭제</button>
                </div>
                ${renderEmotionConstellation(hydratedDiscovery)}
                <div class="constellation-meta">
                    <time datetime="${escapeHtml(discovery.createdAt)}">${formatDate(discovery.createdAt)}</time>
                    <p>${hydratedDiscovery.moods.length}개의 마음을 알아봤어요.</p>
                </div>
            </div>
        `;

        document.getElementById('discover-edit-btn').addEventListener('click', () => {
            resetDiscoverDraft(discovery);
            navigateTo(`#/discover/${discovery.id}/edit`);
        });
        document.getElementById('discover-delete-btn').addEventListener('click', () => {
            if (!window.confirm('이 알아가기 기록을 삭제할까요?')) return;

            if (deleteDiscovery(discovery.id)) {
                navigateTo('#/discover');
            } else {
                elements.mainContent.insertAdjacentHTML('afterbegin', '<p class="discover-status is-error">삭제하지 못했어요. 잠시 뒤 다시 시도해 주세요.</p>');
            }
        });
        setupConstellationSpread();
    }

    function prepareQuizShell(title, showBack = false, showTabBar = false) {
        updateActiveTab();
        elements.backBtn.classList.toggle('hidden', !showBack);
        elements.quizBtn.classList.add('hidden');
        elements.settingsBtn.classList.add('hidden');
        elements.tabBar.classList.toggle('hidden', !showTabBar);
        elements.headerTitle.textContent = title;
        window.scrollTo(0, 0);
        elements.mainContent.scrollTop = 0;
    }

    function renderQuizIntro() {
        prepareQuizShell('감정 퀴즈', false, true);

        const wrongMoods = getWrongQuizMoods();

        elements.mainContent.innerHTML = `
            <div class="quiz-view quiz-intro">
                <section class="quiz-card quiz-landing-card">
                    <p class="quiz-kicker">색깔마다 2개씩</p>
                    <h2 class="quiz-title">그림 속 마음을 찾아볼까요?</h2>
                    <p class="quiz-description">그림과 짧은 단서를 보고 어울리는 감정을 골라요. 몰랐던 감정은 나중에 다시 살펴볼 수 있어요.</p>
                    <div class="quiz-intro-actions">
                        <button type="button" class="quiz-primary-btn" id="quiz-start-btn">시작</button>
                        <button type="button" class="quiz-secondary-btn" id="quiz-review-btn" ${wrongMoods.length ? '' : 'disabled'}>몰랐던 감정들 다시 보기</button>
                    </div>
                </section>
            </div>
        `;

        document.getElementById('quiz-start-btn').addEventListener('click', () => {
            createQuizSession();
            navigateTo('#/quiz/play');
        });

        document.getElementById('quiz-review-btn').addEventListener('click', () => {
            if (wrongMoods.length) navigateTo('#/quiz/review');
        });
    }

    function renderQuizPlay() {
        if (!state.quizSession?.questions?.length) {
            createQuizSession();
        }

        prepareQuizShell('감정 퀴즈', true, false);

        const session = state.quizSession;
        const question = session.questions[session.currentIndex];

        if (!question) {
            renderQuizResult();
            return;
        }

        const questionNumber = session.currentIndex + 1;
        const imageUrl = getMoodImageUrl(question.mood);
        const questionPrompt = getQuizQuestionPrompt(question.mood);

        elements.mainContent.innerHTML = `
            <div class="quiz-view">
                <div class="quiz-progress" aria-label="퀴즈 진행">
                    <span>${questionNumber} / ${session.questions.length}</span>
                    <div class="quiz-progress-track">
                        <div class="quiz-progress-fill" style="width: ${(questionNumber / session.questions.length) * 100}%"></div>
                    </div>
                </div>
                <section class="quiz-question-card ${question.mood.tab}">
                    <div class="quiz-question-image-wrap">
                        <img class="quiz-question-image" src="${imageUrl}" alt="감정 퀴즈 그림">
                    </div>
                    <div class="quiz-question-copy">
                        <p class="quiz-question-label">어떤 마음일까요?</p>
                        <p class="quiz-question-description">${escapeHtml(questionPrompt)}</p>
                        <button type="button" class="quiz-story-toggle" id="quiz-story-toggle">
                            ${question.showStory ? '이야기 접기' : '자세한 이야기 보기'}
                        </button>
                        ${question.showStory ? `
                            <div class="quiz-story-panel">
                                <p>${escapeHtml(getQuizStoryPrompt(question.mood))}</p>
                            </div>
                        ` : ''}
                    </div>
                </section>
                <div class="quiz-answer-area ${question.answered ? 'is-answered' : ''}">
                    <div class="quiz-options" role="list">
                        ${question.options.map(option => renderQuizOption(question, option)).join('')}
                    </div>
                    ${question.answered ? renderQuizFeedback(question) : ''}
                </div>
            </div>
        `;

        elements.mainContent.querySelectorAll('[data-quiz-option]').forEach(button => {
            button.addEventListener('click', () => {
                answerQuizQuestion(button.dataset.quizOption);
            });
        });

        const storyToggleBtn = document.getElementById('quiz-story-toggle');
        if (storyToggleBtn) {
            storyToggleBtn.addEventListener('click', () => {
                question.showStory = !question.showStory;
                renderQuizPlay();
            });
        }

        const nextBtn = document.getElementById('quiz-next-btn');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (session.currentIndex >= session.questions.length - 1) {
                    session.completed = true;
                    renderQuizResult();
                    return;
                }

                session.currentIndex += 1;
                renderQuizPlay();
            });
        }
    }

    function renderQuizOption(question, option) {
        const isSelected = question.selectedMoodId === option.moodId;
        const isCorrect = option.moodId === question.mood.moodId;
        const resultClass = question.answered && isCorrect
            ? 'is-correct'
            : question.answered && isSelected
                ? 'is-wrong'
                : '';

        return `
            <button type="button"
                    class="quiz-option ${option.tab} ${resultClass}"
                    data-quiz-option="${option.moodId}"
                    ${question.answered ? 'disabled' : ''}
                    role="listitem">
                <span class="quiz-option-dot" aria-hidden="true"></span>
                <span>${escapeHtml(getMoodDisplayTitle(option.title))}</span>
            </button>
        `;
    }

    function renderQuizFeedback(question) {
        const message = question.correct
            ? '맞았어요!'
            : `이 감정은 ${escapeHtml(question.mood.title)}이에요.`;

        return `
            <section class="quiz-feedback ${question.correct ? 'correct' : 'wrong'}" aria-live="polite" aria-label="퀴즈 결과">
                <div>
                    <p class="quiz-feedback-kicker">${question.correct ? '좋아요' : '새로 알았어요'}</p>
                    <p class="quiz-feedback-message">${message}</p>
                </div>
                <button type="button" class="quiz-primary-btn" id="quiz-next-btn">
                    ${state.quizSession.currentIndex >= state.quizSession.questions.length - 1 ? '결과 보기' : '다음 문제'}
                </button>
            </section>
        `;
    }

    function answerQuizQuestion(selectedMoodId) {
        const session = state.quizSession;
        const question = session?.questions?.[session.currentIndex];
        if (!question || question.answered) return;

        question.selectedMoodId = selectedMoodId;
        question.answered = true;
        question.correct = selectedMoodId === question.mood.moodId;
        recordQuizAnswer(question.mood, question.correct);
        renderQuizPlay();
    }

    function renderQuizResult() {
        prepareQuizShell('퀴즈 결과', true, false);

        const session = state.quizSession;
        const questions = session?.questions || [];
        const wrongQuestions = questions.filter(question => question.answered && !question.correct);

        elements.mainContent.innerHTML = `
            <div class="quiz-view">
                <section class="quiz-card quiz-result-card">
                    <p class="quiz-kicker">완료</p>
                    <h2 class="quiz-title">마음 탐험을 마쳤어요.</h2>
                    <p class="quiz-description">${wrongQuestions.length ? '몰랐던 감정은 아래에서 바로 다시 볼 수 있어요.' : '이번 퀴즈에서 새로 볼 감정은 없어요.'}</p>
                    <div class="quiz-intro-actions">
                        <button type="button" class="quiz-primary-btn" id="quiz-restart-btn">다시 시작</button>
                        <button type="button" class="quiz-secondary-btn" id="quiz-review-result-btn" ${getWrongQuizMoods().length ? '' : 'disabled'}>몰랐던 감정들 다시 보기</button>
                    </div>
                </section>
                ${wrongQuestions.length ? `
                    <div class="quiz-review-list">
                        ${wrongQuestions.map(question => renderQuizReviewCard(question.mood, question.showResultStory)).join('')}
                    </div>
                ` : ''}
            </div>
        `;

        document.getElementById('quiz-restart-btn').addEventListener('click', () => {
            createQuizSession();
            renderQuizPlay();
        });

        document.getElementById('quiz-review-result-btn').addEventListener('click', () => {
            if (getWrongQuizMoods().length) navigateTo('#/quiz/review');
        });

        elements.mainContent.querySelectorAll('[data-review-toggle]').forEach(button => {
            button.addEventListener('click', () => {
                const moodId = button.dataset.reviewToggle;
                const targetQuestion = wrongQuestions.find(question => question.mood.moodId === moodId);
                if (!targetQuestion) return;

                targetQuestion.showResultStory = !targetQuestion.showResultStory;
                renderQuizResult();
            });
        });
    }

    function renderQuizReview() {
        prepareQuizShell('다시 보기', true, false);
        const wrongMoods = getWrongQuizMoods();

        elements.mainContent.innerHTML = `
            <div class="quiz-view">
                ${wrongMoods.length ? `
                    <div class="quiz-review-list">
                        ${wrongMoods.map(mood => renderQuizReviewCard(mood, state.quizReviewExpandedMoodId === mood.moodId)).join('')}
                    </div>
                ` : `
                    <section class="quiz-card">
                        <h2 class="quiz-title">아직 몰랐던 감정이 없어요.</h2>
                        <p class="quiz-description">퀴즈를 풀고 나면 새로 알게 된 감정들을 여기에서 다시 볼 수 있어요.</p>
                    </section>
                `}
            </div>
        `;

        elements.mainContent.querySelectorAll('[data-review-toggle]').forEach(button => {
            button.addEventListener('click', () => {
                const moodId = button.dataset.reviewToggle;
                state.quizReviewExpandedMoodId = state.quizReviewExpandedMoodId === moodId ? null : moodId;
                renderQuizReview();
            });
        });
    }

    function renderQuizReviewCard(mood, expanded) {
        const imageUrl = getMoodImageUrl(mood);

        return `
            <article class="quiz-review-card ${mood.tab}">
                <div class="quiz-review-card-main">
                    <img class="quiz-review-image" src="${imageUrl}" alt="${escapeHtml(mood.title)}">
                    <div class="quiz-review-copy">
                        <h3>${escapeHtml(mood.title)}</h3>
                        <p>${escapeHtml(formatMoodContent(mood.description))}</p>
                    </div>
                </div>
                <button type="button" class="quiz-review-toggle" data-review-toggle="${mood.moodId}">
                    ${expanded ? '접기' : '이야기 보기'}
                </button>
                ${expanded ? `<p class="quiz-review-story">${escapeHtml(formatMoodContent(mood.content))}</p>` : ''}
            </article>
        `;
    }

    function renderEmotionConstellation(discovery) {
        const centerX = 50;
        const centerY = 50;
        const count = Math.max(discovery.moods.length, 1);
        const positions = discovery.moods.map((mood, index) => {
            const angle = ((Math.PI * 2) / count) * index - Math.PI / 2;
            const ring = index % 2 === 0 ? 34 : 39;
            const x = centerX + Math.cos(angle) * ring;
            const y = centerY + Math.sin(angle) * Math.min(ring, 30);

            return {
                mood,
                x: Math.max(9, Math.min(91, x)),
                y: Math.max(12, Math.min(88, y)),
                delay: (index % 5) * 0.15
            };
        });

        return `
            <div class="constellation-stage floating-chip-field" id="constellation-stage" aria-label="알아본 감정 결과">
                <div class="constellation-decor top-left" aria-hidden="true">반짝</div>
                <div class="constellation-decor bottom-right" aria-hidden="true">마음 알아가기</div>
                <svg class="constellation-lines" viewBox="0 0 100 100" aria-hidden="true" preserveAspectRatio="none">
                    ${positions.map((position, index) => `
                        <line data-line-index="${index}" x1="${centerX}" y1="${centerY}" x2="${position.x}" y2="${position.y}"></line>
                    `).join('')}
                </svg>
                <div class="constellation-center">
                    <span>${escapeHtml(discovery.target)}</span>
                </div>
                ${positions.map((position, index) => `
                    <div class="constellation-bubble floating-chip ${position.mood.tab}"
                         data-bubble-index="${index}"
                         data-base-x="${position.x}"
                         data-base-y="${position.y}"
                         style="left: ${position.x}%; top: ${position.y}%; animation-delay: ${position.delay}s;">
                        ${escapeHtml(getMoodDisplayTitle(position.mood.title))}
                    </div>
                `).join('')}
            </div>
        `;
    }

    function setupConstellationSpread() {
        const stage = document.getElementById('constellation-stage');
        if (!stage) return;

        const bubbles = Array.from(stage.querySelectorAll('.constellation-bubble'));
        const lines = Array.from(stage.querySelectorAll('.constellation-lines line'));
        if (!bubbles.length) return;

        const basePositions = bubbles.map((bubble, index) => ({
            bubble,
            line: lines[index] || null,
            x: Number.parseFloat(bubble.dataset.baseX),
            y: Number.parseFloat(bubble.dataset.baseY)
        }));

        const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

        function moveBubble(position, x, y, expanded) {
            position.bubble.style.left = `${x}%`;
            position.bubble.style.top = `${y}%`;
            position.bubble.classList.toggle('is-spread', expanded);
            if (position.line) {
                position.line.setAttribute('x2', x.toFixed(2));
                position.line.setAttribute('y2', y.toFixed(2));
            }
        }

        function spreadFromPoint(clientX, clientY) {
            const rect = stage.getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            const touchX = ((clientX - rect.left) / rect.width) * 100;
            const touchY = ((clientY - rect.top) / rect.height) * 100;
            const maxShift = rect.width < 430
                ? CONSTELLATION_SPREAD_MAX_SHIFT + 4
                : CONSTELLATION_SPREAD_MAX_SHIFT;
            const radius = basePositions.length > 12
                ? CONSTELLATION_SPREAD_RADIUS + 8
                : CONSTELLATION_SPREAD_RADIUS;

            basePositions.forEach((position, index) => {
                const dx = position.x - touchX;
                const dy = position.y - touchY;
                const distance = Math.hypot(dx, dy);

                if (distance > radius) {
                    moveBubble(position, position.x, position.y, false);
                    return;
                }

                const fallbackAngle = ((Math.PI * 2) / basePositions.length) * index - Math.PI / 2;
                const directionX = distance > 0.1 ? dx / distance : Math.cos(fallbackAngle);
                const directionY = distance > 0.1 ? dy / distance : Math.sin(fallbackAngle);
                const spreadRatio = Math.pow(1 - (distance / radius), 0.75);
                const tangent = index % 2 === 0 ? 1 : -1;
                const shift = maxShift * spreadRatio;
                const nextX = clamp(position.x + (directionX * shift) + (-directionY * tangent * shift * 0.24), 8, 92);
                const nextY = clamp(position.y + (directionY * shift) + (directionX * tangent * shift * 0.18), 10, 90);

                moveBubble(position, nextX, nextY, true);
            });
        }

        stage.addEventListener('pointerdown', event => {
            spreadFromPoint(event.clientX, event.clientY);
        });
    }

    function renderSettings() {
        updateActiveTab();
        elements.backBtn.classList.remove('hidden');
        elements.quizBtn.classList.add('hidden');
        elements.settingsBtn.classList.add('hidden');
        elements.tabBar.classList.remove('hidden');
        elements.headerTitle.textContent = '설정';

        window.scrollTo(0, 0);
        elements.mainContent.scrollTop = 0;

        elements.mainContent.innerHTML = `
            <div class="settings-view">
                <h2 class="settings-title">사용자 설정</h2>
                <p class="settings-description">상세 이야기에서 사용할 이름과 사진 속 아이를 선택해 주세요.</p>

                <form class="settings-form" id="settings-form">
                    <label for="name-input" class="settings-label">이름</label>
                    <input
                        id="name-input"
                        class="settings-input"
                        type="text"
                        maxlength="${USER_NAME_MAX_LENGTH}"
                        placeholder="이름을 입력하세요"
                        autocomplete="name"
                        required
                    >
                    <p class="settings-hint">최대 ${USER_NAME_MAX_LENGTH}자까지 입력할 수 있어요.</p>
                    <fieldset class="settings-fieldset">
                        <legend class="settings-label">사진 속 아이</legend>
                        <div class="gender-options" role="radiogroup" aria-label="사진 속 아이">
                            ${CHILD_GENDERS.map(gender => `
                                <label class="gender-option ${state.childGender === gender ? 'is-selected' : ''}">
                                    <input
                                        type="radio"
                                        name="child-gender"
                                        value="${gender}"
                                        ${state.childGender === gender ? 'checked' : ''}
                                    >
                                    <span>${CHILD_GENDER_LABELS[gender]}</span>
                                </label>
                            `).join('')}
                        </div>
                    </fieldset>
                    <p id="settings-status" class="settings-status" aria-live="polite"></p>

                    <div class="settings-actions">
                        <button type="submit" class="settings-btn settings-btn-primary">저장</button>
                        <button type="button" class="settings-btn settings-btn-secondary" id="name-reset-btn">기본값으로 초기화</button>
                    </div>
                </form>

                <p class="settings-preview">현재 적용 이름: <strong id="name-preview"></strong></p>
                <p class="settings-preview">현재 사진: <strong id="gender-preview"></strong></p>

                ${renderCloudSyncSection()}
            </div>
        `;

        const form = document.getElementById('settings-form');
        const input = document.getElementById('name-input');
        const resetBtn = document.getElementById('name-reset-btn');
        const status = document.getElementById('settings-status');
        const preview = document.getElementById('name-preview');
        const genderPreview = document.getElementById('gender-preview');
        const genderInputs = Array.from(document.querySelectorAll('input[name="child-gender"]'));

        input.value = state.userName;
        preview.textContent = state.userName;
        genderPreview.textContent = CHILD_GENDER_LABELS[state.childGender];

        function setStatus(message, isError = false) {
            status.textContent = message;
            status.classList.toggle('is-error', isError);
        }

        function syncGenderOptionState() {
            genderInputs.forEach(radio => {
                radio.closest('.gender-option')?.classList.toggle('is-selected', radio.checked);
            });
        }

        form.addEventListener('submit', (event) => {
            event.preventDefault();

            const normalizedName = normalizeUserName(input.value);
            const selectedGender = normalizeChildGender(form.elements['child-gender']?.value);

            if (!normalizedName) {
                setStatus('이름을 입력해 주세요.', true);
                input.focus();
                return;
            }

            if (normalizedName.length > USER_NAME_MAX_LENGTH) {
                setStatus(`이름은 ${USER_NAME_MAX_LENGTH}자 이하로 입력해 주세요.`, true);
                input.focus();
                return;
            }

            state.userName = normalizedName;
            state.childGender = selectedGender;
            input.value = normalizedName;
            preview.textContent = normalizedName;
            genderPreview.textContent = CHILD_GENDER_LABELS[selectedGender];

            const saved = saveUserName(normalizedName) && saveChildGender(selectedGender);
            if (saved) {
                setStatus('설정이 저장되었어요.');
            } else {
                setStatus('저장에 실패했어요. 브라우저 설정을 확인해 주세요.', true);
            }
        });

        resetBtn.addEventListener('click', () => {
            state.userName = DEFAULT_USER_NAME;
            state.childGender = DEFAULT_CHILD_GENDER;
            input.value = DEFAULT_USER_NAME;
            preview.textContent = DEFAULT_USER_NAME;
            genderPreview.textContent = CHILD_GENDER_LABELS[DEFAULT_CHILD_GENDER];
            genderInputs.forEach(radio => {
                radio.checked = radio.value === DEFAULT_CHILD_GENDER;
            });
            syncGenderOptionState();

            const saved = saveUserName(DEFAULT_USER_NAME) && saveChildGender(DEFAULT_CHILD_GENDER);
            if (saved) {
                setStatus('기본 설정으로 초기화했어요.');
            } else {
                setStatus('초기화 저장에 실패했어요. 브라우저 설정을 확인해 주세요.', true);
            }
        });

        genderInputs.forEach(radio => {
            radio.addEventListener('change', () => {
                state.childGender = normalizeChildGender(radio.value);
                genderPreview.textContent = CHILD_GENDER_LABELS[state.childGender];
                syncGenderOptionState();
            });
        });

        bindCloudSyncSettings();
    }

    function renderCloudSyncSection() {
        const user = state.cloud.user;
        const isSignedIn = Boolean(user);
        const statusMessage = state.cloud.syncing
            ? '기록을 맞추는 중이에요...'
            : state.cloud.error
                ? state.cloud.error
                : isSignedIn
                    ? `${escapeHtml(user.displayName || user.email || state.userName)}님의 기록을 안전하게 보관하고 있어요.`
                    : '지금은 이 기기에만 기록되고 있어요.';
        const statusClass = state.cloud.error
            ? 'is-error'
            : isSignedIn && !state.cloud.syncing
                ? 'is-success'
                : '';

        return `
            <section class="cloud-sync-section" aria-labelledby="cloud-sync-title">
                <h2 class="settings-title" id="cloud-sync-title">기록 보관</h2>
                <div class="cloud-sync-card">
                    <p class="settings-description">Google 계정이나 이메일로 연결하면 다른 기기에서도 알아가기 기록을 이어서 볼 수 있어요.</p>
                    <p class="cloud-sync-status ${statusClass}" aria-live="polite">${statusMessage}</p>
                    <div class="cloud-sync-actions">
                        ${isSignedIn ? `
                            <button type="button" class="cloud-logout-btn" id="cloud-logout-btn" ${state.cloud.syncing ? 'disabled' : ''}>로그아웃</button>
                        ` : `
                            <button type="button" class="cloud-login-btn" id="cloud-login-btn" ${state.cloud.syncing ? 'disabled' : ''}>Google 계정으로 기록 보관하기</button>
                            ${renderEmailPasswordForm()}
                        `}
                    </div>
                    <p class="cloud-sync-note">공용 기기라면 사용 후 로그아웃해 주세요.</p>
                </div>
            </section>
        `;
    }

    function renderEmailPasswordForm() {
        return `
            <form class="cloud-email-form" id="cloud-email-form" novalidate>
                <p class="cloud-email-hint">또는 이메일로 이용하기</p>
                <label class="cloud-email-field" for="cloud-email-input">
                    <span>이메일</span>
                    <input
                        id="cloud-email-input"
                        class="cloud-email-input"
                        type="email"
                        inputmode="email"
                        autocomplete="email"
                        placeholder="name@example.com"
                        ${state.cloud.syncing ? 'disabled' : ''}
                    >
                </label>
                <label class="cloud-email-field" for="cloud-password-input">
                    <span>비밀번호</span>
                    <input
                        id="cloud-password-input"
                        class="cloud-email-input"
                        type="password"
                        autocomplete="current-password"
                        minlength="6"
                        placeholder="6자 이상"
                        ${state.cloud.syncing ? 'disabled' : ''}
                    >
                </label>
                <label class="cloud-email-field" for="cloud-display-name-input">
                    <span>이름 또는 별명, 선택</span>
                    <input
                        id="cloud-display-name-input"
                        class="cloud-email-input"
                        type="text"
                        maxlength="${USER_NAME_MAX_LENGTH}"
                        autocomplete="name"
                        placeholder="기록에 표시할 이름"
                        ${state.cloud.syncing ? 'disabled' : ''}
                    >
                </label>
                <p class="cloud-email-message" id="cloud-email-message" aria-live="polite"></p>
                <div class="cloud-email-actions">
                    <button type="submit" class="cloud-email-btn cloud-email-primary-btn" id="cloud-email-signin-btn" ${state.cloud.syncing ? 'disabled' : ''}>이메일로 로그인</button>
                    <button type="button" class="cloud-email-btn cloud-email-secondary-btn" id="cloud-email-signup-btn" ${state.cloud.syncing ? 'disabled' : ''}>새 이메일로 가입하기</button>
                    <button type="button" class="cloud-email-reset-btn" id="cloud-password-reset-btn" ${state.cloud.syncing ? 'disabled' : ''}>비밀번호를 잊었어요</button>
                </div>
            </form>
        `;
    }

    function bindCloudSyncSettings() {
        const loginBtn = document.getElementById('cloud-login-btn');
        const logoutBtn = document.getElementById('cloud-logout-btn');
        const emailForm = document.getElementById('cloud-email-form');
        const cloud = getCloud();

        if (loginBtn) {
            loginBtn.addEventListener('click', async () => {
                if (!cloud?.signInWithGoogle) {
                    state.cloud.error = '온라인 보관을 준비하지 못했어요. 이 기기에는 계속 저장돼요.';
                    renderSettings();
                    return;
                }

                state.cloud.syncing = true;
                state.cloud.error = '';
                renderSettings();

                const result = await cloud.signInWithGoogle();
                state.cloud.syncing = false;
                if (result?.ok) {
                    state.cloud.user = result.user;
                    state.cloud.status = '기록이 안전하게 보관되고 있어요.';
                    state.cloud.error = '';
                    loadUserName();
                    loadChildGender();
                    state.discoveries = loadDiscoveries();
                    state.quizStats = loadQuizStats();
                } else {
                    state.cloud.error = '로그인을 마치지 못했어요. 잠시 뒤 다시 시도해 주세요.';
                }
                renderSettings();
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                if (!cloud?.signOutUser) return;

                state.cloud.syncing = true;
                state.cloud.error = '';
                renderSettings();

                const result = await cloud.signOutUser();
                state.cloud.syncing = false;
                if (result?.ok) {
                    state.cloud.user = null;
                    state.cloud.status = '지금은 이 기기에만 기록되고 있어요.';
                    state.cloud.error = '';
                } else {
                    state.cloud.error = '로그아웃하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
                }
                renderSettings();
            });
        }

        if (emailForm) {
            const emailInput = document.getElementById('cloud-email-input');
            const passwordInput = document.getElementById('cloud-password-input');
            const displayNameInput = document.getElementById('cloud-display-name-input');
            const emailMessage = document.getElementById('cloud-email-message');
            const signUpBtn = document.getElementById('cloud-email-signup-btn');
            const resetBtn = document.getElementById('cloud-password-reset-btn');

            function setEmailMessage(message, isError = false) {
                emailMessage.textContent = message;
                emailMessage.classList.toggle('is-error', isError);
                emailMessage.classList.toggle('is-success', Boolean(message) && !isError);
            }

            function getEmailFormValues() {
                const email = normalizeEmailInput(emailInput.value);
                const password = passwordInput.value;
                const displayName = normalizeUserName(displayNameInput.value);
                emailInput.value = email;
                displayNameInput.value = displayName;

                return { email, password, displayName };
            }

            function validateEmailPassword({ email, password }, needsPassword = true) {
                if (!isValidEmail(email)) {
                    setEmailMessage('이메일 주소를 다시 확인해 주세요.', true);
                    emailInput.focus();
                    return false;
                }

                if (needsPassword && !password) {
                    setEmailMessage('비밀번호를 입력해 주세요.', true);
                    passwordInput.focus();
                    return false;
                }

                if (needsPassword && password.length < 6) {
                    setEmailMessage('비밀번호는 6자 이상으로 입력해 주세요.', true);
                    passwordInput.focus();
                    return false;
                }

                return true;
            }

            async function runEmailAuth(action) {
                if (!cloud?.signInWithEmail || !cloud?.signUpWithEmail || !cloud?.sendPasswordReset) {
                    state.cloud.error = '온라인 보관을 준비하지 못했어요. 이 기기에는 계속 저장돼요.';
                    renderSettings();
                    return;
                }

                const values = getEmailFormValues();
                const needsPassword = action !== 'reset';
                if (!validateEmailPassword(values, needsPassword)) return;

                if (action === 'signup' && values.displayName.length > USER_NAME_MAX_LENGTH) {
                    setEmailMessage(`이름은 ${USER_NAME_MAX_LENGTH}자 이하로 입력해 주세요.`, true);
                    displayNameInput.focus();
                    return;
                }

                const currentCloud = getCloud();
                if (!currentCloud) {
                    state.cloud.error = '온라인 보관을 준비하지 못했어요. 이 기기에는 계속 저장돼요.';
                    renderSettings();
                    return;
                }

                state.cloud.syncing = true;
                state.cloud.error = '';
                renderSettings();

                let result;
                if (action === 'signup') {
                    result = await currentCloud.signUpWithEmail(values.email, values.password, values.displayName);
                } else if (action === 'reset') {
                    result = await currentCloud.sendPasswordReset(values.email);
                } else {
                    result = await currentCloud.signInWithEmail(values.email, values.password);
                }

                state.cloud.syncing = false;

                if (result?.ok) {
                    state.cloud.user = result.user || currentCloud.getCurrentUser?.() || null;
                    state.cloud.status = result.user
                        ? '기록이 안전하게 보관되고 있어요.'
                        : '비밀번호 재설정 메일을 보냈어요.';
                    state.cloud.error = '';
                    loadUserName();
                    loadChildGender();
                    state.discoveries = loadDiscoveries();
                    state.quizStats = loadQuizStats();
                } else {
                    state.cloud.error = result?.message || '로그인 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.';
                }

                renderSettings();
            }

            emailForm.addEventListener('submit', async event => {
                event.preventDefault();
                await runEmailAuth('signin');
            });

            signUpBtn.addEventListener('click', async () => {
                await runEmailAuth('signup');
            });

            resetBtn.addEventListener('click', async () => {
                await runEmailAuth('reset');
            });
        }
    }

    // Render a mood card
    function renderMoodCard(mood) {
        const imageUrl = getMoodImageUrl(mood);
        const discoveryTargets = getDiscoveryTargetsForMood(state.currentTab, mood.key);
        const discoveryChips = discoveryTargets.length ? `
                    ${renderMoodCardDiscoveryChips(discoveryTargets, mood)}
        ` : '';

        return `
            <a href="#/${state.currentTab}/${encodeURIComponent(mood.key)}"
               class="mood-card"
               role="listitem"
               aria-label="${escapeHtml(mood.title)}">
                <div class="mood-card-image-wrapper">
                    <img class="mood-card-image"
                         data-src="${imageUrl}"
                         alt="${escapeHtml(mood.title)}"
                         loading="lazy">
                </div>
                <div class="mood-card-content">
                    <h2 class="mood-card-title">${escapeHtml(mood.title)}</h2>
                    <p class="mood-card-description">${escapeHtml(mood.description)}</p>
                    ${discoveryChips}
                </div>
            </a>
        `;
    }

    function renderMoodCardDiscoveryChips(discoveryTargets, mood) {
        const label = `${getMoodDisplayTitle(mood.title)}을 느꼈던 일`;
        const chips = discoveryTargets.map(target => `
            <span class="mood-card-discovery-chip">${escapeHtml(target)}</span>
        `).join('');

        if (prefersReducedMotion()) {
            return `
                <div class="mood-card-discoveries ${state.currentTab}" aria-label="${escapeHtml(label)}">
                    ${chips}
                </div>
            `;
        }

        return renderChipRiver({
            className: `mood-card-discoveries ${state.currentTab} chip-river chip-river--target`,
            label,
            chips
        });
    }

    // Setup lazy loading with Intersection Observer
    function setupLazyLoading() {
        const images = document.querySelectorAll('.mood-card-image[data-src]');

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.onload = () => img.classList.add('loaded');
                    img.onerror = () => {
                        img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 150"><rect fill="%23e0e0e0" width="100" height="150"/></svg>';
                        img.classList.add('loaded');
                    };
                    observer.unobserve(img);
                }
            });
        }, {
            rootMargin: '50px',
            threshold: 0.1
        });

        images.forEach(img => observer.observe(img));
    }

    // Render detail view
    function renderDetail() {
        updateActiveTab();
        elements.backBtn.classList.remove('hidden');
        elements.quizBtn.classList.add('hidden');
        elements.settingsBtn.classList.add('hidden');
        elements.tabBar.classList.add('hidden');
        elements.mainContent.classList.add('detail-main');
        elements.headerTitle.textContent = state.currentMood.title;

        // Reset scroll to top
        window.scrollTo(0, 0);
        elements.mainContent.scrollTop = 0;

        const imageUrl = getMoodImageUrl(state.currentMood);
        const displayContent = escapeHtml(formatMoodContent(state.currentMood.content));
        const storyExpanded = state.detailStoryExpanded;

        elements.mainContent.innerHTML = `
            <div class="detail-view">
                <div class="detail-content detail-stage">
                    <div class="detail-image-wrapper">
                        <img class="detail-image"
                             src="${imageUrl}"
                             alt="${escapeHtml(state.currentMood.title)}">
                    </div>
                    <section class="detail-story-sheet ${storyExpanded ? 'expanded' : ''}"
                             aria-label="${escapeHtml(state.currentMood.title)} 이야기">
                        <div class="detail-story-scroll">
                            <p class="detail-story">${displayContent}</p>
                        </div>
                        <div class="detail-more-hint" aria-hidden="true">⌄</div>
                        <button class="detail-toggle-btn ${state.currentTab}"
                                type="button"
                                aria-expanded="${storyExpanded ? 'true' : 'false'}">
                            ${storyExpanded ? '이야기 접기' : '이야기 더 보기'}
                        </button>
                    </section>
                </div>
            </div>
        `;

        // Toggle story sheet event
        const toggleBtn = elements.mainContent.querySelector('.detail-toggle-btn');
        const storySheet = elements.mainContent.querySelector('.detail-story-sheet');
        const storyScroll = elements.mainContent.querySelector('.detail-story-scroll');
        const updateStoryMoreHint = () => {
            if (!storySheet || !storyScroll) {
                return;
            }

            const hasOverflow = storyScroll.scrollHeight > storyScroll.clientHeight + 1;
            const isAtEnd = storyScroll.scrollTop + storyScroll.clientHeight >= storyScroll.scrollHeight - 2;
            storySheet.classList.toggle('has-more', hasOverflow && !isAtEnd);
        };
        const toggleDetailStory = () => {
            state.detailStoryExpanded = !state.detailStoryExpanded;
            renderDetail();
        };
        toggleBtn.addEventListener('click', toggleDetailStory);
        storyScroll?.addEventListener('scroll', updateStoryMoreHint, { passive: true });
        requestAnimationFrame(updateStoryMoreHint);
    }

    // Register Service Worker
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(registration => {
                    console.log('ServiceWorker registered:', registration.scope);
                })
                .catch(error => {
                    console.log('ServiceWorker registration failed:', error);
                });
        }
    }

    // Start the app
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM already loaded
        init();
    }
})();

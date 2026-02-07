// MoodMeter App
(function() {
    'use strict';

    const DEFAULT_USER_NAME = '봄이';
    const USER_NAME_MAX_LENGTH = 20;
    const STORAGE_KEY_USER_NAME = 'moodmeter:userName';
    const MOOD_TABS = ['yellow', 'green', 'blue', 'red'];
    const NAV_TABS = [...MOOD_TABS, 'settings'];

    // App State
    const state = {
        data: null,
        currentTab: 'yellow',
        currentMood: null,
        showImage: false,
        loading: true,
        error: null,
        userName: DEFAULT_USER_NAME
    };

    // DOM Elements
    const elements = {
        app: document.getElementById('app'),
        header: document.getElementById('header'),
        headerTitle: document.getElementById('header-title'),
        backBtn: document.getElementById('back-btn'),
        mainContent: document.getElementById('main-content'),
        tabBar: document.getElementById('tab-bar'),
        tabBtns: document.querySelectorAll('.tab-btn')
    };

    // Initialize App
    async function init() {
        const startTime = performance.now();

        // Analytics 초기화 (환경 자동 감지)
        const isLocalhost = window.location.hostname === 'localhost' ||
                           window.location.hostname === '127.0.0.1' ||
                           window.location.hostname === '';

        Analytics.init({
            mode: isLocalhost ? 'development' : 'production',
            debug: isLocalhost // 로컬에서만 디버그 로그 출력
        });

        loadUserName();
        await loadData();
        setupEventListeners();
        handleRoute();
        registerServiceWorker();

        // 앱 로딩 완료 추적
        Analytics.track('app_loaded', {
            initial_hash: window.location.hash || '#/',
            load_time: Math.round(performance.now() - startTime)
        });
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

    function formatMoodContent(content) {
        if (typeof content !== 'string') return '';
        return content.split(DEFAULT_USER_NAME).join(state.userName);
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

    function trackSettingsAction(params) {
        Analytics.track('settings_action_click', params);
    }

    // Load mood data
    async function loadData() {
        try {
            const startTime = performance.now();
            const response = await fetch('moodmeter.json');
            if (!response.ok) throw new Error('Failed to load data');

            state.data = await response.json();
            state.loading = false;

            // 데이터 로딩 성공 추적
            Analytics.track('data_loaded', {
                load_time: Math.round(performance.now() - startTime),
                mood_count: {
                    yellow: state.data.yellow?.length || 0,
                    green: state.data.green?.length || 0,
                    blue: state.data.blue?.length || 0,
                    red: state.data.red?.length || 0,
                    total: Object.values(state.data).flat().length
                }
            });
        } catch (error) {
            console.error('Error loading data:', error);
            state.error = '데이터를 불러오는데 실패했습니다.';
            state.loading = false;

            // 데이터 로딩 실패 추적
            Analytics.track('data_load_error', {
                error_message: error.message,
                error_type: error.name
            });
        }
    }

    // Setup event listeners
    function setupEventListeners() {
        // Tab buttons
        elements.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;

                // 탭 전환 추적
                Analytics.track('tab_click', {
                    from_tab: state.currentTab,
                    to_tab: tab
                });

                if (tab === 'settings') {
                    Analytics.track('settings_tab_click', {
                        from_tab: state.currentTab,
                        to_tab: 'settings'
                    });
                }

                navigateTo(`#/${tab}`);
            });
        });

        // Back button
        elements.backBtn.addEventListener('click', () => {
            // 뒤로가기 버튼 클릭 추적
            Analytics.track('back_button_click', {
                from_view: 'detail',
                to_view: 'list',
                tab: state.currentTab,
                mood_key: state.currentMood?.key,
                mood_title: state.currentMood?.title
            });

            navigateTo(`#/${state.currentTab}`);
        });

        // Hash change
        window.addEventListener('hashchange', handleRoute);

        // Handle keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && state.currentMood) {
                // Escape 키 네비게이션 추적
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
    }

    // Navigate to a route
    function navigateTo(hash) {
        window.location.hash = hash;
    }

    // Handle routing
    function handleRoute() {
        const hash = window.location.hash || '#/';
        const parts = hash.slice(2).split('/').filter(Boolean);

        if (parts.length === 0) {
            // Default to yellow
            state.currentTab = 'yellow';
            state.currentMood = null;
            state.showImage = false;
            renderList();
            return;
        }

        if (parts.length === 1 && NAV_TABS.includes(parts[0])) {
            state.currentTab = parts[0];
            state.currentMood = null;
            state.showImage = false;

            if (state.currentTab === 'settings') {
                renderSettings();
            } else {
                renderList();
            }
            return;
        }

        if (parts.length === 2) {
            const [tab, key] = parts;
            if (MOOD_TABS.includes(tab)) {
                state.currentTab = tab;
                const mood = state.data?.[tab]?.find(m => m.key === key);
                if (mood) {
                    state.currentMood = mood;
                    state.showImage = false;
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
        elements.tabBar.classList.remove('hidden');
        elements.headerTitle.textContent = 'Mood Meter';

        // 화면 조회 추적
        const moods = state.data?.[state.currentTab] || [];
        Analytics.track('screen_view', {
            view_type: 'list',
            tab: state.currentTab,
            screen_name: `List - ${state.currentTab}`,
            mood_count: moods.length
        });

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

        // Setup lazy loading for images
        setupLazyLoading();

        // 감정 카드 클릭 추적 리스너 추가
        setupMoodCardTracking();
    }

    function renderSettings() {
        updateActiveTab();
        elements.backBtn.classList.add('hidden');
        elements.tabBar.classList.remove('hidden');
        elements.headerTitle.textContent = '설정';

        Analytics.track('screen_view', {
            view_type: 'settings',
            tab: 'settings',
            screen_name: 'Settings'
        });

        window.scrollTo(0, 0);
        elements.mainContent.scrollTop = 0;

        elements.mainContent.innerHTML = `
            <div class="settings-view">
                <h2 class="settings-title">사용자 이름 설정</h2>
                <p class="settings-description">상세 이야기에서 사용할 이름을 입력해 주세요.</p>

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
                    <p id="settings-status" class="settings-status" aria-live="polite"></p>

                    <div class="settings-actions">
                        <button type="submit" class="settings-btn settings-btn-primary">저장</button>
                        <button type="button" class="settings-btn settings-btn-secondary" id="name-reset-btn">기본값으로 초기화</button>
                    </div>
                </form>

                <p class="settings-preview">현재 적용 이름: <strong id="name-preview"></strong></p>
            </div>
        `;

        const form = document.getElementById('settings-form');
        const input = document.getElementById('name-input');
        const resetBtn = document.getElementById('name-reset-btn');
        const status = document.getElementById('settings-status');
        const preview = document.getElementById('name-preview');

        input.value = state.userName;
        preview.textContent = state.userName;

        function setStatus(message, isError = false) {
            status.textContent = message;
            status.classList.toggle('is-error', isError);
        }

        form.addEventListener('submit', (event) => {
            event.preventDefault();

            const normalizedName = normalizeUserName(input.value);

            if (!normalizedName) {
                trackSettingsAction({
                    setting_key: 'display_name',
                    action_type: 'save',
                    input_method: 'button',
                    result: 'validation_error',
                    value_type: 'string',
                    value_length: 0,
                    is_default_name: false
                });
                setStatus('이름을 입력해 주세요.', true);
                input.focus();
                return;
            }

            if (normalizedName.length > USER_NAME_MAX_LENGTH) {
                trackSettingsAction({
                    setting_key: 'display_name',
                    action_type: 'save',
                    input_method: 'button',
                    result: 'validation_error',
                    value_type: 'string',
                    value_length: normalizedName.length,
                    is_default_name: false
                });
                setStatus(`이름은 ${USER_NAME_MAX_LENGTH}자 이하로 입력해 주세요.`, true);
                input.focus();
                return;
            }

            state.userName = normalizedName;
            input.value = normalizedName;
            preview.textContent = normalizedName;

            const saved = saveUserName(normalizedName);
            if (saved) {
                setStatus('이름이 저장되었어요.');
            } else {
                setStatus('저장에 실패했어요. 브라우저 설정을 확인해 주세요.', true);
            }

            trackSettingsAction({
                setting_key: 'display_name',
                action_type: 'save',
                input_method: 'button',
                result: saved ? 'success' : 'fail',
                value_type: 'string',
                value_length: normalizedName.length,
                is_default_name: normalizedName === DEFAULT_USER_NAME
            });
        });

        resetBtn.addEventListener('click', () => {
            state.userName = DEFAULT_USER_NAME;
            input.value = DEFAULT_USER_NAME;
            preview.textContent = DEFAULT_USER_NAME;

            const saved = saveUserName(DEFAULT_USER_NAME);
            if (saved) {
                setStatus('기본 이름으로 초기화했어요.');
            } else {
                setStatus('초기화 저장에 실패했어요. 브라우저 설정을 확인해 주세요.', true);
            }

            trackSettingsAction({
                setting_key: 'display_name',
                action_type: 'reset',
                input_method: 'button',
                result: saved ? 'success' : 'fail',
                value_type: 'string',
                value_length: DEFAULT_USER_NAME.length,
                is_default_name: true
            });
        });
    }

    // Render a mood card
    function renderMoodCard(mood) {
        const imageUrl = `images/${encodeURIComponent(mood.key)}.jpg`;

        return `
            <a href="#/${state.currentTab}/${mood.key}"
               class="mood-card"
               role="listitem"
               aria-label="${mood.title}">
                <div class="mood-card-image-wrapper">
                    <img class="mood-card-image"
                         data-src="${imageUrl}"
                         alt="${mood.title}"
                         loading="lazy">
                </div>
                <div class="mood-card-content">
                    <h2 class="mood-card-title">${mood.title}</h2>
                    <p class="mood-card-description">${mood.description}</p>
                </div>
            </a>
        `;
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

    // Setup mood card click tracking
    function setupMoodCardTracking() {
        document.querySelectorAll('.mood-card').forEach((card, index) => {
            card.addEventListener('click', () => {
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

    // Render detail view
    function renderDetail() {
        updateActiveTab();
        elements.backBtn.classList.remove('hidden');
        elements.tabBar.classList.add('hidden');
        elements.headerTitle.textContent = state.currentMood.title;

        // 화면 조회 추적
        Analytics.track('screen_view', {
            view_type: 'detail',
            tab: state.currentTab,
            screen_name: `Detail - ${state.currentMood.title}`,
            mood_key: state.currentMood.key,
            mood_title: state.currentMood.title,
            content_mode: state.showImage ? 'image' : 'story'
        });

        // Reset scroll to top
        window.scrollTo(0, 0);
        elements.mainContent.scrollTop = 0;

        const imageUrl = `images/${encodeURIComponent(state.currentMood.key)}.jpg`;
        const displayContent = escapeHtml(formatMoodContent(state.currentMood.content));

        if (state.showImage) {
            elements.mainContent.innerHTML = `
                <div class="detail-view">
                    <div class="detail-content">
                        <div class="detail-image-wrapper">
                            <img class="detail-image"
                                 src="${imageUrl}"
                                 alt="${state.currentMood.title}">
                        </div>
                    </div>
                    <button class="detail-toggle-btn ${state.currentTab}"
                            aria-label="이야기 보기">
                        이야기 보기
                    </button>
                </div>
            `;
        } else {
            elements.mainContent.innerHTML = `
                <div class="detail-view">
                    <div class="detail-content">
                        <p class="detail-story">${displayContent}</p>
                    </div>
                    <button class="detail-toggle-btn ${state.currentTab}"
                            aria-label="이미지 보기">
                        이미지 보기
                    </button>
                </div>
            `;
        }

        // Toggle button event
        const toggleBtn = elements.mainContent.querySelector('.detail-toggle-btn');
        toggleBtn.addEventListener('click', () => {
            // 컨텐츠 토글 추적
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
    }

    // Register Service Worker
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(registration => {
                    console.log('ServiceWorker registered:', registration.scope);

                    // SW 등록 성공 추적
                    Analytics.track('service_worker_registered', {
                        scope: registration.scope,
                        update_found: !!registration.waiting
                    });
                })
                .catch(error => {
                    console.log('ServiceWorker registration failed:', error);

                    // SW 등록 실패 추적
                    Analytics.track('service_worker_error', {
                        error_message: error.message,
                        error_type: error.name
                    });
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

// MoodMeter App
(function() {
    'use strict';

    const DEFAULT_USER_NAME = '봄이';
    const USER_NAME_MAX_LENGTH = 20;
    const STORAGE_KEY_USER_NAME = 'moodmeter:userName';
    const STORAGE_KEY_DISCOVERIES = 'moodmeter:discoveries';
    const MOOD_TABS = ['yellow', 'green', 'blue', 'red'];
    const NAV_TABS = ['discover', ...MOOD_TABS];
    const TAB_LABELS = {
        yellow: '노랑',
        green: '초록',
        blue: '파랑',
        red: '빨강'
    };

    // App State
    const state = {
        data: null,
        currentTab: 'yellow',
        currentMood: null,
        showImage: false,
        loading: true,
        error: null,
        userName: DEFAULT_USER_NAME,
        discoveries: [],
        discoverDraft: {
            target: '',
            selectedMoodKeys: [],
            filter: 'all',
            infoMoodKey: null,
            error: '',
            editingId: null
        }
    };

    // DOM Elements
    const elements = {
        app: document.getElementById('app'),
        header: document.getElementById('header'),
        headerTitle: document.getElementById('header-title'),
        backBtn: document.getElementById('back-btn'),
        settingsBtn: document.getElementById('settings-btn'),
        mainContent: document.getElementById('main-content'),
        tabBar: document.getElementById('tab-bar'),
        tabBtns: document.querySelectorAll('.tab-btn')
    };

    // Initialize App
    async function init() {
        loadUserName();
        state.discoveries = loadDiscoveries();
        await loadData();
        setupEventListeners();
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

    function getMoodDisplayTitle(title) {
        if (typeof title !== 'string') return '';
        return title.replace(/\s*마음$/u, '');
    }

    function loadDiscoveries() {
        try {
            const rawDiscoveries = localStorage.getItem(STORAGE_KEY_DISCOVERIES);
            if (!rawDiscoveries) return [];

            const parsedDiscoveries = JSON.parse(rawDiscoveries);
            if (!Array.isArray(parsedDiscoveries)) return [];

            return parsedDiscoveries.filter(discovery => {
                return discovery
                    && typeof discovery.id === 'string'
                    && typeof discovery.target === 'string'
                    && Array.isArray(discovery.moods);
            });
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

    function createDiscovery(target, selectedMoods) {
        const now = new Date().toISOString();
        const discovery = {
            id: `dis_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            target,
            moods: selectedMoods.map(toStoredMood),
            createdAt: now,
            updatedAt: now
        };

        const saved = saveDiscoveries([discovery, ...state.discoveries]);
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
                updatedAt: now
            };
        });

        return saveDiscoveries(discoveries);
    }

    function deleteDiscovery(id) {
        return saveDiscoveries(state.discoveries.filter(discovery => discovery.id !== id));
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

                navigateTo(`#/${tab}`);
            });
        });

        // Header settings button
        elements.settingsBtn.addEventListener('click', () => {
            navigateTo('#/settings');
        });

        // Back button
        elements.backBtn.addEventListener('click', () => {
            if (state.currentTab === 'discover') {
                navigateTo('#/discover');
                return;
            }
            navigateTo(`#/${state.currentTab}`);
        });

        // Hash change
        window.addEventListener('hashchange', handleRoute);

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
        });
    }

    // Navigate to a route
    function navigateTo(hash) {
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

        if (parts.length === 0) {
            // Default to yellow
            state.currentTab = 'yellow';
            state.currentMood = null;
            state.showImage = false;
            renderList();
            return;
        }

        if (parts[0] === 'discover') {
            state.currentTab = 'discover';
            state.currentMood = null;
            state.showImage = false;

            if (parts.length === 1) {
                renderDiscoverList();
                return;
            }

            if (parts.length === 2 && parts[1] === 'new') {
                resetDiscoverDraft();
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
            state.showImage = false;
            renderList();
            return;
        }

        if (parts.length === 1 && parts[0] === 'settings') {
            state.currentMood = null;
            state.showImage = false;
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

        // Setup lazy loading for images
        setupLazyLoading();
    }

    function prepareDiscoverShell(title, showBack = false, resetScroll = true) {
        updateActiveTab();
        elements.backBtn.classList.toggle('hidden', !showBack);
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
                    const extraCount = Math.max(moods.length - 4, 0);

                    return `
                        <a class="discover-card" href="#/discover/${encodeURIComponent(discovery.id)}" role="listitem">
                            <div class="discover-card-main">
                                <h2 class="discover-card-title">${escapeHtml(discovery.target)}</h2>
                                <div class="discover-card-moods" aria-label="알아본 감정">
                                    ${moods.slice(0, 4).map(mood => `
                                        <span class="discover-mood-chip ${mood.tab}">${escapeHtml(getMoodDisplayTitle(mood.title))}</span>
                                    `).join('')}
                                    ${extraCount ? `<span class="discover-mood-chip more">+${extraCount}</span>` : ''}
                                </div>
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
            navigateTo('#/discover/new');
        });
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
                ${renderEmotionConstellation(hydratedDiscovery)}
                <div class="constellation-meta">
                    <time datetime="${escapeHtml(discovery.createdAt)}">${formatDate(discovery.createdAt)}</time>
                    <p>${hydratedDiscovery.moods.length}개의 마음을 알아봤어요.</p>
                </div>
                <div class="constellation-actions">
                    <button type="button" class="discover-secondary-btn" id="discover-list-btn">목록으로</button>
                    <button type="button" class="discover-secondary-btn" id="discover-edit-btn">감정 다시 고르기</button>
                    <button type="button" class="discover-danger-btn" id="discover-delete-btn">삭제</button>
                </div>
            </div>
        `;

        document.getElementById('discover-list-btn').addEventListener('click', () => navigateTo('#/discover'));
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
            <div class="constellation-stage" aria-label="알아본 감정 결과">
                <div class="constellation-decor top-left" aria-hidden="true">반짝</div>
                <div class="constellation-decor bottom-right" aria-hidden="true">마음 알아가기</div>
                <svg class="constellation-lines" viewBox="0 0 100 100" aria-hidden="true" preserveAspectRatio="none">
                    ${positions.map(position => `
                        <line x1="${centerX}" y1="${centerY}" x2="${position.x}" y2="${position.y}"></line>
                    `).join('')}
                </svg>
                <div class="constellation-center">
                    <span>${escapeHtml(discovery.target)}</span>
                </div>
                ${positions.map(position => `
                    <div class="constellation-bubble ${position.mood.tab}"
                         style="left: ${position.x}%; top: ${position.y}%; animation-delay: ${position.delay}s;">
                        ${escapeHtml(getMoodDisplayTitle(position.mood.title))}
                    </div>
                `).join('')}
            </div>
        `;
    }

    function renderSettings() {
        updateActiveTab();
        elements.backBtn.classList.remove('hidden');
        elements.settingsBtn.classList.add('hidden');
        elements.tabBar.classList.remove('hidden');
        elements.headerTitle.textContent = '설정';

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
            input.value = normalizedName;
            preview.textContent = normalizedName;

            const saved = saveUserName(normalizedName);
            if (saved) {
                setStatus('이름이 저장되었어요.');
            } else {
                setStatus('저장에 실패했어요. 브라우저 설정을 확인해 주세요.', true);
            }
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

    // Render detail view
    function renderDetail() {
        updateActiveTab();
        elements.backBtn.classList.remove('hidden');
        elements.settingsBtn.classList.add('hidden');
        elements.tabBar.classList.add('hidden');
        elements.headerTitle.textContent = state.currentMood.title;

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

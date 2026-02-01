// MoodMeter Analytics Module
// Firebase Analytics integration with development/production mode support

(function() {
    'use strict';

    const Analytics = {
        // Configuration
        config: {
            mode: 'development', // 'development' or 'production'
            debug: false
        },

        // State
        initialized: false,
        firebase: null,
        analyticsInstance: null,
        sessionId: null,
        sessionStartTime: null,
        lastScreenView: null,
        lastScreenViewTime: null,

        // Initialize Analytics
        init: function(options = {}) {
            this.config = { ...this.config, ...options };
            this.sessionId = this._generateSessionId();
            this.sessionStartTime = Date.now();

            // Initialize Firebase in production mode
            if (this.config.mode === 'production' && window.firebase && window.FIREBASE_CONFIG) {
                try {
                    // Initialize Firebase
                    this.firebase = firebase.initializeApp(window.FIREBASE_CONFIG);
                    this.analyticsInstance = firebase.analytics();

                    // Set session ID as user property
                    this.analyticsInstance.setUserProperties({
                        session_id: this.sessionId
                    });

                    this.initialized = true;
                    this._log('Firebase Analytics initialized', { mode: 'production' });
                } catch (error) {
                    console.error('[Analytics] Firebase initialization failed:', error);
                    this.config.mode = 'development'; // Fallback to console logging
                }
            } else {
                this._log('Analytics initialized in development mode (console logging only)');
            }

            return this;
        },

        // Track an event
        track: function(eventName, properties = {}) {
            if (!eventName) {
                console.warn('[Analytics] Event name is required');
                return;
            }

            // Add context data
            const eventData = {
                ...properties,
                timestamp: Date.now(),
                session_id: this.sessionId,
                session_duration: this._getSessionDuration(),
                ...this._getContextData()
            };

            // Calculate time on page if applicable
            if (this.lastScreenViewTime && (eventName === 'screen_view' || eventName.includes('_click'))) {
                eventData.time_since_last_screen = Date.now() - this.lastScreenViewTime;
            }

            // Send to Firebase or log to console
            if (this.config.mode === 'production' && this.initialized) {
                try {
                    // Firebase Analytics has character limits for event names and parameters
                    const sanitizedEventName = this._sanitizeEventName(eventName);
                    const sanitizedData = this._sanitizeEventData(eventData);

                    this.analyticsInstance.logEvent(sanitizedEventName, sanitizedData);

                    if (this.config.debug) {
                        this._log(`Event tracked: ${eventName}`, eventData);
                    }
                } catch (error) {
                    console.error('[Analytics] Error tracking event:', error);
                    this._log(`Event (fallback): ${eventName}`, eventData);
                }
            } else {
                // Development mode: console logging
                this._log(`Event: ${eventName}`, eventData);
            }

            // Update screen view tracking
            if (eventName === 'screen_view') {
                this.lastScreenView = properties.screen_name || properties.view_type;
                this.lastScreenViewTime = Date.now();
            }
        },

        // Set current screen name (for Firebase Analytics)
        setScreen: function(screenName) {
            if (this.config.mode === 'production' && this.initialized) {
                try {
                    this.analyticsInstance.setCurrentScreen(screenName);
                } catch (error) {
                    console.error('[Analytics] Error setting screen:', error);
                }
            }

            this.lastScreenView = screenName;
            this.lastScreenViewTime = Date.now();
        },

        // Log performance metrics
        logPerformance: function(metricName, value) {
            this.track('performance_metric', {
                metric_name: metricName,
                metric_value: value,
                metric_unit: 'milliseconds'
            });
        },

        // Private: Generate session ID
        _generateSessionId: function() {
            return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        },

        // Private: Get session duration
        _getSessionDuration: function() {
            return Date.now() - this.sessionStartTime;
        },

        // Private: Get context data
        _getContextData: function() {
            return {
                // Screen information
                screen_width: window.innerWidth,
                screen_height: window.innerHeight,
                device_pixel_ratio: window.devicePixelRatio || 1,

                // Device type
                device_type: this._getDeviceType(),

                // Browser information
                user_agent: navigator.userAgent,
                language: navigator.language || navigator.userLanguage,

                // Network information (if available)
                connection_type: this._getConnectionType(),

                // Page information
                page_url: window.location.href,
                page_hash: window.location.hash,
                referrer: document.referrer || 'direct'
            };
        },

        // Private: Get device type
        _getDeviceType: function() {
            const width = window.innerWidth;
            if (width < 768) return 'mobile';
            if (width < 1024) return 'tablet';
            return 'desktop';
        },

        // Private: Get connection type
        _getConnectionType: function() {
            if (!navigator.connection) return 'unknown';
            return navigator.connection.effectiveType || 'unknown';
        },

        // Private: Sanitize event name (max 40 characters, alphanumeric + underscore)
        _sanitizeEventName: function(name) {
            return name
                .toLowerCase()
                .replace(/[^a-z0-9_]/g, '_')
                .substr(0, 40);
        },

        // Private: Sanitize event data (Firebase limits)
        _sanitizeEventData: function(data) {
            const sanitized = {};
            const MAX_PARAMS = 25;
            const MAX_STRING_LENGTH = 100;

            let paramCount = 0;

            for (const [key, value] of Object.entries(data)) {
                if (paramCount >= MAX_PARAMS) break;

                // Sanitize key (max 40 characters, alphanumeric + underscore)
                const sanitizedKey = key
                    .toLowerCase()
                    .replace(/[^a-z0-9_]/g, '_')
                    .substr(0, 40);

                // Sanitize value
                if (typeof value === 'string') {
                    sanitized[sanitizedKey] = value.substr(0, MAX_STRING_LENGTH);
                } else if (typeof value === 'number') {
                    sanitized[sanitizedKey] = value;
                } else if (typeof value === 'boolean') {
                    sanitized[sanitizedKey] = value;
                } else if (typeof value === 'object' && value !== null) {
                    // Convert objects to JSON string
                    try {
                        sanitized[sanitizedKey] = JSON.stringify(value).substr(0, MAX_STRING_LENGTH);
                    } catch (e) {
                        sanitized[sanitizedKey] = '[object]';
                    }
                } else {
                    sanitized[sanitizedKey] = String(value).substr(0, MAX_STRING_LENGTH);
                }

                paramCount++;
            }

            return sanitized;
        },

        // Private: Console logging with formatting
        _log: function(message, data) {
            const timestamp = new Date().toISOString();
            console.log(`[Analytics ${timestamp}] ${message}`);

            if (data) {
                console.table(data);
            }
        }
    };

    // Export to global scope
    window.Analytics = Analytics;

})();

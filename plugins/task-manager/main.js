class TaskManagerPlugin {
    constructor(api) {
        this.api = api;
        this.name = '任务管理';
        this.id = 'task-manager';
        this.isActivated = false;
        this.config = {};
        
        this.currentView = 'board';
        this.currentListId = null;
        this.currentFilter = { tag: null, status: null, search: '' };
        
        this.tasks = [];
        this.lists = [];
        this.tags = [];
        this.teams = [];
        this.templates = [];
        
        this.selectedTask = null;
        this.reminderInterval = null;
        
        this.domElements = [];
        this.eventListeners = [];
        
        this.PRIORITY_COLORS = {
            4: '#EF4444',
            3: '#F97316',
            2: '#3B82F6',
            1: '#9CA3AF'
        };
        
        this.PRIORITY_LABELS = {
            4: '高',
            3: '中',
            2: '低',
            1: '普通'
        };
    }

    static DEFAULT_CONFIG = {
        theme: 'auto',
        encryptionKey: null,
        defaultReminders: [
            { time: 15, unit: 'minutes' },
            { time: 1, unit: 'hours' },
            { time: 1, unit: 'days' }
        ]
    };

    async onActivate() {
        try {
            await this.loadConfig();
            await this.loadData();
            this.initEncryption();
            this.initUI();
            this.registerEvents();
            this.startReminderCheck();
            this.tryAddTaskButton();
            window.tmPlugin = this;
            this.isActivated = true;
            console.log('✅ 任务管理插件已激活');
        } catch (error) {
            console.error('插件激活失败:', error);
            this.api.ui.showToast('任务管理插件激活失败', 'error');
        }
    }

    async onDeactivate() {
        this.stopReminderCheck();
        this.cleanupUI();
        this.unregisterEvents();
        this.removeToolbarButton();
        this.removeTaskButton();
        
        if (this.taskButtonObserver) {
            this.taskButtonObserver.disconnect();
            this.taskButtonObserver = null;
        }
        
        if (this.taskButtonPollInterval) {
            clearInterval(this.taskButtonPollInterval);
            this.taskButtonPollInterval = null;
        }
        
        await this.saveData();
        window.tmPlugin = null;
        this.isActivated = false;
        console.log('🛑 任务管理插件已停用');
    }

    async loadConfig() {
        const savedConfig = await this.api.storage.get('config');
        this.config = { ...TaskManagerPlugin.DEFAULT_CONFIG, ...savedConfig };
    }

    async saveConfig() {
        await this.api.storage.set('config', this.config);
    }

    initEncryption() {
        this.encryptionKey = this.config.encryptionKey;
        this.cryptoKey = null;
    }

    async initUI() {
        this.injectStyles();
        this.createMainPanel();
        this.render();
    }

    injectStyles() {
        const css = `
            .tm-panel {
                position: fixed;
                top: 0;
                right: 0;
                width: 100%;
                max-width: 1200px;
                height: 100vh;
                background: var(--tm-bg, #ffffff);
                z-index: 10000;
                display: flex;
                transform: translateX(100%);
                transition: transform 0.3s ease;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .tm-panel.open {
                transform: translateX(0);
            }
            
            .tm-panel * {
                box-sizing: border-box;
            }
            
            .theme-dark .tm-panel {
                --tm-bg: #1e293b;
                --tm-bg-secondary: #334155;
                --tm-text: #f1f5f9;
                --tm-text-secondary: #94a3b8;
                --tm-border: #334155;
            }
            
            .tm-panel:not(.theme-dark) {
                --tm-bg: #ffffff;
                --tm-bg-secondary: #f8fafc;
                --tm-text: #1e293b;
                --tm-text-secondary: #64748b;
                --tm-border: #e2e8f0;
            }
            
            .tm-sidebar {
                width: 180px;
                min-width: 180px;
                background: var(--tm-bg-secondary);
                border-right: 1px solid var(--tm-border);
                overflow-y: auto;
                padding: 12px 0;
            }
            
            .tm-sidebar-section {
                margin-bottom: 8px;
            }
            
            .tm-sidebar-title {
                font-size: 11px;
                font-weight: 600;
                color: var(--tm-text-secondary);
                text-transform: uppercase;
                padding: 8px 16px 4px;
                letter-spacing: 0.5px;
            }
            
            .tm-sidebar-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 16px;
                cursor: pointer;
                color: var(--tm-text);
                font-size: 13px;
                transition: background 0.15s;
            }
            
            .tm-sidebar-item:hover {
                background: var(--tm-border);
            }
            
            .tm-sidebar-item.active {
                background: var(--tm-primary, #3b82f6);
                color: white;
            }
            
            .tm-sidebar-item .icon {
                width: 16px;
                height: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .tm-sidebar-item .count {
                margin-left: auto;
                font-size: 11px;
                background: var(--tm-border);
                padding: 2px 6px;
                border-radius: 10px;
            }
            
            .tm-main {
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            
            .tm-header {
                padding: 16px;
                border-bottom: 1px solid var(--tm-border);
            }
            
            .tm-search-row {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 12px;
            }
            
            .tm-search-input {
                flex: 1;
                padding: 10px 14px;
                border: 1px solid var(--tm-border);
                border-radius: 8px;
                background: var(--tm-bg);
                color: var(--tm-text);
                font-size: 14px;
                outline: none;
                transition: border-color 0.15s;
            }
            
            .tm-search-input:focus {
                border-color: var(--tm-primary, #3b82f6);
            }
            
            .tm-view-tabs {
                display: flex;
                gap: 4px;
            }
            
            .tm-view-tab {
                padding: 6px 14px;
                border-radius: 6px;
                font-size: 13px;
                color: var(--tm-text-secondary);
                cursor: pointer;
                transition: all 0.15s;
            }
            
            .tm-view-tab:hover {
                background: var(--tm-border);
            }
            
            .tm-view-tab.active {
                background: var(--tm-primary, #3b82f6);
                color: white;
            }
            
            .tm-content {
                flex: 1;
                overflow-y: auto;
                padding: 16px;
            }
            
            .tm-task-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .tm-task-card {
                background: var(--tm-bg);
                border: 1px solid var(--tm-border);
                border-radius: 8px;
                padding: 12px 16px;
                cursor: pointer;
                transition: all 0.15s;
            }
            
            .tm-task-card:hover {
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                transform: translateY(-1px);
            }
            
            .tm-task-card.selected {
                border-color: var(--tm-primary, #3b82f6);
            }
            
            .tm-task-header {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .tm-task-checkbox {
                width: 18px;
                height: 18px;
                border: 2px solid var(--tm-border);
                border-radius: 4px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.15s;
            }
            
            .tm-task-checkbox.checked {
                background: #22c55e;
                border-color: #22c55e;
                color: white;
            }
            
            .tm-task-title {
                flex: 1;
                font-size: 14px;
                color: var(--tm-text);
            }
            
            .tm-task-title.completed {
                text-decoration: line-through;
                color: var(--tm-text-secondary);
            }
            
            .tm-task-priority {
                width: 8px;
                height: 8px;
                border-radius: 50%;
            }
            
            .tm-task-meta {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-top: 8px;
                margin-left: 28px;
                font-size: 12px;
                color: var(--tm-text-secondary);
            }
            
            .tm-task-tag {
                background: var(--tm-primary, #3b82f6);
                color: white;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 11px;
            }
            
            .tm-detail {
                width: 350px;
                min-width: 350px;
                border-left: 1px solid var(--tm-border);
                background: var(--tm-bg);
                display: flex;
                flex-direction: column;
            }
            
            .tm-detail-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px;
                border-bottom: 1px solid var(--tm-border);
            }
            
            .tm-detail-title {
                font-size: 16px;
                font-weight: 600;
                color: var(--tm-text);
            }
            
            .tm-detail-close {
                width: 32px;
                height: 32px;
                border: none;
                background: none;
                cursor: pointer;
                color: var(--tm-text-secondary);
                font-size: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 6px;
            }
            
            .tm-detail-close:hover {
                background: var(--tm-border);
            }
            
            .tm-detail-content {
                flex: 1;
                overflow-y: auto;
                padding: 16px;
            }
            
            .tm-detail-field {
                margin-bottom: 16px;
            }
            
            .tm-detail-label {
                font-size: 12px;
                color: var(--tm-text-secondary);
                margin-bottom: 6px;
            }
            
            .tm-detail-input {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid var(--tm-border);
                border-radius: 6px;
                background: var(--tm-bg-secondary);
                color: var(--tm-text);
                font-size: 14px;
                outline: none;
            }
            
            .tm-detail-input:focus {
                border-color: var(--tm-primary, #3b82f6);
            }
            
            .tm-detail-textarea {
                width: 100%;
                min-height: 80px;
                padding: 8px 12px;
                border: 1px solid var(--tm-border);
                border-radius: 6px;
                background: var(--tm-bg-secondary);
                color: var(--tm-text);
                font-size: 14px;
                outline: none;
                resize: vertical;
            }
            
            .tm-priority-selector {
                display: flex;
                gap: 8px;
            }
            
            .tm-priority-btn {
                width: 24px;
                height: 24px;
                border-radius: 50%;
                border: 2px solid transparent;
                cursor: pointer;
                transition: all 0.15s;
            }
            
            .tm-priority-btn.selected {
                transform: scale(1.2);
                border-color: var(--tm-text);
            }
            
            .tm-btn {
                padding: 8px 16px;
                border-radius: 6px;
                border: none;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.15s;
            }
            
            .tm-btn-primary {
                background: var(--tm-primary, #3b82f6);
                color: white;
            }
            
            .tm-btn-primary:hover {
                background: #2563eb;
            }
            
            .tm-btn-secondary {
                background: var(--tm-border);
                color: var(--tm-text);
            }
            
            .tm-btn-secondary:hover {
                background: var(--tm-text-secondary);
                color: white;
            }
            
            .tm-add-btn {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 56px;
                height: 56px;
                border-radius: 50%;
                background: var(--tm-primary, #3b82f6);
                color: white;
                border: none;
                cursor: pointer;
                font-size: 24px;
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.15s;
                z-index: 10001;
            }
            
            .tm-add-btn:hover {
                transform: scale(1.1);
            }
            
            .tm-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.3);
                z-index: 9999;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s;
            }
            
            .tm-overlay.open {
                opacity: 1;
                visibility: visible;
            }
            
            .tm-board-view {
                display: flex;
                gap: 16px;
                height: 100%;
                overflow-x: auto;
                padding-bottom: 16px;
            }
            
            .tm-board-column {
                min-width: 280px;
                max-width: 280px;
                background: var(--tm-bg-secondary);
                border-radius: 8px;
                padding: 12px;
                display: flex;
                flex-direction: column;
            }
            
            .tm-board-column-header {
                font-size: 13px;
                font-weight: 600;
                color: var(--tm-text);
                padding: 8px;
                margin-bottom: 8px;
            }
            
            .tm-board-column-tasks {
                flex: 1;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .tm-empty-state {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 200px;
                color: var(--tm-text-secondary);
            }
            
            .tm-empty-state-icon {
                font-size: 48px;
                margin-bottom: 16px;
                opacity: 0.5;
            }
            
            .tm-empty-state-text {
                font-size: 14px;
            }
            
            .tm-modal {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: var(--tm-bg);
                border-radius: 12px;
                padding: 24px;
                min-width: 400px;
                max-width: 90%;
                max-height: 90%;
                overflow-y: auto;
                z-index: 10002;
                display: none;
                box-shadow: 0 20px 40px rgba(0,0,0,0.2);
            }
            
            .tm-modal.open {
                display: block;
            }
            
            .tm-modal-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 16px;
            }
            
            .tm-modal-title {
                font-size: 18px;
                font-weight: 600;
                color: var(--tm-text);
            }
            
            .tm-modal-close {
                width: 32px;
                height: 32px;
                border: none;
                background: none;
                cursor: pointer;
                color: var(--tm-text-secondary);
                font-size: 20px;
                border-radius: 6px;
            }
            
            .tm-modal-close:hover {
                background: var(--tm-border);
            }
            
            .tm-form-group {
                margin-bottom: 16px;
            }
            
            .tm-form-label {
                display: block;
                font-size: 13px;
                color: var(--tm-text-secondary);
                margin-bottom: 6px;
            }
            
            .tm-form-input {
                width: 100%;
                padding: 10px 12px;
                border: 1px solid var(--tm-border);
                border-radius: 6px;
                background: var(--tm-bg-secondary);
                color: var(--tm-text);
                font-size: 14px;
                outline: none;
            }
            
            .tm-form-select {
                width: 100%;
                padding: 10px 12px;
                border: 1px solid var(--tm-border);
                border-radius: 6px;
                background: var(--tm-bg-secondary);
                color: var(--tm-text);
                font-size: 14px;
                outline: none;
                cursor: pointer;
            }
            
            .tm-form-actions {
                display: flex;
                gap: 8px;
                justify-content: flex-end;
                margin-top: 20px;
            }
            
            .tm-list-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 16px;
                cursor: pointer;
                color: var(--tm-text);
                font-size: 13px;
                transition: background 0.15s;
            }
            
            .tm-list-item:hover {
                background: var(--tm-border);
            }
            
            .tm-list-item.active {
                background: var(--tm-primary, #3b82f6);
                color: white;
            }
            
            .tm-list-color {
                width: 12px;
                height: 12px;
                border-radius: 3px;
            }
            
            .tm-subtask-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 0;
            }
            
            .tm-subtask-checkbox {
                width: 16px;
                height: 16px;
                border: 2px solid var(--tm-border);
                border-radius: 4px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .tm-subtask-checkbox.checked {
                background: #22c55e;
                border-color: #22c55e;
                color: white;
            }
            
            .tm-subtask-title {
                flex: 1;
                font-size: 13px;
                color: var(--tm-text);
            }
            
            .tm-attachment-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px;
                background: var(--tm-bg-secondary);
                border-radius: 6px;
                margin-bottom: 8px;
            }
            
            .tm-attachment-icon {
                width: 32px;
                height: 32px;
                background: var(--tm-border);
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .tm-attachment-info {
                flex: 1;
            }
            
            .tm-attachment-name {
                font-size: 13px;
                color: var(--tm-text);
            }
            
            .tm-attachment-size {
                font-size: 11px;
                color: var(--tm-text-secondary);
            }
            
            .tm-comment-item {
                padding: 12px 0;
                border-bottom: 1px solid var(--tm-border);
            }
            
            .tm-comment-header {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 4px;
            }
            
            .tm-comment-user {
                font-size: 13px;
                font-weight: 500;
                color: var(--tm-text);
            }
            
            .tm-comment-time {
                font-size: 11px;
                color: var(--tm-text-secondary);
            }
            
            .tm-comment-text {
                font-size: 13px;
                color: var(--tm-text);
            }
            
            .tm-calendar-view {
                display: grid;
                grid-template-columns: repeat(7, 1fr);
                gap: 4px;
            }
            
            .tm-calendar-header {
                text-align: center;
                font-size: 12px;
                font-weight: 600;
                color: var(--tm-text-secondary);
                padding: 8px;
            }
            
            .tm-calendar-day {
                aspect-ratio: 1;
                padding: 4px;
                background: var(--tm-bg-secondary);
                border-radius: 6px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.15s;
            }
            
            .tm-calendar-day:hover {
                background: var(--tm-border);
            }
            
            .tm-calendar-day.today {
                border: 2px solid var(--tm-primary, #3b82f6);
            }
            
            .tm-calendar-day.other-month {
                opacity: 0.4;
            }
            
            .tm-quadrant-view {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                grid-template-rows: repeat(2, 1fr);
                gap: 12px;
                height: 100%;
            }
            
            .tm-quadrant {
                background: var(--tm-bg-secondary);
                border-radius: 8px;
                padding: 12px;
                overflow-y: auto;
            }
            
            .tm-quadrant-header {
                font-size: 14px;
                font-weight: 600;
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 2px solid;
            }
            
            .tm-quadrant.q1 { border-color: #EF4444; color: #EF4444; }
            .tm-quadrant.q2 { border-color: #F97316; color: #F97316; }
            .tm-quadrant.q3 { border-color: #3B82F6; color: #3B82F6; }
            .tm-quadrant.q4 { border-color: #9CA3AF; color: #9CA3AF; }
            
            .tm-trash-view {
                padding: 16px;
            }
            
            .tm-trash-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px;
                background: var(--tm-bg);
                border: 1px solid var(--tm-border);
                border-radius: 8px;
                margin-bottom: 8px;
            }
            
            .tm-trash-info {
                flex: 1;
            }
            
            .tm-trash-title {
                font-size: 14px;
                color: var(--tm-text);
            }
            
            .tm-trash-date {
                font-size: 12px;
                color: var(--tm-text-secondary);
            }
            
            .tm-trash-actions {
                display: flex;
                gap: 8px;
            }
            
            .tm-smart-list {
                font-size: 13px;
            }
            
            .tm-smart-list-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 16px;
                cursor: pointer;
                color: var(--tm-text);
            }
            
            .tm-smart-list-item:hover {
                background: var(--tm-border);
            }
            
            .tm-team-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 16px;
                cursor: pointer;
                color: var(--tm-text);
            }
            
            .tm-team-item:hover {
                background: var(--tm-border);
            }
            
            .tm-team-members {
                display: flex;
                gap: 4px;
                margin-left: 8px;
            }
            
            .tm-member-avatar {
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: var(--tm-primary, #3b82f6);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                font-weight: 600;
            }
            
            .tm-member-avatar.online {
                border: 2px solid #22c55e;
            }
            
            .tm-stat-card {
                background: var(--tm-bg-secondary);
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 12px;
            }
            
            .tm-stat-title {
                font-size: 12px;
                color: var(--tm-text-secondary);
                margin-bottom: 8px;
            }
            
            .tm-stat-value {
                font-size: 24px;
                font-weight: 600;
                color: var(--tm-text);
            }
            
            .tm-stat-bar {
                height: 6px;
                background: var(--tm-border);
                border-radius: 3px;
                margin-top: 8px;
                overflow: hidden;
            }
            
            .tm-stat-bar-fill {
                height: 100%;
                border-radius: 3px;
                transition: width 0.3s;
            }
        `;
        
        this.api.ui.injectStyle(css);
    }

    createMainPanel() {
        this.panel = document.createElement('div');
        this.panel.className = 'tm-panel';
        this.panel.innerHTML = `
            <div class="tm-overlay" id="tm-overlay"></div>
            <div class="tm-sidebar" id="tm-sidebar">
                <div class="tm-sidebar-section">
                    <div class="tm-smart-list" id="tm-smart-list"></div>
                </div>
                <div class="tm-sidebar-section">
                    <div class="tm-sidebar-title">标签</div>
                    <div id="tm-tags"></div>
                </div>
                <div class="tm-sidebar-section">
                    <div class="tm-sidebar-title">清单</div>
                    <div id="tm-lists"></div>
                    <div class="tm-sidebar-item" id="tm-add-list">
                        <span class="icon">+</span>
                        <span>新建清单</span>
                    </div>
                </div>
                <div class="tm-sidebar-section">
                    <div class="tm-sidebar-title">团队</div>
                    <div id="tm-teams"></div>
                    <div class="tm-sidebar-item" id="tm-add-team">
                        <span class="icon">+</span>
                        <span>创建团队</span>
                    </div>
                </div>
                <div class="tm-sidebar-section">
                    <div class="tm-sidebar-item" id="tm-view-calendar">
                        <span class="icon">📅</span>
                        <span>日历</span>
                    </div>
                    <div class="tm-sidebar-item" id="tm-view-quadrant">
                        <span class="icon">📊</span>
                        <span>四象限</span>
                    </div>
                </div>
                <div class="tm-sidebar-section" style="margin-top: auto;">
                    <div class="tm-sidebar-item" id="tm-view-trash">
                        <span class="icon">🗑️</span>
                        <span>垃圾桶</span>
                    </div>
                    <div class="tm-sidebar-item" id="tm-view-stats">
                        <span class="icon">📊</span>
                        <span>统计</span>
                    </div>
                    <div class="tm-sidebar-item" id="tm-view-templates">
                        <span class="icon">📋</span>
                        <span>模板</span>
                    </div>
                    <div class="tm-sidebar-item" id="tm-view-settings">
                        <span class="icon">⚙️</span>
                        <span>设置</span>
                    </div>
                </div>
            </div>
            <div class="tm-main">
                <div class="tm-header">
                    <div class="tm-search-row">
                        <input type="text" class="tm-search-input" id="tm-search" placeholder="搜索任务... 或输入任务名称，回车创建">
                        <button class="tm-btn tm-btn-secondary" id="tm-date-btn">📅</button>
                    </div>
                    <div class="tm-view-tabs">
                        <div class="tm-view-tab active" data-view="board">看板</div>
                        <div class="tm-view-tab" data-view="list">列表</div>
                        <div class="tm-view-tab" data-view="time">时间</div>
                    </div>
                </div>
                <div class="tm-content" id="tm-content"></div>
            </div>
            <div class="tm-detail" id="tm-detail" style="display: none;">
                <div class="tm-detail-header">
                    <span class="tm-detail-title">任务详情</span>
                    <button class="tm-detail-close" id="tm-detail-close">×</button>
                </div>
                <div class="tm-detail-content" id="tm-detail-content"></div>
            </div>
        `;
        
        document.body.appendChild(this.panel);
        this.domElements.push(this.panel);
        
        this.overlay = document.getElementById('tm-overlay');
        this.sidebar = document.getElementById('tm-sidebar');
        this.content = document.getElementById('tm-content');
        this.detail = document.getElementById('tm-detail');
        this.detailContent = document.getElementById('tm-detail-content');
    }

    createToolbarButton() {
        this.toolbarButton = this.api.ui.addToolbarButton({
            id: 'tm-task-btn',
            icon: 'bi-check2-square',
            title: '任务管理',
            onClick: () => this.togglePanel()
        });
    }

    removeToolbarButton() {
        if (this.toolbarButton) {
            this.api.ui.removeToolbarButton('tm-task-btn');
        }
    }

    setupToolbarButton() {
        this.tryAddTaskButton();
    }

    tryAddTaskButton() {
        if (this.addTaskButton()) {
            return;
        }

        console.log('任务管理插件: 等待聊天界面加载...');

        this.taskButtonObserver = new MutationObserver(() => {
            this.checkAndAddTaskButton();
        });

        const mainEl = document.querySelector('main');
        if (mainEl) {
            this.taskButtonObserver.observe(mainEl, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'style', 'hidden']
            });
        }

        this.taskButtonPollInterval = setInterval(() => {
            this.checkAndAddTaskButton();
        }, 1000);
    }

    checkAndAddTaskButton() {
        const container = document.querySelector('.chat-session-inputarea-othertypes');
        if (container) {
            const isHidden = container.closest('.hidden') ||
                            container.closest('[style*="display: none"]') ||
                            getComputedStyle(container).display === 'none';

            if (!isHidden && !document.querySelector('.chat-session-inputarea-othertypes-task')) {
                if (this.addTaskButton()) {
                    console.log('✓ 任务按钮已成功添加');
                    if (this.taskButtonPollInterval) {
                        clearInterval(this.taskButtonPollInterval);
                        this.taskButtonPollInterval = null;
                    }
                }
            }
        }
    }

    addTaskButton() {
        const container = document.querySelector('.chat-session-inputarea-othertypes');
        if (!container) {
            return false;
        }

        if (document.querySelector('.chat-session-inputarea-othertypes-task')) {
            return true;
        }

        const voteBtn = container.querySelector('.chat-session-inputarea-othertypes-vote');

        this.taskBtn = document.createElement('button');
        this.taskBtn.className = 'chat-session-inputarea-othertypes-task';
        this.taskBtn.innerHTML = '<i class="bi bi-list-task"></i> 任务';
        this.taskBtn.title = '任务管理';

        this.taskBtn.addEventListener('click', () => this.togglePanel());

        if (voteBtn) {
            voteBtn.after(this.taskBtn);
        } else {
            const sendBtn = container.querySelector('.chat-session-inputarea-sendbtn');
            if (sendBtn) {
                container.insertBefore(this.taskBtn, sendBtn);
            } else {
                container.appendChild(this.taskBtn);
            }
        }

        console.log('✓ 任务按钮已添加');
        return true;
    }

    removeTaskButton() {
        if (this.taskBtn) {
            this.taskBtn.remove();
            this.taskBtn = null;
        }
    }

    togglePanel() {
        this.panel.classList.toggle('open');
        this.overlay.classList.toggle('open');
        if (this.panel.classList.contains('open')) {
            this.render();
        }
    }

    closePanel() {
        this.panel.classList.remove('open');
        this.overlay.classList.remove('open');
    }

    render() {
        this.renderSmartLists();
        this.renderTags();
        this.renderLists();
        this.renderTeams();
        this.renderContent();
    }

    renderSmartLists() {
        const container = document.getElementById('tm-smart-list');
        const today = new Date().toISOString().split('T')[0];
        const smartLists = [
            { id: 'today', name: '今天', filter: { dueDate: today } },
            { id: 'tomorrow', name: '明天', filter: { dueDate: this.getTomorrow() } },
            { id: 'week', name: '本周', filter: { dueDate: this.getWeekEnd() } },
            { id: 'overdue', name: '已逾期', filter: { overdue: true } },
            { id: 'high-priority', name: '高优先级', filter: { priority: 4 } }
        ];
        
        container.innerHTML = smartLists.map(list => `
            <div class="tm-smart-list-item" data-smart="${list.id}">
                <span>${list.name}</span>
                <span class="count">${this.getTaskCountByFilter(list.filter)}</span>
            </div>
        `).join('');
    }

    renderTags() {
        const container = document.getElementById('tm-tags');
        container.innerHTML = this.tags.map(tag => `
            <div class="tm-sidebar-item" data-tag="${tag.id}">
                <span class="tm-list-color" style="background: ${tag.color}"></span>
                <span>${tag.name}</span>
            </div>
        `).join('') + `
            <div class="tm-sidebar-item" id="tm-add-tag">
                <span class="icon">+</span>
                <span>新建标签</span>
            </div>
        `;
    }

    renderLists() {
        const container = document.getElementById('tm-lists');
        const userLists = this.lists.filter(l => !l.teamId);
        container.innerHTML = userLists.map(list => `
            <div class="tm-sidebar-item" data-list="${list.id}">
                <span class="tm-list-color" style="background: ${list.color || '#3B82F6'}"></span>
                <span>${list.name}</span>
            </div>
        `).join('');
    }

    renderTeams() {
        const container = document.getElementById('tm-teams');
        container.innerHTML = this.teams.map(team => `
            <div class="tm-team-item" data-team="${team.id}">
                <span class="icon">🚀</span>
                <span>${team.name}</span>
                <div class="tm-team-members">
                    ${team.members.slice(0, 3).map(m => `
                        <div class="tm-member-avatar ${m.online ? 'online' : ''}">${m.name?.charAt(0) || '?'}</div>
                    `).join('')}
                </div>
            </div>
        `).join('') + `
            <div class="tm-sidebar-item" id="tm-join-team">
                <span class="icon">+</span>
                <span>加入团队</span>
            </div>
        `;
    }

    renderContent() {
        switch (this.currentView) {
            case 'board':
                this.renderBoardView();
                break;
            case 'list':
                this.renderListView();
                break;
            case 'time':
                this.renderTimeView();
                break;
            case 'calendar':
                this.renderCalendarView();
                break;
            case 'quadrant':
                this.renderQuadrantView();
                break;
            case 'trash':
                this.renderTrashView();
                break;
            case 'stats':
                this.renderStatsView();
                break;
            case 'templates':
                this.renderTemplatesView();
                break;
            default:
                this.renderBoardView();
        }
    }

    renderBoardView() {
        const todoTasks = this.getFilteredTasks().filter(t => t.status === 'todo');
        const progressTasks = this.getFilteredTasks().filter(t => t.status === 'in_progress');
        const doneTasks = this.getFilteredTasks().filter(t => t.status === 'done');
        
        this.content.innerHTML = `
            <div class="tm-board-view">
                <div class="tm-board-column">
                    <div class="tm-board-column-header">待办 (${todoTasks.length})</div>
                    <div class="tm-board-column-tasks">
                        ${todoTasks.map(t => this.renderTaskCard(t)).join('')}
                    </div>
                </div>
                <div class="tm-board-column">
                    <div class="tm-board-column-header">进行中 (${progressTasks.length})</div>
                    <div class="tm-board-column-tasks">
                        ${progressTasks.map(t => this.renderTaskCard(t)).join('')}
                    </div>
                </div>
                <div class="tm-board-column">
                    <div class="tm-board-column-header">已完成 (${doneTasks.length})</div>
                    <div class="tm-board-column-tasks">
                        ${doneTasks.map(t => this.renderTaskCard(t)).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    renderListView() {
        const tasks = this.getFilteredTasks();
        if (tasks.length === 0) {
            this.content.innerHTML = `
                <div class="tm-empty-state">
                    <div class="tm-empty-state-icon">📝</div>
                    <div class="tm-empty-state-text">暂无任务</div>
                </div>
            `;
            return;
        }
        
        this.content.innerHTML = `
            <div class="tm-task-list">
                ${tasks.map(t => this.renderTaskCard(t)).join('')}
            </div>
        `;
    }

    renderTimeView() {
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = this.getTomorrow();
        const weekEnd = this.getWeekEnd();
        
        const todayTasks = this.getFilteredTasks().filter(t => t.dueDate === today);
        const tomorrowTasks = this.getFilteredTasks().filter(t => t.dueDate === tomorrow);
        const weekTasks = this.getFilteredTasks().filter(t => t.dueDate > tomorrow && t.dueDate <= weekEnd);
        const overdueTasks = this.getFilteredTasks().filter(t => t.dueDate && t.dueDate < today && t.status !== 'done');
        
        this.content.innerHTML = `
            <div class="tm-task-list">
                ${overdueTasks.length > 0 ? `
                    <div class="tm-sidebar-title" style="color: #EF4444;">已逾期</div>
                    ${overdueTasks.map(t => this.renderTaskCard(t)).join('')}
                ` : ''}
                ${todayTasks.length > 0 ? `
                    <div class="tm-sidebar-title">今天</div>
                    ${todayTasks.map(t => this.renderTaskCard(t)).join('')}
                ` : ''}
                ${tomorrowTasks.length > 0 ? `
                    <div class="tm-sidebar-title">明天</div>
                    ${tomorrowTasks.map(t => this.renderTaskCard(t)).join('')}
                ` : ''}
                ${weekTasks.length > 0 ? `
                    <div class="tm-sidebar-title">本周</div>
                    ${weekTasks.map(t => this.renderTaskCard(t)).join('')}
                ` : ''}
            </div>
        `;
    }

    renderCalendarView() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDay = firstDay.getDay();
        const daysInMonth = lastDay.getDate();
        
        const days = [];
        const prevMonthDays = new Date(year, month, 0).getDate();
        
        for (let i = startDay - 1; i >= 0; i--) {
            days.push({ date: prevMonthDays - i, other: true });
        }
        
        for (let i = 1; i <= daysInMonth; i++) {
            days.push({ date: i, other: false });
        }
        
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            days.push({ date: i, other: true });
        }
        
        const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
        
        this.content.innerHTML = `
            <div class="tm-calendar-view">
                ${weekDays.map(d => `<div class="tm-calendar-header">${d}</div>`).join('')}
                ${days.map(d => {
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d.date).padStart(2, '0')}`;
                    const tasks = this.tasks.filter(t => t.dueDate === dateStr && !t.isDeleted);
                    const isToday = dateStr === new Date().toISOString().split('T')[0];
                    return `
                        <div class="tm-calendar-day ${d.other ? 'other-month' : ''} ${isToday ? 'today' : ''}" data-date="${dateStr}">
                            <div>${d.date}</div>
                            ${tasks.length > 0 ? `<div style="font-size: 10px; color: var(--tm-primary);">${tasks.length}任务</div>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    renderQuadrantView() {
        const tasks = this.getFilteredTasks().filter(t => !t.isDeleted);
        
        const q1 = tasks.filter(t => t.priority === 4 && t.urgency === 4);
        const q2 = tasks.filter(t => t.priority === 4 && t.urgency < 4);
        const q3 = tasks.filter(t => t.priority < 4 && t.urgency === 4);
        const q4 = tasks.filter(t => t.priority < 4 && t.urgency < 4);
        
        this.content.innerHTML = `
            <div class="tm-quadrant-view">
                <div class="tm-quadrant q1">
                    <div class="tm-quadrant-header">重要且紧急</div>
                    ${q1.map(t => this.renderTaskCard(t)).join('')}
                </div>
                <div class="tm-quadrant q2">
                    <div class="tm-quadrant-header">重要不紧急</div>
                    ${q2.map(t => this.renderTaskCard(t)).join('')}
                </div>
                <div class="tm-quadrant q3">
                    <div class="tm-quadrant-header">紧急不重要</div>
                    ${q3.map(t => this.renderTaskCard(t)).join('')}
                </div>
                <div class="tm-quadrant q4">
                    <div class="tm-quadrant-header">不重要不紧急</div>
                    ${q4.map(t => this.renderTaskCard(t)).join('')}
                </div>
            </div>
        `;
    }

    renderTrashView() {
        const deletedTasks = this.tasks.filter(t => t.isDeleted);
        
        if (deletedTasks.length === 0) {
            this.content.innerHTML = `
                <div class="tm-empty-state">
                    <div class="tm-empty-state-icon">🗑️</div>
                    <div class="tm-empty-state-text">垃圾桶为空</div>
                </div>
            `;
            return;
        }
        
        this.content.innerHTML = `
            <div class="tm-trash-view">
                ${deletedTasks.map(t => `
                    <div class="tm-trash-item">
                        <div class="tm-trash-info">
                            <div class="tm-trash-title">${t.title}</div>
                            <div class="tm-trash-date">删除于 ${new Date(t.deletedAt).toLocaleDateString()}</div>
                        </div>
                        <div class="tm-trash-actions">
                            <button class="tm-btn tm-btn-secondary" onclick="window.tmPlugin.restoreTask('${t.id}')">恢复</button>
                            <button class="tm-btn tm-btn-secondary" onclick="window.tmPlugin.deleteTaskPermanently('${t.id}')">彻底删除</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderStatsView() {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        const weekStartStr = weekStart.toISOString().split('T')[0];
        
        const weekTasks = this.tasks.filter(t => !t.isDeleted && t.createdAt >= weekStart.getTime());
        const weekDone = weekTasks.filter(t => t.status === 'done').length;
        const total = weekTasks.length;
        const overdue = this.tasks.filter(t => !t.isDeleted && t.dueDate && t.dueDate < now.toISOString().split('T')[0] && t.status !== 'done').length;
        
        this.content.innerHTML = `
            <div class="tm-stat-card">
                <div class="tm-stat-title">本周完成率</div>
                <div class="tm-stat-value">${total > 0 ? Math.round(weekDone / total * 100) : 0}%</div>
                <div class="tm-stat-bar">
                    <div class="tm-stat-bar-fill" style="width: ${total > 0 ? weekDone / total * 100 : 0}%; background: #22c55e;"></div>
                </div>
                <div style="font-size: 12px; color: var(--tm-text-secondary); margin-top: 4px;">${weekDone}/${total}</div>
            </div>
            <div class="tm-stat-card">
                <div class="tm-stat-title">逾期任务</div>
                <div class="tm-stat-value">${overdue}</div>
                <div style="font-size: 12px; color: var(--tm-text-secondary);">${overdue > 0 ? '有任务已逾期，请尽快处理' : '暂无逾期任务'}</div>
            </div>
            <div class="tm-stat-card">
                <div class="tm-stat-title">总任务数</div>
                <div class="tm-stat-value">${this.tasks.filter(t => !t.isDeleted).length}</div>
            </div>
        `;
    }

    renderTemplatesView() {
        const personalTemplates = this.templates.filter(t => t.type === 'personal');
        
        this.content.innerHTML = `
            <div class="tm-task-list">
                ${personalTemplates.map(t => `
                    <div class="tm-task-card" data-template="${t.id}">
                        <div class="tm-task-title">${t.name}</div>
                        <div class="tm-task-meta">${t.tasks?.length || 0} 个子任务</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderTaskCard(task) {
        const list = this.lists.find(l => l.id === task.listId);
        const taskTags = task.tags?.map(tagId => this.tags.find(t => t.id === tagId)).filter(Boolean) || [];
        
        return `
            <div class="tm-task-card" data-task="${task.id}">
                <div class="tm-task-header">
                    <div class="tm-task-checkbox ${task.status === 'done' ? 'checked' : ''}" data-task-id="${task.id}">
                        ${task.status === 'done' ? '✓' : ''}
                    </div>
                    <div class="tm-task-title ${task.status === 'done' ? 'completed' : ''}">${task.title}</div>
                    <div class="tm-task-priority" style="background: ${this.PRIORITY_COLORS[task.priority]}"></div>
                </div>
                <div class="tm-task-meta">
                    ${task.dueDate ? `<span>${this.formatDate(task.dueDate)}</span>` : ''}
                    ${list ? `<span>📁 ${list.name}</span>` : ''}
                    ${taskTags.map(tag => `<span class="tm-task-tag" style="background: ${tag.color}">${tag.name}</span>`).join('')}
                    ${task.subtasks?.length ? `<span>📝 ${task.subtasks.filter(s => s.done).length}/${task.subtasks.length}</span>` : ''}
                </div>
            </div>
        `;
    }

    renderTaskDetail(task) {
        const list = this.lists.find(l => l.id === task.listId);
        const taskTags = task.tags?.map(tagId => this.tags.find(t => t.id === tagId)).filter(Boolean) || [];
        
        this.detailContent.innerHTML = `
            <div class="tm-detail-field">
                <input type="text" class="tm-detail-input" id="tm-task-title" value="${task.title}">
            </div>
            <div class="tm-detail-field">
                <label class="tm-detail-label">
                    <input type="checkbox" id="tm-task-status" ${task.status === 'done' ? 'checked' : ''}>
                    标记为完成
                </label>
            </div>
            <div class="tm-detail-field">
                <div class="tm-detail-label">优先级</div>
                <div class="tm-priority-selector">
                    ${[4, 3, 2, 1].map(p => `
                        <div class="tm-priority-btn ${task.priority === p ? 'selected' : ''}" 
                             style="background: ${this.PRIORITY_COLORS[p]}"
                             data-priority="${p}"></div>
                    `).join('')}
                </div>
            </div>
            <div class="tm-detail-field">
                <div class="tm-detail-label">紧急程度</div>
                <div class="tm-priority-selector">
                    ${[4, 3, 2, 1].map(u => `
                        <div class="tm-priority-btn ${task.urgency === u ? 'selected' : ''}" 
                             style="background: ${this.PRIORITY_COLORS[u]}"
                             data-urgency="${u}"></div>
                    `).join('')}
                </div>
            </div>
            <div class="tm-detail-field">
                <div class="tm-detail-label">截止日期</div>
                <input type="date" class="tm-detail-input" id="tm-task-due-date" value="${task.dueDate || ''}">
            </div>
            <div class="tm-detail-field">
                <div class="tm-detail-label">截止时间</div>
                <input type="time" class="tm-detail-input" id="tm-task-due-time" value="${task.dueTime || ''}">
            </div>
            <div class="tm-detail-field">
                <div class="tm-detail-label">清单</div>
                <select class="tm-form-select" id="tm-task-list">
                    ${this.lists.filter(l => !l.teamId).map(l => `
                        <option value="${l.id}" ${l.id === task.listId ? 'selected' : ''}>${l.name}</option>
                    `).join('')}
                </select>
            </div>
            <div class="tm-detail-field">
                <div class="tm-detail-label">标签</div>
                <div id="tm-task-tags">
                    ${taskTags.map(tag => `
                        <span class="tm-task-tag" style="background: ${tag.color}" data-tag-id="${tag.id}">${tag.name} ×</span>
                    `).join('')}
                    <button class="tm-btn tm-btn-secondary" id="tm-add-tag-to-task" style="padding: 4px 8px; font-size: 12px;">+ 添加</button>
                </div>
            </div>
            <div class="tm-detail-field">
                <div class="tm-detail-label">描述</div>
                <textarea class="tm-detail-textarea" id="tm-task-content" placeholder="添加描述...">${task.content || ''}</textarea>
            </div>
            <div class="tm-detail-field">
                <div class="tm-detail-label">子任务 (${task.subtasks?.length || 0})</div>
                <div id="tm-subtasks">
                    ${(task.subtasks || []).map((st, i) => `
                        <div class="tm-subtask-item">
                            <div class="tm-subtask-checkbox ${st.done ? 'checked' : ''}" data-subtask="${i}">
                                ${st.done ? '✓' : ''}
                            </div>
                            <span class="tm-subtask-title ${st.done ? 'completed' : ''}">${st.title}</span>
                        </div>
                    `).join('')}
                    <div class="tm-subtask-item" id="tm-add-subtask">
                        <span style="color: var(--tm-text-secondary); font-size: 13px; cursor: pointer;">+ 添加子任务</span>
                    </div>
                </div>
            </div>
            <div class="tm-detail-field">
                <div class="tm-detail-label">附件 (${task.attachments?.length || 0})</div>
                <div id="tm-attachments">
                    ${(task.attachments || []).map(att => `
                        <div class="tm-attachment-item">
                            <div class="tm-attachment-icon">📎</div>
                            <div class="tm-attachment-info">
                                <div class="tm-attachment-name">${att.name}</div>
                                <div class="tm-attachment-size">${this.formatFileSize(att.size)}</div>
                            </div>
                        </div>
                    `).join('')}
                    <div class="tm-attachment-item" id="tm-add-attachment" style="cursor: pointer; justify-content: center; border: 2px dashed var(--tm-border);">
                        <span>+ 添加附件</span>
                    </div>
                </div>
            </div>
            <div class="tm-detail-field">
                <div class="tm-detail-label">评论 (${task.comments?.length || 0})</div>
                <div id="tm-comments">
                    ${(task.comments || []).map(c => `
                        <div class="tm-comment-item">
                            <div class="tm-comment-header">
                                <span class="tm-comment-user">${c.userName || '用户'}</span>
                                <span class="tm-comment-time">${new Date(c.time).toLocaleString()}</span>
                            </div>
                            <div class="tm-comment-text">${c.text}</div>
                        </div>
                    `).join('')}
                    <textarea class="tm-detail-textarea" id="tm-add-comment" placeholder="添加评论... (支持 @提及)" style="min-height: 60px;"></textarea>
                </div>
            </div>
            <div style="margin-top: 20px;">
                <button class="tm-btn tm-btn-secondary" id="tm-delete-task" style="width: 100%;">🗑️ 删除任务</button>
            </div>
        `;
        
        this.setupTaskDetailEvents(task);
    }

    setupTaskDetailEvents(task) {
        document.getElementById('tm-task-title')?.addEventListener('change', (e) => {
            task.title = e.target.value;
            this.saveTask(task);
        });
        
        document.getElementById('tm-task-status')?.addEventListener('change', (e) => {
            task.status = e.target.checked ? 'done' : 'todo';
            this.saveTask(task);
            this.renderContent();
        });
        
        document.getElementById('tm-task-content')?.addEventListener('change', (e) => {
            task.content = e.target.value;
            this.saveTask(task);
        });
        
        document.getElementById('tm-task-due-date')?.addEventListener('change', (e) => {
            task.dueDate = e.target.value || null;
            this.saveTask(task);
        });
        
        document.getElementById('tm-task-due-time')?.addEventListener('change', (e) => {
            task.dueTime = e.target.value || null;
            this.saveTask(task);
        });
        
        document.getElementById('tm-task-list')?.addEventListener('change', (e) => {
            task.listId = e.target.value;
            this.saveTask(task);
        });
        
        document.querySelectorAll('.tm-priority-btn[data-priority]').forEach(btn => {
            btn.addEventListener('click', () => {
                task.priority = parseInt(btn.dataset.priority);
                this.saveTask(task);
                this.renderTaskDetail(task);
            });
        });
        
        document.querySelectorAll('.tm-priority-btn[data-urgency]').forEach(btn => {
            btn.addEventListener('click', () => {
                task.urgency = parseInt(btn.dataset.urgency);
                this.saveTask(task);
                this.renderTaskDetail(task);
            });
        });
        
        document.getElementById('tm-delete-task')?.addEventListener('click', () => {
            this.deleteTask(task.id);
        });
    }

    getFilteredTasks() {
        let tasks = this.tasks.filter(t => !t.isDeleted);
        
        if (this.currentListId) {
            tasks = tasks.filter(t => t.listId === this.currentListId);
        }
        
        if (this.currentFilter.tag) {
            tasks = tasks.filter(t => t.tags?.includes(this.currentFilter.tag));
        }
        
        if (this.currentFilter.status) {
            tasks = tasks.filter(t => t.status === this.currentFilter.status);
        }
        
        if (this.currentFilter.search) {
            const search = this.currentFilter.search.toLowerCase();
            tasks = tasks.filter(t => 
                t.title?.toLowerCase().includes(search) || 
                t.content?.toLowerCase().includes(search)
            );
        }
        
        return tasks;
    }

    getTaskCountByFilter(filter) {
        return this.tasks.filter(t => {
            if (t.isDeleted) return false;
            if (filter.dueDate && t.dueDate !== filter.dueDate) return false;
            if (filter.overdue) {
                const today = new Date().toISOString().split('T')[0];
                if (!t.dueDate || t.dueDate >= today || t.status === 'done') return false;
            }
            if (filter.priority && t.priority !== filter.priority) return false;
            return true;
        }).length;
    }

    switchView(view) {
        this.currentView = view;
        document.querySelectorAll('.tm-view-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.view === view);
        });
        this.renderContent();
    }

    selectList(listId) {
        this.currentListId = listId;
        this.currentFilter = { tag: null, status: null, search: '' };
        this.render();
    }

    async createTask(title, options = {}) {
        const task = {
            id: this.generateId(),
            listId: this.currentListId || this.lists[0]?.id || this.createDefaultList().id,
            title: title,
            content: options.content || '',
            status: 'todo',
            priority: options.priority || 1,
            urgency: options.urgency || 1,
            dueDate: options.dueDate || new Date().toISOString().split('T')[0],
            dueTime: options.dueTime || null,
            reminders: options.reminders || [...this.config.defaultReminders],
            repeatRule: options.repeatRule || null,
            assigneeId: options.assigneeId || null,
            tags: options.tags || [],
            parentId: options.parentId || null,
            subtasks: options.subtasks || [],
            attachments: [],
            comments: [],
            activityLog: [{
                action: 'created',
                time: Date.now()
            }],
            isDeleted: false,
            deletedAt: null,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        this.tasks.push(task);
        await this.saveData();
        this.render();
        
        return task;
    }

    async saveTask(task) {
        task.updatedAt = Date.now();
        task.activityLog.push({
            action: 'updated',
            time: Date.now()
        });
        await this.saveData();
    }

    async deleteTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.isDeleted = true;
            task.deletedAt = Date.now();
            task.activityLog.push({
                action: 'deleted',
                time: Date.now()
            });
            await this.saveData();
            this.detail.style.display = 'none';
            this.render();
        }
    }

    async restoreTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.isDeleted = false;
            task.deletedAt = null;
            task.activityLog.push({
                action: 'restored',
                time: Date.now()
            });
            await this.saveData();
            this.render();
        }
    }

    async deleteTaskPermanently(taskId) {
        const index = this.tasks.findIndex(t => t.id === taskId);
        if (index > -1) {
            this.tasks.splice(index, 1);
            await this.saveData();
            this.render();
        }
    }

    async toggleTaskStatus(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.status = task.status === 'done' ? 'todo' : 'done';
            task.updatedAt = Date.now();
            await this.saveData();
            this.render();
        }
    }

    createDefaultList() {
        const list = {
            id: this.generateId(),
            name: '默认',
            color: '#3B82F6',
            sort: 0,
            createdAt: Date.now()
        };
        this.lists.push(list);
        return list;
    }

    generateId() {
        return 'tm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getTomorrow() {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
    }

    getWeekEnd() {
        const d = new Date();
        d.setDate(d.getDate() + (7 - d.getDay()));
        return d.toISOString().split('T')[0];
    }

    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const targetDate = new Date(dateStr);
        targetDate.setHours(0, 0, 0, 0);
        
        const diff = Math.floor((targetDate - today) / (1000 * 60 * 60 * 24));
        
        if (diff === 0) return '今天';
        if (diff === 1) return '明天';
        if (diff === -1) return '昨天';
        if (diff < -1) return '已逾期';
        
        return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    async loadData() {
        const lists = await this.api.storage.get('lists');
        const tasks = await this.api.storage.get('tasks');
        const tags = await this.api.storage.get('tags');
        const teams = await this.api.storage.get('teams');
        const templates = await this.api.storage.get('templates');
        
        this.lists = lists || [];
        this.tasks = tasks || [];
        this.tags = tags || [];
        this.teams = teams || [];
        this.templates = templates || [];
        
        if (this.lists.length === 0) {
            this.lists.push(this.createDefaultList());
        }
        
        if (this.tags.length === 0) {
            this.tags = [
                { id: this.generateId(), name: '工作', color: '#3B82F6' },
                { id: this.generateId(), name: '生活', color: '#22C55E' },
                { id: this.generateId(), name: '紧急', color: '#EF4444' }
            ];
        }
        
        if (this.templates.length === 0) {
            this.templates = [
                {
                    id: this.generateId(),
                    type: 'personal',
                    name: '每日待办',
                    tasks: [
                        { title: '今日计划', done: false },
                        { title: '重要事项', done: false },
                        { title: '临时任务', done: false }
                    ]
                },
                {
                    id: this.generateId(),
                    type: 'personal',
                    name: '周报模板',
                    tasks: [
                        { title: '本周完成工作', done: false },
                        { title: '下周计划', done: false },
                        { title: '问题与建议', done: false }
                    ]
                },
                {
                    id: this.generateId(),
                    type: 'personal',
                    name: '项目启动',
                    tasks: [
                        { title: '需求确认', done: false },
                        { title: '设计评审', done: false },
                        { title: '开发任务', done: false },
                        { title: '测试验收', done: false }
                    ]
                }
            ];
        }
        
        if (this.tasks.length === 0) {
            this.tasks = [
                {
                    id: this.generateId(),
                    listId: this.lists[0].id,
                    title: '欢迎使用任务管理',
                    content: '这是您的第一个任务，快来体验吧！',
                    status: 'done',
                    priority: 1,
                    urgency: 1,
                    dueDate: new Date().toISOString().split('T')[0],
                    dueTime: null,
                    reminders: [],
                    tags: [],
                    subtasks: [],
                    attachments: [],
                    comments: [],
                    activityLog: [{ action: 'created', time: Date.now() }],
                    isDeleted: false,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                },
                {
                    id: this.generateId(),
                    listId: this.lists[0].id,
                    title: '点击任务查看详情',
                    content: '在这里可以设置任务的优先级、截止日期、标签等',
                    status: 'todo',
                    priority: 4,
                    urgency: 3,
                    dueDate: new Date().toISOString().split('T')[0],
                    dueTime: null,
                    reminders: [],
                    tags: [],
                    subtasks: [],
                    attachments: [],
                    comments: [],
                    activityLog: [{ action: 'created', time: Date.now() }],
                    isDeleted: false,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                },
                {
                    id: this.generateId(),
                    listId: this.lists[0].id,
                    title: '设置提醒时间',
                    content: '支持自定义提醒时间，到期前自动提醒',
                    status: 'in_progress',
                    priority: 3,
                    urgency: 2,
                    dueDate: this.getTomorrow(),
                    dueTime: null,
                    reminders: [{ time: 15, unit: 'minutes' }, { time: 1, unit: 'hours' }, { time: 1, unit: 'days' }],
                    tags: [],
                    subtasks: [],
                    attachments: [],
                    comments: [],
                    activityLog: [{ action: 'created', time: Date.now() }],
                    isDeleted: false,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                }
            ];
        }
        
        await this.saveData();
    }

    async saveData() {
        await this.api.storage.set('lists', this.lists);
        await this.api.storage.set('tasks', this.tasks);
        await this.api.storage.set('tags', this.tags);
        await this.api.storage.set('teams', this.teams);
        await this.api.storage.set('templates', this.templates);
    }

    registerEvents() {
        this.addEventListener(document, 'click', this.handleDocumentClick.bind(this));
        
        const searchInput = document.getElementById('tm-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.currentFilter.search = e.target.value;
                this.renderContent();
            });
            
            searchInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                    await this.createTask(e.target.value.trim());
                    e.target.value = '';
                }
            });
        }
        
        document.querySelectorAll('.tm-view-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchView(tab.dataset.view);
            });
        });
    }

    handleDocumentClick(e) {
        if (e.target.closest('#tm-overlay') || e.target.closest('#tm-detail-close')) {
            this.detail.style.display = 'none';
            this.selectedTask = null;
        }
        
        const taskCard = e.target.closest('.tm-task-card[data-task]');
        if (taskCard && !e.target.closest('.tm-task-checkbox')) {
            const taskId = taskCard.dataset.task;
            const task = this.tasks.find(t => t.id === taskId);
            if (task) {
                this.selectedTask = task;
                this.detail.style.display = 'flex';
                this.renderTaskDetail(task);
            }
        }
        
        const taskCheckbox = e.target.closest('.tm-task-checkbox');
        if (taskCheckbox) {
            const taskId = taskCheckbox.dataset.taskId;
            this.toggleTaskStatus(taskId);
        }
        
        const listItem = e.target.closest('.tm-sidebar-item[data-list]');
        if (listItem) {
            this.selectList(listItem.dataset.list);
        }
        
        const smartListItem = e.target.closest('.tm-smart-list-item');
        if (smartListItem) {
            this.currentListId = null;
            this.render();
        }
        
        const tagItem = e.target.closest('.tm-sidebar-item[data-tag]');
        if (tagItem) {
            this.currentFilter.tag = tagItem.dataset.tag;
            this.currentListId = null;
            this.render();
        }
        
        const teamItem = e.target.closest('.tm-team-item[data-team]');
        if (teamItem) {
            this.currentFilter.teamId = teamItem.dataset.team;
            this.render();
        }
        
        const calendarItem = e.target.closest('#tm-view-calendar');
        if (calendarItem) {
            this.switchView('calendar');
        }
        
        const quadrantItem = e.target.closest('#tm-view-quadrant');
        if (quadrantItem) {
            this.switchView('quadrant');
        }
        
        const trashItem = e.target.closest('#tm-view-trash');
        if (trashItem) {
            this.switchView('trash');
        }
        
        const statsItem = e.target.closest('#tm-view-stats');
        if (statsItem) {
            this.switchView('stats');
        }
        
        const templatesItem = e.target.closest('#tm-view-templates');
        if (templatesItem) {
            this.switchView('templates');
        }
        
        const addListItem = e.target.closest('#tm-add-list');
        if (addListItem) {
            this.showCreateListModal();
        }
        
        const addTeamItem = e.target.closest('#tm-add-team');
        if (addTeamItem) {
            this.showCreateTeamModal();
        }
        
        const calendarDay = e.target.closest('.tm-calendar-day');
        if (calendarDay && !calendarDay.classList.contains('other-month')) {
            const date = calendarDay.dataset.date;
            this.currentFilter.dueDate = date;
            this.switchView('list');
        }
    }

    addEventListener(element, event, handler) {
        element.addEventListener(event, handler);
        this.eventListeners.push({ element, event, handler });
    }

    unregisterEvents() {
        this.eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.eventListeners = [];
    }

    cleanupUI() {
        if (this.panel) {
            this.panel.remove();
        }
    }

    startReminderCheck() {
        this.reminderInterval = setInterval(() => {
            this.checkReminders();
        }, 60000);
    }

    stopReminderCheck() {
        if (this.reminderInterval) {
            clearInterval(this.reminderInterval);
        }
    }

    checkReminders() {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        
        this.tasks.filter(t => !t.isDeleted && t.status !== 'done').forEach(task => {
            if (!task.dueDate) return;
            
            const due = new Date(task.dueDate + ' ' + (task.dueTime || '23:59'));
            const diff = due - now;
            
            (task.reminders || []).forEach(reminder => {
                const reminderMs = this.getReminderMs(reminder);
                if (diff > 0 && diff <= reminderMs && diff > reminderMs - 60000) {
                    this.sendReminder(task, reminder);
                }
            });
        });
    }

    getReminderMs(reminder) {
        switch (reminder.unit) {
            case 'minutes': return reminder.time * 60 * 1000;
            case 'hours': return reminder.time * 60 * 60 * 1000;
            case 'days': return reminder.time * 24 * 60 * 60 * 1000;
            case 'months': return reminder.time * 30 * 24 * 60 * 60 * 1000;
            default: return 0;
        }
    }

    sendReminder(task, reminder) {
        this.api.ui.showToast(`提醒: ${task.title} 截止时间快到了！`, 'info');
        
        if (this.api.hasPermission('chat')) {
            this.api.chat.sendMessage(
                'self',
                `任务提醒: ${task.title} 将在 ${reminder.time} ${reminder.unit} 后到期`,
                'user'
            );
        }
    }

    showCreateListModal() {
        const modal = document.createElement('div');
        modal.className = 'tm-modal open';
        modal.innerHTML = `
            <div class="tm-modal-header">
                <span class="tm-modal-title">新建清单</span>
                <button class="tm-modal-close" id="tm-modal-close">×</button>
            </div>
            <div class="tm-form-group">
                <label class="tm-form-label">清单名称</label>
                <input type="text" class="tm-form-input" id="tm-list-name" placeholder="输入清单名称">
            </div>
            <div class="tm-form-group">
                <label class="tm-form-label">颜色</label>
                <div class="tm-priority-selector" id="tm-list-colors">
                    ${['#EF4444', '#F97316', '#3B82F6', '#22C55E', '#8B5CF6', '#EC4899'].map(c => `
                        <div class="tm-priority-btn" style="background: ${c}" data-color="${c}"></div>
                    `).join('')}
                </div>
            </div>
            <div class="tm-form-actions">
                <button class="tm-btn tm-btn-secondary" id="tm-modal-cancel">取消</button>
                <button class="tm-btn tm-btn-primary" id="tm-modal-confirm">创建</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        let selectedColor = '#3B82F6';
        
        modal.querySelectorAll('.tm-priority-btn[data-color]').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.querySelectorAll('.tm-priority-btn[data-color]').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                selectedColor = btn.dataset.color;
            });
        });
        
        modal.querySelector('#tm-modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('#tm-modal-cancel').addEventListener('click', () => modal.remove());
        modal.querySelector('#tm-modal-confirm').addEventListener('click', async () => {
            const name = document.getElementById('tm-list-name').value.trim();
            if (name) {
                this.lists.push({
                    id: this.generateId(),
                    name: name,
                    color: selectedColor,
                    sort: this.lists.length,
                    createdAt: Date.now()
                });
                await this.saveData();
                this.render();
                modal.remove();
            }
        });
    }

    showCreateTeamModal() {
        const modal = document.createElement('div');
        modal.className = 'tm-modal open';
        modal.innerHTML = `
            <div class="tm-modal-header">
                <span class="tm-modal-title">创建团队</span>
                <button class="tm-modal-close" id="tm-modal-close">×</button>
            </div>
            <div class="tm-form-group">
                <label class="tm-form-label">团队名称</label>
                <input type="text" class="tm-form-input" id="tm-team-name" placeholder="输入团队名称">
            </div>
            <div class="tm-form-actions">
                <button class="tm-btn tm-btn-secondary" id="tm-modal-cancel">取消</button>
                <button class="tm-btn tm-btn-primary" id="tm-modal-confirm">创建</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.querySelector('#tm-modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('#tm-modal-cancel').addEventListener('click', () => modal.remove());
        modal.querySelector('#tm-modal-confirm').addEventListener('click', async () => {
            const name = document.getElementById('tm-team-name').value.trim();
            if (name) {
                const inviteCode = this.generateInviteCode();
                this.teams.push({
                    id: this.generateId(),
                    name: name,
                    inviteCode: inviteCode,
                    ownerId: 'current_user',
                    members: [{
                        userId: 'current_user',
                        name: '我',
                        role: 'admin',
                        online: true,
                        joinedAt: Date.now()
                    }],
                    createdAt: Date.now()
                });
                await this.saveData();
                this.render();
                this.api.ui.showToast(`团队已创建，邀请码: ${inviteCode}`, 'success');
                modal.remove();
            }
        });
    }

    generateInviteCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
}

window.tmPlugin = null;

registerPlugin('task-manager', TaskManagerPlugin);

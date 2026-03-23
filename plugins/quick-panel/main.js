/**
 * 快捷面板插件
 * 在页面右下角添加悬浮快捷操作面板
 */
class QuickPanelPlugin {
    constructor(api) {
        this.api = api;
        this.name = '快捷面板';
        this.panelId = 'quick-panel-container';
        this.clockInterval = null;
        this.isExpanded = false;
        this.config = {
            primaryColor: '#3b82f6',
            position: 'bottom-right',
            showClock: true,
            showBackTop: true,
            showThemeToggle: true
        };
    }

    async onActivate() {
        console.log('🚀 快捷面板插件已激活');

        // 加载用户配置
        const savedConfig = await this.api.storage.get('config');
        if (savedConfig) {
            this.config = { ...this.config, ...savedConfig };
        }

        // 创建面板
        this.createPanel();

        // 启动时钟
        if (this.config.showClock) {
            this.startClock();
        }
    }

    async onDeactivate() {
        console.log('👋 快捷面板插件已停用');

        // 停止时钟
        if (this.clockInterval) {
            clearInterval(this.clockInterval);
        }

        // 移除面板
        this.removePanel();
    }

    createPanel() {
        // 检查是否已存在
        if (document.getElementById(this.panelId)) {
            return;
        }

        // 创建主容器
        const panel = document.createElement('div');
        panel.id = this.panelId;
        panel.className = `quick-panel ${this.config.position}`;
        panel.style.setProperty('--qp-primary', this.config.primaryColor);

        panel.innerHTML = `
            <div class="quick-panel-main-btn" title="快捷面板">
                <i class="bi bi-lightning-charge"></i>
            </div>
            <div class="quick-panel-menu hidden">
                <div class="quick-panel-header">
                    <span class="quick-panel-title">快捷面板</span>
                    <button class="quick-panel-settings-btn" title="设置">
                        <i class="bi bi-gear"></i>
                    </button>
                </div>
                <div class="quick-panel-clock">
                    <div class="quick-panel-time">--:--:--</div>
                    <div class="quick-panel-date">----年--月--日</div>
                </div>
                <div class="quick-panel-actions">
                    <button class="quick-panel-action-btn" data-action="backTop" title="回到顶部">
                        <i class="bi bi-arrow-up-circle"></i>
                        <span>回到顶部</span>
                    </button>
                    <button class="quick-panel-action-btn" data-action="toggleTheme" title="切换主题">
                        <i class="bi bi-moon-stars"></i>
                        <span>切换主题</span>
                    </button>
                    <button class="quick-panel-action-btn" data-action="refresh" title="刷新页面">
                        <i class="bi bi-arrow-clockwise"></i>
                        <span>刷新</span>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        // 绑定事件
        this.bindEvents(panel);
    }

    bindEvents(panel) {
        // 主按钮点击 - 展开/收起菜单
        const mainBtn = panel.querySelector('.quick-panel-main-btn');
        mainBtn.addEventListener('click', () => this.toggleMenu());

        // 设置按钮
        const settingsBtn = panel.querySelector('.quick-panel-settings-btn');
        settingsBtn.addEventListener('click', () => this.showSettings());

        // 操作按钮
        const actionBtns = panel.querySelectorAll('.quick-panel-action-btn');
        actionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                this.handleAction(action);
                this.addClickEffect(btn);
            });
        });

        // 点击外部关闭菜单
        document.addEventListener('click', (e) => {
            if (!panel.contains(e.target) && this.isExpanded) {
                this.toggleMenu();
            }
        });
    }

    toggleMenu() {
        const menu = document.querySelector(`#${this.panelId} .quick-panel-menu`);
        const mainBtn = document.querySelector(`#${this.panelId} .quick-panel-main-btn`);
        
        this.isExpanded = !this.isExpanded;
        
        if (this.isExpanded) {
            menu.classList.remove('hidden');
            mainBtn.classList.add('active');
            // 更新时钟
            this.updateClock();
        } else {
            menu.classList.add('hidden');
            mainBtn.classList.remove('active');
        }
    }

    startClock() {
        this.updateClock();
        this.clockInterval = setInterval(() => this.updateClock(), 1000);
    }

    updateClock() {
        const timeEl = document.querySelector(`#${this.panelId} .quick-panel-time`);
        const dateEl = document.querySelector(`#${this.panelId} .quick-panel-date`);
        
        if (!timeEl || !dateEl) return;

        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
        const weekDay = weekDays[now.getDay()];

        timeEl.textContent = `${hours}:${minutes}:${seconds}`;
        dateEl.textContent = `${year}年${month}月${day}日 星期${weekDay}`;
    }

    handleAction(action) {
        switch (action) {
            case 'backTop':
                this.scrollToTop();
                break;
            case 'toggleTheme':
                this.toggleTheme();
                break;
            case 'refresh':
                location.reload();
                break;
        }
    }

    scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
        this.api.ui.showToast('已回到顶部 📌', 'success');
    }

    toggleTheme() {
        const html = document.documentElement;
        const isDark = html.classList.contains('theme-dark');
        
        if (isDark) {
            html.classList.remove('theme-dark');
            sessionStorage.setItem('theme', 'light');
            this.api.ui.showToast('已切换到亮色主题 ☀️', 'success');
        } else {
            html.classList.add('theme-dark');
            sessionStorage.setItem('theme', 'dark');
            this.api.ui.showToast('已切换到暗色主题 🌙', 'success');
        }
    }

    addClickEffect(btn) {
        btn.style.transform = 'scale(0.95)';
        setTimeout(() => {
            btn.style.transform = '';
        }, 150);
    }

    showSettings() {
        // 创建设置面板
        const overlay = document.createElement('div');
        overlay.className = 'quick-panel-settings-overlay';
        overlay.innerHTML = `
            <div class="quick-panel-settings-dialog">
                <div class="quick-panel-settings-header">
                    <h3>快捷面板设置</h3>
                    <button class="quick-panel-settings-close">×</button>
                </div>
                <div class="quick-panel-settings-body">
                    <div class="quick-panel-setting-item">
                        <label>主题颜色</label>
                        <input type="color" class="quick-panel-color-input" value="${this.config.primaryColor}">
                    </div>
                    <div class="quick-panel-setting-item">
                        <label>显示位置</label>
                        <select class="quick-panel-select">
                            <option value="bottom-right" ${this.config.position === 'bottom-right' ? 'selected' : ''}>右下角</option>
                            <option value="bottom-left" ${this.config.position === 'bottom-left' ? 'selected' : ''}>左下角</option>
                        </select>
                    </div>
                    <div class="quick-panel-setting-item">
                        <label>
                            <input type="checkbox" class="quick-panel-checkbox" ${this.config.showClock ? 'checked' : ''}>
                            显示时钟
                        </label>
                    </div>
                </div>
                <div class="quick-panel-settings-footer">
                    <button class="quick-panel-save-btn">保存设置</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // 绑定设置面板事件
        const closeBtn = overlay.querySelector('.quick-panel-settings-close');
        const saveBtn = overlay.querySelector('.quick-panel-save-btn');

        closeBtn.addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });

        saveBtn.addEventListener('click', async () => {
            const colorInput = overlay.querySelector('.quick-panel-color-input');
            const positionSelect = overlay.querySelector('.quick-panel-select');
            const clockCheckbox = overlay.querySelector('.quick-panel-checkbox');

            this.config.primaryColor = colorInput.value;
            this.config.position = positionSelect.value;
            this.config.showClock = clockCheckbox.checked;

            // 保存配置
            await this.api.storage.set('config', this.config);

            // 应用配置
            this.applyConfig();

            this.api.ui.showToast('设置已保存 ✓', 'success');
            overlay.remove();
        });
    }

    applyConfig() {
        const panel = document.getElementById(this.panelId);
        if (panel) {
            // 更新颜色
            panel.style.setProperty('--qp-primary', this.config.primaryColor);
            
            // 更新位置
            panel.className = `quick-panel ${this.config.position}`;

            // 更新时钟显示
            const clockEl = panel.querySelector('.quick-panel-clock');
            if (clockEl) {
                clockEl.style.display = this.config.showClock ? 'block' : 'none';
            }
        }
    }

    removePanel() {
        const panel = document.getElementById(this.panelId);
        if (panel) {
            panel.remove();
        }

        // 移除可能的设置面板
        const overlay = document.querySelector('.quick-panel-settings-overlay');
        if (overlay) {
            overlay.remove();
        }
    }
}

// 注册插件
registerPlugin('quick-panel', QuickPanelPlugin);

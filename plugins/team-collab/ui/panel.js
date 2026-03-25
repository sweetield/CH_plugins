/**
 * 团队协作插件 - 面板组件
 */

class Panel {
    constructor(api) {
        this.api = api;
        this.panel = null;
        this.isOpen = false;
        this.currentView = 'sidebar'; // sidebar, tasks, plans, inbox
    }

    /**
     * 创建面板
     */
    create() {
        this.panel = document.createElement('div');
        this.panel.className = 'tc-panel';
        this.panel.innerHTML = `
            <div class="tc-panel-header">
                <div class="tc-panel-title">团队协作</div>
                <button class="tc-panel-close" id="tc-close-panel">×</button>
            </div>
            <div class="tc-panel-body" id="tc-panel-body">
                <!-- 内容区域 -->
            </div>
        `;

        document.body.appendChild(this.panel);

        // 绑定关闭按钮
        document.getElementById('tc-close-panel').addEventListener('click', () => {
            this.close();
        });
    }

    /**
     * 打开面板
     */
    open() {
        if (this.panel) {
            this.panel.classList.add('open');
            this.isOpen = true;
        }
    }

    /**
     * 关闭面板
     */
    close() {
        if (this.panel) {
            this.panel.classList.remove('open');
            this.isOpen = false;
        }
    }

    /**
     * 切换面板
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * 设置面板内容
     * @param {string} html - HTML 内容
     */
    setContent(html) {
        const body = document.getElementById('tc-panel-body');
        if (body) {
            body.innerHTML = html;
        }
    }

    /**
     * 获取面板内容区域
     * @returns {HTMLElement}
     */
    getBody() {
        return document.getElementById('tc-panel-body');
    }

    /**
     * 显示加载状态
     */
    showLoading() {
        this.setContent(`
            <div class="tc-loading">
                <div class="tc-loading-spinner"></div>
                <div class="tc-loading-text">加载中...</div>
            </div>
        `);
    }

    /**
     * 显示空状态
     * @param {string} icon - 图标
     * @param {string} title - 标题
     * @param {string} description - 描述
     * @param {Array} actions - 操作按钮
     */
    showEmpty(icon, title, description, actions = []) {
        const actionsHtml = actions.map(action =>
            `<button class="tc-btn ${action.primary ? 'tc-btn-primary' : 'tc-btn-secondary'}" 
                     onclick="${action.onClick}">${action.label}</button>`
        ).join('');

        this.setContent(`
            <div class="tc-empty-state">
                <div class="tc-empty-icon">${icon}</div>
                <div class="tc-empty-title">${title}</div>
                <div class="tc-empty-description">${description}</div>
                ${actionsHtml ? `<div class="tc-empty-actions">${actionsHtml}</div>` : ''}
            </div>
        `);
    }

    /**
     * 销毁面板
     */
    destroy() {
        if (this.panel) {
            this.panel.remove();
            this.panel = null;
        }
    }
}

// 导出
window.TCPanel = Panel;

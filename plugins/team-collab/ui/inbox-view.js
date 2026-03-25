/**
 * 团队协作插件 - 收件箱视图
 */

class InboxView {
    constructor(panel, notificationService, eventBus) {
        this.panel = panel;
        this.notificationService = notificationService;
        this.eventBus = eventBus;
        this.currentUserId = null;
        this.notifications = [];
    }

    /**
     * 初始化
     * @param {string} userId - 用户 ID
     */
    async init(userId) {
        this.currentUserId = userId;
        await this.loadNotifications();
        this.render();
        this.bindEvents();
    }

    /**
     * 加载通知
     */
    async loadNotifications() {
        this.notifications = await this.notificationService.getInbox(this.currentUserId, {
            pageSize: 50
        });
    }

    /**
     * 渲染视图
     */
    render() {
        const html = `
            <div class="tc-inbox-view">
                <div class="tc-inbox-header">
                    <div class="tc-inbox-title">收件箱</div>
                    <div class="tc-inbox-actions">
                        <button class="tc-btn tc-btn-secondary tc-btn-sm" id="tc-mark-all-read">
                            全部已读
                        </button>
                        <button class="tc-btn tc-btn-secondary tc-btn-sm" id="tc-clear-inbox">
                            清空
                        </button>
                    </div>
                </div>
                <div class="tc-inbox-content">
                    ${this.notifications.length === 0 ? this.renderEmpty() : this.renderNotificationList()}
                </div>
            </div>
        `;

        this.panel.setContent(html);
    }

    /**
     * 渲染空状态
     */
    renderEmpty() {
        return `
            <div class="tc-inbox-empty">
                <div class="tc-empty-icon">📥</div>
                <div class="tc-empty-title">收件箱为空</div>
                <div class="tc-empty-text">暂无新通知</div>
            </div>
        `;
    }

    /**
     * 渲染通知列表
     */
    renderNotificationList() {
        return `
            <div class="tc-notification-list">
                ${this.notifications.map(n => this.renderNotification(n)).join('')}
            </div>
        `;
    }

    /**
     * 渲染通知项
     * @param {Object} notification - 通知对象
     */
    renderNotification(notification) {
        const isUnread = !notification.readAt;
        const timeAgo = window.TCUtils.formatRelativeTime(notification.createdAt);
        const icon = this.notificationService.getTypeIcon(notification.type);
        const typeLabel = this.notificationService.getTypeLabel(notification.type);

        return `
            <div class="tc-notification-item ${isUnread ? 'unread' : ''}" data-notification-id="${notification.id}">
                <div class="tc-notification-icon">${icon}</div>
                <div class="tc-notification-body">
                    <div class="tc-notification-header">
                        <span class="tc-notification-type">${typeLabel}</span>
                        <span class="tc-notification-time">${timeAgo}</span>
                    </div>
                    <div class="tc-notification-title">${window.TCUtils.escapeHtml(notification.title)}</div>
                    <div class="tc-notification-content">${window.TCUtils.escapeHtml(notification.content)}</div>
                </div>
                <div class="tc-notification-actions">
                    ${isUnread ? `
                        <button class="tc-action-btn tc-mark-read-btn" data-notification-id="${notification.id}" title="标为已读">
                            ✓
                        </button>
                    ` : ''}
                    <button class="tc-action-btn tc-delete-notification-btn" data-notification-id="${notification.id}" title="删除">
                        ×
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 全部已读
        const markAllReadBtn = document.getElementById('tc-mark-all-read');
        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', () => this.markAllAsRead());
        }

        // 清空收件箱
        const clearInboxBtn = document.getElementById('tc-clear-inbox');
        if (clearInboxBtn) {
            clearInboxBtn.addEventListener('click', () => this.confirmClearInbox());
        }

        // 标记单条为已读
        document.querySelectorAll('.tc-mark-read-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const notificationId = btn.dataset.notificationId;
                this.markAsRead(notificationId);
            });
        });

        // 删除单条通知
        document.querySelectorAll('.tc-delete-notification-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const notificationId = btn.dataset.notificationId;
                this.deleteNotification(notificationId);
            });
        });

        // 点击通知查看详情
        document.querySelectorAll('.tc-notification-item').forEach(item => {
            item.addEventListener('click', () => {
                const notificationId = item.dataset.notificationId;
                this.viewNotification(notificationId);
            });
        });
    }

    /**
     * 标记单条为已读
     * @param {string} notificationId - 通知 ID
     */
    async markAsRead(notificationId) {
        await this.notificationService.markAsRead(this.currentUserId, notificationId);
        await this.loadNotifications();
        this.render();
        this.bindEvents();
    }

    /**
     * 全部已读
     */
    async markAllAsRead() {
        await this.notificationService.markAllAsRead(this.currentUserId);
        this.panel.api.ui.showToast('已全部标记为已读', 'success');
        await this.loadNotifications();
        this.render();
        this.bindEvents();
    }

    /**
     * 删除通知
     * @param {string} notificationId - 通知 ID
     */
    async deleteNotification(notificationId) {
        await this.notificationService.deleteNotification(this.currentUserId, notificationId);
        await this.loadNotifications();
        this.render();
        this.bindEvents();
    }

    /**
     * 确认清空收件箱
     */
    confirmClearInbox() {
        const modal = document.createElement('div');
        modal.className = 'tc-modal open';
        modal.innerHTML = `
            <div class="tc-modal-content">
                <div class="tc-modal-header">
                    <span class="tc-modal-title">确认清空</span>
                    <button class="tc-modal-close">×</button>
                </div>
                <div class="tc-modal-body">
                    <p>确定要清空所有通知吗？</p>
                    <p class="tc-warning">此操作不可恢复。</p>
                </div>
                <div class="tc-modal-footer">
                    <button class="tc-btn tc-btn-secondary tc-modal-cancel">取消</button>
                    <button class="tc-btn tc-btn-danger" id="tc-confirm-clear">清空</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.tc-modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.tc-modal-cancel').addEventListener('click', () => modal.remove());

        modal.querySelector('#tc-confirm-clear').addEventListener('click', async () => {
            await this.notificationService.clearInbox(this.currentUserId);
            this.panel.api.ui.showToast('收件箱已清空', 'success');
            modal.remove();
            await this.loadNotifications();
            this.render();
            this.bindEvents();
        });
    }

    /**
     * 查看通知详情
     * @param {string} notificationId - 通知 ID
     */
    async viewNotification(notificationId) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (!notification) return;

        // 标记为已读
        if (!notification.readAt) {
            await this.notificationService.markAsRead(this.currentUserId, notificationId);
        }

        // 根据类型跳转到相应视图
        if (notification.targetType === 'task') {
            this.eventBus.emit('task.detail', {
                taskId: notification.targetId
            });
        } else if (notification.targetType === 'plan') {
            this.eventBus.emit('view.changed', {
                view: 'plans'
            });
        } else if (notification.targetType === 'project') {
            this.eventBus.emit('project.changed', {
                projectId: notification.targetId
            });
        }
    }

    /**
     * 刷新
     */
    async refresh() {
        await this.loadNotifications();
        this.render();
        this.bindEvents();
    }

    /**
     * 销毁
     */
    destroy() {
        // 清理
    }
}

// 导出
window.TCInboxView = InboxView;

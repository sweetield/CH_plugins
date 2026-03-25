/**
 * 团队协作插件 - 通知服务
 */

class NotificationService {
    constructor(storage, crypto, eventBus) {
        this.storage = storage;
        this.crypto = crypto;
        this.eventBus = eventBus;
        this.setupEventListeners();
    }

    /**
     * 设置事件监听
     */
    setupEventListeners() {
        const C = window.TCConstants;

        // 任务被指派
        this.eventBus.on(C.EVENTS.TASK_ASSIGNED, async (data) => {
            await this.createNotification({
                userId: data.assigneeId,
                type: C.NOTIFICATION_TYPE.TASK_ASSIGNED,
                title: '你被指派了一个新任务',
                content: `任务已被指派给你`,
                projectId: data.projectId,
                targetType: 'task',
                targetId: data.taskId
            });
        });

        // 评论中被提及
        this.eventBus.on(C.EVENTS.MENTION_CREATED, async (data) => {
            await this.createNotification({
                userId: data.userId,
                type: C.NOTIFICATION_TYPE.COMMENT_MENTION,
                title: '你在评论中被提及',
                content: `有人在评论中@了你`,
                projectId: data.projectId,
                targetType: 'comment',
                targetId: data.commentId
            });
        });

        // 学习计划提交
        this.eventBus.on(C.EVENTS.PLAN_SUBMITTED, async (data) => {
            // 通知计划创建者和评审者
            await this.createNotification({
                userId: data.createdBy || data.userId,
                type: C.NOTIFICATION_TYPE.PLAN_SUBMISSION,
                title: '有新的学习成果提交',
                content: `成员提交了学习成果`,
                projectId: data.projectId,
                targetType: 'plan',
                targetId: data.planId
            });
        });

        // 被邀请加入项目
        this.eventBus.on(C.EVENTS.MEMBER_JOINED, async (data) => {
            await this.createNotification({
                userId: data.userId,
                type: C.NOTIFICATION_TYPE.PROJECT_INVITED,
                title: '你已加入新项目',
                content: `你已成功加入项目`,
                projectId: data.projectId,
                targetType: 'project',
                targetId: data.projectId
            });
        });
    }

    /**
     * 生成唯一 ID
     */
    generateId(prefix) {
        const C = window.TCConstants;
        return `${C.ID_PREFIX[prefix.toUpperCase()]}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 创建通知
     * @param {Object} input - 通知输入
     * @returns {Promise<Object>}
     */
    async createNotification(input) {
        const notification = {
            id: this.generateId('NOTIFICATION'),
            userId: input.userId,
            type: input.type,
            title: input.title,
            content: input.content,
            projectId: input.projectId || null,
            targetType: input.targetType || null,
            targetId: input.targetId || null,
            readAt: null,
            createdAt: Date.now()
        };

        // 加载用户收件箱
        const inbox = await this.storage.loadUserInbox(input.userId);

        // 添加通知到收件箱开头
        inbox.unshift(notification);

        // 限制收件箱大小（最多保留 100 条）
        if (inbox.length > 100) {
            inbox.splice(100);
        }

        // 保存收件箱
        await this.storage.saveUserInbox(input.userId, inbox);

        // 触发事件
        this.eventBus.emit(window.TCConstants.EVENTS.NOTIFICATION_RECEIVED, {
            userId: input.userId,
            notification
        });

        console.log('[NotificationService] 通知创建成功:', notification.id);
        return notification;
    }

    /**
     * 获取用户收件箱
     * @param {string} userId - 用户 ID
     * @param {Object} options - 选项
     * @returns {Promise<Array>}
     */
    async getInbox(userId, options = {}) {
        const inbox = await this.storage.loadUserInbox(userId);

        let filtered = inbox;

        // 只返回未读
        if (options.unreadOnly) {
            filtered = filtered.filter(n => !n.readAt);
        }

        // 按类型过滤
        if (options.type) {
            filtered = filtered.filter(n => n.type === options.type);
        }

        // 分页
        const page = options.page || 1;
        const pageSize = options.pageSize || 20;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;

        return filtered.slice(start, end);
    }

    /**
     * 获取未读通知数量
     * @param {string} userId - 用户 ID
     * @returns {Promise<number>}
     */
    async getUnreadCount(userId) {
        const inbox = await this.storage.loadUserInbox(userId);
        return inbox.filter(n => !n.readAt).length;
    }

    /**
     * 标记通知为已读
     * @param {string} userId - 用户 ID
     * @param {string} notificationId - 通知 ID
     */
    async markAsRead(userId, notificationId) {
        const inbox = await this.storage.loadUserInbox(userId);

        const notification = inbox.find(n => n.id === notificationId);
        if (notification && !notification.readAt) {
            notification.readAt = Date.now();
            await this.storage.saveUserInbox(userId, inbox);
        }
    }

    /**
     * 标记所有通知为已读
     * @param {string} userId - 用户 ID
     */
    async markAllAsRead(userId) {
        const inbox = await this.storage.loadUserInbox(userId);
        const now = Date.now();

        inbox.forEach(n => {
            if (!n.readAt) {
                n.readAt = now;
            }
        });

        await this.storage.saveUserInbox(userId, inbox);
    }

    /**
     * 删除通知
     * @param {string} userId - 用户 ID
     * @param {string} notificationId - 通知 ID
     */
    async deleteNotification(userId, notificationId) {
        const inbox = await this.storage.loadUserInbox(userId);
        const index = inbox.findIndex(n => n.id === notificationId);

        if (index > -1) {
            inbox.splice(index, 1);
            await this.storage.saveUserInbox(userId, inbox);
        }
    }

    /**
     * 清空收件箱
     * @param {string} userId - 用户 ID
     */
    async clearInbox(userId) {
        await this.storage.saveUserInbox(userId, []);
    }

    /**
     * 检查任务截止提醒
     * @param {string} userId - 用户 ID
     * @param {Array} tasks - 任务列表
     */
    async checkDueReminders(userId, tasks) {
        const C = window.TCConstants;
        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;

        for (const task of tasks) {
            if (!task.dueDate || task.status === C.TASK_STATUS.DONE) continue;

            const timeUntilDue = task.dueDate - now;

            // 即将到期（24小时内）
            if (timeUntilDue > 0 && timeUntilDue <= oneDayMs) {
                await this.createNotification({
                    userId,
                    type: C.NOTIFICATION_TYPE.TASK_DUE_SOON,
                    title: '任务即将到期',
                    content: `任务 "${task.title}" 将在24小时内到期`,
                    projectId: task.projectId,
                    targetType: 'task',
                    targetId: task.id
                });
            }

            // 已逾期
            if (timeUntilDue < 0) {
                await this.createNotification({
                    userId,
                    type: C.NOTIFICATION_TYPE.TASK_OVERDUE,
                    title: '任务已逾期',
                    content: `任务 "${task.title}" 已逾期`,
                    projectId: task.projectId,
                    targetType: 'task',
                    targetId: task.id
                });
            }
        }
    }

    /**
     * 获取通知类型标签
     * @param {string} type - 通知类型
     * @returns {string}
     */
    getTypeLabel(type) {
        const C = window.TCConstants;
        const labels = {
            [C.NOTIFICATION_TYPE.TASK_ASSIGNED]: '任务指派',
            [C.NOTIFICATION_TYPE.TASK_DUE_SOON]: '即将到期',
            [C.NOTIFICATION_TYPE.TASK_OVERDUE]: '已逾期',
            [C.NOTIFICATION_TYPE.COMMENT_MENTION]: '@提及',
            [C.NOTIFICATION_TYPE.COMMENT_REPLY]: '评论回复',
            [C.NOTIFICATION_TYPE.PLAN_SUBMISSION]: '成果提交',
            [C.NOTIFICATION_TYPE.PROJECT_INVITED]: '项目邀请'
        };
        return labels[type] || '通知';
    }

    /**
     * 获取通知类型图标
     * @param {string} type - 通知类型
     * @returns {string}
     */
    getTypeIcon(type) {
        const C = window.TCConstants;
        const icons = {
            [C.NOTIFICATION_TYPE.TASK_ASSIGNED]: '📋',
            [C.NOTIFICATION_TYPE.TASK_DUE_SOON]: '⏰',
            [C.NOTIFICATION_TYPE.TASK_OVERDUE]: '❗',
            [C.NOTIFICATION_TYPE.COMMENT_MENTION]: '@',
            [C.NOTIFICATION_TYPE.COMMENT_REPLY]: '💬',
            [C.NOTIFICATION_TYPE.PLAN_SUBMISSION]: '📝',
            [C.NOTIFICATION_TYPE.PROJECT_INVITED]: '👥'
        };
        return icons[type] || '🔔';
    }
}

// 导出
window.TCNotificationService = NotificationService;

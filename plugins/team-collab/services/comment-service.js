/**
 * 团队协作插件 - 评论服务
 */

class CommentService {
    constructor(storage, crypto, permissionService, eventBus) {
        this.storage = storage;
        this.crypto = crypto;
        this.permission = permissionService;
        this.eventBus = eventBus;
    }

    /**
     * 生成唯一 ID
     * @param {string} prefix - ID 前缀
     * @returns {string}
     */
    generateId(prefix) {
        const C = window.TCConstants;
        return `${C.ID_PREFIX[prefix.toUpperCase()]}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 创建评论线程
     * @param {Object} input - 线程输入
     * @returns {Promise<Object>}
     */
    async createThread(input) {
        const C = window.TCConstants;
        const now = Date.now();

        const thread = {
            id: this.generateId('THREAD'),
            targetType: input.targetType, // 'task' | 'plan' | 'project'
            targetId: input.targetId,
            projectId: input.projectId,
            status: C.THREAD_STATUS.OPEN,
            participantIds: [input.createdBy],
            commentCount: 0,
            lastCommentAt: null,
            createdAt: now,
            updatedAt: now,
            version: 1
        };

        await this.storage.saveThread(thread);
        console.log('[CommentService] 线程创建成功:', thread.id);
        return thread;
    }

    /**
     * 获取或创建线程
     * @param {string} targetType - 目标类型
     * @param {string} targetId - 目标 ID
     * @param {string} projectId - 项目 ID
     * @returns {Promise<Object>}
     */
    async getOrCreateThread(targetType, targetId, projectId) {
        // 先尝试从目标对象获取线程 ID
        let threadId = null;

        if (targetType === 'task') {
            const task = await this.storage.loadTask(targetId);
            if (task && task.threadIds && task.threadIds.length > 0) {
                threadId = task.threadIds[0];
            }
        } else if (targetType === 'plan') {
            const plan = await this.storage.loadPlan(targetId);
            if (plan && plan.threadIds && plan.threadIds.length > 0) {
                threadId = plan.threadIds[0];
            }
        }

        // 如果找到线程，返回它
        if (threadId) {
            const thread = await this.storage.loadThread(threadId);
            if (thread) return thread;
        }

        // 否则创建新线程
        return await this.createThread({
            targetType,
            targetId,
            projectId,
            createdBy: 'system'
        });
    }

    /**
     * 添加评论
     * @param {Object} input - 评论输入
     * @returns {Promise<Object>}
     */
    async addComment(input) {
        const C = window.TCConstants;
        const now = Date.now();

        // 获取或创建线程
        const thread = await this.getOrCreateThread(
            input.targetType,
            input.targetId,
            input.projectId
        );

        // 加密评论内容
        const bodyEncrypted = await this.crypto.encrypt(input.body);

        const comment = {
            id: this.generateId('COMMENT'),
            threadId: thread.id,
            projectId: input.projectId,
            authorId: input.authorId,
            parentCommentId: input.parentCommentId || null,
            body: bodyEncrypted,
            mentions: input.mentions || [],
            attachmentIds: input.attachmentIds || [],
            reactions: [],
            isResolved: false,
            createdAt: now,
            updatedAt: now
        };

        // 保存评论（分页存储）
        const page = Math.ceil((thread.commentCount + 1) / C.PAGE_SIZE.COMMENTS);
        const commentsKey = this.storage.getKeys().threadComments(thread.id, page);
        let comments = await this.storage.load(commentsKey) || [];
        comments.push(comment);
        await this.storage.save(commentsKey, comments);

        // 更新线程
        thread.commentCount++;
        thread.lastCommentAt = now;
        thread.updatedAt = now;

        // 添加参与者
        if (!thread.participantIds.includes(input.authorId)) {
            thread.participantIds.push(input.authorId);
        }
        // 添加被提及的用户
        if (input.mentions) {
            input.mentions.forEach(userId => {
                if (!thread.participantIds.includes(userId)) {
                    thread.participantIds.push(userId);
                }
            });
        }

        await this.storage.saveThread(thread);

        // 更新目标对象的线程 ID
        await this.linkThreadToTarget(thread, input.targetType, input.targetId);

        // 触发事件
        this.eventBus.emit(C.EVENTS.COMMENT_ADDED, {
            commentId: comment.id,
            threadId: thread.id,
            targetType: input.targetType,
            targetId: input.targetId,
            authorId: input.authorId,
            mentions: input.mentions
        });

        // 处理 @提及
        if (input.mentions && input.mentions.length > 0) {
            input.mentions.forEach(userId => {
                this.eventBus.emit(C.EVENTS.MENTION_CREATED, {
                    userId,
                    commentId: comment.id,
                    threadId: thread.id,
                    targetType: input.targetType,
                    targetId: input.targetId,
                    mentionedBy: input.authorId
                });
            });
        }

        console.log('[CommentService] 评论添加成功:', comment.id);

        // 返回解密后的评论
        return {
            ...comment,
            body: input.body
        };
    }

    /**
     * 获取评论列表
     * @param {string} threadId - 线程 ID
     * @param {number} page - 页码
     * @returns {Promise<Array>}
     */
    async getComments(threadId, page = 1) {
        const C = window.TCConstants;
        const commentsKey = this.storage.getKeys().threadComments(threadId, page);
        const comments = await this.storage.load(commentsKey) || [];

        // 解密评论内容
        const decryptedComments = await Promise.all(
            comments.map(async (comment) => ({
                ...comment,
                body: await this.crypto.decrypt(comment.body)
            }))
        );

        return decryptedComments;
    }

    /**
     * 获取目标对象的评论
     * @param {string} targetType - 目标类型
     * @param {string} targetId - 目标 ID
     * @returns {Promise<Array>}
     */
    async getTargetComments(targetType, targetId) {
        const thread = await this.getOrCreateThread(targetType, targetId);
        if (!thread || thread.commentCount === 0) return [];

        const C = window.TCConstants;
        const totalPages = Math.ceil(thread.commentCount / C.PAGE_SIZE.COMMENTS);
        const allComments = [];

        for (let page = 1; page <= totalPages; page++) {
            const comments = await this.getComments(thread.id, page);
            allComments.push(...comments);
        }

        // 按时间排序
        allComments.sort((a, b) => a.createdAt - b.createdAt);

        return allComments;
    }

    /**
     * 更新评论
     * @param {string} commentId - 评论 ID
     * @param {string} threadId - 线程 ID
     * @param {Object} updates - 更新数据
     * @param {string} userId - 操作者 ID
     * @returns {Promise<Object>}
     */
    async updateComment(commentId, threadId, updates, userId) {
        const C = window.TCConstants;
        const thread = await this.storage.loadThread(threadId);

        if (!thread) {
            throw new TCErrors.TCError('评论线程不存在', 'NOT_FOUND');
        }

        // 查找评论
        const totalPages = Math.ceil(thread.commentCount / C.PAGE_SIZE.COMMENTS);
        let targetComment = null;
        let targetPage = 0;
        let targetComments = [];

        for (let page = 1; page <= totalPages; page++) {
            const commentsKey = this.storage.getKeys().threadComments(threadId, page);
            const comments = await this.storage.load(commentsKey) || [];
            const found = comments.find(c => c.id === commentId);
            if (found) {
                targetComment = found;
                targetPage = page;
                targetComments = comments;
                break;
            }
        }

        if (!targetComment) {
            throw new TCErrors.TCError('评论不存在', 'NOT_FOUND');
        }

        // 只有作者可以编辑
        if (targetComment.authorId !== userId) {
            throw new TCErrors.PermissionError('只能编辑自己的评论');
        }

        // 更新评论
        if (updates.body !== undefined) {
            targetComment.body = await this.crypto.encrypt(updates.body);
            targetComment.updatedAt = Date.now();
        }

        // 保存
        const commentsKey = this.storage.getKeys().threadComments(threadId, targetPage);
        await this.storage.save(commentsKey, targetComments);

        return {
            ...targetComment,
            body: updates.body
        };
    }

    /**
     * 删除评论（软删除）
     * @param {string} commentId - 评论 ID
     * @param {string} threadId - 线程 ID
     * @param {string} userId - 操作者 ID
     */
    async deleteComment(commentId, threadId, userId) {
        const C = window.TCConstants;
        const thread = await this.storage.loadThread(threadId);

        if (!thread) {
            throw new TCErrors.TCError('评论线程不存在', 'NOT_FOUND');
        }

        // 查找评论
        const totalPages = Math.ceil(thread.commentCount / C.PAGE_SIZE.COMMENTS);

        for (let page = 1; page <= totalPages; page++) {
            const commentsKey = this.storage.getKeys().threadComments(threadId, page);
            const comments = await this.storage.load(commentsKey) || [];
            const index = comments.findIndex(c => c.id === commentId);

            if (index > -1) {
                // 只有作者可以删除
                if (comments[index].authorId !== userId) {
                    throw new TCErrors.PermissionError('只能删除自己的评论');
                }

                // 软删除：标记内容为空
                comments[index].body = await this.crypto.encrypt('[已删除]');
                comments[index].isDeleted = true;
                comments[index].updatedAt = Date.now();

                await this.storage.save(commentsKey, comments);
                return;
            }
        }

        throw new TCErrors.TCError('评论不存在', 'NOT_FOUND');
    }

    /**
     * 解决评论线程
     * @param {string} threadId - 线程 ID
     * @param {string} userId - 操作者 ID
     */
    async resolveThread(threadId, userId) {
        const thread = await this.storage.loadThread(threadId);

        if (!thread) {
            throw new TCErrors.TCError('评论线程不存在', 'NOT_FOUND');
        }

        thread.status = window.TCConstants.THREAD_STATUS.RESOLVED;
        thread.resolvedBy = userId;
        thread.resolvedAt = Date.now();
        thread.updatedAt = Date.now();
        thread.version = (thread.version || 1) + 1;

        await this.storage.saveThread(thread);
    }

    /**
     * 重新打开评论线程
     * @param {string} threadId - 线程 ID
     * @param {string} userId - 操作者 ID
     */
    async reopenThread(threadId, userId) {
        const thread = await this.storage.loadThread(threadId);

        if (!thread) {
            throw new TCErrors.TCError('评论线程不存在', 'NOT_FOUND');
        }

        thread.status = window.TCConstants.THREAD_STATUS.OPEN;
        thread.resolvedBy = null;
        thread.resolvedAt = null;
        thread.updatedAt = Date.now();
        thread.version = (thread.version || 1) + 1;

        await this.storage.saveThread(thread);
    }

    /**
     * 将线程关联到目标对象
     * @param {Object} thread - 线程对象
     * @param {string} targetType - 目标类型
     * @param {string} targetId - 目标 ID
     */
    async linkThreadToTarget(thread, targetType, targetId) {
        if (targetType === 'task') {
            const task = await this.storage.loadTask(targetId);
            if (task) {
                if (!task.threadIds) task.threadIds = [];
                if (!task.threadIds.includes(thread.id)) {
                    task.threadIds.push(thread.id);
                    await this.storage.saveTask(task);
                }
            }
        } else if (targetType === 'plan') {
            const plan = await this.storage.loadPlan(targetId);
            if (plan) {
                if (!plan.threadIds) plan.threadIds = [];
                if (!plan.threadIds.includes(thread.id)) {
                    plan.threadIds.push(thread.id);
                    await this.storage.savePlan(plan);
                }
            }
        }
    }

    /**
     * 获取评论统计
     * @param {string} targetType - 目标类型
     * @param {string} targetId - 目标 ID
     * @returns {Promise<Object>}
     */
    async getCommentStats(targetType, targetId) {
        const thread = await this.getOrCreateThread(targetType, targetId);

        return {
            threadId: thread.id,
            commentCount: thread.commentCount,
            status: thread.status,
            participantCount: thread.participantIds.length,
            lastCommentAt: thread.lastCommentAt
        };
    }
}

// 导出
window.TCCommentService = CommentService;

/**
 * 团队协作插件 - 存储适配器
 * 封装 api.storage 操作，提供统一的存储接口
 */

class StorageAdapter {
    constructor(api, crypto) {
        this.api = api;
        this.crypto = crypto;
    }

    /**
     * 获取存储键
     */
    getKeys() {
        const C = window.TCConstants;
        return {
            // 用户私有
            config: (userId) => `${C.USER_STORAGE_PREFIX}:${userId}:team-collab:config`,
            inbox: (userId) => `${C.USER_STORAGE_PREFIX}:${userId}:team-collab:inbox`,
            myViews: (userId) => `${C.USER_STORAGE_PREFIX}:${userId}:team-collab:view-presets`,
            userProjectIndex: (userId) => `${C.USER_STORAGE_PREFIX}:${userId}:team-collab:user-project-index`,
            userTaskIndex: (userId) => `${C.USER_STORAGE_PREFIX}:${userId}:team-collab:user-task-index`,

            // 项目共享（加密）
            project: (projectId) => `${C.STORAGE_PREFIX}:project:${projectId}`,
            projectMembers: (projectId) => `${C.STORAGE_PREFIX}:project-members:${projectId}`,
            projectTaskIndex: (projectId) => `${C.STORAGE_PREFIX}:project-task-index:${projectId}`,
            projectPlanIndex: (projectId) => `${C.STORAGE_PREFIX}:project-plan-index:${projectId}`,
            projectThreadIndex: (projectId) => `${C.STORAGE_PREFIX}:project-thread-index:${projectId}`,
            projectActivityIndex: (projectId) => `${C.STORAGE_PREFIX}:project-activity-index:${projectId}`,

            // 对象存储
            task: (taskId) => `${C.STORAGE_PREFIX}:task:${taskId}`,
            plan: (planId) => `${C.STORAGE_PREFIX}:plan:${planId}`,
            thread: (threadId) => `${C.STORAGE_PREFIX}:thread:${threadId}`,
            threadComments: (threadId, page = 1) => `${C.STORAGE_PREFIX}:thread-comments:${threadId}:${page}`,
            attachmentMeta: (attId) => `${C.STORAGE_PREFIX}:attachment-meta:${attId}`,
            attachmentBlob: (attId) => `${C.STORAGE_PREFIX}:attachment-blob:${attId}`,

            // 邀请码
            invite: (code) => `${C.STORAGE_PREFIX}:invite:${code}`
        };
    }

    /**
     * 保存加密对象
     * @param {string} key - 存储键
     * @param {Object} data - 要保存的数据
     */
    async saveEncrypted(key, data) {
        try {
            const encrypted = await this.crypto.encryptObject(data);
            await this.api.storage.set(key, encrypted);
        } catch (error) {
            console.error('[StorageAdapter] 保存失败:', error);
            throw new TCErrors.StorageError('保存数据失败', error);
        }
    }

    /**
     * 读取加密对象
     * @param {string} key - 存储键
     * @returns {Promise<Object|null>} 解密后的数据
     */
    async loadEncrypted(key) {
        try {
            const encrypted = await this.api.storage.get(key);
            if (!encrypted) return null;
            return await this.crypto.decryptObject(encrypted);
        } catch (error) {
            console.error('[StorageAdapter] 读取失败:', error);
            throw new TCErrors.StorageError('读取数据失败', error);
        }
    }

    /**
     * 保存明文数据（用于索引等）
     * @param {string} key - 存储键
     * @param {*} data - 要保存的数据
     */
    async save(key, data) {
        try {
            await this.api.storage.set(key, data);
        } catch (error) {
            console.error('[StorageAdapter] 保存失败:', error);
            throw new TCErrors.StorageError('保存数据失败', error);
        }
    }

    /**
     * 读取明文数据
     * @param {string} key - 存储键
     * @returns {Promise<*>} 读取的数据
     */
    async load(key) {
        try {
            return await this.api.storage.get(key);
        } catch (error) {
            console.error('[StorageAdapter] 读取失败:', error);
            throw new TCErrors.StorageError('读取数据失败', error);
        }
    }

    /**
     * 删除数据
     * @param {string} key - 存储键
     */
    async remove(key) {
        try {
            await this.api.storage.remove(key);
        } catch (error) {
            console.error('[StorageAdapter] 删除失败:', error);
            throw new TCErrors.StorageError('删除数据失败', error);
        }
    }

    /**
     * 保存项目
     * @param {Object} project - 项目对象
     */
    async saveProject(project) {
        const keys = this.getKeys();
        await this.saveEncrypted(keys.project(project.id), project);
    }

    /**
     * 读取项目
     * @param {string} projectId - 项目 ID
     * @returns {Promise<Object|null>}
     */
    async loadProject(projectId) {
        const keys = this.getKeys();
        return await this.loadEncrypted(keys.project(projectId));
    }

    /**
     * 保存任务
     * @param {Object} task - 任务对象
     */
    async saveTask(task) {
        const keys = this.getKeys();
        await this.saveEncrypted(keys.task(task.id), task);
    }

    /**
     * 读取任务
     * @param {string} taskId - 任务 ID
     * @returns {Promise<Object|null>}
     */
    async loadTask(taskId) {
        const keys = this.getKeys();
        return await this.loadEncrypted(keys.task(taskId));
    }

    /**
     * 保存计划
     * @param {Object} plan - 计划对象
     */
    async savePlan(plan) {
        const keys = this.getKeys();
        await this.saveEncrypted(keys.plan(plan.id), plan);
    }

    /**
     * 读取计划
     * @param {string} planId - 计划 ID
     * @returns {Promise<Object|null>}
     */
    async loadPlan(planId) {
        const keys = this.getKeys();
        return await this.loadEncrypted(keys.plan(planId));
    }

    /**
     * 保存评论线程
     * @param {Object} thread - 线程对象
     */
    async saveThread(thread) {
        const keys = this.getKeys();
        await this.saveEncrypted(keys.thread(thread.id), thread);
    }

    /**
     * 读取评论线程
     * @param {string} threadId - 线程 ID
     * @returns {Promise<Object|null>}
     */
    async loadThread(threadId) {
        const keys = this.getKeys();
        return await this.loadEncrypted(keys.thread(threadId));
    }

    /**
     * 保存邀请码索引
     * @param {string} code - 邀请码
     * @param {Object} inviteData - 邀请码数据
     */
    async saveInviteCode(code, inviteData) {
        const keys = this.getKeys();
        await this.save(keys.invite(code), inviteData);
    }

    /**
     * 读取邀请码索引
     * @param {string} code - 邀请码
     * @returns {Promise<Object|null>}
     */
    async loadInviteCode(code) {
        const keys = this.getKeys();
        return await this.load(keys.invite(code));
    }

    /**
     * 保存用户项目索引
     * @param {string} userId - 用户 ID
     * @param {Array} projectIds - 项目 ID 列表
     */
    async saveUserProjectIndex(userId, projectIds) {
        const keys = this.getKeys();
        await this.save(keys.userProjectIndex(userId), projectIds);
    }

    /**
     * 读取用户项目索引
     * @param {string} userId - 用户 ID
     * @returns {Promise<Array>}
     */
    async loadUserProjectIndex(userId) {
        const keys = this.getKeys();
        return await this.load(keys.userProjectIndex(userId)) || [];
    }

    /**
     * 保存项目任务索引
     * @param {string} projectId - 项目 ID
     * @param {Array} taskIds - 任务 ID 列表
     */
    async saveProjectTaskIndex(projectId, taskIds) {
        const keys = this.getKeys();
        await this.save(keys.projectTaskIndex(projectId), taskIds);
    }

    /**
     * 读取项目任务索引
     * @param {string} projectId - 项目 ID
     * @returns {Promise<Array>}
     */
    async loadProjectTaskIndex(projectId) {
        const keys = this.getKeys();
        return await this.load(keys.projectTaskIndex(projectId)) || [];
    }

    /**
     * 保存用户收件箱
     * @param {string} userId - 用户 ID
     * @param {Array} notifications - 通知列表
     */
    async saveUserInbox(userId, notifications) {
        const keys = this.getKeys();
        await this.save(keys.inbox(userId), notifications);
    }

    /**
     * 读取用户收件箱
     * @param {string} userId - 用户 ID
     * @returns {Promise<Array>}
     */
    async loadUserInbox(userId) {
        const keys = this.getKeys();
        return await this.load(keys.inbox(userId)) || [];
    }
}

// 导出
window.TCStorageAdapter = StorageAdapter;

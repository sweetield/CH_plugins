/**
 * 团队协作插件 - 索引管理器
 * 管理各种索引以加速查询
 */

class IndexManager {
    constructor(storage, eventBus) {
        this.storage = storage;
        this.eventBus = eventBus;
        this.setupEventListeners();
    }

    /**
     * 设置事件监听
     */
    setupEventListeners() {
        const C = window.TCConstants;

        // 项目创建时更新用户索引
        this.eventBus.on(C.EVENTS.PROJECT_CREATED, async (data) => {
            await this.addProjectToUser(data.userId, data.projectId);
        });

        // 成员加入时更新用户索引
        this.eventBus.on(C.EVENTS.MEMBER_JOINED, async (data) => {
            await this.addProjectToUser(data.userId, data.projectId);
        });

        // 任务创建时更新项目任务索引
        this.eventBus.on(C.EVENTS.TASK_CREATED, async (data) => {
            await this.addTaskToProject(data.projectId, data.taskId);
        });
    }

    /**
     * 添加项目到用户索引
     * @param {string} userId - 用户 ID
     * @param {string} projectId - 项目 ID
     */
    async addProjectToUser(userId, projectId) {
        const projectIds = await this.storage.loadUserProjectIndex(userId);
        if (!projectIds.includes(projectId)) {
            projectIds.push(projectId);
            await this.storage.saveUserProjectIndex(userId, projectIds);
        }
    }

    /**
     * 从用户索引移除项目
     * @param {string} userId - 用户 ID
     * @param {string} projectId - 项目 ID
     */
    async removeProjectFromUser(userId, projectId) {
        const projectIds = await this.storage.loadUserProjectIndex(userId);
        const index = projectIds.indexOf(projectId);
        if (index > -1) {
            projectIds.splice(index, 1);
            await this.storage.saveUserProjectIndex(userId, projectIds);
        }
    }

    /**
     * 添加任务到项目索引
     * @param {string} projectId - 项目 ID
     * @param {string} taskId - 任务 ID
     */
    async addTaskToProject(projectId, taskId) {
        const taskIds = await this.storage.loadProjectTaskIndex(projectId);
        if (!taskIds.includes(taskId)) {
            taskIds.push(taskId);
            await this.storage.saveProjectTaskIndex(projectId, taskIds);
        }
    }

    /**
     * 从项目索引移除任务
     * @param {string} projectId - 项目 ID
     * @param {string} taskId - 任务 ID
     */
    async removeTaskFromProject(projectId, taskId) {
        const taskIds = await this.storage.loadProjectTaskIndex(projectId);
        const index = taskIds.indexOf(taskId);
        if (index > -1) {
            taskIds.splice(index, 1);
            await this.storage.saveProjectTaskIndex(projectId, taskIds);
        }
    }

    /**
     * 获取用户参与的所有项目
     * @param {string} userId - 用户 ID
     * @returns {Promise<Array>} 项目列表
     */
    async getUserProjects(userId) {
        const projectIds = await this.storage.loadUserProjectIndex(userId);
        const projects = [];

        for (const projectId of projectIds) {
            const project = await this.storage.loadProject(projectId);
            if (project && !project.archivedAt) {
                projects.push(project);
            }
        }

        // 按更新时间排序
        projects.sort((a, b) => b.updatedAt - a.updatedAt);
        return projects;
    }

    /**
     * 获取项目的所有任务
     * @param {string} projectId - 项目 ID
     * @returns {Promise<Array>} 任务列表
     */
    async getProjectTasks(projectId) {
        const taskIds = await this.storage.loadProjectTaskIndex(projectId);
        const tasks = [];

        for (const taskId of taskIds) {
            const task = await this.storage.loadTask(taskId);
            if (task && !task.deletedAt) {
                tasks.push(task);
            }
        }

        // 按更新时间排序
        tasks.sort((a, b) => b.updatedAt - a.updatedAt);
        return tasks;
    }

    /**
     * 获取用户的任务（从所有参与的项目中）
     * @param {string} userId - 用户 ID
     * @returns {Promise<Array>} 任务列表
     */
    async getUserTasks(userId) {
        const projects = await this.getUserProjects(userId);
        const tasks = [];

        for (const project of projects) {
            const projectTasks = await this.getProjectTasks(project.id);
            // 只返回分配给该用户或由该用户创建的任务
            const userTasks = projectTasks.filter(task =>
                task.assigneeIds.includes(userId) ||
                task.createdBy === userId ||
                task.watcherIds.includes(userId)
            );
            tasks.push(...userTasks);
        }

        // 按截止时间排序
        tasks.sort((a, b) => {
            if (!a.dueDate && !b.dueDate) return b.updatedAt - a.updatedAt;
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return a.dueDate - b.dueDate;
        });

        return tasks;
    }

    /**
     * 计算项目统计
     * @param {string} projectId - 项目 ID
     * @returns {Promise<Object>} 统计数据
     */
    async calculateProjectStats(projectId) {
        const tasks = await this.getProjectTasks(projectId);
        const now = Date.now();

        const stats = {
            totalTasks: tasks.length,
            todoTasks: tasks.filter(t => t.status === 'todo').length,
            doingTasks: tasks.filter(t => t.status === 'doing').length,
            reviewTasks: tasks.filter(t => t.status === 'review').length,
            completedTasks: tasks.filter(t => t.status === 'done').length,
            overdueTasks: tasks.filter(t =>
                t.dueDate &&
                t.dueDate < now &&
                t.status !== 'done'
            ).length
        };

        return stats;
    }

    /**
     * 搜索任务
     * @param {string} userId - 用户 ID
     * @param {Object} filters - 过滤条件
     * @returns {Promise<Array>} 任务列表
     */
    async searchTasks(userId, filters = {}) {
        let tasks = await this.getUserTasks(userId);

        // 关键词搜索
        if (filters.keyword) {
            const keyword = filters.keyword.toLowerCase();
            tasks = tasks.filter(task =>
                task.titleDigest?.includes(keyword) ||
                task.descriptionDigest?.includes(keyword)
            );
        }

        // 状态过滤
        if (filters.status) {
            tasks = tasks.filter(t => t.status === filters.status);
        }

        // 优先级过滤
        if (filters.priority) {
            tasks = tasks.filter(t => t.priority === filters.priority);
        }

        // 负责人过滤
        if (filters.assigneeId) {
            tasks = tasks.filter(t => t.assigneeIds.includes(filters.assigneeId));
        }

        // 标签过滤
        if (filters.tag) {
            tasks = tasks.filter(t => t.tags?.includes(filters.tag));
        }

        // 逾期过滤
        if (filters.overdue) {
            const now = Date.now();
            tasks = tasks.filter(t =>
                t.dueDate &&
                t.dueDate < now &&
                t.status !== 'done'
            );
        }

        return tasks;
    }
}

// 导出
window.TCIndexManager = IndexManager;

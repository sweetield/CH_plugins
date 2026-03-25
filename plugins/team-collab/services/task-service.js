/**
 * 团队协作插件 - 任务服务
 */

class TaskService {
    constructor(storage, crypto, permissionService, indexManager, eventBus) {
        this.storage = storage;
        this.crypto = crypto;
        this.permission = permissionService;
        this.indexManager = indexManager;
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
     * 创建任务
     * @param {Object} input - 任务输入
     * @param {string} userId - 创建者 ID
     * @returns {Promise<Object>} 创建的任务
     */
    async createTask(input, userId) {
        const C = window.TCConstants;
        const now = Date.now();

        // 获取项目信息以检查权限
        const project = await this.storage.loadProject(input.projectId);
        if (!project) {
            throw new TCErrors.TCError('项目不存在', 'NOT_FOUND');
        }

        // 权限检查
        this.permission.assertPermission(
            this.permission.canCreateTask(userId, project),
            '创建任务'
        );

        // 加密标题和描述
        const titleEncrypted = await this.crypto.encryptWithIndex(input.title);
        const descriptionEncrypted = input.description
            ? await this.crypto.encrypt(input.description)
            : '';

        const task = {
            id: this.generateId('TASK'),
            projectId: input.projectId,
            title: titleEncrypted.encrypted,
            titleDigest: titleEncrypted.digest,
            description: descriptionEncrypted,
            descriptionDigest: input.description ? this.crypto.createSearchDigest(input.description) : '',
            status: input.status || C.TASK_STATUS.TODO,
            priority: input.priority || C.TASK_PRIORITY.MEDIUM,
            createdBy: userId,
            ownerId: userId,
            assigneeIds: input.assigneeIds || [],
            watcherIds: [userId],
            visibility: input.visibility || project.defaultTaskVisibility || C.VISIBILITY.PROJECT,
            tags: input.tags || [],
            startDate: input.startDate || null,
            dueDate: input.dueDate || null,
            completedAt: null,
            progress: 0,
            progressMode: 'manual',
            parentTaskId: input.parentTaskId || null,
            subTaskIds: [],
            dependsOn: input.dependsOn || [],
            attachmentIds: [],
            threadIds: [],
            aclUserIds: input.aclUserIds || [],
            deletedAt: null,
            createdAt: now,
            updatedAt: now,
            version: 1
        };

        // 保存任务
        await this.storage.saveTask(task);

        // 更新索引
        await this.indexManager.addTaskToProject(input.projectId, task.id);

        // 更新项目统计
        await this.updateProjectStats(input.projectId);

        // 触发事件
        this.eventBus.emit(C.EVENTS.TASK_CREATED, {
            taskId: task.id,
            projectId: task.projectId,
            createdBy: userId
        });

        console.log('[TaskService] 任务创建成功:', task.id);
        return await this.getTask(task.id, userId);
    }

    /**
     * 获取任务详情（解密）
     * @param {string} taskId - 任务 ID
     * @param {string} userId - 用户 ID
     * @returns {Promise<Object|null>}
     */
    async getTask(taskId, userId) {
        const task = await this.storage.loadTask(taskId);
        if (!task || task.deletedAt) return null;

        // 获取项目信息以检查权限
        const project = await this.storage.loadProject(task.projectId);
        if (!project) return null;

        // 权限检查
        if (!this.permission.canViewTask(userId, task, project)) {
            return null;
        }

        // 解密任务信息
        return {
            ...task,
            title: await this.crypto.decrypt(task.title),
            description: task.description ? await this.crypto.decrypt(task.description) : ''
        };
    }

    /**
     * 更新任务
     * @param {string} taskId - 任务 ID
     * @param {Object} updates - 更新数据
     * @param {string} userId - 操作者 ID
     * @returns {Promise<Object>} 更新后的任务
     */
    async updateTask(taskId, updates, userId) {
        const C = window.TCConstants;
        const task = await this.storage.loadTask(taskId);

        if (!task || task.deletedAt) {
            throw new TCErrors.TCError('任务不存在', 'NOT_FOUND');
        }

        const project = await this.storage.loadProject(task.projectId);
        if (!project) {
            throw new TCErrors.TCError('项目不存在', 'NOT_FOUND');
        }

        // 权限检查
        this.permission.assertPermission(
            this.permission.canEditTask(userId, task, project),
            '编辑任务'
        );

        const now = Date.now();
        const activities = [];

        // 更新字段
        if (updates.title !== undefined) {
            const titleEncrypted = await this.crypto.encryptWithIndex(updates.title);
            task.title = titleEncrypted.encrypted;
            task.titleDigest = titleEncrypted.digest;
            activities.push({ field: 'title', time: now });
        }

        if (updates.description !== undefined) {
            task.description = updates.description
                ? await this.crypto.encrypt(updates.description)
                : '';
            task.descriptionDigest = updates.description ? this.crypto.createSearchDigest(updates.description) : '';
            activities.push({ field: 'description', time: now });
        }

        if (updates.status !== undefined && updates.status !== task.status) {
            const oldStatus = task.status;
            task.status = updates.status;
            activities.push({ field: 'status', from: oldStatus, to: updates.status, time: now });

            // 如果状态变为完成，设置完成时间
            if (updates.status === C.TASK_STATUS.DONE) {
                task.completedAt = now;
                task.progress = 100;
            } else {
                task.completedAt = null;
            }

            // 触发状态变更事件
            this.eventBus.emit(C.EVENTS.TASK_STATUS_CHANGED, {
                taskId: task.id,
                projectId: task.projectId,
                from: oldStatus,
                to: updates.status,
                userId
            });

            // 如果任务完成，触发完成事件
            if (updates.status === C.TASK_STATUS.DONE) {
                this.eventBus.emit(C.EVENTS.TASK_COMPLETED, {
                    taskId: task.id,
                    projectId: task.projectId,
                    userId
                });
            }
        }

        if (updates.priority !== undefined) {
            task.priority = updates.priority;
            activities.push({ field: 'priority', time: now });
        }

        if (updates.assigneeIds !== undefined) {
            const oldAssignees = task.assigneeIds || [];
            task.assigneeIds = updates.assigneeIds;
            activities.push({ field: 'assignees', time: now });

            // 通知新分配的用户
            const newAssignees = updates.assigneeIds.filter(id => !oldAssignees.includes(id));
            newAssignees.forEach(assigneeId => {
                this.eventBus.emit(C.EVENTS.TASK_ASSIGNED, {
                    taskId: task.id,
                    projectId: task.projectId,
                    assigneeId,
                    assignedBy: userId
                });
            });
        }

        if (updates.dueDate !== undefined) {
            task.dueDate = updates.dueDate;
            activities.push({ field: 'dueDate', time: now });
        }

        if (updates.visibility !== undefined) {
            task.visibility = updates.visibility;
            activities.push({ field: 'visibility', time: now });
        }

        if (updates.tags !== undefined) {
            task.tags = updates.tags;
            activities.push({ field: 'tags', time: now });
        }

        if (updates.progress !== undefined) {
            task.progress = Math.min(100, Math.max(0, updates.progress));
        }

        task.updatedAt = now;
        task.version = (task.version || 1) + 1;

        // 保存任务
        await this.storage.saveTask(task);

        // 更新项目统计
        await this.updateProjectStats(task.projectId);

        return await this.getTask(task.id, userId);
    }

    /**
     * 删除任务（软删除）
     * @param {string} taskId - 任务 ID
     * @param {string} userId - 操作者 ID
     */
    async deleteTask(taskId, userId) {
        const C = window.TCConstants;
        const task = await this.storage.loadTask(taskId);

        if (!task || task.deletedAt) {
            throw new TCErrors.TCError('任务不存在', 'NOT_FOUND');
        }

        const project = await this.storage.loadProject(task.projectId);
        if (!project) {
            throw new TCErrors.TCError('项目不存在', 'NOT_FOUND');
        }

        // 权限检查
        this.permission.assertPermission(
            this.permission.canDeleteTask(userId, task, project),
            '删除任务'
        );

        // 软删除
        task.deletedAt = Date.now();
        task.updatedAt = Date.now();
        task.version = (task.version || 1) + 1;

        await this.storage.saveTask(task);

        // 更新项目统计
        await this.updateProjectStats(task.projectId);

        // 触发事件
        this.eventBus.emit(C.EVENTS.TASK_DELETED, {
            taskId: task.id,
            projectId: task.projectId,
            userId
        });
    }

    /**
     * 获取项目的所有任务
     * @param {string} projectId - 项目 ID
     * @param {string} userId - 用户 ID
     * @returns {Promise<Array>} 任务列表
     */
    async getProjectTasks(projectId, userId) {
        const project = await this.storage.loadProject(projectId);
        if (!project) return [];

        const tasks = await this.indexManager.getProjectTasks(projectId);

        // 过滤有权限查看的任务，并解密
        const visibleTasks = [];
        for (const task of tasks) {
            if (this.permission.canViewTask(userId, task, project)) {
                visibleTasks.push({
                    ...task,
                    title: await this.crypto.decrypt(task.title),
                    description: task.description ? await this.crypto.decrypt(task.description) : ''
                });
            }
        }

        return visibleTasks;
    }

    /**
     * 获取用户的任务（按状态分组）
     * @param {string} projectId - 项目 ID
     * @param {string} userId - 用户 ID
     * @returns {Promise<Object>} 按状态分组的任务
     */
    async getProjectTasksByStatus(projectId, userId) {
        const tasks = await this.getProjectTasks(projectId, userId);
        const C = window.TCConstants;

        return {
            [C.TASK_STATUS.TODO]: tasks.filter(t => t.status === C.TASK_STATUS.TODO),
            [C.TASK_STATUS.DOING]: tasks.filter(t => t.status === C.TASK_STATUS.DOING),
            [C.TASK_STATUS.REVIEW]: tasks.filter(t => t.status === C.TASK_STATUS.REVIEW),
            [C.TASK_STATUS.DONE]: tasks.filter(t => t.status === C.TASK_STATUS.DONE)
        };
    }

    /**
     * 更新项目统计
     * @param {string} projectId - 项目 ID
     */
    async updateProjectStats(projectId) {
        const stats = await this.indexManager.calculateProjectStats(projectId);
        const project = await this.storage.loadProject(projectId);

        if (project) {
            project.stats = stats;
            project.updatedAt = Date.now();
            await this.storage.saveProject(project);
        }
    }

    /**
     * 搜索任务
     * @param {string} projectId - 项目 ID
     * @param {string} userId - 用户 ID
     * @param {Object} filters - 过滤条件
     * @returns {Promise<Array>}
     */
    async searchTasks(projectId, userId, filters = {}) {
        const tasks = await this.getProjectTasks(projectId, userId);

        // 关键词搜索
        if (filters.keyword) {
            const keyword = filters.keyword.toLowerCase();
            return tasks.filter(task =>
                task.title.toLowerCase().includes(keyword) ||
                task.description.toLowerCase().includes(keyword)
            );
        }

        // 状态过滤
        if (filters.status) {
            return tasks.filter(t => t.status === filters.status);
        }

        // 优先级过滤
        if (filters.priority) {
            return tasks.filter(t => t.priority === filters.priority);
        }

        // 负责人过滤
        if (filters.assigneeId) {
            return tasks.filter(t => t.assigneeIds.includes(filters.assigneeId));
        }

        return tasks;
    }

    /**
     * 检查任务是否逾期
     * @param {Object} task - 任务对象
     * @returns {boolean}
     */
    isOverdue(task) {
        if (!task.dueDate) return false;
        if (task.status === 'done') return false;
        return task.dueDate < Date.now();
    }

    /**
     * 获取逾期任务
     * @param {string} projectId - 项目 ID
     * @param {string} userId - 用户 ID
     * @returns {Promise<Array>}
     */
    async getOverdueTasks(projectId, userId) {
        const tasks = await this.getProjectTasks(projectId, userId);
        return tasks.filter(task => this.isOverdue(task));
    }
}

// 导出
window.TCTaskService = TaskService;

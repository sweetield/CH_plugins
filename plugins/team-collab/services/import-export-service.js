/**
 * 团队协作插件 - 导入导出服务
 */

class ImportExportService {
    constructor(storage, crypto, permissionService, indexManager, eventBus) {
        this.storage = storage;
        this.crypto = crypto;
        this.permission = permissionService;
        this.indexManager = indexManager;
        this.eventBus = eventBus;
    }

    /**
     * 生成唯一 ID
     */
    generateId(prefix) {
        const C = window.TCConstants;
        return `${C.ID_PREFIX[prefix.toUpperCase()]}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 导出项目
     * @param {string} projectId - 项目 ID
     * @param {string} userId - 用户 ID
     * @param {string} mode - 导出模式 ('encrypted' | 'plaintext')
     * @returns {Promise<Object>}
     */
    async exportProject(projectId, userId, mode = 'encrypted') {
        const C = window.TCConstants;

        // 权限检查
        const project = await this.storage.loadProject(projectId);
        if (!project) {
            throw new TCErrors.TCError('项目不存在', 'NOT_FOUND');
        }

        this.permission.assertPermission(
            this.permission.canExportProject(userId, project),
            '导出项目'
        );

        console.log('[ImportExportService] 开始导出项目:', projectId);

        // 获取项目任务
        const taskIds = await this.storage.loadProjectTaskIndex(projectId);
        const tasks = [];
        for (const taskId of taskIds) {
            const task = await this.storage.loadTask(taskId);
            if (task && !task.deletedAt) {
                tasks.push(task);
            }
        }

        // 获取学习计划
        const plans = await this.getProjectPlans(projectId);

        // 获取评论线程
        const threads = [];
        const comments = [];
        for (const task of tasks) {
            if (task.threadIds) {
                for (const threadId of task.threadIds) {
                    const thread = await this.storage.loadThread(threadId);
                    if (thread) {
                        threads.push(thread);
                        // 获取评论
                        const threadComments = await this.getThreadComments(threadId);
                        comments.push(...threadComments);
                    }
                }
            }
        }

        // 解密数据（如果是明文导出）
        const exportData = {
            schemaVersion: C.SCHEMA_VERSION,
            exportMode: mode,
            exportedAt: new Date().toISOString(),
            exportedBy: userId,
            manifest: {
                projectId: projectId,
                projectName: await this.crypto.decrypt(project.name),
                taskCount: tasks.length,
                planCount: plans.length,
                threadCount: threads.length,
                commentCount: comments.length,
                checksum: ''
            },
            project: mode === 'plaintext' ? await this.decryptProject(project) : project,
            tasks: mode === 'plaintext' ? await this.decryptTasks(tasks) : tasks,
            plans: mode === 'plaintext' ? await this.decryptPlans(plans) : plans,
            threads: threads,
            comments: mode === 'plaintext' ? await this.decryptComments(comments) : comments
        };

        // 计算校验和
        const dataStr = JSON.stringify({
            project: exportData.project,
            tasks: exportData.tasks,
            plans: exportData.plans
        });
        exportData.manifest.checksum = await this.calculateChecksum(dataStr);

        console.log('[ImportExportService] 项目导出完成');

        return exportData;
    }

    /**
     * 导出为 JSON 文件
     * @param {Object} exportData - 导出数据
     * @param {string} filename - 文件名
     */
    exportToFile(exportData, filename) {
        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `project-export-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * 导入项目
     * @param {File} file - JSON 文件
     * @param {string} userId - 用户 ID
     * @param {string} mode - 导入模式 ('create' | 'overwrite' | 'merge')
     * @param {string} targetProjectId - 目标项目 ID（覆盖/合并模式时使用）
     * @returns {Promise<Object>}
     */
    async importProject(file, userId, mode = 'create', targetProjectId = null) {
        const C = window.TCConstants;

        console.log('[ImportExportService] 开始导入项目, 模式:', mode);

        // 读取文件
        const text = await file.text();
        let importData;

        try {
            importData = JSON.parse(text);
        } catch (error) {
            throw new TCErrors.ImportExportError('无效的 JSON 文件');
        }

        // 校验数据格式
        this.validateImportData(importData);

        // 校验版本兼容性
        if (!this.isVersionSupported(importData.schemaVersion)) {
            throw new TCErrors.ImportExportError(`不支持的 schema 版本: ${importData.schemaVersion}`);
        }

        // 校验校验和
        const dataStr = JSON.stringify({
            project: importData.project,
            tasks: importData.tasks,
            plans: importData.plans
        });
        const checksum = await this.calculateChecksum(dataStr);
        if (importData.manifest.checksum && checksum !== importData.manifest.checksum) {
            throw new TCErrors.ImportExportError('数据校验失败，文件可能已损坏');
        }

        // 根据模式导入
        let result;
        switch (mode) {
            case 'create':
                result = await this.importAsNewProject(importData, userId);
                break;
            case 'overwrite':
                if (!targetProjectId) {
                    throw new TCErrors.ImportExportError('覆盖模式需要指定目标项目 ID');
                }
                result = await this.overwriteProject(importData, targetProjectId, userId);
                break;
            case 'merge':
                if (!targetProjectId) {
                    throw new TCErrors.ImportExportError('合并模式需要指定目标项目 ID');
                }
                result = await this.mergeProject(importData, targetProjectId, userId);
                break;
            default:
                throw new TCErrors.ImportExportError(`无效的导入模式: ${mode}`);
        }

        console.log('[ImportExportService] 项目导入完成');

        return result;
    }

    /**
     * 作为新项目导入
     * @param {Object} importData - 导入数据
     * @param {string} userId - 用户 ID
     * @returns {Promise<Object>}
     */
    async importAsNewProject(importData, userId) {
        const C = window.TCConstants;
        const now = Date.now();

        // 创建新项目
        const projectData = importData.project;
        const nameEncrypted = await this.crypto.encryptWithIndex(projectData.name);
        const descriptionEncrypted = projectData.description
            ? await this.crypto.encrypt(projectData.description)
            : '';

        const inviteCode = this.generateInviteCode();

        const project = {
            id: this.generateId('PROJECT'),
            name: nameEncrypted.encrypted,
            nameDigest: nameEncrypted.digest,
            description: descriptionEncrypted,
            ownerId: userId,
            members: [
                { userId: userId, role: C.PROJECT_ROLE.OWNER, joinedAt: now }
            ],
            defaultTaskVisibility: projectData.defaultTaskVisibility || C.VISIBILITY.PROJECT,
            invitePolicy: projectData.invitePolicy || { allowInvite: true, requireAdminApproval: false },
            inviteCode: inviteCode,
            stats: { totalTasks: 0, completedTasks: 0, overdueTasks: 0, totalPlans: 0 },
            createdAt: now,
            updatedAt: now,
            archivedAt: null,
            version: 1
        };

        await this.storage.saveProject(project);

        // 保存邀请码
        await this.storage.saveInviteCode(inviteCode, {
            projectId: project.id,
            expiresAt: null,
            maxUses: null,
            usedCount: 0,
            status: 'active'
        });

        // 导入任务
        const taskMapping = {};
        for (const taskData of importData.tasks) {
            const newTaskId = this.generateId('TASK');
            taskMapping[taskData.id] = newTaskId;

            const titleEncrypted = await this.crypto.encryptWithIndex(taskData.title || '');
            const descriptionEncrypted = taskData.description
                ? await this.crypto.encrypt(taskData.description)
                : '';

            const task = {
                ...taskData,
                id: newTaskId,
                projectId: project.id,
                title: titleEncrypted.encrypted,
                titleDigest: titleEncrypted.digest,
                description: descriptionEncrypted,
                createdBy: userId,
                ownerId: userId,
                assigneeIds: [userId],
                createdAt: now,
                updatedAt: now,
                version: 1
            };

            await this.storage.saveTask(task);
            await this.indexManager.addTaskToProject(project.id, newTaskId);
        }

        // 导入学习计划
        for (const planData of importData.plans) {
            const newPlanId = this.generateId('PLAN');

            const titleEncrypted = await this.crypto.encryptWithIndex(planData.title || '');
            const descriptionEncrypted = planData.description
                ? await this.crypto.encrypt(planData.description)
                : '';

            const plan = {
                ...planData,
                id: newPlanId,
                projectId: project.id,
                title: titleEncrypted.encrypted,
                titleDigest: titleEncrypted.digest,
                description: descriptionEncrypted,
                createdBy: userId,
                assigneeIds: [userId],
                createdAt: now,
                updatedAt: now,
                version: 1
            };

            await this.storage.savePlan(plan);
        }

        // 更新用户项目索引
        await this.indexManager.addProjectToUser(userId, project.id);

        // 更新项目统计
        project.stats.totalTasks = importData.tasks.length;
        project.stats.totalPlans = importData.plans.length;
        await this.storage.saveProject(project);

        return {
            projectId: project.id,
            projectName: projectData.name,
            taskCount: importData.tasks.length,
            planCount: importData.plans.length
        };
    }

    /**
     * 覆盖现有项目
     * @param {Object} importData - 导入数据
     * @param {string} projectId - 目标项目 ID
     * @param {string} userId - 用户 ID
     * @returns {Promise<Object>}
     */
    async overwriteProject(importData, projectId, userId) {
        const project = await this.storage.loadProject(projectId);
        if (!project) {
            throw new TCErrors.TCError('目标项目不存在', 'NOT_FOUND');
        }

        // 删除现有任务
        const existingTaskIds = await this.storage.loadProjectTaskIndex(projectId);
        for (const taskId of existingTaskIds) {
            await this.storage.remove(this.storage.getKeys().task(taskId));
        }
        await this.storage.saveProjectTaskIndex(projectId, []);

        // 更新项目信息
        const projectData = importData.project;
        project.name = await this.crypto.encrypt(projectData.name);
        project.nameDigest = this.crypto.createSearchDigest(projectData.name);
        project.description = projectData.description
            ? await this.crypto.encrypt(projectData.description)
            : '';
        project.updatedAt = Date.now();
        project.version = (project.version || 1) + 1;

        await this.storage.saveProject(project);

        // 导入新任务
        for (const taskData of importData.tasks) {
            const newTaskId = this.generateId('TASK');
            const titleEncrypted = await this.crypto.encryptWithIndex(taskData.title || '');

            const task = {
                ...taskData,
                id: newTaskId,
                projectId: projectId,
                title: titleEncrypted.encrypted,
                titleDigest: titleEncrypted.digest,
                createdBy: userId,
                ownerId: userId,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                version: 1
            };

            await this.storage.saveTask(task);
            await this.indexManager.addTaskToProject(projectId, newTaskId);
        }

        // 更新统计
        project.stats.totalTasks = importData.tasks.length;
        await this.storage.saveProject(project);

        return {
            projectId: projectId,
            projectName: projectData.name,
            taskCount: importData.tasks.length,
            planCount: importData.plans.length
        };
    }

    /**
     * 合并到现有项目
     * @param {Object} importData - 导入数据
     * @param {string} projectId - 目标项目 ID
     * @param {string} userId - 用户 ID
     * @returns {Promise<Object>}
     */
    async mergeProject(importData, projectId, userId) {
        const project = await this.storage.loadProject(projectId);
        if (!project) {
            throw new TCErrors.TCError('目标项目不存在', 'NOT_FOUND');
        }

        // 获取现有任务标题集合
        const existingTaskIds = await this.storage.loadProjectTaskIndex(projectId);
        const existingTitles = new Set();
        for (const taskId of existingTaskIds) {
            const task = await this.storage.loadTask(taskId);
            if (task && task.titleDigest) {
                existingTitles.add(task.titleDigest);
            }
        }

        // 导入新任务（跳过重复）
        let importedCount = 0;
        let skippedCount = 0;

        for (const taskData of importData.tasks) {
            const titleDigest = this.crypto.createSearchDigest(taskData.title || '');

            if (existingTitles.has(titleDigest)) {
                skippedCount++;
                continue;
            }

            const newTaskId = this.generateId('TASK');
            const titleEncrypted = await this.crypto.encryptWithIndex(taskData.title || '');

            const task = {
                ...taskData,
                id: newTaskId,
                projectId: projectId,
                title: titleEncrypted.encrypted,
                titleDigest: titleDigest,
                createdBy: userId,
                ownerId: userId,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                version: 1
            };

            await this.storage.saveTask(task);
            await this.indexManager.addTaskToProject(projectId, newTaskId);
            existingTitles.add(titleDigest);
            importedCount++;
        }

        // 更新统计
        project.stats.totalTasks = existingTaskIds.length + importedCount;
        project.updatedAt = Date.now();
        project.version = (project.version || 1) + 1;
        await this.storage.saveProject(project);

        return {
            projectId: projectId,
            projectName: await this.crypto.decrypt(project.name),
            importedCount: importedCount,
            skippedCount: skippedCount
        };
    }

    /**
     * 校验导入数据
     * @param {Object} data - 导入数据
     */
    validateImportData(data) {
        if (!data) {
            throw new TCErrors.ImportExportError('导入数据为空');
        }

        if (!data.schemaVersion) {
            throw new TCErrors.ImportExportError('缺少 schemaVersion 字段');
        }

        if (!data.manifest) {
            throw new TCErrors.ImportExportError('缺少 manifest 字段');
        }

        if (!data.project) {
            throw new TCErrors.ImportExportError('缺少 project 字段');
        }

        if (!Array.isArray(data.tasks)) {
            throw new TCErrors.ImportExportError('tasks 字段必须是数组');
        }
    }

    /**
     * 检查版本是否支持
     * @param {string} version - 版本号
     * @returns {boolean}
     */
    isVersionSupported(version) {
        const supportedVersions = ['3.0.0', '2.1.0', '2.0.0'];
        return supportedVersions.includes(version);
    }

    /**
     * 计算校验和
     * @param {string} data - 数据字符串
     * @returns {Promise<string>}
     */
    async calculateChecksum(data) {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return 'sha256:' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * 生成邀请码
     * @returns {string}
     */
    generateInviteCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    /**
     * 获取项目的学习计划
     * @param {string} projectId - 项目 ID
     * @returns {Promise<Array>}
     */
    async getProjectPlans(projectId) {
        const plans = [];
        try {
            const allKeys = await this.getAllPlanKeys();
            for (const key of allKeys) {
                const plan = await this.storage.loadEncrypted(key);
                if (plan && plan.projectId === projectId && !plan.deletedAt) {
                    plans.push(plan);
                }
            }
        } catch (error) {
            console.error('[ImportExportService] 获取学习计划失败:', error);
        }
        return plans;
    }

    /**
     * 获取所有计划键
     * @returns {Promise<Array>}
     */
    async getAllPlanKeys() {
        // 简化实现：返回空数组
        return [];
    }

    /**
     * 获取线程评论
     * @param {string} threadId - 线程 ID
     * @returns {Promise<Array>}
     */
    async getThreadComments(threadId) {
        const C = window.TCConstants;
        const comments = [];
        const pageSize = C.PAGE_SIZE.COMMENTS;

        for (let page = 1; page <= 10; page++) {
            const pageComments = await this.storage.load(
                this.storage.getKeys().threadComments(threadId, page)
            );
            if (!pageComments || pageComments.length === 0) break;
            comments.push(...pageComments);
        }

        return comments;
    }

    /**
     * 解密项目
     * @param {Object} project - 加密的项目
     * @returns {Promise<Object>}
     */
    async decryptProject(project) {
        return {
            ...project,
            name: await this.crypto.decrypt(project.name),
            description: project.description ? await this.crypto.decrypt(project.description) : ''
        };
    }

    /**
     * 解密任务列表
     * @param {Array} tasks - 加密的任务列表
     * @returns {Promise<Array>}
     */
    async decryptTasks(tasks) {
        return Promise.all(tasks.map(async (task) => ({
            ...task,
            title: await this.crypto.decrypt(task.title),
            description: task.description ? await this.crypto.decrypt(task.description) : ''
        })));
    }

    /**
     * 解密学习计划列表
     * @param {Array} plans - 加密的计划列表
     * @returns {Promise<Array>}
     */
    async decryptPlans(plans) {
        return Promise.all(plans.map(async (plan) => ({
            ...plan,
            title: await this.crypto.decrypt(plan.title),
            description: plan.description ? await this.crypto.decrypt(plan.description) : ''
        })));
    }

    /**
     * 解密评论列表
     * @param {Array} comments - 加密的评论列表
     * @returns {Promise<Array>}
     */
    async decryptComments(comments) {
        return Promise.all(comments.map(async (comment) => ({
            ...comment,
            body: await this.crypto.decrypt(comment.body)
        })));
    }
}

// 导出
window.TCImportExportService = ImportExportService;

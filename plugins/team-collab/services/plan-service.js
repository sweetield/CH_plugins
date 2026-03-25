/**
 * 团队协作插件 - 学习计划服务
 */

class PlanService {
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
     * 创建学习计划
     * @param {Object} input - 计划输入
     * @param {string} userId - 创建者 ID
     * @returns {Promise<Object>}
     */
    async createPlan(input, userId) {
        const C = window.TCConstants;
        const now = Date.now();

        // 加密标题和描述
        const titleEncrypted = await this.crypto.encryptWithIndex(input.title);
        const descriptionEncrypted = input.description
            ? await this.crypto.encrypt(input.description)
            : '';

        const plan = {
            id: this.generateId('PLAN'),
            projectId: input.projectId,
            title: titleEncrypted.encrypted,
            titleDigest: titleEncrypted.digest,
            description: descriptionEncrypted,
            templateType: input.templateType || C.PLAN_TEMPLATE_TYPE.CUSTOM,
            objectives: input.objectives || '',
            deliverables: input.deliverables || [],
            createdBy: userId,
            assigneeIds: input.assigneeIds || [],
            taskIds: [],
            submissionRule: {
                dueDate: input.dueDate || null,
                allowAttachment: true,
                requiredText: input.requireSubmission !== false
            },
            reviewMode: input.reviewMode || 'self',
            reviewerIds: input.reviewerIds || [],
            progress: {},
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
            version: 1
        };

        // 初始化每个成员的进度
        plan.assigneeIds.forEach(memberId => {
            plan.progress[memberId] = {
                completedTasks: 0,
                totalTasks: 0,
                submissions: [],
                status: 'not_started'
            };
        });

        // 保存计划
        await this.storage.savePlan(plan);

        // 更新项目统计
        await this.updateProjectPlanStats(input.projectId);

        console.log('[PlanService] 学习计划创建成功:', plan.id);
        return await this.getPlan(plan.id);
    }

    /**
     * 获取学习计划（解密）
     * @param {string} planId - 计划 ID
     * @returns {Promise<Object|null>}
     */
    async getPlan(planId) {
        const plan = await this.storage.loadPlan(planId);
        if (!plan || plan.deletedAt) return null;

        return {
            ...plan,
            title: await this.crypto.decrypt(plan.title),
            description: plan.description ? await this.crypto.decrypt(plan.description) : ''
        };
    }

    /**
     * 更新学习计划
     * @param {string} planId - 计划 ID
     * @param {Object} updates - 更新数据
     * @param {string} userId - 操作者 ID
     * @returns {Promise<Object>}
     */
    async updatePlan(planId, updates, userId) {
        const plan = await this.storage.loadPlan(planId);

        if (!plan || plan.deletedAt) {
            throw new TCErrors.TCError('学习计划不存在', 'NOT_FOUND');
        }

        const now = Date.now();

        if (updates.title !== undefined) {
            const titleEncrypted = await this.crypto.encryptWithIndex(updates.title);
            plan.title = titleEncrypted.encrypted;
            plan.titleDigest = titleEncrypted.digest;
        }

        if (updates.description !== undefined) {
            plan.description = updates.description
                ? await this.crypto.encrypt(updates.description)
                : '';
        }

        if (updates.dueDate !== undefined) {
            plan.submissionRule.dueDate = updates.dueDate;
        }

        if (updates.assigneeIds !== undefined) {
            // 添加新成员的进度
            updates.assigneeIds.forEach(memberId => {
                if (!plan.progress[memberId]) {
                    plan.progress[memberId] = {
                        completedTasks: 0,
                        totalTasks: 0,
                        submissions: [],
                        status: 'not_started'
                    };
                }
            });
            plan.assigneeIds = updates.assigneeIds;
        }

        plan.updatedAt = now;
        plan.version = (plan.version || 1) + 1;

        await this.storage.savePlan(plan);
        return await this.getPlan(plan.id);
    }

    /**
     * 删除学习计划
     * @param {string} planId - 计划 ID
     * @param {string} userId - 操作者 ID
     */
    async deletePlan(planId, userId) {
        const plan = await this.storage.loadPlan(planId);

        if (!plan || plan.deletedAt) {
            throw new TCErrors.TCError('学习计划不存在', 'NOT_FOUND');
        }

        plan.deletedAt = Date.now();
        plan.updatedAt = Date.now();
        plan.version = (plan.version || 1) + 1;

        await this.storage.savePlan(plan);
        await this.updateProjectPlanStats(plan.projectId);
    }

    /**
     * 获取项目的所有学习计划
     * @param {string} projectId - 项目 ID
     * @returns {Promise<Array>}
     */
    async getProjectPlans(projectId) {
        // 从存储加载所有计划
        const keys = await this.api?.storage?.keys?.(`${window.TCConstants.STORAGE_PREFIX}:plan:*`) || [];
        const plans = [];

        for (const key of keys) {
            const planId = key.split(':').pop();
            const plan = await this.storage.loadPlan(planId);
            if (plan && plan.projectId === projectId && !plan.deletedAt) {
                plans.push({
                    ...plan,
                    title: await this.crypto.decrypt(plan.title),
                    description: plan.description ? await this.crypto.decrypt(plan.description) : ''
                });
            }
        }

        // 按更新时间排序
        plans.sort((a, b) => b.updatedAt - a.updatedAt);
        return plans;
    }

    /**
     * 添加学习任务到计划
     * @param {string} planId - 计划 ID
     * @param {Object} taskInput - 任务输入
     * @returns {Promise<Object>}
     */
    async addLearningTask(planId, taskInput) {
        const plan = await this.storage.loadPlan(planId);

        if (!plan || plan.deletedAt) {
            throw new TCErrors.TCError('学习计划不存在', 'NOT_FOUND');
        }

        // 创建学习任务（作为普通任务）
        const C = window.TCConstants;
        const now = Date.now();

        const titleEncrypted = await this.crypto.encryptWithIndex(taskInput.title);
        const descriptionEncrypted = taskInput.description
            ? await this.crypto.encrypt(taskInput.description)
            : '';

        const task = {
            id: this.generateId('TASK'),
            projectId: plan.projectId,
            title: titleEncrypted.encrypted,
            titleDigest: titleEncrypted.digest,
            description: descriptionEncrypted,
            status: C.TASK_STATUS.TODO,
            priority: C.TASK_PRIORITY.MEDIUM,
            createdBy: taskInput.createdBy,
            ownerId: taskInput.createdBy,
            assigneeIds: plan.assigneeIds,
            watcherIds: [taskInput.createdBy],
            visibility: C.VISIBILITY.PROJECT,
            tags: ['学习计划'],
            parentTaskId: null,
            subTaskIds: [],
            dependsOn: [],
            attachmentIds: [],
            threadIds: [],
            planId: planId,
            isLearningTask: true,
            learningTaskMeta: {
                resources: taskInput.resources || [],
                requiredOutput: taskInput.requiredOutput !== false
            },
            createdAt: now,
            updatedAt: now,
            version: 1
        };

        await this.storage.saveTask(task);

        // 更新计划的任务列表
        plan.taskIds.push(task.id);
        plan.updatedAt = now;
        plan.version = (plan.version || 1) + 1;

        // 更新每个成员的总任务数
        plan.assigneeIds.forEach(memberId => {
            if (plan.progress[memberId]) {
                plan.progress[memberId].totalTasks++;
            }
        });

        await this.storage.savePlan(plan);

        return {
            ...task,
            title: taskInput.title,
            description: taskInput.description || ''
        };
    }

    /**
     * 提交学习成果
     * @param {string} planId - 计划 ID
     * @param {string} userId - 用户 ID
     * @param {Object} submission - 提交内容
     * @returns {Promise<Object>}
     */
    async submitWork(planId, userId, submission) {
        const plan = await this.storage.loadPlan(planId);

        if (!plan || plan.deletedAt) {
            throw new TCErrors.TCError('学习计划不存在', 'NOT_FOUND');
        }

        if (!plan.assigneeIds.includes(userId)) {
            throw new TCErrors.PermissionError('你不是该计划的成员');
        }

        // 加密提交内容
        const contentEncrypted = await this.crypto.encrypt(submission.content);

        const submitObj = {
            id: this.generateId('COMMENT'),
            userId: userId,
            content: contentEncrypted,
            attachmentIds: submission.attachmentIds || [],
            submittedAt: Date.now()
        };

        // 添加到用户的提交列表
        if (!plan.progress[userId]) {
            plan.progress[userId] = {
                completedTasks: 0,
                totalTasks: plan.taskIds.length,
                submissions: [],
                status: 'in_progress'
            };
        }

        plan.progress[userId].submissions.push(submitObj);
        plan.progress[userId].status = 'in_progress';
        plan.updatedAt = Date.now();
        plan.version = (plan.version || 1) + 1;

        await this.storage.savePlan(plan);

        // 触发事件
        this.eventBus.emit(window.TCConstants.EVENTS.PLAN_SUBMITTED, {
            planId,
            userId,
            submissionId: submitObj.id
        });

        return {
            ...submitObj,
            content: submission.content
        };
    }

    /**
     * 更新成员任务完成状态
     * @param {string} planId - 计划 ID
     * @param {string} taskId - 任务 ID
     * @param {string} userId - 用户 ID
     * @param {boolean} completed - 是否完成
     */
    async updateTaskCompletion(planId, taskId, userId, completed) {
        const plan = await this.storage.loadPlan(planId);

        if (!plan || plan.deletedAt) return;

        if (!plan.progress[userId]) {
            plan.progress[userId] = {
                completedTasks: 0,
                totalTasks: plan.taskIds.length,
                submissions: [],
                status: 'not_started'
            };
        }

        if (completed) {
            plan.progress[userId].completedTasks++;
        } else {
            plan.progress[userId].completedTasks = Math.max(0, plan.progress[userId].completedTasks - 1);
        }

        // 更新状态
        const progress = plan.progress[userId];
        if (progress.completedTasks === 0) {
            progress.status = 'not_started';
        } else if (progress.completedTasks >= progress.totalTasks) {
            progress.status = 'completed';
        } else {
            progress.status = 'in_progress';
        }

        plan.updatedAt = Date.now();
        plan.version = (plan.version || 1) + 1;

        await this.storage.savePlan(plan);
    }

    /**
     * 获取成员的计划进度
     * @param {string} planId - 计划 ID
     * @param {string} userId - 用户 ID
     * @returns {Promise<Object>}
     */
    async getMemberProgress(planId, userId) {
        const plan = await this.storage.loadPlan(planId);

        if (!plan || plan.deletedAt) {
            throw new TCErrors.TCError('学习计划不存在', 'NOT_FOUND');
        }

        const progress = plan.progress[userId] || {
            completedTasks: 0,
            totalTasks: plan.taskIds.length,
            submissions: [],
            status: 'not_started'
        };

        // 计算百分比
        const percentage = progress.totalTasks > 0
            ? Math.round((progress.completedTasks / progress.totalTasks) * 100)
            : 0;

        return {
            ...progress,
            percentage,
            submissions: await Promise.all(
                progress.submissions.map(async (s) => ({
                    ...s,
                    content: await this.crypto.decrypt(s.content)
                }))
            )
        };
    }

    /**
     * 获取计划的所有成员进度
     * @param {string} planId - 计划 ID
     * @returns {Promise<Object>}
     */
    async getAllMemberProgress(planId) {
        const plan = await this.storage.loadPlan(planId);

        if (!plan || plan.deletedAt) {
            throw new TCErrors.TCError('学习计划不存在', 'NOT_FOUND');
        }

        const result = {};

        for (const memberId of plan.assigneeIds) {
            result[memberId] = await this.getMemberProgress(planId, memberId);
        }

        return result;
    }

    /**
     * 更新项目学习计划统计
     * @param {string} projectId - 项目 ID
     */
    async updateProjectPlanStats(projectId) {
        const project = await this.storage.loadProject(projectId);
        if (project) {
            const plans = await this.getProjectPlans(projectId);
            project.stats = project.stats || {};
            project.stats.totalPlans = plans.length;
            project.updatedAt = Date.now();
            await this.storage.saveProject(project);
        }
    }

    /**
     * 获取用户的学习计划
     * @param {string} userId - 用户 ID
     * @returns {Promise<Array>}
     */
    async getUserPlans(userId) {
        const projects = await this.indexManager.getUserProjects(userId);
        const plans = [];

        for (const project of projects) {
            const projectPlans = await this.getProjectPlans(project.id);
            const userPlans = projectPlans.filter(p => p.assigneeIds.includes(userId));
            plans.push(...userPlans.map(p => ({ ...p, projectName: project.name })));
        }

        return plans;
    }
}

// 导出
window.TCPlanService = PlanService;

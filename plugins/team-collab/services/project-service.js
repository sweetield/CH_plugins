/**
 * 团队协作插件 - 项目服务
 */

class ProjectService {
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
     * 生成邀请码
     * @returns {string} 6位邀请码
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
     * 创建项目
     * @param {Object} input - 项目输入
     * @param {string} userId - 创建者 ID
     * @returns {Promise<Object>} 创建的项目
     */
    async createProject(input, userId) {
        const C = window.TCConstants;
        const now = Date.now();

        // 加密项目名称和描述
        const nameEncrypted = await this.crypto.encryptWithIndex(input.name);
        const descriptionEncrypted = input.description
            ? await this.crypto.encrypt(input.description)
            : '';

        const inviteCode = this.generateInviteCode();

        const project = {
            id: this.generateId('PROJECT'),
            name: nameEncrypted.encrypted,
            nameDigest: nameEncrypted.digest,
            description: descriptionEncrypted,
            ownerId: userId,
            members: [
                {
                    userId: userId,
                    role: C.PROJECT_ROLE.OWNER,
                    joinedAt: now
                }
            ],
            defaultTaskVisibility: input.visibility || C.VISIBILITY.PROJECT,
            invitePolicy: {
                allowInvite: true,
                requireAdminApproval: false
            },
            inviteCode: inviteCode,
            stats: {
                totalTasks: 0,
                completedTasks: 0,
                overdueTasks: 0,
                totalPlans: 0
            },
            createdAt: now,
            updatedAt: now,
            archivedAt: null,
            version: 1
        };

        // 保存项目
        await this.storage.saveProject(project);

        // 保存邀请码索引
        await this.storage.saveInviteCode(inviteCode, {
            projectId: project.id,
            expiresAt: null,
            maxUses: null,
            usedCount: 1,
            status: 'active'
        });

        // 触发事件
        this.eventBus.emit(C.EVENTS.PROJECT_CREATED, {
            projectId: project.id,
            userId: userId
        });

        console.log('[ProjectService] 项目创建成功:', project.id);
        return project;
    }

    /**
     * 获取项目详情（解密）
     * @param {string} projectId - 项目 ID
     * @returns {Promise<Object|null>}
     */
    async getProject(projectId) {
        const project = await this.storage.loadProject(projectId);
        if (!project) return null;

        // 解密项目名称和描述
        return {
            ...project,
            name: await this.crypto.decrypt(project.name),
            description: project.description ? await this.crypto.decrypt(project.description) : ''
        };
    }

    /**
     * 更新项目
     * @param {string} projectId - 项目 ID
     * @param {Object} updates - 更新数据
     * @param {string} userId - 操作者 ID
     * @returns {Promise<Object>} 更新后的项目
     */
    async updateProject(projectId, updates, userId) {
        const C = window.TCConstants;
        const project = await this.storage.loadProject(projectId);

        if (!project) {
            throw new TCErrors.TCError('项目不存在', 'NOT_FOUND');
        }

        // 权限检查
        this.permission.assertPermission(
            this.permission.canEditProject(userId, project),
            '编辑项目'
        );

        const now = Date.now();

        // 更新字段
        if (updates.name !== undefined) {
            const nameEncrypted = await this.crypto.encryptWithIndex(updates.name);
            project.name = nameEncrypted.encrypted;
            project.nameDigest = nameEncrypted.digest;
        }

        if (updates.description !== undefined) {
            project.description = updates.description
                ? await this.crypto.encrypt(updates.description)
                : '';
        }

        if (updates.visibility !== undefined) {
            project.defaultTaskVisibility = updates.visibility;
        }

        project.updatedAt = now;
        project.version = (project.version || 1) + 1;

        // 保存
        await this.storage.saveProject(project);

        return await this.getProject(projectId);
    }

    /**
     * 归档项目
     * @param {string} projectId - 项目 ID
     * @param {string} userId - 操作者 ID
     */
    async archiveProject(projectId, userId) {
        const C = window.TCConstants;
        const project = await this.storage.loadProject(projectId);

        if (!project) {
            throw new TCErrors.TCError('项目不存在', 'NOT_FOUND');
        }

        this.permission.assertPermission(
            this.permission.canArchiveProject(userId, project),
            '归档项目'
        );

        project.archivedAt = Date.now();
        project.updatedAt = Date.now();
        project.version = (project.version || 1) + 1;

        await this.storage.saveProject(project);

        this.eventBus.emit(C.EVENTS.PROJECT_ARCHIVED, { projectId, userId });
    }

    /**
     * 通过邀请码加入项目
     * @param {string} inviteCode - 邀请码
     * @param {string} userId - 用户 ID
     * @returns {Promise<Object>} 加入的项目
     */
    async joinProjectByInviteCode(inviteCode, userId) {
        const C = window.TCConstants;

        // 读取邀请码索引
        const inviteData = await this.storage.loadInviteCode(inviteCode);

        if (!inviteData) {
            throw new TCErrors.InviteError('邀请码无效');
        }

        if (inviteData.status !== 'active') {
            throw new TCErrors.InviteError('邀请码已失效');
        }

        if (inviteData.expiresAt && inviteData.expiresAt < Date.now()) {
            throw new TCErrors.InviteError('邀请码已过期');
        }

        if (inviteData.maxUses && inviteData.usedCount >= inviteData.maxUses) {
            throw new TCErrors.InviteError('邀请码使用次数已达上限');
        }

        // 获取项目
        const project = await this.storage.loadProject(inviteData.projectId);
        if (!project) {
            throw new TCErrors.InviteError('项目不存在');
        }

        // 检查是否已经是成员
        if (project.members.some(m => m.userId === userId)) {
            throw new TCErrors.InviteError('你已经是该项目的成员');
        }

        // 添加成员
        project.members.push({
            userId: userId,
            role: C.PROJECT_ROLE.MEMBER,
            joinedAt: Date.now()
        });

        project.updatedAt = Date.now();
        project.version = (project.version || 1) + 1;

        // 更新邀请码使用次数
        inviteData.usedCount++;
        await this.storage.saveInviteCode(inviteCode, inviteData);

        // 保存项目
        await this.storage.saveProject(project);

        // 触发事件
        this.eventBus.emit(C.EVENTS.MEMBER_JOINED, {
            projectId: project.id,
            userId: userId
        });

        console.log('[ProjectService] 用户加入项目成功:', userId, project.id);
        return await this.getProject(project.id);
    }

    /**
     * 邀请成员加入项目
     * @param {string} projectId - 项目 ID
     * @param {string} targetUserId - 被邀请用户 ID
     * @param {string} operatorId - 操作者 ID
     */
    async inviteMember(projectId, targetUserId, operatorId) {
        const C = window.TCConstants;
        const project = await this.storage.loadProject(projectId);

        if (!project) {
            throw new TCErrors.TCError('项目不存在', 'NOT_FOUND');
        }

        this.permission.assertPermission(
            this.permission.canInviteMembers(operatorId, project),
            '邀请成员'
        );

        // 检查是否已经是成员
        if (project.members.some(m => m.userId === targetUserId)) {
            throw new TCErrors.TCError('该用户已经是项目成员', 'ALREADY_MEMBER');
        }

        // 添加成员
        project.members.push({
            userId: targetUserId,
            role: C.PROJECT_ROLE.MEMBER,
            joinedAt: Date.now()
        });

        project.updatedAt = Date.now();
        project.version = (project.version || 1) + 1;

        await this.storage.saveProject(project);

        // 触发事件
        this.eventBus.emit(C.EVENTS.MEMBER_JOINED, {
            projectId: project.id,
            userId: targetUserId
        });
    }

    /**
     * 移除成员
     * @param {string} projectId - 项目 ID
     * @param {string} targetUserId - 被移除用户 ID
     * @param {string} operatorId - 操作者 ID
     */
    async removeMember(projectId, targetUserId, operatorId) {
        const C = window.TCConstants;
        const project = await this.storage.loadProject(projectId);

        if (!project) {
            throw new TCErrors.TCError('项目不存在', 'NOT_FOUND');
        }

        // 不能移除项目拥有者
        if (project.ownerId === targetUserId) {
            throw new TCErrors.TCError('不能移除项目拥有者', 'CANNOT_REMOVE_OWNER');
        }

        this.permission.assertPermission(
            this.permission.canInviteMembers(operatorId, project),
            '移除成员'
        );

        // 移除成员
        project.members = project.members.filter(m => m.userId !== targetUserId);
        project.updatedAt = Date.now();
        project.version = (project.version || 1) + 1;

        await this.storage.saveProject(project);

        // 触发事件
        this.eventBus.emit(C.EVENTS.MEMBER_LEFT, {
            projectId: project.id,
            userId: targetUserId
        });
    }

    /**
     * 更新成员角色
     * @param {string} projectId - 项目 ID
     * @param {string} targetUserId - 目标用户 ID
     * @param {string} newRole - 新角色
     * @param {string} operatorId - 操作者 ID
     */
    async updateMemberRole(projectId, targetUserId, newRole, operatorId) {
        const C = window.TCConstants;
        const project = await this.storage.loadProject(projectId);

        if (!project) {
            throw new TCErrors.TCError('项目不存在', 'NOT_FOUND');
        }

        this.permission.assertPermission(
            this.permission.canManageRoles(operatorId, project),
            '管理角色'
        );

        // 不能修改项目拥有者的角色
        if (project.ownerId === targetUserId) {
            throw new TCErrors.TCError('不能修改项目拥有者的角色', 'CANNOT_CHANGE_OWNER_ROLE');
        }

        // 更新角色
        const member = project.members.find(m => m.userId === targetUserId);
        if (!member) {
            throw new TCErrors.TCError('用户不是项目成员', 'NOT_MEMBER');
        }

        member.role = newRole;
        project.updatedAt = Date.now();
        project.version = (project.version || 1) + 1;

        await this.storage.saveProject(project);
    }

    /**
     * 获取用户的项目列表
     * @param {string} userId - 用户 ID
     * @returns {Promise<Array>} 项目列表（已解密）
     */
    async getUserProjects(userId) {
        const projects = await this.indexManager.getUserProjects(userId);

        // 解密项目名称
        const decryptedProjects = await Promise.all(
            projects.map(async (project) => ({
                ...project,
                name: await this.crypto.decrypt(project.name),
                description: project.description ? await this.crypto.decrypt(project.description) : ''
            }))
        );

        return decryptedProjects;
    }

    /**
     * 重新生成邀请码
     * @param {string} projectId - 项目 ID
     * @param {string} userId - 操作者 ID
     * @returns {Promise<string>} 新邀请码
     */
    async regenerateInviteCode(projectId, userId) {
        const project = await this.storage.loadProject(projectId);

        if (!project) {
            throw new TCErrors.TCError('项目不存在', 'NOT_FOUND');
        }

        this.permission.assertPermission(
            this.permission.canEditProject(userId, project),
            '重新生成邀请码'
        );

        // 使旧邀请码失效
        const oldInviteData = await this.storage.loadInviteCode(project.inviteCode);
        if (oldInviteData) {
            oldInviteData.status = 'revoked';
            await this.storage.saveInviteCode(project.inviteCode, oldInviteData);
        }

        // 生成新邀请码
        const newInviteCode = this.generateInviteCode();
        project.inviteCode = newInviteCode;
        project.updatedAt = Date.now();
        project.version = (project.version || 1) + 1;

        // 保存新邀请码索引
        await this.storage.saveInviteCode(newInviteCode, {
            projectId: project.id,
            expiresAt: null,
            maxUses: null,
            usedCount: 0,
            status: 'active'
        });

        await this.storage.saveProject(project);

        return newInviteCode;
    }
}

// 导出
window.TCProjectService = ProjectService;

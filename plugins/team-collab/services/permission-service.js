/**
 * 团队协作插件 - 权限服务
 */

class PermissionService {
    constructor(storage, eventBus) {
        this.storage = storage;
        this.eventBus = eventBus;
    }

    /**
     * 检查用户是否是项目成员
     * @param {string} userId - 用户 ID
     * @param {Object} project - 项目对象
     * @returns {Object|null} 成员信息，如果不是成员则返回 null
     */
    getMemberRole(userId, project) {
        if (!project || !project.members) return null;
        return project.members.find(m => m.userId === userId) || null;
    }

    /**
     * 检查用户是否可以查看项目
     * @param {string} userId - 用户 ID
     * @param {Object} project - 项目对象
     * @returns {boolean}
     */
    canViewProject(userId, project) {
        const member = this.getMemberRole(userId, project);
        return member !== null;
    }

    /**
     * 检查用户是否可以编辑项目
     * @param {string} userId - 用户 ID
     * @param {Object} project - 项目对象
     * @returns {boolean}
     */
    canEditProject(userId, project) {
        const member = this.getMemberRole(userId, project);
        if (!member) return false;
        return ['owner', 'admin'].includes(member.role);
    }

    /**
     * 检查用户是否可以邀请成员
     * @param {string} userId - 用户 ID
     * @param {Object} project - 项目对象
     * @returns {boolean}
     */
    canInviteMembers(userId, project) {
        const member = this.getMemberRole(userId, project);
        if (!member) return false;
        return ['owner', 'admin'].includes(member.role);
    }

    /**
     * 检查用户是否可以管理成员角色
     * @param {string} userId - 用户 ID
     * @param {Object} project - 项目对象
     * @returns {boolean}
     */
    canManageRoles(userId, project) {
        const member = this.getMemberRole(userId, project);
        if (!member) return false;
        return member.role === 'owner';
    }

    /**
     * 检查用户是否可以归档项目
     * @param {string} userId - 用户 ID
     * @param {Object} project - 项目对象
     * @returns {boolean}
     */
    canArchiveProject(userId, project) {
        const member = this.getMemberRole(userId, project);
        if (!member) return false;
        return member.role === 'owner';
    }

    /**
     * 检查用户是否可以删除项目
     * @param {string} userId - 用户 ID
     * @param {Object} project - 项目对象
     * @returns {boolean}
     */
    canDeleteProject(userId, project) {
        const member = this.getMemberRole(userId, project);
        if (!member) return false;
        return member.role === 'owner';
    }

    /**
     * 检查用户是否可以创建任务
     * @param {string} userId - 用户 ID
     * @param {Object} project - 项目对象
     * @returns {boolean}
     */
    canCreateTask(userId, project) {
        const member = this.getMemberRole(userId, project);
        if (!member) return false;
        return ['owner', 'admin', 'member'].includes(member.role);
    }

    /**
     * 检查用户是否可以查看任务
     * @param {string} userId - 用户 ID
     * @param {Object} task - 任务对象
     * @param {Object} project - 项目对象
     * @returns {boolean}
     */
    canViewTask(userId, task, project) {
        const member = this.getMemberRole(userId, project);
        if (!member) return false;

        // owner 和 admin 可以查看所有任务
        if (['owner', 'admin'].includes(member.role)) return true;

        // 根据可见性判断
        if (task.visibility === 'project') return true;
        if (task.visibility === 'private') {
            return [task.createdBy, ...(task.assigneeIds || [])].includes(userId);
        }
        if (task.visibility === 'custom') {
            return (task.aclUserIds || []).includes(userId);
        }

        return false;
    }

    /**
     * 检查用户是否可以编辑任务
     * @param {string} userId - 用户 ID
     * @param {Object} task - 任务对象
     * @param {Object} project - 项目对象
     * @returns {boolean}
     */
    canEditTask(userId, task, project) {
        const member = this.getMemberRole(userId, project);
        if (!member) return false;

        // owner 和 admin 可以编辑所有任务
        if (['owner', 'admin'].includes(member.role)) return true;

        // 创建者可以编辑自己的任务
        if (task.createdBy === userId) return true;

        // 负责人可以编辑分配给自己的任务
        if (task.assigneeIds?.includes(userId)) return true;

        return false;
    }

    /**
     * 检查用户是否可以删除任务
     * @param {string} userId - 用户 ID
     * @param {Object} task - 任务对象
     * @param {Object} project - 项目对象
     * @returns {boolean}
     */
    canDeleteTask(userId, task, project) {
        const member = this.getMemberRole(userId, project);
        if (!member) return false;

        // owner 和 admin 可以删除任务
        if (['owner', 'admin'].includes(member.role)) return true;

        // 创建者可以删除自己的任务
        if (task.createdBy === userId) return true;

        return false;
    }

    /**
     * 检查用户是否可以评论任务
     * @param {string} userId - 用户 ID
     * @param {Object} task - 任务对象
     * @param {Object} project - 项目对象
     * @returns {boolean}
     */
    canCommentTask(userId, task, project) {
        // 首先检查是否可以查看任务
        if (!this.canViewTask(userId, task, project)) return false;

        const member = this.getMemberRole(userId, project);
        return ['owner', 'admin', 'member'].includes(member.role);
    }

    /**
     * 检查用户是否可以导出项目
     * @param {string} userId - 用户 ID
     * @param {Object} project - 项目对象
     * @returns {boolean}
     */
    canExportProject(userId, project) {
        const member = this.getMemberRole(userId, project);
        if (!member) return false;
        return ['owner', 'admin'].includes(member.role);
    }

    /**
     * 断言用户有权限执行操作
     * @param {boolean} hasPermission - 权限检查结果
     * @param {string} action - 操作描述
     * @throws {PermissionError}
     */
    assertPermission(hasPermission, action) {
        if (!hasPermission) {
            throw new TCErrors.PermissionError(`没有权限执行操作: ${action}`);
        }
    }
}

// 导出
window.TCPermissionService = PermissionService;

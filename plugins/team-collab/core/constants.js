/**
 * 团队协作插件 - 常量定义
 */

// 存储键前缀
const STORAGE_PREFIX = 'plugin:shared:team-collab';
const USER_STORAGE_PREFIX = 'plugin';

// 对象 ID 前缀
const ID_PREFIX = {
    PROJECT: 'proj',
    TASK: 'task',
    PLAN: 'plan',
    THREAD: 'thread',
    COMMENT: 'comment',
    NOTIFICATION: 'notif',
    ACTIVITY: 'act',
    ATTACHMENT: 'att'
};

// 项目角色
const PROJECT_ROLE = {
    OWNER: 'owner',
    ADMIN: 'admin',
    MEMBER: 'member',
    GUEST: 'guest'
};

// 任务状态
const TASK_STATUS = {
    TODO: 'todo',
    DOING: 'doing',
    REVIEW: 'review',
    DONE: 'done'
};

// 任务优先级
const TASK_PRIORITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent'
};

// 可见性级别
const VISIBILITY = {
    PROJECT: 'project',
    PRIVATE: 'private',
    CUSTOM: 'custom'
};

// 事件名称
const EVENTS = {
    PROJECT_CREATED: 'project.created',
    PROJECT_ARCHIVED: 'project.archived',
    MEMBER_JOINED: 'member.joined',
    MEMBER_LEFT: 'member.left',
    TASK_CREATED: 'task.created',
    TASK_ASSIGNED: 'task.assigned',
    TASK_STATUS_CHANGED: 'task.status.changed',
    TASK_COMPLETED: 'task.completed',
    TASK_DELETED: 'task.deleted',
    COMMENT_ADDED: 'comment.added',
    MENTION_CREATED: 'mention.created',
    ATTACHMENT_UPLOADED: 'attachment.uploaded',
    PLAN_SUBMITTED: 'plan.submitted',
    PROJECT_EXPORTED: 'project.exported',
    NOTIFICATION_RECEIVED: 'notification.received'
};

// 通知类型
const NOTIFICATION_TYPE = {
    TASK_ASSIGNED: 'task_assigned',
    TASK_DUE_SOON: 'task_due_soon',
    TASK_OVERDUE: 'task_overdue',
    COMMENT_MENTION: 'comment_mention',
    COMMENT_REPLY: 'comment_reply',
    PLAN_SUBMISSION: 'plan_submission',
    PROJECT_INVITED: 'project_invited'
};

// 学习计划模板类型
const PLAN_TEMPLATE_TYPE = {
    TECH_STUDY: 'tech-study',
    ONBOARDING: 'onboarding',
    READING: 'reading',
    TECH_SHARE: 'tech-share',
    CUSTOM: 'custom'
};

// 导出模式
const EXPORT_MODE = {
    ENCRYPTED: 'encrypted',
    PLAINTEXT: 'plaintext'
};

// 导入模式
const IMPORT_MODE = {
    CREATE: 'create',
    OVERWRITE: 'overwrite',
    MERGE: 'merge'
};

// 每页数量
const PAGE_SIZE = {
    COMMENTS: 50,
    ACTIVITIES: 100,
    TASKS: 50
};

// 评论线程状态
const THREAD_STATUS = {
    OPEN: 'open',
    RESOLVED: 'resolved'
};

// Schema 版本
const SCHEMA_VERSION = '3.0.0';

// 导出常量
window.TCConstants = {
    STORAGE_PREFIX,
    USER_STORAGE_PREFIX,
    ID_PREFIX,
    PROJECT_ROLE,
    TASK_STATUS,
    TASK_PRIORITY,
    VISIBILITY,
    EVENTS,
    NOTIFICATION_TYPE,
    PLAN_TEMPLATE_TYPE,
    EXPORT_MODE,
    IMPORT_MODE,
    PAGE_SIZE,
    THREAD_STATUS,
    SCHEMA_VERSION
};

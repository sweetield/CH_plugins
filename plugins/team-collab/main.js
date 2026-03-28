/**
 * 团队协作插件
 * 版本: 1.0.0
 * 所有模块合并到单文件
 */

(function() {
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
/**
 * 团队协作插件 - 错误类定义
 */

class TCError extends Error {
    constructor(message, code, details = null) {
        super(message);
        this.name = 'TCError';
        this.code = code;
        this.details = details;
    }
}

// 权限错误
class PermissionError extends TCError {
    constructor(message, details = null) {
        super(message, 'PERMISSION_DENIED', details);
        this.name = 'PermissionError';
    }
}

// 存储错误
class StorageError extends TCError {
    constructor(message, details = null) {
        super(message, 'STORAGE_ERROR', details);
        this.name = 'StorageError';
    }
}

// 加密错误
class CryptoError extends TCError {
    constructor(message, details = null) {
        super(message, 'CRYPTO_ERROR', details);
        this.name = 'CryptoError';
    }
}

// 验证错误
class ValidationError extends TCError {
    constructor(message, details = null) {
        super(message, 'VALIDATION_ERROR', details);
        this.name = 'ValidationError';
    }
}

// 邀请码错误
class InviteError extends TCError {
    constructor(message, details = null) {
        super(message, 'INVITE_ERROR', details);
        this.name = 'InviteError';
    }
}

// 导入导出错误
class ImportExportError extends TCError {
    constructor(message, details = null) {
        super(message, 'IMPORT_EXPORT_ERROR', details);
        this.name = 'ImportExportError';
    }
}

// 冲突错误
class ConflictError extends TCError {
    constructor(message, details = null) {
        super(message, 'CONFLICT_ERROR', details);
        this.name = 'ConflictError';
    }
}

// 导出
window.TCErrors = {
    TCError,
    PermissionError,
    StorageError,
    CryptoError,
    ValidationError,
    InviteError,
    ImportExportError,
    ConflictError
};
/**
 * 团队协作插件 - 事件总线
 * 用于组件间解耦通信
 */

class EventBus {
    constructor() {
        this.listeners = new Map();
        this.onceListeners = new Map();
    }

    /**
     * 监听事件
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     * @returns {Function} 取消监听的函数
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);

        // 返回取消监听的函数
        return () => this.off(event, callback);
    }

    /**
     * 监听事件一次
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     */
    once(event, callback) {
        if (!this.onceListeners.has(event)) {
            this.onceListeners.set(event, new Set());
        }
        this.onceListeners.get(event).add(callback);
    }

    /**
     * 取消监听
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     */
    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
        if (this.onceListeners.has(event)) {
            this.onceListeners.get(event).delete(callback);
        }
    }

    /**
     * 触发事件
     * @param {string} event - 事件名称
     * @param {*} data - 事件数据
     */
    emit(event, data = null) {
        // 执行普通监听器
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`EventBus: 事件 ${event} 的监听器执行出错`, error);
                }
            });
        }

        // 执行一次性监听器
        if (this.onceListeners.has(event)) {
            const onceSet = this.onceListeners.get(event);
            onceSet.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`EventBus: 事件 ${event} 的一次性监听器执行出错`, error);
                }
            });
            // 清除一次性监听器
            onceSet.clear();
        }
    }

    /**
     * 清除所有监听器
     */
    clear() {
        this.listeners.clear();
        this.onceListeners.clear();
    }

    /**
     * 清除指定事件的所有监听器
     * @param {string} event - 事件名称
     */
    clearEvent(event) {
        this.listeners.delete(event);
        this.onceListeners.delete(event);
    }
}

// 导出
window.TCEventBus = EventBus;
/**
 * 团队协作插件 - 工具函数
 */

/**
 * 生成唯一 ID
 * @param {string} prefix - ID 前缀
 * @returns {string}
 */
function generateId(prefix) {
    const C = window.TCConstants;
    const prefixMap = {
        'project': C.ID_PREFIX.PROJECT,
        'task': C.ID_PREFIX.TASK,
        'plan': C.ID_PREFIX.PLAN,
        'thread': C.ID_PREFIX.THREAD,
        'comment': C.ID_PREFIX.COMMENT,
        'notification': C.ID_PREFIX.NOTIFICATION,
        'activity': C.ID_PREFIX.ACTIVITY,
        'attachment': C.ID_PREFIX.ATTACHMENT
    };
    const p = prefixMap[prefix] || prefix;
    return `${p}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 格式化日期
 * @param {number} timestamp - 时间戳
 * @returns {string}
 */
function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diff = Math.floor((target - today) / 86400000);

    if (diff === 0) return '今天';
    if (diff === 1) return '明天';
    if (diff === -1) return '昨天';
    if (diff < -1) return `${Math.abs(diff)}天前`;
    if (diff <= 7) return `${diff}天后`;

    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

/**
 * 格式化完整日期时间
 * @param {number} timestamp - 时间戳
 * @returns {string}
 */
function formatDateTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * 格式化相对时间
 * @param {number} timestamp - 时间戳
 * @returns {string}
 */
function formatRelativeTime(timestamp) {
    if (!timestamp) return '';
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 30) return `${days}天前`;

    return formatDateTime(timestamp);
}

/**
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function}
 */
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * 节流函数
 * @param {Function} func - 要节流的函数
 * @param {number} limit - 限制时间（毫秒）
 * @returns {Function}
 */
function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * 安全的 JSON 解析
 * @param {string} str - JSON 字符串
 * @param {*} defaultValue - 默认值
 * @returns {*}
 */
function safeJsonParse(str, defaultValue = null) {
    try {
        return JSON.parse(str);
    } catch {
        return defaultValue;
    }
}

/**
 * 截断文本
 * @param {string} text - 原始文本
 * @param {number} maxLength - 最大长度
 * @returns {string}
 */
function truncateText(text, maxLength = 50) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * 转义 HTML
 * @param {string} str - 原始字符串
 * @returns {string}
 */
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * 获取任务优先级颜色
 * @param {string} priority - 优先级
 * @returns {string}
 */
function getPriorityColor(priority) {
    const C = window.TCConstants;
    const colors = {
        [C.TASK_PRIORITY.LOW]: '#6b7280',
        [C.TASK_PRIORITY.MEDIUM]: '#3b82f6',
        [C.TASK_PRIORITY.HIGH]: '#f59e0b',
        [C.TASK_PRIORITY.URGENT]: '#ef4444'
    };
    return colors[priority] || colors[C.TASK_PRIORITY.MEDIUM];
}

/**
 * 获取任务优先级标签
 * @param {string} priority - 优先级
 * @returns {string}
 */
function getPriorityLabel(priority) {
    const C = window.TCConstants;
    const labels = {
        [C.TASK_PRIORITY.LOW]: '低',
        [C.TASK_PRIORITY.MEDIUM]: '中',
        [C.TASK_PRIORITY.HIGH]: '高',
        [C.TASK_PRIORITY.URGENT]: '紧急'
    };
    return labels[priority] || labels[C.TASK_PRIORITY.MEDIUM];
}

/**
 * 获取任务状态标签
 * @param {string} status - 状态
 * @returns {string}
 */
function getStatusLabel(status) {
    const C = window.TCConstants;
    const labels = {
        [C.TASK_STATUS.TODO]: '待办',
        [C.TASK_STATUS.DOING]: '进行中',
        [C.TASK_STATUS.REVIEW]: '审核中',
        [C.TASK_STATUS.DONE]: '已完成'
    };
    return labels[status] || labels[C.TASK_STATUS.TODO];
}

// 导出
window.TCUtils = {
    generateId,
    formatDate,
    formatDateTime,
    formatRelativeTime,
    debounce,
    throttle,
    safeJsonParse,
    truncateText,
    escapeHtml,
    getPriorityColor,
    getPriorityLabel,
    getStatusLabel
};
/**
 * 团队协作插件 - Markdown 渲染器
 * 支持常用 Markdown 语法，带 HTML 安全过滤
 */

class MarkdownRenderer {
    constructor() {
        // 允许的 HTML 标签白名单
        this.allowedTags = [
            'p', 'br', 'strong', 'b', 'em', 'i', 'del', 's',
            'code', 'pre', 'blockquote',
            'ul', 'ol', 'li',
            'a', 'img',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'table', 'thead', 'tbody', 'tr', 'th', 'td',
            'hr'
        ];

        // 允许的属性
        this.allowedAttributes = {
            'a': ['href', 'title', 'target'],
            'img': ['src', 'alt', 'title', 'width', 'height'],
            'code': ['class'],
            'pre': ['class'],
            'td': ['align'],
            'th': ['align']
        };
    }

    /**
     * 渲染 Markdown 为 HTML
     * @param {string} text - Markdown 文本
     * @returns {string} HTML
     */
    render(text) {
        if (!text) return '';

        let html = text;

        // 预处理：转义 HTML
        html = this.escapeHtml(html);

        // 代码块（```language\ncode\n```）
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            const langClass = lang ? ` class="language-${lang}"` : '';
            return `<pre><code${langClass}>${code.trim()}</code></pre>`;
        });

        // 行内代码（`code`）
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // 标题（# - ######）
        html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
        html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
        html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
        html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

        // 粗体 + 斜体（***text***）
        html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');

        // 粗体（**text**）
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // 斜体（*text*）
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // 删除线（~~text~~）
        html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');

        // 链接（[text](url)）
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
            const safeUrl = this.sanitizeUrl(url);
            return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`;
        });

        // 图片（![alt](url)）
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
            const safeUrl = this.sanitizeUrl(url);
            return `<img src="${safeUrl}" alt="${alt}" style="max-width:100%;">`;
        });

        // 引用（> text）
        html = html.replace(/^>\s*(.+)$/gm, '<blockquote>$1</blockquote>');
        // 合并连续的 blockquote
        html = html.replace(/<\/blockquote>\s*<blockquote>/g, '<br>');

        // 水平线（--- 或 ***）
        html = html.replace(/^(-{3,}|\*{3,})$/gm, '<hr>');

        // 无序列表（- item 或 * item）
        html = html.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');

        // 有序列表（1. item）
        html = html.replace(/^\d+\.\s+(.+)$/gm, '<oli>$1</oli>');

        // 包装连续的 li 为 ul
        html = this.wrapListItems(html, 'li', 'ul');
        html = this.wrapListItems(html, 'oli', 'ol');

        // 段落处理：将连续的非标签文本包装为 p 标签
        html = this.wrapParagraphs(html);

        // 换行处理
        html = html.replace(/\n/g, '<br>');

        return html;
    }

    /**
     * 安全渲染（失败时返回转义的原文）
     * @param {string} text - Markdown 文本
     * @returns {string} HTML
     */
    renderSafe(text) {
        try {
            return this.render(text);
        } catch (error) {
            console.error('[MarkdownRenderer] 渲染失败:', error);
            return this.escapeHtml(text);
        }
    }

    /**
     * 转义 HTML
     * @param {string} str - 原始字符串
     * @returns {string}
     */
    escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * 清理 URL
     * @param {string} url - 原始 URL
     * @returns {string}
     */
    sanitizeUrl(url) {
        if (!url) return '#';
        const trimmed = url.trim().toLowerCase();
        // 禁止 javascript: 和 data: 协议
        if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:')) {
            return '#';
        }
        return url;
    }

    /**
     * 包装列表项
     * @param {string} html - HTML
     * @param {string} itemTag - 列表项标签
     * @param {string} listTag - 列表标签
     * @returns {string}
     */
    wrapListItems(html, itemTag, listTag) {
        const regex = new RegExp(`(<${itemTag}>.*?</${itemTag}>\n?)+`, 'g');
        return html.replace(regex, (match) => {
            const items = match.replace(new RegExp(itemTag, 'g'), 'li');
            return `<${listTag}>${items}</${listTag}>`;
        });
    }

    /**
     * 包装段落
     * @param {string} html - HTML
     * @returns {string}
     */
    wrapParagraphs(html) {
        // 简单实现：不处理，依赖 CSS 和 br 标签
        return html;
    }

    /**
     * 检查文本是否包含 Markdown 语法
     * @param {string} text - 文本
     * @returns {boolean}
     */
    hasMarkdown(text) {
        if (!text) return false;

        const patterns = [
            /\*\*[^*]+\*\*/,        // 粗体
            /\*[^*]+\*/,            // 斜体
            /~~[^~]+~~/,            // 删除线
            /`[^`]+`/,              // 行内代码
            /```[\s\S]*```/,        // 代码块
            /\[[^\]]+\]\([^)]+\)/,  // 链接
            /!\[[^\]]*\]\([^)]+\)/, // 图片
            /^>\s/m,                // 引用
            /^#{1,6}\s/m,           // 标题
            /^[-*]\s/m,             // 无序列表
            /^\d+\.\s/m             // 有序列表
        ];

        return patterns.some(p => p.test(text));
    }

    /**
     * 获取纯文本（去除 Markdown 语法）
     * @param {string} text - Markdown 文本
     * @returns {string}
     */
    toPlainText(text) {
        if (!text) return '';

        let plain = text;

        // 移除代码块
        plain = plain.replace(/```[\s\S]*?```/g, '[代码块]');

        // 移除行内代码
        plain = plain.replace(/`([^`]+)`/g, '$1');

        // 移除标题标记
        plain = plain.replace(/^#{1,6}\s+/gm, '');

        // 移除粗体
        plain = plain.replace(/\*\*([^*]+)\*\*/g, '$1');

        // 移除斜体
        plain = plain.replace(/\*([^*]+)\*/g, '$1');

        // 移除删除线
        plain = plain.replace(/~~([^~]+)~~/g, '$1');

        // 移除链接，保留文字
        plain = plain.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

        // 移除图片
        plain = plain.replace(/!\[[^\]]*\]\([^)]+\)/g, '[图片]');

        // 移除引用标记
        plain = plain.replace(/^>\s*/gm, '');

        // 移除列表标记
        plain = plain.replace(/^[-*]\s+/gm, '');
        plain = plain.replace(/^\d+\.\s+/gm, '');

        return plain.trim();
    }

    /**
     * 渲染为纯文本预览
     * @param {string} text - Markdown 文本
     * @param {number} maxLength - 最大长度
     * @returns {string}
     */
    renderPreview(text, maxLength = 100) {
        const plain = this.toPlainText(text);
        if (plain.length <= maxLength) return plain;
        return plain.substring(0, maxLength) + '...';
    }
}

// 导出
window.TCMarkdownRenderer = MarkdownRenderer;
/**
 * 团队协作插件 - 加密管理器
 * 使用 AES-GCM 加密，与系统 worker.js 保持一致
 */

class CryptoManager {
    constructor() {
        this.encryptionKey = null;
    }

    /**
     * 初始化：获取系统加密密钥
     * @param {Object} api - 插件 SDK API
     */
    async init(api) {
        try {
            const basePath = typeof top_level_path !== 'undefined' ? top_level_path : '';
            const response = await api.http.get(basePath + '/api/get_encryption_key');
            this.encryptionKey = response.key;
            console.log('[CryptoManager] 加密密钥初始化成功');
        } catch (error) {
            console.error('[CryptoManager] 获取加密密钥失败:', error);
            throw new TCErrors.CryptoError('获取加密密钥失败', error);
        }
    }

    /**
     * 派生 AES-256 密钥
     * 与系统 worker.js 保持一致
     * @param {string} password - 密码
     * @returns {Promise<CryptoKey>}
     */
    async deriveKey(password) {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);

        return await crypto.subtle.importKey(
            'raw',
            hashBuffer.slice(0, 32), // 前 32 字节作为 AES-256 密钥
            'AES-GCM',
            false,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * 加密文本
     * @param {string} plainText - 明文
     * @returns {Promise<string>} Base64 编码的密文
     */
    async encrypt(plainText) {
        if (!this.encryptionKey) {
            throw new TCErrors.CryptoError('加密密钥未初始化');
        }

        try {
            const key = await this.deriveKey(this.encryptionKey);
            const iv = crypto.getRandomValues(new Uint8Array(12)); // 12 字节随机 IV
            const encoder = new TextEncoder();
            const data = encoder.encode(plainText);

            const encryptedBuffer = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                key,
                data
            );

            // 合并 IV 和密文
            const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encryptedBuffer), iv.length);

            // 转换为 Base64
            return btoa(String.fromCharCode(...combined));
        } catch (error) {
            console.error('[CryptoManager] 加密失败:', error);
            throw new TCErrors.CryptoError('加密失败', error);
        }
    }

    /**
     * 解密文本
     * @param {string} encryptedBase64 - Base64 编码的密文
     * @returns {Promise<string>} 明文
     */
    async decrypt(encryptedBase64) {
        if (!this.encryptionKey) {
            throw new TCErrors.CryptoError('加密密钥未初始化');
        }

        if (!encryptedBase64) {
            return '';
        }

        try {
            const key = await this.deriveKey(this.encryptionKey);
            const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

            // 分离 IV 和密文
            const iv = combined.slice(0, 12);
            const encryptedData = combined.slice(12);

            const decryptedBuffer = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                key,
                encryptedData
            );

            const decoder = new TextDecoder();
            return decoder.decode(decryptedBuffer);
        } catch (error) {
            console.error('[CryptoManager] 解密失败:', error);
            throw new TCErrors.CryptoError('解密失败', error);
        }
    }

    /**
     * 加密对象（JSON 序列化后加密）
     * @param {Object} obj - 要加密的对象
     * @returns {Promise<string>} Base64 编码的密文
     */
    async encryptObject(obj) {
        const json = JSON.stringify(obj);
        return await this.encrypt(json);
    }

    /**
     * 解密对象（解密后 JSON 解析）
     * @param {string} encryptedBase64 - Base64 编码的密文
     * @returns {Promise<Object>} 解密后的对象
     */
    async decryptObject(encryptedBase64) {
        if (!encryptedBase64) {
            return null;
        }
        const json = await this.decrypt(encryptedBase64);
        return JSON.parse(json);
    }

    /**
     * 加密文件（ArrayBuffer）
     * @param {ArrayBuffer} arrayBuffer - 文件内容
     * @returns {Promise<Uint8Array>} 加密后的字节数组
     */
    async encryptFile(arrayBuffer) {
        if (!this.encryptionKey) {
            throw new TCErrors.CryptoError('加密密钥未初始化');
        }

        const key = await this.deriveKey(this.encryptionKey);
        const iv = crypto.getRandomValues(new Uint8Array(12));

        const encryptedBuffer = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            arrayBuffer
        );

        // 合并 IV 和密文
        const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encryptedBuffer), iv.length);

        return combined;
    }

    /**
     * 解密文件（返回 ArrayBuffer）
     * @param {Uint8Array} encryptedBytes - 加密的字节数组
     * @returns {Promise<ArrayBuffer>} 解密后的文件内容
     */
    async decryptFile(encryptedBytes) {
        if (!this.encryptionKey) {
            throw new TCErrors.CryptoError('加密密钥未初始化');
        }

        const key = await this.deriveKey(this.encryptionKey);

        // 分离 IV 和密文
        const iv = encryptedBytes.slice(0, 12);
        const encryptedData = encryptedBytes.slice(12);

        return await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            encryptedData
        );
    }

    /**
     * 生成搜索摘要（用于加密字段的搜索）
     * @param {string} text - 原始文本
     * @returns {string} 归一化的搜索摘要
     */
    createSearchDigest(text) {
        if (!text) return '';
        return text.toLowerCase().trim().replace(/\s+/g, ' ');
    }

    /**
     * 加密或创建索引（用于需要搜索的字段）
     * @param {string} text - 原始文本
     * @returns {Promise<Object>} { encrypted, digest }
     */
    async encryptWithIndex(text) {
        const encrypted = await this.encrypt(text);
        const digest = this.createSearchDigest(text);
        return { encrypted, digest };
    }
}

// 导出
window.TCCryptoManager = CryptoManager;
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
            usedCount: 0,
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
/**
 * 团队协作插件 - 面板组件
 */

class Panel {
    constructor(api) {
        this.api = api;
        this.panel = null;
        this.isOpen = false;
        this.currentView = 'sidebar'; // sidebar, tasks, plans, inbox
    }

    /**
     * 创建面板
     */
    create() {
        this.panel = document.createElement('div');
        this.panel.className = 'tc-panel';
        this.panel.innerHTML = `
            <div class="tc-panel-header">
                <div class="tc-panel-title">👥 团队协作</div>
                <button class="tc-panel-close" id="tc-close-panel">×</button>
            </div>
            <div class="tc-panel-body" id="tc-panel-body">
                <div class="tc-sidebar" id="tc-sidebar">
                    <!-- 侧边栏内容 -->
                </div>
                <div class="tc-main-content" id="tc-main-content">
                    <!-- 主内容区域 -->
                </div>
            </div>
        `;

        document.body.appendChild(this.panel);

        // 绑定关闭按钮
        document.getElementById('tc-close-panel').addEventListener('click', () => {
            this.close();
        });
    }

    /**
     * 打开面板
     */
    open() {
        if (this.panel) {
            this.panel.classList.add('open');
            this.isOpen = true;
        }
    }

    /**
     * 关闭面板
     */
    close() {
        if (this.panel) {
            this.panel.classList.remove('open');
            this.isOpen = false;
        }
    }

    /**
     * 切换面板
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * 设置主内容区域
     * @param {string} html - HTML 内容
     */
    setContent(html) {
        const mainContent = document.getElementById('tc-main-content');
        if (mainContent) {
            mainContent.innerHTML = html;
        }
    }

    /**
     * 设置侧边栏内容
     * @param {string} html - HTML 内容
     */
    setSidebarContent(html) {
        const sidebar = document.getElementById('tc-sidebar');
        if (sidebar) {
            sidebar.innerHTML = html;
        }
    }

    /**
     * 获取主内容区域
     * @returns {HTMLElement}
     */
    getBody() {
        return document.getElementById('tc-main-content');
    }

    /**
     * 获取侧边栏区域
     * @returns {HTMLElement}
     */
    getSidebar() {
        return document.getElementById('tc-sidebar');
    }

    /**
     * 显示加载状态
     */
    showLoading() {
        this.setContent(`
            <div class="tc-loading">
                <div class="tc-loading-spinner"></div>
                <div class="tc-loading-text">加载中...</div>
            </div>
        `);
    }

    /**
     * 显示空状态
     * @param {string} icon - 图标
     * @param {string} title - 标题
     * @param {string} description - 描述
     * @param {Array} actions - 操作按钮
     */
    showEmpty(icon, title, description, actions = []) {
        const actionsHtml = actions.map(action =>
            `<button class="tc-btn ${action.primary ? 'tc-btn-primary' : 'tc-btn-secondary'}" 
                     onclick="${action.onClick}">${action.label}</button>`
        ).join('');

        this.setContent(`
            <div class="tc-empty-state">
                <div class="tc-empty-icon">${icon}</div>
                <div class="tc-empty-title">${title}</div>
                <div class="tc-empty-description">${description}</div>
                ${actionsHtml ? `<div class="tc-empty-actions">${actionsHtml}</div>` : ''}
            </div>
        `);
    }

    /**
     * 销毁面板
     */
    destroy() {
        if (this.panel) {
            this.panel.remove();
            this.panel = null;
        }
    }
}

// 导出
window.TCPanel = Panel;
/**
 * 团队协作插件 - 侧边栏组件
 */

class Sidebar {
    constructor(panel, projectService, indexManager, crypto, eventBus, importExportService, notificationService) {
        this.panel = panel;
        this.projectService = projectService;
        this.indexManager = indexManager;
        this.crypto = crypto;
        this.eventBus = eventBus;
        this.importExportService = importExportService;
        this.notificationService = notificationService;
        this.currentUserId = null;
        this.currentProjectId = null;
    }

    /**
     * 初始化
     * @param {string} userId - 当前用户 ID
     */
    async init(userId) {
        this.currentUserId = userId;
        await this.render();
    }

    /**
     * 渲染侧边栏
     */
    async render() {
        const projects = await this.projectService.getUserProjects(this.currentUserId);
        const hasProjects = projects.length > 0;

        if (!hasProjects) {
            this.renderEmptyState();
            return;
        }

        // 如果没有选中项目，默认选中第一个
        if (!this.currentProjectId && projects.length > 0) {
            this.currentProjectId = projects[0].id;
        }

        const html = `
            <!-- 项目选择器 -->
            <div class="tc-sidebar-section">
                <div class="tc-project-selector">
                    <select class="tc-project-select" id="tc-project-select">
                        ${projects.map(p => `
                            <option value="${p.id}" ${p.id === this.currentProjectId ? 'selected' : ''}>
                                ${window.TCUtils.escapeHtml(p.name)}
                            </option>
                        `).join('')}
                    </select>
                </div>
            </div>

            <!-- 模块导航 -->
            <div class="tc-sidebar-section">
                <div class="tc-sidebar-title">模块</div>
                <div class="tc-nav-list">
                    <div class="tc-nav-item active" data-view="tasks">
                        <span class="tc-nav-icon">📋</span>
                        <span class="tc-nav-label">任务中心</span>
                        <span class="tc-nav-badge" id="tc-task-count">0</span>
                    </div>
                    <div class="tc-nav-item" data-view="plans">
                        <span class="tc-nav-icon">📚</span>
                        <span class="tc-nav-label">学习计划</span>
                    </div>
                    <div class="tc-nav-item" data-view="inbox">
                        <span class="tc-nav-icon">📥</span>
                        <span class="tc-nav-label">收件箱</span>
                        <span class="tc-nav-badge" id="tc-inbox-count" style="display:none;">0</span>
                    </div>
                    <div class="tc-nav-item" data-view="activity">
                        <span class="tc-nav-icon">📊</span>
                        <span class="tc-nav-label">活动流</span>
                    </div>
                    <div class="tc-nav-item" data-view="project-settings">
                        <span class="tc-nav-icon">⚙️</span>
                        <span class="tc-nav-label">项目设置</span>
                    </div>
                </div>
            </div>

            <!-- 数据管理 -->
            <div class="tc-sidebar-section">
                <div class="tc-sidebar-title">数据管理</div>
                <div class="tc-nav-list">
                    <div class="tc-nav-item" id="tc-import-btn">
                        <span class="tc-nav-icon">📥</span>
                        <span class="tc-nav-label">导入项目</span>
                    </div>
                    <div class="tc-nav-item" id="tc-export-btn">
                        <span class="tc-nav-icon">📤</span>
                        <span class="tc-nav-label">导出项目</span>
                    </div>
                </div>
            </div>

            <!-- 操作按钮 -->
            <div class="tc-sidebar-section tc-sidebar-actions">
                <button class="tc-btn tc-btn-primary tc-btn-block" id="tc-create-project-btn">
                    + 创建新项目
                </button>
                <button class="tc-btn tc-btn-secondary tc-btn-block" id="tc-join-project-btn">
                    通过邀请码加入
                </button>
            </div>
        `;

        this.panel.setSidebarContent(html);
        this.bindEvents();
        this.updateTaskCount();
        this.updateInboxCount();
    }

    /**
     * 渲染空状态
     */
    renderEmptyState() {
        const html = `
            <div class="tc-empty-state">
                <div class="tc-empty-icon">🚀</div>
                <div class="tc-empty-title">欢迎使用团队协作</div>
                <div class="tc-empty-description">
                    创建一个新项目，或通过邀请码加入已有项目，开始团队协作之旅。
                </div>
                <div class="tc-empty-actions">
                    <button class="tc-btn tc-btn-primary" id="tc-create-project-btn">
                        创建新项目
                    </button>
                    <button class="tc-btn tc-btn-secondary" id="tc-join-project-btn">
                        通过邀请码加入
                    </button>
                    <button class="tc-btn tc-btn-secondary" id="tc-import-btn">
                        导入项目
                    </button>
                </div>
            </div>
        `;

        this.panel.setSidebarContent(html);
        this.bindEvents();
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 项目选择
        const projectSelect = document.getElementById('tc-project-select');
        if (projectSelect) {
            projectSelect.addEventListener('change', (e) => {
                this.currentProjectId = e.target.value;
                this.onProjectChange();
            });
        }

        // 导航项点击
        document.querySelectorAll('.tc-nav-item[data-view]').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('.tc-nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                this.onViewChange(item.dataset.view);
            });
        });

        // 创建项目按钮
        const createBtn = document.getElementById('tc-create-project-btn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.showCreateProjectModal());
        }

        // 加入项目按钮
        const joinBtn = document.getElementById('tc-join-project-btn');
        if (joinBtn) {
            joinBtn.addEventListener('click', () => this.showJoinProjectModal());
        }

        // 导入项目按钮
        const importBtn = document.getElementById('tc-import-btn');
        if (importBtn) {
            importBtn.addEventListener('click', () => this.showImportDialog());
        }

        // 导出项目按钮
        const exportBtn = document.getElementById('tc-export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.showExportDialog());
        }

        // 监听通知事件，更新未读数
        const C = window.TCConstants;
        this.eventBus.on(C.EVENTS.NOTIFICATION_RECEIVED, () => {
            this.updateInboxCount();
        });
    }

    /**
     * 项目切换回调
     */
    onProjectChange() {
        // 触发项目切换事件
        this.eventBus.emit('project.changed', { projectId: this.currentProjectId });
        this.updateTaskCount();
        this.updateInboxCount();
    }

    /**
     * 视图切换回调
     * @param {string} view - 视图名称
     */
    onViewChange(view) {
        // 触发视图切换事件
        this.eventBus.emit('view.changed', { view, projectId: this.currentProjectId });
    }

    /**
     * 更新任务数量
     */
    async updateTaskCount() {
        if (!this.currentProjectId) return;

        const tasks = await this.indexManager.getProjectTasks(this.currentProjectId);
        const countEl = document.getElementById('tc-task-count');
        if (countEl) {
            countEl.textContent = tasks.length;
        }
    }

    /**
     * 更新收件箱未读数量
     */
    async updateInboxCount() {
        if (!this.currentUserId || !this.notificationService) return;

        try {
            const unreadCount = await this.notificationService.getUnreadCount(this.currentUserId);
            const countEl = document.getElementById('tc-inbox-count');
            if (countEl) {
                if (unreadCount > 0) {
                    countEl.textContent = unreadCount > 99 ? '99+' : unreadCount;
                    countEl.style.display = '';
                } else {
                    countEl.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('[Sidebar] 更新收件箱未读数失败:', error);
        }
    }

    /**
     * 显示创建项目对话框
     */
    showCreateProjectModal() {
        const modal = document.createElement('div');
        modal.className = 'tc-modal open';
        modal.innerHTML = `
            <div class="tc-modal-content">
                <div class="tc-modal-header">
                    <span class="tc-modal-title">创建新项目</span>
                    <button class="tc-modal-close">×</button>
                </div>
                <div class="tc-modal-body">
                    <div class="tc-form-group">
                        <label class="tc-form-label">项目名称 *</label>
                        <input type="text" class="tc-form-input" id="tc-project-name" 
                               placeholder="输入项目名称" maxlength="50">
                    </div>
                    <div class="tc-form-group">
                        <label class="tc-form-label">项目描述</label>
                        <textarea class="tc-form-textarea" id="tc-project-description" 
                                  placeholder="输入项目描述（可选）" rows="3"></textarea>
                    </div>
                    <div class="tc-form-group">
                        <label class="tc-form-label">默认任务可见性</label>
                        <select class="tc-form-select" id="tc-project-visibility">
                            <option value="project">项目成员可见</option>
                            <option value="private">仅相关人员可见</option>
                        </select>
                    </div>
                </div>
                <div class="tc-modal-footer">
                    <button class="tc-btn tc-btn-secondary tc-modal-cancel">取消</button>
                    <button class="tc-btn tc-btn-primary" id="tc-confirm-create">创建</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 关闭按钮
        modal.querySelector('.tc-modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.tc-modal-cancel').addEventListener('click', () => modal.remove());

        // 确认创建
        modal.querySelector('#tc-confirm-create').addEventListener('click', async () => {
            const name = document.getElementById('tc-project-name').value.trim();
            const description = document.getElementById('tc-project-description').value.trim();
            const visibility = document.getElementById('tc-project-visibility').value;

            if (!name) {
                this.panel.api.ui.showToast('请输入项目名称', 'warning');
                return;
            }

            try {
                const project = await this.projectService.createProject({
                    name,
                    description,
                    visibility
                }, this.currentUserId);

                this.panel.api.ui.showToast('项目创建成功', 'success');
                modal.remove();

                // 显示邀请码弹窗
                this.showInviteCodeModal(project);

                // 刷新侧边栏
                this.currentProjectId = project.id;
                await this.render();
            } catch (error) {
                console.error('创建项目失败:', error);
                this.panel.api.ui.showToast('创建项目失败: ' + error.message, 'error');
            }
        });
    }

    /**
     * 显示邀请码弹窗
     * @param {Object} project - 项目对象
     */
    showInviteCodeModal(project) {
        const inviteModal = document.createElement('div');
        inviteModal.className = 'tc-modal open';
        inviteModal.innerHTML = `
            <div class="tc-modal-content">
                <div class="tc-modal-header">
                    <span class="tc-modal-title">项目创建成功</span>
                    <button class="tc-modal-close">×</button>
                </div>
                <div class="tc-modal-body">
                    <div class="tc-invite-code-display">
                        <div class="tc-invite-label">邀请码</div>
                        <div class="tc-invite-code">${project.inviteCode}</div>
                        <div class="tc-invite-hint">将此邀请码分享给团队成员，他们可以通过此码加入项目</div>
                    </div>
                </div>
                <div class="tc-modal-footer">
                    <button class="tc-btn tc-btn-secondary" id="tc-copy-invite-code">复制邀请码</button>
                    <button class="tc-btn tc-btn-primary tc-modal-cancel">完成</button>
                </div>
            </div>
        `;

        document.body.appendChild(inviteModal);

        // 关闭按钮
        inviteModal.querySelector('.tc-modal-close').addEventListener('click', () => inviteModal.remove());
        inviteModal.querySelector('.tc-modal-cancel').addEventListener('click', () => inviteModal.remove());

        // 复制邀请码
        inviteModal.querySelector('#tc-copy-invite-code').addEventListener('click', () => {
            navigator.clipboard.writeText(project.inviteCode).then(() => {
                this.panel.api.ui.showToast('邀请码已复制到剪贴板', 'success');
            }).catch(() => {
                this.panel.api.ui.showToast('复制失败，请手动复制', 'error');
            });
        });
    }

    /**
     * 显示加入项目对话框
     */
    showJoinProjectModal() {
        const modal = document.createElement('div');
        modal.className = 'tc-modal open';
        modal.innerHTML = `
            <div class="tc-modal-content">
                <div class="tc-modal-header">
                    <span class="tc-modal-title">通过邀请码加入项目</span>
                    <button class="tc-modal-close">×</button>
                </div>
                <div class="tc-modal-body">
                    <div class="tc-form-group">
                        <label class="tc-form-label">邀请码 *</label>
                        <input type="text" class="tc-form-input" id="tc-invite-code" 
                               placeholder="输入6位邀请码" maxlength="6" 
                               style="text-transform: uppercase; letter-spacing: 4px; font-size: 18px; text-align: center;">
                    </div>
                    <div class="tc-form-hint">
                        邀请码由项目管理员提供，通常为6位字母和数字组合
                    </div>
                </div>
                <div class="tc-modal-footer">
                    <button class="tc-btn tc-btn-secondary tc-modal-cancel">取消</button>
                    <button class="tc-btn tc-btn-primary" id="tc-confirm-join">加入</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 关闭按钮
        modal.querySelector('.tc-modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.tc-modal-cancel').addEventListener('click', () => modal.remove());

        // 确认加入
        modal.querySelector('#tc-confirm-join').addEventListener('click', async () => {
            const inviteCode = document.getElementById('tc-invite-code').value.trim().toUpperCase();

            if (!inviteCode || inviteCode.length !== 6) {
                this.panel.api.ui.showToast('请输入6位邀请码', 'warning');
                return;
            }

            try {
                const project = await this.projectService.joinProjectByInviteCode(
                    inviteCode,
                    this.currentUserId
                );

                this.panel.api.ui.showToast(`成功加入项目: ${project.name}`, 'success');
                modal.remove();

                // 刷新侧边栏
                this.currentProjectId = project.id;
                await this.render();
            } catch (error) {
                console.error('加入项目失败:', error);
                this.panel.api.ui.showToast(error.message, 'error');
            }
        });
    }

    /**
     * 显示导入对话框
     */
    showImportDialog() {
        const modal = document.createElement('div');
        modal.className = 'tc-modal open';
        modal.innerHTML = `
            <div class="tc-modal-content">
                <div class="tc-modal-header">
                    <span class="tc-modal-title">导入项目</span>
                    <button class="tc-modal-close">×</button>
                </div>
                <div class="tc-modal-body">
                    <div class="tc-form-group">
                        <label class="tc-form-label">选择项目包文件</label>
                        <input type="file" class="tc-form-input" id="tc-import-file" accept=".json">
                    </div>
                    <div class="tc-form-group">
                        <label class="tc-form-label">导入模式</label>
                        <select class="tc-form-select" id="tc-import-mode">
                            <option value="create">创建新项目（推荐）</option>
                            <option value="merge">合并到当前项目</option>
                            <option value="overwrite">覆盖当前项目</option>
                        </select>
                    </div>
                    <div class="tc-form-hint">
                        支持导入 .json 格式的项目包文件
                    </div>
                </div>
                <div class="tc-modal-footer">
                    <button class="tc-btn tc-btn-secondary tc-modal-cancel">取消</button>
                    <button class="tc-btn tc-btn-primary" id="tc-confirm-import">导入</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.tc-modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.tc-modal-cancel').addEventListener('click', () => modal.remove());

        modal.querySelector('#tc-confirm-import').addEventListener('click', async () => {
            const fileInput = document.getElementById('tc-import-file');
            const mode = document.getElementById('tc-import-mode').value;

            if (!fileInput.files || fileInput.files.length === 0) {
                this.panel.api.ui.showToast('请选择要导入的文件', 'warning');
                return;
            }

            const file = fileInput.files[0];

            try {
                this.panel.api.ui.showToast('正在导入...', 'info');

                const result = await this.importExportService.importProject(
                    file,
                    this.currentUserId,
                    mode,
                    mode !== 'create' ? this.currentProjectId : null
                );

                this.panel.api.ui.showToast(
                    `导入成功: ${result.projectName} (${result.taskCount || result.importedCount} 个任务)`,
                    'success'
                );
                modal.remove();

                // 刷新侧边栏
                if (result.projectId) {
                    this.currentProjectId = result.projectId;
                }
                await this.render();
            } catch (error) {
                console.error('导入失败:', error);
                this.panel.api.ui.showToast('导入失败: ' + error.message, 'error');
            }
        });
    }

    /**
     * 显示导出对话框
     */
    showExportDialog() {
        if (!this.currentProjectId) {
            this.panel.api.ui.showToast('请先选择一个项目', 'warning');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'tc-modal open';
        modal.innerHTML = `
            <div class="tc-modal-content">
                <div class="tc-modal-header">
                    <span class="tc-modal-title">导出项目</span>
                    <button class="tc-modal-close">×</button>
                </div>
                <div class="tc-modal-body">
                    <div class="tc-form-group">
                        <label class="tc-form-label">导出模式</label>
                        <select class="tc-form-select" id="tc-export-mode">
                            <option value="encrypted">加密导出（推荐，仅可导入本系统）</option>
                            <option value="plaintext">明文导出（可查看内容，但不安全）</option>
                        </select>
                    </div>
                    <div class="tc-form-hint">
                        加密导出的文件只能导入到本系统，明文导出可查看但数据不安全
                    </div>
                </div>
                <div class="tc-modal-footer">
                    <button class="tc-btn tc-btn-secondary tc-modal-cancel">取消</button>
                    <button class="tc-btn tc-btn-primary" id="tc-confirm-export">导出</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.tc-modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.tc-modal-cancel').addEventListener('click', () => modal.remove());

        modal.querySelector('#tc-confirm-export').addEventListener('click', async () => {
            const mode = document.getElementById('tc-export-mode').value;

            try {
                this.panel.api.ui.showToast('正在导出...', 'info');

                const exportData = await this.importExportService.exportProject(
                    this.currentProjectId,
                    this.currentUserId,
                    mode
                );

                const filename = `project-${exportData.manifest.projectName}-${Date.now()}.json`;
                this.importExportService.exportToFile(exportData, filename);

                this.panel.api.ui.showToast('导出成功', 'success');
                modal.remove();
            } catch (error) {
                console.error('导出失败:', error);
                this.panel.api.ui.showToast('导出失败: ' + error.message, 'error');
            }
        });
    }

    /**
     * 销毁
     */
    destroy() {
        // 清理事件监听
    }
}

// 导出
window.TCSidebar = Sidebar;
/**
 * 团队协作插件 - 任务看板视图
 */

class TaskBoard {
    constructor(panel, taskService, indexManager, eventBus, projectService, crypto) {
        this.panel = panel;
        this.taskService = taskService;
        this.indexManager = indexManager;
        this.eventBus = eventBus;
        this.projectService = projectService;
        this.crypto = crypto;
        this.currentProjectId = null;
        this.currentUserId = null;
        this.tasks = { todo: [], doing: [], review: [], done: [] };
        this.draggedTask = null;
        this.projectMembers = [];
    }

    /**
     * 初始化
     * @param {string} projectId - 项目 ID
     * @param {string} userId - 用户 ID
     */
    async init(projectId, userId) {
        this.currentProjectId = projectId;
        this.currentUserId = userId;
        await this.loadTasks();
        this.render();
        this.bindEvents();
    }

    /**
     * 加载任务
     */
    async loadTasks() {
        if (!this.currentProjectId) return;
        const C = window.TCConstants;
        this.tasks = await this.taskService.getProjectTasksByStatus(this.currentProjectId, this.currentUserId);
    }

    /**
     * 渲染看板
     */
    render() {
        const C = window.TCConstants;
        const html = `
            <div class="tc-task-board">
                <div class="tc-board-header">
                    <div class="tc-board-title">任务看板</div>
                    <div class="tc-board-actions">
                        <button class="tc-btn tc-btn-primary tc-btn-sm" id="tc-add-task-btn">
                            + 新建任务
                        </button>
                        <button class="tc-btn tc-btn-secondary tc-btn-sm" id="tc-switch-view-btn">
                            📋 列表视图
                        </button>
                    </div>
                </div>
                <div class="tc-board-columns">
                    ${this.renderColumn(C.TASK_STATUS.TODO, '待办', this.tasks[C.TASK_STATUS.TODO])}
                    ${this.renderColumn(C.TASK_STATUS.DOING, '进行中', this.tasks[C.TASK_STATUS.DOING])}
                    ${this.renderColumn(C.TASK_STATUS.REVIEW, '审核中', this.tasks[C.TASK_STATUS.REVIEW])}
                    ${this.renderColumn(C.TASK_STATUS.DONE, '已完成', this.tasks[C.TASK_STATUS.DONE])}
                </div>
            </div>
        `;

        this.panel.setContent(html);
    }

    /**
     * 渲染列
     * @param {string} status - 状态
     * @param {string} title - 标题
     * @param {Array} tasks - 任务列表
     * @returns {string} HTML
     */
    renderColumn(status, title, tasks) {
        const statusColors = {
            'todo': '#6b7280',
            'doing': '#3b82f6',
            'review': '#f59e0b',
            'done': '#22c55e'
        };

        return `
            <div class="tc-board-column" data-status="${status}">
                <div class="tc-column-header" style="border-left: 3px solid ${statusColors[status]}">
                    <span class="tc-column-title">${title}</span>
                    <span class="tc-column-count">${tasks.length}</span>
                </div>
                <div class="tc-column-tasks" data-status="${status}">
                    ${tasks.map(task => this.renderTaskCard(task)).join('')}
                </div>
            </div>
        `;
    }

    /**
     * 渲染任务卡片
     * @param {Object} task - 任务对象
     * @returns {string} HTML
     */
    renderTaskCard(task) {
        const priorityColors = {
            'low': '#6b7280',
            'medium': '#3b82f6',
            'high': '#f59e0b',
            'urgent': '#ef4444'
        };

        const isOverdue = this.taskService.isOverdue(task);
        const dueDateText = task.dueDate ? window.TCUtils.formatDate(task.dueDate) : '';

        return `
            <div class="tc-task-card" data-task-id="${task.id}" draggable="true">
                <div class="tc-task-card-header">
                    <div class="tc-task-priority" style="background: ${priorityColors[task.priority]}"></div>
                    <div class="tc-task-title">${window.TCUtils.escapeHtml(task.title)}</div>
                </div>
                ${task.description ? `
                    <div class="tc-task-desc">${window.TCUtils.escapeHtml(window.TCUtils.truncateText(task.description, 60))}</div>
                ` : ''}
                <div class="tc-task-meta">
                    ${task.tags && task.tags.length > 0 ? `
                        <div class="tc-task-tags">
                            ${task.tags.slice(0, 2).map(tag => `<span class="tc-tag">${window.TCUtils.escapeHtml(tag)}</span>`).join('')}
                            ${task.tags.length > 2 ? `<span class="tc-tag-more">+${task.tags.length - 2}</span>` : ''}
                        </div>
                    ` : ''}
                    <div class="tc-task-info">
                        ${dueDateText ? `
                            <span class="tc-task-due ${isOverdue ? 'overdue' : ''}">
                                📅 ${dueDateText}
                            </span>
                        ` : ''}
                        ${task.assigneeIds && task.assigneeIds.length > 0 ? `
                            <span class="tc-task-assignees">👤 ${task.assigneeIds.length}</span>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 新建任务按钮
        const addBtn = document.getElementById('tc-add-task-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showCreateTaskModal());
        }

        // 切换视图按钮
        const switchBtn = document.getElementById('tc-switch-view-btn');
        if (switchBtn) {
            switchBtn.addEventListener('click', () => {
                this.eventBus.emit('view.changed', { view: 'task-list', projectId: this.currentProjectId });
            });
        }

        // 任务卡片点击
        document.querySelectorAll('.tc-task-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.tc-task-checkbox')) {
                    const taskId = card.dataset.taskId;
                    this.showTaskDetail(taskId);
                }
            });
        });

        // 拖拽事件
        this.setupDragAndDrop();
    }

    /**
     * 设置拖拽
     */
    setupDragAndDrop() {
        const columns = document.querySelectorAll('.tc-column-tasks');

        // 拖拽开始
        document.querySelectorAll('.tc-task-card').forEach(card => {
            card.addEventListener('dragstart', (e) => {
                this.draggedTask = card.dataset.taskId;
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                this.draggedTask = null;
            });
        });

        // 拖拽目标
        columns.forEach(column => {
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                column.classList.add('drag-over');
            });

            column.addEventListener('dragleave', () => {
                column.classList.remove('drag-over');
            });

            column.addEventListener('drop', async (e) => {
                e.preventDefault();
                column.classList.remove('drag-over');

                if (this.draggedTask) {
                    const newStatus = column.dataset.status;
                    await this.updateTaskStatus(this.draggedTask, newStatus);
                }
            });
        });
    }

    /**
     * 更新任务状态
     * @param {string} taskId - 任务 ID
     * @param {string} newStatus - 新状态
     */
    async updateTaskStatus(taskId, newStatus) {
        try {
            await this.taskService.updateTask(taskId, { status: newStatus }, this.currentUserId);
            await this.loadTasks();
            this.render();
            this.bindEvents();
        } catch (error) {
            console.error('更新任务状态失败:', error);
            this.panel.api.ui.showToast('更新任务状态失败: ' + error.message, 'error');
        }
    }

    /**
     * 显示创建任务对话框
     */
    showCreateTaskModal() {
        const C = window.TCConstants;
        const modal = document.createElement('div');
        modal.className = 'tc-modal open';
        
        // 构建成员选项
        const memberOptions = this.projectMembers.map(m => `
            <label class="tc-checkbox-label">
                <input type="checkbox" class="tc-assignee-checkbox" value="${m.userId}">
                <span>${m.userId}</span>
            </label>
        `).join('');

        modal.innerHTML = `
            <div class="tc-modal-content">
                <div class="tc-modal-header">
                    <span class="tc-modal-title">新建任务</span>
                    <button class="tc-modal-close">×</button>
                </div>
                <div class="tc-modal-body">
                    <div class="tc-form-group">
                        <label class="tc-form-label">任务标题 *</label>
                        <input type="text" class="tc-form-input" id="tc-task-title" 
                               placeholder="输入任务标题" maxlength="100">
                    </div>
                    <div class="tc-form-group">
                        <label class="tc-form-label">任务描述</label>
                        <textarea class="tc-form-textarea" id="tc-task-description" 
                                  placeholder="输入任务描述（支持Markdown）" rows="4"></textarea>
                    </div>
                    <div class="tc-form-row">
                        <div class="tc-form-group" style="flex: 1;">
                            <label class="tc-form-label">优先级</label>
                            <select class="tc-form-select" id="tc-task-priority">
                                <option value="${C.TASK_PRIORITY.LOW}">低</option>
                                <option value="${C.TASK_PRIORITY.MEDIUM}" selected>中</option>
                                <option value="${C.TASK_PRIORITY.HIGH}">高</option>
                                <option value="${C.TASK_PRIORITY.URGENT}">紧急</option>
                            </select>
                        </div>
                        <div class="tc-form-group" style="flex: 1;">
                            <label class="tc-form-label">截止日期</label>
                            <input type="date" class="tc-form-input" id="tc-task-due-date">
                        </div>
                    </div>
                    <div class="tc-form-group">
                        <label class="tc-form-label">负责人（可多选）</label>
                        <div class="tc-assignee-list" id="tc-task-assignees">
                            ${memberOptions || '<span class="tc-placeholder">暂无成员可选</span>'}
                        </div>
                    </div>
                    <div class="tc-form-group">
                        <label class="tc-form-label">可见性</label>
                        <select class="tc-form-select" id="tc-task-visibility">
                            <option value="${C.VISIBILITY.PROJECT}">项目成员可见</option>
                            <option value="${C.VISIBILITY.PRIVATE}">仅相关人员可见</option>
                        </select>
                    </div>
                    <div class="tc-form-group">
                        <label class="tc-form-label">标签（逗号分隔）</label>
                        <input type="text" class="tc-form-input" id="tc-task-tags" 
                               placeholder="例如：前端, 优化, 紧急">
                    </div>
                </div>
                <div class="tc-modal-footer">
                    <button class="tc-btn tc-btn-secondary tc-modal-cancel">取消</button>
                    <button class="tc-btn tc-btn-primary" id="tc-confirm-create">创建</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 关闭按钮
        modal.querySelector('.tc-modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.tc-modal-cancel').addEventListener('click', () => modal.remove());

        // 确认创建
        modal.querySelector('#tc-confirm-create').addEventListener('click', async () => {
            const title = document.getElementById('tc-task-title').value.trim();
            const description = document.getElementById('tc-task-description').value.trim();
            const priority = document.getElementById('tc-task-priority').value;
            const dueDate = document.getElementById('tc-task-due-date').value;
            const tagsStr = document.getElementById('tc-task-tags').value.trim();
            const visibility = document.getElementById('tc-task-visibility').value;

            // 获取选中的负责人
            const assigneeCheckboxes = document.querySelectorAll('.tc-assignee-checkbox:checked');
            const assigneeIds = Array.from(assigneeCheckboxes).map(cb => cb.value);

            if (!title) {
                this.panel.api.ui.showToast('请输入任务标题', 'warning');
                return;
            }

            try {
                const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(t => t) : [];

                await this.taskService.createTask({
                    projectId: this.currentProjectId,
                    title,
                    description,
                    priority,
                    dueDate: dueDate ? new Date(dueDate).getTime() : null,
                    tags,
                    assigneeIds,
                    visibility
                }, this.currentUserId);

                this.panel.api.ui.showToast('任务创建成功', 'success');
                modal.remove();

                // 刷新看板
                await this.loadTasks();
                this.render();
                this.bindEvents();
            } catch (error) {
                console.error('创建任务失败:', error);
                this.panel.api.ui.showToast('创建任务失败: ' + error.message, 'error');
            }
        });
    }

    /**
     * 显示任务详情
     * @param {string} taskId - 任务 ID
     */
    async showTaskDetail(taskId) {
        try {
            const task = await this.taskService.getTask(taskId, this.currentUserId);
            if (!task) {
                this.panel.api.ui.showToast('任务不存在', 'error');
                return;
            }

            this.eventBus.emit('task.detail', { taskId, task });
        } catch (error) {
            console.error('获取任务详情失败:', error);
            this.panel.api.ui.showToast('获取任务详情失败', 'error');
        }
    }

    /**
     * 刷新
     */
    async refresh() {
        await this.loadTasks();
        this.render();
        this.bindEvents();
    }

    /**
     * 销毁
     */
    destroy() {
        // 清理事件监听
    }
}

// 导出
window.TCTaskBoard = TaskBoard;
/**
 * 团队协作插件 - 任务列表视图
 */

class TaskList {
    constructor(panel, taskService, indexManager, eventBus) {
        this.panel = panel;
        this.taskService = taskService;
        this.indexManager = indexManager;
        this.eventBus = eventBus;
        this.currentProjectId = null;
        this.currentUserId = null;
        this.tasks = [];
        this.filters = {};
        this.sortBy = 'updatedAt';
        this.sortOrder = 'desc';
    }

    /**
     * 初始化
     * @param {string} projectId - 项目 ID
     * @param {string} userId - 用户 ID
     */
    async init(projectId, userId) {
        this.currentProjectId = projectId;
        this.currentUserId = userId;
        await this.loadTasks();
        this.render();
        this.bindEvents();
    }

    /**
     * 加载任务
     */
    async loadTasks() {
        if (!this.currentProjectId) return;
        this.tasks = await this.taskService.getProjectTasks(this.currentProjectId, this.currentUserId);
        this.applyFilters();
    }

    /**
     * 应用过滤和排序
     */
    applyFilters() {
        let filtered = [...this.tasks];

        // 状态过滤
        if (this.filters.status) {
            filtered = filtered.filter(t => t.status === this.filters.status);
        }

        // 优先级过滤
        if (this.filters.priority) {
            filtered = filtered.filter(t => t.priority === this.filters.priority);
        }

        // 关键词搜索
        if (this.filters.keyword) {
            const keyword = this.filters.keyword.toLowerCase();
            filtered = filtered.filter(t =>
                t.title.toLowerCase().includes(keyword) ||
                t.description.toLowerCase().includes(keyword)
            );
        }

        // 排序
        filtered.sort((a, b) => {
            let aVal = a[this.sortBy];
            let bVal = b[this.sortBy];

            if (this.sortBy === 'priority') {
                const priorityOrder = { 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1 };
                aVal = priorityOrder[a.priority] || 0;
                bVal = priorityOrder[b.priority] || 0;
            }

            if (this.sortOrder === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });

        this.tasks = filtered;
    }

    /**
     * 渲染列表
     */
    render() {
        const C = window.TCConstants;
        const html = `
            <div class="tc-task-list-view">
                <div class="tc-list-header">
                    <div class="tc-list-title">任务列表</div>
                    <div class="tc-list-actions">
                        <button class="tc-btn tc-btn-primary tc-btn-sm" id="tc-add-task-btn">
                            + 新建任务
                        </button>
                        <button class="tc-btn tc-btn-secondary tc-btn-sm" id="tc-switch-view-btn">
                            📊 看板视图
                        </button>
                    </div>
                </div>
                
                <div class="tc-list-filters">
                    <input type="text" class="tc-search-input" id="tc-task-search" 
                           placeholder="搜索任务...">
                    <select class="tc-filter-select" id="tc-status-filter">
                        <option value="">全部状态</option>
                        <option value="${C.TASK_STATUS.TODO}">待办</option>
                        <option value="${C.TASK_STATUS.DOING}">进行中</option>
                        <option value="${C.TASK_STATUS.REVIEW}">审核中</option>
                        <option value="${C.TASK_STATUS.DONE}">已完成</option>
                    </select>
                    <select class="tc-filter-select" id="tc-priority-filter">
                        <option value="">全部优先级</option>
                        <option value="${C.TASK_PRIORITY.URGENT}">紧急</option>
                        <option value="${C.TASK_PRIORITY.HIGH}">高</option>
                        <option value="${C.TASK_PRIORITY.MEDIUM}">中</option>
                        <option value="${C.TASK_PRIORITY.LOW}">低</option>
                    </select>
                </div>

                <div class="tc-list-content">
                    ${this.tasks.length === 0 ? this.renderEmpty() : this.renderTaskItems()}
                </div>
            </div>
        `;

        this.panel.setContent(html);
    }

    /**
     * 渲染空状态
     */
    renderEmpty() {
        return `
            <div class="tc-list-empty">
                <div class="tc-empty-icon">📋</div>
                <div class="tc-empty-text">暂无任务</div>
                <button class="tc-btn tc-btn-primary" id="tc-add-task-btn-empty">创建第一个任务</button>
            </div>
        `;
    }

    /**
     * 渲染任务项
     */
    renderTaskItems() {
        const C = window.TCConstants;
        const statusLabels = {
            [C.TASK_STATUS.TODO]: '待办',
            [C.TASK_STATUS.DOING]: '进行中',
            [C.TASK_STATUS.REVIEW]: '审核中',
            [C.TASK_STATUS.DONE]: '已完成'
        };

        const statusColors = {
            [C.TASK_STATUS.TODO]: '#6b7280',
            [C.TASK_STATUS.DOING]: '#3b82f6',
            [C.TASK_STATUS.REVIEW]: '#f59e0b',
            [C.TASK_STATUS.DONE]: '#22c55e'
        };

        const priorityColors = {
            'low': '#6b7280',
            'medium': '#3b82f6',
            'high': '#f59e0b',
            'urgent': '#ef4444'
        };

        return `
            <div class="tc-list-items">
                ${this.tasks.map(task => `
                    <div class="tc-list-item" data-task-id="${task.id}">
                        <div class="tc-list-item-left">
                            <div class="tc-task-status-dot" style="background: ${statusColors[task.status]}"></div>
                            <div class="tc-task-info">
                                <div class="tc-task-title">${window.TCUtils.escapeHtml(task.title)}</div>
                                ${task.description ? `
                                    <div class="tc-task-desc">${window.TCUtils.escapeHtml(window.TCUtils.truncateText(task.description, 80))}</div>
                                ` : ''}
                            </div>
                        </div>
                        <div class="tc-list-item-right">
                            <span class="tc-priority-badge" style="background: ${priorityColors[task.priority]}">
                                ${window.TCUtils.getPriorityLabel(task.priority)}
                            </span>
                            ${task.dueDate ? `
                                <span class="tc-due-date ${this.taskService.isOverdue(task) ? 'overdue' : ''}">
                                    ${window.TCUtils.formatDate(task.dueDate)}
                                </span>
                            ` : ''}
                            <span class="tc-status-badge" style="background: ${statusColors[task.status]}">
                                ${statusLabels[task.status]}
                            </span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 新建任务按钮
        document.querySelectorAll('#tc-add-task-btn, #tc-add-task-btn-empty').forEach(btn => {
            btn.addEventListener('click', () => this.showCreateTaskModal());
        });

        // 切换视图按钮
        const switchBtn = document.getElementById('tc-switch-view-btn');
        if (switchBtn) {
            switchBtn.addEventListener('click', () => {
                this.eventBus.emit('view.changed', { view: 'task-board', projectId: this.currentProjectId });
            });
        }

        // 搜索框
        const searchInput = document.getElementById('tc-task-search');
        if (searchInput) {
            searchInput.addEventListener('input', window.TCUtils.debounce(async (e) => {
                this.filters.keyword = e.target.value;
                await this.loadTasks();
                this.render();
                this.bindEvents();
            }, 300));
        }

        // 状态过滤
        const statusFilter = document.getElementById('tc-status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', async (e) => {
                this.filters.status = e.target.value || null;
                await this.loadTasks();
                this.render();
                this.bindEvents();
            });
        }

        // 优先级过滤
        const priorityFilter = document.getElementById('tc-priority-filter');
        if (priorityFilter) {
            priorityFilter.addEventListener('change', async (e) => {
                this.filters.priority = e.target.value || null;
                await this.loadTasks();
                this.render();
                this.bindEvents();
            });
        }

        // 任务项点击
        document.querySelectorAll('.tc-list-item').forEach(item => {
            item.addEventListener('click', () => {
                const taskId = item.dataset.taskId;
                this.showTaskDetail(taskId);
            });
        });
    }

    /**
     * 显示创建任务对话框
     */
    showCreateTaskModal() {
        const C = window.TCConstants;
        const modal = document.createElement('div');
        modal.className = 'tc-modal open';
        modal.innerHTML = `
            <div class="tc-modal-content">
                <div class="tc-modal-header">
                    <span class="tc-modal-title">新建任务</span>
                    <button class="tc-modal-close">×</button>
                </div>
                <div class="tc-modal-body">
                    <div class="tc-form-group">
                        <label class="tc-form-label">任务标题 *</label>
                        <input type="text" class="tc-form-input" id="tc-task-title" 
                               placeholder="输入任务标题" maxlength="100">
                    </div>
                    <div class="tc-form-group">
                        <label class="tc-form-label">任务描述</label>
                        <textarea class="tc-form-textarea" id="tc-task-description" 
                                  placeholder="输入任务描述（支持Markdown）" rows="4"></textarea>
                    </div>
                    <div class="tc-form-row">
                        <div class="tc-form-group" style="flex: 1;">
                            <label class="tc-form-label">优先级</label>
                            <select class="tc-form-select" id="tc-task-priority">
                                <option value="${C.TASK_PRIORITY.LOW}">低</option>
                                <option value="${C.TASK_PRIORITY.MEDIUM}" selected>中</option>
                                <option value="${C.TASK_PRIORITY.HIGH}">高</option>
                                <option value="${C.TASK_PRIORITY.URGENT}">紧急</option>
                            </select>
                        </div>
                        <div class="tc-form-group" style="flex: 1;">
                            <label class="tc-form-label">截止日期</label>
                            <input type="date" class="tc-form-input" id="tc-task-due-date">
                        </div>
                    </div>
                </div>
                <div class="tc-modal-footer">
                    <button class="tc-btn tc-btn-secondary tc-modal-cancel">取消</button>
                    <button class="tc-btn tc-btn-primary" id="tc-confirm-create">创建</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.tc-modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.tc-modal-cancel').addEventListener('click', () => modal.remove());

        modal.querySelector('#tc-confirm-create').addEventListener('click', async () => {
            const title = document.getElementById('tc-task-title').value.trim();
            const description = document.getElementById('tc-task-description').value.trim();
            const priority = document.getElementById('tc-task-priority').value;
            const dueDate = document.getElementById('tc-task-due-date').value;

            if (!title) {
                this.panel.api.ui.showToast('请输入任务标题', 'warning');
                return;
            }

            try {
                await this.taskService.createTask({
                    projectId: this.currentProjectId,
                    title,
                    description,
                    priority,
                    dueDate: dueDate ? new Date(dueDate).getTime() : null
                }, this.currentUserId);

                this.panel.api.ui.showToast('任务创建成功', 'success');
                modal.remove();
                await this.loadTasks();
                this.render();
                this.bindEvents();
            } catch (error) {
                this.panel.api.ui.showToast('创建任务失败: ' + error.message, 'error');
            }
        });
    }

    /**
     * 显示任务详情
     * @param {string} taskId - 任务 ID
     */
    async showTaskDetail(taskId) {
        try {
            const task = await this.taskService.getTask(taskId, this.currentUserId);
            if (!task) {
                this.panel.api.ui.showToast('任务不存在', 'error');
                return;
            }
            this.eventBus.emit('task.detail', { taskId, task });
        } catch (error) {
            this.panel.api.ui.showToast('获取任务详情失败', 'error');
        }
    }

    /**
     * 刷新
     */
    async refresh() {
        await this.loadTasks();
        this.render();
        this.bindEvents();
    }

    /**
     * 销毁
     */
    destroy() {
        // 清理
    }
}

// 导出
window.TCTaskList = TaskList;
/**
 * 团队协作插件 - 任务详情面板
 */

class TaskDetail {
    constructor(panel, taskService, projectService, eventBus, commentService, markdownRenderer) {
        this.panel = panel;
        this.taskService = taskService;
        this.projectService = projectService;
        this.eventBus = eventBus;
        this.commentService = commentService;
        this.markdown = markdownRenderer;
        this.currentTask = null;
        this.currentUserId = null;
        this.comments = [];
        this.commentContainer = null;
    }

    /**
     * 初始化
     * @param {string} projectId - 项目 ID
     * @param {string} userId - 用户 ID
     */
    async init(projectId, userId) {
        this.currentProjectId = projectId;
        this.currentUserId = userId;
        await this.loadProjectMembers();
        await this.loadTasks();
        this.render();
        this.bindEvents();
    }

    /**
     * 加载项目成员
     */
    async loadProjectMembers() {
        if (!this.currentProjectId) return;
        try {
            const project = await this.projectService.getProject(this.currentProjectId);
            this.projectMembers = project?.members || [];
        } catch (error) {
            console.error('[TaskBoard] 加载项目成员失败:', error);
            this.projectMembers = [];
        }
    }

    /**
     * 加载评论
     */
    async loadComments() {
        if (!this.currentTask) return;
        try {
            this.comments = await this.commentService.getTargetComments('task', this.currentTask.id);
        } catch (error) {
            console.error('[TaskDetail] 加载评论失败:', error);
            this.comments = [];
        }
    }

    /**
     * 渲染详情
     */
    render() {
        if (!this.currentTask) return;

        const task = this.currentTask;
        const C = window.TCConstants;

        const statusLabels = {
            [C.TASK_STATUS.TODO]: '待办',
            [C.TASK_STATUS.DOING]: '进行中',
            [C.TASK_STATUS.REVIEW]: '审核中',
            [C.TASK_STATUS.DONE]: '已完成'
        };

        const priorityLabels = {
            'low': '低',
            'medium': '中',
            'high': '高',
            'urgent': '紧急'
        };

        const priorityColors = {
            'low': '#6b7280',
            'medium': '#3b82f6',
            'high': '#f59e0b',
            'urgent': '#ef4444'
        };

        const html = `
            <div class="tc-task-detail">
                <div class="tc-detail-header">
                    <button class="tc-back-btn" id="tc-back-btn">← 返回</button>
                    <div class="tc-detail-actions">
                        <button class="tc-btn tc-btn-secondary tc-btn-sm" id="tc-edit-task-btn">编辑</button>
                        <button class="tc-btn tc-btn-secondary tc-btn-sm" id="tc-delete-task-btn" style="color: #ef4444;">删除</button>
                    </div>
                </div>

                <div class="tc-detail-content">
                    <div class="tc-detail-title">${window.TCUtils.escapeHtml(task.title)}</div>
                    
                    <div class="tc-detail-meta">
                        <div class="tc-meta-item">
                            <span class="tc-meta-label">状态</span>
                            <select class="tc-status-select" id="tc-task-status">
                                ${Object.entries(statusLabels).map(([value, label]) => `
                                    <option value="${value}" ${task.status === value ? 'selected' : ''}>${label}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="tc-meta-item">
                            <span class="tc-meta-label">优先级</span>
                            <span class="tc-priority-badge" style="background: ${priorityColors[task.priority]}">
                                ${priorityLabels[task.priority]}
                            </span>
                        </div>
                        <div class="tc-meta-item">
                            <span class="tc-meta-label">截止日期</span>
                            <span class="tc-due-date ${this.taskService.isOverdue(task) ? 'overdue' : ''}">
                                ${task.dueDate ? window.TCUtils.formatDateTime(task.dueDate) : '未设置'}
                            </span>
                        </div>
                        <div class="tc-meta-item">
                            <span class="tc-meta-label">创建时间</span>
                            <span>${window.TCUtils.formatDateTime(task.createdAt)}</span>
                        </div>
                    </div>

                    ${task.tags && task.tags.length > 0 ? `
                        <div class="tc-detail-tags">
                            ${task.tags.map(tag => `<span class="tc-tag">${window.TCUtils.escapeHtml(tag)}</span>`).join('')}
                        </div>
                    ` : ''}

                    <div class="tc-detail-section">
                        <div class="tc-section-title">任务描述</div>
                        <div class="tc-description">
                            ${task.description ? this.markdown.renderSafe(task.description) : '<span class="tc-placeholder">暂无描述</span>'}
                        </div>
                    </div>

                    <div class="tc-detail-section">
                        <div class="tc-section-title">进度</div>
                        <div class="tc-progress-bar">
                            <div class="tc-progress-fill" style="width: ${task.progress}%"></div>
                        </div>
                        <div class="tc-progress-text">${task.progress}%</div>
                    </div>

                    <div class="tc-detail-footer">
                        <div class="tc-footer-info">
                            <span>创建者: ${task.createdBy}</span>
                            <span>负责人: ${task.assigneeIds && task.assigneeIds.length > 0 ? task.assigneeIds.join(', ') : '未分配'}</span>
                        </div>
                    </div>

                    <!-- 评论区 -->
                    <div class="tc-detail-section tc-comments-section">
                        <div class="tc-section-title">评论 (${this.comments.length})</div>
                        
                        <!-- 评论列表 -->
                        <div class="tc-comment-list" id="tc-task-comments">
                            ${this.comments.length === 0 ? `
                                <div class="tc-comment-empty">
                                    <div class="tc-empty-icon">💬</div>
                                    <div class="tc-empty-text">暂无评论</div>
                                </div>
                            ` : this.renderComments()}
                        </div>

                        <!-- 评论输入框 -->
                        <div class="tc-comment-input">
                            <textarea class="tc-comment-textarea" id="tc-comment-input" 
                                      placeholder="输入评论，支持 **Markdown** 语法..." rows="3"></textarea>
                            <div class="tc-comment-input-footer">
                                <div class="tc-comment-hint">支持 **粗体**、*斜体*、\`代码\`</div>
                                <button class="tc-btn tc-btn-primary tc-btn-sm" id="tc-send-comment">发送</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.panel.setContent(html);
    }

    /**
     * 渲染评论列表
     * @returns {string} HTML
     */
    renderComments() {
        return this.comments.map(comment => `
            <div class="tc-comment-item" data-comment-id="${comment.id}">
                <div class="tc-comment-avatar">
                    <div class="tc-avatar">${this.getInitials(comment.authorId)}</div>
                </div>
                <div class="tc-comment-body">
                    <div class="tc-comment-meta">
                        <span class="tc-comment-author">${window.TCUtils.escapeHtml(comment.authorId)}</span>
                        <span class="tc-comment-time">${window.TCUtils.formatRelativeTime(comment.createdAt)}</span>
                    </div>
                    <div class="tc-comment-content">${this.markdown.renderSafe(comment.body)}</div>
                    <div class="tc-comment-actions">
                        <button class="tc-action-btn tc-reply-btn" data-author-id="${comment.authorId}">回复</button>
                        ${comment.authorId === this.currentUserId ? `
                            <button class="tc-action-btn tc-delete-comment-btn" data-comment-id="${comment.id}">删除</button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    }

    /**
     * 获取用户名首字母
     * @param {string} userId - 用户 ID
     * @returns {string}
     */
    getInitials(userId) {
        if (!userId) return '?';
        return userId.substring(0, 2).toUpperCase();
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 返回按钮
        const backBtn = document.getElementById('tc-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.eventBus.emit('task.back');
            });
        }

        // 状态选择
        const statusSelect = document.getElementById('tc-task-status');
        if (statusSelect) {
            statusSelect.addEventListener('change', async (e) => {
                await this.updateTaskStatus(e.target.value);
            });
        }

        // 编辑按钮
        const editBtn = document.getElementById('tc-edit-task-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => this.showEditModal());
        }

        // 删除按钮
        const deleteBtn = document.getElementById('tc-delete-task-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.confirmDelete());
        }

        // 发送评论按钮
        const sendBtn = document.getElementById('tc-send-comment');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendComment());
        }

        // Ctrl+Enter 发送评论
        const commentInput = document.getElementById('tc-comment-input');
        if (commentInput) {
            commentInput.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 'Enter') {
                    this.sendComment();
                }
            });
        }

        // 回复按钮
        document.querySelectorAll('.tc-reply-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const authorId = btn.dataset.authorId;
                this.replyToAuthor(authorId);
            });
        });

        // 删除评论按钮
        document.querySelectorAll('.tc-delete-comment-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const commentId = btn.dataset.commentId;
                this.deleteComment(commentId);
            });
        });
    }

    /**
     * 发送评论
     */
    async sendComment() {
        const commentInput = document.getElementById('tc-comment-input');
        const body = commentInput?.value?.trim();
        
        if (!body) {
            this.panel.api.ui.showToast('请输入评论内容', 'warning');
            return;
        }

        try {
            await this.commentService.addComment({
                targetType: 'task',
                targetId: this.currentTask.id,
                projectId: this.currentTask.projectId,
                authorId: this.currentUserId,
                body: body,
                mentions: this.extractMentions(body)
            });

            this.panel.api.ui.showToast('评论已发送', 'success');
            
            // 清空输入框
            commentInput.value = '';

            // 重新加载评论
            await this.loadComments();
            this.render();
            this.bindEvents();
        } catch (error) {
            console.error('发送评论失败:', error);
            this.panel.api.ui.showToast('发送评论失败: ' + error.message, 'error');
        }
    }

    /**
     * 从文本中提取 @提及
     * @param {string} text - 文本
     * @returns {Array} 用户 ID 列表
     */
    extractMentions(text) {
        const mentionRegex = /@(\w+)/g;
        const mentions = [];
        let match;
        while ((match = mentionRegex.exec(text)) !== null) {
            mentions.push(match[1]);
        }
        return mentions;
    }

    /**
     * 回复作者
     * @param {string} authorId - 作者 ID
     */
    replyToAuthor(authorId) {
        const commentInput = document.getElementById('tc-comment-input');
        if (commentInput) {
            commentInput.value = `@${authorId} `;
            commentInput.focus();
        }
    }

    /**
     * 删除评论
     * @param {string} commentId - 评论 ID
     */
    async deleteComment(commentId) {
        if (!confirm('确定要删除这条评论吗？')) return;

        try {
            // 获取线程
            const thread = await this.commentService.getOrCreateThread('task', this.currentTask.id);
            
            await this.commentService.deleteComment(
                commentId,
                thread.id,
                this.currentUserId
            );

            this.panel.api.ui.showToast('评论已删除', 'success');

            // 重新加载评论
            await this.loadComments();
            this.render();
            this.bindEvents();
        } catch (error) {
            this.panel.api.ui.showToast('删除评论失败: ' + error.message, 'error');
        }
    }

    /**
     * 更新任务状态
     * @param {string} newStatus - 新状态
     */
    async updateTaskStatus(newStatus) {
        try {
            this.currentTask = await this.taskService.updateTask(
                this.currentTask.id,
                { status: newStatus },
                this.currentUserId
            );
            this.panel.api.ui.showToast('状态已更新', 'success');
            this.render();
            this.bindEvents();
        } catch (error) {
            this.panel.api.ui.showToast('更新状态失败: ' + error.message, 'error');
        }
    }

    /**
     * 显示编辑对话框
     */
    showEditModal() {
        const task = this.currentTask;
        const C = window.TCConstants;

        const modal = document.createElement('div');
        modal.className = 'tc-modal open';
        modal.innerHTML = `
            <div class="tc-modal-content">
                <div class="tc-modal-header">
                    <span class="tc-modal-title">编辑任务</span>
                    <button class="tc-modal-close">×</button>
                </div>
                <div class="tc-modal-body">
                    <div class="tc-form-group">
                        <label class="tc-form-label">任务标题 *</label>
                        <input type="text" class="tc-form-input" id="tc-edit-title" 
                               value="${window.TCUtils.escapeHtml(task.title)}" maxlength="100">
                    </div>
                    <div class="tc-form-group">
                        <label class="tc-form-label">任务描述</label>
                        <textarea class="tc-form-textarea" id="tc-edit-description" rows="4">${window.TCUtils.escapeHtml(task.description)}</textarea>
                    </div>
                    <div class="tc-form-row">
                        <div class="tc-form-group" style="flex: 1;">
                            <label class="tc-form-label">优先级</label>
                            <select class="tc-form-select" id="tc-edit-priority">
                                <option value="low" ${task.priority === 'low' ? 'selected' : ''}>低</option>
                                <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>中</option>
                                <option value="high" ${task.priority === 'high' ? 'selected' : ''}>高</option>
                                <option value="urgent" ${task.priority === 'urgent' ? 'selected' : ''}>紧急</option>
                            </select>
                        </div>
                        <div class="tc-form-group" style="flex: 1;">
                            <label class="tc-form-label">截止日期</label>
                            <input type="date" class="tc-form-input" id="tc-edit-due-date" 
                                   value="${task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''}">
                        </div>
                    </div>
                    <div class="tc-form-group">
                        <label class="tc-form-label">进度 (${task.progress}%)</label>
                        <input type="range" class="tc-form-range" id="tc-edit-progress" 
                               min="0" max="100" value="${task.progress}">
                    </div>
                </div>
                <div class="tc-modal-footer">
                    <button class="tc-btn tc-btn-secondary tc-modal-cancel">取消</button>
                    <button class="tc-btn tc-btn-primary" id="tc-confirm-edit">保存</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.tc-modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.tc-modal-cancel').addEventListener('click', () => modal.remove());

        modal.querySelector('#tc-confirm-edit').addEventListener('click', async () => {
            const title = document.getElementById('tc-edit-title').value.trim();
            const description = document.getElementById('tc-edit-description').value.trim();
            const priority = document.getElementById('tc-edit-priority').value;
            const dueDate = document.getElementById('tc-edit-due-date').value;
            const progress = parseInt(document.getElementById('tc-edit-progress').value);

            if (!title) {
                this.panel.api.ui.showToast('请输入任务标题', 'warning');
                return;
            }

            try {
                this.currentTask = await this.taskService.updateTask(this.currentTask.id, {
                    title,
                    description,
                    priority,
                    dueDate: dueDate ? new Date(dueDate).getTime() : null,
                    progress
                }, this.currentUserId);

                this.panel.api.ui.showToast('任务已更新', 'success');
                modal.remove();
                this.render();
                this.bindEvents();
            } catch (error) {
                this.panel.api.ui.showToast('更新任务失败: ' + error.message, 'error');
            }
        });
    }

    /**
     * 确认删除
     */
    confirmDelete() {
        const modal = document.createElement('div');
        modal.className = 'tc-modal open';
        modal.innerHTML = `
            <div class="tc-modal-content">
                <div class="tc-modal-header">
                    <span class="tc-modal-title">确认删除</span>
                    <button class="tc-modal-close">×</button>
                </div>
                <div class="tc-modal-body">
                    <p>确定要删除任务 "${window.TCUtils.escapeHtml(this.currentTask.title)}" 吗？</p>
                    <p class="tc-warning">此操作不可恢复。</p>
                </div>
                <div class="tc-modal-footer">
                    <button class="tc-btn tc-btn-secondary tc-modal-cancel">取消</button>
                    <button class="tc-btn tc-btn-danger" id="tc-confirm-delete">删除</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.tc-modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.tc-modal-cancel').addEventListener('click', () => modal.remove());

        modal.querySelector('#tc-confirm-delete').addEventListener('click', async () => {
            try {
                await this.taskService.deleteTask(this.currentTask.id, this.currentUserId);
                this.panel.api.ui.showToast('任务已删除', 'success');
                modal.remove();
                this.eventBus.emit('task.back');
            } catch (error) {
                this.panel.api.ui.showToast('删除任务失败: ' + error.message, 'error');
            }
        });
    }

    /**
     * 销毁
     */
    destroy() {
        this.currentTask = null;
    }
}

// 导出
window.TCTaskDetail = TaskDetail;
/**
 * 团队协作插件 - 评论输入框组件
 * 支持 Markdown 输入和预览
 */

class CommentInput {
    constructor(panel, commentService, markdownRenderer, eventBus) {
        this.panel = panel;
        this.commentService = commentService;
        this.markdown = markdownRenderer;
        this.eventBus = eventBus;
        this.currentUserId = null;
        this.targetType = null;
        this.targetId = null;
        this.projectId = null;
        this.container = null;
        this.textarea = null;
        this.previewEl = null;
        this.isPreviewMode = false;
    }

    /**
     * 渲染评论输入框
     * @param {HTMLElement} parent - 父容器
     * @param {Object} options - 配置选项
     */
    render(parent, options) {
        this.currentUserId = options.userId;
        this.targetType = options.targetType;
        this.targetId = options.targetId;
        this.projectId = options.projectId;

        const html = `
            <div class="tc-comment-input">
                <div class="tc-input-tabs">
                    <div class="tc-input-tab ${!this.isPreviewMode ? 'active' : ''}" data-tab="edit">编辑</div>
                    <div class="tc-input-tab ${this.isPreviewMode ? 'active' : ''}" data-tab="preview">预览</div>
                </div>
                <div class="tc-input-content">
                    <div class="tc-edit-pane ${!this.isPreviewMode ? 'active' : ''}">
                        <textarea class="tc-comment-textarea" 
                                  placeholder="输入评论，支持 **Markdown** 语法..."
                                  rows="3"></textarea>
                    </div>
                    <div class="tc-preview-pane ${this.isPreviewMode ? 'active' : ''}">
                        <div class="tc-preview-content">预览将在这里显示...</div>
                    </div>
                </div>
                <div class="tc-input-footer">
                    <div class="tc-input-hint">
                        <span class="tc-hint-icon">💡</span>
                        <span>支持 **粗体**、*斜体*、\`代码\`、\`\`\`代码块\`\`\`、[链接](url)</span>
                    </div>
                    <div class="tc-input-actions">
                        <button class="tc-btn tc-btn-secondary tc-btn-sm tc-attach-btn" title="附件">
                            📎
                        </button>
                        <button class="tc-btn tc-btn-secondary tc-btn-sm tc-mention-btn" title="@提及">
                            @
                        </button>
                        <button class="tc-btn tc-btn-primary tc-send-btn">
                            发送
                        </button>
                    </div>
                </div>
            </div>
        `;

        parent.insertAdjacentHTML('beforeend', html);
        this.container = parent.querySelector('.tc-comment-input');
        this.textarea = this.container.querySelector('.tc-comment-textarea');
        this.previewEl = this.container.querySelector('.tc-preview-content');

        this.bindEvents();
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 切换编辑/预览
        this.container.querySelectorAll('.tc-input-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.togglePreview(tab.dataset.tab === 'preview');
            });
        });

        // 输入时更新预览（防抖）
        const updatePreview = window.TCUtils.debounce(() => {
            this.updatePreview();
        }, 300);

        this.textarea.addEventListener('input', updatePreview);

        // 发送按钮
        this.container.querySelector('.tc-send-btn').addEventListener('click', () => {
            this.sendComment();
        });

        // Ctrl+Enter 发送
        this.textarea.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.sendComment();
            }
        });

        // @提及按钮
        this.container.querySelector('.tc-mention-btn').addEventListener('click', () => {
            this.showMentionPicker();
        });

        // 附件按钮
        this.container.querySelector('.tc-attach-btn').addEventListener('click', () => {
            this.showAttachmentPicker();
        });
    }

    /**
     * 切换预览模式
     * @param {boolean} isPreview - 是否预览模式
     */
    togglePreview(isPreview) {
        this.isPreviewMode = isPreview;

        this.container.querySelectorAll('.tc-input-tab').forEach(tab => {
            tab.classList.toggle('active', (tab.dataset.tab === 'preview') === isPreview);
        });

        this.container.querySelector('.tc-edit-pane').classList.toggle('active', !isPreview);
        this.container.querySelector('.tc-preview-pane').classList.toggle('active', isPreview);

        if (isPreview) {
            this.updatePreview();
        }
    }

    /**
     * 更新预览
     */
    updatePreview() {
        const text = this.textarea.value;
        if (text.trim()) {
            this.previewEl.innerHTML = this.markdown.renderSafe(text);
        } else {
            this.previewEl.innerHTML = '<span class="tc-placeholder">预览将在这里显示...</span>';
        }
    }

    /**
     * 发送评论
     */
    async sendComment() {
        const body = this.textarea.value.trim();
        if (!body) {
            this.panel.api.ui.showToast('请输入评论内容', 'warning');
            return;
        }

        try {
            const comment = await this.commentService.addComment({
                targetType: this.targetType,
                targetId: this.targetId,
                projectId: this.projectId,
                authorId: this.currentUserId,
                body: body,
                mentions: this.extractMentions(body)
            });

            this.panel.api.ui.showToast('评论已发送', 'success');

            // 清空输入框
            this.textarea.value = '';
            if (this.isPreviewMode) {
                this.togglePreview(false);
            }

            // 触发事件
            this.eventBus.emit('comment.added', { comment });

        } catch (error) {
            console.error('发送评论失败:', error);
            this.panel.api.ui.showToast('发送评论失败: ' + error.message, 'error');
        }
    }

    /**
     * 从文本中提取 @提及
     * @param {string} text - 文本
     * @returns {Array} 用户 ID 列表
     */
    extractMentions(text) {
        // 简单实现：匹配 @用户名 格式
        const mentionRegex = /@(\w+)/g;
        const mentions = [];
        let match;

        while ((match = mentionRegex.exec(text)) !== null) {
            mentions.push(match[1]);
        }

        return mentions;
    }

    /**
     * 显示 @提及选择器
     */
    showMentionPicker() {
        // 简单实现：插入 @ 符号
        const cursorPos = this.textarea.selectionStart;
        const text = this.textarea.value;
        const before = text.substring(0, cursorPos);
        const after = text.substring(cursorPos);

        this.textarea.value = before + '@' + after;
        this.textarea.focus();
        this.textarea.setSelectionRange(cursorPos + 1, cursorPos + 1);
    }

    /**
     * 显示附件选择器
     */
    showAttachmentPicker() {
        // 创建文件输入
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.accept = '*/*';

        fileInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                await this.handleAttachments(files);
            }
        });

        fileInput.click();
    }

    /**
     * 处理附件
     * @param {Array} files - 文件列表
     */
    async handleAttachments(files) {
        // 简单实现：显示文件名
        const fileNames = files.map(f => f.name).join(', ');
        this.panel.api.ui.showToast(`已选择附件: ${fileNames}`, 'info');

        // 在输入框中插入附件标记
        const attachmentText = files.map(f => `\n[附件: ${f.name}]`).join('');
        this.textarea.value += attachmentText;
    }

    /**
     * 获取输入内容
     * @returns {string}
     */
    getValue() {
        return this.textarea ? this.textarea.value : '';
    }

    /**
     * 设置输入内容
     * @param {string} value - 内容
     */
    setValue(value) {
        if (this.textarea) {
            this.textarea.value = value;
        }
    }

    /**
     * 清空输入
     */
    clear() {
        if (this.textarea) {
            this.textarea.value = '';
        }
    }

    /**
     * 销毁
     */
    destroy() {
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }
}

// 导出
window.TCCommentInput = CommentInput;
/**
 * 团队协作插件 - 评论列表组件
 */

class CommentList {
    constructor(panel, commentService, markdownRenderer, eventBus) {
        this.panel = panel;
        this.commentService = commentService;
        this.markdown = markdownRenderer;
        this.eventBus = eventBus;
        this.currentUserId = null;
        this.comments = [];
        this.container = null;
    }

    /**
     * 渲染评论列表
     * @param {HTMLElement} parent - 父容器
     * @param {Object} options - 配置选项
     */
    async render(parent, options) {
        this.currentUserId = options.userId;

        // 获取评论
        this.comments = await this.commentService.getTargetComments(
            options.targetType,
            options.targetId
        );

        const html = `
            <div class="tc-comment-list">
                <div class="tc-comment-header">
                    <span class="tc-comment-count">评论 (${this.comments.length})</span>
                </div>
                <div class="tc-comment-items">
                    ${this.comments.length === 0 ? this.renderEmpty() : this.renderComments()}
                </div>
            </div>
        `;

        parent.insertAdjacentHTML('beforeend', html);
        this.container = parent.querySelector('.tc-comment-list');

        this.bindEvents();
    }

    /**
     * 渲染空状态
     */
    renderEmpty() {
        return `
            <div class="tc-comment-empty">
                <div class="tc-empty-icon">💬</div>
                <div class="tc-empty-text">暂无评论</div>
            </div>
        `;
    }

    /**
     * 渲染评论列表
     */
    renderComments() {
        return this.comments.map(comment => this.renderComment(comment)).join('');
    }

    /**
     * 渲染单条评论
     * @param {Object} comment - 评论对象
     */
    renderComment(comment) {
        const isAuthor = comment.authorId === this.currentUserId;
        const timeAgo = window.TCUtils.formatRelativeTime(comment.createdAt);
        const bodyHtml = this.markdown.renderSafe(comment.body);

        return `
            <div class="tc-comment-item" data-comment-id="${comment.id}">
                <div class="tc-comment-avatar">
                    <div class="tc-avatar">${this.getInitials(comment.authorId)}</div>
                </div>
                <div class="tc-comment-body">
                    <div class="tc-comment-meta">
                        <span class="tc-comment-author">${window.TCUtils.escapeHtml(comment.authorId)}</span>
                        <span class="tc-comment-time">${timeAgo}</span>
                        ${comment.updatedAt > comment.createdAt ? '<span class="tc-comment-edited">(已编辑)</span>' : ''}
                    </div>
                    <div class="tc-comment-content">${bodyHtml}</div>
                    ${comment.mentions && comment.mentions.length > 0 ? `
                        <div class="tc-comment-mentions">
                            ${comment.mentions.map(m => `<span class="tc-mention">@${m}</span>`).join(' ')}
                        </div>
                    ` : ''}
                    <div class="tc-comment-actions">
                        <button class="tc-action-btn tc-reply-btn" data-comment-id="${comment.id}">回复</button>
                        ${isAuthor ? `
                            <button class="tc-action-btn tc-edit-btn" data-comment-id="${comment.id}">编辑</button>
                            <button class="tc-action-btn tc-delete-btn" data-comment-id="${comment.id}">删除</button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 获取用户名首字母
     * @param {string} userId - 用户 ID
     * @returns {string}
     */
    getInitials(userId) {
        if (!userId) return '?';
        return userId.substring(0, 2).toUpperCase();
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        if (!this.container) return;

        // 回复按钮
        this.container.querySelectorAll('.tc-reply-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const commentId = btn.dataset.commentId;
                this.replyToComment(commentId);
            });
        });

        // 编辑按钮
        this.container.querySelectorAll('.tc-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const commentId = btn.dataset.commentId;
                this.editComment(commentId);
            });
        });

        // 删除按钮
        this.container.querySelectorAll('.tc-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const commentId = btn.dataset.commentId;
                this.deleteComment(commentId);
            });
        });
    }

    /**
     * 回复评论
     * @param {string} commentId - 评论 ID
     */
    replyToComment(commentId) {
        const comment = this.comments.find(c => c.id === commentId);
        if (comment) {
            // 触发回复事件
            this.eventBus.emit('comment.reply', {
                commentId,
                authorId: comment.authorId
            });
        }
    }

    /**
     * 编辑评论
     * @param {string} commentId - 评论 ID
     */
    editComment(commentId) {
        const comment = this.comments.find(c => c.id === commentId);
        if (!comment) return;

        // 显示编辑对话框
        const modal = document.createElement('div');
        modal.className = 'tc-modal open';
        modal.innerHTML = `
            <div class="tc-modal-content">
                <div class="tc-modal-header">
                    <span class="tc-modal-title">编辑评论</span>
                    <button class="tc-modal-close">×</button>
                </div>
                <div class="tc-modal-body">
                    <div class="tc-form-group">
                        <textarea class="tc-form-textarea" id="tc-edit-comment-body" rows="4">${window.TCUtils.escapeHtml(comment.body)}</textarea>
                    </div>
                </div>
                <div class="tc-modal-footer">
                    <button class="tc-btn tc-btn-secondary tc-modal-cancel">取消</button>
                    <button class="tc-btn tc-btn-primary" id="tc-confirm-edit">保存</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.tc-modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.tc-modal-cancel').addEventListener('click', () => modal.remove());

        modal.querySelector('#tc-confirm-edit').addEventListener('click', async () => {
            const newBody = document.getElementById('tc-edit-comment-body').value.trim();
            if (!newBody) {
                this.panel.api.ui.showToast('评论内容不能为空', 'warning');
                return;
            }

            try {
                // 获取线程 ID
                const thread = await this.commentService.getOrCreateThread(
                    comment.targetType || 'task',
                    comment.targetId
                );

                await this.commentService.updateComment(
                    commentId,
                    thread.id,
                    { body: newBody },
                    this.currentUserId
                );

                this.panel.api.ui.showToast('评论已更新', 'success');
                modal.remove();

                // 刷新评论列表
                this.eventBus.emit('comment.updated');
            } catch (error) {
                this.panel.api.ui.showToast('更新评论失败: ' + error.message, 'error');
            }
        });
    }

    /**
     * 删除评论
     * @param {string} commentId - 评论 ID
     */
    deleteComment(commentId) {
        // 显示确认对话框
        const modal = document.createElement('div');
        modal.className = 'tc-modal open';
        modal.innerHTML = `
            <div class="tc-modal-content">
                <div class="tc-modal-header">
                    <span class="tc-modal-title">确认删除</span>
                    <button class="tc-modal-close">×</button>
                </div>
                <div class="tc-modal-body">
                    <p>确定要删除这条评论吗？</p>
                </div>
                <div class="tc-modal-footer">
                    <button class="tc-btn tc-btn-secondary tc-modal-cancel">取消</button>
                    <button class="tc-btn tc-btn-danger" id="tc-confirm-delete">删除</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.tc-modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.tc-modal-cancel').addEventListener('click', () => modal.remove());

        modal.querySelector('#tc-confirm-delete').addEventListener('click', async () => {
            try {
                const comment = this.comments.find(c => c.id === commentId);
                if (!comment) return;

                // 获取线程 ID
                const thread = await this.commentService.getOrCreateThread(
                    comment.targetType || 'task',
                    comment.targetId
                );

                await this.commentService.deleteComment(
                    commentId,
                    thread.id,
                    this.currentUserId
                );

                this.panel.api.ui.showToast('评论已删除', 'success');
                modal.remove();

                // 刷新评论列表
                this.eventBus.emit('comment.updated');
            } catch (error) {
                this.panel.api.ui.showToast('删除评论失败: ' + error.message, 'error');
            }
        });
    }

    /**
     * 刷新评论列表
     * @param {string} targetType - 目标类型
     * @param {string} targetId - 目标 ID
     */
    async refresh(targetType, targetId) {
        this.comments = await this.commentService.getTargetComments(targetType, targetId);

        if (this.container) {
            const itemsEl = this.container.querySelector('.tc-comment-items');
            if (itemsEl) {
                itemsEl.innerHTML = this.comments.length === 0 ? this.renderEmpty() : this.renderComments();
                this.bindEvents();
            }

            const countEl = this.container.querySelector('.tc-comment-count');
            if (countEl) {
                countEl.textContent = `评论 (${this.comments.length})`;
            }
        }
    }

    /**
     * 添加新评论到列表
     * @param {Object} comment - 评论对象
     */
    addComment(comment) {
        this.comments.push(comment);

        if (this.container) {
            const itemsEl = this.container.querySelector('.tc-comment-items');
            if (itemsEl) {
                // 如果是空状态，先清空
                const emptyEl = itemsEl.querySelector('.tc-comment-empty');
                if (emptyEl) {
                    itemsEl.innerHTML = '';
                }

                // 添加新评论
                itemsEl.insertAdjacentHTML('beforeend', this.renderComment(comment));
                this.bindEvents();

                // 滚动到底部
                itemsEl.scrollTop = itemsEl.scrollHeight;
            }

            // 更新计数
            const countEl = this.container.querySelector('.tc-comment-count');
            if (countEl) {
                countEl.textContent = `评论 (${this.comments.length})`;
            }
        }
    }

    /**
     * 销毁
     */
    destroy() {
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }
}

// 导出
window.TCCommentList = CommentList;
/**
 * 团队协作插件 - 学习计划视图
 */

class PlanView {
    constructor(panel, planService, notificationService, eventBus, projectService, commentService, markdownRenderer) {
        this.panel = panel;
        this.planService = planService;
        this.notificationService = notificationService;
        this.eventBus = eventBus;
        this.projectService = projectService;
        this.commentService = commentService;
        this.markdown = markdownRenderer;
        this.currentProjectId = null;
        this.currentUserId = null;
        this.plans = [];
        this.projectMembers = [];
        this.comments = [];
    }

    /**
     * 初始化
     * @param {string} projectId - 项目 ID
     * @param {string} userId - 用户 ID
     */
    async init(projectId, userId) {
        this.currentProjectId = projectId;
        this.currentUserId = userId;
        await this.loadProjectMembers();
        await this.loadPlans();
        this.render();
        this.bindEvents();
    }

    /**
     * 加载项目成员
     */
    async loadProjectMembers() {
        if (!this.currentProjectId) return;
        try {
            const project = await this.projectService.getProject(this.currentProjectId);
            this.projectMembers = project?.members || [];
        } catch (error) {
            console.error('[PlanView] 加载项目成员失败:', error);
            this.projectMembers = [];
        }
    }

    /**
     * 加载计划
     */
    async loadPlans() {
        if (!this.currentProjectId) return;
        try {
            this.plans = await this.planService.getProjectPlans(this.currentProjectId);
        } catch (error) {
            console.error('[PlanView] 加载计划失败:', error);
            this.plans = [];
        }
    }

    /**
     * 渲染视图
     */
    render() {
        const html = `
            <div class="tc-plan-view">
                <div class="tc-plan-header">
                    <div class="tc-plan-title">学习计划</div>
                    <button class="tc-btn tc-btn-primary tc-btn-sm" id="tc-add-plan-btn">
                        + 创建计划
                    </button>
                </div>
                <div class="tc-plan-content">
                    ${this.plans.length === 0 ? this.renderEmpty() : this.renderPlanList()}
                </div>
            </div>
        `;

        this.panel.setContent(html);
    }

    /**
     * 渲染空状态
     */
    renderEmpty() {
        return `
            <div class="tc-plan-empty">
                <div class="tc-empty-icon">📚</div>
                <div class="tc-empty-title">暂无学习计划</div>
                <div class="tc-empty-text">创建一个学习计划，帮助团队成员系统学习</div>
                <button class="tc-btn tc-btn-primary" id="tc-add-plan-btn-empty">创建第一个计划</button>
            </div>
        `;
    }

    /**
     * 渲染计划列表
     */
    renderPlanList() {
        return `
            <div class="tc-plan-list">
                ${this.plans.map(plan => this.renderPlanCard(plan)).join('')}
            </div>
        `;
    }

    /**
     * 渲染计划卡片
     * @param {Object} plan - 计划对象
     */
    renderPlanCard(plan) {
        const isOverdue = plan.submissionRule.dueDate && plan.submissionRule.dueDate < Date.now();
        const dueDateText = plan.submissionRule.dueDate
            ? window.TCUtils.formatDate(plan.submissionRule.dueDate)
            : '无截止日期';

        // 计算进度
        const myProgress = plan.progress[this.currentUserId] || {
            completedTasks: 0,
            totalTasks: plan.taskIds.length,
            status: 'not_started'
        };
        const percentage = myProgress.totalTasks > 0
            ? Math.round((myProgress.completedTasks / myProgress.totalTasks) * 100)
            : 0;

        return `
            <div class="tc-plan-card" data-plan-id="${plan.id}">
                <div class="tc-plan-card-header">
                    <div class="tc-plan-card-title">${window.TCUtils.escapeHtml(plan.title)}</div>
                    <div class="tc-plan-card-due ${isOverdue ? 'overdue' : ''}">
                        ${isOverdue ? '❗' : '📅'} ${dueDateText}
                    </div>
                </div>
                ${plan.description ? `
                    <div class="tc-plan-card-desc">${window.TCUtils.escapeHtml(window.TCUtils.truncateText(plan.description, 80))}</div>
                ` : ''}
                <div class="tc-plan-card-progress">
                    <div class="tc-progress-bar">
                        <div class="tc-progress-fill" style="width: ${percentage}%"></div>
                    </div>
                    <div class="tc-progress-info">
                        <span>我的进度: ${percentage}%</span>
                        <span>${myProgress.completedTasks}/${myProgress.totalTasks} 任务</span>
                    </div>
                </div>
                <div class="tc-plan-card-footer">
                    <div class="tc-plan-members">
                        👥 ${plan.assigneeIds.length} 成员
                    </div>
                    <button class="tc-btn tc-btn-secondary tc-btn-sm tc-view-plan-btn" data-plan-id="${plan.id}">
                        查看详情
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 创建计划按钮
        document.querySelectorAll('#tc-add-plan-btn, #tc-add-plan-btn-empty').forEach(btn => {
            btn.addEventListener('click', () => this.showCreatePlanModal());
        });

        // 查看计划详情
        document.querySelectorAll('.tc-view-plan-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const planId = btn.dataset.planId;
                this.showPlanDetail(planId);
            });
        });

        // 点击卡片查看详情
        document.querySelectorAll('.tc-plan-card').forEach(card => {
            card.addEventListener('click', () => {
                const planId = card.dataset.planId;
                this.showPlanDetail(planId);
            });
        });
    }

    /**
     * 显示创建计划对话框
     */
    showCreatePlanModal() {
        const modal = document.createElement('div');
        modal.className = 'tc-modal open';
        
        // 构建成员选项
        const memberOptions = this.projectMembers.map(m => `
            <label class="tc-checkbox-label">
                <input type="checkbox" class="tc-plan-assignee-checkbox" value="${m.userId}" ${m.userId === this.currentUserId ? 'checked' : ''}>
                <span>${m.userId}${m.userId === this.currentUserId ? ' (我)' : ''}</span>
            </label>
        `).join('');

        modal.innerHTML = `
            <div class="tc-modal-content">
                <div class="tc-modal-header">
                    <span class="tc-modal-title">创建学习计划</span>
                    <button class="tc-modal-close">×</button>
                </div>
                <div class="tc-modal-body">
                    <div class="tc-form-group">
                        <label class="tc-form-label">计划标题 *</label>
                        <input type="text" class="tc-form-input" id="tc-plan-title" 
                               placeholder="例如：JavaScript进阶学习" maxlength="100">
                    </div>
                    <div class="tc-form-group">
                        <label class="tc-form-label">计划描述</label>
                        <textarea class="tc-form-textarea" id="tc-plan-description" 
                                  placeholder="描述学习目标和内容" rows="3"></textarea>
                    </div>
                    <div class="tc-form-group">
                        <label class="tc-form-label">学习目标</label>
                        <input type="text" class="tc-form-input" id="tc-plan-objectives" 
                               placeholder="例如：掌握异步编程、模块化开发">
                    </div>
                    <div class="tc-form-group">
                        <label class="tc-form-label">截止日期</label>
                        <input type="date" class="tc-form-input" id="tc-plan-due-date">
                    </div>
                    <div class="tc-form-group">
                        <label class="tc-form-label">参与成员（可多选）</label>
                        <div class="tc-assignee-list" id="tc-plan-assignees">
                            ${memberOptions || '<span class="tc-placeholder">暂无成员可选</span>'}
                        </div>
                    </div>
                    <div class="tc-form-group">
                        <label class="tc-form-label">交付成果（逗号分隔）</label>
                        <input type="text" class="tc-form-input" id="tc-plan-deliverables" 
                               placeholder="例如：学习笔记, 示例代码, 分享纪要">
                    </div>
                </div>
                <div class="tc-modal-footer">
                    <button class="tc-btn tc-btn-secondary tc-modal-cancel">取消</button>
                    <button class="tc-btn tc-btn-primary" id="tc-confirm-create">创建</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.tc-modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.tc-modal-cancel').addEventListener('click', () => modal.remove());

        modal.querySelector('#tc-confirm-create').addEventListener('click', async () => {
            const title = document.getElementById('tc-plan-title').value.trim();
            const description = document.getElementById('tc-plan-description').value.trim();
            const objectives = document.getElementById('tc-plan-objectives').value.trim();
            const dueDate = document.getElementById('tc-plan-due-date').value;
            const deliverablesStr = document.getElementById('tc-plan-deliverables').value.trim();

            // 获取选中的成员
            const assigneeCheckboxes = document.querySelectorAll('.tc-plan-assignee-checkbox:checked');
            const assigneeIds = Array.from(assigneeCheckboxes).map(cb => cb.value);

            if (!title) {
                this.panel.api.ui.showToast('请输入计划标题', 'warning');
                return;
            }

            if (assigneeIds.length === 0) {
                this.panel.api.ui.showToast('请至少选择一个参与成员', 'warning');
                return;
            }

            try {
                const deliverables = deliverablesStr
                    ? deliverablesStr.split(',').map(d => d.trim()).filter(d => d)
                    : [];

                await this.planService.createPlan({
                    projectId: this.currentProjectId,
                    title,
                    description,
                    objectives,
                    dueDate: dueDate ? new Date(dueDate).getTime() : null,
                    deliverables,
                    assigneeIds: assigneeIds
                }, this.currentUserId);

                this.panel.api.ui.showToast('学习计划创建成功', 'success');
                modal.remove();

                await this.loadPlans();
                this.render();
                this.bindEvents();
            } catch (error) {
                this.panel.api.ui.showToast('创建计划失败: ' + error.message, 'error');
            }
        });
    }

    /**
     * 显示计划详情
     * @param {string} planId - 计划 ID
     */
    async showPlanDetail(planId) {
        try {
            const plan = await this.planService.getPlan(planId);
            if (!plan) {
                this.panel.api.ui.showToast('计划不存在', 'error');
                return;
            }

            const progress = await this.planService.getMemberProgress(planId, this.currentUserId);
            
            // 加载所有成员进度
            const allProgress = await this.planService.getAllMemberProgress(planId);
            
            // 加载评论
            this.comments = await this.commentService.getTargetComments('plan', planId);
            
            this.renderPlanDetail(plan, progress, allProgress);
        } catch (error) {
            console.error('[PlanView] 获取计划详情失败:', error);
            this.panel.api.ui.showToast('获取计划详情失败', 'error');
        }
    }

    /**
     * 渲染计划详情
     * @param {Object} plan - 计划对象
     * @param {Object} progress - 当前用户进度对象
     * @param {Object} allProgress - 所有成员进度
     */
    renderPlanDetail(plan, progress, allProgress) {
        const isOverdue = plan.submissionRule.dueDate && plan.submissionRule.dueDate < Date.now();
        const dueDateText = plan.submissionRule.dueDate
            ? window.TCUtils.formatDateTime(plan.submissionRule.dueDate)
            : '无截止日期';

        const html = `
            <div class="tc-plan-detail">
                <div class="tc-detail-header">
                    <button class="tc-back-btn" id="tc-back-to-plans">← 返回</button>
                    <div class="tc-detail-actions">
                        <button class="tc-btn tc-btn-secondary tc-btn-sm" id="tc-add-task-to-plan">添加任务</button>
                        <button class="tc-btn tc-btn-secondary tc-btn-sm" id="tc-submit-work">提交成果</button>
                    </div>
                </div>

                <div class="tc-detail-content">
                    <div class="tc-plan-detail-title">${window.TCUtils.escapeHtml(plan.title)}</div>
                    
                    <div class="tc-plan-detail-meta">
                        <div class="tc-meta-item">
                            <span class="tc-meta-label">截止日期</span>
                            <span class="${isOverdue ? 'overdue' : ''}">${dueDateText}</span>
                        </div>
                        <div class="tc-meta-item">
                            <span class="tc-meta-label">参与成员</span>
                            <span>${plan.assigneeIds.length} 人</span>
                        </div>
                        <div class="tc-meta-item">
                            <span class="tc-meta-label">任务数量</span>
                            <span>${plan.taskIds.length} 个</span>
                        </div>
                    </div>

                    ${plan.description ? `
                        <div class="tc-detail-section">
                            <div class="tc-section-title">计划描述</div>
                            <div class="tc-description">${window.TCUtils.escapeHtml(plan.description)}</div>
                        </div>
                    ` : ''}

                    ${plan.objectives ? `
                        <div class="tc-detail-section">
                            <div class="tc-section-title">学习目标</div>
                            <div class="tc-description">${window.TCUtils.escapeHtml(plan.objectives)}</div>
                        </div>
                    ` : ''}

                    ${plan.deliverables && plan.deliverables.length > 0 ? `
                        <div class="tc-detail-section">
                            <div class="tc-section-title">交付成果</div>
                            <ul class="tc-deliverables-list">
                                ${plan.deliverables.map(d => `<li>${window.TCUtils.escapeHtml(d)}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}

                    <!-- 所有成员进度 -->
                    <div class="tc-detail-section">
                        <div class="tc-section-title">团队进度</div>
                        <div class="tc-team-progress">
                            ${this.renderTeamProgress(allProgress)}
                        </div>
                    </div>

                    <!-- 我的进度 -->
                    <div class="tc-detail-section">
                        <div class="tc-section-title">我的进度</div>
                        <div class="tc-progress-bar">
                            <div class="tc-progress-fill" style="width: ${progress.percentage}%"></div>
                        </div>
                        <div class="tc-progress-text">${progress.percentage}% (${progress.completedTasks}/${progress.totalTasks} 任务)</div>
                    </div>

                    ${progress.submissions && progress.submissions.length > 0 ? `
                        <div class="tc-detail-section">
                            <div class="tc-section-title">我的提交</div>
                            <div class="tc-submissions-list">
                                ${progress.submissions.map(s => `
                                    <div class="tc-submission-item">
                                        <div class="tc-submission-content">${window.TCUtils.escapeHtml(s.content)}</div>
                                        <div class="tc-submission-time">${window.TCUtils.formatRelativeTime(s.submittedAt)}</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <!-- 评论区 -->
                    <div class="tc-detail-section tc-comments-section">
                        <div class="tc-section-title">评论 (${this.comments.length})</div>
                        
                        <div class="tc-comment-list" id="tc-plan-comments">
                            ${this.comments.length === 0 ? `
                                <div class="tc-comment-empty">
                                    <div class="tc-empty-icon">💬</div>
                                    <div class="tc-empty-text">暂无评论</div>
                                </div>
                            ` : this.renderComments()}
                        </div>

                        <div class="tc-comment-input">
                            <textarea class="tc-comment-textarea" id="tc-plan-comment-input" 
                                      placeholder="输入评论，支持 **Markdown** 语法..." rows="3"></textarea>
                            <div class="tc-comment-input-footer">
                                <div class="tc-comment-hint">支持 **粗体**、*斜体*、\`代码\`</div>
                                <button class="tc-btn tc-btn-primary tc-btn-sm" id="tc-send-plan-comment">发送</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.panel.setContent(html);

        // 绑定事件
        document.getElementById('tc-back-to-plans').addEventListener('click', () => {
            this.render();
            this.bindEvents();
        });

        document.getElementById('tc-add-task-to-plan').addEventListener('click', () => {
            this.showAddTaskToPlanModal(plan.id);
        });

        document.getElementById('tc-submit-work').addEventListener('click', () => {
            this.showSubmitWorkModal(plan.id);
        });

        // 发送评论
        document.getElementById('tc-send-plan-comment').addEventListener('click', () => {
            this.sendComment(plan);
        });

        // Ctrl+Enter 发送评论
        const commentInput = document.getElementById('tc-plan-comment-input');
        if (commentInput) {
            commentInput.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 'Enter') {
                    this.sendComment(plan);
                }
            });
        }

        // 回复按钮
        document.querySelectorAll('.tc-reply-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const authorId = btn.dataset.authorId;
                this.replyToAuthor(authorId);
            });
        });

        // 删除评论按钮
        document.querySelectorAll('.tc-delete-comment-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const commentId = btn.dataset.commentId;
                this.deleteComment(commentId, plan);
            });
        });
    }

    /**
     * 渲染团队进度
     * @param {Object} allProgress - 所有成员进度
     * @returns {string} HTML
     */
    renderTeamProgress(allProgress) {
        return Object.entries(allProgress).map(([userId, prog]) => `
            <div class="tc-team-member-progress">
                <div class="tc-member-info">
                    <div class="tc-member-avatar">${this.getInitials(userId)}</div>
                    <div class="tc-member-name">${userId}${userId === this.currentUserId ? ' (我)' : ''}</div>
                </div>
                <div class="tc-progress-bar">
                    <div class="tc-progress-fill" style="width: ${prog.percentage}%"></div>
                </div>
                <div class="tc-progress-text">${prog.percentage}%</div>
            </div>
        `).join('');
    }

    /**
     * 渲染评论列表
     * @returns {string} HTML
     */
    renderComments() {
        return this.comments.map(comment => `
            <div class="tc-comment-item" data-comment-id="${comment.id}">
                <div class="tc-comment-avatar">
                    <div class="tc-avatar">${this.getInitials(comment.authorId)}</div>
                </div>
                <div class="tc-comment-body">
                    <div class="tc-comment-meta">
                        <span class="tc-comment-author">${window.TCUtils.escapeHtml(comment.authorId)}</span>
                        <span class="tc-comment-time">${window.TCUtils.formatRelativeTime(comment.createdAt)}</span>
                    </div>
                    <div class="tc-comment-content">${this.markdown.renderSafe(comment.body)}</div>
                    <div class="tc-comment-actions">
                        <button class="tc-action-btn tc-reply-btn" data-author-id="${comment.authorId}">回复</button>
                        ${comment.authorId === this.currentUserId ? `
                            <button class="tc-action-btn tc-delete-comment-btn" data-comment-id="${comment.id}">删除</button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    }

    /**
     * 获取用户名首字母
     * @param {string} userId - 用户 ID
     * @returns {string}
     */
    getInitials(userId) {
        if (!userId) return '?';
        return userId.substring(0, 2).toUpperCase();
    }

    /**
     * 发送评论
     * @param {Object} plan - 计划对象
     */
    async sendComment(plan) {
        const commentInput = document.getElementById('tc-plan-comment-input');
        const body = commentInput?.value?.trim();
        
        if (!body) {
            this.panel.api.ui.showToast('请输入评论内容', 'warning');
            return;
        }

        try {
            await this.commentService.addComment({
                targetType: 'plan',
                targetId: plan.id,
                projectId: plan.projectId,
                authorId: this.currentUserId,
                body: body,
                mentions: this.extractMentions(body)
            });

            this.panel.api.ui.showToast('评论已发送', 'success');
            commentInput.value = '';

            // 重新加载评论并刷新
            this.comments = await this.commentService.getTargetComments('plan', plan.id);
            const progress = await this.planService.getMemberProgress(plan.id, this.currentUserId);
            const allProgress = await this.planService.getAllMemberProgress(plan.id);
            this.renderPlanDetail(plan, progress, allProgress);
        } catch (error) {
            console.error('发送评论失败:', error);
            this.panel.api.ui.showToast('发送评论失败: ' + error.message, 'error');
        }
    }

    /**
     * 从文本中提取 @提及
     * @param {string} text - 文本
     * @returns {Array} 用户 ID 列表
     */
    extractMentions(text) {
        const mentionRegex = /@(\w+)/g;
        const mentions = [];
        let match;
        while ((match = mentionRegex.exec(text)) !== null) {
            mentions.push(match[1]);
        }
        return mentions;
    }

    /**
     * 回复作者
     * @param {string} authorId - 作者 ID
     */
    replyToAuthor(authorId) {
        const commentInput = document.getElementById('tc-plan-comment-input');
        if (commentInput) {
            commentInput.value = `@${authorId} `;
            commentInput.focus();
        }
    }

    /**
     * 删除评论
     * @param {string} commentId - 评论 ID
     * @param {Object} plan - 计划对象
     */
    async deleteComment(commentId, plan) {
        if (!confirm('确定要删除这条评论吗？')) return;

        try {
            const thread = await this.commentService.getOrCreateThread('plan', plan.id);
            
            await this.commentService.deleteComment(
                commentId,
                thread.id,
                this.currentUserId
            );

            this.panel.api.ui.showToast('评论已删除', 'success');

            // 重新加载评论并刷新
            this.comments = await this.commentService.getTargetComments('plan', plan.id);
            const progress = await this.planService.getMemberProgress(plan.id, this.currentUserId);
            const allProgress = await this.planService.getAllMemberProgress(plan.id);
            this.renderPlanDetail(plan, progress, allProgress);
        } catch (error) {
            this.panel.api.ui.showToast('删除评论失败: ' + error.message, 'error');
        }
    }

    /**
     * 显示添加任务到计划对话框
     * @param {string} planId - 计划 ID
     */
    showAddTaskToPlanModal(planId) {
        const modal = document.createElement('div');
        modal.className = 'tc-modal open';
        modal.innerHTML = `
            <div class="tc-modal-content">
                <div class="tc-modal-header">
                    <span class="tc-modal-title">添加学习任务</span>
                    <button class="tc-modal-close">×</button>
                </div>
                <div class="tc-modal-body">
                    <div class="tc-form-group">
                        <label class="tc-form-label">任务标题 *</label>
                        <input type="text" class="tc-form-input" id="tc-task-title" 
                               placeholder="例如：学习Promise异步编程">
                    </div>
                    <div class="tc-form-group">
                        <label class="tc-form-label">任务描述</label>
                        <textarea class="tc-form-textarea" id="tc-task-description" 
                                  placeholder="描述学习内容和要求" rows="3"></textarea>
                    </div>
                    <div class="tc-form-group">
                        <label class="tc-form-label">学习资源链接</label>
                        <input type="text" class="tc-form-input" id="tc-task-resources" 
                               placeholder="https://...">
                    </div>
                </div>
                <div class="tc-modal-footer">
                    <button class="tc-btn tc-btn-secondary tc-modal-cancel">取消</button>
                    <button class="tc-btn tc-btn-primary" id="tc-confirm-add">添加</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.tc-modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.tc-modal-cancel').addEventListener('click', () => modal.remove());

        modal.querySelector('#tc-confirm-add').addEventListener('click', async () => {
            const title = document.getElementById('tc-task-title').value.trim();
            const description = document.getElementById('tc-task-description').value.trim();
            const resources = document.getElementById('tc-task-resources').value.trim();

            if (!title) {
                this.panel.api.ui.showToast('请输入任务标题', 'warning');
                return;
            }

            try {
                await this.planService.addLearningTask(planId, {
                    title,
                    description,
                    resources: resources ? [{ title: '学习资源', url: resources }] : [],
                    createdBy: this.currentUserId
                });

                this.panel.api.ui.showToast('任务添加成功', 'success');
                modal.remove();

                // 刷新详情
                this.showPlanDetail(planId);
            } catch (error) {
                this.panel.api.ui.showToast('添加任务失败: ' + error.message, 'error');
            }
        });
    }

    /**
     * 显示提交成果对话框
     * @param {string} planId - 计划 ID
     */
    showSubmitWorkModal(planId) {
        const modal = document.createElement('div');
        modal.className = 'tc-modal open';
        modal.innerHTML = `
            <div class="tc-modal-content">
                <div class="tc-modal-header">
                    <span class="tc-modal-title">提交学习成果</span>
                    <button class="tc-modal-close">×</button>
                </div>
                <div class="tc-modal-body">
                    <div class="tc-form-group">
                        <label class="tc-form-label">成果内容 *（支持Markdown）</label>
                        <textarea class="tc-form-textarea" id="tc-submission-content" 
                                  placeholder="描述你的学习成果、笔记或代码示例" rows="6"></textarea>
                    </div>
                </div>
                <div class="tc-modal-footer">
                    <button class="tc-btn tc-btn-secondary tc-modal-cancel">取消</button>
                    <button class="tc-btn tc-btn-primary" id="tc-confirm-submit">提交</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.tc-modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.tc-modal-cancel').addEventListener('click', () => modal.remove());

        modal.querySelector('#tc-confirm-submit').addEventListener('click', async () => {
            const content = document.getElementById('tc-submission-content').value.trim();

            if (!content) {
                this.panel.api.ui.showToast('请输入成果内容', 'warning');
                return;
            }

            try {
                await this.planService.submitWork(planId, this.currentUserId, { content });
                this.panel.api.ui.showToast('成果提交成功', 'success');
                modal.remove();

                // 刷新详情
                this.showPlanDetail(planId);
            } catch (error) {
                this.panel.api.ui.showToast('提交失败: ' + error.message, 'error');
            }
        });
    }

    /**
     * 刷新
     */
    async refresh() {
        await this.loadPlans();
        this.render();
        this.bindEvents();
    }

    /**
     * 销毁
     */
    destroy() {
        // 清理
    }
}

// 导出
window.TCPlanView = PlanView;
/**
 * 团队协作插件 - 收件箱视图
 */

class InboxView {
    constructor(panel, notificationService, eventBus) {
        this.panel = panel;
        this.notificationService = notificationService;
        this.eventBus = eventBus;
        this.currentUserId = null;
        this.notifications = [];
    }

    /**
     * 初始化
     * @param {string} userId - 用户 ID
     */
    async init(userId) {
        this.currentUserId = userId;
        await this.loadNotifications();
        this.render();
        this.bindEvents();
    }

    /**
     * 加载通知
     */
    async loadNotifications() {
        this.notifications = await this.notificationService.getInbox(this.currentUserId, {
            pageSize: 50
        });
    }

    /**
     * 渲染视图
     */
    render() {
        const html = `
            <div class="tc-inbox-view">
                <div class="tc-inbox-header">
                    <div class="tc-inbox-title">收件箱</div>
                    <div class="tc-inbox-actions">
                        <button class="tc-btn tc-btn-secondary tc-btn-sm" id="tc-mark-all-read">
                            全部已读
                        </button>
                        <button class="tc-btn tc-btn-secondary tc-btn-sm" id="tc-clear-inbox">
                            清空
                        </button>
                    </div>
                </div>
                <div class="tc-inbox-content">
                    ${this.notifications.length === 0 ? this.renderEmpty() : this.renderNotificationList()}
                </div>
            </div>
        `;

        this.panel.setContent(html);
    }

    /**
     * 渲染空状态
     */
    renderEmpty() {
        return `
            <div class="tc-inbox-empty">
                <div class="tc-empty-icon">📥</div>
                <div class="tc-empty-title">收件箱为空</div>
                <div class="tc-empty-text">暂无新通知</div>
            </div>
        `;
    }

    /**
     * 渲染通知列表
     */
    renderNotificationList() {
        return `
            <div class="tc-notification-list">
                ${this.notifications.map(n => this.renderNotification(n)).join('')}
            </div>
        `;
    }

    /**
     * 渲染通知项
     * @param {Object} notification - 通知对象
     */
    renderNotification(notification) {
        const isUnread = !notification.readAt;
        const timeAgo = window.TCUtils.formatRelativeTime(notification.createdAt);
        const icon = this.notificationService.getTypeIcon(notification.type);
        const typeLabel = this.notificationService.getTypeLabel(notification.type);

        return `
            <div class="tc-notification-item ${isUnread ? 'unread' : ''}" data-notification-id="${notification.id}">
                <div class="tc-notification-icon">${icon}</div>
                <div class="tc-notification-body">
                    <div class="tc-notification-header">
                        <span class="tc-notification-type">${typeLabel}</span>
                        <span class="tc-notification-time">${timeAgo}</span>
                    </div>
                    <div class="tc-notification-title">${window.TCUtils.escapeHtml(notification.title)}</div>
                    <div class="tc-notification-content">${window.TCUtils.escapeHtml(notification.content)}</div>
                </div>
                <div class="tc-notification-actions">
                    ${isUnread ? `
                        <button class="tc-action-btn tc-mark-read-btn" data-notification-id="${notification.id}" title="标为已读">
                            ✓
                        </button>
                    ` : ''}
                    <button class="tc-action-btn tc-delete-notification-btn" data-notification-id="${notification.id}" title="删除">
                        ×
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 全部已读
        const markAllReadBtn = document.getElementById('tc-mark-all-read');
        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', () => this.markAllAsRead());
        }

        // 清空收件箱
        const clearInboxBtn = document.getElementById('tc-clear-inbox');
        if (clearInboxBtn) {
            clearInboxBtn.addEventListener('click', () => this.confirmClearInbox());
        }

        // 标记单条为已读
        document.querySelectorAll('.tc-mark-read-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const notificationId = btn.dataset.notificationId;
                this.markAsRead(notificationId);
            });
        });

        // 删除单条通知
        document.querySelectorAll('.tc-delete-notification-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const notificationId = btn.dataset.notificationId;
                this.deleteNotification(notificationId);
            });
        });

        // 点击通知查看详情
        document.querySelectorAll('.tc-notification-item').forEach(item => {
            item.addEventListener('click', () => {
                const notificationId = item.dataset.notificationId;
                this.viewNotification(notificationId);
            });
        });
    }

    /**
     * 标记单条为已读
     * @param {string} notificationId - 通知 ID
     */
    async markAsRead(notificationId) {
        await this.notificationService.markAsRead(this.currentUserId, notificationId);
        await this.loadNotifications();
        this.render();
        this.bindEvents();
    }

    /**
     * 全部已读
     */
    async markAllAsRead() {
        await this.notificationService.markAllAsRead(this.currentUserId);
        this.panel.api.ui.showToast('已全部标记为已读', 'success');
        await this.loadNotifications();
        this.render();
        this.bindEvents();
    }

    /**
     * 删除通知
     * @param {string} notificationId - 通知 ID
     */
    async deleteNotification(notificationId) {
        await this.notificationService.deleteNotification(this.currentUserId, notificationId);
        await this.loadNotifications();
        this.render();
        this.bindEvents();
    }

    /**
     * 确认清空收件箱
     */
    confirmClearInbox() {
        const modal = document.createElement('div');
        modal.className = 'tc-modal open';
        modal.innerHTML = `
            <div class="tc-modal-content">
                <div class="tc-modal-header">
                    <span class="tc-modal-title">确认清空</span>
                    <button class="tc-modal-close">×</button>
                </div>
                <div class="tc-modal-body">
                    <p>确定要清空所有通知吗？</p>
                    <p class="tc-warning">此操作不可恢复。</p>
                </div>
                <div class="tc-modal-footer">
                    <button class="tc-btn tc-btn-secondary tc-modal-cancel">取消</button>
                    <button class="tc-btn tc-btn-danger" id="tc-confirm-clear">清空</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.tc-modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.tc-modal-cancel').addEventListener('click', () => modal.remove());

        modal.querySelector('#tc-confirm-clear').addEventListener('click', async () => {
            await this.notificationService.clearInbox(this.currentUserId);
            this.panel.api.ui.showToast('收件箱已清空', 'success');
            modal.remove();
            await this.loadNotifications();
            this.render();
            this.bindEvents();
        });
    }

    /**
     * 查看通知详情
     * @param {string} notificationId - 通知 ID
     */
    async viewNotification(notificationId) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (!notification) return;

        // 标记为已读
        if (!notification.readAt) {
            await this.notificationService.markAsRead(this.currentUserId, notificationId);
        }

        // 根据类型跳转到相应视图
        if (notification.targetType === 'task') {
            this.eventBus.emit('task.detail', {
                taskId: notification.targetId
            });
        } else if (notification.targetType === 'plan') {
            this.eventBus.emit('view.changed', {
                view: 'plans'
            });
        } else if (notification.targetType === 'project') {
            this.eventBus.emit('project.changed', {
                projectId: notification.targetId
            });
        }
    }

    /**
     * 刷新
     */
    async refresh() {
        await this.loadNotifications();
        this.render();
        this.bindEvents();
    }

    /**
     * 销毁
     */
    destroy() {
        // 清理
    }
}

// 导出
window.TCInboxView = InboxView;
/**
 * 团队协作插件 - 项目设置视图
 */

class ProjectSettingsView {
    constructor(panel, projectService, permissionService, eventBus, api) {
        this.panel = panel;
        this.projectService = projectService;
        this.permission = permissionService;
        this.eventBus = eventBus;
        this.api = api;
        this.currentProjectId = null;
        this.currentUserId = null;
        this.project = null;
    }

    /**
     * 初始化
     * @param {string} projectId - 项目 ID
     * @param {string} userId - 用户 ID
     */
    async init(projectId, userId) {
        this.currentProjectId = projectId;
        this.currentUserId = userId;
        await this.loadProject();
        this.render();
        this.bindEvents();
    }

    /**
     * 加载项目
     */
    async loadProject() {
        if (!this.currentProjectId) return;
        try {
            this.project = await this.projectService.getProject(this.currentProjectId);
        } catch (error) {
            console.error('[ProjectSettingsView] 加载项目失败:', error);
            this.project = null;
        }
    }

    /**
     * 渲染视图
     */
    render() {
        if (!this.project) {
            this.panel.showEmpty('⚙️', '请选择项目', '在左侧选择一个项目来管理设置');
            return;
        }

        const project = this.project;
        const memberInfo = this.permission.getMemberRole(this.currentUserId, project);
        const canEdit = this.permission.canEditProject(this.currentUserId, project);

        const html = `
            <div class="tc-project-settings">
                <div class="tc-settings-header">
                    <div class="tc-settings-title">项目设置</div>
                </div>
                <div class="tc-settings-content">
                    <!-- 基本信息 -->
                    <div class="tc-settings-section">
                        <div class="tc-section-title">基本信息</div>
                        <div class="tc-info-row">
                            <span class="tc-info-label">项目名称</span>
                            <span class="tc-info-value">${window.TCUtils.escapeHtml(project.name)}</span>
                        </div>
                        <div class="tc-info-row">
                            <span class="tc-info-label">项目描述</span>
                            <span class="tc-info-value">${project.description ? window.TCUtils.escapeHtml(project.description) : '<span class="tc-placeholder">暂无描述</span>'}</span>
                        </div>
                        <div class="tc-info-row">
                            <span class="tc-info-label">你的角色</span>
                            <span class="tc-info-value tc-role-badge tc-role-${memberInfo?.role || 'guest'}">${this.getRoleLabel(memberInfo?.role)}</span>
                        </div>
                    </div>

                    <!-- 邀请码 -->
                    <div class="tc-settings-section">
                        <div class="tc-section-title">邀请码</div>
                        <div class="tc-invite-code-section">
                            <div class="tc-invite-code-box">
                                <span class="tc-invite-code-text">${project.inviteCode || '未生成'}</span>
                            </div>
                            <div class="tc-invite-code-actions">
                                <button class="tc-btn tc-btn-secondary tc-btn-sm" id="tc-copy-invite">复制邀请码</button>
                                ${canEdit ? '<button class="tc-btn tc-btn-secondary tc-btn-sm" id="tc-regenerate-invite">重新生成</button>' : ''}
                            </div>
                        </div>
                    </div>

                    <!-- 成员列表 -->
                    <div class="tc-settings-section">
                        <div class="tc-section-title">成员列表 (${project.members?.length || 0})</div>
                        <div class="tc-members-list">
                            ${this.renderMembersList(project.members || [])}
                        </div>
                    </div>

                    <!-- 项目统计 -->
                    <div class="tc-settings-section">
                        <div class="tc-section-title">项目统计</div>
                        <div class="tc-stats-grid">
                            <div class="tc-stat-item">
                                <div class="tc-stat-value">${project.stats?.totalTasks || 0}</div>
                                <div class="tc-stat-label">总任务数</div>
                            </div>
                            <div class="tc-stat-item">
                                <div class="tc-stat-value">${project.stats?.completedTasks || 0}</div>
                                <div class="tc-stat-label">已完成</div>
                            </div>
                            <div class="tc-stat-item">
                                <div class="tc-stat-value">${project.stats?.overdueTasks || 0}</div>
                                <div class="tc-stat-label">已逾期</div>
                            </div>
                            <div class="tc-stat-item">
                                <div class="tc-stat-value">${project.stats?.totalPlans || 0}</div>
                                <div class="tc-stat-label">学习计划</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.panel.setContent(html);
    }

    /**
     * 渲染成员列表
     * @param {Array} members - 成员列表
     * @returns {string} HTML
     */
    renderMembersList(members) {
        return members.map(member => `
            <div class="tc-member-item">
                <div class="tc-member-avatar">${this.getInitials(member.userId)}</div>
                <div class="tc-member-info">
                    <div class="tc-member-name">${window.TCUtils.escapeHtml(member.userId)}</div>
                    <div class="tc-member-role tc-role-${member.role}">${this.getRoleLabel(member.role)}</div>
                </div>
                <div class="tc-member-joined">${window.TCUtils.formatDate(member.joinedAt)}</div>
            </div>
        `).join('');
    }

    /**
     * 获取用户名首字母
     * @param {string} userId - 用户 ID
     * @returns {string}
     */
    getInitials(userId) {
        if (!userId) return '?';
        return userId.substring(0, 2).toUpperCase();
    }

    /**
     * 获取角色标签
     * @param {string} role - 角色
     * @returns {string}
     */
    getRoleLabel(role) {
        const labels = {
            'owner': '创建者',
            'admin': '管理员',
            'member': '成员',
            'guest': '访客'
        };
        return labels[role] || '未知';
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 复制邀请码
        const copyBtn = document.getElementById('tc-copy-invite');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyInviteCode());
        }

        // 重新生成邀请码
        const regenBtn = document.getElementById('tc-regenerate-invite');
        if (regenBtn) {
            regenBtn.addEventListener('click', () => this.confirmRegenerateInvite());
        }
    }

    /**
     * 复制邀请码
     */
    copyInviteCode() {
        if (!this.project?.inviteCode) {
            this.api.ui.showToast('邀请码不存在', 'warning');
            return;
        }

        navigator.clipboard.writeText(this.project.inviteCode).then(() => {
            this.api.ui.showToast('邀请码已复制到剪贴板', 'success');
        }).catch(() => {
            this.api.ui.showToast('复制失败，请手动复制', 'error');
        });
    }

    /**
     * 确认重新生成邀请码
     */
    confirmRegenerateInvite() {
        const modal = document.createElement('div');
        modal.className = 'tc-modal open';
        modal.innerHTML = `
            <div class="tc-modal-content">
                <div class="tc-modal-header">
                    <span class="tc-modal-title">重新生成邀请码</span>
                    <button class="tc-modal-close">×</button>
                </div>
                <div class="tc-modal-body">
                    <p>确定要重新生成邀请码吗？</p>
                    <p class="tc-warning">旧的邀请码将立即失效，已使用旧邀请码的用户不受影响。</p>
                </div>
                <div class="tc-modal-footer">
                    <button class="tc-btn tc-btn-secondary tc-modal-cancel">取消</button>
                    <button class="tc-btn tc-btn-danger" id="tc-confirm-regen">重新生成</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.tc-modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.tc-modal-cancel').addEventListener('click', () => modal.remove());

        modal.querySelector('#tc-confirm-regen').addEventListener('click', async () => {
            try {
                const newCode = await this.projectService.regenerateInviteCode(
                    this.currentProjectId,
                    this.currentUserId
                );

                this.project.inviteCode = newCode;
                this.api.ui.showToast('邀请码已重新生成', 'success');
                modal.remove();
                this.render();
                this.bindEvents();
            } catch (error) {
                this.api.ui.showToast('重新生成邀请码失败: ' + error.message, 'error');
            }
        });
    }

    /**
     * 刷新
     */
    async refresh() {
        await this.loadProject();
        this.render();
        this.bindEvents();
    }

    /**
     * 销毁
     */
    destroy() {
        this.project = null;
    }
}

// 导出
window.TCProjectSettingsView = ProjectSettingsView;
/**
 * 团队协作插件 - 活动流视图
 */

class ActivityView {
    constructor(panel, eventBus, storage, crypto) {
        this.panel = panel;
        this.eventBus = eventBus;
        this.storage = storage;
        this.crypto = crypto;
        this.currentProjectId = null;
        this.currentUserId = null;
        this.activities = [];
        this.setupEventListeners();
    }

    /**
     * 设置事件监听，收集活动
     */
    setupEventListeners() {
        const C = window.TCConstants;

        // 项目创建
        this.eventBus.on(C.EVENTS.PROJECT_CREATED, (data) => {
            this.addActivity({
                type: 'project_created',
                projectId: data.projectId,
                userId: data.userId,
                description: '创建了项目'
            });
        });

        // 成员加入
        this.eventBus.on(C.EVENTS.MEMBER_JOINED, (data) => {
            this.addActivity({
                type: 'member_joined',
                projectId: data.projectId,
                userId: data.userId,
                description: '加入了项目'
            });
        });

        // 任务创建
        this.eventBus.on(C.EVENTS.TASK_CREATED, (data) => {
            this.addActivity({
                type: 'task_created',
                projectId: data.projectId,
                userId: data.createdBy,
                targetType: 'task',
                targetId: data.taskId,
                description: '创建了任务'
            });
        });

        // 任务状态变更
        this.eventBus.on(C.EVENTS.TASK_STATUS_CHANGED, (data) => {
            const statusLabels = {
                'todo': '待办',
                'doing': '进行中',
                'review': '审核中',
                'done': '已完成'
            };
            this.addActivity({
                type: 'task_status_changed',
                projectId: data.projectId,
                userId: data.userId,
                targetType: 'task',
                targetId: data.taskId,
                description: `将任务状态从 "${statusLabels[data.from] || data.from}" 改为 "${statusLabels[data.to] || data.to}"`
            });
        });

        // 评论添加
        this.eventBus.on(C.EVENTS.COMMENT_ADDED, (data) => {
            this.addActivity({
                type: 'comment_added',
                projectId: data.projectId,
                userId: data.authorId,
                targetType: data.targetType,
                targetId: data.targetId,
                description: '添加了评论'
            });
        });

        // 学习计划提交
        this.eventBus.on(C.EVENTS.PLAN_SUBMITTED, (data) => {
            this.addActivity({
                type: 'plan_submitted',
                projectId: data.projectId,
                userId: data.userId,
                targetType: 'plan',
                targetId: data.planId,
                description: '提交了学习成果'
            });
        });
    }

    /**
     * 添加活动
     * @param {Object} activity - 活动对象
     */
    addActivity(activity) {
        const C = window.TCConstants;
        activity.id = C.ID_PREFIX.ACTIVITY + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        activity.timestamp = Date.now();
        
        // 添加到活动列表开头
        this.activities.unshift(activity);
        
        // 限制活动数量
        if (this.activities.length > 100) {
            this.activities = this.activities.slice(0, 100);
        }
    }

    /**
     * 初始化
     * @param {string} projectId - 项目 ID
     * @param {string} userId - 用户 ID
     */
    async init(projectId, userId) {
        this.currentProjectId = projectId;
        this.currentUserId = userId;
        this.render();
        this.bindEvents();
    }

    /**
     * 渲染视图
     */
    render() {
        // 过滤当前项目的活动
        const projectActivities = this.currentProjectId
            ? this.activities.filter(a => a.projectId === this.currentProjectId)
            : this.activities;

        const html = `
            <div class="tc-activity-view">
                <div class="tc-activity-header">
                    <div class="tc-activity-title">活动流</div>
                    <button class="tc-btn tc-btn-secondary tc-btn-sm" id="tc-clear-activities">
                        清空记录
                    </button>
                </div>
                <div class="tc-activity-content">
                    ${projectActivities.length === 0 ? this.renderEmpty() : this.renderActivityList(projectActivities)}
                </div>
            </div>
        `;

        this.panel.setContent(html);
    }

    /**
     * 渲染空状态
     */
    renderEmpty() {
        return `
            <div class="tc-activity-empty">
                <div class="tc-empty-icon">📊</div>
                <div class="tc-empty-title">暂无活动</div>
                <div class="tc-empty-text">项目中的操作记录将在这里显示</div>
            </div>
        `;
    }

    /**
     * 渲染活动列表
     * @param {Array} activities - 活动列表
     * @returns {string} HTML
     */
    renderActivityList(activities) {
        const typeIcons = {
            'project_created': '📁',
            'member_joined': '👤',
            'task_created': '📋',
            'task_status_changed': '🔄',
            'comment_added': '💬',
            'plan_submitted': '📝'
        };

        return `
            <div class="tc-activity-list">
                ${activities.map(activity => `
                    <div class="tc-activity-item">
                        <div class="tc-activity-icon">${typeIcons[activity.type] || '📌'}</div>
                        <div class="tc-activity-body">
                            <div class="tc-activity-meta">
                                <span class="tc-activity-user">${window.TCUtils.escapeHtml(activity.userId)}</span>
                                <span class="tc-activity-desc">${activity.description}</span>
                            </div>
                            <div class="tc-activity-time">${window.TCUtils.formatRelativeTime(activity.timestamp)}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        const clearBtn = document.getElementById('tc-clear-activities');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (confirm('确定要清空所有活动记录吗？')) {
                    this.activities = this.currentProjectId
                        ? this.activities.filter(a => a.projectId !== this.currentProjectId)
                        : [];
                    this.render();
                    this.bindEvents();
                    this.panel.api.ui.showToast('活动记录已清空', 'success');
                }
            });
        }
    }

    /**
     * 刷新
     */
    async refresh() {
        this.render();
        this.bindEvents();
    }

    /**
     * 销毁
     */
    destroy() {
        // 保留活动数据
    }
}

// 导出
window.TCActivityView = ActivityView;

    // ============ 插件主类 ============

    // 插件主类
    class TeamCollabPlugin {
        constructor(api) {
            this.api = api;
            this.isActivated = false;

            // 核心组件
            this.eventBus = null;
            this.crypto = null;
            this.storage = null;
            this.indexManager = null;
            this.permissionService = null;
            this.projectService = null;
            this.taskService = null;
            this.commentService = null;
            this.planService = null;
            this.notificationService = null;
            this.importExportService = null;
            this.markdownRenderer = null;

            // UI 组件
            this.panel = null;
            this.sidebar = null;
            this.taskBoard = null;
            this.taskList = null;
            this.taskDetail = null;
            this.commentInput = null;
            this.commentList = null;
            this.planView = null;
            this.inboxView = null;
            this.projectSettingsView = null;
            this.activityView = null;

            // 按钮相关
            this.collabBtn = null;
            this.collabButtonObserver = null;
            this.collabButtonPollInterval = null;

            // 当前状态
            this.currentUserId = null;
            this.currentProjectId = null;
            this.currentView = 'tasks';
        }

        /**
         * 插件激活
         */
        async onActivate() {
            try {
                console.log('[团队协作] 插件激活中...');

                // 初始化核心组件
                await this.initCore();

                // 获取当前用户
                await this.initCurrentUser();

                // 初始化 UI
                this.initUI();

                // 绑定事件
                this.bindEvents();

                // 添加工具栏按钮
                this.tryAddCollabButton();

                // 注册全局引用（用于调试）
                window.tcPlugin = this;

                this.isActivated = true;
                console.log('[团队协作] 插件激活成功');

                this.api.ui.showToast('团队协作插件已启用', 'success');

            } catch (error) {
                console.error('[团队协作] 插件激活失败:', error);
                this.api.ui.showToast('团队协作插件激活失败: ' + error.message, 'error');
            }
        }

        /**
         * 插件停用
         */
        async onDeactivate() {
            try {
                console.log('[团队协作] 插件停用中...');

                // 移除工具栏按钮
                this.removeCollabButton();

                // 销毁 UI
                if (this.panel) {
                    this.panel.destroy();
                }

                // 清理事件总线
                if (this.eventBus) {
                    this.eventBus.clear();
                }

                // 清除全局引用
                window.tcPlugin = null;

                this.isActivated = false;
                console.log('[团队协作] 插件已停用');

            } catch (error) {
                console.error('[团队协作] 插件停用失败:', error);
            }
        }

        /**
         * 初始化核心组件
         */
        async initCore() {
            const EventBus = window.TCEventBus;
            const CryptoManager = window.TCCryptoManager;
            const StorageAdapter = window.TCStorageAdapter;
            const IndexManager = window.TCIndexManager;
            const PermissionService = window.TCPermissionService;
            const ProjectService = window.TCProjectService;
            const TaskService = window.TCTaskService;
            const CommentService = window.TCCommentService;
            const PlanService = window.TCPlanService;
            const NotificationService = window.TCNotificationService;
            const MarkdownRenderer = window.TCMarkdownRenderer;

            // 事件总线
            this.eventBus = new EventBus();

            // 加密管理器
            this.crypto = new CryptoManager();
            await this.crypto.init(this.api);

            // 存储适配器
            this.storage = new StorageAdapter(this.api, this.crypto);

            // 索引管理器
            this.indexManager = new IndexManager(this.storage, this.eventBus);

            // 权限服务
            this.permissionService = new PermissionService(this.storage, this.eventBus);

            // 项目服务
            this.projectService = new ProjectService(
                this.storage,
                this.crypto,
                this.permissionService,
                this.indexManager,
                this.eventBus
            );

            // 任务服务
            this.taskService = new TaskService(
                this.storage,
                this.crypto,
                this.permissionService,
                this.indexManager,
                this.eventBus
            );

            // 评论服务
            this.commentService = new CommentService(
                this.storage,
                this.crypto,
                this.permissionService,
                this.eventBus
            );

            // 学习计划服务
            this.planService = new PlanService(
                this.storage,
                this.crypto,
                this.permissionService,
                this.indexManager,
                this.eventBus
            );

            // 通知服务
            this.notificationService = new NotificationService(
                this.storage,
                this.crypto,
                this.eventBus
            );

            // 导入导出服务
            this.importExportService = new ImportExportService(
                this.storage,
                this.crypto,
                this.permissionService,
                this.indexManager,
                this.eventBus
            );

            // Markdown 渲染器
            this.markdownRenderer = new MarkdownRenderer();

            console.log('[团队协作] 核心组件初始化完成');
        }

        /**
         * 初始化当前用户
         */
        async initCurrentUser() {
            try {
                const basePath = typeof top_level_path !== 'undefined' ? top_level_path : '';
                const response = await this.api.http.get(basePath + '/api/get_current_user');
                if (response && response.uid) {
                    this.currentUserId = response.uid;
                }
            } catch (error) {
                console.warn('[团队协作] 获取用户信息失败，使用默认值');
            }

            if (!this.currentUserId) {
                let userId = await this.api.storage.get('plugin:team-collab:temp-user-id');
                if (!userId) {
                    userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                    await this.api.storage.set('plugin:team-collab:temp-user-id', userId);
                }
                this.currentUserId = userId;
            }

            console.log('[团队协作] 当前用户 ID:', this.currentUserId);
        }

        /**
         * 初始化 UI
         */
        initUI() {
            const Panel = window.TCPanel;
            const Sidebar = window.TCSidebar;
            const TaskBoard = window.TCTaskBoard;
            const TaskList = window.TCTaskList;
            const TaskDetail = window.TCTaskDetail;
            const CommentInput = window.TCCommentInput;
            const CommentList = window.TCCommentList;
            const PlanView = window.TCPlanView;
            const InboxView = window.TCInboxView;
            const ProjectSettingsView = window.TCProjectSettingsView;

            // 创建面板
            this.panel = new Panel(this.api);
            this.panel.create();

            // 创建侧边栏
            this.sidebar = new Sidebar(
                this.panel,
                this.projectService,
                this.indexManager,
                this.crypto,
                this.eventBus,
                this.importExportService,
                this.notificationService
            );

            // 创建任务看板
            this.taskBoard = new TaskBoard(
                this.panel,
                this.taskService,
                this.indexManager,
                this.eventBus,
                this.projectService,
                this.crypto
            );

            // 创建任务列表
            this.taskList = new TaskList(
                this.panel,
                this.taskService,
                this.indexManager,
                this.eventBus
            );

            // 创建任务详情
            this.taskDetail = new TaskDetail(
                this.panel,
                this.taskService,
                this.projectService,
                this.eventBus,
                this.commentService,
                this.markdownRenderer
            );

            // 创建评论输入框
            this.commentInput = new CommentInput(
                this.panel,
                this.commentService,
                this.markdownRenderer,
                this.eventBus
            );

            // 创建评论列表
            this.commentList = new CommentList(
                this.panel,
                this.commentService,
                this.markdownRenderer,
                this.eventBus
            );

            // 创建学习计划视图
            this.planView = new PlanView(
                this.panel,
                this.planService,
                this.notificationService,
                this.eventBus,
                this.projectService,
                this.commentService,
                this.markdownRenderer
            );

            // 创建收件箱视图
            this.inboxView = new InboxView(
                this.panel,
                this.notificationService,
                this.eventBus
            );

            // 创建项目设置视图
            this.projectSettingsView = new ProjectSettingsView(
                this.panel,
                this.projectService,
                this.permissionService,
                this.eventBus,
                this.api
            );

            // 创建活动流视图
            this.activityView = new ActivityView(
                this.panel,
                this.eventBus,
                this.storage,
                this.crypto
            );

            console.log('[团队协作] UI 初始化完成');
        }

        /**
         * 绑定事件
         */
        bindEvents() {
            // 项目切换事件
            this.eventBus.on('project.changed', async (data) => {
                this.currentProjectId = data.projectId;
                await this.showTaskView();
            });

            // 视图切换事件
            this.eventBus.on('view.changed', async (data) => {
                this.currentProjectId = data.projectId || this.currentProjectId;
                switch (data.view) {
                    case 'tasks':
                    case 'task-board':
                        await this.showTaskView('board');
                        break;
                    case 'task-list':
                        await this.showTaskView('list');
                        break;
                    case 'plans':
                        await this.showPlansView();
                        break;
                    case 'inbox':
                        await this.showInboxView();
                        break;
                    case 'activity':
                        this.showActivityView();
                        break;
                    case 'project-settings':
                        await this.showProjectSettingsView();
                        break;
                }
            });

            // 任务详情事件
            this.eventBus.on('task.detail', async (data) => {
                if (data.task) {
                    await this.taskDetail.show(data.task, this.currentUserId);
                } else if (data.taskId) {
                    const task = await this.taskService.getTask(data.taskId, this.currentUserId);
                    if (task) {
                        await this.taskDetail.show(task, this.currentUserId);
                    }
                }
            });

            // 返回事件
            this.eventBus.on('task.back', async () => {
                await this.showTaskView();
            });
        }

        /**
         * 显示任务视图
         * @param {string} type - 'board' 或 'list'
         */
        async showTaskView(type = 'board') {
            if (!this.currentProjectId) {
                this.panel.showEmpty('📋', '请选择项目', '在左侧选择一个项目开始管理任务');
                return;
            }

            if (type === 'board') {
                await this.taskBoard.init(this.currentProjectId, this.currentUserId);
            } else {
                await this.taskList.init(this.currentProjectId, this.currentUserId);
            }
        }

        /**
         * 显示学习计划视图
         */
        async showPlansView() {
            if (!this.currentProjectId) {
                this.panel.showEmpty('📚', '请选择项目', '在左侧选择一个项目开始管理学习计划');
                return;
            }
            await this.planView.init(this.currentProjectId, this.currentUserId);
        }

        /**
         * 显示收件箱视图
         */
        async showInboxView() {
            await this.inboxView.init(this.currentUserId);
        }

        /**
         * 显示活动流视图
         */
        async showActivityView() {
            await this.activityView.init(this.currentProjectId, this.currentUserId);
        }

        /**
         * 显示项目设置视图
         */
        async showProjectSettingsView() {
            if (!this.currentProjectId) {
                this.panel.showEmpty('⚙️', '请选择项目', '在左侧选择一个项目来管理设置');
                return;
            }
            await this.projectSettingsView.init(this.currentProjectId, this.currentUserId);
        }

        /**
         * 尝试添加协作按钮
         */
        tryAddCollabButton() {
            if (this.addCollabButton()) return;

            this.collabButtonObserver = new MutationObserver(() => {
                this.checkAndAddCollabButton();
            });

            const mainEl = document.querySelector('main');
            if (mainEl) {
                this.collabButtonObserver.observe(mainEl, {
                    childList: true,
                    subtree: true
                });
            }

            this.collabButtonPollInterval = setInterval(() => {
                this.checkAndAddCollabButton();
            }, 1000);
        }

        /**
         * 检查并添加协作按钮
         */
        checkAndAddCollabButton() {
            const container = document.querySelector('.chat-session-inputarea-othertypes');
            if (!container) return;

            if (!document.querySelector('.chat-session-inputarea-othertypes-collab')) {
                this.addCollabButton();
            }
        }

        /**
         * 添加协作按钮
         */
        addCollabButton() {
            const container = document.querySelector('.chat-session-inputarea-othertypes');
            if (!container) return false;

            if (document.querySelector('.chat-session-inputarea-othertypes-collab')) {
                return true;
            }

            this.collabBtn = document.createElement('button');
            this.collabBtn.className = 'chat-session-inputarea-othertypes-collab';
            this.collabBtn.innerHTML = '<i class="bi bi-people"></i> 协作';
            this.collabBtn.title = '团队协作';
            this.collabBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.togglePanel();
            });

            const voteBtn = container.querySelector('.chat-session-inputarea-othertypes-vote');
            if (voteBtn) {
                voteBtn.after(this.collabBtn);
            } else {
                const sendBtn = container.querySelector('.chat-session-inputarea-sendbtn');
                if (sendBtn) {
                    container.insertBefore(this.collabBtn, sendBtn);
                } else {
                    container.appendChild(this.collabBtn);
                }
            }

            console.log('[团队协作] 按钮添加成功');
            return true;
        }

        /**
         * 移除协作按钮
         */
        removeCollabButton() {
            if (this.collabBtn) {
                this.collabBtn.remove();
                this.collabBtn = null;
            }

            if (this.collabButtonObserver) {
                this.collabButtonObserver.disconnect();
                this.collabButtonObserver = null;
            }

            if (this.collabButtonPollInterval) {
                clearInterval(this.collabButtonPollInterval);
                this.collabButtonPollInterval = null;
            }
        }

        /**
         * 切换面板
         */
        async togglePanel() {
            if (!this.panel) return;

            if (this.panel.isOpen) {
                this.panel.close();
            } else {
                this.panel.open();
                await this.sidebar.init(this.currentUserId);

                const projects = await this.projectService.getUserProjects(this.currentUserId);
                if (projects.length > 0) {
                    this.currentProjectId = projects[0].id;
                    await this.showTaskView('board');
                }
            }
        }
    }



    /* ==================== 2026-03-28 功能修复补丁（基于上传版本） ==================== */
    (function () {
        const C = window.TCConstants;

        function normalizeUserId(value) {
            return String(value || '').trim().replace(/^@+/, '').toLowerCase();
        }

        function normalizeChecklist(items) {
            return (Array.isArray(items) ? items : [])
                .map((item, idx) => {
                    if (typeof item === 'string') {
                        return { id: `chk_${idx}_${Date.now()}`, text: item.trim(), completed: false };
                    }
                    return {
                        id: item?.id || `chk_${idx}_${Date.now()}`,
                        text: String(item?.text || '').trim(),
                        completed: !!item?.completed
                    };
                })
                .filter(item => item.text);
        }

        function checklistProgress(items) {
            const list = normalizeChecklist(items);
            if (!list.length) return 0;
            const done = list.filter(i => i.completed).length;
            return Math.round((done / list.length) * 100);
        }

        function escapeHtml(s) { return window.TCUtils.escapeHtml(String(s || '')); }

        function arrayUnique(arr) { return Array.from(new Set((arr || []).filter(Boolean))); }

        // ===== StorageAdapter 扩展 =====
        const oldGetKeys = window.TCStorageAdapter.prototype.getKeys;
        window.TCStorageAdapter.prototype.getKeys = function () {
            const keys = oldGetKeys.call(this);
            return {
                ...keys,
                sharedMemberProjectIndex: (userId) => `${C.STORAGE_PREFIX}:member-projects:${normalizeUserId(userId)}`,
                projectRegistry: () => `${C.STORAGE_PREFIX}:project-registry`,
                driveRootFolder: () => `${C.STORAGE_PREFIX}:drive-root-folder`
            };
        };
        window.TCStorageAdapter.prototype.saveProjectPlanIndex = async function (projectId, planIds) {
            const keys = this.getKeys();
            await this.save(keys.projectPlanIndex(projectId), planIds || []);
        };
        window.TCStorageAdapter.prototype.loadProjectPlanIndex = async function (projectId) {
            const keys = this.getKeys();
            return await this.load(keys.projectPlanIndex(projectId)) || [];
        };
        window.TCStorageAdapter.prototype.saveSharedMemberProjectIndex = async function (userId, projectIds) {
            const keys = this.getKeys();
            await this.save(keys.sharedMemberProjectIndex(userId), arrayUnique(projectIds));
        };
        window.TCStorageAdapter.prototype.loadSharedMemberProjectIndex = async function (userId) {
            const keys = this.getKeys();
            return await this.load(keys.sharedMemberProjectIndex(userId)) || [];
        };
        window.TCStorageAdapter.prototype.saveProjectRegistry = async function (projectIds) {
            const keys = this.getKeys();
            await this.save(keys.projectRegistry(), arrayUnique(projectIds));
        };
        window.TCStorageAdapter.prototype.loadProjectRegistry = async function () {
            const keys = this.getKeys();
            return await this.load(keys.projectRegistry()) || [];
        };
        window.TCStorageAdapter.prototype.saveAttachmentMeta = async function (meta) {
            const keys = this.getKeys();
            await this.save(keys.attachmentMeta(meta.id), meta);
        };
        window.TCStorageAdapter.prototype.loadAttachmentMeta = async function (attId) {
            const keys = this.getKeys();
            return await this.load(keys.attachmentMeta(attId));
        };
        window.TCStorageAdapter.prototype.removeAttachmentMeta = async function (attId) {
            const keys = this.getKeys();
            await this.remove(keys.attachmentMeta(attId));
        };

        // ===== 索引与项目共享可见性 =====
        window.TCIndexManager.prototype.getUserProjects = async function (userId) {
            const norm = normalizeUserId(userId);
            const ids = arrayUnique([
                ...(await this.storage.loadUserProjectIndex(userId)),
                ...(await this.storage.loadUserProjectIndex(norm)),
                ...(await this.storage.loadSharedMemberProjectIndex(userId)),
                ...(await this.storage.loadSharedMemberProjectIndex(norm))
            ]);
            const registry = await this.storage.loadProjectRegistry();
            const mergedIds = new Set(ids);
            const projects = [];
            for (const projectId of registry) mergedIds.add(projectId);
            for (const projectId of mergedIds) {
                const project = await this.storage.loadProject(projectId);
                if (!project || project.archivedAt) continue;
                const memberIds = (project.members || []).map(m => normalizeUserId(m.userId));
                if (memberIds.includes(norm) || ids.includes(projectId) || normalizeUserId(project.ownerId) === norm) {
                    projects.push(project);
                }
            }
            projects.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
            return projects;
        };

        // ===== ProjectService =====
        const ProjectService = window.TCProjectService.prototype;
        ProjectService.normalizeUserId = function (value) { return normalizeUserId(value); };
        ProjectService.ensureProjectVisibleToMember = async function (projectId, userId) {
            const raw = userId;
            const norm = normalizeUserId(userId);
            for (const uid of arrayUnique([raw, norm])) {
                const index = await this.storage.loadSharedMemberProjectIndex(uid);
                if (!index.includes(projectId)) {
                    index.push(projectId);
                    await this.storage.saveSharedMemberProjectIndex(uid, index);
                }
                const privateIndex = await this.storage.loadUserProjectIndex(uid);
                if (!privateIndex.includes(projectId)) {
                    privateIndex.push(projectId);
                    await this.storage.saveUserProjectIndex(uid, privateIndex);
                }
            }
        };
        ProjectService.removeProjectFromMemberVisibility = async function (projectId, userId) {
            const raw = userId;
            const norm = normalizeUserId(userId);
            for (const uid of arrayUnique([raw, norm])) {
                const index = await this.storage.loadSharedMemberProjectIndex(uid);
                await this.storage.saveSharedMemberProjectIndex(uid, index.filter(id => id !== projectId));
                const privateIndex = await this.storage.loadUserProjectIndex(uid);
                await this.storage.saveUserProjectIndex(uid, privateIndex.filter(id => id !== projectId));
            }
        };
        ProjectService.registerProjectInRegistry = async function (projectId) {
            const registry = await this.storage.loadProjectRegistry();
            if (!registry.includes(projectId)) {
                registry.push(projectId);
                await this.storage.saveProjectRegistry(registry);
            }
        };
        const oldCreateProject = ProjectService.createProject;
        ProjectService.createProject = async function (input, userId) {
            const project = await oldCreateProject.call(this, input, userId);
            const raw = await this.storage.loadProject(project.id);
            if (raw && raw.inviteCode) {
                const inviteCode = raw.inviteCode;
                delete raw.inviteCode;
                await this.storage.saveProject(raw);
                try { await this.storage.remove(this.storage.getKeys().invite(inviteCode)); } catch (e) {}
            }
            await this.registerProjectInRegistry(project.id);
            await this.ensureProjectVisibleToMember(project.id, userId);
            return await this.getProject(project.id);
        };
        ProjectService.joinProjectByInviteCode = async function () {
            throw new TCErrors.InviteError('已移除邀请码功能，请通过用户名邀请成员');
        };
        const oldInviteMember = ProjectService.inviteMember;
        ProjectService.inviteMember = async function (projectId, targetUserId, operatorId) {
            const normTarget = normalizeUserId(targetUserId);
            const rawProject = await this.storage.loadProject(projectId);
            if (!rawProject) throw new TCErrors.TCError('项目不存在', 'NOT_FOUND');
            this.permission.assertPermission(this.permission.canInviteMembers(operatorId, rawProject), '邀请成员');
            if ((rawProject.members || []).some(m => normalizeUserId(m.userId) === normTarget)) {
                throw new TCErrors.TCError('该用户已经是项目成员', 'ALREADY_MEMBER');
            }
            rawProject.members.push({ userId: normTarget, role: C.PROJECT_ROLE.MEMBER, joinedAt: Date.now() });
            rawProject.updatedAt = Date.now();
            rawProject.version = (rawProject.version || 1) + 1;
            await this.storage.saveProject(rawProject);
            await this.registerProjectInRegistry(projectId);
            await this.ensureProjectVisibleToMember(projectId, normTarget);
            this.eventBus.emit(C.EVENTS.MEMBER_JOINED, { projectId, userId: normTarget });
            return await this.getProject(projectId);
        };
        const oldRemoveMember = ProjectService.removeMember;
        ProjectService.removeMember = async function (projectId, targetUserId, operatorId) {
            await oldRemoveMember.call(this, projectId, targetUserId, operatorId);
            await this.removeProjectFromMemberVisibility(projectId, targetUserId);
        };
        ProjectService.getParticipatedProjects = async function (userId) {
            const all = await this.getUserProjects(userId);
            const norm = normalizeUserId(userId);
            return all.filter(p => normalizeUserId(p.ownerId) !== norm);
        };
        ProjectService.deleteProject = async function (projectId, userId) {
            const project = await this.storage.loadProject(projectId);
            if (!project) throw new TCErrors.TCError('项目不存在', 'NOT_FOUND');
            this.permission.assertPermission(this.permission.canDeleteProject(userId, project), '删除项目');
            project.archivedAt = Date.now();
            project.updatedAt = Date.now();
            project.version = (project.version || 1) + 1;
            await this.storage.saveProject(project);
            const registry = await this.storage.loadProjectRegistry();
            await this.storage.saveProjectRegistry(registry.filter(id => id !== projectId));
            for (const member of (project.members || [])) {
                await this.removeProjectFromMemberVisibility(projectId, member.userId);
            }
        };

        // ===== 计划索引 =====
        const oldCreatePlan = window.TCPlanService.prototype.createPlan;
        window.TCPlanService.prototype.createPlan = async function (input, userId) {
            const plan = await oldCreatePlan.call(this, input, userId);
            const index = await this.storage.loadProjectPlanIndex(input.projectId);
            if (!index.includes(plan.id)) {
                index.push(plan.id);
                await this.storage.saveProjectPlanIndex(input.projectId, index);
            }
            return plan;
        };
        window.TCPlanService.prototype.getProjectPlans = async function (projectId) {
            const planIds = await this.storage.loadProjectPlanIndex(projectId);
            const plans = [];
            for (const planId of planIds) {
                const plan = await this.getPlan(planId);
                if (plan && !plan.deletedAt && plan.projectId === projectId) plans.push(plan);
            }
            plans.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
            return plans;
        };

        // ===== 任务 checklist / progress =====
        const oldCreateTask = window.TCTaskService.prototype.createTask;
        window.TCTaskService.prototype.createTask = async function (input, userId) {
            const checklist = normalizeChecklist(input.checklist);
            input.assigneeIds = arrayUnique((input.assigneeIds && input.assigneeIds.length) ? input.assigneeIds : [userId]);
            const task = await oldCreateTask.call(this, input, userId);
            const raw = await this.storage.loadTask(task.id);
            raw.assigneeIds = input.assigneeIds;
            raw.checklist = checklist;
            raw.progressMode = checklist.length ? 'checklist' : 'manual';
            raw.progress = checklist.length ? checklistProgress(checklist) : (raw.progress || 0);
            if (raw.progress >= 100) {
                raw.status = C.TASK_STATUS.DONE;
                raw.completedAt = raw.completedAt || Date.now();
            }
            await this.storage.saveTask(raw);
            await this.updateProjectStats(raw.projectId);
            return await this.getTask(raw.id, userId);
        };
        const oldUpdateTask = window.TCTaskService.prototype.updateTask;
        window.TCTaskService.prototype.updateTask = async function (taskId, updates, userId) {
            const checklist = updates.hasOwnProperty('checklist') ? normalizeChecklist(updates.checklist) : null;
            const task = await oldUpdateTask.call(this, taskId, { ...updates, checklist: undefined }, userId);
            const raw = await this.storage.loadTask(taskId);
            if (updates.assigneeIds !== undefined) raw.assigneeIds = arrayUnique(updates.assigneeIds || []);
            if (checklist !== null) {
                raw.checklist = checklist;
                raw.progressMode = checklist.length ? 'checklist' : 'manual';
                raw.progress = checklist.length ? checklistProgress(checklist) : raw.progress;
                if (raw.progress >= 100) {
                    raw.status = C.TASK_STATUS.DONE;
                    raw.completedAt = raw.completedAt || Date.now();
                } else if (raw.status === C.TASK_STATUS.DONE) {
                    raw.status = C.TASK_STATUS.DOING;
                    raw.completedAt = null;
                }
            }
            await this.storage.saveTask(raw);
            await this.updateProjectStats(raw.projectId);
            return await this.getTask(taskId, userId);
        };
        window.TCTaskService.prototype.toggleChecklistItem = async function (taskId, itemId, userId) {
            const raw = await this.storage.loadTask(taskId);
            if (!raw) throw new TCErrors.TCError('任务不存在', 'NOT_FOUND');
            raw.checklist = normalizeChecklist(raw.checklist || []).map(item => item.id === itemId ? { ...item, completed: !item.completed } : item);
            raw.progressMode = raw.checklist.length ? 'checklist' : 'manual';
            raw.progress = raw.checklist.length ? checklistProgress(raw.checklist) : raw.progress;
            if (raw.progress >= 100) {
                raw.status = C.TASK_STATUS.DONE;
                raw.completedAt = Date.now();
            } else if (raw.status === C.TASK_STATUS.DONE) {
                raw.status = C.TASK_STATUS.DOING;
                raw.completedAt = null;
            }
            raw.updatedAt = Date.now();
            await this.storage.saveTask(raw);
            await this.updateProjectStats(raw.projectId);
            return await this.getTask(taskId, userId);
        };

        // ===== 附件服务 =====
        class AttachmentService {
            constructor(api, storage) {
                this.api = api;
                this.storage = storage;
                this.rootFolderId = null;
            }
            generateId() { return `${C.ID_PREFIX.ATTACHMENT}_${Date.now()}_${Math.random().toString(36).slice(2,9)}`; }
            async ensureFolder() {
                if (this.rootFolderId) return this.rootFolderId;
                const cached = await this.storage.load(this.storage.getKeys().driveRootFolder());
                if (cached) { this.rootFolderId = cached; return cached; }
                try {
                    if (this.api.drive?.createFolder) {
                        const folder = await this.api.drive.createFolder('team-collab-attachments');
                        const id = folder?.id || folder?.folderId || folder;
                        if (id) {
                            this.rootFolderId = id;
                            await this.storage.save(this.storage.getKeys().driveRootFolder(), id);
                            return id;
                        }
                    }
                } catch (e) { console.warn('[AttachmentService] createFolder failed', e); }
                return null;
            }
            async fileToDataUrl(file) {
                return await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            }
            async uploadFiles(files, userId, onProgress) {
                const folderId = await this.ensureFolder();
                const metas = [];
                for (const file of files) {
                    const attId = this.generateId();
                    let uploadResult = null;
                    if (this.api.drive?.uploadFile) {
                        try {
                            uploadResult = await this.api.drive.uploadFile(file, folderId, onProgress);
                        } catch (e) {
                            console.warn('[AttachmentService] drive upload failed', e);
                        }
                    }
                    const isImage = /^image\//.test(file.type || '');
                    const meta = {
                        id: attId,
                        name: file.name,
                        mimeType: file.type || 'application/octet-stream',
                        size: file.size || 0,
                        projectId: null,
                        uploadedBy: userId,
                        uploadedAt: Date.now(),
                        fileId: uploadResult?.id || uploadResult?.fileId || null,
                        url: uploadResult?.url || uploadResult?.downloadUrl || uploadResult?.viewUrl || null,
                        previewUrl: isImage ? await this.fileToDataUrl(file) : null
                    };
                    await this.storage.saveAttachmentMeta(meta);
                    metas.push(meta);
                    this.eventBus?.emit?.(C.EVENTS.ATTACHMENT_UPLOADED, { attachmentId: meta.id, userId });
                }
                return metas;
            }
            async getAttachments(ids) {
                const list = [];
                for (const id of ids || []) {
                    const meta = await this.storage.loadAttachmentMeta(id);
                    if (meta) list.push(meta);
                }
                return list;
            }
            async openAttachment(meta) {
                if (!meta) return;
                if (meta.url) { window.open(meta.url, '_blank'); return; }
                if (meta.previewUrl) { window.open(meta.previewUrl, '_blank'); return; }
                if (meta.fileId && this.api.drive?.downloadFile) {
                    const res = await this.api.drive.downloadFile(meta.fileId);
                    const url = res?.url || res?.downloadUrl || null;
                    if (url) window.open(url, '_blank');
                }
            }
        }
        window.TCAttachmentService = AttachmentService;

        // 评论返回附件元数据
        const oldGetComments = window.TCCommentService.prototype.getComments;
        window.TCCommentService.prototype.getComments = async function (threadId, page=1) {
            const comments = await oldGetComments.call(this, threadId, page);
            return await Promise.all(comments.map(async c => ({ ...c, attachments: await this.storage.getAttachments?.(c.attachmentIds || []) || [] })));
        };
        const oldGetTargetComments = window.TCCommentService.prototype.getTargetComments;
        window.TCCommentService.prototype.getTargetComments = async function (targetType, targetId) {
            const comments = await oldGetTargetComments.call(this, targetType, targetId);
            return await Promise.all(comments.map(async c => ({ ...c, attachments: c.attachments || await this.storage.getAttachments?.(c.attachmentIds || []) || [] })));
        };
        window.TCStorageAdapter.prototype.getAttachments = async function(ids){ const out=[]; for (const id of ids||[]) { const m=await this.loadAttachmentMeta(id); if (m) out.push(m);} return out; };

        // ===== Sidebar =====
        window.TCSidebar.prototype.render = async function () {
            const projects = await this.projectService.getUserProjects(this.currentUserId);
            const hasProjects = projects.length > 0;
            if (!hasProjects) return this.renderEmptyState();
            if (!this.currentProjectId && projects.length) this.currentProjectId = projects[0].id;
            const html = `
                <div class="tc-sidebar-section">
                    <div class="tc-project-selector">
                        <select class="tc-project-select" id="tc-project-select">
                            ${projects.map(p => `<option value="${p.id}" ${p.id === this.currentProjectId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="tc-sidebar-section">
                    <div class="tc-sidebar-title">模块</div>
                    <div class="tc-nav-list">
                        <div class="tc-nav-item active" data-view="tasks"><span class="tc-nav-icon">📋</span><span class="tc-nav-label">任务中心</span><span class="tc-nav-badge" id="tc-task-count">0</span></div>
                        <div class="tc-nav-item" data-view="participating"><span class="tc-nav-icon">🤝</span><span class="tc-nav-label">我的参与</span></div>
                        <div class="tc-nav-item" data-view="plans"><span class="tc-nav-icon">📚</span><span class="tc-nav-label">学习计划</span></div>
                        <div class="tc-nav-item" data-view="inbox"><span class="tc-nav-icon">📥</span><span class="tc-nav-label">收件箱</span><span class="tc-nav-badge" id="tc-inbox-count" style="display:none;">0</span></div>
                        <div class="tc-nav-item" data-view="activity"><span class="tc-nav-icon">📊</span><span class="tc-nav-label">活动流</span></div>
                        <div class="tc-nav-item" data-view="project-settings"><span class="tc-nav-icon">⚙️</span><span class="tc-nav-label">项目设置</span></div>
                    </div>
                </div>
                <div class="tc-sidebar-section">
                    <div class="tc-sidebar-title">数据管理</div>
                    <div class="tc-nav-list">
                        <div class="tc-nav-item" id="tc-import-btn"><span class="tc-nav-icon">📥</span><span class="tc-nav-label">导入项目</span></div>
                        <div class="tc-nav-item" id="tc-export-btn"><span class="tc-nav-icon">📤</span><span class="tc-nav-label">导出项目</span></div>
                    </div>
                </div>
                <div class="tc-sidebar-section tc-sidebar-actions">
                    <button class="tc-btn tc-btn-primary tc-btn-block" id="tc-create-project-btn">+ 创建新项目</button>
                </div>`;
            this.panel.setSidebarContent(html);
            this.bindEvents();
            this.updateTaskCount();
            this.updateInboxCount();
        };
        window.TCSidebar.prototype.renderEmptyState = function () {
            const html = `
                <div class="tc-empty-state">
                    <div class="tc-empty-icon">🚀</div>
                    <div class="tc-empty-title">欢迎使用团队协作</div>
                    <div class="tc-empty-description">创建一个新项目，开始团队协作之旅。</div>
                    <div class="tc-empty-actions">
                        <button class="tc-btn tc-btn-primary" id="tc-create-project-btn">创建新项目</button>
                        <button class="tc-btn tc-btn-secondary" id="tc-import-btn">导入项目</button>
                    </div>
                </div>`;
            this.panel.setSidebarContent(html);
            this.bindEvents();
        };
        window.TCSidebar.prototype.bindEvents = function () {
            const projectSelect = document.getElementById('tc-project-select');
            if (projectSelect) projectSelect.addEventListener('change', e => { this.currentProjectId = e.target.value; this.onProjectChange(); });
            document.querySelectorAll('.tc-nav-item[data-view]').forEach(item => item.addEventListener('click', () => {
                document.querySelectorAll('.tc-nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                this.onViewChange(item.dataset.view);
            }));
            document.getElementById('tc-create-project-btn')?.addEventListener('click', () => this.showCreateProjectModal());
            document.getElementById('tc-import-btn')?.addEventListener('click', () => this.showImportDialog());
            document.getElementById('tc-export-btn')?.addEventListener('click', () => this.showExportDialog());
            this.eventBus.on(C.EVENTS.NOTIFICATION_RECEIVED, () => { this.updateInboxCount(); });
        };
        window.TCSidebar.prototype.showCreateProjectModal = function () {
            const modal = document.createElement('div');
            modal.className = 'tc-modal open';
            modal.innerHTML = `
            <div class="tc-modal-content">
                <div class="tc-modal-header"><span class="tc-modal-title">创建新项目</span><button class="tc-modal-close">×</button></div>
                <div class="tc-modal-body">
                    <div class="tc-form-group"><label class="tc-form-label">项目名称 *</label><input type="text" class="tc-form-input" id="tc-project-name" placeholder="输入项目名称" maxlength="50"></div>
                    <div class="tc-form-group"><label class="tc-form-label">项目描述</label><textarea class="tc-form-textarea" id="tc-project-description" placeholder="输入项目描述（可选）" rows="3"></textarea></div>
                    <div class="tc-form-group"><label class="tc-form-label">默认任务可见性</label><select class="tc-form-select" id="tc-project-visibility"><option value="project">项目成员可见</option><option value="private">仅相关人员可见</option></select></div>
                </div>
                <div class="tc-modal-footer"><button class="tc-btn tc-btn-secondary tc-modal-cancel">取消</button><button class="tc-btn tc-btn-primary" id="tc-confirm-create-project">创建</button></div>
            </div>`;
            document.body.appendChild(modal);
            modal.querySelector('.tc-modal-close').addEventListener('click', ()=>modal.remove());
            modal.querySelector('.tc-modal-cancel').addEventListener('click', ()=>modal.remove());
            modal.querySelector('#tc-confirm-create-project').addEventListener('click', async ()=>{
                const name=document.getElementById('tc-project-name').value.trim();
                const description=document.getElementById('tc-project-description').value.trim();
                const visibility=document.getElementById('tc-project-visibility').value;
                if(!name){ this.panel.api.ui.showToast('请输入项目名称','warning'); return; }
                try{
                    const project=await this.projectService.createProject({name,description,visibility}, this.currentUserId);
                    this.panel.api.ui.showToast('项目创建成功','success');
                    modal.remove();
                    this.currentProjectId=project.id;
                    await this.render();
                }catch(error){ this.panel.api.ui.showToast('创建项目失败: '+error.message,'error'); }
            });
        };

        // ===== Project Settings =====
        window.TCProjectSettingsView.prototype.render = function () {
            if (!this.project) {
                this.panel.showEmpty('⚙️', '请选择项目', '在左侧选择一个项目来管理设置');
                return;
            }
            const project = this.project;
            const memberInfo = this.permission.getMemberRole(this.currentUserId, project);
            const canEdit = this.permission.canEditProject(this.currentUserId, project);
            const html = `
                <div class="tc-project-settings">
                    <div class="tc-settings-header"><div class="tc-settings-title">项目设置</div></div>
                    <div class="tc-settings-content">
                        <div class="tc-settings-section">
                            <div class="tc-section-title">基本信息</div>
                            <div class="tc-info-row"><span class="tc-info-label">项目名称</span><span class="tc-info-value">${escapeHtml(project.name)}</span></div>
                            <div class="tc-info-row"><span class="tc-info-label">项目描述</span><span class="tc-info-value">${project.description ? escapeHtml(project.description) : '<span class="tc-placeholder">暂无描述</span>'}</span></div>
                            <div class="tc-info-row"><span class="tc-info-label">你的角色</span><span class="tc-info-value tc-role-badge tc-role-${memberInfo?.role || 'guest'}">${this.getRoleLabel(memberInfo?.role)}</span></div>
                        </div>
                        <div class="tc-settings-section">
                            <div class="tc-section-title">按用户名添加成员</div>
                            <div class="tc-form-group"><input type="text" class="tc-form-input" id="tc-add-member-username" placeholder="输入用户名，例如 alice 或 @alice"></div>
                            <div class="tc-form-row">
                                <div class="tc-form-group" style="flex:1;"><select class="tc-form-select" id="tc-add-member-role"><option value="member">成员</option><option value="admin">管理员</option><option value="guest">访客</option></select></div>
                                <div class="tc-form-group" style="width:160px;"><button class="tc-btn tc-btn-primary tc-btn-block" id="tc-add-member-btn">添加成员</button></div>
                            </div>
                        </div>
                        <div class="tc-settings-section"><div class="tc-section-title">成员列表 (${project.members?.length || 0})</div><div class="tc-members-list">${project.members.map(member => `
                            <div class="tc-member-item"><div class="tc-member-avatar">${this.getInitials(member.userId)}</div><div class="tc-member-info"><div class="tc-member-name">${escapeHtml(member.userId)}</div><div class="tc-member-role tc-role-${member.role}">${this.getRoleLabel(member.role)}</div></div><div class="tc-member-joined">${window.TCUtils.formatDate(member.joinedAt)}</div>${canEdit && project.ownerId !== member.userId ? `<button class="tc-btn tc-btn-secondary tc-btn-sm tc-remove-member-btn" data-user-id="${member.userId}">移除</button>` : ''}</div>`).join('')}</div></div>
                        <div class="tc-settings-section"><div class="tc-section-title">项目统计</div><div class="tc-stats-grid"><div class="tc-stat-item"><div class="tc-stat-value">${project.stats?.totalTasks || 0}</div><div class="tc-stat-label">总任务数</div></div><div class="tc-stat-item"><div class="tc-stat-value">${project.stats?.completedTasks || 0}</div><div class="tc-stat-label">已完成</div></div><div class="tc-stat-item"><div class="tc-stat-value">${project.stats?.overdueTasks || 0}</div><div class="tc-stat-label">已逾期</div></div><div class="tc-stat-item"><div class="tc-stat-value">${project.stats?.totalPlans || 0}</div><div class="tc-stat-label">学习计划</div></div></div></div>
                    </div>
                </div>`;
            this.panel.setContent(html);
        };
        window.TCProjectSettingsView.prototype.bindEvents = function () {
            const addBtn = document.getElementById('tc-add-member-btn');
            if (addBtn) addBtn.addEventListener('click', async () => {
                const username = document.getElementById('tc-add-member-username').value.trim();
                const role = document.getElementById('tc-add-member-role').value;
                if (!username) return this.api.ui.showToast('请输入用户名', 'warning');
                try {
                    await this.projectService.inviteMember(this.currentProjectId, username, this.currentUserId);
                    if (role && role !== 'member') await this.projectService.updateMemberRole(this.currentProjectId, normalizeUserId(username), role, this.currentUserId);
                    this.api.ui.showToast('成员已添加', 'success');
                    await this.refresh();
                } catch (e) {
                    this.api.ui.showToast('添加成员失败: ' + e.message, 'error');
                }
            });
            document.querySelectorAll('.tc-remove-member-btn').forEach(btn => btn.addEventListener('click', async () => {
                try {
                    await this.projectService.removeMember(this.currentProjectId, btn.dataset.userId, this.currentUserId);
                    this.api.ui.showToast('成员已移除', 'success');
                    await this.refresh();
                } catch (e) { this.api.ui.showToast('移除成员失败: ' + e.message, 'error'); }
            }));
        };

        // ===== TaskBoard / TaskList =====
        window.TCTaskBoard.prototype.init = async function(projectId, userId) {
            this.currentProjectId = projectId;
            this.currentUserId = userId;
            try { const p = await this.projectService.getProject(projectId); this.projectMembers = p?.members || []; } catch(e){ this.projectMembers=[]; }
            await this.loadTasks(); this.render(); this.bindEvents();
        };
        window.TCTaskBoard.prototype.renderTaskCard = function(task){
            const priorityColors={low:'#6b7280',medium:'#3b82f6',high:'#f59e0b',urgent:'#ef4444'};
            const isOverdue=this.taskService.isOverdue(task); const dueDateText=task.dueDate?window.TCUtils.formatDate(task.dueDate):'';
            const progress = task.checklist && task.checklist.length ? checklistProgress(task.checklist) : (task.progress || 0);
            return `<div class="tc-task-card" data-task-id="${task.id}" draggable="true"><div class="tc-task-card-header"><div class="tc-task-priority" style="background:${priorityColors[task.priority]}"></div><div class="tc-task-title">${escapeHtml(task.title)}</div></div>${task.description?`<div class="tc-task-desc">${escapeHtml(window.TCUtils.truncateText(task.description,60))}</div>`:''}<div class="tc-inline-progress-row"><div class="tc-progress-bar"><div class="tc-progress-fill" style="width:${progress}%"></div></div><span class="tc-progress-text">${progress}%</span></div><div class="tc-task-meta"><div class="tc-task-info">${dueDateText?`<span class="tc-task-due ${isOverdue?'overdue':''}">📅 ${dueDateText}</span>`:''}${task.assigneeIds&&task.assigneeIds.length?`<span class="tc-task-assignees">👤 ${task.assigneeIds.join(', ')}</span>`:''}</div></div></div>`;
        };
        function taskModalHtml(members, currentUserId, includeChecklist=true){
            const memberOptions=(members||[]).map(m=>`<label class="tc-checkbox-label"><input type="checkbox" class="tc-assignee-checkbox" value="${m.userId}" ${normalizeUserId(m.userId)===normalizeUserId(currentUserId)?'checked':''}><span>${escapeHtml(m.userId)}${normalizeUserId(m.userId)===normalizeUserId(currentUserId)?' (我)':''}</span></label>`).join('');
            return `<div class="tc-form-group"><label class="tc-form-label">负责人（可多选）</label><div class="tc-assignee-list">${memberOptions || '<span class="tc-placeholder">暂无成员可选</span>'}</div></div><div class="tc-form-group"><label class="tc-form-label">任务清单</label><div id="tc-checklist-items"><div class="tc-checklist-row"><input type="text" class="tc-form-input tc-checklist-input" placeholder="输入清单项"></div></div><button type="button" class="tc-btn tc-btn-secondary tc-btn-sm" id="tc-add-checklist-item">+ 添加清单项</button></div>`;
        }
        function gatherChecklist(root){ return Array.from(root.querySelectorAll('.tc-checklist-input')).map(el=>el.value.trim()).filter(Boolean).map((text,idx)=>({id:`chk_new_${Date.now()}_${idx}`, text, completed:false})); }
        window.TCTaskBoard.prototype.showCreateTaskModal = function() {
            const C=window.TCConstants; const modal=document.createElement('div'); modal.className='tc-modal open';
            modal.innerHTML=`<div class="tc-modal-content"><div class="tc-modal-header"><span class="tc-modal-title">新建任务</span><button class="tc-modal-close">×</button></div><div class="tc-modal-body"><div class="tc-form-group"><label class="tc-form-label">任务标题 *</label><input type="text" class="tc-form-input" id="tc-task-title" placeholder="输入任务标题" maxlength="100"></div><div class="tc-form-group"><label class="tc-form-label">任务描述</label><textarea class="tc-form-textarea" id="tc-task-description" placeholder="输入任务描述（支持Markdown）" rows="4"></textarea></div><div class="tc-form-row"><div class="tc-form-group" style="flex:1;"><label class="tc-form-label">优先级</label><select class="tc-form-select" id="tc-task-priority"><option value="${C.TASK_PRIORITY.LOW}">低</option><option value="${C.TASK_PRIORITY.MEDIUM}" selected>中</option><option value="${C.TASK_PRIORITY.HIGH}">高</option><option value="${C.TASK_PRIORITY.URGENT}">紧急</option></select></div><div class="tc-form-group" style="flex:1;"><label class="tc-form-label">截止日期</label><input type="date" class="tc-form-input" id="tc-task-due-date"></div></div>${taskModalHtml(this.projectMembers, this.currentUserId)}</div><div class="tc-modal-footer"><button class="tc-btn tc-btn-secondary tc-modal-cancel">取消</button><button class="tc-btn tc-btn-primary" id="tc-confirm-create">创建</button></div></div>`;
            document.body.appendChild(modal);
            modal.querySelector('.tc-modal-close').onclick=()=>modal.remove(); modal.querySelector('.tc-modal-cancel').onclick=()=>modal.remove();
            modal.querySelector('#tc-add-checklist-item').onclick=()=>{ const row=document.createElement('div'); row.className='tc-checklist-row'; row.innerHTML='<input type="text" class="tc-form-input tc-checklist-input" placeholder="输入清单项">'; modal.querySelector('#tc-checklist-items').insertBefore(row, modal.querySelector('#tc-add-checklist-item')); };
            modal.querySelector('#tc-confirm-create').onclick=async()=>{ const title=document.getElementById('tc-task-title').value.trim(); if(!title) return this.panel.api.ui.showToast('请输入任务标题','warning'); const description=document.getElementById('tc-task-description').value.trim(); const priority=document.getElementById('tc-task-priority').value; const dueDate=document.getElementById('tc-task-due-date').value; const assigneeIds=Array.from(modal.querySelectorAll('.tc-assignee-checkbox:checked')).map(cb=>cb.value); const checklist=gatherChecklist(modal); try{ await this.taskService.createTask({ projectId:this.currentProjectId,title,description,priority,dueDate:dueDate?new Date(dueDate).getTime():null,assigneeIds,checklist }, this.currentUserId); this.panel.api.ui.showToast('任务创建成功','success'); modal.remove(); await this.init(this.currentProjectId, this.currentUserId);} catch(e){ this.panel.api.ui.showToast('创建任务失败: '+e.message,'error'); } };
        };
        window.TCTaskList.prototype.init = async function(projectId, userId){ this.currentProjectId=projectId; this.currentUserId=userId; try{ this.projectMembers=(await window.__teamCollabServices.projectService.getProject(projectId))?.members||[];}catch(e){this.projectMembers=[];} await this.loadTasks(); this.render(); this.bindEvents(); };
        window.TCTaskList.prototype.renderTaskItems = function(){ const C=window.TCConstants; const statusLabels={[C.TASK_STATUS.TODO]:'待办',[C.TASK_STATUS.DOING]:'进行中',[C.TASK_STATUS.REVIEW]:'审核中',[C.TASK_STATUS.DONE]:'已完成'}; const statusColors={[C.TASK_STATUS.TODO]:'#6b7280',[C.TASK_STATUS.DOING]:'#3b82f6',[C.TASK_STATUS.REVIEW]:'#f59e0b',[C.TASK_STATUS.DONE]:'#22c55e'}; const priorityColors={low:'#6b7280',medium:'#3b82f6',high:'#f59e0b',urgent:'#ef4444'}; return `<div class="tc-list-items">${this.tasks.map(task=>{ const progress=task.checklist&&task.checklist.length?checklistProgress(task.checklist):(task.progress||0); return `<div class="tc-list-item" data-task-id="${task.id}"><div class="tc-list-item-left"><div class="tc-task-status-dot" style="background:${statusColors[task.status]}"></div><div class="tc-task-info"><div class="tc-task-title">${escapeHtml(task.title)}</div>${task.description?`<div class="tc-task-desc">${escapeHtml(window.TCUtils.truncateText(task.description,80))}</div>`:''}<div class="tc-inline-progress-row"><div class="tc-progress-bar"><div class="tc-progress-fill" style="width:${progress}%"></div></div><span class="tc-progress-text">${progress}%</span></div></div></div><div class="tc-list-item-right"><span class="tc-priority-badge" style="background:${priorityColors[task.priority]}">${window.TCUtils.getPriorityLabel(task.priority)}</span>${task.dueDate?`<span class="tc-due-date ${this.taskService.isOverdue(task)?'overdue':''}">${window.TCUtils.formatDate(task.dueDate)}</span>`:''}<span class="tc-status-badge" style="background:${statusColors[task.status]}">${statusLabels[task.status]}</span></div></div>`; }).join('')}</div>`; };
        window.TCTaskList.prototype.showCreateTaskModal = window.TCTaskBoard.prototype.showCreateTaskModal;

        // ===== TaskDetail =====
        window.TCTaskDetail.prototype.show = async function(task, userId) {
            this.currentUserId = userId;
            this.currentTask = typeof task === 'string' ? await this.taskService.getTask(task, userId) : task;
            this.currentProjectId = this.currentTask?.projectId;
            this.pendingAttachments = [];
            await this.loadProjectMembers();
            await this.loadComments();
            this.render();
            this.bindEvents();
        };
        window.TCTaskDetail.prototype.renderCommentAttachmentList = function(comment){ const atts=comment.attachments||[]; if(!atts.length) return ''; return `<div class="tc-comment-attachments">${atts.map(att=>/^image\//.test(att.mimeType||'')?`<div class="tc-comment-attachment is-image" data-attachment-id="${att.id}"><img class="tc-comment-image" src="${att.previewUrl||att.url||''}" alt="${escapeHtml(att.name)}"><div class="tc-comment-attachment-name">${escapeHtml(att.name)}</div></div>`:`<div class="tc-comment-attachment" data-attachment-id="${att.id}"><a href="#" class="tc-open-attachment" data-attachment-id="${att.id}">📎 ${escapeHtml(att.name)}</a><div class="tc-comment-attachment-name">${Math.round((att.size||0)/1024)} KB</div></div>`).join('')}</div>`; };
        window.TCTaskDetail.prototype.renderComments = function(){ return this.comments.map(comment=>`<div class="tc-comment-item" data-comment-id="${comment.id}"><div class="tc-comment-avatar"><div class="tc-avatar">${this.getInitials(comment.authorId)}</div></div><div class="tc-comment-body"><div class="tc-comment-meta"><span class="tc-comment-author">${escapeHtml(comment.authorId)}</span><span class="tc-comment-time">${window.TCUtils.formatRelativeTime(comment.createdAt)}</span></div><div class="tc-comment-content">${this.markdown.renderSafe(comment.body)}</div>${this.renderCommentAttachmentList(comment)}<div class="tc-comment-actions"><button class="tc-action-btn tc-reply-btn" data-author-id="${comment.authorId}">回复</button>${comment.authorId===this.currentUserId?`<button class="tc-action-btn tc-delete-comment-btn" data-comment-id="${comment.id}">删除</button>`:''}</div></div></div>`).join(''); };
        window.TCTaskDetail.prototype.render = function () {
            if (!this.currentTask) return;
            const task=this.currentTask; const statusLabels={todo:'待办',doing:'进行中',review:'审核中',done:'已完成'}; const priorityLabels={low:'低',medium:'中',high:'高',urgent:'紧急'}; const priorityColors={low:'#6b7280',medium:'#3b82f6',high:'#f59e0b',urgent:'#ef4444'}; const checklist=normalizeChecklist(task.checklist); const progress=checklist.length?checklistProgress(checklist):(task.progress||0); const pending=(this.pendingAttachments||[]).map(att=>`<span class="tc-pending-chip">${escapeHtml(att.name)}<button type="button" class="tc-pending-remove" data-pending-id="${att.id}">×</button></span>`).join('');
            const html=`<div class="tc-task-detail"><div class="tc-detail-header"><button class="tc-back-btn" id="tc-back-btn">← 返回</button><div class="tc-detail-actions"><button class="tc-btn tc-btn-secondary tc-btn-sm" id="tc-edit-task-btn">编辑</button><button class="tc-btn tc-btn-secondary tc-btn-sm" id="tc-delete-task-btn" style="color:#ef4444;">删除</button></div></div><div class="tc-detail-content"><div class="tc-detail-title">${escapeHtml(task.title)}</div><div class="tc-detail-meta"><div class="tc-meta-item"><span class="tc-meta-label">状态</span><select class="tc-status-select" id="tc-task-status">${Object.entries(statusLabels).map(([value,label])=>`<option value="${value}" ${task.status===value?'selected':''}>${label}</option>`).join('')}</select></div><div class="tc-meta-item"><span class="tc-meta-label">优先级</span><span class="tc-priority-badge" style="background:${priorityColors[task.priority]}">${priorityLabels[task.priority]}</span></div><div class="tc-meta-item"><span class="tc-meta-label">截止日期</span><span class="tc-due-date ${this.taskService.isOverdue(task)?'overdue':''}">${task.dueDate?window.TCUtils.formatDateTime(task.dueDate):'未设置'}</span></div><div class="tc-meta-item"><span class="tc-meta-label">负责人</span><span>${(task.assigneeIds||[]).join(', ') || '未分配'}</span></div></div><div class="tc-detail-section"><div class="tc-section-title">任务描述</div><div class="tc-description">${task.description?this.markdown.renderSafe(task.description):'<span class="tc-placeholder">暂无描述</span>'}</div></div><div class="tc-detail-section"><div class="tc-section-title">任务清单</div><div class="tc-checklist-list">${checklist.length?checklist.map(item=>`<label class="tc-checkbox-label tc-checklist-item"><input type="checkbox" class="tc-task-checklist-toggle" data-item-id="${item.id}" ${item.completed?'checked':''}><span>${escapeHtml(item.text)}</span></label>`).join(''):'<div class="tc-placeholder">暂无清单</div>'}<div class="tc-form-row" style="margin-top:8px;"><input type="text" class="tc-form-input" id="tc-new-checklist-text" placeholder="新增清单项"><button class="tc-btn tc-btn-secondary" id="tc-add-checklist-btn">添加</button></div></div></div><div class="tc-detail-section"><div class="tc-section-title">进度</div><div class="tc-progress-bar"><div class="tc-progress-fill" style="width:${progress}%"></div></div><div class="tc-progress-text">${progress}%</div></div><div class="tc-detail-section tc-comments-section"><div class="tc-section-title">评论 (${this.comments.length})</div><div class="tc-comment-list" id="tc-task-comments">${this.comments.length===0?`<div class="tc-comment-empty"><div class="tc-empty-icon">💬</div><div class="tc-empty-text">暂无评论</div></div>`:this.renderComments()}</div><div class="tc-comment-input"><textarea class="tc-comment-textarea" id="tc-comment-input" placeholder="输入评论，支持 Markdown..." rows="3"></textarea><div class="tc-pending-attachments">${pending}</div><div class="tc-comment-input-footer"><div class="tc-comment-toolbar"><button class="tc-btn tc-btn-secondary tc-btn-sm" id="tc-attach-image-btn">🖼️ 图片</button><button class="tc-btn tc-btn-secondary tc-btn-sm" id="tc-attach-file-btn">📎 文件</button></div><button class="tc-btn tc-btn-primary tc-btn-sm" id="tc-send-comment">发送</button></div><input type="file" id="tc-comment-image-input" accept="image/*" multiple style="display:none;"><input type="file" id="tc-comment-file-input" multiple style="display:none;"></div></div></div></div>`;
            this.panel.setContent(html);
        };
        window.TCTaskDetail.prototype.bindEvents = function(){
            document.getElementById('tc-back-btn')?.addEventListener('click', ()=>this.eventBus.emit('task.back'));
            document.getElementById('tc-task-status')?.addEventListener('change', async e=>{ await this.updateTaskStatus(e.target.value); });
            document.getElementById('tc-edit-task-btn')?.addEventListener('click', ()=>this.showEditModal());
            document.getElementById('tc-delete-task-btn')?.addEventListener('click', ()=>this.confirmDelete());
            document.querySelectorAll('.tc-task-checklist-toggle').forEach(el=>el.addEventListener('change', async ()=>{ this.currentTask = await this.taskService.toggleChecklistItem(this.currentTask.id, el.dataset.itemId, this.currentUserId); await this.loadComments(); this.render(); this.bindEvents(); }));
            document.getElementById('tc-add-checklist-btn')?.addEventListener('click', async ()=>{ const input=document.getElementById('tc-new-checklist-text'); const text=input.value.trim(); if(!text) return; const checklist=normalizeChecklist([...(this.currentTask.checklist||[]), {text}]); this.currentTask = await this.taskService.updateTask(this.currentTask.id, { checklist }, this.currentUserId); input.value=''; await this.loadComments(); this.render(); this.bindEvents(); });
            document.getElementById('tc-send-comment')?.addEventListener('click', ()=>this.sendComment());
            document.getElementById('tc-comment-input')?.addEventListener('keydown', e=>{ if(e.ctrlKey&&e.key==='Enter') this.sendComment(); });
            document.getElementById('tc-attach-image-btn')?.addEventListener('click', ()=>document.getElementById('tc-comment-image-input').click());
            document.getElementById('tc-attach-file-btn')?.addEventListener('click', ()=>document.getElementById('tc-comment-file-input').click());
            document.getElementById('tc-comment-image-input')?.addEventListener('change', e=>this.handleCommentFiles(Array.from(e.target.files||[])));
            document.getElementById('tc-comment-file-input')?.addEventListener('change', e=>this.handleCommentFiles(Array.from(e.target.files||[])));
            document.querySelectorAll('.tc-pending-remove').forEach(btn=>btn.addEventListener('click', ()=>{ this.pendingAttachments=(this.pendingAttachments||[]).filter(att=>att.id!==btn.dataset.pendingId); this.render(); this.bindEvents(); }));
            document.querySelectorAll('.tc-open-attachment').forEach(btn=>btn.addEventListener('click', async e=>{ e.preventDefault(); const att=(this.comments.flatMap(c=>c.attachments||[]).find(a=>a.id===btn.dataset.attachmentId)); await window.__teamCollabServices.attachmentService.openAttachment(att); }));
            document.querySelectorAll('.tc-reply-btn').forEach(btn=>btn.addEventListener('click', ()=>{ const input=document.getElementById('tc-comment-input'); input.value=`@${btn.dataset.authorId} `; input.focus(); }));
            document.querySelectorAll('.tc-delete-comment-btn').forEach(btn=>btn.addEventListener('click', ()=>this.deleteComment(btn.dataset.commentId)));
        };
        window.TCTaskDetail.prototype.handleCommentFiles = async function(files){ if(!files.length) return; try{ const uploaded=await window.__teamCollabServices.attachmentService.uploadFiles(files, this.currentUserId); this.pendingAttachments=[...(this.pendingAttachments||[]), ...uploaded]; this.render(); this.bindEvents(); }catch(e){ this.panel.api.ui.showToast('上传失败: '+e.message,'error'); } };
        window.TCTaskDetail.prototype.sendComment = async function(){ const input=document.getElementById('tc-comment-input'); const body=input?.value?.trim(); if(!body && !(this.pendingAttachments||[]).length){ return this.panel.api.ui.showToast('请输入评论内容或上传附件','warning'); } try{ await this.commentService.addComment({ targetType:'task', targetId:this.currentTask.id, projectId:this.currentTask.projectId, authorId:this.currentUserId, body:body||'[附件]', mentions:(body?body.match(/@(\w+)/g)||[]:[]).map(v=>v.slice(1)), attachmentIds:(this.pendingAttachments||[]).map(a=>a.id) }); input.value=''; this.pendingAttachments=[]; await this.loadComments(); this.render(); this.bindEvents(); this.panel.api.ui.showToast('评论已发送','success'); } catch(e){ this.panel.api.ui.showToast('发送评论失败: '+e.message,'error'); } };
        window.TCTaskDetail.prototype.deleteComment = async function(commentId){ if(!confirm('确定要删除这条评论吗？')) return; try{ const thread=await this.commentService.getOrCreateThread('task', this.currentTask.id, this.currentTask.projectId); await this.commentService.deleteComment(commentId, thread.id, this.currentUserId); await this.loadComments(); this.render(); this.bindEvents(); } catch(e){ this.panel.api.ui.showToast('删除评论失败: '+e.message,'error'); } };

        // ===== PlanView 评论附件 =====
        const oldRenderPlanDetail = window.TCPlanView.prototype.renderPlanDetail;
        window.TCPlanView.prototype.renderCommentAttachmentList = window.TCTaskDetail.prototype.renderCommentAttachmentList;
        window.TCPlanView.prototype.renderComments = function(){ return this.comments.map(comment=>`<div class="tc-comment-item" data-comment-id="${comment.id}"><div class="tc-comment-avatar"><div class="tc-avatar">${this.getInitials(comment.authorId)}</div></div><div class="tc-comment-body"><div class="tc-comment-meta"><span class="tc-comment-author">${escapeHtml(comment.authorId)}</span><span class="tc-comment-time">${window.TCUtils.formatRelativeTime(comment.createdAt)}</span></div><div class="tc-comment-content">${this.markdown.renderSafe(comment.body)}</div>${this.renderCommentAttachmentList(comment)}<div class="tc-comment-actions"><button class="tc-action-btn tc-reply-btn" data-author-id="${comment.authorId}">回复</button>${comment.authorId===this.currentUserId?`<button class="tc-action-btn tc-delete-comment-btn" data-comment-id="${comment.id}">删除</button>`:''}</div></div></div>`).join(''); };
        window.TCPlanView.prototype.handlePlanCommentFiles = async function(files){ if(!files.length) return; const uploaded=await window.__teamCollabServices.attachmentService.uploadFiles(files, this.currentUserId); this.pendingAttachments=[...(this.pendingAttachments||[]), ...uploaded]; const row=document.querySelector('.tc-pending-attachments'); if(row){ row.innerHTML=this.pendingAttachments.map(att=>`<span class="tc-pending-chip">${escapeHtml(att.name)}<button type="button" class="tc-pending-remove" data-pending-id="${att.id}">×</button></span>`).join(''); row.querySelectorAll('.tc-pending-remove').forEach(btn=>btn.onclick=()=>{ this.pendingAttachments=this.pendingAttachments.filter(a=>a.id!==btn.dataset.pendingId); btn.parentElement.remove(); }); } };
        window.TCPlanView.prototype.sendComment = async function(plan){ const commentInput=document.getElementById('tc-plan-comment-input'); const body=commentInput?.value?.trim(); if(!body && !(this.pendingAttachments||[]).length){ return this.panel.api.ui.showToast('请输入评论内容或上传附件','warning'); } try{ await this.commentService.addComment({ targetType:'plan', targetId:plan.id, projectId:plan.projectId, authorId:this.currentUserId, body:body||'[附件]', mentions:this.extractMentions(body||''), attachmentIds:(this.pendingAttachments||[]).map(a=>a.id) }); commentInput.value=''; this.pendingAttachments=[]; this.comments=await this.commentService.getTargetComments('plan', plan.id); const progress=await this.planService.getMemberProgress(plan.id, this.currentUserId); const allProgress=await this.planService.getAllMemberProgress(plan.id); this.renderPlanDetail(plan, progress, allProgress); this.panel.api.ui.showToast('评论已发送','success'); } catch(e){ this.panel.api.ui.showToast('发送评论失败: '+e.message,'error'); } };
        window.TCPlanView.prototype.renderPlanDetail = function(plan, progress, allProgress){ oldRenderPlanDetail.call(this, plan, progress, allProgress); this.pendingAttachments=this.pendingAttachments||[]; const footer=document.querySelector('.tc-detail-section.tc-comments-section .tc-comment-input-footer'); if(footer && !document.querySelector('.tc-pending-attachments')){ const pending=document.createElement('div'); pending.className='tc-pending-attachments'; footer.parentNode.insertBefore(pending, footer); const toolbar=document.createElement('div'); toolbar.className='tc-comment-toolbar'; toolbar.innerHTML='<button class="tc-btn tc-btn-secondary tc-btn-sm" id="tc-plan-attach-image-btn">🖼️ 图片</button><button class="tc-btn tc-btn-secondary tc-btn-sm" id="tc-plan-attach-file-btn">📎 文件</button><input type="file" id="tc-plan-comment-image-input" accept="image/*" multiple style="display:none;"><input type="file" id="tc-plan-comment-file-input" multiple style="display:none;">'; footer.prepend(toolbar); document.getElementById('tc-plan-attach-image-btn').onclick=()=>document.getElementById('tc-plan-comment-image-input').click(); document.getElementById('tc-plan-attach-file-btn').onclick=()=>document.getElementById('tc-plan-comment-file-input').click(); document.getElementById('tc-plan-comment-image-input').onchange=e=>this.handlePlanCommentFiles(Array.from(e.target.files||[])); document.getElementById('tc-plan-comment-file-input').onchange=e=>this.handlePlanCommentFiles(Array.from(e.target.files||[])); }
            document.querySelectorAll('.tc-open-attachment').forEach(btn=>btn.onclick=async (e)=>{ e.preventDefault(); const att=(this.comments.flatMap(c=>c.attachments||[]).find(a=>a.id===btn.dataset.attachmentId)); await window.__teamCollabServices.attachmentService.openAttachment(att); });
        };

        // ===== Plugin =====
        const oldInitCurrentUser = TeamCollabPlugin.prototype.initCurrentUser;
        TeamCollabPlugin.prototype.initCurrentUser = async function(){
            const basePath = typeof top_level_path !== 'undefined' ? top_level_path : '';
            try { const response = await this.api.http.get(basePath + '/api/get_current_user'); const candidates=[response?.username,response?.userName,response?.handle,response?.name,response?.email&&String(response.email).split('@')[0],response?.uid,response?.userId]; const found=candidates.find(v=>String(v||'').trim()); if(found) this.currentUserId=normalizeUserId(found); } catch(e){ console.warn('[团队协作] 获取用户信息失败，使用默认值'); }
            if(!this.currentUserId){ let userId=await this.api.storage.get('plugin:team-collab:temp-user-id'); if(!userId){ userId='user_'+Date.now()+'_'+Math.random().toString(36).substr(2,9); await this.api.storage.set('plugin:team-collab:temp-user-id', userId);} this.currentUserId=normalizeUserId(userId); }
            console.log('[团队协作] 当前用户 ID:', this.currentUserId);
        };
        const oldInitServices = TeamCollabPlugin.prototype.initServices;
        TeamCollabPlugin.prototype.initServices = function(){ oldInitServices.call(this); this.attachmentService = new window.TCAttachmentService(this.api, this.storage); window.__teamCollabServices = { projectService: this.projectService, attachmentService: this.attachmentService }; };
        const oldInitUI = TeamCollabPlugin.prototype.initUI;
        TeamCollabPlugin.prototype.initUI = function(){ oldInitUI.call(this); if (this.panel) this.panel.plugin=this; if (this.taskList) this.taskList.projectService=this.projectService; };
        TeamCollabPlugin.prototype.showParticipatingView = async function(){ const projects = await this.projectService.getParticipatedProjects(this.currentUserId); const html = `<div class="tc-task-list-view"><div class="tc-list-header"><div class="tc-list-title">我的参与</div></div><div class="tc-list-content">${projects.length?`<div class="tc-participating-list">${projects.map(project=>`<div class="tc-project-card"><div class="tc-project-card-title">${escapeHtml(project.name)}</div><div class="tc-project-card-desc">${project.description?escapeHtml(window.TCUtils.truncateText(project.description,80)):'暂无描述'}</div><div class="tc-project-card-actions"><button class="tc-btn tc-btn-primary tc-btn-sm tc-enter-project-btn" data-project-id="${project.id}">进入项目</button></div></div>`).join('')}</div>`:`<div class="tc-empty-state"><div class="tc-empty-icon">🤝</div><div class="tc-empty-title">暂无参与项目</div><div class="tc-empty-description">当别人把你加入项目后，这里会显示你参与的项目。</div></div>`}</div></div>`; this.panel.setContent(html); document.querySelectorAll('.tc-enter-project-btn').forEach(btn=>btn.addEventListener('click', async ()=>{ this.currentProjectId = btn.dataset.projectId; this.sidebar.currentProjectId = btn.dataset.projectId; await this.sidebar.render(); await this.showTaskView('board'); })); };
        TeamCollabPlugin.prototype.bindEvents = function(){
            this.eventBus.on('project.changed', async (data) => { this.currentProjectId = data.projectId; await this.showTaskView(); });
            this.eventBus.on('view.changed', async (data) => { this.currentProjectId = data.projectId || this.currentProjectId; switch (data.view) { case 'tasks': case 'task-board': await this.showTaskView('board'); break; case 'task-list': await this.showTaskView('list'); break; case 'participating': await this.showParticipatingView(); break; case 'plans': await this.showPlansView(); break; case 'inbox': await this.showInboxView(); break; case 'activity': await this.showActivityView(); break; case 'project-settings': await this.showProjectSettingsView(); break; }});
            this.eventBus.on('task.detail', async (data) => { if (data.task) await this.taskDetail.show(data.task, this.currentUserId); else if (data.taskId) { const task = await this.taskService.getTask(data.taskId, this.currentUserId); if (task) await this.taskDetail.show(task, this.currentUserId); } });
            this.eventBus.on('task.back', async () => { await this.showTaskView(); });
        };
    })();

    // 注册插件
    registerPlugin('team-collab', TeamCollabPlugin);

    console.log('[团队协作] 插件类已注册');
})();

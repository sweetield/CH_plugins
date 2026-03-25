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

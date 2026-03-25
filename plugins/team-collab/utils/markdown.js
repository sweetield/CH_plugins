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

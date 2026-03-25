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
                        <span>支持 **粗体**、*斜体*、\`代码\`、```代码块```、[链接](url)</span>
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

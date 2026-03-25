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

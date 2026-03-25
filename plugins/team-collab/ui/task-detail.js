/**
 * 团队协作插件 - 任务详情面板
 */

class TaskDetail {
    constructor(panel, taskService, projectService, eventBus) {
        this.panel = panel;
        this.taskService = taskService;
        this.projectService = projectService;
        this.eventBus = eventBus;
        this.currentTask = null;
        this.currentUserId = null;
    }

    /**
     * 显示任务详情
     * @param {Object} task - 任务对象
     * @param {string} userId - 用户 ID
     */
    async show(task, userId) {
        this.currentTask = task;
        this.currentUserId = userId;
        this.render();
        this.bindEvents();
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
                            ${task.description ? window.TCUtils.escapeHtml(task.description) : '<span class="tc-placeholder">暂无描述</span>'}
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
                </div>
            </div>
        `;

        this.panel.setContent(html);
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

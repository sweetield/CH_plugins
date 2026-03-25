/**
 * 团队协作插件 - 任务看板视图
 */

class TaskBoard {
    constructor(panel, taskService, indexManager, eventBus) {
        this.panel = panel;
        this.taskService = taskService;
        this.indexManager = indexManager;
        this.eventBus = eventBus;
        this.currentProjectId = null;
        this.currentUserId = null;
        this.tasks = { todo: [], doing: [], review: [], done: [] };
        this.draggedTask = null;
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
                    tags
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

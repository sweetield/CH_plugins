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

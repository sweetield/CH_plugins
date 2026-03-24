class TaskManagerPlugin {
    constructor(api) {
        this.api = api;
        this.name = '任务管理';
        this.id = 'task-manager';
        this.isActivated = false;
        this.config = {};
        
        this.currentView = 'board';
        this.currentListId = null;
        this.currentFilter = { tag: null, status: null, search: '', smartFilter: null };
        
        this.tasks = [];
        this.lists = [];
        this.tags = [];
        this.teams = [];
        this.templates = [];
        
        this.selectedTask = null;
        this.reminderInterval = null;
        
        this.domElements = [];
        this.eventListeners = [];
        this.taskBtn = null;
        this.taskButtonObserver = null;
        this.taskButtonPollInterval = null;
        
        this.draggedTask = null;
        this.selectedTasks = [];
    }

    static DEFAULT_CONFIG = {
        theme: 'auto',
        encryptionKey: null,
        defaultReminders: [
            { time: 15, unit: 'minutes' },
            { time: 1, unit: 'hours' },
            { time: 1, unit: 'days' }
        ]
    };

    async onActivate() {
        try {
            await this.loadConfig();
            await this.loadData();
            this.initUI();
            this.registerEvents();
            this.startReminderCheck();
            this.tryAddTaskButton();
            window.tmPlugin = this;
            this.isActivated = true;
        } catch (error) {
            console.error('插件激活失败:', error);
            this.api.ui.showToast('任务管理插件激活失败', 'error');
        }
    }

    async onDeactivate() {
        this.stopReminderCheck();
        this.cleanupUI();
        this.unregisterEvents();
        this.removeTaskButton();
        
        if (this.taskButtonObserver) {
            this.taskButtonObserver.disconnect();
            this.taskButtonObserver = null;
        }
        if (this.taskButtonPollInterval) {
            clearInterval(this.taskButtonPollInterval);
            this.taskButtonPollInterval = null;
        }
        
        await this.saveData();
        window.tmPlugin = null;
        this.isActivated = false;
    }

    // 卸载时调用（由系统调用）
    async onUninstall() {
        if (confirm('确定要卸载任务管理插件吗？\n\n是否同时清除所有任务数据？\n点击"确定"清除数据，点击"取消"保留数据。')) {
            await this.api.storage.remove('lists');
            await this.api.storage.remove('tasks');
            await this.api.storage.remove('tags');
            await this.api.storage.remove('teams');
            await this.api.storage.remove('templates');
            await this.api.storage.remove('config');
            console.log('任务管理插件数据已清除');
        }
    }

    async loadConfig() {
        const savedConfig = await this.api.storage.get('config');
        this.config = { ...TaskManagerPlugin.DEFAULT_CONFIG, ...savedConfig };
    }

    async saveConfig() {
        await this.api.storage.set('config', this.config);
    }

    initUI() {
        this.injectStyles();
        this.createMainPanel();
        this.render();
    }

    injectStyles() {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = './plugins/task-manager/styles.css';
        document.head.appendChild(link);
    }

    createMainPanel() {
        this.panel = document.createElement('div');
        this.panel.className = 'tm-panel';
        this.panel.innerHTML = `
            <div class="tm-sidebar" id="tm-sidebar">
                <div class="tm-sidebar-section">
                    <div class="tm-smart-list" id="tm-smart-list"></div>
                </div>
                <div class="tm-sidebar-section">
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 16px;">
                        <span class="tm-sidebar-title" style="padding:0;">标签</span>
                        <span class="tm-add-icon" id="tm-add-tag" style="cursor:pointer;font-size:16px;">+</span>
                    </div>
                    <div id="tm-tags"></div>
                </div>
                <div class="tm-sidebar-section">
                    <div class="tm-sidebar-title">导入/导出</div>
                    <div class="tm-sidebar-item" id="tm-import-data">
                        <span class="icon">📥</span><span>导入数据</span>
                    </div>
                    <div class="tm-sidebar-item" id="tm-export-json">
                        <span class="icon">📄</span><span>导出 JSON</span>
                    </div>
                    <div class="tm-sidebar-item" id="tm-export-csv">
                        <span class="icon">📊</span><span>导出 CSV</span>
                    </div>
                </div>
                <div class="tm-sidebar-section">
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 16px;">
                        <span class="tm-sidebar-title" style="padding:0;">清单</span>
                        <span class="tm-add-icon" id="tm-add-list" style="cursor:pointer;font-size:16px;">+</span>
                    </div>
                    <div id="tm-lists"></div>
                </div>
                <div class="tm-sidebar-section">
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 16px;">
                        <span class="tm-sidebar-title" style="padding:0;">团队</span>
                        <span class="tm-add-icon" id="tm-add-team" style="cursor:pointer;font-size:16px;">+</span>
                    </div>
                    <div id="tm-teams"></div>
                </div>
                <div class="tm-sidebar-section" style="margin-top: auto;">
                    <div class="tm-sidebar-item" id="tm-view-trash">
                        <span class="icon">🗑️</span><span>垃圾桶</span>
                    </div>
                    <div class="tm-sidebar-item" id="tm-view-stats">
                        <span class="icon">📊</span><span>统计</span>
                    </div>
                    <div class="tm-sidebar-item" id="tm-view-templates">
                        <span class="icon">📋</span><span>模板</span>
                    </div>
                    <div class="tm-sidebar-item" id="tm-reset-plugin" style="color: #ef4444;">
                        <span class="icon">🔄</span><span>重置</span>
                    </div>
                </div>
            </div>
            <div class="tm-main">
                <div class="tm-header">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                        <span style="font-size:18px;font-weight:600;">任务管理</span>
                        <button class="tm-btn tm-btn-secondary" id="tm-close-panel">✕ 关闭</button>
                    </div>
                    <div class="tm-search-row">
                        <input type="text" class="tm-search-input" id="tm-search" placeholder="搜索任务... 或输入任务名称，回车创建">
                        <input type="date" class="tm-date-input" id="tm-date-filter" title="按日期筛选">
                    </div>
                    <div class="tm-view-tabs">
                        <div class="tm-view-tab active" data-view="board">看板</div>
                        <div class="tm-view-tab" data-view="list">列表</div>
                        <div class="tm-view-tab" data-view="time">时间</div>
                        <div class="tm-view-tab" data-view="quadrant">四象限</div>
                    </div>
                </div>
                <div class="tm-batch-bar" id="tm-batch-bar" style="display:none;">
                    <span class="tm-batch-count">已选择 <strong id="tm-batch-count">0</strong> 项</span>
                    <button class="tm-btn tm-btn-secondary" id="tm-batch-complete">✓ 完成</button>
                    <button class="tm-btn tm-btn-secondary" id="tm-batch-priority">⭐ 优先级</button>
                    <button class="tm-btn tm-btn-secondary" id="tm-batch-date">📅 日期</button>
                    <button class="tm-btn tm-btn-secondary" id="tm-batch-delete" style="color:#ef4444;">🗑️ 删除</button>
                    <button class="tm-btn tm-btn-secondary" id="tm-batch-cancel">✕ 取消</button>
                </div>
                <div class="tm-content" id="tm-content"></div>
            </div>
            <div class="tm-detail" id="tm-detail" style="display:none;">
                <div class="tm-detail-header">
                    <span class="tm-detail-title">任务详情</span>
                    <button class="tm-detail-close" id="tm-detail-close">×</button>
                </div>
                <div class="tm-detail-content" id="tm-detail-content"></div>
            </div>
        `;
        
        document.body.appendChild(this.panel);
        this.domElements.push(this.panel);
        
        this.content = document.getElementById('tm-content');
        this.detail = document.getElementById('tm-detail');
        this.detailContent = document.getElementById('tm-detail-content');
    }

    tryAddTaskButton() {
        if (this.addTaskButton()) return;
        this.taskButtonObserver = new MutationObserver(() => this.checkAndAddTaskButton());
        const mainEl = document.querySelector('main');
        if (mainEl) this.taskButtonObserver.observe(mainEl, { childList: true, subtree: true });
        this.taskButtonPollInterval = setInterval(() => this.checkAndAddTaskButton(), 1000);
    }

    checkAndAddTaskButton() {
        const container = document.querySelector('.chat-session-inputarea-othertypes');
        if (!container) return;
        if (!document.querySelector('.chat-session-inputarea-othertypes-task')) this.addTaskButton();
    }

    addTaskButton() {
        const container = document.querySelector('.chat-session-inputarea-othertypes');
        if (!container) return false;
        if (document.querySelector('.chat-session-inputarea-othertypes-task')) return true;

        this.taskBtn = document.createElement('button');
        this.taskBtn.className = 'chat-session-inputarea-othertypes-task';
        this.taskBtn.innerHTML = '<i class="bi bi-journal-check"></i> 任务';
        this.taskBtn.title = '任务管理';
        this.taskBtn.addEventListener('click', (e) => { e.preventDefault(); this.togglePanel(); });

        const sendBtn = container.querySelector('.chat-session-inputarea-sendbtn');
        if (sendBtn) container.insertBefore(this.taskBtn, sendBtn);
        else container.appendChild(this.taskBtn);
        return true;
    }

    removeTaskButton() {
        if (this.taskBtn) { this.taskBtn.remove(); this.taskBtn = null; }
    }

    togglePanel() {
        this.panel.classList.toggle('open');
        if (this.panel.classList.contains('open')) this.render();
    }

    closePanel() {
        this.panel.classList.remove('open');
    }

    render() {
        this.renderSmartLists();
        this.renderTags();
        this.renderLists();
        this.renderTeams();
        this.renderContent();
    }

    renderSmartLists() {
        const container = document.getElementById('tm-smart-list');
        const today = new Date().toISOString().split('T')[0];
        const smartLists = [
            { id: 'all', name: '所有任务', filter: {} },
            { id: 'today', name: '今天', filter: { dueDate: today } },
            { id: 'tomorrow', name: '明天', filter: { dueDate: this.getTomorrow() } },
            { id: 'week', name: '本周', filter: {} },
            { id: 'overdue', name: '已逾期', filter: { overdue: true } },
            { id: 'high-priority', name: '高优先级', filter: { priority: 4 } }
        ];
        
        container.innerHTML = smartLists.map(list => `
            <div class="tm-smart-list-item ${this.currentFilter.smartFilter === list.id ? 'active' : ''}" data-smart="${list.id}">
                <span>${list.name}</span>
                <span class="count">${this.getTaskCountByFilter(list.filter)}</span>
            </div>
        `).join('');
    }

    renderTags() {
        const container = document.getElementById('tm-tags');
        container.innerHTML = this.tags.map(tag => `
            <div class="tm-sidebar-item ${this.currentFilter.tag === tag.id ? 'active' : ''}" data-tag="${tag.id}">
                <span class="tm-list-color" style="background:${tag.color}"></span>
                <span>${tag.name}</span>
                <span class="tm-delete-icon" data-delete-tag="${tag.id}">×</span>
            </div>
        `).join('');
    }

    renderLists() {
        const container = document.getElementById('tm-lists');
        const userLists = this.lists.filter(l => !l.teamId);
        container.innerHTML = userLists.map(list => `
            <div class="tm-sidebar-item ${this.currentListId === list.id ? 'active' : ''}" data-list="${list.id}">
                <span class="tm-list-color" style="background:${list.color || '#3B82F6'}"></span>
                <span>${list.name}</span>
                <span class="tm-delete-icon" data-delete-list="${list.id}">×</span>
            </div>
        `).join('');
    }

    renderTeams() {
        const container = document.getElementById('tm-teams');
        container.innerHTML = this.teams.map(team => `
            <div class="tm-team-item" data-team="${team.id}">
                <span class="icon">🚀</span>
                <span>${team.name}</span>
                <span class="tm-delete-icon" data-delete-team="${team.id}">×</span>
            </div>
        `).join('');
    }

    renderContent() {
        switch (this.currentView) {
            case 'board': this.renderBoardView(); break;
            case 'list': this.renderListView(); break;
            case 'time': this.renderTimeView(); break;
            case 'quadrant': this.renderQuadrantView(); break;
            case 'trash': this.renderTrashView(); break;
            case 'stats': this.renderStatsView(); break;
            default: this.renderBoardView();
        }
    }

    renderBoardView() {
        const todoTasks = this.getFilteredTasks().filter(t => t.status === 'todo');
        const progressTasks = this.getFilteredTasks().filter(t => t.status === 'in_progress');
        const doneTasks = this.getFilteredTasks().filter(t => t.status === 'done');
        
        this.content.innerHTML = `
            <div class="tm-board-view">
                <div class="tm-board-column" data-status="todo">
                    <div class="tm-board-column-header">待办 (${todoTasks.length})</div>
                    <div class="tm-board-column-tasks">${todoTasks.map(t => this.renderTaskCard(t)).join('')}</div>
                </div>
                <div class="tm-board-column" data-status="in_progress">
                    <div class="tm-board-column-header">进行中 (${progressTasks.length})</div>
                    <div class="tm-board-column-tasks">${progressTasks.map(t => this.renderTaskCard(t)).join('')}</div>
                </div>
                <div class="tm-board-column" data-status="done">
                    <div class="tm-board-column-header">已完成 (${doneTasks.length})</div>
                    <div class="tm-board-column-tasks">${doneTasks.map(t => this.renderTaskCard(t)).join('')}</div>
                </div>
            </div>
        `;
        this.setupDragAndDrop();
    }

    renderListView() {
        const tasks = this.getFilteredTasks();
        if (tasks.length === 0) {
            this.content.innerHTML = `<div class="tm-empty-state"><div class="tm-empty-state-icon">📝</div><div class="tm-empty-state-text">暂无任务</div></div>`;
            return;
        }
        this.content.innerHTML = `<div class="tm-task-list">${tasks.map(t => this.renderTaskCard(t)).join('')}</div>`;
    }

    renderTimeView() {
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = this.getTomorrow();
        const weekEnd = this.getWeekEnd();
        
        const todayTasks = this.getFilteredTasks().filter(t => t.dueDate === today);
        const tomorrowTasks = this.getFilteredTasks().filter(t => t.dueDate === tomorrow);
        const weekTasks = this.getFilteredTasks().filter(t => t.dueDate > tomorrow && t.dueDate <= weekEnd);
        const overdueTasks = this.getFilteredTasks().filter(t => t.dueDate && t.dueDate < today && t.status !== 'done');
        
        let html = '<div class="tm-task-list">';
        if (overdueTasks.length > 0) html += `<div class="tm-time-section">已逾期<span class="count">${overdueTasks.length}</span></div>${overdueTasks.map(t => this.renderTaskCard(t)).join('')}`;
        if (todayTasks.length > 0) html += `<div class="tm-time-section">今天<span class="count">${todayTasks.length}</span></div>${todayTasks.map(t => this.renderTaskCard(t)).join('')}`;
        if (tomorrowTasks.length > 0) html += `<div class="tm-time-section">明天<span class="count">${tomorrowTasks.length}</span></div>${tomorrowTasks.map(t => this.renderTaskCard(t)).join('')}`;
        if (weekTasks.length > 0) html += `<div class="tm-time-section">本周<span class="count">${weekTasks.length}</span></div>${weekTasks.map(t => this.renderTaskCard(t)).join('')}`;
        html += '</div>';
        this.content.innerHTML = html || `<div class="tm-empty-state"><div class="tm-empty-state-icon">📅</div><div class="tm-empty-state-text">暂无任务</div></div>`;
    }

    renderQuadrantView() {
        const tasks = this.getFilteredTasks();
        const q1 = tasks.filter(t => t.priority === 4);
        const q2 = tasks.filter(t => t.priority === 3);
        const q3 = tasks.filter(t => t.priority === 2);
        const q4 = tasks.filter(t => t.priority === 1);
        
        this.content.innerHTML = `
            <div class="tm-quadrant-view">
                <div class="tm-quadrant q1"><div class="tm-quadrant-header">🔴 重要且紧急 (${q1.length})</div><div class="tm-quadrant-tasks">${q1.map(t => this.renderTaskCard(t)).join('')}</div></div>
                <div class="tm-quadrant q2"><div class="tm-quadrant-header">🟠 重要不紧急 (${q2.length})</div><div class="tm-quadrant-tasks">${q2.map(t => this.renderTaskCard(t)).join('')}</div></div>
                <div class="tm-quadrant q3"><div class="tm-quadrant-header">🔵 次重要 (${q3.length})</div><div class="tm-quadrant-tasks">${q3.map(t => this.renderTaskCard(t)).join('')}</div></div>
                <div class="tm-quadrant q4"><div class="tm-quadrant-header">⚪ 不紧急 (${q4.length})</div><div class="tm-quadrant-tasks">${q4.map(t => this.renderTaskCard(t)).join('')}</div></div>
            </div>
        `;
    }

    renderTrashView() {
        const deletedTasks = this.tasks.filter(t => t.isDeleted);
        if (deletedTasks.length === 0) {
            this.content.innerHTML = `<div class="tm-empty-state"><div class="tm-empty-state-icon">🗑️</div><div class="tm-empty-state-text">垃圾桶为空</div></div>`;
            return;
        }
        this.content.innerHTML = `<div class="tm-trash-view">${deletedTasks.map(t => `
            <div class="tm-trash-item">
                <div class="tm-trash-info"><div class="tm-trash-title">${t.title}</div><div class="tm-trash-date">删除于 ${new Date(t.deletedAt).toLocaleDateString()}</div></div>
                <div class="tm-trash-actions">
                    <button class="tm-btn tm-btn-secondary" onclick="window.tmPlugin.restoreTask('${t.id}')">恢复</button>
                    <button class="tm-btn tm-btn-secondary" onclick="window.tmPlugin.deleteTaskPermanently('${t.id}')">删除</button>
                </div>
            </div>`).join('')}</div>`;
    }

    renderStatsView() {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        const weekTasks = this.tasks.filter(t => !t.isDeleted && t.createdAt >= weekStart.getTime());
        const weekDone = weekTasks.filter(t => t.status === 'done').length;
        const total = weekTasks.length;
        const overdue = this.tasks.filter(t => !t.isDeleted && t.dueDate && t.dueDate < now.toISOString().split('T')[0] && t.status !== 'done').length;
        
        this.content.innerHTML = `
            <div class="tm-stat-card"><div class="tm-stat-title">本周完成率</div><div class="tm-stat-value">${total > 0 ? Math.round(weekDone / total * 100) : 0}%</div>
            <div class="tm-stat-bar"><div class="tm-stat-bar-fill" style="width:${total > 0 ? weekDone / total * 100 : 0}%;background:#22c55e;"></div></div></div>
            <div class="tm-stat-card"><div class="tm-stat-title">逾期任务</div><div class="tm-stat-value">${overdue}</div></div>
            <div class="tm-stat-card"><div class="tm-stat-title">总任务数</div><div class="tm-stat-value">${this.tasks.filter(t => !t.isDeleted).length}</div></div>
        `;
    }

    renderTemplatesView() {
        const personalTemplates = this.templates.filter(t => t.type === 'personal');
        this.content.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <h3 style="margin:0;font-size:16px;">任务模板</h3>
                <button class="tm-btn tm-btn-primary" id="tm-add-template">+ 新建模板</button>
            </div>
            <div class="tm-task-list">
                ${personalTemplates.length === 0 ? '<div class="tm-empty-state"><div class="tm-empty-state-icon">📋</div><div class="tm-empty-state-text">暂无模板</div></div>' : ''}
                ${personalTemplates.map(t => `
                    <div class="tm-template-card" data-template="${t.id}">
                        <div style="display:flex;align-items:center;gap:10px;">
                            <span style="font-size:20px;">📋</span>
                            <div>
                                <div style="font-weight:500;">${t.name}</div>
                                <div style="font-size:12px;color:#64748b;">${t.tasks?.length || 0} 个子任务</div>
                            </div>
                        </div>
                        <div class="tm-template-actions">
                            <button class="tm-btn tm-btn-primary tm-use-template" data-template="${t.id}">使用</button>
                            <button class="tm-btn tm-btn-secondary tm-delete-template" data-template="${t.id}">删除</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        // 新建模板
        document.getElementById('tm-add-template')?.addEventListener('click', () => this.showCreateTemplateModal());

        // 使用模板
        document.querySelectorAll('.tm-use-template').forEach(btn => {
            btn.addEventListener('click', () => this.useTemplate(btn.dataset.template));
        });

        // 删除模板
        document.querySelectorAll('.tm-delete-template').forEach(btn => {
            btn.addEventListener('click', () => this.deleteTemplate(btn.dataset.template));
        });
    }

    showCreateTemplateModal() {
        const modal = document.createElement('div');
        modal.className = 'tm-modal open';
        modal.innerHTML = `
            <div class="tm-modal-header"><span class="tm-modal-title">新建模板</span><button class="tm-modal-close">×</button></div>
            <div class="tm-form-group">
                <label class="tm-form-label">模板名称</label>
                <input type="text" class="tm-form-input" id="tm-template-name" placeholder="输入模板名称">
            </div>
            <div class="tm-form-group">
                <label class="tm-form-label">子任务（每行一个）</label>
                <textarea class="tm-detail-textarea" id="tm-template-tasks" placeholder="子任务1&#10;子任务2&#10;子任务3"></textarea>
            </div>
            <div class="tm-form-actions">
                <button class="tm-btn tm-btn-secondary tm-modal-cancel">取消</button>
                <button class="tm-btn tm-btn-primary tm-modal-confirm">创建</button>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('.tm-modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.tm-modal-cancel').addEventListener('click', () => modal.remove());
        modal.querySelector('.tm-modal-confirm').addEventListener('click', async () => {
            const name = document.getElementById('tm-template-name').value.trim();
            const tasksText = document.getElementById('tm-template-tasks').value.trim();
            if (name) {
                const tasks = tasksText ? tasksText.split('\n').filter(t => t.trim()).map(t => ({ title: t.trim(), done: false })) : [];
                this.templates.push({ id: this.generateId(), type: 'personal', name, tasks });
                await this.saveData();
                this.render();
                modal.remove();
            }
        });
    }

    useTemplate(templateId) {
        const template = this.templates.find(t => t.id === templateId);
        if (template) {
            this.createTask(template.name, {
                subtasks: template.tasks?.map(t => ({ ...t })) || []
            });
            this.api.ui.showToast(`已从模板"${template.name}"创建任务`, 'success');
        }
    }

    async deleteTemplate(templateId) {
        if (confirm('确定要删除这个模板吗？')) {
            this.templates = this.templates.filter(t => t.id !== templateId);
            await this.saveData();
            this.render();
        }
    }

    async resetPlugin() {
        if (confirm('⚠️ 确定要重置插件吗？\n\n这将删除所有数据（任务、清单、标签、团队、模板），并恢复默认设置。\n\n此操作不可恢复！')) {
            if (confirm('再次确认：真的要重置所有数据吗？')) {
                this.tasks = [];
                this.lists = [];
                this.tags = [];
                this.teams = [];
                this.templates = [];
                await this.loadData(); // 重新加载默认数据
                this.currentListId = null;
                this.currentFilter = { tag: null, status: null, search: '', smartFilter: null };
                this.render();
                this.api.ui.showToast('插件已重置为默认状态', 'success');
            }
        }
    }

    renderTaskCard(task) {
        const priorityColors = { 4: '#EF4444', 3: '#F97316', 2: '#3B82F6', 1: '#9CA3AF' };
        const list = this.lists.find(l => l.id === task.listId);
        const taskTags = task.tags?.map(tagId => this.tags.find(t => t.id === tagId)).filter(Boolean) || [];
        const subtasksDone = task.subtasks?.filter(s => s.done).length || 0;
        const subtasksTotal = task.subtasks?.length || 0;
        const isSelected = this.selectedTasks?.includes(task.id);
        
        return `<div class="tm-task-card ${isSelected ? 'selected' : ''}" data-task="${task.id}" draggable="true">
            <div class="tm-task-header">
                <input type="checkbox" class="tm-task-batch-check" data-batch-task="${task.id}" ${isSelected ? 'checked' : ''} title="选择任务">
                <div class="tm-task-checkbox ${task.status === 'done' ? 'checked' : ''}" data-task-id="${task.id}">${task.status === 'done' ? '✓' : ''}</div>
                <div class="tm-task-title ${task.status === 'done' ? 'completed' : ''}">${task.title}</div>
                <div class="tm-task-priority" style="background:${priorityColors[task.priority]}"></div>
                <div class="tm-task-menu" data-task-menu="${task.id}" title="更多操作">⋯</div>
            </div>
            <div class="tm-task-meta">
                ${task.dueDate ? `<span>📅 ${this.formatDate(task.dueDate)}</span>` : ''}
                ${list ? `<span>📁 ${list.name}</span>` : ''}
                ${taskTags.map(tag => `<span class="tm-task-tag" style="background:${tag.color}">${tag.name}</span>`).join('')}
                ${subtasksTotal > 0 ? `<span>📝 ${subtasksDone}/${subtasksTotal}</span>` : ''}
            </div>
        </div>`;
    }

    renderTaskDetail(task) {
        const priorityColors = { 4: '#EF4444', 3: '#F97316', 2: '#3B82F6', 1: '#9CA3AF' };
        const priorityLabels = { 4: '高', 3: '中', 2: '低', 1: '普通' };
        const taskTags = task.tags?.map(tagId => this.tags.find(t => t.id === tagId)).filter(Boolean) || [];
        
        this.detailContent.innerHTML = `
            <div class="tm-detail-field">
                <label class="tm-detail-label">任务名称</label>
                <input type="text" class="tm-detail-input" id="tm-task-title" value="${task.title}">
            </div>
            <div class="tm-detail-field">
                <label class="tm-detail-label">
                    <input type="checkbox" id="tm-task-status" ${task.status === 'done' ? 'checked' : ''}> 标记为完成
                </label>
            </div>
            <div class="tm-detail-field">
                <div class="tm-detail-label">优先级</div>
                <div class="tm-priority-selector">
                    ${[4, 3, 2, 1].map(p => `<div class="tm-priority-btn ${task.priority === p ? 'selected' : ''}" style="background:${priorityColors[p]}" data-priority="${p}" title="${priorityLabels[p]}"></div>`).join('')}
                </div>
            </div>
            <div class="tm-detail-field">
                <label class="tm-detail-label">截止日期</label>
                <input type="date" class="tm-detail-input" id="tm-task-due-date" value="${task.dueDate || ''}">
            </div>
            <div class="tm-detail-field">
                <label class="tm-detail-label">截止时间</label>
                <input type="time" class="tm-detail-input" id="tm-task-due-time" value="${task.dueTime || ''}">
            </div>
            <div class="tm-detail-field">
                <div class="tm-detail-label">间隔提醒</div>
                <div class="tm-reminder-list" id="tm-reminder-list">
                    ${(task.reminders || []).map((r, i) => `<div class="tm-reminder-item">
                        <input type="number" class="tm-reminder-value" data-index="${i}" value="${r.time}" min="1" style="width:60px;">
                        <select class="tm-reminder-unit" data-index="${i}">
                            <option value="minutes" ${r.unit === 'minutes' ? 'selected' : ''}>分钟</option>
                            <option value="hours" ${r.unit === 'hours' ? 'selected' : ''}>小时</option>
                            <option value="days" ${r.unit === 'days' ? 'selected' : ''}>天</option>
                            <option value="months" ${r.unit === 'months' ? 'selected' : ''}>月</option>
                        </select>
                        <button class="tm-remove-reminder" data-index="${i}">×</button>
                    </div>`).join('')}
                    <button class="tm-btn tm-btn-secondary" id="tm-add-reminder" style="margin-top:8px;">+ 添加提醒</button>
                </div>
            </div>
            <div class="tm-detail-field">
                <div class="tm-detail-label">标签</div>
                <div id="tm-task-tags" class="tm-tag-selector">
                    ${taskTags.map(tag => `<span class="tm-task-tag" style="background:${tag.color}" data-tag-id="${tag.id}">${tag.name} <span class="tm-tag-remove" data-remove-tag="${tag.id}">×</span></span>`).join('')}
                    <select id="tm-add-tag-to-task" class="tm-tag-select">
                        <option value="">+ 添加标签</option>
                        ${this.tags.filter(t => !task.tags?.includes(t.id)).map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="tm-detail-field">
                <label class="tm-detail-label">描述</label>
                <textarea class="tm-detail-textarea" id="tm-task-content">${task.content || ''}</textarea>
            </div>
            <div class="tm-detail-field">
                <div class="tm-detail-label">子任务 (${task.subtasks?.length || 0})</div>
                <div id="tm-subtasks">
                    ${(task.subtasks || []).map((st, i) => `<div class="tm-subtask-item">
                        <div class="tm-subtask-checkbox ${st.done ? 'checked' : ''}" data-subtask="${i}">${st.done ? '✓' : ''}</div>
                        <span class="tm-subtask-title ${st.done ? 'completed' : ''}">${st.title}</span>
                        <span class="tm-subtask-delete" data-delete-subtask="${i}">×</span>
                    </div>`).join('')}
                    <div class="tm-add-subtask">
                        <input type="text" class="tm-detail-input" id="tm-new-subtask" placeholder="添加子任务..." style="flex:1;">
                        <button class="tm-btn tm-btn-primary" id="tm-add-subtask-btn">+</button>
                    </div>
                </div>
            </div>
            <div class="tm-detail-field">
                <div class="tm-detail-label">附件</div>
                <div id="tm-attachments" class="tm-drop-zone">
                    ${(task.attachments || []).map(att => `<div class="tm-attachment-item">
                        <div class="tm-attachment-icon">${att.isImage ? '🖼️' : '📎'}</div>
                        <div class="tm-attachment-info">
                            <div class="tm-attachment-name">${att.name}</div>
                            <div class="tm-attachment-size">${this.formatFileSize(att.size)}</div>
                        </div>
                    </div>`).join('')}
                    <div class="tm-add-attachment" id="tm-add-attachment">+ 添加附件（拖拽到此处）</div>
                </div>
            </div>
            <div class="tm-detail-actions">
                <button class="tm-btn tm-btn-primary" id="tm-save-task">💾 保存</button>
                <button class="tm-btn tm-btn-secondary" id="tm-delete-task">🗑️ 删除</button>
            </div>
        `;
        
        this.setupTaskDetailEvents(task);
    }

    setupTaskDetailEvents(task) {
        document.getElementById('tm-save-task')?.addEventListener('click', () => this.saveTaskFromDetail(task));
        document.getElementById('tm-delete-task')?.addEventListener('click', () => this.deleteTask(task.id));
        
        // 优先级选择
        document.querySelectorAll('.tm-priority-btn[data-priority]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tm-priority-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                task.priority = parseInt(btn.dataset.priority);
            });
        });
        
        // 子任务
        document.getElementById('tm-add-subtask-btn')?.addEventListener('click', () => {
            const input = document.getElementById('tm-new-subtask');
            if (input.value.trim()) {
                if (!task.subtasks) task.subtasks = [];
                task.subtasks.push({ title: input.value.trim(), done: false });
                input.value = '';
                this.renderTaskDetail(task);
            }
        });
        
        document.querySelectorAll('.tm-subtask-checkbox').forEach(cb => {
            cb.addEventListener('click', () => {
                const idx = parseInt(cb.dataset.subtask);
                task.subtasks[idx].done = !task.subtasks[idx].done;
                this.renderTaskDetail(task);
            });
        });
        
        document.querySelectorAll('.tm-subtask-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.deleteSubtask);
                task.subtasks.splice(idx, 1);
                this.renderTaskDetail(task);
            });
        });
        
        // 添加标签
        document.getElementById('tm-add-tag-to-task')?.addEventListener('change', (e) => {
            if (e.target.value) {
                if (!task.tags) task.tags = [];
                task.tags.push(e.target.value);
                e.target.value = '';
                this.renderTaskDetail(task);
            }
        });
        
        // 移除标签
        document.querySelectorAll('.tm-tag-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tagId = btn.dataset.removeTag;
                task.tags = task.tags.filter(t => t !== tagId);
                this.renderTaskDetail(task);
            });
        });
        
        // 提醒
        document.getElementById('tm-add-reminder')?.addEventListener('click', () => {
            if (!task.reminders) task.reminders = [];
            task.reminders.push({ time: 15, unit: 'minutes' });
            this.renderTaskDetail(task);
        });
        
        document.querySelectorAll('.tm-remove-reminder').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index);
                task.reminders.splice(idx, 1);
                this.renderTaskDetail(task);
            });
        });
        
        document.querySelectorAll('.tm-reminder-value, .tm-reminder-unit').forEach(input => {
            input.addEventListener('change', () => {
                const idx = parseInt(input.dataset.index);
                if (input.classList.contains('tm-reminder-value')) task.reminders[idx].time = parseInt(input.value);
                else task.reminders[idx].unit = input.value;
            });
        });
        
        // 附件拖拽
        const dropZone = document.getElementById('tm-attachments');
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
            dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
                const files = e.dataTransfer.files;
                if (files.length > 0 && files[0].size <= 100 * 1024 * 1024) {
                    if (!task.attachments) task.attachments = [];
                    task.attachments.push({
                        id: this.generateId(),
                        name: files[0].name,
                        size: files[0].size,
                        isImage: files[0].type.startsWith('image/')
                    });
                    this.renderTaskDetail(task);
                }
            });
            
            document.getElementById('tm-add-attachment')?.addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file && file.size <= 100 * 1024 * 1024) {
                        if (!task.attachments) task.attachments = [];
                        task.attachments.push({
                            id: this.generateId(),
                            name: file.name,
                            size: file.size,
                            isImage: file.type.startsWith('image/')
                        });
                        this.renderTaskDetail(task);
                    }
                };
                input.click();
            });
        }
    }

    saveTaskFromDetail(task) {
        task.title = document.getElementById('tm-task-title')?.value || task.title;
        task.content = document.getElementById('tm-task-content')?.value || '';
        task.dueDate = document.getElementById('tm-task-due-date')?.value || null;
        task.dueTime = document.getElementById('tm-task-due-time')?.value || null;
        task.status = document.getElementById('tm-task-status')?.checked ? 'done' : (task.status === 'done' ? 'todo' : task.status);
        
        task.updatedAt = Date.now();
        task.activityLog.push({ action: 'updated', time: Date.now() });
        
        this.saveData();
        this.render();
        this.api.ui.showToast('任务已保存', 'success');
    }

    getFilteredTasks() {
        let tasks = this.tasks.filter(t => !t.isDeleted);
        if (this.currentListId) tasks = tasks.filter(t => t.listId === this.currentListId);
        if (this.currentFilter.tag) tasks = tasks.filter(t => t.tags?.includes(this.currentFilter.tag));
        if (this.currentFilter.status) tasks = tasks.filter(t => t.status === this.currentFilter.status);
        if (this.currentFilter.search) {
            const search = this.currentFilter.search.toLowerCase();
            tasks = tasks.filter(t => t.title?.toLowerCase().includes(search) || t.content?.toLowerCase().includes(search));
        }
        if (this.currentFilter.dueDate) tasks = tasks.filter(t => t.dueDate === this.currentFilter.dueDate);
        
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = this.getTomorrow();
        const weekEnd = this.getWeekEnd();
        
        switch (this.currentFilter.smartFilter) {
            case 'today': tasks = tasks.filter(t => t.dueDate === today); break;
            case 'tomorrow': tasks = tasks.filter(t => t.dueDate === tomorrow); break;
            case 'week': tasks = tasks.filter(t => t.dueDate > tomorrow && t.dueDate <= weekEnd); break;
            case 'overdue': tasks = tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done'); break;
            case 'high-priority': tasks = tasks.filter(t => t.priority === 4); break;
        }
        
        return tasks;
    }

    getTaskCountByFilter(filter) {
        return this.tasks.filter(t => {
            if (t.isDeleted) return false;
            if (filter.dueDate && t.dueDate !== filter.dueDate) return false;
            if (filter.overdue) {
                const today = new Date().toISOString().split('T')[0];
                if (!t.dueDate || t.dueDate >= today || t.status === 'done') return false;
            }
            if (filter.priority && t.priority !== filter.priority) return false;
            return true;
        }).length;
    }

    switchView(view) {
        this.currentView = view;
        document.querySelectorAll('.tm-view-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === view));
        this.renderContent();
    }

    selectList(listId) {
        this.currentListId = listId;
        this.currentFilter = { tag: null, status: null, search: '', smartFilter: null };
        this.render();
    }

    async createTask(title, options = {}) {
        const task = {
            id: this.generateId(),
            listId: this.currentListId || this.lists[0]?.id || this.createDefaultList().id,
            title, content: options.content || '', status: 'todo',
            priority: options.priority || 3, dueDate: options.dueDate || null, dueTime: options.dueTime || null,
            reminders: options.reminders || [...this.config.defaultReminders],
            tags: options.tags || [], subtasks: [], attachments: [], comments: [],
            activityLog: [{ action: 'created', time: Date.now() }],
            isDeleted: false, createdAt: Date.now(), updatedAt: Date.now()
        };
        this.tasks.push(task);
        await this.saveData();
        this.render();
        return task;
    }

    async saveTask(task) {
        task.updatedAt = Date.now();
        task.activityLog.push({ action: 'updated', time: Date.now() });
        await this.saveData();
    }

    async deleteTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.isDeleted = true;
            task.deletedAt = Date.now();
            await this.saveData();
            this.detail.style.display = 'none';
            this.render();
        }
    }

    async restoreTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.isDeleted = false;
            task.deletedAt = null;
            await this.saveData();
            this.render();
        }
    }

    async deleteTaskPermanently(taskId) {
        const index = this.tasks.findIndex(t => t.id === taskId);
        if (index > -1) { this.tasks.splice(index, 1); await this.saveData(); this.render(); }
    }

    async toggleTaskStatus(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.status = task.status === 'done' ? 'todo' : 'done';
            task.updatedAt = Date.now();
            await this.saveData();
            this.render();
        }
    }

    createDefaultList() {
        const list = { id: this.generateId(), name: '默认', color: '#3B82F6', sort: 0, createdAt: Date.now() };
        this.lists.push(list);
        return list;
    }

    generateId() { return 'tm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9); }
    getTomorrow() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; }
    getWeekEnd() { const d = new Date(); d.setDate(d.getDate() + (7 - d.getDay())); return d.toISOString().split('T')[0]; }
    
    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const today = new Date(); today.setHours(0,0,0,0);
        const target = new Date(dateStr); target.setHours(0,0,0,0);
        const diff = Math.floor((target - today) / 86400000);
        if (diff === 0) return '今天'; if (diff === 1) return '明天'; if (diff === -1) return '昨天';
        if (diff < -1) return '已逾期';
        return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    async loadData() {
        this.lists = await this.api.storage.get('lists') || [];
        this.tasks = await this.api.storage.get('tasks') || [];
        this.tags = await this.api.storage.get('tags') || [];
        this.teams = await this.api.storage.get('teams') || [];
        this.templates = await this.api.storage.get('templates') || [];
        
        if (this.lists.length === 0) this.lists.push(this.createDefaultList());
        if (this.tags.length === 0) {
            this.tags = [
                { id: this.generateId(), name: '工作', color: '#3B82F6' },
                { id: this.generateId(), name: '生活', color: '#22C55E' },
                { id: this.generateId(), name: '紧急', color: '#EF4444' }
            ];
        }
        if (this.tasks.length === 0) {
            this.tasks = [
                { id: this.generateId(), listId: this.lists[0].id, title: '欢迎使用任务管理', content: '点击任务查看详情', status: 'done', priority: 1, dueDate: new Date().toISOString().split('T')[0], reminders: [], tags: [], subtasks: [], attachments: [], comments: [], activityLog: [], isDeleted: false, createdAt: Date.now(), updatedAt: Date.now() },
                { id: this.generateId(), listId: this.lists[0].id, title: '点击任务查看详情', content: '设置优先级和截止日期', status: 'todo', priority: 4, dueDate: new Date().toISOString().split('T')[0], reminders: [{time:15,unit:'minutes'}], tags: [], subtasks: [{title:'子任务1',done:false}], attachments: [], comments: [], activityLog: [], isDeleted: false, createdAt: Date.now(), updatedAt: Date.now() }
            ];
        }
        await this.saveData();
    }

    async saveData() {
        await this.api.storage.set('lists', this.lists);
        await this.api.storage.set('tasks', this.tasks);
        await this.api.storage.set('tags', this.tags);
        await this.api.storage.set('teams', this.teams);
        await this.api.storage.set('templates', this.templates);
    }

    registerEvents() {
        document.addEventListener('click', this.handleDocumentClick.bind(this));
        
        const searchInput = document.getElementById('tm-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => { this.currentFilter.search = e.target.value; this.renderContent(); });
            searchInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter' && e.target.value.trim()) { await this.createTask(e.target.value.trim()); e.target.value = ''; }
            });
        }
        
        document.getElementById('tm-date-filter')?.addEventListener('change', (e) => {
            this.currentFilter.dueDate = e.target.value || null;
            this.renderContent();
        });
        
        document.querySelectorAll('.tm-view-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchView(tab.dataset.view));
        });
    }

    handleDocumentClick(e) {
        if (e.target.closest('#tm-close-panel')) { this.closePanel(); return; }
        if (e.target.closest('#tm-detail-close')) { this.detail.style.display = 'none'; this.selectedTask = null; return; }
        
        // 任务菜单
        const menuBtn = e.target.closest('.tm-task-menu');
        if (menuBtn) {
            e.stopPropagation();
            this.showTaskMenu(menuBtn.dataset.taskMenu, menuBtn);
            return;
        }
        
        // 任务卡片
        const taskCard = e.target.closest('.tm-task-card[data-task]');
        if (taskCard && !e.target.closest('.tm-task-checkbox') && !e.target.closest('.tm-task-menu')) {
            const task = this.tasks.find(t => t.id === taskCard.dataset.task);
            if (task) { this.selectedTask = task; this.detail.style.display = 'flex'; this.renderTaskDetail(task); }
            return;
        }
        
        // 复选框
        if (e.target.closest('.tm-task-checkbox')) { this.toggleTaskStatus(e.target.closest('.tm-task-checkbox').dataset.taskId); return; }
        
        // 清单
        if (e.target.closest('[data-list]')) { this.selectList(e.target.closest('[data-list]').dataset.list); return; }
        
        // 智能清单
        if (e.target.closest('.tm-smart-list-item')) {
            const item = e.target.closest('.tm-smart-list-item');
            this.currentListId = null;
            this.currentFilter = { tag: null, status: null, search: '', smartFilter: item.dataset.smart };
            this.render();
            return;
        }
        
        // 标签
        if (e.target.closest('[data-tag]')) { this.currentFilter.tag = e.target.closest('[data-tag]').dataset.tag; this.currentListId = null; this.render(); return; }
        
        // 删除图标
        if (e.target.closest('[data-delete-tag]')) { this.confirmDelete('标签', e.target.closest('[data-delete-tag]').dataset.deleteTag, 'tag'); return; }
        if (e.target.closest('[data-delete-list]')) { this.confirmDelete('清单', e.target.closest('[data-delete-list]').dataset.deleteList, 'list'); return; }
        if (e.target.closest('[data-delete-team]')) { this.confirmDelete('团队', e.target.closest('[data-delete-team]').dataset.deleteTeam, 'team'); return; }
        
        // 左侧导航
        if (e.target.closest('#tm-view-trash')) { this.switchView('trash'); return; }
        if (e.target.closest('#tm-view-stats')) { this.switchView('stats'); return; }
        if (e.target.closest('#tm-view-templates')) { this.switchView('templates'); return; }
        if (e.target.closest('#tm-reset-plugin')) { this.resetPlugin(); return; }
        if (e.target.closest('#tm-add-list')) { this.showCreateListModal(); return; }
        if (e.target.closest('#tm-add-team')) { this.showCreateTeamModal(); return; }
        if (e.target.closest('#tm-add-tag')) { this.showCreateTagModal(); return; }
        
        // 导出功能
        if (e.target.closest('#tm-import-data')) { this.importData(); return; }
        if (e.target.closest('#tm-export-json')) { this.exportToJSON(); return; }
        if (e.target.closest('#tm-export-csv')) { this.exportToCSV(); return; }
        
        // 批量操作
        const batchCheck = e.target.closest('.tm-task-batch-check');
        if (batchCheck) {
            this.toggleBatchSelect(batchCheck.dataset.batchTask);
            return;
        }
        if (e.target.closest('#tm-batch-complete')) { this.batchComplete(); return; }
        if (e.target.closest('#tm-batch-priority')) { this.showBatchPriorityMenu(); return; }
        if (e.target.closest('#tm-batch-date')) { this.showBatchDateMenu(); return; }
        if (e.target.closest('#tm-batch-delete')) { this.batchDelete(); return; }
        if (e.target.closest('#tm-batch-cancel')) { this.clearBatchSelection(); return; }
        
        // 点击空白关闭详情
        if (e.target.closest('#tm-content') && !taskCard && this.detail.style.display === 'flex') {
            this.detail.style.display = 'none';
            this.selectedTask = null;
        }
    }

    showTaskMenu(taskId, btn) {
        const existing = document.querySelector('.tm-task-context-menu');
        if (existing) existing.remove();
        
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        const menu = document.createElement('div');
        menu.className = 'tm-task-context-menu';
        menu.innerHTML = `
            <div class="tm-context-menu-item" data-action="edit">✏️ 编辑</div>
            <div class="tm-context-menu-item" data-action="priority">⭐ 优先级</div>
            <div class="tm-context-menu-item" data-action="move">📁 移动到</div>
            <div class="tm-context-menu-item" data-action="delete">🗑️ 删除</div>
        `;
        
        const rect = btn.getBoundingClientRect();
        menu.style.top = rect.bottom + 5 + 'px';
        menu.style.left = rect.left - 100 + 'px';
        document.body.appendChild(menu);
        
        menu.addEventListener('click', (e) => {
            const item = e.target.closest('.tm-context-menu-item');
            if (!item) return;
            
            switch (item.dataset.action) {
                case 'edit':
                    this.selectedTask = task;
                    this.detail.style.display = 'flex';
                    this.renderTaskDetail(task);
                    break;
                case 'priority':
                    this.showPriorityMenu(task, menu);
                    return;
                case 'move':
                    this.showMoveMenu(task, menu);
                    return;
                case 'delete':
                    this.deleteTask(taskId);
                    break;
            }
            menu.remove();
        });
        
        setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 100);
    }

    showPriorityMenu(task, parentMenu) {
        const submenu = document.createElement('div');
        submenu.className = 'tm-task-context-menu';
        submenu.innerHTML = `
            <div class="tm-context-menu-item" data-priority="4">🔴 高</div>
            <div class="tm-context-menu-item" data-priority="3">🟠 中</div>
            <div class="tm-context-menu-item" data-priority="2">🔵 低</div>
            <div class="tm-context-menu-item" data-priority="1">⚪ 普通</div>
        `;
        
        const rect = parentMenu.getBoundingClientRect();
        submenu.style.top = rect.top + 'px';
        submenu.style.left = rect.right + 5 + 'px';
        document.body.appendChild(submenu);
        parentMenu.remove();
        
        submenu.addEventListener('click', async (e) => {
            const item = e.target.closest('.tm-context-menu-item');
            if (item) {
                task.priority = parseInt(item.dataset.priority);
                await this.saveTask(task);
                this.render();
                submenu.remove();
            }
        });
        
        setTimeout(() => document.addEventListener('click', () => submenu.remove(), { once: true }), 100);
    }

    showMoveMenu(task, parentMenu) {
        const submenu = document.createElement('div');
        submenu.className = 'tm-task-context-menu';
        submenu.innerHTML = this.lists.map(l => `<div class="tm-context-menu-item" data-move-list="${l.id}">📁 ${l.name}</div>`).join('');
        
        const rect = parentMenu.getBoundingClientRect();
        submenu.style.top = rect.top + 'px';
        submenu.style.left = rect.right + 5 + 'px';
        document.body.appendChild(submenu);
        parentMenu.remove();
        
        submenu.addEventListener('click', async (e) => {
            const item = e.target.closest('.tm-context-menu-item');
            if (item) {
                task.listId = item.dataset.moveList;
                await this.saveTask(task);
                this.render();
                submenu.remove();
            }
        });
        
        setTimeout(() => document.addEventListener('click', () => submenu.remove(), { once: true }), 100);
    }

    confirmDelete(type, id, deleteType) {
        if (confirm(`确定要删除这个${type}吗？`)) {
            if (deleteType === 'tag') this.tags = this.tags.filter(t => t.id !== id);
            else if (deleteType === 'list') this.lists = this.lists.filter(l => l.id !== id);
            else if (deleteType === 'team') this.teams = this.teams.filter(t => t.id !== id);
            this.saveData();
            this.render();
        }
    }

    showCreateListModal() {
        const modal = document.createElement('div');
        modal.className = 'tm-modal open';
        modal.innerHTML = `
            <div class="tm-modal-header"><span class="tm-modal-title">新建清单</span><button class="tm-modal-close">×</button></div>
            <div class="tm-form-group"><label class="tm-form-label">名称</label><input type="text" class="tm-form-input" id="tm-list-name" placeholder="输入清单名称"></div>
            <div class="tm-form-group"><label class="tm-form-label">颜色</label>
                <div class="tm-color-options">${['#EF4444','#F97316','#3B82F6','#22C55E','#8B5CF6','#EC4899'].map(c => `<div class="tm-color-option" data-color="${c}" style="background:${c}"></div>`).join('')}</div>
            </div>
            <div class="tm-form-actions"><button class="tm-btn tm-btn-secondary tm-modal-cancel">取消</button><button class="tm-btn tm-btn-primary tm-modal-confirm">创建</button></div>
        `;
        document.body.appendChild(modal);
        
        let selectedColor = '#3B82F6';
        modal.querySelectorAll('.tm-color-option').forEach(opt => {
            opt.addEventListener('click', () => {
                modal.querySelectorAll('.tm-color-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                selectedColor = opt.dataset.color;
            });
        });
        
        modal.querySelector('.tm-modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.tm-modal-cancel').addEventListener('click', () => modal.remove());
        modal.querySelector('.tm-modal-confirm').addEventListener('click', async () => {
            const name = document.getElementById('tm-list-name').value.trim();
            if (name) {
                this.lists.push({ id: this.generateId(), name, color: selectedColor, sort: this.lists.length, createdAt: Date.now() });
                await this.saveData(); this.render(); modal.remove();
            }
        });
    }

    showCreateTeamModal() {
        const modal = document.createElement('div');
        modal.className = 'tm-modal open';
        modal.innerHTML = `
            <div class="tm-modal-header"><span class="tm-modal-title">创建团队</span><button class="tm-modal-close">×</button></div>
            <div class="tm-form-group"><label class="tm-form-label">团队名称</label><input type="text" class="tm-form-input" id="tm-team-name" placeholder="输入团队名称"></div>
            <div class="tm-form-actions"><button class="tm-btn tm-btn-secondary tm-modal-cancel">取消</button><button class="tm-btn tm-btn-primary tm-modal-confirm">创建</button></div>
        `;
        document.body.appendChild(modal);
        
        modal.querySelector('.tm-modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.tm-modal-cancel').addEventListener('click', () => modal.remove());
        modal.querySelector('.tm-modal-confirm').addEventListener('click', async () => {
            const name = document.getElementById('tm-team-name').value.trim();
            if (name) {
                const inviteCode = this.generateInviteCode();
                this.teams.push({ id: this.generateId(), name, inviteCode, ownerId: 'current_user', members: [{ userId: 'current_user', name: '我', role: 'admin', online: true }], createdAt: Date.now() });
                await this.saveData(); this.render();
                this.api.ui.showToast(`团队已创建，邀请码: ${inviteCode}`, 'success');
                modal.remove();
            }
        });
    }

    showCreateTagModal() {
        const modal = document.createElement('div');
        modal.className = 'tm-modal open';
        modal.innerHTML = `
            <div class="tm-modal-header"><span class="tm-modal-title">新建标签</span><button class="tm-modal-close">×</button></div>
            <div class="tm-form-group"><label class="tm-form-label">标签名称</label><input type="text" class="tm-form-input" id="tm-tag-name" placeholder="输入标签名称"></div>
            <div class="tm-form-group"><label class="tm-form-label">颜色</label>
                <div class="tm-color-options">${['#EF4444','#F97316','#3B82F6','#22C55E','#8B5CF6','#EC4899'].map(c => `<div class="tm-color-option" data-color="${c}" style="background:${c}"></div>`).join('')}</div>
            </div>
            <div class="tm-form-actions"><button class="tm-btn tm-btn-secondary tm-modal-cancel">取消</button><button class="tm-btn tm-btn-primary tm-modal-confirm">创建</button></div>
        `;
        document.body.appendChild(modal);
        
        let selectedColor = '#3B82F6';
        modal.querySelectorAll('.tm-color-option').forEach(opt => {
            opt.addEventListener('click', () => {
                modal.querySelectorAll('.tm-color-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                selectedColor = opt.dataset.color;
            });
        });
        
        modal.querySelector('.tm-modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.tm-modal-cancel').addEventListener('click', () => modal.remove());
        modal.querySelector('.tm-modal-confirm').addEventListener('click', async () => {
            const name = document.getElementById('tm-tag-name').value.trim();
            if (name) {
                this.tags.push({ id: this.generateId(), name, color: selectedColor });
                await this.saveData(); this.render(); modal.remove();
            }
        });
    }

    generateInviteCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = ''; for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
        return code;
    }

    setupDragAndDrop() {
        const cards = this.querySelectorAll('.tm-task-card');
        cards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                this.draggedTask = card.dataset.task;
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                this.draggedTask = null;
            });
        });
        
        const columns = document.querySelectorAll('.tm-board-column');
        columns.forEach(col => {
            col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drag-over'); });
            col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
            col.addEventListener('drop', async (e) => {
                e.preventDefault();
                col.classList.remove('drag-over');
                if (this.draggedTask) {
                    const task = this.tasks.find(t => t.id === this.draggedTask);
                    if (task) {
                        task.status = col.dataset.status;
                        await this.saveData(task);
                        this.render();
                    }
                }
            });
        });
    }

    cleanupUI() {
        if (this.panel) this.panel.remove();
    }

    startReminderCheck() {
        this.reminderInterval = setInterval(() => this.checkReminders(), 60000);
    }

    stopReminderCheck() {
        if (this.reminderInterval) clearInterval(this.reminderInterval);
    }

    checkReminders() {
        const now = new Date();
        this.tasks.filter(t => !t.isDeleted && t.status !== 'done' && t.dueDate).forEach(task => {
            const due = new Date(task.dueDate + ' ' + (task.dueTime || '23:59'));
            (task.reminders || []).forEach(reminder => {
                const ms = this.getReminderMs(reminder);
                const diff = due - now;
                if (diff > 0 && diff <= ms && diff > ms - 60000) {
                    this.api.ui.showToast(`提醒: ${task.title} 截止时间快到了！`, 'info');
                }
            });
        });
    }

    getReminderMs(r) {
        switch (r.unit) {
            case 'minutes': return r.time * 60000;
            case 'hours': return r.time * 3600000;
            case 'days': return r.time * 86400000;
            case 'months': return r.time * 2592000000;
            default: return 0;
        }
    }

    // 导入功能
    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    
                    if (!data.version || !data.lists || !data.tasks) {
                        this.api.ui.showToast('无效的备份文件格式', 'error');
                        return;
                    }

                    // 显示导入选项弹窗
                    this.showImportModal(data);
                } catch (error) {
                    this.api.ui.showToast('文件解析失败', 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    showImportModal(data) {
        const modal = document.createElement('div');
        modal.className = 'tm-modal open';
        const taskCount = data.tasks?.length || 0;
        const listCount = data.lists?.length || 0;
        const tagCount = data.tags?.length || 0;
        
        modal.innerHTML = `
            <div class="tm-modal-header"><span class="tm-modal-title">导入数据</span><button class="tm-modal-close">×</button></div>
            <div style="padding:16px;">
                <div style="background:#f8fafc;padding:12px;border-radius:8px;margin-bottom:16px;">
                    <div style="font-size:13px;color:#64748b;">文件信息</div>
                    <div style="font-size:14px;margin-top:8px;">
                        <div>📋 清单: ${listCount} 个</div>
                        <div>📝 任务: ${taskCount} 个</div>
                        <div>🏷️ 标签: ${tagCount} 个</div>
                        <div style="font-size:12px;color:#94a3b8;margin-top:4px;">导出时间: ${new Date(data.exportTime).toLocaleString()}</div>
                    </div>
                </div>
                <div class="tm-form-group">
                    <label class="tm-form-label">导入方式</label>
                    <div style="display:flex;flex-direction:column;gap:8px;">
                        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:10px;border:1px solid #e2e8f0;border-radius:6px;">
                            <input type="radio" name="import-mode" value="merge" checked>
                            <div>
                                <div style="font-weight:500;">累加导入</div>
                                <div style="font-size:12px;color:#64748b;">将数据添加到现有数据中</div>
                            </div>
                        </label>
                        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:10px;border:1px solid #e2e8f0;border-radius:6px;">
                            <input type="radio" name="import-mode" value="replace">
                            <div>
                                <div style="font-weight:500;">覆盖导入</div>
                                <div style="font-size:12px;color:#ef4444;">删除所有现有数据，替换为导入数据</div>
                            </div>
                        </label>
                    </div>
                </div>
            </div>
            <div class="tm-form-actions">
                <button class="tm-btn tm-btn-secondary tm-modal-cancel">取消</button>
                <button class="tm-btn tm-btn-primary tm-modal-confirm">确认导入</button>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('.tm-modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.tm-modal-cancel').addEventListener('click', () => modal.remove());
        modal.querySelector('.tm-modal-confirm').addEventListener('click', async () => {
            const mode = modal.querySelector('input[name="import-mode"]:checked').value;
            await this.processImport(data, mode);
            modal.remove();
        });
    }

    async processImport(data, mode) {
        try {
            if (mode === 'replace') {
                // 覆盖模式：替换所有数据
                this.lists = data.lists || [];
                this.tasks = data.tasks || [];
                this.tags = data.tags || [];
                this.teams = data.teams || [];
                this.templates = data.templates || [];
            } else {
                // 累加模式：添加到现有数据
                if (data.lists) {
                    data.lists.forEach(list => {
                        if (!this.lists.find(l => l.id === list.id)) {
                            this.lists.push(list);
                        }
                    });
                }
                
                if (data.tasks) {
                    data.tasks.forEach(task => {
                        if (!this.tasks.find(t => t.id === task.id)) {
                            this.tasks.push(task);
                        }
                    });
                }
                
                if (data.tags) {
                    data.tags.forEach(tag => {
                        if (!this.tags.find(t => t.id === tag.id)) {
                            this.tags.push(tag);
                        }
                    });
                }
                
                if (data.teams) {
                    data.teams.forEach(team => {
                        if (!this.teams.find(t => t.id === team.id)) {
                            this.teams.push(team);
                        }
                    });
                }
                
                if (data.templates) {
                    data.templates.forEach(template => {
                        if (!this.templates.find(t => t.id === template.id)) {
                            this.templates.push(template);
                        }
                    });
                }
            }
            
            await this.saveData();
            this.render();
            this.api.ui.showToast(`导入成功！${data.tasks?.length || 0} 个任务已${mode === 'replace' ? '替换' : '添加'}`, 'success');
        } catch (error) {
            console.error('导入失败:', error);
            this.api.ui.showToast('导入失败: ' + error.message, 'error');
        }
    }

    exportToJSON() {
        const data = {
            version: '1.0',
            exportTime: new Date().toISOString(),
            lists: this.lists,
            tasks: this.tasks.filter(t => !t.isDeleted),
            tags: this.tags,
            teams: this.teams,
            templates: this.templates
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `task-manager-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.api.ui.showToast('JSON 导出成功', 'success');
    }

    exportToCSV() {
        const tasks = this.tasks.filter(t => !t.isDeleted);
        const headers = ['清单', '任务标题', '状态', '优先级', '截止日期', '标签', '创建时间'];
        const rows = tasks.map(t => {
            const list = this.lists.find(l => l.id === t.listId);
            const statusMap = { todo: '待办', in_progress: '进行中', done: '已完成' };
            const priorityMap = { 4: '高', 3: '中', 2: '低', 1: '普通' };
            const taskTags = t.tags?.map(id => this.tags.find(tag => tag.id === id)?.name).filter(Boolean).join(';') || '';
            return [
                list?.name || '',
                `"${t.title}"`,
                statusMap[t.status],
                priorityMap[t.priority],
                t.dueDate || '',
                taskTags,
                new Date(t.createdAt).toLocaleDateString()
            ].join(',');
        });
        
        const csv = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `task-manager-export-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        this.api.ui.showToast('CSV 导出成功', 'success');
    }

    // 批量操作
    toggleBatchSelect(taskId) {
        const index = this.selectedTasks.indexOf(taskId);
        if (index > -1) {
            this.selectedTasks.splice(index, 1);
        } else {
            this.selectedTasks.push(taskId);
        }
        this.updateBatchBar();
    }

    updateBatchBar() {
        const batchBar = document.getElementById('tm-batch-bar');
        const batchCount = document.getElementById('tm-batch-count');
        if (this.selectedTasks.length > 0) {
            batchBar.style.display = 'flex';
            batchCount.textContent = this.selectedTasks.length;
        } else {
            batchBar.style.display = 'none';
        }
    }

    batchComplete() {
        this.selectedTasks.forEach(taskId => {
            const task = this.tasks.find(t => t.id === taskId);
            if (task) task.status = 'done';
        });
        this.selectedTasks = [];
        this.updateBatchBar();
        this.saveData();
        this.render();
    }

    batchDelete() {
        if (confirm(`确定要删除选中的 ${this.selectedTasks.length} 个任务吗？`)) {
            this.selectedTasks.forEach(taskId => {
                const task = this.tasks.find(t => t.id === taskId);
                if (task) { task.isDeleted = true; task.deletedAt = Date.now(); }
            });
            this.selectedTasks = [];
            this.updateBatchBar();
            this.saveData();
            this.render();
        }
    }

    showBatchPriorityMenu() {
        const modal = document.createElement('div');
        modal.className = 'tm-modal open';
        modal.innerHTML = `
            <div class="tm-modal-header"><span class="tm-modal-title">设置优先级</span><button class="tm-modal-close">×</button></div>
            <div style="padding:20px;">
                <div class="tm-priority-selector" style="justify-content:center;">
                    <div class="tm-priority-btn" data-priority="4" style="background:#EF4444;width:40px;height:40px;" title="高"></div>
                    <div class="tm-priority-btn" data-priority="3" style="background:#F97316;width:40px;height:40px;" title="中"></div>
                    <div class="tm-priority-btn" data-priority="2" style="background:#3B82F6;width:40px;height:40px;" title="低"></div>
                    <div class="tm-priority-btn" data-priority="1" style="background:#9CA3AF;width:40px;height:40px;" title="普通"></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('.tm-modal-close').addEventListener('click', () => modal.remove());
        modal.querySelectorAll('.tm-priority-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const priority = parseInt(btn.dataset.priority);
                this.selectedTasks.forEach(taskId => {
                    const task = this.tasks.find(t => t.id === taskId);
                    if (task) task.priority = priority;
                });
                this.selectedTasks = [];
                this.updateBatchBar();
                await this.saveData();
                this.render();
                modal.remove();
            });
        });
    }

    showBatchDateMenu() {
        const modal = document.createElement('div');
        modal.className = 'tm-modal open';
        modal.innerHTML = `
            <div class="tm-modal-header"><span class="tm-modal-title">设置截止日期</span><button class="tm-modal-close">×</button></div>
            <div class="tm-form-group" style="padding:0 16px;">
                <label class="tm-form-label">选择日期</label>
                <input type="date" class="tm-form-input" id="tm-batch-date-input">
            </div>
            <div class="tm-form-actions">
                <button class="tm-btn tm-btn-secondary tm-modal-cancel">取消</button>
                <button class="tm-btn tm-btn-primary tm-modal-confirm">确定</button>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('.tm-modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.tm-modal-cancel').addEventListener('click', () => modal.remove());
        modal.querySelector('.tm-modal-confirm').addEventListener('click', async () => {
            const date = document.getElementById('tm-batch-date-input').value;
            if (date) {
                this.selectedTasks.forEach(taskId => {
                    const task = this.tasks.find(t => t.id === taskId);
                    if (task) task.dueDate = date;
                });
                this.selectedTasks = [];
                this.updateBatchBar();
                await this.saveData();
                this.render();
            }
            modal.remove();
        });
    }

    clearBatchSelection() {
        this.selectedTasks = [];
        this.updateBatchBar();
        this.render();
    }
}

registerPlugin('task-manager', TaskManagerPlugin);

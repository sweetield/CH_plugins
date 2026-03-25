/**
 * 团队协作插件 - 学习计划视图
 */

class PlanView {
    constructor(panel, planService, notificationService, eventBus) {
        this.panel = panel;
        this.planService = planService;
        this.notificationService = notificationService;
        this.eventBus = eventBus;
        this.currentProjectId = null;
        this.currentUserId = null;
        this.plans = [];
    }

    /**
     * 初始化
     * @param {string} projectId - 项目 ID
     * @param {string} userId - 用户 ID
     */
    async init(projectId, userId) {
        this.currentProjectId = projectId;
        this.currentUserId = userId;
        await this.loadPlans();
        this.render();
        this.bindEvents();
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

            if (!title) {
                this.panel.api.ui.showToast('请输入计划标题', 'warning');
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
                    assigneeIds: [this.currentUserId]
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
            this.renderPlanDetail(plan, progress);
        } catch (error) {
            this.panel.api.ui.showToast('获取计划详情失败', 'error');
        }
    }

    /**
     * 渲染计划详情
     * @param {Object} plan - 计划对象
     * @param {Object} progress - 进度对象
     */
    renderPlanDetail(plan, progress) {
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

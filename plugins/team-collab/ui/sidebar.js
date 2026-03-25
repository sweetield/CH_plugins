/**
 * 团队协作插件 - 侧边栏组件
 */

class Sidebar {
    constructor(panel, projectService, indexManager, crypto, eventBus, importExportService) {
        this.panel = panel;
        this.projectService = projectService;
        this.indexManager = indexManager;
        this.crypto = crypto;
        this.eventBus = eventBus;
        this.importExportService = importExportService;
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
            <div class="tc-sidebar">
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
            </div>
        `;

        this.panel.setContent(html);
        this.bindEvents();
        this.updateTaskCount();
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

        this.panel.setContent(html);
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
    }

    /**
     * 项目切换回调
     */
    onProjectChange() {
        // 触发项目切换事件
        this.eventBus.emit('project.changed', { projectId: this.currentProjectId });
        this.updateTaskCount();
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

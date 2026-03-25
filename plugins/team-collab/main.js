/**
 * 团队协作插件 - 主入口
 * 版本: 3.0.0
 */

// 加载依赖模块
(function () {
    // 检查依赖是否加载
    const checkDependencies = () => {
        return window.TCConstants &&
            window.TCErrors &&
            window.TCEventBus &&
            window.TCCryptoManager &&
            window.TCStorageAdapter &&
            window.TCIndexManager &&
            window.TCPermissionService &&
            window.TCProjectService &&
            window.TCTaskService &&
            window.TCCommentService &&
            window.TCPlanService &&
            window.TCNotificationService &&
            window.TCImportExportService &&
            window.TCMarkdownRenderer &&
            window.TCPanel &&
            window.TCSidebar &&
            window.TCTaskBoard &&
            window.TCTaskList &&
            window.TCTaskDetail &&
            window.TCCommentInput &&
            window.TCCommentList &&
            window.TCPlanView &&
            window.TCInboxView &&
            window.TCUtils;
    };

    // 等待依赖加载
    const waitForDependencies = () => {
        return new Promise((resolve) => {
            const check = () => {
                if (checkDependencies()) {
                    resolve();
                } else {
                    setTimeout(check, 50);
                }
            };
            check();
        });
    };

    // 插件主类
    class TeamCollabPlugin {
        constructor(api) {
            this.api = api;
            this.isActivated = false;

            // 核心组件
            this.eventBus = null;
            this.crypto = null;
            this.storage = null;
            this.indexManager = null;
            this.permissionService = null;
            this.projectService = null;
            this.taskService = null;
            this.commentService = null;
            this.planService = null;
            this.notificationService = null;
            this.importExportService = null;
            this.markdownRenderer = null;

            // UI 组件
            this.panel = null;
            this.sidebar = null;
            this.taskBoard = null;
            this.taskList = null;
            this.taskDetail = null;
            this.commentInput = null;
            this.commentList = null;
            this.planView = null;
            this.inboxView = null;

            // 按钮相关
            this.collabBtn = null;
            this.collabButtonObserver = null;
            this.collabButtonPollInterval = null;

            // 当前状态
            this.currentUserId = null;
            this.currentProjectId = null;
            this.currentView = 'tasks';
        }

        /**
         * 插件激活
         */
        async onActivate() {
            try {
                console.log('[团队协作] 插件激活中...');

                // 等待依赖加载
                await waitForDependencies();

                // 初始化核心组件
                await this.initCore();

                // 获取当前用户
                await this.initCurrentUser();

                // 初始化 UI
                this.initUI();

                // 绑定事件
                this.bindEvents();

                // 添加工具栏按钮
                this.tryAddCollabButton();

                // 注册全局引用（用于调试）
                window.tcPlugin = this;

                this.isActivated = true;
                console.log('[团队协作] 插件激活成功');

                this.api.ui.showToast('团队协作插件已启用', 'success');

            } catch (error) {
                console.error('[团队协作] 插件激活失败:', error);
                this.api.ui.showToast('团队协作插件激活失败: ' + error.message, 'error');
            }
        }

        /**
         * 插件停用
         */
        async onDeactivate() {
            try {
                console.log('[团队协作] 插件停用中...');

                // 移除工具栏按钮
                this.removeCollabButton();

                // 销毁 UI
                if (this.panel) {
                    this.panel.destroy();
                }

                // 清理事件总线
                if (this.eventBus) {
                    this.eventBus.clear();
                }

                // 清除全局引用
                window.tcPlugin = null;

                this.isActivated = false;
                console.log('[团队协作] 插件已停用');

            } catch (error) {
                console.error('[团队协作] 插件停用失败:', error);
            }
        }

        /**
         * 初始化核心组件
         */
        async initCore() {
            const EventBus = window.TCEventBus;
            const CryptoManager = window.TCCryptoManager;
            const StorageAdapter = window.TCStorageAdapter;
            const IndexManager = window.TCIndexManager;
            const PermissionService = window.TCPermissionService;
            const ProjectService = window.TCProjectService;
            const TaskService = window.TCTaskService;
            const CommentService = window.TCCommentService;
            const PlanService = window.TCPlanService;
            const NotificationService = window.TCNotificationService;
            const MarkdownRenderer = window.TCMarkdownRenderer;

            // 事件总线
            this.eventBus = new EventBus();

            // 加密管理器
            this.crypto = new CryptoManager();
            await this.crypto.init(this.api);

            // 存储适配器
            this.storage = new StorageAdapter(this.api, this.crypto);

            // 索引管理器
            this.indexManager = new IndexManager(this.storage, this.eventBus);

            // 权限服务
            this.permissionService = new PermissionService(this.storage, this.eventBus);

            // 项目服务
            this.projectService = new ProjectService(
                this.storage,
                this.crypto,
                this.permissionService,
                this.indexManager,
                this.eventBus
            );

            // 任务服务
            this.taskService = new TaskService(
                this.storage,
                this.crypto,
                this.permissionService,
                this.indexManager,
                this.eventBus
            );

            // 评论服务
            this.commentService = new CommentService(
                this.storage,
                this.crypto,
                this.permissionService,
                this.eventBus
            );

            // 学习计划服务
            this.planService = new PlanService(
                this.storage,
                this.crypto,
                this.permissionService,
                this.indexManager,
                this.eventBus
            );

            // 通知服务
            this.notificationService = new NotificationService(
                this.storage,
                this.crypto,
                this.eventBus
            );

            // 导入导出服务
            this.importExportService = new ImportExportService(
                this.storage,
                this.crypto,
                this.permissionService,
                this.indexManager,
                this.eventBus
            );

            // Markdown 渲染器
            this.markdownRenderer = new MarkdownRenderer();

            console.log('[团队协作] 核心组件初始化完成');
        }

        /**
         * 初始化当前用户
         */
        async initCurrentUser() {
            try {
                const response = await this.api.http.get('/api/get_current_user');
                if (response && response.uid) {
                    this.currentUserId = response.uid;
                }
            } catch (error) {
                console.warn('[团队协作] 获取用户信息失败，使用默认值');
            }

            if (!this.currentUserId) {
                let userId = await this.api.storage.get('plugin:team-collab:temp-user-id');
                if (!userId) {
                    userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                    await this.api.storage.set('plugin:team-collab:temp-user-id', userId);
                }
                this.currentUserId = userId;
            }

            console.log('[团队协作] 当前用户 ID:', this.currentUserId);
        }

        /**
         * 初始化 UI
         */
        initUI() {
            const Panel = window.TCPanel;
            const Sidebar = window.TCSidebar;
            const TaskBoard = window.TCTaskBoard;
            const TaskList = window.TCTaskList;
            const TaskDetail = window.TCTaskDetail;
            const CommentInput = window.TCCommentInput;
            const CommentList = window.TCCommentList;
            const PlanView = window.TCPlanView;
            const InboxView = window.TCInboxView;

            // 创建面板
            this.panel = new Panel(this.api);
            this.panel.create();

            // 创建侧边栏
            this.sidebar = new Sidebar(
                this.panel,
                this.projectService,
                this.indexManager,
                this.crypto,
                this.eventBus,
                this.importExportService
            );

            // 创建任务看板
            this.taskBoard = new TaskBoard(
                this.panel,
                this.taskService,
                this.indexManager,
                this.eventBus
            );

            // 创建任务列表
            this.taskList = new TaskList(
                this.panel,
                this.taskService,
                this.indexManager,
                this.eventBus
            );

            // 创建任务详情
            this.taskDetail = new TaskDetail(
                this.panel,
                this.taskService,
                this.projectService,
                this.eventBus
            );

            // 创建评论输入框
            this.commentInput = new CommentInput(
                this.panel,
                this.commentService,
                this.markdownRenderer,
                this.eventBus
            );

            // 创建评论列表
            this.commentList = new CommentList(
                this.panel,
                this.commentService,
                this.markdownRenderer,
                this.eventBus
            );

            // 创建学习计划视图
            this.planView = new PlanView(
                this.panel,
                this.planService,
                this.notificationService,
                this.eventBus
            );

            // 创建收件箱视图
            this.inboxView = new InboxView(
                this.panel,
                this.notificationService,
                this.eventBus
            );

            console.log('[团队协作] UI 初始化完成');
        }

        /**
         * 绑定事件
         */
        bindEvents() {
            // 项目切换事件
            this.eventBus.on('project.changed', async (data) => {
                this.currentProjectId = data.projectId;
                await this.showTaskView();
            });

            // 视图切换事件
            this.eventBus.on('view.changed', async (data) => {
                this.currentProjectId = data.projectId || this.currentProjectId;
                switch (data.view) {
                    case 'tasks':
                    case 'task-board':
                        await this.showTaskView('board');
                        break;
                    case 'task-list':
                        await this.showTaskView('list');
                        break;
                    case 'plans':
                        await this.showPlansView();
                        break;
                    case 'inbox':
                        await this.showInboxView();
                        break;
                    case 'activity':
                        this.showActivityView();
                        break;
                }
            });

            // 任务详情事件
            this.eventBus.on('task.detail', async (data) => {
                if (data.task) {
                    await this.taskDetail.show(data.task, this.currentUserId);
                } else if (data.taskId) {
                    const task = await this.taskService.getTask(data.taskId, this.currentUserId);
                    if (task) {
                        await this.taskDetail.show(task, this.currentUserId);
                    }
                }
            });

            // 返回事件
            this.eventBus.on('task.back', async () => {
                await this.showTaskView();
            });
        }

        /**
         * 显示任务视图
         * @param {string} type - 'board' 或 'list'
         */
        async showTaskView(type = 'board') {
            if (!this.currentProjectId) {
                this.panel.showEmpty('📋', '请选择项目', '在左侧选择一个项目开始管理任务');
                return;
            }

            if (type === 'board') {
                await this.taskBoard.init(this.currentProjectId, this.currentUserId);
            } else {
                await this.taskList.init(this.currentProjectId, this.currentUserId);
            }
        }

        /**
         * 显示学习计划视图
         */
        async showPlansView() {
            if (!this.currentProjectId) {
                this.panel.showEmpty('📚', '请选择项目', '在左侧选择一个项目开始管理学习计划');
                return;
            }
            await this.planView.init(this.currentProjectId, this.currentUserId);
        }

        /**
         * 显示收件箱视图
         */
        async showInboxView() {
            await this.inboxView.init(this.currentUserId);
        }

        /**
         * 显示活动流视图
         */
        showActivityView() {
            this.panel.showEmpty('📊', '活动流', '活动流功能开发中...');
        }

        /**
         * 尝试添加协作按钮
         */
        tryAddCollabButton() {
            if (this.addCollabButton()) return;

            this.collabButtonObserver = new MutationObserver(() => {
                this.checkAndAddCollabButton();
            });

            const mainEl = document.querySelector('main');
            if (mainEl) {
                this.collabButtonObserver.observe(mainEl, {
                    childList: true,
                    subtree: true
                });
            }

            this.collabButtonPollInterval = setInterval(() => {
                this.checkAndAddCollabButton();
            }, 1000);
        }

        /**
         * 检查并添加协作按钮
         */
        checkAndAddCollabButton() {
            const container = document.querySelector('.chat-session-inputarea-othertypes');
            if (!container) return;

            if (!document.querySelector('.chat-session-inputarea-othertypes-collab')) {
                this.addCollabButton();
            }
        }

        /**
         * 添加协作按钮
         */
        addCollabButton() {
            const container = document.querySelector('.chat-session-inputarea-othertypes');
            if (!container) return false;

            if (document.querySelector('.chat-session-inputarea-othertypes-collab')) {
                return true;
            }

            this.collabBtn = document.createElement('button');
            this.collabBtn.className = 'chat-session-inputarea-othertypes-collab';
            this.collabBtn.innerHTML = '<i class="bi bi-people"></i> 协作';
            this.collabBtn.title = '团队协作';
            this.collabBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.togglePanel();
            });

            const voteBtn = container.querySelector('.chat-session-inputarea-othertypes-vote');
            if (voteBtn) {
                voteBtn.after(this.collabBtn);
            } else {
                const sendBtn = container.querySelector('.chat-session-inputarea-sendbtn');
                if (sendBtn) {
                    container.insertBefore(this.collabBtn, sendBtn);
                } else {
                    container.appendChild(this.collabBtn);
                }
            }

            console.log('[团队协作] 按钮添加成功');
            return true;
        }

        /**
         * 移除协作按钮
         */
        removeCollabButton() {
            if (this.collabBtn) {
                this.collabBtn.remove();
                this.collabBtn = null;
            }

            if (this.collabButtonObserver) {
                this.collabButtonObserver.disconnect();
                this.collabButtonObserver = null;
            }

            if (this.collabButtonPollInterval) {
                clearInterval(this.collabButtonPollInterval);
                this.collabButtonPollInterval = null;
            }
        }

        /**
         * 切换面板
         */
        async togglePanel() {
            if (!this.panel) return;

            if (this.panel.isOpen) {
                this.panel.close();
            } else {
                this.panel.open();
                await this.sidebar.init(this.currentUserId);

                const projects = await this.projectService.getUserProjects(this.currentUserId);
                if (projects.length > 0) {
                    this.currentProjectId = projects[0].id;
                    await this.showTaskView('board');
                }
            }
        }
    }

    // 注册插件
    registerPlugin('team-collab', TeamCollabPlugin);

    console.log('[团队协作] 插件类已注册');
})();

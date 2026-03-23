/**
 * 定时消息插件
 * 支持定时发送消息，可设置一次性发送或周期重复（每日/每周/每月）
 */
class ScheduledMessagePlugin {
    constructor(api) {
        this.api = api;
        this.name = '定时消息';
        this.version = '1.0.0';
        
        // 插件状态
        this.isActivated = false;
        this.checkInterval = null;
        this.scheduledMessages = [];
        
        // 按钮引用
        this.scheduleBtn = null;
        
        // 重复类型
        this.REPEAT_TYPES = {
            none: 'none',       // 一次性
            daily: 'daily',     // 每日
            weekly: 'weekly',   // 每周
            monthly: 'monthly'  // 每月
        };
        
        // 消息状态
        this.STATUS = {
            pending: 0,    // 待发送
            sent: 1,       // 已发送
            cancelled: 2   // 已取消
        };
        
        // 默认配置
        this.defaultConfig = {
            autoCleanup: false,          // 是否启用自动清理
            cleanupIntervalDays: 7,      // 清理间隔（天），清理多少天前的已发送消息
            cleanupCheckHours: 24        // 检查间隔（小时）
        };
        
        // 当前配置
        this.config = { ...this.defaultConfig };
        
        // 清理定时器
        this.cleanupInterval = null;
    }

    /**
     * 插件激活
     */
    async onActivate() {
        console.log('🚀 定时消息插件已激活');

        // 标记为已激活
        this.isActivated = true;

        // 启动定时检查（每分钟检查一次）
        this.startPeriodicCheck();

        // 启动自动清理检查
        this.startCleanupCheck();

        // 初始检查一次
        this.checkAndSendMessages();

        // 延迟执行耗时操作，避免阻塞插件注册
        // 使用 setTimeout 将这些操作放到下一个事件循环
        setTimeout(async () => {
            try {
                // 加载配置
                await this.loadConfig();

                // 加载定时消息列表
                await this.loadScheduledMessages();

                // 添加定时消息按钮到聊天输入区（延迟检测）
                this.tryAddScheduleButton();
            } catch (error) {
                console.error('定时消息插件初始化失败:', error);
            }
        }, 0);
    }
    
    /**
     * 尝试添加按钮（支持延迟加载）
     * 使用多重检测机制确保按钮能正确添加
     */
    tryAddScheduleButton() {
        // 立即尝试添加
        if (this.addScheduleButton()) {
            return;
        }
        
        console.log('定时消息插件: 等待聊天界面加载...');
        
        // 方法1: MutationObserver 监听 DOM 变化
        this.buttonObserver = new MutationObserver((mutations) => {
            this.checkAndAddButton();
        });
        
        // 监听 main 元素和 body 的变化
        const mainEl = document.querySelector('main');
        if (mainEl) {
            this.buttonObserver.observe(mainEl, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'style', 'hidden']
            });
        }
        
        // 也监听 body，以防面板切换是通过 body 级别的变化
        this.buttonObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
        
        // 方法2: 定时轮询检查（更可靠）
        // 检查是否在聊天页面（通过面板ID或URL判断）
        this.buttonPollInterval = setInterval(() => {
            this.checkAndAddButton();
        }, 1000); // 每秒检查一次
    }
    
    /**
     * 检查并添加按钮
     */
    checkAndAddButton() {
        const container = document.querySelector('.chat-session-inputarea-othertypes');
        if (container) {
            // 检查容器是否可见（未被隐藏）
            const isHidden = container.closest('.hidden') || 
                           container.closest('[style*="display: none"]') ||
                           getComputedStyle(container).display === 'none';
            
            if (!isHidden && !document.querySelector('.chat-session-inputarea-othertypes-schedule')) {
                if (this.addScheduleButton()) {
                    console.log('✓ 定时消息按钮已成功添加');
                    // 成功后停止轮询，但保留 Observer 以应对面板切换
                    if (this.buttonPollInterval) {
                        clearInterval(this.buttonPollInterval);
                        this.buttonPollInterval = null;
                    }
                }
            }
        }
    }

    /**
     * 插件停用
     */
    async onDeactivate() {
        console.log('👋 定时消息插件已停用');
        
        // 停止定时检查
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        
        // 停止自动清理检查
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        
        // 停止按钮轮询
        if (this.buttonPollInterval) {
            clearInterval(this.buttonPollInterval);
            this.buttonPollInterval = null;
        }
        
        // 停止按钮监听器
        if (this.buttonObserver) {
            this.buttonObserver.disconnect();
            this.buttonObserver = null;
        }
        
        // 移除按钮
        this.removeScheduleButton();
        
        // 移除弹窗
        this.closeAllModals();
        
        this.isActivated = false;
    }

    /**
     * 加载定时消息列表
     */
    async loadScheduledMessages() {
        try {
            const data = await this.api.storage.get('scheduled_messages');
            if (Array.isArray(data)) {
                this.scheduledMessages = data;
            } else {
                this.scheduledMessages = [];
            }
        } catch (error) {
            console.error('加载定时消息失败:', error);
            this.scheduledMessages = [];
        }
    }

    /**
     * 保存定时消息列表
     */
    async saveScheduledMessages() {
        try {
            await this.api.storage.set('scheduled_messages', this.scheduledMessages);
        } catch (error) {
            console.error('保存定时消息失败:', error);
        }
    }

    /**
     * 加载配置
     */
    async loadConfig() {
        try {
            const data = await this.api.storage.get('scheduled_message_config');
            if (data && typeof data === 'object') {
                this.config = { ...this.defaultConfig, ...data };
            }
        } catch (error) {
            console.error('加载配置失败:', error);
        }
    }

    /**
     * 保存配置
     */
    async saveConfig() {
        try {
            await this.api.storage.set('scheduled_message_config', this.config);
        } catch (error) {
            console.error('保存配置失败:', error);
        }
    }

    /**
     * 添加定时消息按钮
     * @returns {boolean} 是否添加成功
     */
    addScheduleButton() {
        // 查找输入区域的其他类型按钮容器
        const container = document.querySelector('.chat-session-inputarea-othertypes');
        if (!container) {
            return false;
        }
        
        // 检查是否已存在
        if (document.querySelector('.chat-session-inputarea-othertypes-schedule')) {
            return true;
        }
        
        // 创建按钮（在投票按钮之后插入）
        const voteBtn = container.querySelector('.chat-session-inputarea-othertypes-vote');
        
        this.scheduleBtn = document.createElement('button');
        this.scheduleBtn.className = 'chat-session-inputarea-othertypes-schedule';
        this.scheduleBtn.innerHTML = '<i class="bi bi-clock-history"></i> 定时';
        this.scheduleBtn.title = '设置定时消息';
        
        this.scheduleBtn.addEventListener('click', () => this.showScheduleModal());
        
        if (voteBtn) {
            // 在投票按钮后面插入
            voteBtn.after(this.scheduleBtn);
        } else {
            // 如果没有投票按钮，则添加到发送按钮前面
            const sendBtn = container.querySelector('.chat-session-inputarea-sendbtn');
            if (sendBtn) {
                container.insertBefore(this.scheduleBtn, sendBtn);
            } else {
                container.appendChild(this.scheduleBtn);
            }
        }
        
        console.log('✓ 定时消息按钮已添加');
        return true;
    }

    /**
     * 移除定时消息按钮
     */
    removeScheduleButton() {
        if (this.scheduleBtn) {
            this.scheduleBtn.remove();
            this.scheduleBtn = null;
        }
    }

    /**
     * 获取当前聊天联系人信息
     * contact_type: 1=私聊(user), 2=群聊(group)
     */
    getCurrentContactInfo() {
        // 方法1：从活跃的联系人元素获取
        const activeContact = document.querySelector('.chat-contact.active');
        if (activeContact && activeContact.bindmap && activeContact.bindmap.contact_attr) {
            const contactAttr = activeContact.bindmap.contact_attr;
            // type 是数字: 1=user, 2=group
            const isGroup = contactAttr.type === 2;
            return {
                contactType: isGroup ? 'group' : 'user',
                xxid: isGroup ? contactAttr.gid : contactAttr.uid,
                ceid: activeContact.bindmap.ceid,
                name: activeContact.bindmap.text || (isGroup ? contactAttr.gid : contactAttr.uid)
            };
        }
        
        // 方法2：从全局 checkin 对象获取
        if (typeof window.checkin !== 'undefined' && window.checkin.current_contact_xxid) {
            try {
                const info = window.checkin.current_contact_xxid();
                if (info && info.xxid) {
                    // info.contact_type 是数字: 1=user, 2=group
                    const isGroup = info.contact_type === 2;
                    // 获取联系人名称
                    const activeContact2 = document.querySelector('.chat-contact.active');
                    const name = activeContact2 && activeContact2.bindmap && activeContact2.bindmap.text 
                        ? activeContact2.bindmap.text 
                        : info.xxid;
                    return {
                        contactType: isGroup ? 'group' : 'user',
                        xxid: info.xxid,
                        ceid: info.ceid,
                        name: name
                    };
                }
            } catch (e) {
                console.warn('获取联系人信息失败:', e);
            }
        }
        
        // 方法3：从聊天面板的 contentpage 获取
        const chatPanel = document.querySelector('.chat-session-panel');
        if (chatPanel && chatPanel.__contentpage) {
            const contentpage = chatPanel.__contentpage;
            if (contentpage.li && contentpage.li.bindmap && contentpage.li.bindmap.contact_attr) {
                const contactAttr = contentpage.li.bindmap.contact_attr;
                // type 是数字: 1=user, 2=group
                const isGroup = contactAttr.type === 2;
                return {
                    contactType: isGroup ? 'group' : 'user',
                    xxid: isGroup ? contactAttr.gid : contactAttr.uid,
                    ceid: contentpage.li.bindmap.ceid,
                    name: contentpage.li.bindmap.text || (isGroup ? contactAttr.gid : contactAttr.uid)
                };
            }
        }
        
        return null;
    }

    /**
     * 显示定时消息弹窗
     */
    showScheduleModal(editMessage = null) {
        const contactInfo = this.getCurrentContactInfo();
        if (!contactInfo) {
            this.api.ui.showToast('请先选择一个聊天会话', 'warning');
            return;
        }
        
        // 获取当前输入的消息内容
        const textarea = document.querySelector('.chat-session-inputarea-textarea');
        const currentText = textarea ? textarea.value.trim() : '';
        
        // 如果是编辑模式，使用编辑的消息内容
        const initialText = editMessage ? editMessage.message : currentText;
        
                // 生成时间选择器的默认值（当前时间）
        
                const defaultTime = editMessage 
        
                    ? new Date(editMessage.scheduledTime)
        
                    : new Date();
        
                const defaultTimeStr = this.formatDateTimeLocal(defaultTime);
        
        // 默认截止日期（3个月后）
        const defaultUntil = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
        const defaultUntilStr = this.formatDateTimeLocal(defaultUntil);
        
        const modalContent = `
            <div class="scheduled-message-modal">
                <div class="sm-form-group">
                    <div class="sm-contact-info">
                        <i class="bi ${contactInfo.contactType === 'group' ? 'bi-people' : 'bi-person'}"></i>
                        <span>${contactInfo.name}</span>
                    </div>
                    <textarea class="sm-textarea" id="sm-message" placeholder="请输入要发送的消息内容...">${initialText}</textarea>
                </div>
                
                <div class="sm-form-group">
                    <label class="sm-label">发送时间</label>
                    <input type="datetime-local" class="sm-input" id="sm-time" value="${defaultTimeStr}" min="${this.formatDateTimeLocal(new Date())}">
                </div>
                
                <div class="sm-form-group">
                    <label class="sm-label">重复设置</label>
                    <select class="sm-select" id="sm-repeat">
                        <option value="none" ${editMessage?.repeat?.type === 'none' || !editMessage ? 'selected' : ''}>不重复</option>
                        <option value="daily" ${editMessage?.repeat?.type === 'daily' ? 'selected' : ''}>每天</option>
                        <option value="weekly" ${editMessage?.repeat?.type === 'weekly' ? 'selected' : ''}>每周</option>
                        <option value="monthly" ${editMessage?.repeat?.type === 'monthly' ? 'selected' : ''}>每月</option>
                    </select>
                </div>
                
                <div class="sm-form-group sm-repeat-until-group" style="display: ${editMessage?.repeat?.type && editMessage.repeat.type !== 'none' ? 'flex' : 'none'}">
                    <label class="sm-label">截止时间</label>
                    <input type="datetime-local" class="sm-input" id="sm-until" value="${editMessage?.repeat?.until ? this.formatDateTimeLocal(new Date(editMessage.repeat.until)) : defaultUntilStr}">
                </div>
                
                <div class="sm-actions">
                    ${editMessage ? `
                        <button class="sm-btn sm-btn-secondary" id="sm-cancel-edit">取消编辑</button>
                        <button class="sm-btn sm-btn-primary" id="sm-save-edit" data-id="${editMessage.id}">保存修改</button>
                    ` : `
                        <button class="sm-btn sm-btn-secondary" id="sm-view-list">查看定时列表</button>
                        <button class="sm-btn sm-btn-primary" id="sm-create">创建定时消息</button>
                    `}
                </div>
            </div>
        `;
        
        const modal = this.api.ui.showModal({
            title: editMessage ? '编辑定时消息' : '创建定时消息',
            content: modalContent,
            width: '450px',
            height: 'auto'
        });
        
        // 绑定事件
        this.bindModalEvents(modal, contactInfo, editMessage);
    }

    /**
     * 绑定弹窗事件
     */
    bindModalEvents(modal, contactInfo, editMessage) {
        // 重复类型变化
        const repeatSelect = modal.querySelector('#sm-repeat');
        const untilGroup = modal.querySelector('.sm-repeat-until-group');
        
        repeatSelect.addEventListener('change', () => {
            untilGroup.style.display = repeatSelect.value !== 'none' ? 'block' : 'none';
        });
        
        if (editMessage) {
            // 保存编辑
            const saveBtn = modal.querySelector('#sm-save-edit');
            saveBtn.addEventListener('click', () => this.saveEditMessage(modal, editMessage.id));
            
            // 取消编辑
            const cancelBtn = modal.querySelector('#sm-cancel-edit');
            cancelBtn.addEventListener('click', () => {
                modal.closest('.plugin-modal-overlay').remove();
                this.showMessagesList();
            });
        } else {
            // 创建定时消息
            const createBtn = modal.querySelector('#sm-create');
            createBtn.addEventListener('click', () => this.createScheduledMessage(modal, contactInfo));
            
            // 查看列表
            const listBtn = modal.querySelector('#sm-view-list');
            listBtn.addEventListener('click', () => {
                modal.closest('.plugin-modal-overlay').remove();
                this.showMessagesList();
            });
        }
    }

    /**
     * 创建定时消息
     */
    async createScheduledMessage(modal, contactInfo) {
        const message = modal.querySelector('#sm-message').value.trim();
        const timeStr = modal.querySelector('#sm-time').value;
        const repeatType = modal.querySelector('#sm-repeat').value;
        const untilStr = modal.querySelector('#sm-until').value;
        
        // 验证
        if (!message) {
            this.api.ui.showToast('请输入消息内容', 'warning');
            return;
        }
        
        if (!timeStr) {
            this.api.ui.showToast('请选择发送时间', 'warning');
            return;
        }
        
        const scheduledTime = new Date(timeStr);
        if (scheduledTime <= new Date()) {
            this.api.ui.showToast('发送时间必须晚于当前时间', 'warning');
            return;
        }
        
        // 构建消息对象
        const scheduledMessage = {
            id: this.generateId(),
            message: message,
            contactType: contactInfo.contactType,
            xxid: contactInfo.xxid,
            ceid: contactInfo.ceid,
            contactName: contactInfo.name,
            scheduledTime: scheduledTime.toISOString(),
            repeat: {
                type: repeatType,
                until: repeatType !== 'none' ? new Date(untilStr).toISOString() : null
            },
            status: this.STATUS.pending,
            createdTime: new Date().toISOString(),
            sentTime: null
        };
        
        // 添加到列表
        this.scheduledMessages.push(scheduledMessage);
        await this.saveScheduledMessages();
        
        this.api.ui.showToast('定时消息创建成功 ✓', 'success');
        
        // 清空输入框
        const textarea = document.querySelector('.chat-session-inputarea-textarea');
        if (textarea) {
            textarea.value = '';
        }
        
        // 清空弹窗中的消息输入框，重置时间选择器
        const msgInput = modal.querySelector('#sm-message');
        const timeInput = modal.querySelector('#sm-time');
        const repeatSelect = modal.querySelector('#sm-repeat');
        const untilGroup = modal.querySelector('.sm-repeat-until-group');
        
        if (msgInput) msgInput.value = '';
        if (timeInput) timeInput.value = this.formatDateTimeLocal(new Date());
        if (repeatSelect) repeatSelect.value = 'none';
        if (untilGroup) untilGroup.style.display = 'none';
    }

    /**
     * 保存编辑的消息
     */
    async saveEditMessage(modal, messageId) {
        const message = modal.querySelector('#sm-message').value.trim();
        const timeStr = modal.querySelector('#sm-time').value;
        const repeatType = modal.querySelector('#sm-repeat').value;
        const untilStr = modal.querySelector('#sm-until').value;
        
        // 验证
        if (!message) {
            this.api.ui.showToast('请输入消息内容', 'warning');
            return;
        }
        
        if (!timeStr) {
            this.api.ui.showToast('请选择发送时间', 'warning');
            return;
        }
        
        // 找到消息并更新
        const msgIndex = this.scheduledMessages.findIndex(m => m.id === messageId);
        if (msgIndex === -1) {
            this.api.ui.showToast('消息不存在', 'error');
            return;
        }
        
        this.scheduledMessages[msgIndex] = {
            ...this.scheduledMessages[msgIndex],
            message: message,
            scheduledTime: new Date(timeStr).toISOString(),
            repeat: {
                type: repeatType,
                until: repeatType !== 'none' ? new Date(untilStr).toISOString() : null
            },
            updatedTime: new Date().toISOString()
        };
        
        await this.saveScheduledMessages();
        
        // 关闭弹窗
        modal.closest('.plugin-modal-overlay').remove();
        
        this.api.ui.showToast('定时消息已更新 ✓', 'success');
    }

    /**
     * 显示定时消息列表
     */
    showMessagesList() {
        const pendingMessages = this.scheduledMessages.filter(m => m.status === this.STATUS.pending);
        const sentMessages = this.scheduledMessages.filter(m => m.status === this.STATUS.sent);
        
        let listHtml = '';
        
        if (pendingMessages.length === 0 && sentMessages.length === 0) {
            listHtml = '<div class="sm-empty"><i class="bi bi-clock-history"></i><p>暂无定时消息</p></div>';
        } else {
            // 待发送列表
            if (pendingMessages.length > 0) {
                listHtml += '<div class="sm-section"><h4 class="sm-section-title">待发送</h4>';
                listHtml += '<div class="sm-message-list">';
                pendingMessages.forEach(msg => {
                    listHtml += this.renderMessageItem(msg);
                });
                listHtml += '</div></div>';
            }
            
            // 已发送列表（最近10条）
            if (sentMessages.length > 0) {
                listHtml += '<div class="sm-section"><h4 class="sm-section-title">已发送</h4>';
                listHtml += '<div class="sm-message-list">';
                sentMessages.slice(-10).reverse().forEach(msg => {
                    listHtml += this.renderMessageItem(msg, true);
                });
                listHtml += '</div></div>';
            }
        }
        
        const modalContent = `
            <div class="scheduled-message-list-modal">
                <div class="sm-list-content">
                    ${listHtml}
                </div>
                <div class="sm-list-actions">
                    <div class="sm-list-actions-left">
                        <button class="sm-btn sm-btn-secondary" id="sm-back">
                            <i class="bi bi-arrow-left"></i> 返回
                        </button>
                        <button class="sm-btn sm-btn-secondary" id="sm-settings">
                            <i class="bi bi-gear"></i> 配置
                        </button>
                    </div>
                    <button class="sm-btn sm-btn-primary" id="sm-create-new">
                        <i class="bi bi-plus-circle"></i> 创建新消息
                    </button>
                </div>
            </div>
        `;
        
        const modal = this.api.ui.showModal({
            title: '定时消息列表',
            content: modalContent,
            width: '550px',
            height: '500px'
        });
        
        // 绑定事件
        this.bindListEvents(modal);
    }

    /**
     * 渲染消息项
     */
    renderMessageItem(msg, isSent = false) {
        const repeatText = this.getRepeatText(msg.repeat);
        const timeStr = this.formatDisplayTime(new Date(msg.scheduledTime));
        
        return `
            <div class="sm-message-item ${isSent ? 'sm-sent' : ''}" data-id="${msg.id}">
                <div class="sm-message-header">
                    <span class="sm-message-contact">
                        <i class="bi ${msg.contactType === 'group' ? 'bi-people' : 'bi-person'}"></i>
                        ${msg.contactName}
                    </span>
                    <span class="sm-message-time">
                        <i class="bi bi-clock"></i>
                        ${timeStr}
                        ${repeatText ? `<span class="sm-repeat-badge">${repeatText}</span>` : ''}
                    </span>
                </div>
                <div class="sm-message-content">${this.escapeHtml(msg.message)}</div>
                <div class="sm-message-actions">
                    ${!isSent ? `
                        <button class="sm-action-btn sm-edit" title="编辑"><i class="bi bi-pencil"></i></button>
                        <button class="sm-action-btn sm-cancel" title="取消"><i class="bi bi-x-circle"></i></button>
                    ` : `
                        <span class="sm-sent-badge">已发送</span>
                        <button class="sm-action-btn sm-delete" title="删除"><i class="bi bi-trash"></i></button>
                    `}
                </div>
            </div>
        `;
    }

    /**
     * 绑定列表事件
     */
    bindListEvents(modal) {
        // 返回按钮
        const backBtn = modal.querySelector('#sm-back');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                modal.closest('.plugin-modal-overlay').remove();
                this.showScheduleModal();
            });
        }
        
        // 创建新消息
        const createBtn = modal.querySelector('#sm-create-new');
        createBtn.addEventListener('click', () => {
            modal.closest('.plugin-modal-overlay').remove();
            this.showScheduleModal();
        });
        
        // 编辑按钮
        modal.querySelectorAll('.sm-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const item = e.target.closest('.sm-message-item');
                const messageId = item.dataset.id;
                const msg = this.scheduledMessages.find(m => m.id === messageId);
                if (msg) {
                    modal.closest('.plugin-modal-overlay').remove();
                    this.showScheduleModal(msg);
                }
            });
        });
        
        // 取消按钮
        modal.querySelectorAll('.sm-cancel').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const item = e.target.closest('.sm-message-item');
                const messageId = item.dataset.id;
                
                // 使用自定义确认弹窗
                this.showCancelConfirm(messageId, modal);
            });
        });
        
        // 删除按钮（已发送消息）
        modal.querySelectorAll('.sm-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const item = e.target.closest('.sm-message-item');
                const messageId = item.dataset.id;
                
                // 使用自定义确认弹窗
                this.showDeleteConfirm(messageId, modal);
            });
        });
        
        // 配置按钮
        const settingsBtn = modal.querySelector('#sm-settings');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                modal.closest('.plugin-modal-overlay').remove();
                this.showSettingsModal();
            });
        }
    }

    /**
     * 显示取消确认弹窗
     */
    showCancelConfirm(messageId, parentModal) {
        const confirmContent = `
            <div class="sm-confirm-dialog">
                <div class="sm-confirm-icon">
                    <i class="bi bi-exclamation-triangle"></i>
                </div>
                <div class="sm-confirm-text">确定要取消这条定时消息吗？</div>
                <div class="sm-confirm-actions">
                    <button class="sm-btn sm-btn-secondary" id="sm-confirm-no">取消</button>
                    <button class="sm-btn sm-btn-danger" id="sm-confirm-yes">确定</button>
                </div>
            </div>
        `;
        
        const confirmModal = this.api.ui.showModal({
            title: '确认取消',
            content: confirmContent,
            width: '320px',
            height: 'auto'
        });
        
        // 绑定事件
        confirmModal.querySelector('#sm-confirm-no').addEventListener('click', () => {
            confirmModal.closest('.plugin-modal-overlay').remove();
        });
        
        confirmModal.querySelector('#sm-confirm-yes').addEventListener('click', async () => {
            confirmModal.closest('.plugin-modal-overlay').remove();
            await this.cancelMessage(messageId);
            parentModal.closest('.plugin-modal-overlay').remove();
            this.showMessagesList();
        });
    }

    /**
     * 取消定时消息
     */
    async cancelMessage(messageId) {
        const msgIndex = this.scheduledMessages.findIndex(m => m.id === messageId);
        if (msgIndex !== -1) {
            this.scheduledMessages[msgIndex].status = this.STATUS.cancelled;
            await this.saveScheduledMessages();
            this.api.ui.showToast('定时消息已取消', 'success');
        }
    }

    /**
     * 显示删除确认弹窗
     */
    showDeleteConfirm(messageId, parentModal) {
        const confirmContent = `
            <div class="sm-confirm-dialog">
                <div class="sm-confirm-icon">
                    <i class="bi bi-trash"></i>
                </div>
                <div class="sm-confirm-text">确定要删除这条已发送的消息记录吗？</div>
                <div class="sm-confirm-actions">
                    <button class="sm-btn sm-btn-secondary" id="sm-confirm-no">取消</button>
                    <button class="sm-btn sm-btn-danger" id="sm-confirm-yes">删除</button>
                </div>
            </div>
        `;
        
        const confirmModal = this.api.ui.showModal({
            title: '确认删除',
            content: confirmContent,
            width: '320px',
            height: 'auto'
        });
        
        // 绑定事件
        confirmModal.querySelector('#sm-confirm-no').addEventListener('click', () => {
            confirmModal.closest('.plugin-modal-overlay').remove();
        });
        
        confirmModal.querySelector('#sm-confirm-yes').addEventListener('click', async () => {
            confirmModal.closest('.plugin-modal-overlay').remove();
            await this.deleteMessage(messageId);
            parentModal.closest('.plugin-modal-overlay').remove();
            this.showMessagesList();
        });
    }

    /**
     * 删除消息记录
     */
    async deleteMessage(messageId) {
        const msgIndex = this.scheduledMessages.findIndex(m => m.id === messageId);
        if (msgIndex !== -1) {
            this.scheduledMessages.splice(msgIndex, 1);
            await this.saveScheduledMessages();
            this.api.ui.showToast('消息记录已删除', 'success');
        }
    }

    /**
     * 显示配置设置弹窗
     */
    showSettingsModal() {
        const modalContent = `
            <div class="scheduled-message-settings">
                <div class="sm-settings-group">
                    <div class="sm-settings-header">
                        <i class="bi bi-trash"></i>
                        <span>自动清理</span>
                    </div>
                    <p class="sm-settings-desc">启用后，系统将自动清理超过指定天数的已发送消息记录，帮助释放存储空间。</p>
                    
                    <div class="sm-settings-item">
                        <label class="sm-settings-label">
                            <input type="checkbox" id="sm-auto-cleanup" ${this.config.autoCleanup ? 'checked' : ''}>
                            <span>启用自动清理</span>
                        </label>
                    </div>
                    
                    <div class="sm-settings-row ${this.config.autoCleanup ? '' : 'sm-disabled'}" id="sm-cleanup-options">
                        <div class="sm-settings-item">
                            <label class="sm-settings-label">保留天数</label>
                            <div class="sm-settings-input-group">
                                <input type="number" class="sm-input sm-input-number" id="sm-cleanup-days" 
                                    value="${this.config.cleanupIntervalDays}" min="1" max="365">
                                <span class="sm-input-suffix">天</span>
                            </div>
                            <span class="sm-settings-hint">超过此天数的已发送消息将被自动清理</span>
                        </div>
                        
                        <div class="sm-settings-item">
                            <label class="sm-settings-label">检查间隔</label>
                            <div class="sm-settings-input-group">
                                <input type="number" class="sm-input sm-input-number" id="sm-cleanup-hours" 
                                    value="${this.config.cleanupCheckHours}" min="1" max="168">
                                <span class="sm-input-suffix">小时</span>
                            </div>
                            <span class="sm-settings-hint">每隔多久检查一次是否需要清理</span>
                        </div>
                    </div>
                </div>
                
                <div class="sm-settings-actions">
                    <button class="sm-btn sm-btn-secondary" id="sm-settings-back">
                        <i class="bi bi-arrow-left"></i> 返回列表
                    </button>
                    <button class="sm-btn sm-btn-primary" id="sm-settings-save">
                        <i class="bi bi-check-lg"></i> 保存设置
                    </button>
                </div>
            </div>
        `;
        
        const modal = this.api.ui.showModal({
            title: '配置设置',
            content: modalContent,
            width: '450px',
            height: 'auto'
        });
        
        // 绑定事件
        this.bindSettingsEvents(modal);
    }

    /**
     * 绑定配置设置事件
     */
    bindSettingsEvents(modal) {
        const autoCleanupCheckbox = modal.querySelector('#sm-auto-cleanup');
        const cleanupOptions = modal.querySelector('#sm-cleanup-options');
        
        // 切换自动清理选项的显示状态
        autoCleanupCheckbox.addEventListener('change', () => {
            if (autoCleanupCheckbox.checked) {
                cleanupOptions.classList.remove('sm-disabled');
            } else {
                cleanupOptions.classList.add('sm-disabled');
            }
        });
        
        // 返回按钮
        const backBtn = modal.querySelector('#sm-settings-back');
        backBtn.addEventListener('click', () => {
            modal.closest('.plugin-modal-overlay').remove();
            this.showMessagesList();
        });
        
        // 保存按钮
        const saveBtn = modal.querySelector('#sm-settings-save');
        saveBtn.addEventListener('click', async () => {
            await this.saveSettings(modal);
        });
    }

    /**
     * 保存配置设置
     */
    async saveSettings(modal) {
        const autoCleanup = modal.querySelector('#sm-auto-cleanup').checked;
        const cleanupDays = parseInt(modal.querySelector('#sm-cleanup-days').value, 10);
        const cleanupHours = parseInt(modal.querySelector('#sm-cleanup-hours').value, 10);
        
        // 验证
        if (autoCleanup) {
            if (isNaN(cleanupDays) || cleanupDays < 1 || cleanupDays > 365) {
                this.api.ui.showToast('保留天数必须在 1-365 之间', 'warning');
                return;
            }
            if (isNaN(cleanupHours) || cleanupHours < 1 || cleanupHours > 168) {
                this.api.ui.showToast('检查间隔必须在 1-168 小时之间', 'warning');
                return;
            }
        }
        
        // 更新配置
        const oldAutoCleanup = this.config.autoCleanup;
        this.config.autoCleanup = autoCleanup;
        this.config.cleanupIntervalDays = cleanupDays;
        this.config.cleanupCheckHours = cleanupHours;
        
        await this.saveConfig();
        
        // 如果刚启用自动清理，启动清理检查
        if (autoCleanup && !oldAutoCleanup) {
            this.startCleanupCheck();
        }
        
        // 如果禁用了自动清理，停止清理定时器
        if (!autoCleanup && oldAutoCleanup) {
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
                this.cleanupInterval = null;
            }
        }
        
        this.api.ui.showToast('设置已保存 ✓', 'success');
        modal.closest('.plugin-modal-overlay').remove();
        this.showMessagesList();
    }

    /**
     * 启动定时检查
     */
    startPeriodicCheck() {
        // 每分钟检查一次
        this.checkInterval = setInterval(() => {
            this.checkAndSendMessages();
        }, 60 * 1000);
    }

    /**
     * 启动自动清理检查
     */
    startCleanupCheck() {
        if (!this.config.autoCleanup) {
            return;
        }
        
        // 立即执行一次清理
        this.cleanupOldMessages();
        
        // 按配置的间隔检查（默认每24小时）
        const intervalMs = this.config.cleanupCheckHours * 60 * 60 * 1000;
        this.cleanupInterval = setInterval(() => {
            this.cleanupOldMessages();
        }, intervalMs);
        
        console.log(`✓ 自动清理已启用，每 ${this.config.cleanupCheckHours} 小时检查，清理 ${this.config.cleanupIntervalDays} 天前的已发送消息`);
    }

    /**
     * 清理旧的已发送消息
     */
    async cleanupOldMessages() {
        if (!this.config.autoCleanup) {
            return;
        }
        
        const cutoffTime = new Date(Date.now() - this.config.cleanupIntervalDays * 24 * 60 * 60 * 1000);
        const initialCount = this.scheduledMessages.length;
        
        // 过滤掉超过保留期的已发送消息
        this.scheduledMessages = this.scheduledMessages.filter(msg => {
            // 保留待发送的消息
            if (msg.status === this.STATUS.pending) {
                return true;
            }
            // 保留最近发送的消息
            if (msg.status === this.STATUS.sent && msg.sentTime) {
                return new Date(msg.sentTime) > cutoffTime;
            }
            // 删除已取消的消息
            return false;
        });
        
        const removedCount = initialCount - this.scheduledMessages.length;
        if (removedCount > 0) {
            await this.saveScheduledMessages();
            console.log(`✓ 已清理 ${removedCount} 条过期消息记录`);
        }
    }

    /**
     * 检查并发送到期消息
     */
    async checkAndSendMessages() {
        const now = new Date();
        
        const pendingMessages = this.scheduledMessages.filter(m => 
            m.status === this.STATUS.pending && 
            new Date(m.scheduledTime) <= now
        );
        
        for (const msg of pendingMessages) {
            try {
                await this.sendMessage(msg);
                
                // 更新状态
                if (msg.repeat.type !== 'none') {
                    // 周期消息：计算下次发送时间
                    const nextTime = this.calculateNextSendTime(msg);
                    
                    if (nextTime && (!msg.repeat.until || nextTime <= new Date(msg.repeat.until))) {
                        msg.scheduledTime = nextTime.toISOString();
                    } else {
                        msg.status = this.STATUS.sent;
                    }
                } else {
                    // 一次性消息：标记为已发送
                    msg.status = this.STATUS.sent;
                }
                
                msg.sentTime = now.toISOString();
                
            } catch (error) {
                console.error('发送定时消息失败:', error);
            }
        }
        
        if (pendingMessages.length > 0) {
            await this.saveScheduledMessages();
        }
    }

    /**
     * 发送消息
     */
    async sendMessage(msg) {
        try {
            // contact_type: 1=私聊(user), 2=群聊(group)
            const contactType = msg.contactType === 'group' ? 2 : 1;
            
            // 使用系统默认密钥加密消息
            const dataText = await this.encryptWithDefaultKey(msg.message);
            
            // 构建请求体
            const body = {
                contact_type: contactType,
                sender_rand: this.generateRandomString(10),
                type: 1, // 文本消息
                data_text: dataText
            };
            
            if (msg.contactType === 'group') {
                body.gid = msg.xxid;
            } else {
                body.uid = msg.xxid;
            }
            body.ceid = msg.ceid;
            
            // 发送请求
            const response = await fetch('/chat/api/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(body)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`发送失败: ${response.status} - ${errorText}`);
            }
            
            console.log(`✓ 定时消息已发送给 ${msg.contactName}`);
            
        } catch (error) {
            console.error('发送定时消息失败:', error);
            throw error;
        }
    }

    /**
     * 使用系统默认密钥加密消息
     * default_key 是系统中预定义的默认加密密钥，用于不需要用户密钥的场景
     */
    async encryptWithDefaultKey(text) {
        // 使用与系统相同的加密算法
        const defaultKey = "C******"; // 系统默认密钥
        
        // 派生密钥
        const passwordSalt = new Uint8Array([123, 148, 39, 173, 6, 29, 41, 39, 216, 104, 177, 152, 227, 38, 73, 104]);
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(defaultKey),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );
        
        const key = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: passwordSalt,
                iterations: 1_000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 128 },
            false,
            ['encrypt']
        );
        
        // 加密
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encryptedBytes = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            new TextEncoder().encode(text)
        );
        
        // 合并 IV 和密文
        const combined = new Uint8Array(iv.length + encryptedBytes.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encryptedBytes), iv.length);
        
        // 转换为 Base64
        let binary = '';
        for (let i = 0; i < combined.length; i++) {
            binary += String.fromCharCode(combined[i]);
        }
        return btoa(binary);
    }

    /**
     * 计算下次发送时间
     */
    calculateNextSendTime(msg) {
        const current = new Date(msg.scheduledTime);
        let next;
        
        switch (msg.repeat.type) {
            case 'daily':
                next = new Date(current.getTime() + 24 * 60 * 60 * 1000);
                break;
            case 'weekly':
                next = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
                break;
            case 'monthly':
                next = new Date(current);
                next.setMonth(next.getMonth() + 1);
                break;
            default:
                return null;
        }
        
        return next;
    }

    /**
     * 获取重复类型文本
     */
    getRepeatText(repeat) {
        if (!repeat || repeat.type === 'none') return '';
        
        const typeMap = {
            daily: '每日',
            weekly: '每周',
            monthly: '每月'
        };
        
        return typeMap[repeat.type] || '';
    }

    /**
     * 关闭所有弹窗
     */
    closeAllModals() {
        document.querySelectorAll('.plugin-modal-overlay').forEach(el => el.remove());
    }

    /**
     * 格式化日期时间为 datetime-local 格式
     */
    formatDateTimeLocal(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    /**
     * 格式化显示时间
     */
    formatDisplayTime(date) {
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        const isTomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString() === date.toDateString();
        
        const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        
        if (isToday) {
            return `今天 ${timeStr}`;
        } else if (isTomorrow) {
            return `明天 ${timeStr}`;
        } else {
            return `${date.getMonth() + 1}月${date.getDate()}日 ${timeStr}`;
        }
    }

    /**
     * HTML 转义
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 生成唯一 ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * 生成随机字符串
     */
    generateRandomString(length) {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
}

// 注册插件
registerPlugin('scheduled-message', ScheduledMessagePlugin);

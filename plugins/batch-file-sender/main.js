class BatchFileSenderPlugin {
    constructor(api) {
        this.api = api;
        this.pluginId = 'batch-file-sender';
        this.button = null;
        this.buttonObserver = null;
        this.buttonPollInterval = null;

        this.overlay = null;
        this.refs = {};

        this.users = [];
        this.contactSet = new Set();
        this.contactAny = false;
        this.globalPaused = false;

        this.fileSeq = 0;
    }

    async onActivate() {
        this.tryAddButton();
    }

    async onDeactivate() {
        this.pauseAll();
        this.closePanel();
        this.removeButton();

        if (this.buttonObserver) {
            this.buttonObserver.disconnect();
            this.buttonObserver = null;
        }

        if (this.buttonPollInterval) {
            clearInterval(this.buttonPollInterval);
            this.buttonPollInterval = null;
        }
    }

    tryAddButton() {
        if (this.addButton()) {
            return;
        }

        this.buttonObserver = new MutationObserver(() => {
            this.addButton();
        });

        this.buttonObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        });

        this.buttonPollInterval = setInterval(() => {
            if (this.addButton()) {
                clearInterval(this.buttonPollInterval);
                this.buttonPollInterval = null;
            }
        }, 1000);
    }

    addButton() {
        if (document.querySelector('.chat-session-inputarea-othertypes-batch-file-sender')) {
            return true;
        }

        const container = document.querySelector('.chat-session-inputarea-othertypes');
        if (!container) return false;

        const btn = document.createElement('button');
        btn.className = 'chat-session-inputarea-othertypes-batch-file-sender';
        btn.innerHTML = '<i class="bi bi-folder-symlink"></i> 批量发文件';
        btn.title = '按用户文件夹批量发送文件';
        btn.addEventListener('click', () => this.openPanel());

        const aiBtn = container.querySelector('.chat-session-inputarea-othertypes-ai');
        const sendBtn = container.querySelector('.chat-session-inputarea-sendbtn');
        if (aiBtn && aiBtn.parentNode === container) {
            aiBtn.insertAdjacentElement('afterend', btn);
        } else if (sendBtn) {
            container.insertBefore(btn, sendBtn);
        } else {
            container.appendChild(btn);
        }

        this.button = btn;
        return true;
    }

    removeButton() {
        if (this.button) {
            this.button.remove();
            this.button = null;
        }
        const existed = document.querySelector('.chat-session-inputarea-othertypes-batch-file-sender');
        if (existed) existed.remove();
    }

    async openPanel() {
        if (this.overlay) return;

        try {
            await this.loadContacts();
        } catch (error) {
            this.api.ui.showToast(`读取联系人失败：${error.message || error}`, 'error');
            return;
        }

        this.overlay = document.createElement('div');
        this.overlay.className = 'bfs-overlay';
        this.overlay.innerHTML = this.getPanelHtml();
        document.body.appendChild(this.overlay);

        this.refs.panel = this.overlay.querySelector('.bfs-panel');
        this.refs.dropZone = this.overlay.querySelector('.bfs-drop-zone');
        this.refs.folderInput = this.overlay.querySelector('#bfs-folder-input');
        this.refs.rows = this.overlay.querySelector('#bfs-rows');
        this.refs.empty = this.overlay.querySelector('#bfs-empty');
        this.refs.contactMode = this.overlay.querySelector('#bfs-contact-mode');

        this.bindPanelEvents();
        this.render();
    }

    closePanel() {
        if (!this.overlay) return;
        this.overlay.remove();
        this.overlay = null;
        this.refs = {};
    }

    bindPanelEvents() {
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.closePanel();
            }
        });

        this.overlay.querySelector('#bfs-close-btn').addEventListener('click', () => {
            this.closePanel();
        });

        this.overlay.querySelector('#bfs-close-icon').addEventListener('click', () => {
            this.closePanel();
        });

        this.overlay.querySelector('#bfs-import-btn').addEventListener('click', () => {
            this.refs.folderInput.value = '';
            this.refs.folderInput.click();
        });

        this.overlay.querySelector('#bfs-clear-btn').addEventListener('click', () => {
            if (!this.users.length) return;
            const ok = window.confirm('确定清空所有识别结果吗？');
            if (!ok) return;
            this.pauseAll();
            this.users = [];
            this.render();
        });

        this.overlay.querySelector('#bfs-send-all-btn').addEventListener('click', () => {
            this.startAll();
        });

        this.overlay.querySelector('#bfs-pause-all-btn').addEventListener('click', () => {
            this.pauseAll();
        });

        this.overlay.querySelector('#bfs-resume-all-btn').addEventListener('click', () => {
            this.resumeAll();
        });

        this.refs.folderInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files || []);
            await this.ingestFiles(files, false);
        });

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((evt) => {
            this.refs.panel.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        this.refs.panel.addEventListener('dragenter', () => {
            this.refs.panel.classList.add('drag-over');
        });

        this.refs.panel.addEventListener('dragover', () => {
            this.refs.panel.classList.add('drag-over');
        });

        this.refs.panel.addEventListener('dragleave', (e) => {
            if (!this.refs.panel.contains(e.relatedTarget)) {
                this.refs.panel.classList.remove('drag-over');
            }
        });

        this.refs.panel.addEventListener('drop', async (e) => {
            this.refs.panel.classList.remove('drag-over');
            const dropped = await this.extractDroppedFiles(e.dataTransfer);
            await this.ingestFiles(dropped, false);
        });

        this.refs.rows.addEventListener('click', (e) => {
            const removeFile = e.target.closest('[data-action="remove-file"]');
            if (removeFile) {
                const fileId = removeFile.dataset.fileId;
                const user = this.findUserByFileId(fileId);
                if (!user) return;
                const file = user.files.find((f) => f.id === fileId);
                if (!file) return;
                if (file.status === 'uploading') {
                    this.api.ui.showToast('该文件正在上传，请先暂停', 'warning');
                    return;
                }
                const ok = window.confirm(`确定移除文件「${file.name}」吗？`);
                if (!ok) return;
                user.files = user.files.filter((f) => f.id !== fileId);
                if (!user.files.length) {
                    user.state = 'idle';
                }
                this.render();
                return;
            }

            const removeUser = e.target.closest('[data-action="remove-user"]');
            if (removeUser) {
                const username = removeUser.dataset.username;
                const user = this.users.find((item) => item.username === username);
                if (!user) return;
                if (user.state === 'uploading') {
                    this.api.ui.showToast('该联系人正在上传，请先暂停', 'warning');
                    return;
                }
                const ok = window.confirm(`确定移除联系人「${username}」吗？`);
                if (!ok) return;
                this.users = this.users.filter((item) => item.username !== username);
                this.render();
                return;
            }

            const actionBtn = e.target.closest('[data-action="toggle-user"]');
            if (!actionBtn) return;
            const username = actionBtn.dataset.username;
            const user = this.users.find((item) => item.username === username);
            if (!user || !user.canSend) return;

            if (user.state === 'uploading') {
                this.pauseUser(user);
            } else {
                this.resumeUser(user);
            }
        });
    }

    async loadContacts() {
        const base = typeof top_level_path !== 'undefined' ? top_level_path : '';
        const users = await this.api.http.get(`${base}/me/api/contacts?type=users`);
        const anyResult = await this.api.http.get(`${base}/me/api/contacts?type=any`);

        const list = Array.isArray(users)
            ? users
            : (Array.isArray(users?.users) ? users.users : []);
        this.contactSet = new Set(list.map((item) => item.uid));
        this.contactAny = !!(anyResult && anyResult.contact_any);
    }

    applyPermission(user) {
        const valid = !!user.username && this.contactSet.has(user.username);
        user.canSend = valid;
        if (valid) {
            user.reason = '';
            return;
        }
        user.reason = this.contactAny ? '用户不存在或不可联系' : '未添加好友';
    }

    async ingestFiles(inputFiles, replaceAll = false) {
        if (!inputFiles || !inputFiles.length) {
            this.api.ui.showToast('未检测到可识别的文件', 'warning');
            return;
        }

        const grouped = new Map();
        for (const item of inputFiles) {
            const file = item instanceof File ? item : item.file;
            const relPath = item.relativePath || item._relativePath || file.webkitRelativePath || file.relativePath || file.name;
            const parsed = this.parseRelativePath(relPath);
            if (!parsed) continue;

            if (!grouped.has(parsed.username)) {
                grouped.set(parsed.username, []);
            }

            grouped.get(parsed.username).push({
                id: `f-${Date.now()}-${this.fileSeq++}`,
                name: parsed.displayName,
                size: file.size,
                progress: 0,
                status: 'pending',
                file
            });
        }

        if (!grouped.size) {
            this.api.ui.showToast('未识别到“总目录/用户名/文件”结构', 'warning');
            return;
        }

        const users = Array.from(grouped.entries()).map(([username, files]) => {
            const user = {
                username,
                files,
                canSend: false,
                reason: '',
                state: 'idle',
                paused: false,
                started: false,
                processing: false,
                xhr: null,
                pauseRequested: false,
                lastError: ''
            };
            this.applyPermission(user);
            return user;
        }).sort((a, b) => a.username.localeCompare(b.username));

        if (replaceAll) {
            this.pauseAll();
            this.users = users;
            this.globalPaused = false;
            this.render();
            this.api.ui.showToast(`识别完成：${users.length} 个联系人，${inputFiles.length} 个文件`, 'success');
            return;
        }

        const existingByUser = new Map(this.users.map((u) => [u.username, u]));
        let appendedUsers = 0;
        let appendedFiles = 0;
        let skippedFiles = 0;

        for (const incomingUser of users) {
            const existed = existingByUser.get(incomingUser.username);
            if (!existed) {
                this.users.push(incomingUser);
                appendedUsers += 1;
                appendedFiles += incomingUser.files.length;
                continue;
            }

            const existsSignatures = new Set(
                existed.files.map((f) => `${f.name}__${f.size}`)
            );

            for (const file of incomingUser.files) {
                const signature = `${file.name}__${file.size}`;
                if (existsSignatures.has(signature)) {
                    skippedFiles += 1;
                    continue;
                }
                existed.files.push(file);
                existsSignatures.add(signature);
                appendedFiles += 1;
            }
        }

        this.users.sort((a, b) => a.username.localeCompare(b.username));
        this.globalPaused = false;
        this.render();

        this.api.ui.showToast(
            `已累加：新增${appendedUsers}个联系人，新增${appendedFiles}个文件${skippedFiles ? `，跳过${skippedFiles}个重复文件` : ''}`,
            'success'
        );
    }

    parseRelativePath(path) {
        const parts = String(path || '').split('/').filter(Boolean);
        if (parts.length < 2) return null;

        if (parts.length >= 3) {
            const username = (parts[1] || '').trim();
            if (!username) return null;
            return {
                username,
                displayName: parts.slice(2).join('/')
            };
        }

        const username = (parts[0] || '').trim();
        if (!username) return null;
        return {
            username,
            displayName: parts[1]
        };
    }

    async extractDroppedFiles(dataTransfer) {
        if (!dataTransfer) return [];

        const items = Array.from(dataTransfer.items || []);
        const hasEntries = items.some((item) => typeof item.webkitGetAsEntry === 'function');

        if (!hasEntries) {
            return Array.from(dataTransfer.files || []);
        }

        const files = [];
        for (const item of items) {
            const entry = item.webkitGetAsEntry();
            if (!entry) continue;
            const list = await this.walkEntry(entry, '');
            files.push(...list);
        }
        return files;
    }

    async walkEntry(entry, prefix) {
        if (entry.isFile) {
            return [await this.readFileEntry(entry, prefix)];
        }

        if (!entry.isDirectory) return [];

        const current = `${prefix}${entry.name}/`;
        const children = await this.readDirectoryEntries(entry);
        let result = [];
        for (const child of children) {
            const list = await this.walkEntry(child, current);
            result = result.concat(list);
        }
        return result;
    }

    readFileEntry(entry, prefix) {
        return new Promise((resolve, reject) => {
            entry.file((file) => {
                file._relativePath = `${prefix}${file.name}`;
                resolve(file);
            }, reject);
        });
    }

    readDirectoryEntries(entry) {
        const reader = entry.createReader();
        const result = [];

        return new Promise((resolve, reject) => {
            const loop = () => {
                reader.readEntries((entries) => {
                    if (!entries.length) {
                        resolve(result);
                        return;
                    }
                    result.push(...entries);
                    loop();
                }, reject);
            };
            loop();
        });
    }

    startAll() {
        this.globalPaused = false;
        this.users.forEach((user) => {
            if (!user.canSend) return;
            user.paused = false;
            user.pauseRequested = false;
            this.processUser(user);
        });
        this.render();
    }

    pauseAll() {
        this.globalPaused = true;
        this.users.forEach((user) => {
            user.paused = true;
            user.pauseRequested = true;
            if (user.xhr) {
                user.xhr.abort();
            }
            if (user.state === 'uploading') {
                user.state = 'paused';
            }
        });
        this.render();
    }

    resumeAll() {
        this.globalPaused = false;
        this.users.forEach((user) => {
            if (!user.canSend) return;
            user.paused = false;
            user.pauseRequested = false;
            this.processUser(user);
        });
        this.render();
    }

    pauseUser(user) {
        user.paused = true;
        user.pauseRequested = true;
        if (user.xhr) {
            user.xhr.abort();
        }
        if (user.state === 'uploading') {
            user.state = 'paused';
        }
        this.render();
    }

    resumeUser(user) {
        this.globalPaused = false;
        user.paused = false;
        user.pauseRequested = false;
        this.processUser(user);
        this.render();
    }

    async processUser(user) {
        if (user.processing || !user.canSend) return;

        user.processing = true;
        user.started = true;

        try {
            while (true) {
                if (this.globalPaused || user.paused) {
                    user.state = 'paused';
                    break;
                }

                const file = user.files.find((item) => item.status !== 'done');
                if (!file) {
                    user.state = 'done';
                    break;
                }

                file.status = 'uploading';
                user.state = 'uploading';
                this.render();

                try {
                    await this.uploadOne(user, file);
                    file.status = 'done';
                    file.progress = 100;
                    user.lastError = '';
                } catch (error) {
                    if (error && error.__aborted) {
                        file.status = 'pending';
                        if (this.globalPaused || user.paused) {
                            user.state = 'paused';
                            break;
                        }
                    } else {
                        file.status = 'pending';
                        user.lastError = error?.message || '上传失败';
                        user.state = 'paused';
                        user.paused = true;
                        this.api.ui.showToast(`发送失败：${user.username} - ${user.lastError}`, 'error');
                        break;
                    }
                }
                this.render();
            }
        } finally {
            user.processing = false;
            user.xhr = null;
            this.render();
        }
    }

    async uploadOne(user, fileItem) {
        const runtimeCheckin = this.getRuntimeCheckin();
        const chatApi = runtimeCheckin?.subviews?.chat;
        const canUseChatApi = !!(chatApi && chatApi.send_file);

        if (canUseChatApi) {
            await this.uploadViaChatApi(user, fileItem);
            return;
        }

        await this.uploadViaHttp(user, fileItem);
    }

    async uploadViaChatApi(user, fileItem) {
        const runtimeCheckin = this.getRuntimeCheckin();
        const chatApi = runtimeCheckin?.subviews?.chat;
        if (!chatApi || !chatApi.send_file) {
            throw new Error('发送能力不可用：聊天发送接口未就绪');
        }

        const msgType = this.getMsgTypeFile();
        const contactType = this.getReceiverTypeUser();

        const feedbackargs = {
            contact_type: contactType,
            ceid: null,
            xxid: user.username,
            msg: {
                sender_rand: this.rand(10),
                type: msgType,
                file: fileItem.file,
                file_name: fileItem.name
            }
        };

        await new Promise(async (resolve, reject) => {
            const onAbort = () => reject({ __aborted: true });

            const callbacks = {
                onprogress: (evt) => {
                    if (!evt || !evt.total) return;
                    fileItem.progress = Math.min(100, Math.round((evt.loaded / evt.total) * 100));
                    this.renderProgressOnly();
                },
                onload: () => {
                    if (user.xhr && user.xhr.status === 200) {
                        resolve();
                    } else {
                        reject(new Error('上传请求返回失败状态'));
                    }
                },
                onerror: () => reject(new Error('上传网络异常')),
                onabort: onAbort
            };

            try {
                const xhr = await chatApi.send_file(feedbackargs, callbacks);
                user.xhr = xhr;
                if (this.globalPaused || user.paused || user.pauseRequested) {
                    xhr.abort();
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    async uploadViaHttp(user, fileItem) {
        const runtimeEncryptors = this.getRuntimeEncryptors();
        if (!runtimeEncryptors || !runtimeEncryptors.encrypt || !runtimeEncryptors.encrypt2base64) {
            throw new Error('发送能力不可用：加密组件未就绪，请稍后再试');
        }

        const base = typeof top_level_path !== 'undefined' ? top_level_path : '';
        const url = `${base}/chat/api/send_file`;
        const contactType = 1;
        const msgType = 3;

        const buffer = await fileItem.file.arrayBuffer();
        const encrypted = await runtimeEncryptors.encrypt(new Uint8Array(buffer));

        const metadata = {
            contact_type: contactType,
            ceid: null,
            uid: user.username,
            sender_rand: this.rand(10),
            type: msgType,
            file_attr: {
                name: await runtimeEncryptors.encrypt2base64(fileItem.name),
                name_encrypted: true,
                size: fileItem.file.size
            }
        };

        const blob = new Blob([encrypted], { type: 'application/octet-stream' });
        const formData = new FormData();
        formData.append('file', blob, 'filename');
        formData.append('metadata', JSON.stringify(metadata));

        await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            xhr.upload.onprogress = (evt) => {
                if (!evt || !evt.total) return;
                fileItem.progress = Math.min(100, Math.round((evt.loaded / evt.total) * 100));
                this.renderProgressOnly();
            };
            xhr.onload = () => {
                if (xhr.status === 200) {
                    resolve();
                } else {
                    reject(new Error(`上传失败(${xhr.status})`));
                }
            };
            xhr.onerror = () => reject(new Error('上传网络异常'));
            xhr.onabort = () => reject({ __aborted: true });

            user.xhr = xhr;
            xhr.send(formData);

            if (this.globalPaused || user.paused || user.pauseRequested) {
                xhr.abort();
            }
        });
    }

    getRuntimeCheckin() {
        if (typeof checkin !== 'undefined') return checkin;
        if (typeof window !== 'undefined' && window.checkin) return window.checkin;
        return null;
    }

    getRuntimeEncryptors() {
        if (typeof encryptors !== 'undefined') return encryptors;
        if (typeof window !== 'undefined' && window.encryptors) return window.encryptors;
        const runtimeCheckin = this.getRuntimeCheckin();
        if (runtimeCheckin && runtimeCheckin.encryptors) return runtimeCheckin.encryptors;
        return null;
    }

    getMsgTypeFile() {
        if (typeof dashboardwrappers !== 'undefined' && dashboardwrappers.ChatDashboardWrapper?.message_type?.file !== undefined) {
            return dashboardwrappers.ChatDashboardWrapper.message_type.file;
        }
        return 3;
    }

    getReceiverTypeUser() {
        if (typeof subviews !== 'undefined' && subviews.Chat?.receiver_type?.user !== undefined) {
            return subviews.Chat.receiver_type.user;
        }
        return 1;
    }

    findUserByFileId(fileId) {
        return this.users.find((user) => user.files.some((f) => f.id === fileId));
    }

    formatSize(size) {
        const num = Number(size || 0);
        if (num < 1024) return `${num}B`;
        if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)}KB`;
        if (num < 1024 * 1024 * 1024) return `${(num / 1024 / 1024).toFixed(1)}MB`;
        return `${(num / 1024 / 1024 / 1024).toFixed(2)}GB`;
    }

    computeUserProgress(user) {
        if (!user.files.length) return 0;
        const total = user.files.reduce((sum, f) => sum + (f.progress || 0), 0);
        return Math.round(total / user.files.length);
    }

    getActionMeta(user) {
        if (!user.canSend) {
            return { label: '发送', className: 'task-btn send', disabled: true };
        }
        const hasPending = user.files.some((f) => f.status !== 'done');
        if (!hasPending) {
            return { label: '完成', className: 'task-btn done', disabled: true };
        }
        if (user.state === 'uploading') {
            return { label: '暂停', className: 'task-btn pause', disabled: false };
        }
        if (user.state === 'paused' || user.started) {
            if (hasPending) {
                return { label: '继续', className: 'task-btn resume', disabled: false };
            }
        }
        return { label: '发送', className: 'task-btn send', disabled: !hasPending };
    }

    buildRowsHtml() {
        return this.users.map((user) => {
            const progress = this.computeUserProgress(user);
            const action = this.getActionMeta(user);
            const filesHtml = user.files.length
                ? user.files.map((file) => `
                    <div class="bfs-file-item" data-file-id="${file.id}">
                        <div class="bfs-file-top">
                            <span class="bfs-file-name" title="${this.escapeHtml(file.name)}">${this.escapeHtml(file.name)}</span>
                            <span class="bfs-file-right">
                                <span class="bfs-file-percent">${file.progress || 0}%</span>
                                <button class="bfs-remove-file" data-action="remove-file" data-file-id="${file.id}" title="移除文件">x</button>
                            </span>
                        </div>
                        <div class="bfs-file-meta">${this.formatSize(file.size)} · ${this.statusText(file.status)}</div>
                        <div class="bfs-mini-progress"><div class="bfs-mini-fill ${this.fileProgressClass(file)}" style="width:${file.progress || 0}%"></div></div>
                    </div>
                `).join('')
                : '<div class="bfs-empty">该联系人已无待发送文件</div>';

            const tagClass = user.canSend ? 'bfs-tag bfs-tag-ok' : 'bfs-tag bfs-tag-err';
            const tagText = user.canSend ? '可发送' : (user.reason || '不可发送');
            const overallClass = this.userProgressClass(user);

            return `
                <article class="bfs-user-card" data-username="${this.escapeHtml(user.username)}">
                    <button class="bfs-remove-user" data-action="remove-user" data-username="${this.escapeHtml(user.username)}" title="移除联系人">x</button>
                    <div class="bfs-user-row">
                        <div class="bfs-cell">
                            <div class="bfs-cell-label">识别名称</div>
                            <div class="bfs-uid">${this.escapeHtml(user.username)}</div>
                            <div class="bfs-cell-label" style="margin-top:8px;">发送权限</div>
                            <span class="${tagClass}">${this.escapeHtml(tagText)}</span>
                        </div>
                        <div class="bfs-cell">
                            <div class="bfs-cell-label">文件列表与发送进度</div>
                            <div class="bfs-overall">
                                <div class="bfs-overall-row"><span>总进度</span><span>${progress}%</span></div>
                                <div class="bfs-progress"><div class="bfs-progress-fill ${overallClass}" style="width:${progress}%"></div></div>
                            </div>
                            <div class="bfs-file-list">${filesHtml}</div>
                        </div>
                        <div class="bfs-cell bfs-ops">
                            <div class="bfs-cell-label">操作</div>
                            <button class="bfs-btn ${action.className}" data-action="toggle-user" data-username="${this.escapeHtml(user.username)}" ${action.disabled ? 'disabled' : ''}>${action.label}</button>
                            <div class="bfs-cell-label">状态：${this.userStateText(user)}</div>
                            ${user.lastError ? `<div class="bfs-cell-label" style="color:#c03d3d;">错误：${this.escapeHtml(user.lastError)}</div>` : ''}
                        </div>
                    </div>
                </article>
            `;
        }).join('');
    }

    statusText(status) {
        if (status === 'done') return '已完成';
        if (status === 'uploading') return '上传中';
        return '待发送';
    }

    fileProgressClass(file) {
        if (file.status === 'done') return 'is-done';
        if (file.status === 'uploading') return 'is-uploading';
        return 'is-paused';
    }

    userProgressClass(user) {
        const allDone = user.files.length > 0 && user.files.every((f) => f.status === 'done');
        if (allDone) return 'is-done';
        if (user.state === 'uploading') return 'is-uploading';
        return 'is-paused';
    }

    userStateText(user) {
        if (!user.canSend) return '不可发送';
        if (user.state === 'uploading') return '发送中';
        if (user.state === 'paused') return '已暂停';
        if (user.state === 'done') return '已完成';
        return user.started ? '待继续' : '待发送';
    }

    renderProgressOnly() {
        if (!this.refs.rows) return;
        this.users.forEach((user) => {
            const cards = Array.from(this.refs.rows.querySelectorAll('.bfs-user-card'));
            const card = cards.find((item) => item.dataset.username === user.username);
            if (!card) return;
            const overall = card.querySelector('.bfs-overall-row span:last-child');
            const overallFill = card.querySelector('.bfs-progress-fill');
            const progress = this.computeUserProgress(user);
            if (overall) overall.textContent = `${progress}%`;
            if (overallFill) {
                overallFill.style.width = `${progress}%`;
                overallFill.classList.remove('is-uploading', 'is-paused', 'is-done');
                overallFill.classList.add(this.userProgressClass(user));
            }

            user.files.forEach((file) => {
                const fileRow = card.querySelector(`[data-file-id="${file.id}"]`);
                if (!fileRow) return;
                const percent = fileRow.querySelector('.bfs-file-percent');
                const miniFill = fileRow.querySelector('.bfs-mini-fill');
                if (percent) percent.textContent = `${file.progress || 0}%`;
                if (miniFill) {
                    miniFill.style.width = `${file.progress || 0}%`;
                    miniFill.classList.remove('is-uploading', 'is-paused', 'is-done');
                    miniFill.classList.add(this.fileProgressClass(file));
                }
            });
        });
        this.renderSummary();
    }

    renderSummary() {
        if (!this.overlay) return;
        const totalUsers = this.users.length;
        const sendableUsers = this.users.filter((u) => u.canSend).length;
        const blockedUsers = totalUsers - sendableUsers;
        const allFiles = this.users.reduce((sum, u) => sum + u.files.length, 0);
        const doneFiles = this.users.reduce((sum, u) => sum + u.files.filter((f) => f.status === 'done').length, 0);
        const uploadingUsers = this.users.filter((u) => u.state === 'uploading').length;

        this.overlay.querySelector('#bfs-stat-users').textContent = `${totalUsers}`;
        this.overlay.querySelector('#bfs-stat-sendable').textContent = `${sendableUsers}`;
        this.overlay.querySelector('#bfs-stat-blocked').textContent = `${blockedUsers}`;
        this.overlay.querySelector('#bfs-stat-files').textContent = `${allFiles}`;
        this.overlay.querySelector('#bfs-stat-done').textContent = `${doneFiles}`;
        this.overlay.querySelector('#bfs-stat-active').textContent = `${uploadingUsers}`;

        const modeText = this.contactAny
            ? '当前账号具有 contact_any 权限，可向可联系用户列表中的账号发送。'
            : '当前账号仅可向已添加好友发送。';
        this.refs.contactMode.textContent = modeText;
    }

    render() {
        if (!this.overlay) return;

        this.refs.rows.innerHTML = this.buildRowsHtml();
        if (this.refs.empty && !this.users.length) {
            this.refs.empty.style.display = 'block';
        } else if (this.refs.empty) {
            this.refs.empty.style.display = 'none';
        }
        this.renderSummary();
    }

    rand(len) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let out = '';
        for (let i = 0; i < len; i++) {
            out += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return out;
    }

    escapeHtml(text) {
        return String(text || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    getPanelHtml() {
        return `
            <section class="bfs-panel">
                <div class="bfs-panel-drop-mask">释放后开始识别</div>
                <header class="bfs-head">
                    <div class="bfs-head-left">
                        <div>
                            <div class="bfs-title">批量发送文件</div>
                            <div class="bfs-desc">选择总文件夹后自动识别用户名子文件夹，按用户批量发送文件。</div>
                        </div>
                    </div>
                    <div class="bfs-actions">
                        <input id="bfs-folder-input" type="file" webkitdirectory directory hidden>
                        <button class="bfs-btn" id="bfs-import-btn">导入文件夹</button>
                        <button class="bfs-btn bfs-btn-danger" id="bfs-clear-btn">清空</button>
                        <span class="bfs-split"></span>
                        <button class="bfs-btn bfs-btn-pause" id="bfs-pause-all-btn">全部暂停</button>
                        <button class="bfs-btn bfs-btn-resume" id="bfs-resume-all-btn">全部继续</button>
                        <button class="bfs-btn bfs-btn-primary" id="bfs-send-all-btn">全部发送</button>
                    </div>
                    <button class="bfs-close-icon" id="bfs-close-icon" title="关闭窗口">x</button>
                </header>

                <div class="bfs-drop-zone">
                    将总文件夹拖拽到此面板，自动识别其下“用户名子文件夹”。
                </div>

                <div class="bfs-summary">
                    <div class="bfs-stat"><div class="bfs-stat-key">识别联系人</div><div class="bfs-stat-value" id="bfs-stat-users">0</div></div>
                    <div class="bfs-stat"><div class="bfs-stat-key">可发送</div><div class="bfs-stat-value" id="bfs-stat-sendable">0</div></div>
                    <div class="bfs-stat"><div class="bfs-stat-key">不可发送</div><div class="bfs-stat-value" id="bfs-stat-blocked">0</div></div>
                    <div class="bfs-stat"><div class="bfs-stat-key">总文件数</div><div class="bfs-stat-value" id="bfs-stat-files">0</div></div>
                    <div class="bfs-stat"><div class="bfs-stat-key">已完成文件</div><div class="bfs-stat-value" id="bfs-stat-done">0</div></div>
                    <div class="bfs-stat"><div class="bfs-stat-key">发送中联系人</div><div class="bfs-stat-value" id="bfs-stat-active">0</div></div>
                </div>

                <div class="bfs-table-head">
                    <div>识别名称 / 权限</div>
                    <div>文件名称与进度</div>
                    <div>操作按钮</div>
                </div>

                <div class="bfs-rows" id="bfs-rows"></div>
                <div class="bfs-empty" id="bfs-empty" style="display:none; margin: 10px 14px;">暂无待发送联系人，请导入总文件夹后识别。</div>

                <footer class="bfs-foot">
                    <span id="bfs-contact-mode">正在读取联系人权限...</span>
                    <button class="bfs-btn bfs-close" id="bfs-close-btn">关闭</button>
                </footer>
            </section>
        `;
    }
}

registerPlugin('batch-file-sender', BatchFileSenderPlugin);

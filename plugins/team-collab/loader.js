/**
 * 团队协作插件 - 模块加载器
 * 按正确顺序加载所有模块
 */

(function () {
    // 模块加载顺序
    const modules = [
        'core/constants.js',
        'core/errors.js',
        'core/event-bus.js',
        'utils/common.js',
        'utils/markdown.js',
        'storage/crypto-manager.js',
        'storage/storage-adapter.js',
        'storage/index-manager.js',
        'services/permission-service.js',
        'services/project-service.js',
        'services/task-service.js',
        'services/comment-service.js',
        'services/plan-service.js',
        'services/notification-service.js',
        'services/import-export-service.js',
        'ui/panel.js',
        'ui/sidebar.js',
        'ui/task-board.js',
        'ui/task-list.js',
        'ui/task-detail.js',
        'ui/comment-input.js',
        'ui/comment-list.js',
        'ui/plan-view.js',
        'ui/inbox-view.js'
    ];

    // 获取基础路径
    const getBasePath = () => {
        // 从当前脚本标签获取路径
        const scripts = document.querySelectorAll('script[src]');
        for (const script of scripts) {
            if (script.src.includes('team-collab')) {
                return script.src.substring(0, script.src.lastIndexOf('/') + 1);
            }
        }
        // 默认路径
        return './plugins/team-collab/';
    };

    // 动态加载脚本
    const loadScript = (src) => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed to load: ${src}`));
            document.head.appendChild(script);
        });
    };

    // 按顺序加载所有模块
    const loadModules = async () => {
        const basePath = getBasePath();
        console.log('[团队协作] 开始加载模块，基础路径:', basePath);

        for (const module of modules) {
            try {
                await loadScript(basePath + module);
                console.log(`[团队协作] 已加载: ${module}`);
            } catch (error) {
                console.error(`[团队协作] 加载失败: ${module}`, error);
                throw error;
            }
        }

        // 最后加载主入口
        await loadScript(basePath + 'main.js');
        console.log('[团队协作] 所有模块加载完成');
    };

    // 开始加载
    loadModules().catch(error => {
        console.error('[团队协作] 模块加载失败:', error);
    });
})();

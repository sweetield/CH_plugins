/**
 * Hello World 插件 - 管理员专用
 * 在页面顶部显示欢迎横幅
 */
class HelloWorldPlugin {
    constructor(api) {
        this.api = api;
        this.name = 'Hello World';
        this.bannerId = 'hello-world-banner';
    }

    async onActivate() {
        console.log('🛡️ Hello World 管理员插件已激活');

        // 创建欢迎横幅
        this.createBanner();
    }

    async onDeactivate() {
        console.log('👋 Hello World 插件已停用');
        this.removeBanner();
    }

    createBanner() {
        // 检查是否已存在
        if (document.getElementById(this.bannerId)) return;

        const banner = document.createElement('div');
        banner.id = this.bannerId;
        banner.innerHTML = `
            <div class="hello-banner-content">
                <span class="hello-banner-icon">👑</span>
                <span class="hello-banner-text">Hello World - 管理员专属插件已加载</span>
                <button class="hello-banner-close" title="关闭">×</button>
            </div>
        `;

        document.body.insertBefore(banner, document.body.firstChild);

        // 绑定关闭按钮
        const closeBtn = banner.querySelector('.hello-banner-close');
        closeBtn.addEventListener('click', () => {
            banner.style.animation = 'helloSlideUp 0.3s ease forwards';
            setTimeout(() => banner.remove(), 300);
        });
    }

    removeBanner() {
        const banner = document.getElementById(this.bannerId);
        if (banner) {
            banner.remove();
        }
    }
}

// 注册插件
registerPlugin('hello-world', HelloWorldPlugin);

/**
 * 团队协作插件 - 事件总线
 * 用于组件间解耦通信
 */

class EventBus {
    constructor() {
        this.listeners = new Map();
        this.onceListeners = new Map();
    }

    /**
     * 监听事件
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     * @returns {Function} 取消监听的函数
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);

        // 返回取消监听的函数
        return () => this.off(event, callback);
    }

    /**
     * 监听事件一次
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     */
    once(event, callback) {
        if (!this.onceListeners.has(event)) {
            this.onceListeners.set(event, new Set());
        }
        this.onceListeners.get(event).add(callback);
    }

    /**
     * 取消监听
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     */
    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
        if (this.onceListeners.has(event)) {
            this.onceListeners.get(event).delete(callback);
        }
    }

    /**
     * 触发事件
     * @param {string} event - 事件名称
     * @param {*} data - 事件数据
     */
    emit(event, data = null) {
        // 执行普通监听器
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`EventBus: 事件 ${event} 的监听器执行出错`, error);
                }
            });
        }

        // 执行一次性监听器
        if (this.onceListeners.has(event)) {
            const onceSet = this.onceListeners.get(event);
            onceSet.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`EventBus: 事件 ${event} 的一次性监听器执行出错`, error);
                }
            });
            // 清除一次性监听器
            onceSet.clear();
        }
    }

    /**
     * 清除所有监听器
     */
    clear() {
        this.listeners.clear();
        this.onceListeners.clear();
    }

    /**
     * 清除指定事件的所有监听器
     * @param {string} event - 事件名称
     */
    clearEvent(event) {
        this.listeners.delete(event);
        this.onceListeners.delete(event);
    }
}

// 导出
window.TCEventBus = EventBus;

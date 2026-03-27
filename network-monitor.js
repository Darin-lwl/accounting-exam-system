/**
 * NetworkMonitor - 网络状态监测模块
 * 负责监测网络连接状态,显示离线提示
 */

class NetworkMonitor {
    constructor() {
        this.isOnline = navigator.onLine;
        this.callbacks = [];
    }

    /**
     * 开始监测网络状态
     */
    startMonitoring() {
        // 监听网络恢复事件
        window.addEventListener('online', () => {
            console.log('网络已恢复');
            this.isOnline = true;
            this.hideOfflineAlert();

            // 执行所有回调函数
            this.callbacks.forEach(cb => {
                try {
                    cb();
                } catch (error) {
                    console.error('网络恢复回调执行失败:', error);
                }
            });
        });

        // 监听网络断开事件
        window.addEventListener('offline', () => {
            console.log('网络已断开');
            this.isOnline = false;
            this.showOfflineAlert();
        });

        // 初始检查网络状态
        if (!this.isOnline) {
            this.showOfflineAlert();
        }
    }

    /**
     * 检查网络状态
     * @returns {boolean}
     */
    checkOnline() {
        return navigator.onLine;
    }

    /**
     * 显示离线提示
     */
    showOfflineAlert() {
        // 移除已存在的提示
        this.hideOfflineAlert();

        const alert = document.createElement('div');
        alert.id = 'offline-alert';
        alert.innerHTML = `
            <div class="offline-overlay">
                <div class="offline-content">
                    <div class="offline-icon">⚠️</div>
                    <h2>网络连接已断开</h2>
                    <p>请检查您的网络连接</p>
                    <p class="offline-tip">网络恢复后将自动刷新页面</p>
                    <button class="offline-refresh-btn" onclick="location.reload()">
                        🔄 手动刷新
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(alert);
    }

    /**
     * 隐藏离线提示
     */
    hideOfflineAlert() {
        const alert = document.getElementById('offline-alert');
        if (alert) {
            alert.remove();
        }
    }

    /**
     * 注册网络恢复回调
     * @param {function} callback - 回调函数
     */
    onOnline(callback) {
        if (typeof callback === 'function') {
            this.callbacks.push(callback);
        }
    }

    /**
     * 移除网络恢复回调
     * @param {function} callback - 回调函数
     */
    offOnline(callback) {
        const index = this.callbacks.indexOf(callback);
        if (index > -1) {
            this.callbacks.splice(index, 1);
        }
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NetworkMonitor;
}

/**
 * SyncManager - 前端同步管理器(简化版)
 * 管理数据实时同步,无离线队列、冲突检测和重试机制
 */

class SyncManager {
    constructor(apiClient) {
        this.apiClient = apiClient;

        // 同步状态
        this.status = 'idle'; // 'idle', 'syncing', 'success', 'failed'
        this.lastSyncTime = null;

        // 状态回调
        this.onStatusChange = null;
    }

    /**
     * 同步学习进度
     * @param {array} progress - 学习进度数据
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async syncProgress(progress) {
        try {
            this.setStatus('syncing');

            // 检查网络状态
            if (!navigator.onLine) {
                this.setStatus('failed');
                return { success: false, error: '网络连接已断开' };
            }

            const result = await this.apiClient.post('/api/sync/progress', { progress });

            if (result.success) {
                this.setStatus('success');
                this.lastSyncTime = new Date().toISOString();
            } else {
                this.setStatus('failed');
            }

            return result;
        } catch (error) {
            console.error('同步学习进度失败:', error);
            this.setStatus('failed');
            return { success: false, error: '同步失败: ' + error.message };
        }
    }

    /**
     * 同步错题集
     * @param {array} questions - 错题数据
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async syncQuestions(questions) {
        try {
            this.setStatus('syncing');

            // 检查网络状态
            if (!navigator.onLine) {
                this.setStatus('failed');
                return { success: false, error: '网络连接已断开' };
            }

            const result = await this.apiClient.post('/api/sync/questions', { questions });

            if (result.success) {
                this.setStatus('success');
                this.lastSyncTime = new Date().toISOString();
            } else {
                this.setStatus('failed');
            }

            return result;
        } catch (error) {
            console.error('同步错题集失败:', error);
            this.setStatus('failed');
            return { success: false, error: '同步失败: ' + error.message };
        }
    }

    /**
     * 拉取所有数据
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async fetchAll() {
        try {
            this.setStatus('syncing');

            // 检查网络状态
            if (!navigator.onLine) {
                this.setStatus('failed');
                return { success: false, error: '网络连接已断开' };
            }

            const result = await this.apiClient.get('/api/sync/all');

            if (result.success) {
                this.setStatus('success');
                this.lastSyncTime = new Date().toISOString();
            } else {
                this.setStatus('failed');
            }

            return result;
        } catch (error) {
            console.error('拉取数据失败:', error);
            this.setStatus('failed');
            return { success: false, error: '拉取失败: ' + error.message };
        }
    }

    /**
     * 设置状态
     * @param {string} status - 新状态
     */
    setStatus(status) {
        this.status = status;
        if (this.onStatusChange) {
            this.onStatusChange(status);
        }
    }

    /**
     * 获取同步状态
     * @returns {object}
     */
    getStatus() {
        return {
            status: this.status,
            lastSyncTime: this.lastSyncTime,
            isOnline: navigator.onLine
        };
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SyncManager;
}

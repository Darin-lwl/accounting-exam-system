/**
 * OfflineQueueService - 离线队列服务模块(服务器端)
 * 提供队列查询、状态更新、批量处理等功能
 */

import { SyncService } from './sync-service.js';

export class OfflineQueueService {
    constructor(env, db) {
        this.env = env;
        this.db = db;
        this.syncService = new SyncService(env, db);
    }

    /**
     * 添加操作到队列
     * @param {number} userId - 用户ID
     * @param {string} operationType - 操作类型
     * @param {object} operationData - 操作数据
     * @returns {Promise<{success: boolean, queueId?: number, error?: string}>}
     */
    async enqueue(userId, operationType, operationData) {
        try {
            const result = await this.db.prepare(
                'INSERT INTO offline_queue (user_id, operation_type, operation_data, status) VALUES (?, ?, ?, ?)'
            ).bind(userId, operationType, JSON.stringify(operationData), 'pending').run();
            
            return {
                success: true,
                queueId: result.meta.last_row_id
            };
        } catch (error) {
            console.error('添加到队列失败:', error);
            return { success: false, error: '添加到队列失败: ' + error.message };
        }
    }

    /**
     * 查询用户的离线队列
     * @param {number} userId - 用户ID
     * @param {string} status - 状态过滤(可选): 'pending', 'success', 'failed'
     * @returns {Promise<{success: boolean, queue?: array, error?: string}>}
     */
    async queryQueue(userId, status = null) {
        try {
            let query = 'SELECT id, operation_type, operation_data, retry_count, status, created_at, updated_at FROM offline_queue WHERE user_id = ?';
            const params = [userId];
            
            if (status) {
                query += ' AND status = ?';
                params.push(status);
            }
            
            query += ' ORDER BY created_at ASC';
            
            const result = await this.db.prepare(query).bind(...params).all();
            
            // 解析operation_data
            const queue = result.results.map(item => ({
                ...item,
                operation_data: JSON.parse(item.operation_data)
            }));
            
            return {
                success: true,
                queue: queue
            };
        } catch (error) {
            console.error('查询队列失败:', error);
            return { success: false, error: '查询队列失败: ' + error.message };
        }
    }

    /**
     * 更新队列项状态
     * @param {number} queueId - 队列项ID
     * @param {string} status - 新状态: 'pending', 'success', 'failed'
     * @param {number} retryCount - 重试次数(可选)
     * @returns {Promise<{success: boolean}>}
     */
    async updateStatus(queueId, status, retryCount = null) {
        try {
            const now = new Date().toISOString();
            
            if (retryCount !== null) {
                await this.db.prepare(
                    'UPDATE offline_queue SET status = ?, retry_count = ?, updated_at = ? WHERE id = ?'
                ).bind(status, retryCount, now, queueId).run();
            } else {
                await this.db.prepare(
                    'UPDATE offline_queue SET status = ?, updated_at = ? WHERE id = ?'
                ).bind(status, now, queueId).run();
            }
            
            return { success: true };
        } catch (error) {
            console.error('更新状态失败:', error);
            return { success: false };
        }
    }

    /**
     * 批量处理队列项
     * @param {number} userId - 用户ID
     * @param {number} batchSize - 批量大小,默认10
     * @returns {Promise<{success: boolean, results?: array, error?: string}>}
     */
    async processBatch(userId, batchSize = 10) {
        try {
            // 查询待处理的队列项
            const queueResult = await this.queryQueue(userId, 'pending');
            if (!queueResult.success) {
                return queueResult;
            }
            
            const queue = queueResult.queue.slice(0, batchSize);
            const results = [];
            
            for (const item of queue) {
                let result;
                
                try {
                    // 根据操作类型执行对应操作
                    switch (item.operation_type) {
                        case 'push_progress':
                            result = await this.syncService.pushData(
                                userId,
                                item.operation_data,
                                'progress'
                            );
                            break;
                        
                        case 'push_questions':
                            result = await this.syncService.pushData(
                                userId,
                                item.operation_data,
                                'questions'
                            );
                            break;
                        
                        case 'sync_all':
                            result = await this.syncService.syncAll(
                                userId,
                                item.operation_data
                            );
                            break;
                        
                        default:
                            result = { success: false, error: '未知操作类型' };
                    }
                    
                    if (result.success) {
                        // 处理成功,删除队列项
                        await this.db.prepare('DELETE FROM offline_queue WHERE id = ?').bind(item.id).run();
                        results.push({ id: item.id, success: true });
                    } else {
                        // 处理失败,递增重试次数
                        const newRetryCount = item.retry_count + 1;
                        
                        if (newRetryCount >= 5) {
                            // 超过最大重试次数,标记为失败
                            await this.updateStatus(item.id, 'failed', newRetryCount);
                            results.push({ id: item.id, success: false, error: '超过最大重试次数' });
                        } else {
                            // 更新重试次数
                            await this.updateStatus(item.id, 'pending', newRetryCount);
                            results.push({ id: item.id, success: false, retry: true, retryCount: newRetryCount });
                        }
                    }
                } catch (error) {
                    console.error('处理队列项失败:', error);
                    results.push({ id: item.id, success: false, error: error.message });
                }
            }
            
            return {
                success: true,
                results: results
            };
        } catch (error) {
            console.error('批量处理失败:', error);
            return { success: false, error: '批量处理失败: ' + error.message };
        }
    }

    /**
     * 清理已处理的队列项
     * @param {number} userId - 用户ID
     * @returns {Promise<{success: boolean, deleted?: number}>}
     */
    async clearProcessed(userId) {
        try {
            const result = await this.db.prepare(
                'DELETE FROM offline_queue WHERE user_id = ? AND status = ?'
            ).bind(userId, 'success').run();
            
            return {
                success: true,
                deleted: result.meta.changes
            };
        } catch (error) {
            console.error('清理队列失败:', error);
            return { success: false };
        }
    }

    /**
     * 获取队列统计信息
     * @param {number} userId - 用户ID
     * @returns {Promise<{success: boolean, stats?: object, error?: string}>}
     */
    async getStats(userId) {
        try {
            const stats = await this.db.prepare(
                'SELECT status, COUNT(*) as count FROM offline_queue WHERE user_id = ? GROUP BY status'
            ).bind(userId).all();
            
            const result = {
                pending: 0,
                success: 0,
                failed: 0
            };
            
            stats.results.forEach(item => {
                result[item.status] = item.count;
            });
            
            return {
                success: true,
                stats: result
            };
        } catch (error) {
            console.error('获取统计信息失败:', error);
            return { success: false, error: '获取统计信息失败: ' + error.message };
        }
    }
}

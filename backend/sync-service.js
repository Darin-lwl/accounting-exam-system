/**
 * SyncService - 同步服务模块(服务器端)
 * 提供数据推送、拉取、冲突检测、版本控制等功能
 * 使用事务保证数据一致性
 */

import { CryptoService } from './crypto-service.js';
import { AuditService } from './audit-service.js';

export class SyncService {
    constructor(env, db) {
        this.env = env;
        this.db = db;
        this.cryptoService = new CryptoService(env);
        this.auditService = new AuditService(env, db);
    }

    /**
     * 推送数据(客户端 → 服务器)
     * @param {number} userId - 用户ID
     * @param {object} data - 待推送的数据
     * @param {string} dataType - 数据类型: 'progress' 或 'questions'
     * @returns {Promise<{success: boolean, conflict?: object, error?: string}>}
     */
    async pushData(userId, data, dataType) {
        try {
            const tableName = dataType === 'progress' ? 'study_progress' : 'wrong_questions';
            const dataField = dataType === 'progress' ? 'plan_data' : 'questions_data';
            
            // 检测冲突
            const conflict = await this.checkConflicts(userId, data, dataType);
            if (conflict.hasConflict) {
                return {
                    success: false,
                    conflict: conflict,
                    error: '检测到数据冲突'
                };
            }
            
            // 计算完整性校验码
            const checksum = await this.cryptoService.calculateChecksum(data.data);
            
            // 使用事务更新数据
            const statements = [];
            
            // 检查是否已有记录
            const existing = await this.db.prepare(
                `SELECT id, version FROM ${tableName} WHERE user_id = ?`
            ).bind(userId).first();
            
            const now = new Date().toISOString();
            
            if (existing) {
                // 更新现有记录
                statements.push(
                    this.db.prepare(
                        `UPDATE ${tableName} 
                         SET ${dataField} = ?, version = version + 1, checksum = ?, updated_at = ? 
                         WHERE user_id = ?`
                    ).bind(JSON.stringify(data.data), checksum, now, userId)
                );
            } else {
                // 插入新记录
                statements.push(
                    this.db.prepare(
                        `INSERT INTO ${tableName} (user_id, ${dataField}, version, checksum, updated_at) 
                         VALUES (?, ?, 1, ?, ?)`
                    ).bind(userId, JSON.stringify(data.data), checksum, now)
                );
            }
            
            // 执行事务
            await this.db.batch(statements);
            
            // 记录审计日志
            await this.auditService.log({
                userId,
                operation: `push_${dataType}`,
                details: { version: existing ? existing.version + 1 : 1 },
                result: 'success'
            });
            
            return { success: true };
        } catch (error) {
            console.error('推送数据失败:', error);
            
            // 记录失败日志
            await this.auditService.log({
                userId,
                operation: `push_${dataType}`,
                details: { error: error.message },
                result: 'failed'
            });
            
            return { success: false, error: '推送数据失败: ' + error.message };
        }
    }

    /**
     * 拉取数据(服务器 → 客户端)
     * @param {number} userId - 用户ID
     * @param {string} dataType - 数据类型: 'progress' 或 'questions'
     * @param {string|null} since - 增量同步时间戳(可选)
     * @returns {Promise<{success: boolean, data?: object, version?: number, checksum?: string, error?: string}>}
     */
    async pullData(userId, dataType, since = null) {
        try {
            const tableName = dataType === 'progress' ? 'study_progress' : 'wrong_questions';
            const dataField = dataType === 'progress' ? 'plan_data' : 'questions_data';
            
            // 构建查询
            let query = `SELECT ${dataField}, version, checksum, updated_at FROM ${tableName} WHERE user_id = ?`;
            const params = [userId];
            
            if (since) {
                query += ' AND updated_at > ?';
                params.push(since);
            }
            
            const result = await this.db.prepare(query).bind(...params).first();
            
            if (!result) {
                return {
                    success: true,
                    data: null,
                    version: 0,
                    checksum: ''
                };
            }
            
            // 验证完整性校验码
            const data = JSON.parse(result[dataField]);
            const isValid = await this.cryptoService.verifyChecksum(data, result.checksum);
            
            if (!isValid) {
                console.error('数据完整性校验失败');
                return { success: false, error: '数据完整性校验失败' };
            }
            
            // 记录审计日志
            await this.auditService.log({
                userId,
                operation: `pull_${dataType}`,
                details: { version: result.version },
                result: 'success'
            });
            
            return {
                success: true,
                data: data,
                version: result.version,
                checksum: result.checksum,
                updatedAt: result.updated_at
            };
        } catch (error) {
            console.error('拉取数据失败:', error);
            
            await this.auditService.log({
                userId,
                operation: `pull_${dataType}`,
                details: { error: error.message },
                result: 'failed'
            });
            
            return { success: false, error: '拉取数据失败: ' + error.message };
        }
    }

    /**
     * 检测冲突
     * @param {number} userId - 用户ID
     * @param {object} clientData - 客户端数据
     * @param {string} dataType - 数据类型
     * @returns {Promise<{hasConflict: boolean, serverData?: object, serverVersion?: number}>}
     */
    async checkConflicts(userId, clientData, dataType) {
        try {
            const tableName = dataType === 'progress' ? 'study_progress' : 'wrong_questions';
            
            // 查询服务器数据
            const serverRecord = await this.db.prepare(
                `SELECT plan_data, questions_data, version, updated_at FROM ${tableName} WHERE user_id = ?`
            ).bind(userId).first();
            
            if (!serverRecord) {
                // 服务器没有数据,无冲突
                return { hasConflict: false };
            }
            
            const dataField = dataType === 'progress' ? 'plan_data' : 'questions_data';
            const serverData = JSON.parse(serverRecord[dataField]);
            
            // 比对版本号
            if (clientData.version && clientData.version < serverRecord.version) {
                // 客户端版本落后,存在冲突
                return {
                    hasConflict: true,
                    serverData: serverData,
                    serverVersion: serverRecord.version,
                    serverUpdatedAt: serverRecord.updated_at
                };
            }
            
            // 无冲突
            return { hasConflict: false };
        } catch (error) {
            console.error('检测冲突失败:', error);
            return { hasConflict: false };
        }
    }

    /**
     * 解决冲突
     * @param {number} userId - 用户ID
     * @param {string} dataType - 数据类型
     * @param {string} strategy - 解决策略: 'client' 或 'server'
     * @param {object} clientData - 客户端数据
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async resolveConflicts(userId, dataType, strategy, clientData) {
        try {
            if (strategy === 'client') {
                // 客户端优先:使用客户端数据
                const result = await this.pushData(userId, { data: clientData, version: 0 }, dataType);
                return result;
            } else if (strategy === 'server') {
                // 服务器优先:返回服务器数据
                const result = await this.pullData(userId, dataType);
                return result;
            } else {
                return { success: false, error: '无效的冲突解决策略' };
            }
        } catch (error) {
            console.error('解决冲突失败:', error);
            return { success: false, error: '解决冲突失败: ' + error.message };
        }
    }

    /**
     * 批量同步所有数据
     * @param {number} userId - 用户ID
     * @param {object} data - 包含progress和questions的数据
     * @returns {Promise<{success: boolean, results?: object, error?: string}>}
     */
    async syncAll(userId, data) {
        try {
            const results = {};
            
            // 同步学习进度
            if (data.progress) {
                results.progress = await this.pushData(userId, data.progress, 'progress');
            }
            
            // 同步错题集
            if (data.questions) {
                results.questions = await this.pushData(userId, data.questions, 'questions');
            }
            
            // 检查是否全部成功
            const allSuccess = Object.values(results).every(r => r.success);
            
            return {
                success: allSuccess,
                results: results
            };
        } catch (error) {
            console.error('批量同步失败:', error);
            return { success: false, error: '批量同步失败: ' + error.message };
        }
    }

    /**
     * 获取所有数据
     * @param {number} userId - 用户ID
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async getAll(userId) {
        try {
            // 并行获取学习进度和错题集
            const [progressResult, questionsResult] = await Promise.all([
                this.pullData(userId, 'progress'),
                this.pullData(userId, 'questions')
            ]);
            
            return {
                success: true,
                data: {
                    progress: progressResult.data,
                    questions: questionsResult.data
                }
            };
        } catch (error) {
            console.error('获取所有数据失败:', error);
            return { success: false, error: '获取所有数据失败: ' + error.message };
        }
    }
}

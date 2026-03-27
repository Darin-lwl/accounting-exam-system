/**
 * AuditService - 审计服务模块
 * 提供操作日志记录和查询功能
 * 日志异步写入,不影响主业务性能
 */

export class AuditService {
    constructor(env, db) {
        this.env = env;
        this.db = db;
    }

    /**
     * 记录审计日志(异步写入)
     * @param {object} params - 日志参数
     * @param {number|null} params.userId - 用户ID
     * @param {string|null} params.username - 用户名
     * @param {string} params.operation - 操作类型
     * @param {object|null} params.details - 操作详情
     * @param {string|null} params.ipAddress - IP地址
     * @param {string} params.result - 操作结果
     * @returns {void}
     */
    async log({ userId, username, operation, details, ipAddress, result }) {
        // 异步写入日志,不阻塞主业务
        // 使用Promise但不await,让其在后台执行
        this._writeLog({ userId, username, operation, details, ipAddress, result })
            .catch(error => {
                // 日志写入失败不影响主业务,记录到console
                console.error('审计日志写入失败:', error);
            });
    }

    /**
     * 实际写入日志(内部方法)
     * @private
     */
    async _writeLog({ userId, username, operation, details, ipAddress, result }) {
        // 过滤敏感数据
        const safeDetails = this._filterSensitiveData(details);
        
        await this.db.prepare(
            'INSERT INTO audit_logs (user_id, username, operation, details, ip_address, result) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(
            userId,
            username,
            operation,
            safeDetails ? JSON.stringify(safeDetails) : null,
            ipAddress,
            result
        ).run();
    }

    /**
     * 查询审计日志
     * @param {object} params - 查询参数
     * @param {number|null} params.userId - 用户ID(可选)
     * @param {string|null} params.operation - 操作类型(可选)
     * @param {string|null} params.startTime - 开始时间(可选)
     * @param {string|null} params.endTime - 结束时间(可选)
     * @param {number} params.limit - 返回数量限制,默认100
     * @param {number} params.offset - 偏移量,默认0
     * @returns {Promise<{success: boolean, logs?: array, total?: number, error?: string}>}
     */
    async query({ userId, operation, startTime, endTime, limit = 100, offset = 0 }) {
        try {
            // 构建查询条件
            const conditions = [];
            const params = [];
            
            if (userId) {
                conditions.push('user_id = ?');
                params.push(userId);
            }
            
            if (operation) {
                conditions.push('operation = ?');
                params.push(operation);
            }
            
            if (startTime) {
                conditions.push('timestamp >= ?');
                params.push(startTime);
            }
            
            if (endTime) {
                conditions.push('timestamp <= ?');
                params.push(endTime);
            }
            
            const whereClause = conditions.length > 0 
                ? 'WHERE ' + conditions.join(' AND ')
                : '';
            
            // 查询总数
            const countResult = await this.db.prepare(
                `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`
            ).bind(...params).first();
            
            // 查询日志列表
            const logs = await this.db.prepare(
                `SELECT id, user_id, username, operation, details, ip_address, result, timestamp 
                 FROM audit_logs ${whereClause} 
                 ORDER BY timestamp DESC 
                 LIMIT ? OFFSET ?`
            ).bind(...params, limit, offset).all();
            
            return {
                success: true,
                logs: logs.results,
                total: countResult.total
            };
        } catch (error) {
            console.error('查询审计日志失败:', error);
            return { success: false, error: '查询审计日志失败: ' + error.message };
        }
    }

    /**
     * 清理过期日志(90天前)
     * @returns {Promise<{success: boolean, deleted?: number, error?: string}>}
     */
    async cleanOldLogs() {
        try {
            const result = await this.db.prepare(
                "DELETE FROM audit_logs WHERE timestamp < datetime('now', '-90 days')"
            ).run();
            
            return {
                success: true,
                deleted: result.meta.changes
            };
        } catch (error) {
            console.error('清理审计日志失败:', error);
            return { success: false, error: '清理审计日志失败: ' + error.message };
        }
    }

    /**
     * 过滤敏感数据
     * @private
     * @param {object|null} data - 原始数据
     * @returns {object|null} - 过滤后的数据
     */
    _filterSensitiveData(data) {
        if (!data) return null;
        
        // 敏感字段列表
        const sensitiveFields = ['password', 'token', 'accessToken', 'refreshToken', 'salt'];
        
        // 递归过滤
        const filter = (obj) => {
            if (typeof obj !== 'object' || obj === null) return obj;
            
            const filtered = Array.isArray(obj) ? [] : {};
            
            for (const key in obj) {
                if (sensitiveFields.includes(key)) {
                    filtered[key] = '***FILTERED***';
                } else if (typeof obj[key] === 'object') {
                    filtered[key] = filter(obj[key]);
                } else {
                    filtered[key] = obj[key];
                }
            }
            
            return filtered;
        };
        
        return filter(data);
    }

    /**
     * 获取操作统计
     * @param {number|null} userId - 用户ID(可选)
     * @param {string|null} startTime - 开始时间(可选)
     * @param {string|null} endTime - 结束时间(可选)
     * @returns {Promise<{success: boolean, stats?: object, error?: string}>}
     */
    async getStats({ userId, startTime, endTime }) {
        try {
            // 构建查询条件
            const conditions = [];
            const params = [];
            
            if (userId) {
                conditions.push('user_id = ?');
                params.push(userId);
            }
            
            if (startTime) {
                conditions.push('timestamp >= ?');
                params.push(startTime);
            }
            
            if (endTime) {
                conditions.push('timestamp <= ?');
                params.push(endTime);
            }
            
            const whereClause = conditions.length > 0 
                ? 'WHERE ' + conditions.join(' AND ')
                : '';
            
            // 查询操作统计
            const stats = await this.db.prepare(
                `SELECT operation, result, COUNT(*) as count 
                 FROM audit_logs ${whereClause} 
                 GROUP BY operation, result`
            ).bind(...params).all();
            
            return {
                success: true,
                stats: stats.results
            };
        } catch (error) {
            console.error('获取操作统计失败:', error);
            return { success: false, error: '获取操作统计失败: ' + error.message };
        }
    }
}

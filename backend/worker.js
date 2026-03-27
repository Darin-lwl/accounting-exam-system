/**
 * Cloudflare Workers API 网关
 * 整合认证、同步、审计等服务的路由
 * 添加中间件(Token验证、错误处理、日志记录)
 */

import { AuthService } from './auth-service.js';
import { SyncService } from './sync-service.js';
import { AuditService } from './audit-service.js';
import { OfflineQueueService } from './offline-queue-service.js';

// CORS 头
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// 返回JSON响应
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
        }
    });
}

// 获取客户端IP地址
function getClientIP(request) {
    return request.headers.get('CF-Connecting-IP') || 
           request.headers.get('X-Forwarded-For') || 
           'unknown';
}

// 主处理函数
export default {
    async fetch(request, env, ctx) {
        // 处理OPTIONS请求(CORS预检)
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }
        
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;
        
        // 初始化服务
        const authService = new AuthService(env, env.DB);
        const syncService = new SyncService(env, env.DB);
        const auditService = new AuditService(env, env.DB);
        const offlineQueueService = new OfflineQueueService(env, env.DB);
        
        try {
            // ==================== 公开接口 ====================
            
            // 用户注册
            if (path === '/api/auth/register' && method === 'POST') {
                const { username, password } = await request.json();
                const result = await authService.register(username, password);

                // 记录审计日志
                await auditService.log({
                    userId: result.user?.id,
                    username,
                    operation: 'register',
                    ipAddress: getClientIP(request),
                    result: result.success ? 'success' : 'failed'
                });

                return jsonResponse(
                    result.success ? {
                        success: true,
                        message: '注册成功',
                        data: {
                            user: result.user,
                            accessToken: result.accessToken,
                            refreshToken: result.refreshToken
                        }
                    } : {
                        success: false,
                        error: { message: result.error }
                    },
                    result.success ? 200 : 400
                );
            }
            
            // 用户登录
            if (path === '/api/auth/login' && method === 'POST') {
                const { username, password } = await request.json();
                const result = await authService.login(username, password);

                // 记录审计日志
                await auditService.log({
                    userId: result.user?.id,
                    username,
                    operation: 'login',
                    ipAddress: getClientIP(request),
                    result: result.success ? 'success' : 'failed'
                });

                return jsonResponse(
                    result.success ? {
                        success: true,
                        message: '登录成功',
                        data: {
                            user: result.user,
                            accessToken: result.accessToken,
                            refreshToken: result.refreshToken
                        }
                    } : {
                        success: false,
                        error: { message: result.error }
                    },
                    result.success ? 200 : 401
                );
            }
            
            // ==================== 需要认证的接口 ====================
            
            // Token验证中间件
            const authHeader = request.headers.get('Authorization');
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return jsonResponse({ error: '未授权' }, 401);
            }
            
            const token = authHeader.substring(7);
            const payload = await authService.verifyToken(token);
            
            if (!payload) {
                return jsonResponse({ error: 'Token无效或已过期' }, 401);
            }
            
            const userId = payload.userId;
            const username = payload.username;
            
            // Token刷新
            if (path === '/api/auth/refresh' && method === 'POST') {
                const { refreshToken } = await request.json();
                const result = await authService.refreshToken(refreshToken);
                
                return jsonResponse(
                    result.success ? {
                        accessToken: result.accessToken,
                        refreshToken: result.refreshToken
                    } : { error: result.error },
                    result.success ? 200 : 401
                );
            }
            
            // 用户登出
            if (path === '/api/auth/logout' && method === 'POST') {
                const result = await authService.logout(userId);

                await auditService.log({
                    userId,
                    username,
                    operation: 'logout',
                    ipAddress: getClientIP(request),
                    result: 'success'
                });

                return jsonResponse(result);
            }

            // 获取用户信息
            if (path === '/api/auth/profile' && method === 'GET') {
                const result = await authService.getProfile(userId);
                return jsonResponse(result);
            }

            // 修改密码
            if (path === '/api/auth/change-password' && method === 'POST') {
                const { oldPassword, newPassword } = await request.json();
                const result = await authService.changePassword(userId, oldPassword, newPassword);

                await auditService.log({
                    userId,
                    username,
                    operation: 'change_password',
                    ipAddress: getClientIP(request),
                    result: result.success ? 'success' : 'failed'
                });

                return jsonResponse(result);
            }
            
            // ==================== 同步接口 ====================
            
            // 推送学习进度
            if (path === '/api/sync/progress' && method === 'POST') {
                const { planData, version } = await request.json();
                const result = await syncService.pushData(userId, { data: planData, version }, 'progress');
                
                if (result.conflict) {
                    return jsonResponse(result, 409); // 409 Conflict
                }
                
                return jsonResponse(
                    result.success ? { message: '推送成功' } : { error: result.error },
                    result.success ? 200 : 500
                );
            }
            
            // 拉取学习进度
            if (path === '/api/sync/progress' && method === 'GET') {
                const since = url.searchParams.get('since');
                const result = await syncService.pullData(userId, 'progress', since);
                
                return jsonResponse(
                    result.success ? {
                        progress: result.data,
                        version: result.version,
                        checksum: result.checksum,
                        updatedAt: result.updatedAt
                    } : { error: result.error },
                    result.success ? 200 : 500
                );
            }
            
            // 推送错题集
            if (path === '/api/sync/questions' && method === 'POST') {
                const { questionsData, version } = await request.json();
                const result = await syncService.pushData(userId, { data: questionsData, version }, 'questions');
                
                if (result.conflict) {
                    return jsonResponse(result, 409);
                }
                
                return jsonResponse(
                    result.success ? { message: '推送成功' } : { error: result.error },
                    result.success ? 200 : 500
                );
            }
            
            // 拉取错题集
            if (path === '/api/sync/questions' && method === 'GET') {
                const since = url.searchParams.get('since');
                const result = await syncService.pullData(userId, 'questions', since);
                
                return jsonResponse(
                    result.success ? {
                        questions: result.data,
                        version: result.version,
                        checksum: result.checksum,
                        updatedAt: result.updatedAt
                    } : { error: result.error },
                    result.success ? 200 : 500
                );
            }
            
            // 批量同步所有数据
            if (path === '/api/sync/all' && method === 'POST') {
                const data = await request.json();
                const result = await syncService.syncAll(userId, data);
                
                return jsonResponse(
                    result.success ? { message: '同步成功', results: result.results } : { error: result.error },
                    result.success ? 200 : 500
                );
            }
            
            // 获取所有数据
            if (path === '/api/sync/all' && method === 'GET') {
                const result = await syncService.getAll(userId);
                
                return jsonResponse(
                    result.success ? result.data : { error: result.error },
                    result.success ? 200 : 500
                );
            }
            
            // 解决冲突
            if (path === '/api/sync/conflict' && method === 'POST') {
                const { dataType, strategy, clientData } = await request.json();
                const result = await syncService.resolveConflicts(userId, dataType, strategy, clientData);
                
                return jsonResponse(
                    result.success ? { data: result.data } : { error: result.error },
                    result.success ? 200 : 500
                );
            }
            
            // ==================== 离线队列接口 ====================
            
            // 查询离线队列
            if (path === '/api/offline-queue' && method === 'GET') {
                const result = await offlineQueueService.queryQueue(userId);
                
                return jsonResponse(
                    result.success ? { queue: result.queue } : { error: result.error },
                    result.success ? 200 : 500
                );
            }
            
            // 处理离线队列
            if (path === '/api/offline-queue/process' && method === 'POST') {
                const result = await offlineQueueService.processBatch(userId);
                
                return jsonResponse(
                    result.success ? { message: '处理完成', results: result.results } : { error: result.error },
                    result.success ? 200 : 500
                );
            }
            
            // ==================== 审计日志接口 ====================
            
            // 查询审计日志(仅管理员)
            if (path === '/api/audit/logs' && method === 'GET') {
                // 简单的管理员验证(实际应使用更严格的权限控制)
                if (username !== 'admin') {
                    return jsonResponse({ error: '无权限访问' }, 403);
                }
                
                const params = {
                    userId: url.searchParams.get('userId'),
                    operation: url.searchParams.get('operation'),
                    startTime: url.searchParams.get('startTime'),
                    endTime: url.searchParams.get('endTime'),
                    limit: parseInt(url.searchParams.get('limit') || '100'),
                    offset: parseInt(url.searchParams.get('offset') || '0')
                };
                
                const result = await auditService.query(params);
                
                return jsonResponse(
                    result.success ? { logs: result.logs, total: result.total } : { error: result.error },
                    result.success ? 200 : 500
                );
            }
            
            // 404
            return jsonResponse({ error: '接口不存在' }, 404);
            
        } catch (error) {
            console.error('服务器错误:', error);
            return jsonResponse({ error: '服务器错误: ' + error.message }, 500);
        }
    }
};

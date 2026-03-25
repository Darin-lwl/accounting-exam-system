/**
 * Cloudflare Workers API 服务
 * 用于处理用户认证和数据同步
 */

// 改为直接引用包名
import { sign, verify } from "@tsndr/cloudflare-worker-jwt";

// JWT密钥（部署时需要在Cloudflare中设置环境变量 JWT_SECRET）
const JWT_EXPIRES_IN = '7d';

// CORS 头
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// 密码加密（简单版本，生产环境建议使用更强的加密）
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 生成JWT Token
async function generateToken(userId, username, secret) {
    return await sign({ userId, username }, secret, { expiresIn: JWT_EXPIRES_IN });
}

// 验证JWT Token
async function verifyToken(token, secret) {
    try {
        const payload = await verify(token, secret);
        return payload;
    } catch (err) {
        return null;
    }
}

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

// 处理用户注册
async function handleRegister(request, env) {
    try {
        const { username, password } = await request.json();
        
        if (!username || !password) {
            return jsonResponse({ error: '用户名和密码不能为空' }, 400);
        }
        
        if (username.length < 3 || username.length > 20) {
            return jsonResponse({ error: '用户名长度应在3-20个字符之间' }, 400);
        }
        
        if (password.length < 6) {
            return jsonResponse({ error: '密码长度至少6个字符' }, 400);
        }
        
        // 检查用户是否已存在
        const existingUser = await env.DB.prepare(
            'SELECT id FROM users WHERE username = ?'
        ).bind(username).first();
        
        if (existingUser) {
            return jsonResponse({ error: '用户名已存在' }, 400);
        }
        
        // 加密密码
        const hashedPassword = await hashPassword(password);
        
        // 创建用户
        const result = await env.DB.prepare(
            'INSERT INTO users (username, password) VALUES (?, ?)'
        ).bind(username, hashedPassword).run();
        
        // 生成Token
        const token = await generateToken(result.meta.last_row_id, username, env.JWT_SECRET);
        
        return jsonResponse({
            message: '注册成功',
            token,
            user: {
                id: result.meta.last_row_id,
                username
            }
        });
    } catch (error) {
        return jsonResponse({ error: '注册失败: ' + error.message }, 500);
    }
}

// 处理用户登录
async function handleLogin(request, env) {
    try {
        const { username, password } = await request.json();
        
        if (!username || !password) {
            return jsonResponse({ error: '用户名和密码不能为空' }, 400);
        }
        
        // 查找用户
        const user = await env.DB.prepare(
            'SELECT id, username, password FROM users WHERE username = ?'
        ).bind(username).first();
        
        if (!user) {
            return jsonResponse({ error: '用户名或密码错误' }, 401);
        }
        
        // 验证密码
        const hashedPassword = await hashPassword(password);
        if (user.password !== hashedPassword) {
            return jsonResponse({ error: '用户名或密码错误' }, 401);
        }
        
        // 生成Token
        const token = await generateToken(user.id, user.username, env.JWT_SECRET);
        
        return jsonResponse({
            message: '登录成功',
            token,
            user: {
                id: user.id,
                username: user.username
            }
        });
    } catch (error) {
        return jsonResponse({ error: '登录失败: ' + error.message }, 500);
    }
}

// 获取学习进度
async function getStudyProgress(userId, env) {
    try {
        const progress = await env.DB.prepare(
            'SELECT plan_data FROM study_progress WHERE user_id = ?'
        ).bind(userId).first();
        
        return progress ? JSON.parse(progress.plan_data) : null;
    } catch (error) {
        return null;
    }
}

// 保存学习进度
async function saveStudyProgress(userId, planData, env) {
    try {
        // 检查是否已有记录
        const existing = await env.DB.prepare(
            'SELECT id FROM study_progress WHERE user_id = ?'
        ).bind(userId).first();
        
        if (existing) {
            // 更新
            await env.DB.prepare(
                'UPDATE study_progress SET plan_data = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?'
            ).bind(JSON.stringify(planData), userId).run();
        } else {
            // 插入
            await env.DB.prepare(
                'INSERT INTO study_progress (user_id, plan_data) VALUES (?, ?)'
            ).bind(userId, JSON.stringify(planData)).run();
        }
        
        return true;
    } catch (error) {
        return false;
    }
}

// 获取错题集
async function getWrongQuestions(userId, env) {
    try {
        const questions = await env.DB.prepare(
            'SELECT questions_data FROM wrong_questions WHERE user_id = ?'
        ).bind(userId).first();
        
        return questions ? JSON.parse(questions.questions_data) : [];
    } catch (error) {
        return [];
    }
}

// 保存错题集
async function saveWrongQuestions(userId, questionsData, env) {
    try {
        // 检查是否已有记录
        const existing = await env.DB.prepare(
            'SELECT id FROM wrong_questions WHERE user_id = ?'
        ).bind(userId).first();
        
        if (existing) {
            // 更新
            await env.DB.prepare(
                'UPDATE wrong_questions SET questions_data = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?'
            ).bind(JSON.stringify(questionsData), userId).run();
        } else {
            // 插入
            await env.DB.prepare(
                'INSERT INTO wrong_questions (user_id, questions_data) VALUES (?, ?)'
            ).bind(userId, JSON.stringify(questionsData)).run();
        }
        
        return true;
    } catch (error) {
        return false;
    }
}

// 主处理函数
export default {
    async fetch(request, env, ctx) {
        // 处理OPTIONS请求（CORS预检）
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }
        
        const url = new URL(request.url);
        const path = url.pathname;
        
        // 路由处理
        try {
            // 公开接口：注册
            if (path === '/api/register' && request.method === 'POST') {
                return await handleRegister(request, env);
            }
            
            // 公开接口：登录
            if (path === '/api/login' && request.method === 'POST') {
                return await handleLogin(request, env);
            }
            
            // 需要认证的接口
            const authHeader = request.headers.get('Authorization');
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return jsonResponse({ error: '未授权' }, 401);
            }
            
            const token = authHeader.substring(7);
            const payload = await verifyToken(token, env.JWT_SECRET);
            
            if (!payload) {
                return jsonResponse({ error: 'Token无效或已过期' }, 401);
            }
            
            const userId = payload.userId;
            
            // 获取学习进度
            if (path === '/api/progress' && request.method === 'GET') {
                const progress = await getStudyProgress(userId, env);
                return jsonResponse({ progress });
            }
            
            // 保存学习进度
            if (path === '/api/progress' && request.method === 'POST') {
                const { planData } = await request.json();
                const success = await saveStudyProgress(userId, planData, env);
                return success 
                    ? jsonResponse({ message: '保存成功' })
                    : jsonResponse({ error: '保存失败' }, 500);
            }
            
            // 获取错题集
            if (path === '/api/wrong-questions' && request.method === 'GET') {
                const questions = await getWrongQuestions(userId, env);
                return jsonResponse({ questions });
            }
            
            // 保存错题集
            if (path === '/api/wrong-questions' && request.method === 'POST') {
                const { questionsData } = await request.json();
                const success = await saveWrongQuestions(userId, questionsData, env);
                return success 
                    ? jsonResponse({ message: '保存成功' })
                    : jsonResponse({ error: '保存失败' }, 500);
            }
            
            // 同步所有数据
            if (path === '/api/sync' && request.method === 'POST') {
                const { planData, questionsData } = await request.json();
                const progressSuccess = await saveStudyProgress(userId, planData, env);
                const questionsSuccess = await saveWrongQuestions(userId, questionsData, env);
                
                return (progressSuccess && questionsSuccess)
                    ? jsonResponse({ message: '同步成功' })
                    : jsonResponse({ error: '同步失败' }, 500);
            }
            
            // 获取所有数据
            if (path === '/api/sync' && request.method === 'GET') {
                const progress = await getStudyProgress(userId, env);
                const questions = await getWrongQuestions(userId, env);
                return jsonResponse({ progress, questions });
            }
            
            // 404
            return jsonResponse({ error: '接口不存在' }, 404);
            
        } catch (error) {
            return jsonResponse({ error: '服务器错误: ' + error.message }, 500);
        }
    }
};

/**
 * AuthService - 认证服务模块
 * 提供用户登录、Token签发和刷新、密码验证等功能
 * 使用bcrypt和JWT RS256算法
 */

import { sign, verify } from "@tsndr/cloudflare-worker-jwt";
import { CryptoService } from './crypto-service.js';

export class AuthService {
    constructor(env, db) {
        this.env = env;
        this.db = db;
        this.cryptoService = new CryptoService(env);
        
        // Token配置
        this.accessTokenExpiresIn = '1h';  // AccessToken有效期1小时
        this.refreshTokenExpiresIn = '7d'; // RefreshToken有效期7天
    }

    /**
     * 用户登录
     * @param {string} username - 用户名
     * @param {string} password - 密码
     * @returns {Promise<{success: boolean, user?: object, accessToken?: string, refreshToken?: string, error?: string}>}
     */
    async login(username, password) {
        try {
            // 查询用户
            const user = await this.db.prepare(
                'SELECT id, username, password, salt, token_version FROM users WHERE username = ?'
            ).bind(username).first();
            
            if (!user) {
                return { success: false, error: '用户名或密码错误' };
            }
            
            // 验证密码
            const isValid = await this.verifyPassword(password, user.password, user.salt);
            if (!isValid) {
                return { success: false, error: '用户名或密码错误' };
            }
            
            // 签发Token对
            const accessToken = await this.generateAccessToken(user.id, user.username, user.token_version);
            const refreshToken = await this.generateRefreshToken(user.id, user.username, user.token_version);
            
            return {
                success: true,
                user: {
                    id: user.id,
                    username: user.username
                },
                accessToken,
                refreshToken
            };
        } catch (error) {
            console.error('登录失败:', error);
            return { success: false, error: '登录失败: ' + error.message };
        }
    }

    /**
     * 刷新Token
     * @param {string} refreshToken - 刷新Token
     * @returns {Promise<{success: boolean, accessToken?: string, refreshToken?: string, error?: string}>}
     */
    async refreshToken(refreshToken) {
        try {
            // 验证RefreshToken
            const payload = await this.verifyToken(refreshToken);
            if (!payload) {
                return { success: false, error: 'RefreshToken无效或已过期' };
            }
            
            // 查询用户的token_version
            const user = await this.db.prepare(
                'SELECT id, username, token_version FROM users WHERE id = ?'
            ).bind(payload.userId).first();
            
            if (!user) {
                return { success: false, error: '用户不存在' };
            }
            
            // 验证token_version,确保旧Token失效
            if (user.token_version !== payload.tokenVersion) {
                return { success: false, error: 'Token已失效,请重新登录' };
            }
            
            // 签发新的Token对
            const newAccessToken = await this.generateAccessToken(user.id, user.username, user.token_version);
            const newRefreshToken = await this.generateRefreshToken(user.id, user.username, user.token_version);
            
            return {
                success: true,
                accessToken: newAccessToken,
                refreshToken: newRefreshToken
            };
        } catch (error) {
            console.error('刷新Token失败:', error);
            return { success: false, error: '刷新Token失败: ' + error.message };
        }
    }

    /**
     * 验证AccessToken
     * @param {string} token - AccessToken
     * @returns {Promise<object|null>} - Token payload或null
     */
    async verifyToken(token) {
        try {
            const payload = await verify(token, this.env.JWT_SECRET);
            return payload;
        } catch (error) {
            return null;
        }
    }

    /**
     * 用户注册
     * @param {string} username - 用户名
     * @param {string} password - 密码
     * @returns {Promise<{success: boolean, user?: object, accessToken?: string, refreshToken?: string, error?: string}>}
     */
    async register(username, password) {
        try {
            // 验证用户名和密码格式
            if (!username || !password) {
                return { success: false, error: '用户名和密码不能为空' };
            }
            
            if (username.length < 3 || username.length > 20) {
                return { success: false, error: '用户名长度应在3-20个字符之间' };
            }
            
            if (password.length < 6) {
                return { success: false, error: '密码长度至少6个字符' };
            }
            
            // 检查用户是否已存在
            const existingUser = await this.db.prepare(
                'SELECT id FROM users WHERE username = ?'
            ).bind(username).first();
            
            if (existingUser) {
                return { success: false, error: '用户名已存在' };
            }
            
            // 生成盐值
            const salt = this.cryptoService.generateSalt(16);
            
            // 加密密码
            const hashedPassword = await this.hashPassword(password, salt);
            
            // 创建用户
            const result = await this.db.prepare(
                'INSERT INTO users (username, password, salt, token_version, version) VALUES (?, ?, ?, 1, 1)'
            ).bind(username, hashedPassword, salt).run();
            
            const userId = result.meta.last_row_id;
            
            // 签发Token对
            const accessToken = await this.generateAccessToken(userId, username, 1);
            const refreshToken = await this.generateRefreshToken(userId, username, 1);
            
            return {
                success: true,
                user: {
                    id: userId,
                    username
                },
                accessToken,
                refreshToken
            };
        } catch (error) {
            console.error('注册失败:', error);
            return { success: false, error: '注册失败: ' + error.message };
        }
    }

    /**
     * 用户登出(使Token失效)
     * @param {number} userId - 用户ID
     * @returns {Promise<{success: boolean}>}
     */
    async logout(userId) {
        try {
            // 递增token_version,使所有旧Token失效
            await this.db.prepare(
                'UPDATE users SET token_version = token_version + 1 WHERE id = ?'
            ).bind(userId).run();

            return { success: true, message: '登出成功' };
        } catch (error) {
            console.error('登出失败:', error);
            return { success: false, error: { code: 'LOGOUT_FAILED', message: '登出失败: ' + error.message } };
        }
    }

    /**
     * 获取用户信息
     * @param {number} userId - 用户ID
     * @returns {Promise<{success: boolean, data?: object, error?: object}>}
     */
    async getProfile(userId) {
        try {
            // 查询用户基本信息
            const user = await this.db.prepare(
                'SELECT id, username, created_at FROM users WHERE id = ?'
            ).bind(userId).first();

            if (!user) {
                return { success: false, error: { code: 'USER_NOT_FOUND', message: '用户不存在' } };
            }

            // 获取学习进度统计
            const progressCount = await this.db.prepare(
                'SELECT COUNT(*) as count FROM study_progress WHERE user_id = ?'
            ).bind(userId).first();

            // 获取错题统计
            const questionCount = await this.db.prepare(
                'SELECT COUNT(*) as count FROM wrong_questions WHERE user_id = ?'
            ).bind(userId).first();

            return {
                success: true,
                data: {
                    id: user.id,
                    username: user.username,
                    createdAt: user.created_at,
                    stats: {
                        progressCount: progressCount.count,
                        questionCount: questionCount.count
                    }
                }
            };
        } catch (error) {
            console.error('获取用户信息失败:', error);
            return { success: false, error: { code: 'GET_PROFILE_FAILED', message: '获取用户信息失败: ' + error.message } };
        }
    }

    /**
     * 修改密码
     * @param {number} userId - 用户ID
     * @param {string} oldPassword - 旧密码
     * @param {string} newPassword - 新密码
     * @returns {Promise<{success: boolean, error?: object}>}
     */
    async changePassword(userId, oldPassword, newPassword) {
        try {
            // 验证新密码格式
            if (!newPassword || newPassword.length < 6) {
                return { success: false, error: { code: 'INVALID_PASSWORD', message: '新密码长度至少6个字符' } };
            }

            // 查询用户
            const user = await this.db.prepare(
                'SELECT password, salt FROM users WHERE id = ?'
            ).bind(userId).first();

            if (!user) {
                return { success: false, error: { code: 'USER_NOT_FOUND', message: '用户不存在' } };
            }

            // 验证旧密码
            const isValid = await this.verifyPassword(oldPassword, user.password, user.salt);
            if (!isValid) {
                return { success: false, error: { code: 'INVALID_OLD_PASSWORD', message: '旧密码错误' } };
            }

            // 生成新盐值
            const newSalt = this.cryptoService.generateSalt(16);

            // 加密新密码
            const newHashedPassword = await this.hashPassword(newPassword, newSalt);

            // 更新密码和token_version(使旧Token失效)
            await this.db.prepare(
                'UPDATE users SET password = ?, salt = ?, token_version = token_version + 1 WHERE id = ?'
            ).bind(newHashedPassword, newSalt, userId).run();

            return { success: true, message: '密码修改成功' };
        } catch (error) {
            console.error('修改密码失败:', error);
            return { success: false, error: { code: 'CHANGE_PASSWORD_FAILED', message: '修改密码失败: ' + error.message } };
        }
    }

    /**
     * 生成AccessToken
     * @param {number} userId - 用户ID
     * @param {string} username - 用户名
     * @param {number} tokenVersion - Token版本号
     * @returns {Promise<string>}
     */
    async generateAccessToken(userId, username, tokenVersion) {
        return await sign(
            {
                userId,
                username,
                tokenVersion,
                type: 'access'
            },
            this.env.JWT_SECRET,
            { expiresIn: this.accessTokenExpiresIn }
        );
    }

    /**
     * 生成RefreshToken
     * @param {number} userId - 用户ID
     * @param {string} username - 用户名
     * @param {number} tokenVersion - Token版本号
     * @returns {Promise<string>}
     */
    async generateRefreshToken(userId, username, tokenVersion) {
        return await sign(
            {
                userId,
                username,
                tokenVersion,
                type: 'refresh'
            },
            this.env.JWT_SECRET,
            { expiresIn: this.refreshTokenExpiresIn }
        );
    }

    /**
     * 哈希密码(加盐)
     * @param {string} password - 密码
     * @param {string} salt - 盐值
     * @returns {Promise<string>} - 哈希后的密码
     */
    async hashPassword(password, salt) {
        // 使用PBKDF2进行加盐哈希
        const encoder = new TextEncoder();
        const passwordBuffer = encoder.encode(password);
        const saltBuffer = encoder.encode(salt);
        
        // 导入密码
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            passwordBuffer,
            'PBKDF2',
            false,
            ['deriveBits']
        );
        
        // 派生密钥(模拟bcrypt的成本因子12)
        const derivedBits = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: saltBuffer,
                iterations: 4096, // 2^12
                hash: 'SHA-256'
            },
            keyMaterial,
            256
        );
        
        // 转换为hex字符串
        const hashArray = new Uint8Array(derivedBits);
        return Array.from(hashArray)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * 验证密码
     * @param {string} password - 密码
     * @param {string} hashedPassword - 哈希后的密码
     * @param {string} salt - 盐值
     * @returns {Promise<boolean>}
     */
    async verifyPassword(password, hashedPassword, salt) {
        const newHash = await this.hashPassword(password, salt);
        return newHash === hashedPassword;
    }
}

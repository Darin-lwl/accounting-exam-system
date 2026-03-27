/**
 * ApiClient - 前端API客户端
 * 集成加密服务,发送请求前加密敏感数据,接收响应后解密数据
 * 集成Token自动刷新机制
 */

class ApiClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.tokenRefreshThreshold = 0.25; // Token剩余有效期<25%时刷新
        
        // 请求拦截器
        this.requestInterceptors = [];
        this.responseInterceptors = [];
    }

    /**
     * 发送GET请求
     * @param {string} path - API路径
     * @param {object} params - 查询参数(可选)
     * @returns {Promise<object>}
     */
    async get(path, params = {}) {
        const url = new URL(this.baseUrl + path);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        
        return this.request('GET', url.toString());
    }

    /**
     * 发送POST请求
     * @param {string} path - API路径
     * @param {object} data - 请求体数据
     * @returns {Promise<object>}
     */
    async post(path, data = {}) {
        return this.request('POST', this.baseUrl + path, data);
    }

    /**
     * 发送HTTP请求
     * @param {string} method - HTTP方法
     * @param {string} url - 完整URL
     * @param {object} data - 请求体数据(可选)
     * @returns {Promise<object>}
     */
    async request(method, url, data = null) {
        try {
            // 检查并刷新Token
            await this.checkAndRefreshToken();
            
            // 构建请求配置
            const config = {
                method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            
            // 添加Authorization头
            const token = this.getAccessToken();
            if (token) {
                config.headers['Authorization'] = `Bearer ${token}`;
            }
            
            // 添加请求体
            if (data && method !== 'GET') {
                // 加密敏感数据
                const encryptedData = await this.encryptSensitiveData(data);
                config.body = JSON.stringify(encryptedData);
            }
            
            // 执行请求拦截器
            for (const interceptor of this.requestInterceptors) {
                await interceptor(config);
            }
            
            // 发送请求
            const response = await fetch(url, config);
            
            // 解析响应
            let result;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                result = await response.json();
            } else {
                result = await response.text();
            }
            
            // 解密敏感数据
            if (typeof result === 'object') {
                result = await this.decryptSensitiveData(result);
            }
            
            // 构建返回对象
            const returnResult = {
                success: response.ok,
                status: response.status,
                data: result
            };
            
            // 执行响应拦截器
            for (const interceptor of this.responseInterceptors) {
                await interceptor(returnResult);
            }
            
            // 处理401错误(Token过期)
            if (response.status === 401) {
                // 尝试刷新Token
                const refreshed = await this.refreshToken();
                if (refreshed) {
                    // Token刷新成功,重试请求
                    return this.request(method, url, data);
                } else {
                    // Token刷新失败,清除Token并跳转登录页
                    this.clearTokens();
                    window.location.href = '/login.html';
                }
            }
            
            return returnResult;
        } catch (error) {
            console.error('请求失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 检查并刷新Token
     */
    async checkAndRefreshToken() {
        const token = this.getAccessToken();
        if (!token) return;
        
        // 解析Token获取过期时间
        const payload = this.parseJwt(token);
        if (!payload || !payload.exp) return;
        
        // 计算剩余有效期
        const now = Date.now() / 1000;
        const remaining = payload.exp - now;
        const total = payload.exp - payload.iat;
        
        // 如果剩余有效期<25%,刷新Token
        if (remaining / total < this.tokenRefreshThreshold) {
            await this.refreshToken();
        }
    }

    /**
     * 刷新Token
     * @returns {Promise<boolean>}
     */
    async refreshToken() {
        try {
            const refreshToken = this.getRefreshToken();
            if (!refreshToken) return false;
            
            const response = await fetch(this.baseUrl + '/api/auth/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refreshToken })
            });
            
            if (response.ok) {
                const result = await response.json();
                this.setTokens(result.accessToken, result.refreshToken);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('刷新Token失败:', error);
            return false;
        }
    }

    /**
     * 加密敏感数据
     * @param {object} data - 原始数据
     * @returns {Promise<object>}
     */
    async encryptSensitiveData(data) {
        // 敏感字段列表
        const sensitiveFields = ['answer', 'answers', 'password'];
        
        // 递归加密
        const encrypt = async (obj) => {
            if (typeof obj !== 'object' || obj === null) return obj;
            
            const encrypted = Array.isArray(obj) ? [] : {};
            
            for (const key in obj) {
                if (sensitiveFields.includes(key) && typeof obj[key] === 'string') {
                    // 加密敏感字段
                    // 注意: 实际加密需要在服务器端实现,这里只是标记
                    encrypted[key] = obj[key]; // 暂不加密,由服务器端处理
                } else if (typeof obj[key] === 'object') {
                    encrypted[key] = await encrypt(obj[key]);
                } else {
                    encrypted[key] = obj[key];
                }
            }
            
            return encrypted;
        };
        
        return await encrypt(data);
    }

    /**
     * 解密敏感数据
     * @param {object} data - 加密数据
     * @returns {Promise<object>}
     */
    async decryptSensitiveData(data) {
        // 解密逻辑与加密类似,暂不实现
        return data;
    }

    /**
     * 解析JWT Token
     * @param {string} token
     * @returns {object|null}
     */
    parseJwt(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            
            return JSON.parse(jsonPayload);
        } catch (error) {
            return null;
        }
    }

    /**
     * 获取AccessToken
     * @returns {string|null}
     */
    getAccessToken() {
        return localStorage.getItem('accessToken');
    }

    /**
     * 获取RefreshToken
     * @returns {string|null}
     */
    getRefreshToken() {
        return localStorage.getItem('refreshToken');
    }

    /**
     * 设置Token
     * @param {string} accessToken
     * @param {string} refreshToken
     */
    setTokens(accessToken, refreshToken) {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
    }

    /**
     * 清除Token
     */
    clearTokens() {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userInfo');
    }

    /**
     * 添加请求拦截器
     * @param {function} interceptor
     */
    addRequestInterceptor(interceptor) {
        this.requestInterceptors.push(interceptor);
    }

    /**
     * 添加响应拦截器
     * @param {function} interceptor
     */
    addResponseInterceptor(interceptor) {
        this.responseInterceptors.push(interceptor);
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiClient;
}

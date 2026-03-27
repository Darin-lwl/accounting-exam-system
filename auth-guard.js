/**
 * AuthGuard - 登录验证模块
 * 负责登录状态检查、Token管理、路由守卫
 */

class AuthGuard {
    /**
     * 检查是否已登录
     * @returns {boolean}
     */
    static isAuthenticated() {
        const token = localStorage.getItem('accessToken');
        return token && !this.isTokenExpired(token);
    }

    /**
     * 检查Token是否过期
     * @param {string} token - JWT Token
     * @returns {boolean}
     */
    static isTokenExpired(token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.exp * 1000 < Date.now();
        } catch (error) {
            return true;
        }
    }

    /**
     * 获取当前用户信息
     * @returns {object|null}
     */
    static getCurrentUser() {
        const userInfo = localStorage.getItem('userInfo');
        return userInfo ? JSON.parse(userInfo) : null;
    }

    /**
     * 登录验证守卫
     * @returns {boolean}
     */
    static requireAuth() {
        if (!this.isAuthenticated()) {
            // 保存当前页面URL,登录后跳转回来
            localStorage.setItem('redirectUrl', window.location.href);
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    /**
     * 判断是否需要刷新Token
     * @param {string} token - JWT Token
     * @returns {boolean}
     */
    static shouldRefreshToken(token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const remaining = payload.exp * 1000 - Date.now();
            const total = payload.exp * 1000 - payload.iat * 1000;
            return remaining < total * 0.25; // 剩余<25%时刷新
        } catch (error) {
            return false;
        }
    }

    /**
     * 刷新Token
     * @returns {Promise<boolean>}
     */
    static async refreshToken() {
        try {
            const refreshToken = localStorage.getItem('refreshToken');
            if (!refreshToken) {
                this.logout();
                return false;
            }

            const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });

            const data = await response.json();

            if (data.success) {
                localStorage.setItem('accessToken', data.data.accessToken);
                localStorage.setItem('refreshToken', data.data.refreshToken);
                return true;
            } else {
                this.logout();
                return false;
            }
        } catch (error) {
            console.error('Token刷新失败:', error);
            this.logout();
            return false;
        }
    }

    /**
     * 设置Token自动刷新
     */
    static setupTokenRefresh() {
        // 每5分钟检查一次Token有效期
        setInterval(async () => {
            const token = localStorage.getItem('accessToken');
            if (token && this.shouldRefreshToken(token)) {
                await this.refreshToken();
            }
        }, 5 * 60 * 1000);
    }

    /**
     * 登出
     */
    static logout() {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userInfo');
        window.location.href = 'login.html';
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthGuard;
}

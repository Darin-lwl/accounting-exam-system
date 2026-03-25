/**
 * API服务模块
 * 用于前端与后端API通信
 */

class ApiService {
    constructor() {
        // API基础URL - 部署后需要修改为你的Workers URL
        this.baseUrl = 'https://accounting-exam-api.1227944456.workers.dev'; // 例如: https://accounting-exam-api.your-subdomain.workers.dev
        this.token = localStorage.getItem('authToken');
        this.isOnlineMode = localStorage.getItem('isOnlineMode') === 'true';
    }

    // 检查是否在线模式
    isOnline() {
        return this.isOnlineMode && this.token;
    }

    // 获取认证头
    getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
        };
    }

    // 同步学习进度到服务器
    async syncProgress(planData) {
        if (!this.isOnline()) {
            // 离线模式，保存到本地
            localStorage.setItem('studyPlan', JSON.stringify(planData));
            return { success: true, offline: true };
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/progress`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ planData })
            });

            const data = await response.json();
            return { success: response.ok, data };
        } catch (error) {
            console.error('同步进度失败:', error);
            // 失败时保存到本地
            localStorage.setItem('studyPlan', JSON.stringify(planData));
            return { success: false, error: error.message };
        }
    }

    // 从服务器获取学习进度
    async getProgress() {
        if (!this.isOnline()) {
            // 离线模式，从本地获取
            const localData = localStorage.getItem('studyPlan');
            return { success: true, data: localData ? JSON.parse(localData) : null, offline: true };
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/progress`, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });

            const data = await response.json();
            return { success: response.ok, data: data.progress };
        } catch (error) {
            console.error('获取进度失败:', error);
            // 失败时从本地获取
            const localData = localStorage.getItem('studyPlan');
            return { success: false, data: localData ? JSON.parse(localData) : null, error: error.message };
        }
    }

    // 同步错题集到服务器
    async syncWrongQuestions(questionsData) {
        if (!this.isOnline()) {
            // 离线模式，保存到本地
            localStorage.setItem('wrongQuestions', JSON.stringify(questionsData));
            return { success: true, offline: true };
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/wrong-questions`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ questionsData })
            });

            const data = await response.json();
            return { success: response.ok, data };
        } catch (error) {
            console.error('同步错题失败:', error);
            // 失败时保存到本地
            localStorage.setItem('wrongQuestions', JSON.stringify(questionsData));
            return { success: false, error: error.message };
        }
    }

    // 从服务器获取错题集
    async getWrongQuestions() {
        if (!this.isOnline()) {
            // 离线模式，从本地获取
            const localData = localStorage.getItem('wrongQuestions');
            return { success: true, data: localData ? JSON.parse(localData) : [], offline: true };
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/wrong-questions`, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });

            const data = await response.json();
            return { success: response.ok, data: data.questions };
        } catch (error) {
            console.error('获取错题失败:', error);
            // 失败时从本地获取
            const localData = localStorage.getItem('wrongQuestions');
            return { success: false, data: localData ? JSON.parse(localData) : [], error: error.message };
        }
    }

    // 同步所有数据
    async syncAll(planData, questionsData) {
        if (!this.isOnline()) {
            // 离线模式，保存到本地
            localStorage.setItem('studyPlan', JSON.stringify(planData));
            localStorage.setItem('wrongQuestions', JSON.stringify(questionsData));
            return { success: true, offline: true };
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/sync`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ planData, questionsData })
            });

            const data = await response.json();
            return { success: response.ok, data };
        } catch (error) {
            console.error('同步数据失败:', error);
            // 失败时保存到本地
            localStorage.setItem('studyPlan', JSON.stringify(planData));
            localStorage.setItem('wrongQuestions', JSON.stringify(questionsData));
            return { success: false, error: error.message };
        }
    }

    // 获取所有数据
    async getAll() {
        if (!this.isOnline()) {
            // 离线模式，从本地获取
            const planData = localStorage.getItem('studyPlan');
            const questionsData = localStorage.getItem('wrongQuestions');
            return {
                success: true,
                data: {
                    progress: planData ? JSON.parse(planData) : null,
                    questions: questionsData ? JSON.parse(questionsData) : []
                },
                offline: true
            };
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/sync`, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });

            const data = await response.json();
            return { success: response.ok, data };
        } catch (error) {
            console.error('获取数据失败:', error);
            // 失败时从本地获取
            const planData = localStorage.getItem('studyPlan');
            const questionsData = localStorage.getItem('wrongQuestions');
            return {
                success: false,
                data: {
                    progress: planData ? JSON.parse(planData) : null,
                    questions: questionsData ? JSON.parse(questionsData) : []
                },
                error: error.message
            };
        }
    }

    // 登出
    logout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userInfo');
        localStorage.removeItem('isOnlineMode');
        window.location.href = 'login.html';
    }

    // 获取用户信息
    getUserInfo() {
        const userInfo = localStorage.getItem('userInfo');
        return userInfo ? JSON.parse(userInfo) : null;
    }
}

// 创建全局API实例
const apiService = new ApiService();

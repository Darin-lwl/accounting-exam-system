/**
 * UserProfile - 个人中心模块
 * 负责显示用户信息、退出登录、切换账号、修改密码
 */

// API基础URL(需要在主HTML文件中定义)
if (typeof API_BASE_URL === 'undefined') {
    var API_BASE_URL = 'https://accounting-exam-api.1227944456.workers.dev';
}

class UserProfile {
    constructor() {
        this.user = AuthGuard.getCurrentUser();
        this.menuVisible = false;
    }

    /**
     * 渲染个人中心UI
     */
    render() {
        if (!this.user) {
            console.error('用户信息不存在');
            return;
        }

        // 查找header元素
        const header = document.querySelector('header');
        if (!header) {
            console.error('未找到header元素');
            return;
        }

        // 创建个人中心容器
        const profileDiv = document.createElement('div');
        profileDiv.className = 'user-profile-container';
        profileDiv.innerHTML = `
            <div class="user-avatar" onclick="userProfile.toggleMenu()">
                ${this.user.username.charAt(0).toUpperCase()}
            </div>
            <div class="user-menu" id="user-menu">
                <div class="user-menu-header">
                    <div class="user-menu-avatar">${this.user.username.charAt(0).toUpperCase()}</div>
                    <div class="user-menu-info">
                        <div class="user-menu-username">${this.user.username}</div>
                        <div class="user-menu-id">ID: ${this.user.id}</div>
                    </div>
                </div>
                <div class="user-menu-divider"></div>
                <div class="user-menu-item" onclick="userProfile.showChangePassword()">
                    <span class="menu-icon">🔐</span>
                    <span>修改密码</span>
                </div>
                <div class="user-menu-item" onclick="userProfile.switchAccount()">
                    <span class="menu-icon">🔄</span>
                    <span>切换账号</span>
                </div>
                <div class="user-menu-divider"></div>
                <div class="user-menu-item logout" onclick="userProfile.logout()">
                    <span class="menu-icon">🚪</span>
                    <span>退出登录</span>
                </div>
            </div>
        `;

        header.appendChild(profileDiv);

        // 点击其他地方关闭菜单
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.user-profile-container') && this.menuVisible) {
                this.hideMenu();
            }
        });
    }

    /**
     * 切换菜单显示状态
     */
    toggleMenu() {
        const menu = document.getElementById('user-menu');
        if (menu) {
            this.menuVisible = !this.menuVisible;
            menu.style.display = this.menuVisible ? 'block' : 'none';
        }
    }

    /**
     * 隐藏菜单
     */
    hideMenu() {
        const menu = document.getElementById('user-menu');
        if (menu) {
            this.menuVisible = false;
            menu.style.display = 'none';
        }
    }

    /**
     * 退出登录
     */
    async logout() {
        try {
            // 调用登出API
            await fetch(`${API_BASE_URL}/api/auth/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                }
            });
        } catch (error) {
            console.error('登出API调用失败:', error);
        }

        // 清除本地数据并跳转
        AuthGuard.logout();
    }

    /**
     * 切换账号
     */
    switchAccount() {
        // 清除当前用户信息,跳转到登录页面
        AuthGuard.logout();
    }

    /**
     * 显示修改密码对话框
     */
    showChangePassword() {
        this.hideMenu();

        // 移除已存在的对话框
        this.closeDialog();

        const dialog = document.createElement('div');
        dialog.className = 'change-password-dialog';
        dialog.id = 'change-password-dialog';
        dialog.innerHTML = `
            <div class="dialog-overlay" onclick="userProfile.closeDialog()">
                <div class="dialog-content" onclick="event.stopPropagation()">
                    <div class="dialog-header">
                        <h3>修改密码</h3>
                        <button class="dialog-close" onclick="userProfile.closeDialog()">×</button>
                    </div>
                    <div class="dialog-body">
                        <div class="form-group">
                            <label>旧密码</label>
                            <input type="password" id="old-password" placeholder="请输入旧密码">
                        </div>
                        <div class="form-group">
                            <label>新密码</label>
                            <input type="password" id="new-password" placeholder="至少6个字符">
                        </div>
                        <div class="form-group">
                            <label>确认新密码</label>
                            <input type="password" id="confirm-password" placeholder="再次输入新密码">
                        </div>
                    </div>
                    <div class="dialog-footer">
                        <button class="btn-cancel" onclick="userProfile.closeDialog()">取消</button>
                        <button class="btn-confirm" onclick="userProfile.changePassword()">确认修改</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);
    }

    /**
     * 修改密码
     */
    async changePassword() {
        const oldPassword = document.getElementById('old-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        // 验证输入
        if (!oldPassword || !newPassword || !confirmPassword) {
            alert('请填写所有字段');
            return;
        }

        if (newPassword.length < 6) {
            alert('新密码至少6个字符');
            return;
        }

        if (newPassword !== confirmPassword) {
            alert('两次输入的密码不一致');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                },
                body: JSON.stringify({ oldPassword, newPassword })
            });

            const data = await response.json();

            if (data.success) {
                alert('密码修改成功,请重新登录');
                this.closeDialog();
                AuthGuard.logout();
            } else {
                alert(data.error?.message || '密码修改失败');
            }
        } catch (error) {
            console.error('修改密码失败:', error);
            alert('网络错误,请稍后重试');
        }
    }

    /**
     * 关闭对话框
     */
    closeDialog() {
        const dialog = document.getElementById('change-password-dialog');
        if (dialog) {
            dialog.remove();
        }
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UserProfile;
}

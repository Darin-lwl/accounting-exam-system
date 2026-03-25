# 🚀 部署指南：Cloudflare Workers + D1 数据库

本文档将指导你完成初级会计考试复习系统的完整部署，实现多设备数据同步。

---

## 📋 部署前准备

### 1. 注册账号
- [GitHub账号](https://github.com)（用于代码托管）
- [Cloudflare账号](https://dash.cloudflare.com)（用于部署）

### 2. 安装工具
- Node.js (v18或更高版本)
- npm 或 yarn
- Wrangler CLI

```bash
# 安装Wrangler
npm install -g wrangler

# 登录Cloudflare
wrangler login
```

---

## 🗄️ 第一步：创建D1数据库

### 1. 创建数据库
```bash
cd backend
wrangler d1 create accounting-exam-db
```

执行后会返回数据库ID，类似：
```
✅ Successfully created DB 'accounting-exam-db'
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 2. 记录数据库ID
复制这个ID，后面需要用到。

### 3. 更新wrangler.toml
编辑 `backend/wrangler.toml` 文件，将 `YOUR_DATABASE_ID` 替换为实际的数据库ID：

```toml
[[d1_databases]]
binding = "DB"
database_name = "accounting-exam-db"
database_id = "你的数据库ID"  # 替换这里
```

### 4. 初始化数据库表
```bash
wrangler d1 execute accounting-exam-db --file=./schema.sql
```

---

## ⚡ 第二步：部署Workers API

### 1. 修改JWT密钥
编辑 `backend/wrangler.toml`，修改JWT_SECRET为一个强密钥：

```toml
[vars]
JWT_SECRET = "your-strong-secret-key-here-change-this"
```

建议使用随机字符串，例如：
```bash
# 生成随机密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. 部署Workers
```bash
cd backend
wrangler deploy
```

部署成功后会显示Workers URL，类似：
```
✨ Success! Uploaded 1 files
✨ Published your Worker to:
 https://accounting-exam-api.你的子域.workers.dev
```

### 3. 记录Workers URL
复制这个URL，前端需要使用。

---

## 🌐 第三步：配置前端

### 1. 更新API地址

编辑 `login.html`，找到第158行左右的：
```javascript
const API_BASE_URL = 'YOUR_WORKERS_URL';
```
替换为你的Workers URL：
```javascript
const API_BASE_URL = 'https://accounting-exam-api.你的子域.workers.dev';
```

编辑 `api-service.js`，找到第9行左右的：
```javascript
this.baseUrl = 'YOUR_WORKERS_URL';
```
替换为你的Workers URL：
```javascript
this.baseUrl = 'https://accounting-exam-api.你的子域.workers.dev';
```

### 2. 修改主页面
在 `2026初级会计考试复习系统-完整版.html` 的 `<head>` 标签中添加：

```html
<!-- 在</head>之前添加 -->
<script src="api-service.js"></script>
```

并在文件开头添加API服务引用和用户信息显示（具体修改见下文）。

---

## 📦 第四步：上传到GitHub

### 1. 初始化Git仓库
```bash
cd d:\li\CodeArts\demo
git init
```

### 2. 添加所有文件
```bash
git add .
```

### 3. 提交
```bash
git commit -m "feat: 添加云存储多设备同步功能"
```

### 4. 创建GitHub仓库
- 登录GitHub
- 创建新仓库 `accounting-exam-system`
- 不要勾选任何初始化选项

### 5. 推送代码
```bash
git remote add origin https://github.com/你的用户名/accounting-exam-system.git
git branch -M main
git push -u origin main
```

---

## 🎯 第五步：部署到Cloudflare Pages

### 1. 进入Cloudflare Dashboard
访问 https://dash.cloudflare.com

### 2. 创建Pages项目
- 点击左侧 "Workers & Pages"
- 点击 "Create application"
- 选择 "Pages" 标签
- 点击 "Connect to Git"

### 3. 连接GitHub
- 授权Cloudflare访问GitHub
- 选择 `accounting-exam-system` 仓库

### 4. 配置部署
- **Project name**: `accounting-exam`
- **Production branch**: `main`
- **Build settings**:
  - Framework preset: `None`
  - Build command: 留空
  - Build output directory: `/`
- 点击 "Save and Deploy"

### 5. 等待部署完成
部署成功后会获得一个URL：
```
https://accounting-exam.pages.dev
```

---

## ✅ 第六步：测试验证

### 1. 访问网站
打开 `https://你的项目名.pages.dev`

### 2. 注册账号
- 点击"注册"标签
- 输入用户名和密码
- 点击注册

### 3. 测试同步
- 在电脑上完成一些学习进度
- 在手机上登录同一账号
- 验证数据是否同步

---

## 🔧 常见问题

### Q1: Workers部署失败
**A:** 检查wrangler.toml中的数据库ID是否正确

### Q2: 登录时提示网络错误
**A:** 检查前端API_BASE_URL是否正确设置为Workers URL

### Q3: 数据没有同步
**A:** 
1. 检查浏览器控制台是否有错误
2. 确认JWT_SECRET已正确设置
3. 确认数据库表已正确初始化

### Q4: 如何查看数据库数据
```bash
wrangler d1 execute accounting-exam-db --command="SELECT * FROM users"
```

---

## 📊 项目结构

```
demo/
├── backend/                    # 后端API
│   ├── worker.js              # Workers主文件
│   ├── schema.sql             # 数据库表结构
│   ├── wrangler.toml          # Workers配置
│   └── package.json           # 依赖配置
├── login.html                  # 登录页面
├── api-service.js             # API服务模块
├── index.html                 # 入口文件
└── 2026初级会计考试复习系统-完整版.html  # 主程序
```

---

## 🎉 完成！

现在你的初级会计考试复习系统已经：
- ✅ 部署在Cloudflare上
- ✅ 支持用户注册/登录
- ✅ 支持多设备数据同步
- ✅ 完全免费使用

访问你的网站开始使用吧！

---

## 💡 后续优化建议

1. **自定义域名**: 在Cloudflare Pages设置中绑定你的域名
2. **数据备份**: 定期导出D1数据库
3. **监控告警**: 设置Cloudflare Analytics监控访问情况
4. **性能优化**: 使用Cloudflare CDN加速静态资源

---

## 📞 技术支持

如有问题，请检查：
1. Cloudflare Workers日志
2. 浏览器控制台错误
3. 网络请求响应

祝使用愉快！🎯

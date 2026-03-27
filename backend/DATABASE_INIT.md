# 数据库初始化说明

## 问题: D1_ERROR: no such table: users

数据库表不存在,需要初始化D1数据库。

---

## 解决方案

### 方法1: 使用Wrangler CLI初始化

```bash
# 进入backend目录
cd backend

# 执行SQL初始化数据库
wrangler d1 execute accounting-exam-db --local --file=./schema.sql

# 如果是远程数据库
wrangler d1 execute accounting-exam-db --remote --file=./schema.sql
```

### 方法2: 使用Cloudflare Dashboard

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 Workers & Pages > D1
3. 找到你的数据库 `accounting-exam-db`
4. 点击 "Console" 标签
5. 复制 `schema.sql` 的内容并执行

---

## 数据库表结构

### 1. users (用户表)
```sql
- id: 主键
- username: 用户名(唯一)
- password: 密码哈希
- salt: 密码加盐值
- token_version: Token版本号
- version: 数据版本号
- created_at: 创建时间
- last_login: 最后登录时间
```

### 2. study_progress (学习进度表)
```sql
- id: 主键
- user_id: 用户ID(外键)
- subject: 科目
- chapter: 章节
- progress: 进度
- last_study: 最后学习时间
- version: 数据版本号
- checksum: 完整性校验码
- created_at: 创建时间
- updated_at: 更新时间
```

### 3. wrong_questions (错题集表)
```sql
- id: 主键
- user_id: 用户ID(外键)
- question_id: 题目ID
- question_text: 题目内容
- subject: 科目
- wrong_count: 错误次数
- last_wrong: 最后错误时间
- version: 数据版本号
- checksum: 完整性校验码
- created_at: 创建时间
- updated_at: 更新时间
```

### 4. audit_logs (审计日志表)
```sql
- id: 主键
- user_id: 用户ID
- username: 用户名
- operation: 操作类型
- details: 操作详情
- ip_address: IP地址
- result: 操作结果
- timestamp: 时间戳
```

---

## 验证数据库初始化

执行以下SQL验证表是否创建成功:

```sql
-- 查看所有表
SELECT name FROM sqlite_master WHERE type='table';

-- 查看users表结构
PRAGMA table_info(users);

-- 查看study_progress表结构
PRAGMA table_info(study_progress);

-- 查看wrong_questions表结构
PRAGMA table_info(wrong_questions);

-- 查看audit_logs表结构
PRAGMA table_info(audit_logs);
```

---

## 完整操作步骤

### 1. 创建D1数据库(如果还没有)
```bash
wrangler d1 create accounting-exam-db
```

### 2. 更新wrangler.toml配置
确保 `wrangler.toml` 中包含数据库配置:
```toml
[[d1_databases]]
binding = "DB"
database_name = "accounting-exam-db"
database_id = "你的数据库ID"
```

### 3. 初始化数据库表
```bash
wrangler d1 execute accounting-exam-db --remote --file=./schema.sql
```

### 4. 部署Workers
```bash
wrangler deploy
```

### 5. 测试注册功能
打开登录页面,尝试注册新用户。

---

## 常见问题

### Q1: 数据库ID在哪里找?
**A**: 在Cloudflare Dashboard的D1页面,或者执行 `wrangler d1 list` 查看。

### Q2: 本地测试如何初始化?
**A**: 使用 `--local` 参数:
```bash
wrangler d1 execute accounting-exam-db --local --file=./schema.sql
```

### Q3: 如何查看数据库内容?
**A**: 使用Wrangler CLI:
```bash
wrangler d1 execute accounting-exam-db --remote --command="SELECT * FROM users"
```

---

## 下一步

数据库初始化完成后,重新测试注册功能:
1. 打开 `login.html`
2. 点击"注册"标签
3. 填写用户名和密码
4. 点击"注册"按钮
5. 应该可以成功注册

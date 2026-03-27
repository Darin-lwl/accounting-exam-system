-- 数据库迁移脚本 - 增强同步稳定性与数据安全性
-- 版本: 1.0
-- 日期: 2025-01-18

-- ============================================
-- 第一部分: 为现有表添加新字段
-- ============================================

-- 1. 为users表添加安全相关字段
-- salt: 密码加盐值(16字节随机值的hex字符串)
-- token_version: Token版本号,用于使旧Token失效
-- version: 数据版本号,用于冲突检测
ALTER TABLE users ADD COLUMN salt TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN version INTEGER DEFAULT 1;

-- 2. 为study_progress表添加同步相关字段
-- version: 数据版本号,每次更新递增
-- checksum: 完整性校验码(HMAC-SHA256)
ALTER TABLE study_progress ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE study_progress ADD COLUMN checksum TEXT DEFAULT '';

-- 3. 为wrong_questions表添加同步相关字段
ALTER TABLE wrong_questions ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE wrong_questions ADD COLUMN checksum TEXT DEFAULT '';

-- ============================================
-- 第二部分: 创建新表
-- ============================================

-- 4. 创建离线队列表
-- 用于存储客户端离线期间的待同步操作
CREATE TABLE IF NOT EXISTS offline_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    operation_type TEXT NOT NULL,  -- 操作类型: 'push_progress', 'push_questions', 'sync_all'
    operation_data TEXT NOT NULL,  -- 操作数据(JSON格式)
    retry_count INTEGER DEFAULT 0, -- 重试次数
    status TEXT DEFAULT 'pending', -- 状态: 'pending', 'success', 'failed'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 5. 创建审计日志表
-- 用于记录用户操作,便于追踪和排查问题
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,               -- 用户ID(可为空,如登录失败)
    username TEXT,                 -- 用户名
    operation TEXT NOT NULL,       -- 操作类型: 'login', 'logout', 'sync', 'register'等
    details TEXT,                  -- 操作详情(JSON格式,不含敏感数据)
    ip_address TEXT,               -- IP地址
    result TEXT NOT NULL,          -- 操作结果: 'success', 'failed'
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 第三部分: 创建索引
-- ============================================

-- 为离线队列创建索引,提高查询性能
CREATE INDEX IF NOT EXISTS idx_offline_queue_user ON offline_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_offline_queue_status ON offline_queue(status);
CREATE INDEX IF NOT EXISTS idx_offline_queue_user_status ON offline_queue(user_id, status);

-- 为审计日志创建索引
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_operation ON audit_logs(operation);

-- 为同步相关字段创建索引
CREATE INDEX IF NOT EXISTS idx_users_version ON users(version);
CREATE INDEX IF NOT EXISTS idx_study_progress_version ON study_progress(version);
CREATE INDEX IF NOT EXISTS idx_wrong_questions_version ON wrong_questions(version);

-- ============================================
-- 第四部分: 数据初始化
-- ============================================

-- 为现有用户生成默认盐值(后续需要通过升级脚本生成真实盐值)
-- 注意: 这里只是设置默认值,实际盐值需要在数据升级时生成
UPDATE users SET salt = '' WHERE salt IS NULL OR salt = '';

-- 为现有数据设置默认版本号
UPDATE study_progress SET version = 1 WHERE version IS NULL;
UPDATE wrong_questions SET version = 1 WHERE version IS NULL;

-- ============================================
-- 迁移完成
-- ============================================

-- 验证迁移结果
-- 可以通过以下查询验证表结构:
-- SELECT * FROM pragma_table_info('users');
-- SELECT * FROM pragma_table_info('study_progress');
-- SELECT * FROM pragma_table_info('wrong_questions');
-- SELECT * FROM pragma_table_info('offline_queue');
-- SELECT * FROM pragma_table_info('audit_logs');

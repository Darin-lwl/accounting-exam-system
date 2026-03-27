-- 数据库初始化脚本
-- 创建所有必要的表

-- ============================================
-- 1. 用户表
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    salt TEXT DEFAULT '',
    token_version INTEGER DEFAULT 1,
    version INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

-- 用户名索引
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ============================================
-- 2. 学习进度表
-- ============================================
CREATE TABLE IF NOT EXISTS study_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    chapter TEXT NOT NULL,
    progress INTEGER DEFAULT 0,
    last_study DATETIME,
    version INTEGER DEFAULT 1,
    checksum TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 学习进度索引
CREATE INDEX IF NOT EXISTS idx_study_progress_user ON study_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_study_progress_subject ON study_progress(user_id, subject);

-- ============================================
-- 3. 错题集表
-- ============================================
CREATE TABLE IF NOT EXISTS wrong_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    question_id TEXT NOT NULL,
    question_text TEXT NOT NULL,
    subject TEXT NOT NULL,
    wrong_count INTEGER DEFAULT 1,
    last_wrong DATETIME,
    version INTEGER DEFAULT 1,
    checksum TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 错题集索引
CREATE INDEX IF NOT EXISTS idx_wrong_questions_user ON wrong_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_wrong_questions_subject ON wrong_questions(user_id, subject);

-- ============================================
-- 4. 审计日志表
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    operation TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    result TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 审计日志索引
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_operation ON audit_logs(operation);

-- ============================================
-- 初始化完成
-- ============================================

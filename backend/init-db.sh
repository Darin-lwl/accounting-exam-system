#!/bin/bash
# 数据库初始化脚本 - 分步执行

echo "开始初始化数据库..."

# 1. 创建users表
echo "创建users表..."
wrangler d1 execute accounting-exam-db --remote --command="CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, salt TEXT DEFAULT '', token_version INTEGER DEFAULT 1, version INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, last_login DATETIME)"

# 2. 创建study_progress表
echo "创建study_progress表..."
wrangler d1 execute accounting-exam-db --remote --command="CREATE TABLE IF NOT EXISTS study_progress (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, subject TEXT NOT NULL, chapter TEXT NOT NULL, progress INTEGER DEFAULT 0, last_study DATETIME, version INTEGER DEFAULT 1, checksum TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id))"

# 3. 创建wrong_questions表
echo "创建wrong_questions表..."
wrangler d1 execute accounting-exam-db --remote --command="CREATE TABLE IF NOT EXISTS wrong_questions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, question_id TEXT NOT NULL, question_text TEXT NOT NULL, subject TEXT NOT NULL, wrong_count INTEGER DEFAULT 1, last_wrong DATETIME, version INTEGER DEFAULT 1, checksum TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id))"

# 4. 创建audit_logs表
echo "创建audit_logs表..."
wrangler d1 execute accounting-exam-db --remote --command="CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, username TEXT, operation TEXT NOT NULL, details TEXT, ip_address TEXT, result TEXT NOT NULL, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)"

# 5. 创建索引
echo "创建索引..."
wrangler d1 execute accounting-exam-db --remote --command="CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)"
wrangler d1 execute accounting-exam-db --remote --command="CREATE INDEX IF NOT EXISTS idx_study_progress_user ON study_progress(user_id)"
wrangler d1 execute accounting-exam-db --remote --command="CREATE INDEX IF NOT EXISTS idx_wrong_questions_user ON wrong_questions(user_id)"
wrangler d1 execute accounting-exam-db --remote --command="CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)"

# 6. 验证表创建
echo "验证表创建..."
wrangler d1 execute accounting-exam-db --remote --command="SELECT name FROM sqlite_master WHERE type='table'"

echo "数据库初始化完成!"

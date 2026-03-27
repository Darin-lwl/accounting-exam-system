/**
 * 数据升级脚本
 * 为现有用户数据生成盐值和加盐哈希密码
 * 为现有学习进度数据计算完整性校验码
 * 
 * 使用方法:
 * node upgrade-data.js
 */

const crypto = require('crypto');

// 模拟bcrypt的加盐哈希(简化版本,实际应使用bcrypt库)
function hashPasswordWithSalt(password, salt) {
    const hash = crypto.createHash('sha256');
    hash.update(password + salt);
    return hash.digest('hex');
}

// 生成随机盐值(16字节)
function generateSalt() {
    return crypto.randomBytes(16).toString('hex');
}

// 计算完整性校验码(HMAC-SHA256)
function calculateChecksum(data, key) {
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(JSON.stringify(data));
    return hmac.digest('hex');
}

// 数据升级函数
async function upgradeData() {
    console.log('开始数据升级...\n');

    // 注意: 这个脚本需要在Cloudflare Workers环境中执行
    // 这里提供的是逻辑示例,实际执行需要通过Workers API

    console.log('升级步骤:');
    console.log('1. 为所有用户生成唯一盐值(16字节随机)');
    console.log('2. 用户密码重新哈希为加盐格式');
    console.log('3. 所有学习进度记录计算checksum(HMAC-SHA256)');
    console.log('4. 所有错题集记录计算checksum(HMAC-SHA256)');
    console.log('5. 记录升级日志\n');

    // 示例: 升级单个用户
    const exampleUser = {
        id: 1,
        username: 'testuser',
        password: 'simple_hash_password' // 旧的简单哈希密码
    };

    // 生成盐值
    const salt = generateSalt();
    console.log(`生成盐值: ${salt}`);

    // 重新哈希密码(实际应使用bcrypt)
    const newHashedPassword = hashPasswordWithSalt(exampleUser.password, salt);
    console.log(`新的加盐哈希密码: ${newHashedPassword}\n`);

    // 示例: 升级学习进度
    const exampleProgress = {
        id: 1,
        user_id: 1,
        plan_data: '{"chapter": 1, "progress": 50}'
    };

    // 计算完整性校验码
    const hmacKey = process.env.HMAC_KEY || 'default-hmac-key-change-in-production';
    const checksum = calculateChecksum(JSON.parse(exampleProgress.plan_data), hmacKey);
    console.log(`完整性校验码: ${checksum}\n`);

    console.log('数据升级完成!');
    console.log('\n注意: 实际执行需要在Cloudflare Workers环境中运行');
    console.log('请使用以下命令执行迁移:');
    console.log('wrangler d1 execute accounting-exam-db --file=./migration.sql');
}

// 执行升级
upgradeData().catch(console.error);

/**
 * CryptoService - 加密服务模块
 * 提供数据加密、解密、完整性校验、密钥派生等功能
 * 使用Web Crypto API和AES-256-GCM算法
 */

export class CryptoService {
    constructor(env) {
        this.env = env;
        // 从环境变量获取加密密钥
        this.encryptionKey = env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
        this.hmacKey = env.HMAC_KEY || 'default-hmac-key-change-in-production';
    }

    /**
     * 加密数据
     * @param {string|object} data - 待加密的数据
     * @returns {Promise<{iv: string, ciphertext: string, authTag: string}>}
     */
    async encrypt(data) {
        try {
            // 将数据转换为字符串
            const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
            
            // 生成随机IV(12字节,适用于GCM模式)
            const iv = crypto.getRandomValues(new Uint8Array(12));
            
            // 派生加密密钥
            const key = await this.deriveKey(this.encryptionKey);
            
            // 加密数据
            const encoder = new TextEncoder();
            const encodedPlaintext = encoder.encode(plaintext);
            
            const ciphertext = await crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                key,
                encodedPlaintext
            );
            
            // 将ArrayBuffer转换为Base64字符串
            const ciphertextArray = new Uint8Array(ciphertext);
            const ciphertextBase64 = this.arrayBufferToBase64(ciphertextArray);
            const ivBase64 = this.arrayBufferToBase64(iv);
            
            // AES-GCM的认证标签包含在ciphertext的最后16字节
            const authTag = ciphertextBase64.slice(-24); // Base64编码的16字节
            
            return {
                iv: ivBase64,
                ciphertext: ciphertextBase64,
                authTag: authTag
            };
        } catch (error) {
            console.error('加密失败:', error);
            throw new Error('加密失败: ' + error.message);
        }
    }

    /**
     * 解密数据
     * @param {string} iv - 初始化向量(Base64)
     * @param {string} ciphertext - 密文(Base64)
     * @returns {Promise<string|object>}
     */
    async decrypt(iv, ciphertext) {
        try {
            // 将Base64转换为ArrayBuffer
            const ivArray = this.base64ToArrayBuffer(iv);
            const ciphertextArray = this.base64ToArrayBuffer(ciphertext);
            
            // 派生解密密钥
            const key = await this.deriveKey(this.encryptionKey);
            
            // 解密数据
            const decrypted = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: ivArray
                },
                key,
                ciphertextArray
            );
            
            // 将ArrayBuffer转换为字符串
            const decoder = new TextDecoder();
            const plaintext = decoder.decode(decrypted);
            
            // 尝试解析JSON
            try {
                return JSON.parse(plaintext);
            } catch {
                return plaintext;
            }
        } catch (error) {
            console.error('解密失败:', error);
            throw new Error('解密失败: ' + error.message);
        }
    }

    /**
     * 计算完整性校验码(HMAC-SHA256)
     * @param {string|object} data - 待校验的数据
     * @returns {Promise<string>} - 校验码(hex字符串)
     */
    async calculateChecksum(data) {
        try {
            const dataString = typeof data === 'string' ? data : JSON.stringify(data);
            
            // 派生HMAC密钥
            const key = await this.deriveHMACKey(this.hmacKey);
            
            // 计算HMAC
            const encoder = new TextEncoder();
            const encodedData = encoder.encode(dataString);
            
            const signature = await crypto.subtle.sign(
                'HMAC',
                key,
                encodedData
            );
            
            // 转换为hex字符串
            const signatureArray = new Uint8Array(signature);
            return Array.from(signatureArray)
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
        } catch (error) {
            console.error('计算校验码失败:', error);
            throw new Error('计算校验码失败: ' + error.message);
        }
    }

    /**
     * 验证完整性校验码
     * @param {string|object} data - 待验证的数据
     * @param {string} checksum - 校验码
     * @returns {Promise<boolean>}
     */
    async verifyChecksum(data, checksum) {
        try {
            const calculatedChecksum = await this.calculateChecksum(data);
            return calculatedChecksum === checksum;
        } catch (error) {
            console.error('验证校验码失败:', error);
            return false;
        }
    }

    /**
     * 派生加密密钥(PBKDF2)
     * @param {string} password - 密码
     * @returns {Promise<CryptoKey>}
     */
    async deriveKey(password) {
        const encoder = new TextEncoder();
        const encodedPassword = encoder.encode(password);
        
        // 导入原始密钥
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encodedPassword,
            'PBKDF2',
            false,
            ['deriveBits', 'deriveKey']
        );
        
        // 派生AES密钥
        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: encoder.encode('salt-for-encryption'),
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * 派生HMAC密钥
     * @param {string} key - 密钥
     * @returns {Promise<CryptoKey>}
     */
    async deriveHMACKey(key) {
        const encoder = new TextEncoder();
        const encodedKey = encoder.encode(key);
        
        return crypto.subtle.importKey(
            'raw',
            encodedKey,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign', 'verify']
        );
    }

    /**
     * 生成随机盐值
     * @param {number} length - 盐值长度(字节),默认16
     * @returns {string} - hex字符串
     */
    generateSalt(length = 16) {
        const saltArray = crypto.getRandomValues(new Uint8Array(length));
        return Array.from(saltArray)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * ArrayBuffer转Base64
     * @param {Uint8Array} buffer
     * @returns {string}
     */
    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Base64转ArrayBuffer
     * @param {string} base64
     * @returns {Uint8Array}
     */
    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
}

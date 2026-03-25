/**
 * 团队协作插件 - 加密管理器
 * 使用 AES-GCM 加密，与系统 worker.js 保持一致
 */

class CryptoManager {
    constructor() {
        this.encryptionKey = null;
    }

    /**
     * 初始化：获取系统加密密钥
     * @param {Object} api - 插件 SDK API
     */
    async init(api) {
        try {
            const response = await api.http.get('/api/get_encryption_key');
            this.encryptionKey = response.key;
            console.log('[CryptoManager] 加密密钥初始化成功');
        } catch (error) {
            console.error('[CryptoManager] 获取加密密钥失败:', error);
            throw new TCErrors.CryptoError('获取加密密钥失败', error);
        }
    }

    /**
     * 派生 AES-256 密钥
     * 与系统 worker.js 保持一致
     * @param {string} password - 密码
     * @returns {Promise<CryptoKey>}
     */
    async deriveKey(password) {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);

        return await crypto.subtle.importKey(
            'raw',
            hashBuffer.slice(0, 32), // 前 32 字节作为 AES-256 密钥
            'AES-GCM',
            false,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * 加密文本
     * @param {string} plainText - 明文
     * @returns {Promise<string>} Base64 编码的密文
     */
    async encrypt(plainText) {
        if (!this.encryptionKey) {
            throw new TCErrors.CryptoError('加密密钥未初始化');
        }

        try {
            const key = await this.deriveKey(this.encryptionKey);
            const iv = crypto.getRandomValues(new Uint8Array(12)); // 12 字节随机 IV
            const encoder = new TextEncoder();
            const data = encoder.encode(plainText);

            const encryptedBuffer = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                key,
                data
            );

            // 合并 IV 和密文
            const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encryptedBuffer), iv.length);

            // 转换为 Base64
            return btoa(String.fromCharCode(...combined));
        } catch (error) {
            console.error('[CryptoManager] 加密失败:', error);
            throw new TCErrors.CryptoError('加密失败', error);
        }
    }

    /**
     * 解密文本
     * @param {string} encryptedBase64 - Base64 编码的密文
     * @returns {Promise<string>} 明文
     */
    async decrypt(encryptedBase64) {
        if (!this.encryptionKey) {
            throw new TCErrors.CryptoError('加密密钥未初始化');
        }

        if (!encryptedBase64) {
            return '';
        }

        try {
            const key = await this.deriveKey(this.encryptionKey);
            const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

            // 分离 IV 和密文
            const iv = combined.slice(0, 12);
            const encryptedData = combined.slice(12);

            const decryptedBuffer = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                key,
                encryptedData
            );

            const decoder = new TextDecoder();
            return decoder.decode(decryptedBuffer);
        } catch (error) {
            console.error('[CryptoManager] 解密失败:', error);
            throw new TCErrors.CryptoError('解密失败', error);
        }
    }

    /**
     * 加密对象（JSON 序列化后加密）
     * @param {Object} obj - 要加密的对象
     * @returns {Promise<string>} Base64 编码的密文
     */
    async encryptObject(obj) {
        const json = JSON.stringify(obj);
        return await this.encrypt(json);
    }

    /**
     * 解密对象（解密后 JSON 解析）
     * @param {string} encryptedBase64 - Base64 编码的密文
     * @returns {Promise<Object>} 解密后的对象
     */
    async decryptObject(encryptedBase64) {
        if (!encryptedBase64) {
            return null;
        }
        const json = await this.decrypt(encryptedBase64);
        return JSON.parse(json);
    }

    /**
     * 加密文件（ArrayBuffer）
     * @param {ArrayBuffer} arrayBuffer - 文件内容
     * @returns {Promise<Uint8Array>} 加密后的字节数组
     */
    async encryptFile(arrayBuffer) {
        if (!this.encryptionKey) {
            throw new TCErrors.CryptoError('加密密钥未初始化');
        }

        const key = await this.deriveKey(this.encryptionKey);
        const iv = crypto.getRandomValues(new Uint8Array(12));

        const encryptedBuffer = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            arrayBuffer
        );

        // 合并 IV 和密文
        const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encryptedBuffer), iv.length);

        return combined;
    }

    /**
     * 解密文件（返回 ArrayBuffer）
     * @param {Uint8Array} encryptedBytes - 加密的字节数组
     * @returns {Promise<ArrayBuffer>} 解密后的文件内容
     */
    async decryptFile(encryptedBytes) {
        if (!this.encryptionKey) {
            throw new TCErrors.CryptoError('加密密钥未初始化');
        }

        const key = await this.deriveKey(this.encryptionKey);

        // 分离 IV 和密文
        const iv = encryptedBytes.slice(0, 12);
        const encryptedData = encryptedBytes.slice(12);

        return await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            encryptedData
        );
    }

    /**
     * 生成搜索摘要（用于加密字段的搜索）
     * @param {string} text - 原始文本
     * @returns {string} 归一化的搜索摘要
     */
    createSearchDigest(text) {
        if (!text) return '';
        return text.toLowerCase().trim().replace(/\s+/g, ' ');
    }

    /**
     * 加密或创建索引（用于需要搜索的字段）
     * @param {string} text - 原始文本
     * @returns {Promise<Object>} { encrypted, digest }
     */
    async encryptWithIndex(text) {
        const encrypted = await this.encrypt(text);
        const digest = this.createSearchDigest(text);
        return { encrypted, digest };
    }
}

// 导出
window.TCCryptoManager = CryptoManager;

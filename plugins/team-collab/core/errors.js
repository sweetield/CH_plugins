/**
 * 团队协作插件 - 错误类定义
 */

class TCError extends Error {
    constructor(message, code, details = null) {
        super(message);
        this.name = 'TCError';
        this.code = code;
        this.details = details;
    }
}

// 权限错误
class PermissionError extends TCError {
    constructor(message, details = null) {
        super(message, 'PERMISSION_DENIED', details);
        this.name = 'PermissionError';
    }
}

// 存储错误
class StorageError extends TCError {
    constructor(message, details = null) {
        super(message, 'STORAGE_ERROR', details);
        this.name = 'StorageError';
    }
}

// 加密错误
class CryptoError extends TCError {
    constructor(message, details = null) {
        super(message, 'CRYPTO_ERROR', details);
        this.name = 'CryptoError';
    }
}

// 验证错误
class ValidationError extends TCError {
    constructor(message, details = null) {
        super(message, 'VALIDATION_ERROR', details);
        this.name = 'ValidationError';
    }
}

// 邀请码错误
class InviteError extends TCError {
    constructor(message, details = null) {
        super(message, 'INVITE_ERROR', details);
        this.name = 'InviteError';
    }
}

// 导入导出错误
class ImportExportError extends TCError {
    constructor(message, details = null) {
        super(message, 'IMPORT_EXPORT_ERROR', details);
        this.name = 'ImportExportError';
    }
}

// 冲突错误
class ConflictError extends TCError {
    constructor(message, details = null) {
        super(message, 'CONFLICT_ERROR', details);
        this.name = 'ConflictError';
    }
}

// 导出
window.TCErrors = {
    TCError,
    PermissionError,
    StorageError,
    CryptoError,
    ValidationError,
    InviteError,
    ImportExportError,
    ConflictError
};

"use strict";
// ===== 第二步：创建用户模型 =====
// src/models/user.model.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserStatus = exports.UserRole = void 0;
const mongoose_1 = __importStar(require("mongoose"));
// 用户角色枚举
var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "admin";
    UserRole["MANAGER"] = "manager";
    UserRole["TRANSLATOR"] = "translator";
    UserRole["REVIEWER"] = "reviewer";
    UserRole["GUEST"] = "guest";
})(UserRole || (exports.UserRole = UserRole = {}));
// 用户状态枚举
var UserStatus;
(function (UserStatus) {
    UserStatus["ACTIVE"] = "active";
    UserStatus["INACTIVE"] = "inactive";
})(UserStatus || (exports.UserStatus = UserStatus = {}));
// 用户Schema
const userSchema = new mongoose_1.Schema({
    username: {
        type: String,
        required: [true, '用户名不能为空'],
        unique: true,
        trim: true,
        index: true
    },
    email: {
        type: String,
        required: [true, '邮箱不能为空'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, '请输入有效的邮箱地址'],
        index: true
    },
    password: {
        type: String,
        required: [true, '密码不能为空'],
        minlength: [6, '密码长度不能小于6位'],
        select: false
    },
    role: {
        type: String,
        enum: Object.values(UserRole),
        default: UserRole.TRANSLATOR
    },
    status: {
        type: String,
        enum: Object.values(UserStatus),
        default: UserStatus.ACTIVE
    },
    refreshToken: {
        type: String,
        default: undefined
    },
    fullName: {
        type: String
    },
    active: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date
    }
}, {
    timestamps: true
});
const User = mongoose_1.default.model('User', userSchema);
exports.default = User;

"use strict";
// ===== 第二步：创建用户模型 =====
// src/models/user.model.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserStatus = exports.UserRole = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
// 用户角色枚举
var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "admin";
    UserRole["TRANSLATOR"] = "translator";
    UserRole["REVIEWER"] = "reviewer";
})(UserRole || (exports.UserRole = UserRole = {}));
// 用户状态枚举
var UserStatus;
(function (UserStatus) {
    UserStatus["ACTIVE"] = "active";
    UserStatus["INACTIVE"] = "inactive";
})(UserStatus || (exports.UserStatus = UserStatus = {}));
// 用户Schema
const userSchema = new mongoose_1.default.Schema({
    username: {
        type: String,
        required: [true, '用户名不能为空'],
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: [true, '邮箱不能为空'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, '请输入有效的邮箱地址']
    },
    password: {
        type: String,
        required: [true, '密码不能为空'],
        minlength: [6, '密码长度不能小于6位']
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
    }
}, {
    timestamps: true
});
// 密码加密中间件
userSchema.pre('save', async function (next) {
    if (!this.isModified('password'))
        return next();
    try {
        const salt = await bcryptjs_1.default.genSalt(10);
        this.password = await bcryptjs_1.default.hash(this.password, salt);
        next();
    }
    catch (error) {
        next(error);
    }
});
// 密码比较方法
userSchema.methods.comparePassword = async function (candidatePassword) {
    try {
        return await bcryptjs_1.default.compare(candidatePassword, this.password);
    }
    catch (error) {
        throw error;
    }
};
const User = mongoose_1.default.model('User', userSchema);
exports.default = User;

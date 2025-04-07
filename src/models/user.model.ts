// ===== 第二步：创建用户模型 =====
// src/models/user.model.ts

import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

// 用户角色枚举
export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  TRANSLATOR = 'translator',
  REVIEWER = 'reviewer',
  GUEST = 'guest'
}

// 用户状态枚举
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive'
}

// 用户接口
export interface IUser extends Document {
  username: string;
  email: string;
  password?: string;
  role: UserRole;
  status: UserStatus;
  refreshToken?: string;
  fullName?: string;
  active?: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
}

// 用户Schema
const userSchema = new Schema<IUser>({
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

const User = mongoose.model<IUser>('User', userSchema);

export default User;

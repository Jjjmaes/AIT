// ===== 第二步：创建用户模型 =====
// src/models/user.model.ts

import mongoose, { Document } from 'mongoose';
import bcrypt from 'bcryptjs';

// 用户角色枚举
export enum UserRole {
  ADMIN = 'admin',
  TRANSLATOR = 'translator',
  REVIEWER = 'reviewer'
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
  password: string;
  role: UserRole;
  status: UserStatus;
  refreshToken?: string;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// 用户Schema
const userSchema = new mongoose.Schema<IUser>({
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
  },
  refreshToken: {
    type: String,
    default: undefined
  }
}, {
  timestamps: true
});

// 密码加密中间件
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// 密码比较方法
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

const User = mongoose.model<IUser>('User', userSchema);

export default User;

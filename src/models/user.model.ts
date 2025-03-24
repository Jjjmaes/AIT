// ===== 第二步：创建用户模型 =====
// src/models/user.model.ts

import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcrypt';

export enum UserRole {
  ADMIN = 'admin',
  REVIEWER = 'reviewer'
}

interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    password: {
      type: String,
      required: true,
      select: false // 默认查询不返回密码
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.REVIEWER
    }
  },
  {
    timestamps: true
  }
);

// 密码加密中间件
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (error) {
    return next(error as Error);
  }
});

// 密码比较方法
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// 导出用户模型
const User = mongoose.model<IUser>('User', userSchema);
export default User;

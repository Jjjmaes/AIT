import User, { IUser } from '../models/user.model';
import { AppError } from '../utils/errors';
import { sign, verify } from 'jsonwebtoken';
import bcrypt from 'bcrypt';

export interface RegisterDTO {
  username: string;
  email: string;
  password: string;
  role?: string;
}

export interface LoginResponse {
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  private readonly JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
  private readonly JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
  private readonly JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

  async register(data: RegisterDTO): Promise<IUser> {
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      throw new AppError(
        '该邮箱已被注册',
        400
      );
    }

    const user = new User(data);
    await user.save();

    return user;
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const user = await User.findOne({ email });
    if (!user) {
      throw new AppError(
        '邮箱或密码错误',
        401
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new AppError(
        '邮箱或密码错误',
        401
      );
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save();

    return {
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role
      },
      accessToken,
      refreshToken
    };
  }

  async refreshToken(token: string): Promise<{ accessToken: string }> {
    try {
      // @ts-ignore
      const decoded = verify(token, this.JWT_REFRESH_SECRET) as any;
      const user = await User.findById(decoded.id);

      if (!user || user.refreshToken !== token) {
        throw new AppError(
          'Invalid refresh token',
          401
        );
      }

      const accessToken = this.generateAccessToken(user);
      return { accessToken };
    } catch (error) {
      throw new AppError(
        'Invalid refresh token',
        401
      );
    }
  }

  async logout(token: string): Promise<void> {
    try {
      // @ts-ignore
      const decoded = verify(token, this.JWT_REFRESH_SECRET) as any;
      const user = await User.findById(decoded.id);

      if (user) {
        user.refreshToken = undefined;
        await user.save();
      }
    } catch (error) {
      throw new AppError(
        'Invalid refresh token',
        401
      );
    }
  }

  private generateAccessToken(user: IUser): string {
    // @ts-ignore
    return sign(
      { id: user._id, role: user.role },
      this.JWT_SECRET,
      { expiresIn: this.JWT_EXPIRES_IN }
    );
  }

  private generateRefreshToken(user: IUser): string {
    // @ts-ignore
    return sign(
      { id: user._id },
      this.JWT_REFRESH_SECRET,
      { expiresIn: this.JWT_REFRESH_EXPIRES_IN }
    );
  }
} 
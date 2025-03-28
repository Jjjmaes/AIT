export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  TRANSLATOR = 'translator',
  REVIEWER = 'reviewer'
}

export interface IUser {
  id: string;
  email: string;
  role: UserRole;
  username: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RegisterUserDto {
  username: string;
  email: string;
  password: string;
  role?: UserRole;
}

export interface LoginUserDto {
  email: string;
  password: string;
}

export interface UpdateUserDto {
  username?: string;
  email?: string;
  role?: UserRole;
  avatar?: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
} 
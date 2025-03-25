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
  name?: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
} 
import { z } from 'zod';

// MongoDB ID 验证
export const mongoIdSchema = z.string()
  .min(1, 'ID不能为空')
  .regex(/^[0-9a-fA-F]{24}$/, 'ID格式无效');

// 分页参数验证
export const paginationSchema = z.object({
  page: z.number()
    .int('页码必须是整数')
    .min(1, '页码必须大于0')
    .optional(),
  limit: z.number()
    .int('每页数量必须是整数')
    .min(1, '每页数量必须大于0')
    .max(100, '每页数量不能超过100')
    .optional()
});

// 创建枚举验证器
export const createEnumValidator = <T extends string>(enumObj: { [key: string]: T }) => {
  return z.enum(Object.values(enumObj) as [T, ...T[]]);
}; 
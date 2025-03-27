"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEnumValidator = exports.paginationSchema = exports.mongoIdSchema = void 0;
const zod_1 = require("zod");
// MongoDB ID 验证
exports.mongoIdSchema = zod_1.z.string()
    .min(1, 'ID不能为空')
    .regex(/^[0-9a-fA-F]{24}$/, 'ID格式无效');
// 分页参数验证
exports.paginationSchema = zod_1.z.object({
    page: zod_1.z.number()
        .int('页码必须是整数')
        .min(1, '页码必须大于0')
        .optional(),
    limit: zod_1.z.number()
        .int('每页数量必须是整数')
        .min(1, '每页数量必须大于0')
        .max(100, '每页数量不能超过100')
        .optional()
});
// 创建枚举验证器
const createEnumValidator = (enumObj) => {
    return zod_1.z.enum(Object.values(enumObj));
};
exports.createEnumValidator = createEnumValidator;

"use strict";
// ===== 第七步：创建请求验证中间件 =====
// src/middleware/validate.middleware.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = void 0;
const errors_1 = require("../utils/errors");
const validateRequest = (schema) => {
    return async (req, res, next) => {
        try {
            await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params
            });
            next();
        }
        catch (error) {
            next(new errors_1.ValidationError('请求参数验证失败'));
        }
    };
};
exports.validateRequest = validateRequest;

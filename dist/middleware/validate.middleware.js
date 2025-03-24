"use strict";
// ===== 第七步：创建请求验证中间件 =====
// src/middleware/validate.middleware.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const express_validator_1 = require("express-validator");
const error_middleware_1 = require("./error.middleware");
const validate = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        const message = errors.array().map(err => `${err.msg}`).join(', ');
        return next(new error_middleware_1.ApiError(400, message));
    }
    next();
};
exports.validate = validate;

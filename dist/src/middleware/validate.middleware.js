"use strict";
// ===== 第七步：创建请求验证中间件 =====
// src/middleware/validate.middleware.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = void 0;
const zod_1 = require("zod");
const errors_1 = require("../utils/errors");
const validateRequest = (schema) => {
    return async (req, res, next) => {
        try {
            // Assume schema primarily validates the body for POST/PUT/PATCH
            // If validation needs query/params too, this needs adjustment based on schema structure
            await schema.parseAsync(req.body);
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                const errorMessage = JSON.stringify(error.flatten());
                next(new errors_1.ValidationError(errorMessage));
            }
            else {
                next(error);
            }
        }
    };
};
exports.validateRequest = validateRequest;

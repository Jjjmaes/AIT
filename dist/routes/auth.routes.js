"use strict";
// ===== 第九步：创建身份验证路由 =====
// src/routes/auth.routes.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = __importDefault(require("../controllers/auth.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const authValidator_1 = require("../validators/authValidator");
const validate_middleware_1 = require("../middleware/validate.middleware");
const router = (0, express_1.Router)();
// 用户注册
router.post('/register', authValidator_1.validateRegister, validate_middleware_1.validate, auth_controller_1.default.register);
// 用户登录
router.post('/login', authValidator_1.validateLogin, validate_middleware_1.validate, auth_controller_1.default.login);
// 获取当前用户信息
router.get('/profile', auth_middleware_1.authenticateJwt, auth_controller_1.default.getCurrentUser);
// 用户登出
router.post('/logout', auth_middleware_1.authenticateJwt, auth_controller_1.default.logout);
exports.default = router;

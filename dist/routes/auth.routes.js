"use strict";
// ===== 第九步：创建身份验证路由 =====
// src/routes/auth.routes.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = __importDefault(require("../controllers/auth.controller"));
const authValidator_1 = require("../validators/authValidator");
const validate_middleware_1 = require("../middleware/validate.middleware");
const router = (0, express_1.Router)();
// 用户注册
router.post('/register', (0, validate_middleware_1.validateRequest)(authValidator_1.validateRegister), auth_controller_1.default.register);
// 用户登录
router.post('/login', (0, validate_middleware_1.validateRequest)(authValidator_1.validateLogin), auth_controller_1.default.login);
// 用户登出
router.post('/logout', auth_controller_1.default.logout);
exports.default = router;

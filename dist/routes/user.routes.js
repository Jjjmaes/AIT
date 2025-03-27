"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const auth_controller_1 = __importDefault(require("../controllers/auth.controller"));
const userValidator_1 = require("../validators/userValidator");
const validate_middleware_1 = require("../middleware/validate.middleware");
const router = (0, express_1.Router)();
// 获取用户资料
router.get('/profile', auth_middleware_1.authenticateJwt, auth_controller_1.default.getCurrentUser);
// 更新用户信息
router.put('/profile', auth_middleware_1.authenticateJwt, (0, validate_middleware_1.validateRequest)(userValidator_1.validateUpdateUser), auth_controller_1.default.updateProfile);
// 修改密码
router.put('/password', auth_middleware_1.authenticateJwt, (0, validate_middleware_1.validateRequest)(userValidator_1.validateChangePassword), auth_controller_1.default.changePassword);
exports.default = router;

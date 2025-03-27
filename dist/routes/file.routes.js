"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const file_controller_1 = __importDefault(require("../controllers/file.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const fileValidator_1 = require("../validators/fileValidator");
const router = (0, express_1.Router)();
// 文件处理路由
router.post('/:fileId/process', auth_middleware_1.authenticateJwt, (0, validate_middleware_1.validateRequest)(fileValidator_1.validateProcessFile), file_controller_1.default.processFile);
router.get('/:fileId/segments', auth_middleware_1.authenticateJwt, file_controller_1.default.getFileSegments);
// 更新文件进度
router.put('/:fileId/progress', auth_middleware_1.authenticateJwt, (0, validate_middleware_1.validateRequest)(fileValidator_1.validateUpdateFileProgress), file_controller_1.default.updateFileProgress);
exports.default = router;

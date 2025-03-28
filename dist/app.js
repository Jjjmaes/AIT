"use strict";
// src/app.ts - 配置应用但不启动服务器
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const project_routes_1 = __importDefault(require("./routes/project.routes"));
const file_routes_1 = __importDefault(require("./routes/file.routes"));
const review_routes_1 = __importDefault(require("./routes/review.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const error_middleware_1 = require("./middleware/error.middleware");
// 创建Express应用
const app = (0, express_1.default)();
// 中间件
app.use((0, cors_1.default)());
app.use((0, helmet_1.default)());
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// 路由
app.use('/api/auth', auth_routes_1.default);
app.use('/api/users', user_routes_1.default);
app.use('/api/projects', project_routes_1.default);
app.use('/api/files', file_routes_1.default);
app.use('/api/review', review_routes_1.default);
app.use('/api/notifications', notification_routes_1.default);
// 404处理
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `无法找到路径: ${req.originalUrl}`
    });
});
// 错误处理中间件
app.use(error_middleware_1.errorHandler);
exports.default = app;

"use strict";
// src/index.ts - 处理服务器启动
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const app_1 = __importDefault(require("./app"));
const http_1 = __importDefault(require("http"));
// 加载环境变量
dotenv_1.default.config();
// 获取环境变量
const DEFAULT_PORT = parseInt(process.env.PORT || '5000', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/translation-platform';
// 创建HTTP服务器
const server = http_1.default.createServer(app_1.default);
// 检查端口是否可用
const checkPort = (port) => {
    return new Promise((resolve) => {
        const testServer = http_1.default.createServer();
        testServer.listen(port, () => {
            testServer.close();
            resolve(true);
        });
        testServer.on('error', () => {
            resolve(false);
        });
    });
};
// 查找可用端口
const findAvailablePort = async (startPort) => {
    let port = startPort;
    while (port < startPort + 10) { // 尝试10个端口
        const isAvailable = await checkPort(port);
        if (isAvailable) {
            return port;
        }
        port++;
    }
    throw new Error(`无法找到可用端口 (${startPort}-${port - 1})`);
};
// 连接数据库并启动服务器
const startServer = async () => {
    try {
        // 查找可用端口
        const port = await findAvailablePort(DEFAULT_PORT);
        // 连接数据库
        await mongoose_1.default.connect(MONGODB_URI);
        console.log('连接到MongoDB成功');
        // 启动服务器
        server.listen(port, () => {
            console.log(`服务器运行在端口: ${port}`);
        });
        // 处理服务器错误
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`端口 ${port} 已被占用，正在尝试其他端口...`);
                startServer(); // 递归尝试其他端口
            }
            else {
                console.error('服务器错误:', error);
            }
        });
    }
    catch (error) {
        console.error('启动服务器失败:', error);
        process.exit(1);
    }
};
// 启动服务器
startServer();
// 优雅关闭
const gracefulShutdown = async () => {
    try {
        // 关闭服务器
        server.close(() => {
            console.log('HTTP服务器已关闭');
        });
        // 关闭数据库连接
        await mongoose_1.default.connection.close();
        console.log('MongoDB连接已关闭');
        process.exit(0);
    }
    catch (err) {
        console.error('关闭服务器时出错:', err);
        process.exit(1);
    }
};
// 处理进程信号
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

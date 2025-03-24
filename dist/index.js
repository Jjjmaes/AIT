"use strict";
// src/index.ts - 处理服务器启动
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const app_1 = __importDefault(require("./app"));
// 加载环境变量
dotenv_1.default.config();
// 获取环境变量
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/translation-platform';
// 连接数据库并启动服务器
const startServer = async () => {
    try {
        await mongoose_1.default.connect(MONGODB_URI);
        console.log('连接到MongoDB成功');
        app_1.default.listen(PORT, () => {
            console.log(`服务器运行在端口: ${PORT}`);
        });
    }
    catch (error) {
        console.error('连接到MongoDB失败:', error);
        process.exit(1);
    }
};
// 启动服务器
startServer();
// 优雅关闭
process.on('SIGINT', async () => {
    try {
        await mongoose_1.default.connection.close();
        console.log('MongoDB连接已关闭');
        process.exit(0);
    }
    catch (err) {
        console.error('关闭MongoDB连接时出错:', err);
        process.exit(1);
    }
});

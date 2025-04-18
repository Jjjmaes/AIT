"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const connectDB = async () => {
    try {
        await mongoose_1.default.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/translation-platform');
        console.log('连接到MongoDB成功');
        // 监听MongoDB连接事件
        mongoose_1.default.connection.on('error', (err) => {
            console.error(`MongoDB connection error: ${err}`);
        });
        mongoose_1.default.connection.on('disconnected', () => {
            console.warn('MongoDB disconnected. Attempting to reconnect...');
        });
        mongoose_1.default.connection.on('reconnected', () => {
            console.log('MongoDB reconnected');
        });
    }
    catch (error) {
        console.error('连接到MongoDB失败:', error);
        process.exit(1);
    }
};
exports.default = connectDB;

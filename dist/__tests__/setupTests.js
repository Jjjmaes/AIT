"use strict";
/**
 * 测试环境设置文件
 *
 * 该文件在运行测试前由Jest加载，用于配置测试环境
 */
Object.defineProperty(exports, "__esModule", { value: true });
// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'dummy-api-key-for-testing';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.MONGODB_URI = 'mongodb://localhost:27017/translation-platform-test';
// 设置超时时间
jest.setTimeout(10000);
// 模拟外部依赖
jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
}));
// 清理测试状态
afterEach(() => {
    jest.clearAllMocks();
});
// 全局测试结束后清理
afterAll(async () => {
    // 关闭可能的数据库连接、清理资源等
    await new Promise(resolve => setTimeout(resolve, 500));
});

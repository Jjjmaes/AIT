"use strict";
/**
 * 翻译模块测试集
 *
 * 这个脚本运行翻译服务相关的所有单元测试
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// 设置环境变量
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'dummy-api-key-for-testing';
const promises_1 = require("fs/promises");
const path_1 = __importDefault(require("path"));
// 测试套件
const testRunner = async () => {
    console.log('正在运行翻译模块测试...');
    // 确保测试文件夹存在
    try {
        await (0, promises_1.mkdir)(path_1.default.join(process.cwd(), 'test-results'), { recursive: true });
    }
    catch (error) {
        console.warn('创建测试结果目录失败', error);
    }
    // 运行测试
    try {
        // 记录测试开始
        const startTime = Date.now();
        // 导入并运行各个测试套件
        await Promise.resolve().then(() => __importStar(require('./services/translation.service.test')));
        await Promise.resolve().then(() => __importStar(require('./services/openai-adapter.test')));
        await Promise.resolve().then(() => __importStar(require('./services/file-translation.test')));
        // 计算测试时间
        const endTime = Date.now();
        const testDuration = ((endTime - startTime) / 1000).toFixed(2);
        // 输出测试结果摘要
        const testSummary = `
翻译模块测试完成
------------------------
测试时间: ${testDuration}秒
测试套件: 3
------------------------
`;
        console.log(testSummary);
        // 保存测试摘要到文件
        try {
            await (0, promises_1.writeFile)(path_1.default.join(process.cwd(), 'test-results', 'translation-tests.log'), `测试运行于 ${new Date().toISOString()}\n${testSummary}`);
        }
        catch (error) {
            console.warn('保存测试日志失败', error);
        }
    }
    catch (error) {
        console.error('测试执行失败:', error);
        process.exit(1);
    }
};
// 运行测试
testRunner().catch(error => {
    console.error('测试运行器失败:', error);
    process.exit(1);
});

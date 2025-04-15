"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
// 加载测试环境变量
dotenv_1.default.config({ path: '.env.test' });
// 设置测试超时时间
jest.setTimeout(10000);
// 全局测试设置
beforeAll(() => {
    // 在这里添加测试前的全局设置
});
afterAll(() => {
    // 在这里添加测试后的清理工作
});

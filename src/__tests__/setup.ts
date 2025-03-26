import dotenv from 'dotenv';

// 加载测试环境变量
dotenv.config({ path: '.env.test' });

// 设置测试超时时间
jest.setTimeout(10000);

// 全局测试设置
beforeAll(() => {
  // 在这里添加测试前的全局设置
});

afterAll(() => {
  // 在这里添加测试后的清理工作
}); 
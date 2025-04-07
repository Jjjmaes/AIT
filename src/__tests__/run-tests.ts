/**
 * 翻译模块测试集
 * 
 * 这个脚本运行翻译服务相关的所有单元测试
 */

// 设置环境变量
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'dummy-api-key-for-testing';

import { describe, beforeAll, afterAll } from '@jest/globals';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

// 测试套件
const testRunner = async () => {
  console.log('正在运行翻译模块测试...');
  
  // 确保测试文件夹存在
  try {
    await mkdir(path.join(process.cwd(), 'test-results'), { recursive: true });
  } catch (error) {
    console.warn('创建测试结果目录失败', error);
  }
  
  // 运行测试
  try {
    // 记录测试开始
    const startTime = Date.now();
    
    // 导入并运行各个测试套件
    await import('./services/translation.service.test');
    await import('./services/openai-adapter.test');
    await import('./services/file-translation.test');
    
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
      await writeFile(
        path.join(process.cwd(), 'test-results', 'translation-tests.log'),
        `测试运行于 ${new Date().toISOString()}\n${testSummary}`
      );
    } catch (error) {
      console.warn('保存测试日志失败', error);
    }
    
  } catch (error) {
    console.error('测试执行失败:', error);
    process.exit(1);
  }
};

// 运行测试
testRunner().catch(error => {
  console.error('测试运行器失败:', error);
  process.exit(1);
}); 
import 'reflect-metadata'; // Needs to be imported once at the very top
// src/index.ts - 处理服务器启动

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import app from './app';
import http from 'http';

// 加载环境变量
dotenv.config();

// 获取环境变量
const DEFAULT_PORT = parseInt(process.env.PORT || '5000', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/translation-platform';

// 创建HTTP服务器
const server = http.createServer(app);

// 检查端口是否可用
const checkPort = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const testServer = http.createServer();
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
const findAvailablePort = async (startPort: number): Promise<number> => {
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
    await mongoose.connect(MONGODB_URI);
    console.log('连接到MongoDB成功');
    
    // 启动服务器
    server.listen(port, () => {
      console.log(`服务器运行在端口: ${port}`);
    });

    // 处理服务器错误
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`端口 ${port} 已被占用，正在尝试其他端口...`);
        startServer(); // 递归尝试其他端口
      } else {
        console.error('服务器错误:', error);
      }
    });
  } catch (error) {
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
    await mongoose.connection.close();
    console.log('MongoDB连接已关闭');
    process.exit(0);
  } catch (err) {
    console.error('关闭服务器时出错:', err);
    process.exit(1);
  }
};

// 处理进程信号
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
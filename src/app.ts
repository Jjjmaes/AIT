// src/app.ts - 配置应用但不启动服务器

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import projectRoutes from './routes/project.routes';
import fileRoutes from './routes/file.routes';
import reviewRoutes from './routes/review.routes';
import notificationRoutes from './routes/notification.routes';
import promptTemplateRoutes from './routes/promptTemplate.routes';
import terminologyRoutes from './routes/terminology.routes';
import translationMemoryRoutes from './routes/translationMemory.routes';
import { errorHandler } from './middleware/error.middleware';

// 创建Express应用
const app = express();

// 中间件
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/prompts', promptTemplateRoutes);
app.use('/api/terms', terminologyRoutes);
app.use('/api/v1/tm', translationMemoryRoutes);

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `无法找到路径: ${req.originalUrl}`
  });
});

// 错误处理中间件
app.use(errorHandler);

export default app;
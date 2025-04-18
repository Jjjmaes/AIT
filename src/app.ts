// src/app.ts - 配置应用但不启动服务器

import express, { Response } from 'express'; // Import Response
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import logger from './utils/logger'; // Ensure logger is imported
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import projectRoutes from './routes/project.routes';
import fileRoutes from './routes/file.routes';
import reviewRoutes from './routes/review.routes';
import notificationRoutes from './routes/notification.routes';
import promptTemplateRoutes from './routes/promptTemplate.routes';
import terminologyRoutes from './routes/terminology.routes';
import translationMemoryRoutes from './routes/translationMemory.routes';
import aiConfigRoutes from './routes/aiConfig.routes';
import { errorHandler } from './middleware/error.middleware';
import { authenticateJwt } from './middleware/auth.middleware'; // Corrected casing

// --- SSE Client Management --- 
// Store active SSE client connections (Map: userId -> Express Response)
// NOTE: In a production/multi-instance setup, this in-memory store
// would need to be replaced with something more robust like Redis Pub/Sub.
const sseClients = new Map<string, Response>();

// Function to send SSE updates to a specific user (EXPORTED)
export function sendSseUpdate(userId: string, eventName: string, data: any) {
  const clientRes = sseClients.get(userId);
  if (clientRes) {
    // Format according to SSE spec: event name + JSON data
    clientRes.write(`event: ${eventName}\n`);
    clientRes.write(`data: ${JSON.stringify(data)}\n\n`); // Note the double newline
    logger.debug(`Sent SSE event '${eventName}' to user ${userId}`);
  } else {
    // Add explicit logging when client is not found
    logger.warn(`SSE client for user ${userId} not found. Unable to send event '${eventName}'.`); 
  }
}
// --- End SSE Client Management ---

// 创建Express应用
const app = express();

// --- Add Entry Logging Middleware ---
app.use((req, res, next) => {
  logger.info(`[ENTRY] Received request: ${req.method} ${req.originalUrl}`);
  // Optionally log headers if needed for deep debugging:
  // logger.debug(`[ENTRY] Headers: ${JSON.stringify(req.headers)}`);
  next();
});
// --- End Entry Logging ---

// 中间件
// Configure CORS to allow requests from the frontend development server
const corsOptions = {
  origin: 'http://localhost:5174', // Your frontend origin
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true, // Allow cookies if needed
  optionsSuccessStatus: 204 // Some legacy browsers choke on 204
};
app.use(cors(corsOptions));

app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 路由
app.use('/api/auth', authRoutes);

// Routes requiring authentication (Apply JWT middleware before these)
// Assuming authenticateJwt populates req.user
app.use('/api/users', authenticateJwt, userRoutes);
app.use('/api/projects', authenticateJwt, projectRoutes);
app.use('/api/files', authenticateJwt, fileRoutes);
app.use('/api/ai-configs', authenticateJwt, aiConfigRoutes);
app.use('/api/review', authenticateJwt, reviewRoutes);
app.use('/api/notifications', authenticateJwt, notificationRoutes);
app.use('/api/prompts', authenticateJwt, promptTemplateRoutes);
app.use('/api/terms', authenticateJwt, terminologyRoutes);
app.use('/api/v1/tm', authenticateJwt, translationMemoryRoutes);

// --- SSE Endpoint (Requires Authentication) ---
app.get('/api/sse/updates', authenticateJwt, (req: any, res) => { // Corrected casing
  // User should be populated by authenticateJwt middleware
  if (!req.user || !req.user.id) {
      logger.error('SSE connection attempt without authentication.');
      return res.status(401).json({ message: 'Authentication required for SSE.' });
  }
  const userId = req.user.id.toString(); // Ensure userId is string

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Useful when behind Nginx
  res.flushHeaders(); // Flush headers to establish connection

  // Store the client's response object
  sseClients.set(userId, res);
  logger.info(`SSE Client connected: User ${userId}`);

  // Handle client disconnect
  req.on('close', () => {
    sseClients.delete(userId);
    logger.info(`SSE Client disconnected: User ${userId}`);
    res.end(); 
  });

  // Send a heartbeat comment every 30 seconds
  const heartbeatInterval = setInterval(() => {
       if (sseClients.has(userId)) {
           res.write(': heartbeat\n\n'); 
       } else {
           clearInterval(heartbeatInterval); // Stop if client disconnected
       }
  }, 30000); 
});

// --- End SSE Endpoint ---

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
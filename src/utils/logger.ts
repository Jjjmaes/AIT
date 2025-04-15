import winston from 'winston';
import path from 'path';

const logDir = 'logs';

const logger = winston.createLogger({
  // Set default level to 'debug' for development, use LOG_LEVEL env var otherwise
  level: process.env.LOG_LEVEL || 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // 写入所有日志到 combined.log
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // 写入所有错误日志到 error.log
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// 在非生产环境下，同时输出到控制台
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    // Use JSON format for console in dev to see all log arguments
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // Add a readable timestamp
      winston.format.json()
    )
  }));
}

export default logger; 
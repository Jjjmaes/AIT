"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const logDir = 'logs';
const logger = winston_1.default.createLogger({
    // Set default level to 'debug' for development, use LOG_LEVEL env var otherwise
    level: process.env.LOG_LEVEL || 'debug',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
    transports: [
        // 写入所有日志到 combined.log
        new winston_1.default.transports.File({
            filename: path_1.default.join(logDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        // 写入所有错误日志到 error.log
        new winston_1.default.transports.File({
            filename: path_1.default.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ]
});
// 在非生产环境下，同时输出到控制台
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston_1.default.transports.Console({
        // Use JSON format for console in dev to see all log arguments
        format: winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // Add a readable timestamp
        winston_1.default.format.json())
    }));
}
exports.default = logger;

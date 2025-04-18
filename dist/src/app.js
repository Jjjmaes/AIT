"use strict";
// src/app.ts - 配置应用但不启动服务器
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSseUpdate = sendSseUpdate;
const express_1 = __importDefault(require("express")); // Import Response
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const logger_1 = __importDefault(require("./utils/logger")); // Ensure logger is imported
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const project_routes_1 = __importDefault(require("./routes/project.routes"));
const file_routes_1 = __importDefault(require("./routes/file.routes"));
const review_routes_1 = __importDefault(require("./routes/review.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const promptTemplate_routes_1 = __importDefault(require("./routes/promptTemplate.routes"));
const terminology_routes_1 = __importDefault(require("./routes/terminology.routes"));
const translationMemory_routes_1 = __importDefault(require("./routes/translationMemory.routes"));
const aiConfig_routes_1 = __importDefault(require("./routes/aiConfig.routes"));
const translation_routes_1 = __importDefault(require("./routes/translation.routes"));
const error_middleware_1 = require("./middleware/error.middleware");
const auth_middleware_1 = require("./middleware/auth.middleware"); // Corrected casing
// --- SSE Client Management --- 
// Store active SSE client connections (Map: userId -> Express Response)
// NOTE: In a production/multi-instance setup, this in-memory store
// would need to be replaced with something more robust like Redis Pub/Sub.
const sseClients = new Map();
// Function to send SSE updates to a specific user (EXPORTED)
function sendSseUpdate(userId, eventName, data) {
    const clientRes = sseClients.get(userId);
    if (clientRes) {
        // Format according to SSE spec: event name + JSON data
        clientRes.write(`event: ${eventName}\n`);
        clientRes.write(`data: ${JSON.stringify(data)}\n\n`); // Note the double newline
        logger_1.default.debug(`Sent SSE event '${eventName}' to user ${userId}`);
    }
    else {
        // Add explicit logging when client is not found
        logger_1.default.warn(`SSE client for user ${userId} not found. Unable to send event '${eventName}'.`);
    }
}
// --- End SSE Client Management ---
// 创建Express应用
const app = (0, express_1.default)();
// --- Add Entry Logging Middleware ---
app.use((req, res, next) => {
    logger_1.default.info(`[ENTRY] Received request: ${req.method} ${req.originalUrl}`);
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
app.use((0, cors_1.default)(corsOptions));
app.use((0, helmet_1.default)());
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// 路由
app.use('/api/auth', auth_routes_1.default);
// Routes requiring authentication (Apply JWT middleware before these)
// Assuming authenticateJwt populates req.user
app.use('/api/users', auth_middleware_1.authenticateJwt, user_routes_1.default);
app.use('/api/projects', auth_middleware_1.authenticateJwt, project_routes_1.default);
app.use('/api/files', auth_middleware_1.authenticateJwt, file_routes_1.default);
app.use('/api/ai-configs', auth_middleware_1.authenticateJwt, aiConfig_routes_1.default);
app.use('/api/review', auth_middleware_1.authenticateJwt, review_routes_1.default);
app.use('/api/notifications', auth_middleware_1.authenticateJwt, notification_routes_1.default);
app.use('/api/prompts', auth_middleware_1.authenticateJwt, promptTemplate_routes_1.default);
app.use('/api/terms', auth_middleware_1.authenticateJwt, terminology_routes_1.default);
app.use('/api/v1/tm', auth_middleware_1.authenticateJwt, translationMemory_routes_1.default);
app.use('/api/translation', auth_middleware_1.authenticateJwt, translation_routes_1.default);
// --- SSE Endpoint (Requires Authentication) ---
app.get('/api/sse/updates', auth_middleware_1.authenticateJwt, (req, res) => {
    // User should be populated by authenticateJwt middleware
    if (!req.user || !req.user.id) {
        logger_1.default.error('SSE connection attempt without authentication.');
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
    logger_1.default.info(`SSE Client connected: User ${userId}`);
    // Handle client disconnect
    req.on('close', () => {
        sseClients.delete(userId);
        logger_1.default.info(`SSE Client disconnected: User ${userId}`);
        res.end();
    });
    // Send a heartbeat comment every 30 seconds
    const heartbeatInterval = setInterval(() => {
        if (sseClients.has(userId)) {
            res.write(': heartbeat\n\n');
        }
        else {
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
app.use(error_middleware_1.errorHandler);
exports.default = app;

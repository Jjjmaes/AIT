"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    port: process.env.PORT || 3000,
    mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/translation-platform',
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    aws: {
        region: process.env.AWS_REGION || 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        bucketName: process.env.AWS_BUCKET_NAME || 'translation-platform'
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        timeout: parseInt(process.env.OPENAI_TIMEOUT || '60000', 10),
        defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4-turbo'
    }
};

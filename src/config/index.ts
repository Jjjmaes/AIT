import dotenv from 'dotenv';

dotenv.config();

export const config = {
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
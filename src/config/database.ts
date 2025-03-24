import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async (): Promise<void> => {
  try {
    const options = {
      // 使用新的连接字符串解析器
      useNewUrlParser: true as any,
      // 使用统一拓扑结构
      useUnifiedTopology: true as any,
    };

    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/translation-platform';
    
    await mongoose.connect(uri, options);
    
    console.log('MongoDB connection established successfully');
    
    // 监听MongoDB连接事件
    mongoose.connection.on('error', (err) => {
      console.error(`MongoDB connection error: ${err}`);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });
    
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

export default connectDB;
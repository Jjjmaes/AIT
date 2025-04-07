import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AppError } from './errors';
import logger from './logger';

// Define the directory for temporary uploads
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

// Ensure the upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    logger.info(`Upload directory created: ${UPLOAD_DIR}`);
  } catch (error) {
    logger.error(`Failed to create upload directory ${UPLOAD_DIR}:`, error);
    // Depending on setup, might want to exit process if upload dir is critical
    // process.exit(1);
  }
}

// Configure storage engine
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    // Generate a unique filename to avoid collisions
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter function (optional: restrict file types)
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Example: Allow only certain mime types
  // const allowedMimes = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'application/xliff+xml'];
  // if (allowedMimes.includes(file.mimetype)) {
  //   cb(null, true);
  // } else {
  //   cb(new AppError('Unsupported file type', 400));
  // }
  
  // For now, accept all files passed
  cb(null, true);
};

// Configure multer instance
const upload = multer({
  storage: storage,
  // fileFilter: fileFilter, // Uncomment to enable file filter
  limits: {
    fileSize: 100 * 1024 * 1024 // 100 MB limit (adjust as needed)
  }
});

export default upload; 
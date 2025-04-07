"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const logger_1 = __importDefault(require("./logger"));
// Define the directory for temporary uploads
const UPLOAD_DIR = path_1.default.resolve(__dirname, '../../uploads');
// Ensure the upload directory exists
if (!fs_1.default.existsSync(UPLOAD_DIR)) {
    try {
        fs_1.default.mkdirSync(UPLOAD_DIR, { recursive: true });
        logger_1.default.info(`Upload directory created: ${UPLOAD_DIR}`);
    }
    catch (error) {
        logger_1.default.error(`Failed to create upload directory ${UPLOAD_DIR}:`, error);
        // Depending on setup, might want to exit process if upload dir is critical
        // process.exit(1);
    }
}
// Configure storage engine
const storage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOAD_DIR);
    },
    filename: function (req, file, cb) {
        // Generate a unique filename to avoid collisions
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
// File filter function (optional: restrict file types)
const fileFilter = (req, file, cb) => {
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
const upload = (0, multer_1.default)({
    storage: storage,
    // fileFilter: fileFilter, // Uncomment to enable file filter
    limits: {
        fileSize: 100 * 1024 * 1024 // 100 MB limit (adjust as needed)
    }
});
exports.default = upload;

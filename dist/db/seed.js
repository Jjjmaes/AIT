"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const user_model_1 = __importStar(require("../models/user.model"));
const logger_1 = __importDefault(require("../utils/logger"));
// --- Configuration ---
// IMPORTANT: Replace with your actual connection string or ensure process.env.MONGODB_URI is set
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/translationPlatformDB';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password'; // Use a strong password in production!
// --- Database Connection ---
async function connectDB() {
    try {
        logger_1.default.info('Connecting to database...');
        await mongoose_1.default.connect(MONGODB_URI);
        logger_1.default.info('Database connected successfully.');
    }
    catch (error) {
        logger_1.default.error('Database connection error:', error);
        process.exit(1); // Exit if DB connection fails
    }
}
async function disconnectDB() {
    try {
        await mongoose_1.default.disconnect();
        logger_1.default.info('Database disconnected.');
    }
    catch (error) {
        logger_1.default.error('Error disconnecting from database:', error);
    }
}
// --- Seed Function ---
async function createAdminUser() {
    try {
        // Check if admin user already exists
        const existingAdmin = await user_model_1.default.findOne({ $or: [{ username: ADMIN_USERNAME }, { email: ADMIN_EMAIL }] });
        if (existingAdmin) {
            logger_1.default.info(`Admin user '${ADMIN_USERNAME}' or email '${ADMIN_EMAIL}' already exists. Skipping creation.`);
            return;
        }
        // Hash the password
        const salt = await bcryptjs_1.default.genSalt(10); // Generate salt
        const hashedPassword = await bcryptjs_1.default.hash(ADMIN_PASSWORD, salt);
        logger_1.default.info('Password hashed successfully.');
        // Create the admin user
        const adminUser = new user_model_1.default({
            username: ADMIN_USERNAME,
            email: ADMIN_EMAIL,
            password: hashedPassword,
            role: user_model_1.UserRole.ADMIN,
            status: user_model_1.UserStatus.ACTIVE,
            fullName: 'Admin User',
            // Set other required fields if any
        });
        await adminUser.save();
        logger_1.default.info(`Admin user '${ADMIN_USERNAME}' created successfully.`);
    }
    catch (error) {
        logger_1.default.error('Error creating admin user:', error);
        // Consider throwing the error to stop the process if needed
    }
}
// --- Main Execution ---
async function seedDatabase() {
    await connectDB();
    await createAdminUser();
    await disconnectDB();
}
// Run the seeder
seedDatabase()
    .then(() => {
    logger_1.default.info('Database seeding process completed.');
    process.exit(0);
})
    .catch((error) => {
    logger_1.default.error('Database seeding process failed:', error);
    process.exit(1);
});

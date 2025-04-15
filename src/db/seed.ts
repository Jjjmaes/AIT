import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User, { UserRole, UserStatus } from '../models/user.model';
import logger from '../utils/logger';

// --- Configuration ---
// IMPORTANT: Replace with your actual connection string or ensure process.env.MONGODB_URI is set
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/translationPlatformDB';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password'; // Use a strong password in production!

// --- Database Connection ---
async function connectDB() {
  try {
    logger.info('Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    logger.info('Database connected successfully.');
  } catch (error) {
    logger.error('Database connection error:', error);
    process.exit(1); // Exit if DB connection fails
  }
}

async function disconnectDB() {
  try {
    await mongoose.disconnect();
    logger.info('Database disconnected.');
  } catch (error) {
    logger.error('Error disconnecting from database:', error);
  }
}

// --- Seed Function ---
async function createAdminUser() {
  try {
    // Check if admin user already exists
    const existingAdmin = await User.findOne({ $or: [{ username: ADMIN_USERNAME }, { email: ADMIN_EMAIL }] });

    if (existingAdmin) {
      logger.info(`Admin user '${ADMIN_USERNAME}' or email '${ADMIN_EMAIL}' already exists. Skipping creation.`);
      return;
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10); // Generate salt
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, salt);
    logger.info('Password hashed successfully.');

    // Create the admin user
    const adminUser = new User({
      username: ADMIN_USERNAME,
      email: ADMIN_EMAIL,
      password: hashedPassword,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      fullName: 'Admin User',
      // Set other required fields if any
    });

    await adminUser.save();
    logger.info(`Admin user '${ADMIN_USERNAME}' created successfully.`);

  } catch (error) {
    logger.error('Error creating admin user:', error);
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
    logger.info('Database seeding process completed.');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Database seeding process failed:', error);
    process.exit(1);
  }); 
import express from 'express';
import { FileController } from '../controllers/file.controller';
import { authenticateJwt } from '../middleware/auth.middleware'; // Assuming auth middleware is needed

const router = express.Router();
const fileController = new FileController();

// GET /api/translation/status/:jobId
router.get(
    '/status/:jobId',
    authenticateJwt, // Add authentication middleware
    fileController.getTranslationJobStatus // Link to a new method in FileController
);

// POST /api/translation/cancel/:jobId (Placeholder if needed later)
// router.post(
//     '/cancel/:jobId',
//     authenticateJwt,
//     fileController.cancelTranslationJob // Example: Link to a cancel method
// );

export default router; 
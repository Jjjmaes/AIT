import express from 'express';
import { FileController } from '../controllers/file.controller';
import { authenticateJwt } from '../middleware/auth.middleware';
import { Container } from 'typedi'; // Import Container

// Get controller instance from TypeDI container
const fileController = Container.get(FileController); 

const router = express.Router();

// Route to get segments for a file
router.get('/files/:fileId/segments', authenticateJwt, fileController.getSegments);

// Route to update a segment
// router.put('/segments/:segmentId', authenticateJwt, fileController.updateSegment);

// Route to start AI translation for a segment
// router.post('/segments/:segmentId/translate', authenticateJwt, fileController.translateSegment);

// Route to split a segment
// router.post('/segments/:segmentId/split', authenticateJwt, fileController.splitSegment);

// Route to merge segments
// router.post('/segments/merge', authenticateJwt, fileController.mergeSegments);

// Route to get translation memory suggestions
// router.get('/segments/:segmentId/suggestions', authenticateJwt, fileController.getTranslationMemorySuggestions);

// Route to get translation history
// router.get('/segments/:segmentId/history', authenticateJwt, fileController.getSegmentHistory);

// Route to get file information
router.get('/files/:fileId', authenticateJwt, fileController.getFile);

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
import { Router } from 'express';
import { 
    translationMemoryController, 
    tmxUploadMiddleware, 
    addTMEntryValidators 
} from '../controllers/translationMemory.controller';
import { authenticateJwt } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/auth.middleware'; // Assuming roles might be needed later

const router = Router();

// === Translation Memory Routes ===

// Add a single TM entry
// POST /api/v1/tm
router.post(
    '/',
    authenticateJwt, // Ensure user is logged in
    // authorizeRoles('admin', 'reviewer'), // Optional: Restrict who can add entries
    addTMEntryValidators, // Validate request body
    translationMemoryController.addTMEntry
);

// Import TM entries from a TMX file
// POST /api/v1/tm/import/tmx
router.post(
    '/import/tmx',
    authenticateJwt, // Ensure user is logged in
    // authorizeRoles('admin'), // Optional: Restrict import to admins
    tmxUploadMiddleware, // Handle the file upload first (expects field 'tmxfile')
    translationMemoryController.importTMXFile
);

// TODO: Add routes for searching/querying TM, deleting entries etc.

export default router; 
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

// Changed to create a new TM Set (Collection)
// POST /api/v1/tm
router.post(
    '/',
    authenticateJwt, // Ensure user is logged in
    // TODO: Add validation for TM Set creation payload
    translationMemoryController.createTMSet
);

// --- Routes for TM Entries --- 
// These might need different paths or specific TM Set IDs

// Import TM entries from a TMX file
// POST /api/v1/tm/import/tmx
// This might need to be changed to /api/v1/tm/:tmSetId/import
router.post(
    '/import/tmx',
    authenticateJwt, // Ensure user is logged in
    // authorizeRoles('admin'), // Optional: Restrict import to admins
    tmxUploadMiddleware, // Handle the file upload first (expects field 'tmxfile')
    translationMemoryController.importTMXFile // Controller might need update for tmSetId
);

// TODO: Add routes for searching/querying TM, deleting entries etc.
// TODO: Add routes for GET/PUT/DELETE /api/v1/tm/:id (for TM Sets)

export default router; 
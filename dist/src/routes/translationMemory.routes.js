"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const translationMemory_controller_1 = require("../controllers/translationMemory.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// === Translation Memory Routes ===
// Changed to create a new TM Set (Collection)
// POST /api/v1/tm
router.post('/', auth_middleware_1.authenticateJwt, // Ensure user is logged in
// TODO: Add validation for TM Set creation payload
translationMemory_controller_1.translationMemoryController.createTMSet);
// --- Routes for TM Entries --- 
// These might need different paths or specific TM Set IDs
// Import TM entries from a TMX file
// POST /api/v1/tm/import/tmx
// This might need to be changed to /api/v1/tm/:tmSetId/import
router.post('/import/tmx', auth_middleware_1.authenticateJwt, // Ensure user is logged in
// authorizeRoles('admin'), // Optional: Restrict import to admins
translationMemory_controller_1.tmxUploadMiddleware, // Handle the file upload first (expects field 'tmxfile')
translationMemory_controller_1.translationMemoryController.importTMXFile // Controller might need update for tmSetId
);
// TODO: Add routes for searching/querying TM, deleting entries etc.
// TODO: Add routes for GET/PUT/DELETE /api/v1/tm/:id (for TM Sets)
exports.default = router;

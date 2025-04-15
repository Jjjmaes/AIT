"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const translationMemory_controller_1 = require("../controllers/translationMemory.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// === Translation Memory Routes ===
// Add a single TM entry
// POST /api/v1/tm
router.post('/', auth_middleware_1.authenticateJwt, // Ensure user is logged in
// authorizeRoles('admin', 'reviewer'), // Optional: Restrict who can add entries
translationMemory_controller_1.addTMEntryValidators, // Validate request body
translationMemory_controller_1.translationMemoryController.addTMEntry);
// Import TM entries from a TMX file
// POST /api/v1/tm/import/tmx
router.post('/import/tmx', auth_middleware_1.authenticateJwt, // Ensure user is logged in
// authorizeRoles('admin'), // Optional: Restrict import to admins
translationMemory_controller_1.tmxUploadMiddleware, // Handle the file upload first (expects field 'tmxfile')
translationMemory_controller_1.translationMemoryController.importTMXFile);
// TODO: Add routes for searching/querying TM, deleting entries etc.
exports.default = router;

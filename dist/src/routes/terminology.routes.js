"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
console.log('--- Loading terminology.routes.ts ---'); // Diagnostic log
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
// Import controller and the new CSV upload middleware
const terminology_controller_1 = require("../controllers/terminology.controller");
// Optional: Add validation middleware if needed
// import { validateRequest } from '../middleware/validate.middleware';
// import { terminologyValidator } from '../validators/terminologyValidator'; // Assuming validators exist
const router = (0, express_1.Router)();
// Apply authentication middleware to all terminology routes
router.use(auth_middleware_1.authenticateJwt);
// --- Routes for Terminology Lists --
router.route('/')
    .get(terminology_controller_1.terminologyController.getAll) // GET /api/terms (with query filters)
    .post(
// validateRequest(terminologyValidator.create), // Optional validation
terminology_controller_1.terminologyController.create // POST /api/terms
);
router.route('/:terminologyId')
    .get(terminology_controller_1.terminologyController.getById) // GET /api/terms/:terminologyId
    .put(
// validateRequest(terminologyValidator.update), // Optional validation
terminology_controller_1.terminologyController.update // PUT /api/terms/:terminologyId (updates list details)
)
    .delete(terminology_controller_1.terminologyController.delete); // DELETE /api/terms/:terminologyId
// GET /api/terms/:terminologyId/terms - Get all terms within a specific list
router.get('/:terminologyId/terms', terminology_controller_1.terminologyController.getTermsByListId);
// Export route
router.get('/:terminologyId/export', terminology_controller_1.terminologyController.exportById);
// --- Routes for Terms within a List --
// Add/Update a specific term (using PUT or POST)
// Using PUT for idempotency (upsert)
router.put('/:terminologyId/terms', 
// validateRequest(terminologyValidator.upsertTerm), // Optional validation
terminology_controller_1.terminologyController.upsertTerm // PUT /api/terms/:terminologyId/terms
);
// Remove a specific term
// Using DELETE with term identifier (source text) in the body
router.delete('/:terminologyId/terms', 
// validateRequest(terminologyValidator.removeTerm), // Optional validation
terminology_controller_1.terminologyController.removeTerm // DELETE /api/terms/:terminologyId/terms
);
// --- Route for Importing Terms ---
// POST /api/terms/:terminologyId/import
router.post('/:terminologyId/import', terminology_controller_1.termsCsvUploadMiddleware, // Handle CSV file upload (field 'termsfile')
terminology_controller_1.terminologyController.importTerms // Process the import
);
exports.default = router;

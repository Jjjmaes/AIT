console.log('--- Loading terminology.routes.ts ---'); // Diagnostic log
import { Router } from 'express';
import { authenticateJwt } from '../middleware/auth.middleware';
// Import Controller class and Container
import { TerminologyController, termsCsvUploadMiddleware } from '../controllers/terminology.controller';
import { Container } from 'typedi';
// Optional: Add validation middleware if needed
// import { validateRequest } from '../middleware/validate.middleware';
// import { terminologyValidator } from '../validators/terminologyValidator'; // Assuming validators exist

const router = Router();

// Get controller instance from container
const terminologyController = Container.get(TerminologyController);

// Apply authentication middleware to all terminology routes
router.use(authenticateJwt);

// --- Routes for Terminology Lists --
router.route('/')
  .get(terminologyController.getAll)     // GET /api/terms (with query filters)
  .post(
    // validateRequest(terminologyValidator.create), // Optional validation
    terminologyController.create        // POST /api/terms
  );

router.route('/:terminologyId')
  .get(terminologyController.getById)    // GET /api/terms/:terminologyId
  .put(
    // validateRequest(terminologyValidator.update), // Optional validation
    terminologyController.update       // PUT /api/terms/:terminologyId (updates list details)
   )
  .delete(terminologyController.delete); // DELETE /api/terms/:terminologyId

// GET /api/terms/:terminologyId/terms - Get all terms within a specific list
router.get('/:terminologyId/terms', terminologyController.getTermsByListId);

// Export route
router.get('/:terminologyId/export', terminologyController.exportById);

// --- Routes for Terms within a List --

// Add/Update a specific term (using PUT or POST)
// Using PUT for idempotency (upsert)
router.put('/:terminologyId/terms',
    // validateRequest(terminologyValidator.upsertTerm), // Optional validation
    terminologyController.upsertTerm      // PUT /api/terms/:terminologyId/terms
);

// Remove a specific term
// Using DELETE with term identifier (source text) in the body
router.delete('/:terminologyId/terms',
    // validateRequest(terminologyValidator.removeTerm), // Optional validation
    terminologyController.removeTerm      // DELETE /api/terms/:terminologyId/terms
);

// --- Route for Importing Terms ---
// POST /api/terms/:terminologyId/import
router.post(
    '/:terminologyId/import',
    termsCsvUploadMiddleware,       // Handle CSV file upload (field 'termsfile')
    terminologyController.importTerms // Process the import
);

export default router;
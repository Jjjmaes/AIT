console.log('--- Loading terminology.routes.ts ---'); // Diagnostic log
import { Router, Request, Response, NextFunction } from 'express';
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
  .get((req: Request, res: Response, next: NextFunction) => terminologyController.getAll(req, res, next))     // GET /api/terms (with query filters)
  .post((req: Request, res: Response, next: NextFunction) => terminologyController.create(req, res, next));

router.route('/:terminologyId')
  .get((req: Request, res: Response, next: NextFunction) => terminologyController.getById(req, res, next))    // GET /api/terms/:terminologyId
  .put((req: Request, res: Response, next: NextFunction) => terminologyController.update(req, res, next))       // PUT /api/terms/:terminologyId (updates list details)
  .delete((req: Request, res: Response, next: NextFunction) => terminologyController.delete(req, res, next)); // DELETE /api/terms/:terminologyId

// GET /api/terms/:terminologyId/terms - Get all terms within a specific list
router.get('/:terminologyId/terms', (req: Request, res: Response, next: NextFunction) => terminologyController.getTermsByListId(req, res, next));

// Export route
router.get('/:terminologyId/export', (req: Request, res: Response, next: NextFunction) => terminologyController.exportById(req, res, next));

// --- Routes for Terms within a List --

// Add/Update a specific term (using PUT or POST)
// Using PUT for idempotency (upsert)
router.put('/:terminologyId/terms', (req: Request, res: Response, next: NextFunction) => terminologyController.upsertTerm(req, res, next));

// Remove a specific term
// Using DELETE with term identifier (source text) in the body
router.delete('/:terminologyId/terms', (req: Request, res: Response, next: NextFunction) => terminologyController.removeTerm(req, res, next));

// --- Route for Importing Terms ---
// POST /api/terms/:terminologyId/import
router.post(
    '/:terminologyId/import',
    termsCsvUploadMiddleware,       // Handle CSV file upload (field 'termsfile')
    (req: Request, res: Response, next: NextFunction) => terminologyController.importTerms(req, res, next)
);

export default router;
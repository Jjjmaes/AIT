import { Router } from 'express';
import { PromptTemplateController } from '../controllers/promptTemplate.controller';
import { authenticateJwt } from '../middleware/auth.middleware';
// import { admin } from '../middleware/auth.middleware'; // Import admin check if needed
// Optional: Add validation middleware if needed
// import { validateRequest } from '../middleware/validate.middleware';
// import { promptTemplateValidator } from '../validators/promptTemplateValidator'; // Assuming validators exist

const router = Router();
const promptTemplateController = new PromptTemplateController();

// Base path: /api/prompts (set in app.ts)

// GET / - Get all templates (accessible to authenticated users)
router.get(
    '/',
    authenticateJwt,
    promptTemplateController.getAllTemplates
);

// POST / - Create a new template (accessible to authenticated users, or admin only?)
// Decide if only admins can create or any authenticated user. Let's assume admin for now.
router.post(
    '/',
    authenticateJwt,
    // admin, // Add admin check if required
    promptTemplateController.createTemplate
);

// GET /:templateId - Get a specific template (accessible to authenticated users)
// Permissions (own vs public) are handled in the service/controller logic if needed
router.get(
    '/:templateId',
    authenticateJwt,
    promptTemplateController.getTemplateById
);

// PUT /:templateId - Update a template (usually owner or admin)
// Permissions should be checked in the controller/service
router.put(
    '/:templateId',
    authenticateJwt,
    // Potentially add owner/admin check middleware here or handle in controller
    promptTemplateController.updateTemplate
);

// DELETE /:templateId - Delete a template (usually owner or admin)
// Permissions should be checked in the controller/service
router.delete(
    '/:templateId',
    authenticateJwt,
     // Potentially add owner/admin check middleware here or handle in controller
    promptTemplateController.deleteTemplate
);

export default router; // Make sure this export exists!
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const promptTemplate_controller_1 = require("../controllers/promptTemplate.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
// import { admin } from '../middleware/auth.middleware'; // Import admin check if needed
// Optional: Add validation middleware if needed
// import { validateRequest } from '../middleware/validate.middleware';
// import { promptTemplateValidator } from '../validators/promptTemplateValidator'; // Assuming validators exist
const router = (0, express_1.Router)();
const promptTemplateController = new promptTemplate_controller_1.PromptTemplateController();
// Base path: /api/prompts (set in app.ts)
// GET / - Get all templates (accessible to authenticated users)
router.get('/', auth_middleware_1.authenticateJwt, promptTemplateController.getAllTemplates);
// POST / - Create a new template (accessible to authenticated users, or admin only?)
// Decide if only admins can create or any authenticated user. Let's assume admin for now.
router.post('/', auth_middleware_1.authenticateJwt, 
// admin, // Add admin check if required
promptTemplateController.createTemplate);
// GET /:templateId - Get a specific template (accessible to authenticated users)
// Permissions (own vs public) are handled in the service/controller logic if needed
router.get('/:templateId', auth_middleware_1.authenticateJwt, promptTemplateController.getTemplateById);
// PUT /:templateId - Update a template (usually owner or admin)
// Permissions should be checked in the controller/service
router.put('/:templateId', auth_middleware_1.authenticateJwt, 
// Potentially add owner/admin check middleware here or handle in controller
promptTemplateController.updateTemplate);
// DELETE /:templateId - Delete a template (usually owner or admin)
// Permissions should be checked in the controller/service
router.delete('/:templateId', auth_middleware_1.authenticateJwt, 
// Potentially add owner/admin check middleware here or handle in controller
promptTemplateController.deleteTemplate);
exports.default = router; // Make sure this export exists!

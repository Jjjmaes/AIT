"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const promptTemplate_controller_1 = require("../controllers/promptTemplate.controller");
// Optional: Add validation middleware if needed
// import { validateRequest } from '../middleware/validate.middleware';
// import { promptTemplateValidator } from '../validators/promptTemplateValidator'; // Assuming validators exist
const router = (0, express_1.Router)();
// Apply authentication middleware to all prompt template routes
router.use(auth_middleware_1.authenticateJwt);
// Define routes
router.route('/')
    .get(promptTemplate_controller_1.promptTemplateController.getAll.bind(promptTemplate_controller_1.promptTemplateController)) // GET /api/prompts (with query filters)
    .post(
// validateRequest(promptTemplateValidator.create), // Optional validation
promptTemplate_controller_1.promptTemplateController.create.bind(promptTemplate_controller_1.promptTemplateController) // POST /api/prompts
);
router.route('/:templateId')
    .get(promptTemplate_controller_1.promptTemplateController.getById.bind(promptTemplate_controller_1.promptTemplateController)) // GET /api/prompts/:templateId
    .put(
// validateRequest(promptTemplateValidator.update), // Optional validation
promptTemplate_controller_1.promptTemplateController.update.bind(promptTemplate_controller_1.promptTemplateController) // PUT /api/prompts/:templateId
)
    .delete(promptTemplate_controller_1.promptTemplateController.delete.bind(promptTemplate_controller_1.promptTemplateController)); // DELETE /api/prompts/:templateId
exports.default = router; // Make sure this export exists!

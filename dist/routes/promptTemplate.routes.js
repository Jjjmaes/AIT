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
    .get(promptTemplate_controller_1.promptTemplateController.getAll) // GET /api/prompts (with query filters)
    .post(
// validateRequest(promptTemplateValidator.create), // Optional validation
promptTemplate_controller_1.promptTemplateController.create // POST /api/prompts
);
router.route('/:templateId')
    .get(promptTemplate_controller_1.promptTemplateController.getById) // GET /api/prompts/:templateId
    .put(
// validateRequest(promptTemplateValidator.update), // Optional validation
promptTemplate_controller_1.promptTemplateController.update // PUT /api/prompts/:templateId
)
    .delete(promptTemplate_controller_1.promptTemplateController.delete); // DELETE /api/prompts/:templateId
exports.default = router; // Make sure this export exists!

import { Router } from 'express';
import { authenticateJwt } from '../middleware/auth.middleware';
import { promptTemplateController } from '../controllers/promptTemplate.controller';
// Optional: Add validation middleware if needed
// import { validateRequest } from '../middleware/validate.middleware';
// import { promptTemplateValidator } from '../validators/promptTemplateValidator'; // Assuming validators exist

const router = Router();

// Apply authentication middleware to all prompt template routes
router.use(authenticateJwt);

// Define routes
router.route('/')
  .get(promptTemplateController.getAll.bind(promptTemplateController)) // GET /api/prompts (with query filters)
  .post(
    // validateRequest(promptTemplateValidator.create), // Optional validation
    promptTemplateController.create.bind(promptTemplateController) // POST /api/prompts
  );

router.route('/:templateId')
  .get(promptTemplateController.getById.bind(promptTemplateController)) // GET /api/prompts/:templateId
  .put(
    // validateRequest(promptTemplateValidator.update), // Optional validation
    promptTemplateController.update.bind(promptTemplateController) // PUT /api/prompts/:templateId
   )
  .delete(promptTemplateController.delete.bind(promptTemplateController)); // DELETE /api/prompts/:templateId

export default router; // Make sure this export exists!
// src/routes/aiConfig.routes.ts
import { Router } from 'express';
import { AIConfigController } from '../controllers/aiConfig.controller';
import { authenticateJwt } from '../middleware/auth.middleware';
// import { requireAdmin } from '../middleware/role.middleware'; // TODO: Add role middleware later

const router = Router();
const aiConfigController = new AIConfigController();

// Route to get active AI models for selection
// Use authenticateJwt middleware
// Call a new method getActiveModelsForSelection on the controller instance
router.get('/ai-models', authenticateJwt, aiConfigController.getActiveModelsForSelection);

// Base path: /api/ai-configs (set in app.ts)

// GET / - Get all AI configurations (Admin only)
router.get(
    '/',
    authenticateJwt,
    // requireAdmin, // TODO: Add admin check
    aiConfigController.getAllConfigs
);

// POST / - Create a new AI configuration (Admin only)
router.post(
    '/',
    authenticateJwt,
    // requireAdmin,
    // TODO: Add validation middleware for payload
    aiConfigController.createConfig
);

// GET /:configId - Get a specific AI configuration (Admin only)
router.get(
    '/:configId',
    authenticateJwt,
    // requireAdmin,
    aiConfigController.getConfigById
);

// PUT /:configId - Update an AI configuration (Admin only)
router.put(
    '/:configId',
    authenticateJwt,
    // requireAdmin,
    // TODO: Add validation middleware for payload
    aiConfigController.updateConfig
);

// DELETE /:configId - Delete an AI configuration (Admin only)
router.delete(
    '/:configId',
    authenticateJwt,
    // requireAdmin,
    aiConfigController.deleteConfig
);

export default router; 
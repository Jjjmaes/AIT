"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/aiConfig.routes.ts
const express_1 = require("express");
const aiConfig_controller_1 = require("../controllers/aiConfig.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
// import { requireAdmin } from '../middleware/role.middleware'; // TODO: Add role middleware later
const router = (0, express_1.Router)();
const aiConfigController = new aiConfig_controller_1.AIConfigController();
// Route to get active AI models for selection
// Use authenticateJwt middleware
// Call a new method getActiveModelsForSelection on the controller instance
router.get('/ai-models', auth_middleware_1.authenticateJwt, aiConfigController.getActiveModelsForSelection);
// Base path: /api/ai-configs (set in app.ts)
// GET / - Get all AI configurations (Admin only)
router.get('/', auth_middleware_1.authenticateJwt, 
// requireAdmin, // TODO: Add admin check
aiConfigController.getAllConfigs);
// POST / - Create a new AI configuration (Admin only)
router.post('/', auth_middleware_1.authenticateJwt, 
// requireAdmin,
// TODO: Add validation middleware for payload
aiConfigController.createConfig);
// GET /:configId - Get a specific AI configuration (Admin only)
router.get('/:configId', auth_middleware_1.authenticateJwt, 
// requireAdmin,
aiConfigController.getConfigById);
// PUT /:configId - Update an AI configuration (Admin only)
router.put('/:configId', auth_middleware_1.authenticateJwt, 
// requireAdmin,
// TODO: Add validation middleware for payload
aiConfigController.updateConfig);
// DELETE /:configId - Delete an AI configuration (Admin only)
router.delete('/:configId', auth_middleware_1.authenticateJwt, 
// requireAdmin,
aiConfigController.deleteConfig);
exports.default = router;

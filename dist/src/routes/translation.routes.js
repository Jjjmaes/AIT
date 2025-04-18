"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const file_controller_1 = require("../controllers/file.controller");
const auth_middleware_1 = require("../middleware/auth.middleware"); // Assuming auth middleware is needed
const router = express_1.default.Router();
const fileController = new file_controller_1.FileController();
// GET /api/translation/status/:jobId
router.get('/status/:jobId', auth_middleware_1.authenticateJwt, // Add authentication middleware
fileController.getTranslationJobStatus // Link to a new method in FileController
);
// POST /api/translation/cancel/:jobId (Placeholder if needed later)
// router.post(
//     '/cancel/:jobId',
//     authenticateJwt,
//     fileController.cancelTranslationJob // Example: Link to a cancel method
// );
exports.default = router;

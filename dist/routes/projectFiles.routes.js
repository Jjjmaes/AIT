"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const file_controller_1 = require("../controllers/file.controller");
const multerConfig_1 = __importDefault(require("../utils/multerConfig")); // Import multer config
const auth_middleware_1 = require("../middleware/auth.middleware"); // Use correct middleware name
const projectFilesRouter = express_1.default.Router({ mergeParams: true }); // Use mergeParams to access :projectId
const fileCtrl = new file_controller_1.FileController(); // Instantiate controller
// Apply auth middleware to all file routes
projectFilesRouter.use(auth_middleware_1.authenticateJwt);
// POST /api/projects/:projectId/files - Upload a file
// Use upload.single('file') to specify the field name used in the form data
projectFilesRouter.post('/', multerConfig_1.default.single('file'), // 'file' should match the name attribute in your form input
fileCtrl.uploadFile);
// GET /api/projects/:projectId/files - Get list of files for a project
projectFilesRouter.get('/', fileCtrl.getFiles);
// GET /api/projects/:projectId/files/:fileId - Get single file details
projectFilesRouter.get('/:fileId', fileCtrl.getFile);
// DELETE /api/projects/:projectId/files/:fileId - Delete a file
projectFilesRouter.delete('/:fileId', fileCtrl.deleteFile);
// POST /api/projects/:projectId/files/:fileId/translate - Start translation job
projectFilesRouter.post('/:fileId/translate', fileCtrl.startTranslation);
// Example of integrating into a main project router:
// mainProjectRouter.use('/:projectId/files', projectFilesRouter);
exports.default = projectFilesRouter;

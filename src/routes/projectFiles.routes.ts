import express from 'express';
import { FileController } from '../controllers/file.controller';
import upload from '../utils/multerConfig'; // Import multer config
import { authenticateJwt } from '../middleware/auth.middleware'; // Use correct middleware name

const projectFilesRouter = express.Router({ mergeParams: true }); // Use mergeParams to access :projectId
const fileCtrl = new FileController(); // Instantiate controller

// Apply auth middleware to all file routes
projectFilesRouter.use(authenticateJwt);

// POST /api/projects/:projectId/files - Upload a file
// Use upload.single('file') to specify the field name used in the form data
projectFilesRouter.post(
    '/', 
    upload.single('file'), // 'file' should match the name attribute in your form input
    fileCtrl.uploadFile
);

// GET /api/projects/:projectId/files - Get list of files for a project
projectFilesRouter.get('/', fileCtrl.getFiles);

// GET /api/projects/:projectId/files/:fileId - Get single file details
projectFilesRouter.get('/:fileId', fileCtrl.getFile);

// DELETE /api/projects/:projectId/files/:fileId - Delete a file
projectFilesRouter.delete('/:fileId', fileCtrl.deleteFile);

// Example of integrating into a main project router:
// mainProjectRouter.use('/:projectId/files', projectFilesRouter);

export default projectFilesRouter; 
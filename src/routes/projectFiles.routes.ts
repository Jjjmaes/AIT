import express from 'express';
import { FileController } from '../controllers/file.controller';
import upload from '../utils/multerConfig'; // Import multer config
import { authenticateJwt } from '../middleware/auth.middleware'; // Use correct middleware name
import { Container } from 'typedi'; // Import Container

const projectFilesRouter = express.Router({ mergeParams: true }); // Use mergeParams to access :projectId
// Use Container.get to resolve FileController instance with dependencies
// const fileCtrl = Container.get(FileController); // <-- REMOVE THIS LINE

// Apply auth middleware to all file routes
projectFilesRouter.use(authenticateJwt);

// POST /api/projects/:projectId/files - Upload a file
// Use upload.single('file') to specify the field name used in the form data
projectFilesRouter.post(
    '/', 
    upload.single('file'), // 'file' should match the name attribute in your form input
    (req, res, next) => Container.get(FileController).uploadFile(req, res, next)
);

// GET /api/projects/:projectId/files - Get list of files for a project
projectFilesRouter.get('/', (req, res, next) => Container.get(FileController).getFiles(req, res, next));

// GET /api/projects/:projectId/files/:fileId - Get single file details
projectFilesRouter.get('/:fileId', (req, res, next) => Container.get(FileController).getFile(req, res, next));

// DELETE /api/projects/:projectId/files/:fileId - Delete a file
projectFilesRouter.delete('/:fileId', (req, res, next) => Container.get(FileController).deleteFile(req, res, next));

// POST /api/projects/:projectId/files/:fileId/translate - Start translation job
projectFilesRouter.post('/:fileId/translate', (req, res, next) => Container.get(FileController).startTranslation(req, res, next));

// Example of integrating into a main project router:
// mainProjectRouter.use('/:projectId/files', projectFilesRouter);

export default projectFilesRouter; 
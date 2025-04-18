"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useFileStore = void 0;
const zustand_1 = require("zustand");
const middleware_1 = require("zustand/middleware"); // Optional: for Redux DevTools integration
// Create the Zustand store
exports.useFileStore = (0, zustand_1.create)()((0, middleware_1.devtools)(// Optional: Wrap with devtools for Redux DevTools
(set, get) => ({
    files: new Map(),
    // Action to replace all files, often after initial fetch
    setFiles: (initialFiles) => {
        const newFilesMap = new Map();
        initialFiles.forEach(file => {
            // Ensure progress/status are initialized sensibly
            const normalizedFile = {
                ...file,
                // Handle both progress object and number from backend potentially
                progress: typeof file.progress === 'number'
                    ? file.progress
                    : file.progress?.percentage ?? 0,
                status: file.status || 'pending',
            };
            newFilesMap.set(file.id, normalizedFile);
        });
        set({ files: newFilesMap }, false, 'setFiles');
    },
    // Action to add a single file (e.g., after upload)
    addFile: (file) => set((state) => {
        const newFiles = new Map(state.files);
        const normalizedFile = {
            ...file,
            progress: typeof file.progress === 'number' ? file.progress : file.progress?.percentage ?? 0,
            status: file.status || 'pending',
        };
        newFiles.set(file.id, normalizedFile);
        return { files: newFiles };
    }, false, 'addFile'),
    // Action to remove a file
    removeFile: (fileId) => set((state) => {
        const newFiles = new Map(state.files);
        newFiles.delete(fileId);
        return { files: newFiles };
    }, false, 'removeFile'),
    // Action called by the SSE hook to update progress/status
    updateFileProgress: (fileId, progress, status) => set((state) => {
        const newFiles = new Map(state.files);
        const file = newFiles.get(fileId);
        if (file) {
            newFiles.set(fileId, { ...file, progress, status });
            return { files: newFiles };
        }
        return state; // No change if file not found
    }, false, 'updateFileProgress'),
    // Selector function to get a single file by ID
    getFileById: (fileId) => get().files.get(fileId),
}), { name: 'FileStore' } // Name for Redux DevTools
));

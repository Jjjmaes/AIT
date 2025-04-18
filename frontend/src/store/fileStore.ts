import { create } from 'zustand';
import { devtools } from 'zustand/middleware'; // Optional: for Redux DevTools integration

// Define the structure for file state including progress/status
// Match backend FileStatus enum values if possible
export interface FileState {
  id: string;
  projectId?: string; // Optional: if needed
  fileName: string;
  originalName?: string;
  fileSize?: number;
  mimeType?: string;
  type?: string; // Consider using FileType enum if defined on frontend
  progress: number; // Percentage 0-100
  status: string; // e.g., 'pending', 'translating', 'translated', 'error'
  storageUrl?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  // Add other relevant file properties from your backend IFile model
}

// Define the state structure for the store
export interface FileStoreState {
  files: Map<string, FileState>; // Use a Map for efficient lookups and updates by fileId
  setFiles: (files: FileState[]) => void;
  addFile: (file: FileState) => void;
  removeFile: (fileId: string) => void;
  updateFileProgress: (fileId: string, progress: number, status: string) => void;
  getFileById: (fileId: string) => FileState | undefined;
}

// Create the Zustand store
export const useFileStore = create<FileStoreState>()(
  devtools( // Optional: Wrap with devtools for Redux DevTools
    (set, get) => ({
      files: new Map(),

      // Action to replace all files, often after initial fetch
      setFiles: (initialFiles) => {
        const newFilesMap = new Map<string, FileState>();
        initialFiles.forEach(file => {
            // Ensure progress/status are initialized sensibly
            const normalizedFile: FileState = {
                ...file,
                // Handle both progress object and number from backend potentially
                progress: typeof file.progress === 'number' 
                            ? file.progress 
                            : (file.progress as any)?.percentage ?? 0,
                status: file.status || 'pending',
            };
            newFilesMap.set(file.id, normalizedFile);
        });
        set({ files: newFilesMap }, false, 'setFiles');
      },

      // Action to add a single file (e.g., after upload)
      addFile: (file) => set((state) => {
        const newFiles = new Map(state.files);
        const normalizedFile: FileState = {
            ...file,
            progress: typeof file.progress === 'number' ? file.progress : (file.progress as any)?.percentage ?? 0,
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
    }),
    { name: 'FileStore' } // Name for Redux DevTools
  )
); 
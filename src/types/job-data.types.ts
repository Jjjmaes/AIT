import { AIProvider } from './ai-service.types';

// Options for AI Review process (might be shared across job types)
interface ReviewOptions {
    aiConfigId?: string;
    reviewPromptTemplateId?: string; // Optional: Override project default
    aiProvider?: AIProvider; // Optional: Override project default
    aiModel?: string; // Optional: Override project default
    apiKey?: string; // Handle securely if passed directly
}

// Job data for processing a single segment AI review (now likely deprecated/unused)
export interface AIReviewJobData {
    segmentId: string;
    userId: string; // User who initiated original job
    requesterRoles: string[]; // Roles of that user
    options?: ReviewOptions & { projectId?: string }; // Include projectId
}

// Job data for processing a file-level AI review (new batching approach)
export interface FileReviewJobData {
    fileId: string;
    userId: string;
    requesterRoles: string[];
    projectId: string;
    options?: ReviewOptions;
}

// Job data for translation (example, adjust as needed)
export interface TranslationJobData {
    segmentId: string;
    userId: string;
    projectId: string;
    fileId: string;
    // Add other necessary fields
} 
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmTranslationTask = exports.updateSegment = exports.getTranslatedSegments = exports.retryTranslationTask = exports.getTranslationTasks = void 0;
// frontend/src/api/translationService.ts
// import client from './client'; // Remove old import
const base_1 = require("./base"); // Import and alias the correct instance
// Mock data generation function (replace with actual API call)
const generateMockTasks = (count = 25) => {
    const tasks = [];
    // TODO: Ensure these statuses match your backend definitions
    const statuses = [
        'pending',
        'preprocessing',
        'ready_for_translation',
        'in_translation_queue',
        'translating',
        'translation_failed',
        'translated_pending_confirmation',
        'translation_confirmed',
        'in_review_queue',
        'reviewing',
        'review_failed',
        'reviewed_pending_confirmation',
        'completed'
    ];
    const priorities = ['low', 'medium', 'high'];
    const languages = ['en', 'es', 'fr', 'de', 'ja', 'zh'];
    for (let i = 1; i <= count; i++) {
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + Math.floor(Math.random() * 30) - 5); // Deadline within -5 to +25 days
        tasks.push({
            _id: `task_${i}`, // Ensure _id is part of your TranslationTask type if used
            projectId: `proj_${Math.ceil(i / 5)}`,
            projectName: `Project Alpha ${Math.ceil(i / 5)}`,
            fileName: `document_${i}.txt`,
            sourceLang: languages[Math.floor(Math.random() * languages.length)],
            targetLang: languages[Math.floor(Math.random() * languages.length)],
            status: status,
            priority: priorities[Math.floor(Math.random() * priorities.length)],
            wordCount: Math.floor(Math.random() * 5000) + 500,
            deadline: deadline.toISOString().split('T')[0], // Format as YYYY-MM-DD
            createdAt: new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 10).toISOString(), // Created in last 10 days
            progress: status === 'completed' ? 100 : (status === 'pending' ? 0 : Math.floor(Math.random() * 99) + 1),
            // assignedTo: i % 3 === 0 ? `user_${i % 5}` : undefined, // Optional assignment
        });
    }
    // Ensure the generated tasks conform to the TranslationTask interface from your types
    return tasks;
};
/**
 * Fetches translation tasks from the backend.
 * TODO: Replace mock data with actual API call.
 */
const getTranslationTasks = async () => {
    console.log('Fetching translation tasks (using mock data)...');
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    try {
        // --- Replace with actual API call --- 
        // const response = await client.get<{ tasks: TranslationTask[], stats: TaskStats }>('/api/translations/tasks'); // Adjust endpoint as needed
        // return response.data;
        // --- End of replacement section ---
        // --- Mock data implementation --- 
        const mockTasks = generateMockTasks(30);
        const stats = mockTasks.reduce((acc, task) => {
            acc.total++;
            switch (task.status) {
                case 'pending':
                    acc.pending++;
                    break;
                case 'completed':
                    acc.completed++;
                    break;
                case 'preprocessing':
                    acc.preprocessing = (acc.preprocessing || 0) + 1;
                    break;
                case 'ready_for_translation':
                    acc.ready_for_translation = (acc.ready_for_translation || 0) + 1;
                    break;
                case 'in_translation_queue':
                    acc.in_translation_queue = (acc.in_translation_queue || 0) + 1;
                    break;
                case 'translating':
                    acc.translating = (acc.translating || 0) + 1;
                    break;
                case 'translation_failed':
                    acc.translation_failed = (acc.translation_failed || 0) + 1;
                    break;
                case 'translated_pending_confirmation':
                    acc.translated_pending_confirmation = (acc.translated_pending_confirmation || 0) + 1;
                    break;
                case 'translation_confirmed':
                    acc.translation_confirmed = (acc.translation_confirmed || 0) + 1;
                    break;
                case 'in_review_queue':
                    acc.in_review_queue = (acc.in_review_queue || 0) + 1;
                    break;
                case 'reviewing':
                    acc.reviewing = (acc.reviewing || 0) + 1;
                    break;
                case 'review_failed':
                    acc.review_failed = (acc.review_failed || 0) + 1;
                    break;
                case 'reviewed_pending_confirmation':
                    acc.reviewed_pending_confirmation = (acc.reviewed_pending_confirmation || 0) + 1;
                    break;
            }
            return acc;
        }, {
            total: 0, pending: 0, preprocessing: 0, ready_for_translation: 0, in_translation_queue: 0,
            translating: 0, translation_failed: 0, translated_pending_confirmation: 0, translation_confirmed: 0,
            in_review_queue: 0, reviewing: 0, review_failed: 0, reviewed_pending_confirmation: 0,
            completed: 0,
            // Keep these if defined in TaskStats, otherwise remove
            inProgress: 0, // If inProgress maps to other statuses, remove direct count here
            review: 0, // If review maps to other statuses, remove direct count here
            revisionNeeded: 0 // If revisionNeeded maps to other statuses, remove direct count here 
        });
        return { tasks: mockTasks, stats };
        // --- End of mock data --- 
    }
    catch (error) {
        console.error("Error fetching translation tasks:", error);
        // Consider more specific error handling or re-throwing a custom error
        throw new Error('Failed to fetch translation tasks.');
    }
};
exports.getTranslationTasks = getTranslationTasks;
/**
 * Sends a request to retry a failed translation task.
 */
const retryTranslationTask = async (taskId) => {
    try {
        // Adjust method (POST, PUT) and endpoint as needed
        await base_1.axiosInstance.post(`/api/translations/tasks/${taskId}/retry`);
        console.log(`Retry request sent for task ${taskId}`);
    }
    catch (error) {
        console.error(`Error retrying task ${taskId}:`, error);
        // Re-throw or handle error appropriately for the UI
        throw new Error(`Failed to retry task ${taskId}.`);
    }
};
exports.retryTranslationTask = retryTranslationTask;
// --- END NEW: Segment Types ---
// --- NEW: API Functions for Segments --- 
/**
 * Generates mock segments for a given task ID.
 */
const generateMockSegments = (taskId, count = 10) => {
    const segments = [];
    const statuses = ['unconfirmed', 'confirmed', 'unconfirmed']; // Skew towards unconfirmed
    for (let i = 1; i <= count; i++) {
        const sourceText = `这是源文本段落 ${i}，用于任务 ${taskId}。它包含一些示例内容。`;
        const targetText = `This is target text segment ${i} for task ${taskId}. It contains some sample content.`;
        segments.push({
            _id: `${taskId}_seg_${i}`,
            taskId: taskId,
            sequence: i,
            source: sourceText,
            target: Math.random() < 0.1 ? '' : targetText, // Sometimes make target empty
            status: statuses[Math.floor(Math.random() * statuses.length)],
        });
    }
    return segments;
};
/**
 * Fetches translated segments for a specific task.
 * TODO: Replace mock data with actual API call.
 */
const getTranslatedSegments = async (taskId) => {
    console.log(`Fetching segments for task ${taskId} (using mock data)...`);
    await new Promise(resolve => setTimeout(resolve, 400)); // Simulate API delay
    try {
        // --- Replace with actual API call --- 
        // const response = await client.get<Segment[]>(`/api/translations/tasks/${taskId}/segments`);
        // return response.data;
        // --- End of replacement section ---
        // --- Mock data implementation --- 
        if (taskId.includes('fail')) { // Simulate failure for specific task IDs
            throw new Error('Simulated segment fetch failure.');
        }
        const mockSegments = generateMockSegments(taskId, 15);
        return mockSegments;
        // --- End of mock data --- 
    }
    catch (error) {
        console.error(`Error fetching segments for task ${taskId}:`, error);
        throw new Error(`Failed to fetch segments for task ${taskId}.`);
    }
};
exports.getTranslatedSegments = getTranslatedSegments;
/**
 * Updates a specific segment (e.g., saves target text or changes status).
 * TODO: Replace mock logic with actual API call.
 */
const updateSegment = async (segmentId, updatedData) => {
    console.log(`Updating segment ${segmentId} with:`, updatedData, '(mock update)');
    await new Promise(resolve => setTimeout(resolve, 150)); // Simulate API delay
    // --- Replace with actual API call --- 
    // const response = await client.put<Segment>(`/api/translations/segments/${segmentId}`, updatedData);
    // return response.data;
    // --- End of replacement section ---
    // --- Mock data implementation --- 
    // This mock just returns a dummy updated segment; a real implementation might not need to return anything
    // or might return the full updated task/segment list.
    if (segmentId.includes('fail')) {
        throw new Error('Simulated segment update failure.');
    }
    // Construct a plausible updated segment for the mock response
    const updatedMockSegment = {
        _id: segmentId,
        ...(updatedData.target !== undefined && { target: updatedData.target }),
        ...(updatedData.status !== undefined && { status: updatedData.status }),
    };
    // In a real scenario, you might not need to return the segment, or fetch it again.
    // We return a partial mock just for demo purposes.
    return updatedMockSegment;
    // --- End of mock data --- 
};
exports.updateSegment = updateSegment;
/**
 * Confirms all segments for a task (marks task as translation_confirmed).
 * TODO: Replace mock logic with actual API call.
 */
const confirmTranslationTask = async (taskId) => {
    console.log(`Confirming all segments for task ${taskId} (mock confirmation)`);
    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate API delay
    // --- Replace with actual API call --- 
    // await client.post(`/api/translations/tasks/${taskId}/confirm`);
    // --- End of replacement section ---
    // --- Mock data implementation --- 
    if (taskId.includes('fail_confirm')) {
        throw new Error('Simulated task confirmation failure.');
    }
    // No return value needed typically
    // --- End of mock data --- 
};
exports.confirmTranslationTask = confirmTranslationTask;
// --- END NEW: API Functions for Segments --- 
// ... existing confirmReviewTask etc. ...

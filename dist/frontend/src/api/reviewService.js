"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmReviewTask = exports.retryReviewTask = exports.getReviewTasks = void 0;
// frontend/src/api/reviewService.ts
const base_1 = require("./base");
// Mock data generation - Adapt based on ReviewTask/Status if needed
const generateMockReviewTasks = (count = 15) => {
    const tasks = [];
    // Use statuses relevant for review stage
    const statuses = [
        'in_review_queue', 'reviewing', 'review_failed', 'reviewed_pending_confirmation', 'completed'
    ];
    const languages = ['en', 'es', 'fr', 'de', 'ja', 'zh'];
    const basePriorities = ['low', 'medium', 'high'];
    for (let i = 1; i <= count; i++) {
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + Math.floor(Math.random() * 10)); // Shorter deadline variation for review
        tasks.push({
            _id: `task_review_${i}`,
            projectId: `proj_${Math.ceil(i / 3)}`,
            projectName: `Project Beta ${Math.ceil(i / 3)}`,
            fileName: `review_doc_${i}.txt`,
            sourceLang: languages[Math.floor(Math.random() * languages.length)],
            targetLang: languages[Math.floor(Math.random() * languages.length)],
            status: status, // Assign review-specific status
            priority: basePriorities[Math.floor(Math.random() * 3)],
            wordCount: Math.floor(Math.random() * 3000) + 300,
            deadline: deadline.toISOString().split('T')[0],
            createdAt: new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 5).toISOString(), // Created in last 5 days
            progress: status === 'completed' ? 100 : (status === 'in_review_queue' ? 0 : Math.floor(Math.random() * 99) + 1),
        });
    }
    return tasks;
};
/**
 * Fetches review tasks from the backend.
 * TODO: Replace mock data with actual API call.
 */
const getReviewTasks = async () => {
    console.log('Fetching review tasks (using mock data)...');
    await new Promise(resolve => setTimeout(resolve, 600)); // Simulate API delay
    try {
        // --- Replace with actual API call --- 
        // const response = await client.get<{ tasks: ReviewTask[], stats: ReviewStats }>('/api/reviews/tasks'); // Adjust endpoint
        // return response.data;
        // --- End of replacement section ---
        // --- Mock data implementation ---
        const mockTasks = generateMockReviewTasks(20);
        // Initialize stats object based on ReviewStats interface
        const initialStats = {
            total: 0, pending: 0, inProgress: 0, completed: 0, // Base stats
            in_review_queue: 0, reviewing: 0, review_failed: 0, reviewed_pending_confirmation: 0 // Review specific stats
        };
        const stats = mockTasks.reduce((acc, task) => {
            acc.total++;
            const statusKey = task.status; // Assumes status strings are valid keys
            // Dynamically count statuses based on ReviewStats keys
            if (statusKey !== 'total' && Object.prototype.hasOwnProperty.call(acc, statusKey)) {
                acc[statusKey] = (acc[statusKey] || 0) + 1;
            }
            // Handle potential mapping if base stats keys are reused (e.g., mapping 'in_review_queue' to 'pending')
            // Example: if (task.status === 'in_review_queue') acc.pending++;
            // Example: if (task.status === 'reviewing') acc.inProgress++; 
            return acc;
        }, initialStats);
        return { tasks: mockTasks, stats };
        // --- End of mock data --- 
    }
    catch (error) {
        console.error("Error fetching review tasks:", error);
        throw new Error('Failed to fetch review tasks.');
    }
};
exports.getReviewTasks = getReviewTasks;
/**
 * Sends a request to retry a failed review task.
 */
const retryReviewTask = async (taskId) => {
    try {
        await base_1.axiosInstance.post(`/api/reviews/tasks/${taskId}/retry`); // Adjust endpoint
        console.log(`Retry request sent for review task ${taskId}`);
    }
    catch (error) {
        console.error(`Error retrying review task ${taskId}:`, error);
        throw new Error(`Failed to retry review task ${taskId}.`);
    }
};
exports.retryReviewTask = retryReviewTask;
/**
 * Sends a request to confirm a completed review task.
 */
const confirmReviewTask = async (taskId) => {
    try {
        await base_1.axiosInstance.post(`/api/reviews/tasks/${taskId}/confirm`); // Adjust endpoint
        console.log(`Confirmation sent for review task ${taskId}`);
    }
    catch (error) {
        console.error(`Error confirming review task ${taskId}:`, error);
        throw new Error(`Failed to confirm review task ${taskId}.`);
    }
};
exports.confirmReviewTask = confirmReviewTask;
// Add other review-related API functions here (e.g., getReviewSegments)

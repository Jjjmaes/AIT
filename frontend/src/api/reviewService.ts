// frontend/src/api/reviewService.ts
import { axiosInstance as client } from './base';
// Assuming types might be shared or slightly different
// Re-use or define specific review types based on actual needs
import { TranslationTask as ReviewTaskBase, TaskStats as ReviewStatsBase } from './translationService'; 

// Example: Extend or modify types if review tasks/stats have different fields
// If they are identical, you can just use the imported types directly
export type ReviewTaskStatus = 
  | 'in_review_queue'
  | 'reviewing'
  | 'review_failed'
  | 'reviewed_pending_confirmation'
  | 'completed'; // Assume 'completed' is the final state after review confirmation
  // | TaskStatus; // Or combine with all translation statuses if needed

export interface ReviewTask extends ReviewTaskBase {
  // Override status type if needed
  status: ReviewTaskStatus; // Allow review specific or general statuses
  // Add review-specific fields if any
  // reviewScore?: number;
  // reviewerComments?: string;
}

export interface ReviewStats extends ReviewStatsBase {
  // Add review-specific stats if any
  in_review_queue?: number;
  reviewing?: number;
  review_failed?: number;
  reviewed_pending_confirmation?: number;
}

// Mock data generation - Adapt based on ReviewTask/Status if needed
const generateMockReviewTasks = (count = 15): ReviewTask[] => {
  const tasks: ReviewTask[] = [];
  // Use statuses relevant for review stage
  const statuses: ReviewTaskStatus[] = [
    'in_review_queue', 'reviewing', 'review_failed', 'reviewed_pending_confirmation', 'completed'
  ];
  const languages = ['en', 'es', 'fr', 'de', 'ja', 'zh'];
  const basePriorities: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];

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
export const getReviewTasks = async (): Promise<{ tasks: ReviewTask[], stats: ReviewStats }> => {
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
    const initialStats: ReviewStats = {
        total: 0, pending: 0, inProgress: 0, completed: 0, // Base stats
        in_review_queue: 0, reviewing: 0, review_failed: 0, reviewed_pending_confirmation: 0 // Review specific stats
    };

    const stats = mockTasks.reduce<ReviewStats>((acc, task) => {
      acc.total++;
      const statusKey = task.status as keyof ReviewStats; // Assumes status strings are valid keys
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

  } catch (error) {
    console.error("Error fetching review tasks:", error);
    throw new Error('Failed to fetch review tasks.');
  }
};

/**
 * Sends a request to retry a failed review task.
 */
export const retryReviewTask = async (taskId: string): Promise<void> => {
  try {
    await client.post(`/api/reviews/tasks/${taskId}/retry`); // Adjust endpoint
    console.log(`Retry request sent for review task ${taskId}`);
  } catch (error) {
    console.error(`Error retrying review task ${taskId}:`, error);
    throw new Error(`Failed to retry review task ${taskId}.`);
  }
};

/**
 * Sends a request to confirm a completed review task.
 */
export const confirmReviewTask = async (taskId: string): Promise<void> => {
    try {
      await client.post(`/api/reviews/tasks/${taskId}/confirm`); // Adjust endpoint
      console.log(`Confirmation sent for review task ${taskId}`);
    } catch (error) {
      console.error(`Error confirming review task ${taskId}:`, error);
      throw new Error(`Failed to confirm review task ${taskId}.`);
    }
  };


// Add other review-related API functions here (e.g., getReviewSegments)

import { axiosInstance as api } from './base';

// Define the payload for starting AI review
export interface StartAIReviewPayload {
  aiConfigId: string;
  reviewPromptTemplateId: string;
  // Add any other options the backend might need
}

// Define the expected response structure
export interface StartAIReviewResponse {
  success: boolean;
  message?: string;
  reviewJobId?: string; // Might return a job ID for polling review status
}

/**
 * Starts the AI review process for a specific file.
 */
export const startAIReview = async (
  projectId: string,
  fileId: string,
  payload: StartAIReviewPayload
): Promise<StartAIReviewResponse> => {
  const apiUrl = `/api/projects/${projectId}/files/${fileId}/review`; // Example API endpoint
  console.log(`Calling AI review endpoint: POST ${apiUrl}`, payload);
  try {
    // TODO: Replace with actual API call when backend is ready
    // Simulating a successful response for now
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
    console.warn('Simulating successful AI review start. Implement actual API call!');
    return {
      success: true,
      message: 'AI review process started successfully (simulated).',
      reviewJobId: `review-${fileId}-${Date.now()}` // Example job ID
    };
    // --- Replace simulation above with actual API call ---
    // const response = await api.post<StartAIReviewResponse>(apiUrl, payload);
    // return response.data;
    // -----------------------------------------------------
  } catch (error: any) {
    console.error(`Error starting AI review for file ${fileId}:`, error);
    const message = error.response?.data?.message || error.message || "Failed to start AI review.";
    return { success: false, message };
  }
};

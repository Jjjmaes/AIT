import { axiosInstance } from './base';

/**
 * Get all segments for a file with optional filtering
 */
export const getFileSegments = async (fileId: string, params?: any) => {
  const response = await axiosInstance.get(`/api/review/${fileId}/segments`, { params });
  return response.data;
};

/**
 * Confirm or update a segment
 */
export const confirmSegment = async ({
  fileId,
  segmentId,
  translation,
  confirmed,
}: {
  fileId: string;
  segmentId: string;
  translation: string;
  confirmed: boolean;
}) => {
  const response = await axiosInstance.post(`/api/review/${fileId}/segments/${segmentId}`, {
    translation,
    confirmed,
  });
  return response.data;
};

/**
 * Batch confirm multiple segments
 */
export const batchConfirmSegments = async ({
  fileId,
  segmentIds,
}: {
  fileId: string;
  segmentIds: string[];
}) => {
  const response = await axiosInstance.post(`/api/review/${fileId}/batch-confirm`, {
    segmentIds,
  });
  return response.data;
};

/**
 * Complete review for a file
 */
export const completeFileReview = async (fileId: string) => {
  const response = await axiosInstance.post(`/api/review/${fileId}/complete`);
  return response.data;
};

/**
 * Get issue statistics for a file
 */
export const getFileIssueStats = async (fileId: string) => {
  const response = await axiosInstance.get(`/api/review/${fileId}/issues/stats`);
  return response.data;
}; 
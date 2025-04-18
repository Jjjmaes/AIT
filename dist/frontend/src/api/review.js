"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFileIssueStats = exports.completeFileReview = exports.batchConfirmSegments = exports.confirmSegment = exports.getFileSegments = void 0;
const base_1 = require("./base");
/**
 * Get all segments for a file with optional filtering
 */
const getFileSegments = async (fileId, params) => {
    const response = await base_1.axiosInstance.get(`/api/review/${fileId}/segments`, { params });
    return response.data;
};
exports.getFileSegments = getFileSegments;
/**
 * Confirm or update a segment
 */
const confirmSegment = async ({ fileId, segmentId, translation, confirmed, }) => {
    const response = await base_1.axiosInstance.post(`/api/review/${fileId}/segments/${segmentId}`, {
        translation,
        confirmed,
    });
    return response.data;
};
exports.confirmSegment = confirmSegment;
/**
 * Batch confirm multiple segments
 */
const batchConfirmSegments = async ({ fileId, segmentIds, }) => {
    const response = await base_1.axiosInstance.post(`/api/review/${fileId}/batch-confirm`, {
        segmentIds,
    });
    return response.data;
};
exports.batchConfirmSegments = batchConfirmSegments;
/**
 * Complete review for a file
 */
const completeFileReview = async (fileId) => {
    const response = await base_1.axiosInstance.post(`/api/review/${fileId}/complete`);
    return response.data;
};
exports.completeFileReview = completeFileReview;
/**
 * Get issue statistics for a file
 */
const getFileIssueStats = async (fileId) => {
    const response = await base_1.axiosInstance.get(`/api/review/${fileId}/issues/stats`);
    return response.data;
};
exports.getFileIssueStats = getFileIssueStats;

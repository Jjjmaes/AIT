"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReviewers = exports.getUsers = void 0;
const base_1 = require("./base");
// Function to fetch users, potentially filtering by role
const getUsers = async (params) => {
    const response = await base_1.axiosInstance.get('/users', { params });
    return response.data;
};
exports.getUsers = getUsers;
// Specific function to get reviewers
const getReviewers = async () => {
    return (0, exports.getUsers)({ role: 'reviewer' }); // Assuming 'reviewer' is the role name
};
exports.getReviewers = getReviewers;

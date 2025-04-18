"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
// Create an Axios instance
const apiClient = axios_1.default.create({
    // The Vite proxy handles the base URL during development,
    // but you might need to set baseURL for production builds
    // baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
    // Default headers (e.g., for content type)
    headers: {
        'Content-Type': 'application/json',
    },
    // Optional: Set timeout
    // timeout: 10000,
});
// Add an interceptor for handling common responses or errors (optional)
apiClient.interceptors.response.use((response) => {
    // Any status code that lie within the range of 2xx cause this function to trigger
    // Return the data directly from successful responses
    return response.data;
}, (error) => {
    // Any status codes that falls outside the range of 2xx cause this function to trigger
    // Log the error or handle it globally
    console.error('API Error:', error.response || error.message);
    // Optionally, reformat the error or throw a custom error
    // return Promise.reject(new Error(error.response?.data?.message || error.message));
    return Promise.reject(error);
});
// Add an interceptor to include JWT token if available (example)
apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('authToken'); // Or get from state management
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});
exports.default = apiClient;

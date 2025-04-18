"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAuthenticated = exports.getCurrentUser = exports.logout = exports.login = void 0;
const base_1 = require("./base");
const login = async (credentials) => {
    // We expect the interceptor to return the data object (AuthResponse)
    // Use type assertion to tell TypeScript what the interceptor returns
    const responseData = await base_1.axiosInstance.post('/api/auth/login', credentials);
    // Now, check responseData directly (which IS the backend response body)
    if (responseData && responseData.success && responseData.data?.token) {
        localStorage.setItem('authToken', responseData.data.token);
        localStorage.setItem('userInfo', JSON.stringify(responseData.data.user));
    }
    else {
        // Use the message from the responseData if available
        const errorMessage = responseData?.message || 'Login failed: Invalid response from server';
        // Ensure we are throwing an actual error object
        throw new Error(errorMessage);
    }
    // Return the data object we received
    return responseData;
};
exports.login = login;
const logout = () => {
    // Remove token and user info from storage
    localStorage.removeItem('authToken');
    localStorage.removeItem('userInfo');
    // TODO: Optionally call a backend logout endpoint if it exists
    // await apiClient.post('/api/auth/logout');
};
exports.logout = logout;
const getCurrentUser = () => {
    const userInfo = localStorage.getItem('userInfo');
    try {
        // The stored item IS the user object itself
        return userInfo ? JSON.parse(userInfo) : null;
    }
    catch (e) {
        console.error("Failed to parse user info from localStorage", e);
        return null;
    }
};
exports.getCurrentUser = getCurrentUser;
const isAuthenticated = () => {
    return !!localStorage.getItem('authToken');
};
exports.isAuthenticated = isAuthenticated;

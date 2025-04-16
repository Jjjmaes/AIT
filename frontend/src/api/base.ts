import axios from 'axios';

// Determine the base URL from environment or default
const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Set baseURL to just the raw backend origin, without /api
export const axiosInstance = axios.create({
  baseURL: rawBaseUrl,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true,
});

// Add request interceptor for auth token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    console.log(`[Request Interceptor] URL: ${config.url}`);
    if (token) {
      console.log(`[Request Interceptor] Found token: ${token.substring(0, 10)}...`);
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.log('[Request Interceptor] No token found in localStorage.');
    }
    console.log('[Request Interceptor] Final config headers:', config.headers);
    return config;
  },
  (error) => {
    console.error('[Request Interceptor] Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for common error handling
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle authentication errors
    if (error.response && error.response.status === 401) {
      // Clear token and redirect to login if unauthorized
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    
    // Standardize error response format
    if (error.response && error.response.data) {
      return Promise.reject(error.response.data);
    }
    
    return Promise.reject({
      success: false,
      message: error.message || '发生未知错误',
    });
  }
); 
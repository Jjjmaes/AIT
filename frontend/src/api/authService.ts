import { axiosInstance as apiClient } from './base';

// TODO: Define types for login credentials and API response
interface LoginCredentials {
  email: string;
  password: string;
}

interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    token: string;
    user: {
      id: string;
      username: string;
      fullName?: string;
      email: string;
      role: string;
    };
  };
}

export const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  // We expect the interceptor to return the data object (AuthResponse)
  // Use type assertion to tell TypeScript what the interceptor returns
  const responseData = await apiClient.post('/api/auth/login', credentials) as AuthResponse;

  // Now, check responseData directly (which IS the backend response body)
  if (responseData && responseData.success && responseData.data?.token) { 
      localStorage.setItem('authToken', responseData.data.token);
      localStorage.setItem('userInfo', JSON.stringify(responseData.data.user)); 
  } else {
      // Use the message from the responseData if available
      const errorMessage = responseData?.message || 'Login failed: Invalid response from server'; 
      // Ensure we are throwing an actual error object
      throw new Error(errorMessage); 
  }
  // Return the data object we received
  return responseData; 
};

export const logout = () => {
  // Remove token and user info from storage
  localStorage.removeItem('authToken');
  localStorage.removeItem('userInfo');
  // TODO: Optionally call a backend logout endpoint if it exists
  // await apiClient.post('/api/auth/logout');
};

export const getCurrentUser = (): { 
  id: string; 
  username: string; 
  fullName?: string; 
  email: string; 
  role: string; 
} | null => { 
    const userInfo = localStorage.getItem('userInfo');
    try {
        // The stored item IS the user object itself
        return userInfo ? JSON.parse(userInfo) : null; 
    } catch (e) {
        console.error("Failed to parse user info from localStorage", e);
        return null;
    }
};

export const isAuthenticated = (): boolean => {
    return !!localStorage.getItem('authToken');
}; 
import { axiosInstance as api } from './base';

// Basic User interface (adjust based on actual user data)
export interface User {
  _id: string;
  username: string;
  email: string;
  role: string; // Assuming role is a string like 'admin', 'reviewer'
}

// Response type for fetching users
export interface GetUsersResponse {
  success: boolean;
  data?: {
    users: User[];
    // Add pagination if the backend supports it
  };
  message?: string;
}

// Function to fetch users, potentially filtering by role
export const getUsers = async (params?: { role?: string }): Promise<GetUsersResponse> => {
  const response = await api.get<GetUsersResponse>('/api/users', { params });
  return response.data;
};

// Specific function to get reviewers
export const getReviewers = async (): Promise<GetUsersResponse> => {
    return getUsers({ role: 'reviewer' }); // Assuming 'reviewer' is the role name
}; 
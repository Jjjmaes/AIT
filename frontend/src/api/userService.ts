import apiClient from './client';

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
  const responseData = await apiClient.get<GetUsersResponse>('/api/users', { params });
  // Use double cast because TS infers AxiosResponse, but interceptor returns the data part
  return responseData as unknown as GetUsersResponse;
};

// Specific function to get reviewers
export const getReviewers = async (): Promise<GetUsersResponse> => {
    return getUsers({ role: 'reviewer' }); // Assuming 'reviewer' is the role name
}; 
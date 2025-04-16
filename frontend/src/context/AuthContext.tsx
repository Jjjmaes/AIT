import { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance as api } from '../api/base'; // Use axiosInstance from base.ts

// Define the User structure expected in the frontend
interface User {
  id: string;
  name: string; // Ensure backend sends 'name' or adapt mapping below
  email: string;
  role: 'admin' | 'reviewer';
}

// Define the shape of the Authentication Context
interface AuthContextType {
  user: User | null;
  loading: boolean; // Indicates if auth status is being checked
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
}

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true, // Start in loading state initially
  error: null,
  login: async () => {},
  logout: () => {},
  isAdmin: false,
});

// Custom hook to easily consume the AuthContext
export const useAuth = () => useContext(AuthContext);

// Define props for the AuthProvider component
interface AuthProviderProps {
  children: ReactNode;
}

// The AuthProvider component manages the authentication state
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // Initial auth check is loading
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Function to check authentication status (e.g., on app load)
  const checkAuth = useCallback(async () => {
    setLoading(true);
    console.log('[AuthContext] checkAuth running...');
    const token = localStorage.getItem('authToken'); // Use consistent key
    console.log('[AuthContext] Token from localStorage (authToken):', token ? `${token.substring(0, 10)}...` : 'null');

    if (!token) {
      console.log('[AuthContext] No token found, setting loading false.');
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      console.log('[AuthContext] Calling /api/auth/profile using axiosInstance...');
      // Use the aliased axiosInstance (api)
      const response = await api.get('/api/auth/profile');
      console.log('[AuthContext] /api/auth/profile response received:', response.data);

      // --- Adjust based on ACTUAL profile response structure ---
      // Assuming profile returns { success: true, data: { user: {...} } }
      // Or potentially the user object directly if interceptor unwraps it
      const userData = response.data?.data?.user || response.data?.data;
      // --- End Adjustment ---

      if (userData && userData.id) {
        console.log('[AuthContext] /api/auth/profile success. User data:', userData);
        // Map backend data (which might have 'username') to frontend 'name'
        const userToSet: User = {
          id: userData.id,
          email: userData.email || 'N/A',
          role: userData.role || 'reviewer',
          name: userData.name || userData.username || 'User', // Prioritize name, fallback to username
        };

        // --- Simple Validation ---
        if (typeof userToSet.id === 'string' && typeof userToSet.email === 'string' && typeof userToSet.role === 'string' && typeof userToSet.name === 'string') {
          setUser(userToSet);
          console.log('[AuthContext] User state set from profile data.');
        } else {
          console.error('[AuthContext] Mismatched user data structure from profile:', userToSet);
          localStorage.removeItem('authToken'); // Use consistent key
          setUser(null);
        }
        // --- End Validation ---
      } else {
        console.error('[AuthContext] Failed to get valid user data from /api/auth/profile response:', response.data);
        localStorage.removeItem('authToken'); // Use consistent key
        setUser(null);
      }
    } catch (err: any) {
      console.error('[AuthContext] Error during checkAuth API call:', err);
      // Axios interceptor in base.ts should handle 401 (remove token, redirect)
      // For other errors during checkAuth, remove token and clear user state
      if (err.response?.status !== 401) {
         localStorage.removeItem('authToken'); // Use consistent key
      }
      setUser(null);
    } finally {
      setLoading(false);
      console.log('[AuthContext] checkAuth finished.');
    }
  }, []); // useCallback dependency array

  // Effect to run checkAuth once on component mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Login function
  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      console.log('[AuthContext] Attempting login API call using axiosInstance...');
      // Use the aliased axiosInstance (api)
      const response = await api.post('/api/auth/login', { email, password });
      console.log('[AuthContext] Login API response received:', response.data);

      // --- Adjust based on ACTUAL login response structure ---
      // Assuming login returns { success: true, data: { token: ..., user: ... } }
      // Or potentially { token: ..., user: ... } if interceptor unwraps 'data'
      const token = response.data?.data?.token || response.data?.token;
      const userFromServer = response.data?.data?.user || response.data?.user;
      // --- End Adjustment ---

      if (token && userFromServer) {
        console.log('[AuthContext] Login successful.');
        localStorage.setItem('authToken', token); // Use consistent key
        console.log('[AuthContext] Token stored in localStorage (\'authToken\').');

        // Map server data, prioritizing 'name' if available
        const userToSet: User = {
          id: userFromServer.id,
          email: userFromServer.email,
          role: userFromServer.role as ('admin' | 'reviewer'),
          name: userFromServer.name || userFromServer.username // Use name or username
        };

        // --- Simple Validation ---
        if (typeof userToSet.id === 'string' && typeof userToSet.email === 'string' && typeof userToSet.role === 'string' && typeof userToSet.name === 'string') {
          setUser(userToSet);
          console.log('[AuthContext] User state set after login:', userToSet);
          navigate('/dashboard'); // Navigate after successful state update
        } else {
          console.error('[AuthContext] Mismatched user data structure from login:', userFromServer);
          localStorage.removeItem('authToken'); // Use consistent key
          setError('登录响应的用户数据格式错误');
        }
        // --- End Validation ---
      } else {
        console.error("[AuthContext] Login API response format incorrect or missing data:", response.data);
        setError(response.data?.message || '登录响应格式错误或缺少数据');
      }
    } catch (err: any) {
      console.error('[AuthContext] Login failed:', err);
      setError(err.response?.data?.message || err.message || '登录失败，请检查凭据');
    } finally {
      setLoading(false);
      console.log('[AuthContext] Login function finished.');
    }
  };

  // Logout function
  const logout = () => {
    console.log('[AuthContext] Logging out...');
    localStorage.removeItem('authToken'); // Use consistent key
    setUser(null);
    // Redirect to login, replace history to prevent back button issues
    navigate('/login', { replace: true });
    console.log('[AuthContext] Logged out.');
  };

  // Derived state for convenience
  const isAdmin = user?.role === 'admin';

  // Provide the context value to children components
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        logout,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
import { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'reviewer';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  login: async () => {},
  logout: () => {},
  isAdmin: false,
});

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      console.log('[AuthContext] checkAuth running...');
      const token = localStorage.getItem('auth_token');
      console.log('[AuthContext] Token from localStorage:', token ? `${token.substring(0,10)}...` : 'null');
      if (!token) {
        console.log('[AuthContext] No token found, setting loading false.');
        setLoading(false);
        return;
      }

      try {
        console.log('[AuthContext] Calling /auth/profile...');
        const response = await api.get('/auth/profile');
        console.log('[AuthContext] /auth/profile response received:', response.data);

        // Backend sends { success: true, data: { id: ..., email: ..., ... } } (token payload)
        if (response.data && response.data.success && response.data.data && response.data.data.id) {
          const userDataFromToken = response.data.data;
          console.log('[AuthContext] /auth/profile success. User data from token payload:', userDataFromToken);

          const userToSet = {
            id: userDataFromToken.id, // Use id directly
            email: userDataFromToken.email || 'N/A',
            role: userDataFromToken.role || 'reviewer',
            name: userDataFromToken.name || userDataFromToken.username || 'User', // Use name or username
          };
          console.log('[AuthContext] Setting user state from token data:', userToSet);
          // Ensure the object structure matches the User interface
          if (typeof userToSet.id === 'string' && typeof userToSet.email === 'string' && typeof userToSet.role === 'string' && typeof userToSet.name === 'string') {
            setUser(userToSet as User); // Set user state from token
            console.log('[AuthContext] User state set from token data.');
          } else {
            console.error('[AuthContext] Mismatched user data structure from token:', userToSet);
            localStorage.removeItem('auth_token');
            console.log('[AuthContext] Removed token due to mismatched structure.');
          }

        } else {
          console.error('[AuthContext] Failed to get valid user data from /auth/profile response:', response.data);
          localStorage.removeItem('auth_token'); // Remove invalid token
          console.log('[AuthContext] Invalid token data, removed token.');
        }
      } catch (err: any) {
        console.error('[AuthContext] Error during checkAuth API call:', err);
        localStorage.removeItem('auth_token'); // Remove token on API error
        console.log('[AuthContext] API error during checkAuth, removed token.');
      } finally {
        setLoading(false);
        console.log('[AuthContext] checkAuth finished.');
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      console.log('[AuthContext] Attempting login API call...'); // Log start
      const response = await api.post('/auth/login', { email, password });
      console.log('[AuthContext] Login API response received:', response.data); // Log response

      // Backend sends { success: true, data: { token: "...", user: {...} } }
      if (response.data && response.data.success && response.data.data && response.data.data.token && response.data.data.user) {
          const token = response.data.data.token;
          const userFromServer = response.data.data.user;
          console.log('[AuthContext] Login successful. Token:', token ? `${token.substring(0,10)}...` : 'null');
          console.log('[AuthContext] User data from server:', userFromServer);

          localStorage.setItem('auth_token', token);
          console.log('[AuthContext] Token stored in localStorage.');

          // Check for required fields, accepting fullName or username for the 'name' field
          if (userFromServer && 
              typeof userFromServer.id === 'string' && 
              typeof userFromServer.email === 'string' && 
              typeof userFromServer.role === 'string' && 
              (typeof userFromServer.fullName === 'string' || typeof userFromServer.username === 'string') // Check for fullName or username
          ) {
            // Map server data to the frontend User interface
            const userToSet: User = {
              id: userFromServer.id,
              email: userFromServer.email,
              role: userFromServer.role as ('admin' | 'reviewer'), // Assert role type
              name: userFromServer.fullName || userFromServer.username // Use fullName first, fallback to username
            };
            setUser(userToSet);
            console.log('[AuthContext] User state set with mapped data:', userToSet);
            navigate('/dashboard');
            console.log('[AuthContext] Navigation to /dashboard triggered.');
          } else {
            console.error('[AuthContext] Mismatched user data structure from login:', userFromServer);
            localStorage.removeItem('auth_token');
            setError('登录响应的用户数据格式错误');
          }
      } else {
         console.error("[AuthContext] Login API response format incorrect:", response.data);
         setError(response.data?.message || '登录响应格式错误');
      }
    } catch (err: any) {
      // Log error but don't re-throw unless necessary to bubble up
      console.error('[AuthContext] Login failed:', err);
      // Set error state for the login page to display
      setError(err.response?.data?.message || err.message || '登录失败，请检查凭据');
    } finally {
      setLoading(false);
      console.log('[AuthContext] Login function finished.');
    }
  };

  const logout = () => {
    console.log('[AuthContext] Logging out...');
    localStorage.removeItem('auth_token');
    setUser(null);
    navigate('/login');
    console.log('[AuthContext] Logged out.');
  };

  const isAdmin = user?.role === 'admin';

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
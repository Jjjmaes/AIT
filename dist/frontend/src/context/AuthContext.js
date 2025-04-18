"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthProvider = exports.useAuth = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_router_dom_1 = require("react-router-dom");
const base_1 = require("../api/base"); // Use axiosInstance from base.ts
// Create the context with default values
const AuthContext = (0, react_1.createContext)({
    user: null,
    loading: true, // Start in loading state initially
    error: null,
    login: async () => { },
    logout: () => { },
    isAdmin: false,
});
// Custom hook to easily consume the AuthContext
const useAuth = () => (0, react_1.useContext)(AuthContext);
exports.useAuth = useAuth;
// The AuthProvider component manages the authentication state
const AuthProvider = ({ children }) => {
    const [user, setUser] = (0, react_1.useState)(null);
    const [loading, setLoading] = (0, react_1.useState)(true); // Initial auth check is loading
    const [error, setError] = (0, react_1.useState)(null);
    const navigate = (0, react_router_dom_1.useNavigate)();
    // Function to check authentication status (e.g., on app load)
    const checkAuth = (0, react_1.useCallback)(async () => {
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
            console.log('[AuthContext] Calling /auth/profile using axiosInstance...');
            // Use the aliased axiosInstance (api)
            const response = await base_1.axiosInstance.get('/auth/profile');
            console.log('[AuthContext] /auth/profile response received:', response.data);
            // --- Adjust based on ACTUAL profile response structure ---
            // Assuming profile returns { success: true, data: { user: {...} } }
            // Or potentially the user object directly if interceptor unwraps it
            const userData = response.data?.data?.user || response.data?.data;
            // --- End Adjustment ---
            if (userData && userData.id) {
                console.log('[AuthContext] /auth/profile success. User data:', userData);
                // Map backend data (which might have 'username') to frontend 'name'
                const userToSet = {
                    id: userData.id,
                    email: userData.email || 'N/A',
                    role: userData.role || 'reviewer',
                    name: userData.name || userData.username || 'User', // Prioritize name, fallback to username
                };
                // --- Simple Validation ---
                if (typeof userToSet.id === 'string' && typeof userToSet.email === 'string' && typeof userToSet.role === 'string' && typeof userToSet.name === 'string') {
                    setUser(userToSet);
                    console.log('[AuthContext] User state set from profile data.');
                }
                else {
                    console.error('[AuthContext] Mismatched user data structure from profile:', userToSet);
                    localStorage.removeItem('authToken'); // Use consistent key
                    setUser(null);
                }
                // --- End Validation ---
            }
            else {
                console.error('[AuthContext] Failed to get valid user data from /auth/profile response:', response.data);
                localStorage.removeItem('authToken'); // Use consistent key
                setUser(null);
            }
        }
        catch (err) {
            console.error('[AuthContext] Error during checkAuth API call:', err);
            // Axios interceptor in base.ts should handle 401 (remove token, redirect)
            // For other errors during checkAuth, remove token and clear user state
            if (err.response?.status !== 401) {
                localStorage.removeItem('authToken'); // Use consistent key
            }
            setUser(null);
        }
        finally {
            setLoading(false);
            console.log('[AuthContext] checkAuth finished.');
        }
    }, []); // useCallback dependency array
    // Effect to run checkAuth once on component mount
    (0, react_1.useEffect)(() => {
        checkAuth();
    }, [checkAuth]);
    // Login function
    const login = async (email, password) => {
        setLoading(true);
        setError(null);
        try {
            console.log('[AuthContext] Attempting login API call using axiosInstance...');
            // Use the aliased axiosInstance (api)
            const response = await base_1.axiosInstance.post('/auth/login', { email, password });
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
                const userToSet = {
                    id: userFromServer.id,
                    email: userFromServer.email,
                    role: userFromServer.role,
                    name: userFromServer.name || userFromServer.username // Use name or username
                };
                // --- Simple Validation ---
                if (typeof userToSet.id === 'string' && typeof userToSet.email === 'string' && typeof userToSet.role === 'string' && typeof userToSet.name === 'string') {
                    setUser(userToSet);
                    console.log('[AuthContext] User state set after login:', userToSet);
                    navigate('/dashboard'); // Navigate after successful state update
                }
                else {
                    console.error('[AuthContext] Mismatched user data structure from login:', userFromServer);
                    localStorage.removeItem('authToken'); // Use consistent key
                    setError('登录响应的用户数据格式错误');
                }
                // --- End Validation ---
            }
            else {
                console.error("[AuthContext] Login API response format incorrect or missing data:", response.data);
                setError(response.data?.message || '登录响应格式错误或缺少数据');
            }
        }
        catch (err) {
            console.error('[AuthContext] Login failed:', err);
            setError(err.response?.data?.message || err.message || '登录失败，请检查凭据');
        }
        finally {
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
    return ((0, jsx_runtime_1.jsx)(AuthContext.Provider, { value: {
            user,
            loading,
            error,
            login,
            logout,
            isAdmin,
        }, children: children }));
};
exports.AuthProvider = AuthProvider;

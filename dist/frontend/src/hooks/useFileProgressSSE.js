"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useFileProgressSSE = useFileProgressSSE;
const react_1 = require("react");
const AuthContext_1 = require("../context/AuthContext"); // Adjust path if necessary
const fileStore_1 = require("../store/fileStore"); // Keep this for file state
function useFileProgressSSE() {
    const eventSourceRef = (0, react_1.useRef)(null);
    // Get user status from Auth Context
    const { user } = (0, AuthContext_1.useAuth)();
    const isAuthenticated = !!user; // User is authenticated if user object exists
    // Get the update function from the file store
    const updateFileProgressInStore = (0, fileStore_1.useFileStore)((state) => state.updateFileProgress);
    (0, react_1.useEffect)(() => {
        // Only connect if authenticated
        if (!isAuthenticated) {
            if (eventSourceRef.current) {
                console.log('SSE: User not authenticated/logged out, closing connection.');
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
            return;
        }
        // Prevent duplicate connections if component re-renders quickly
        if (eventSourceRef.current) {
            return;
        }
        console.log('SSE: Attempting to connect to /api/sse/updates');
        const es = new EventSource('/api/sse/updates'); // Assumes auth cookie handles auth
        eventSourceRef.current = es;
        es.onopen = () => {
            console.log("SSE: Connection opened successfully.");
        };
        es.onerror = (err) => {
            console.error("SSE: EventSource failed:", err);
            es.close(); // Close on error
            eventSourceRef.current = null;
            // Optionally add retry logic here
        };
        // Listen for our specific event
        es.addEventListener('fileProgressUpdate', (event) => {
            try {
                const data = JSON.parse(event.data);
                // console.log('SSE: Received fileProgressUpdate:', data); // For debugging
                if (data && data.fileId && data.progress !== undefined && data.status) {
                    // Update the Zustand store with the new progress/status
                    updateFileProgressInStore(data.fileId, data.progress, data.status);
                }
                else {
                    console.warn("SSE: Received incomplete fileProgressUpdate data:", data);
                }
            }
            catch (e) {
                console.error('SSE: Failed to parse fileProgressUpdate data:', e);
            }
        });
        // Cleanup function to close connection when hook unmounts or auth changes
        return () => {
            if (eventSourceRef.current) {
                console.log("SSE: Closing connection.");
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
        };
        // updateFileProgressInStore dependency ensures effect re-runs if store instance changes (unlikely but safe)
    }, [isAuthenticated, updateFileProgressInStore]); // Re-run if authentication status changes
    // This hook manages the connection side-effect and updates the store.
    // It doesn't need to return values for the component to consume directly.
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_router_dom_1 = require("react-router-dom");
const projectService_1 = require("../api/projectService"); // Import API function and type
const projectConstants_1 = require("../constants/projectConstants");
// Helper function to get priority label (could be moved to a utils file)
const getPriorityLabel = (value) => {
    if (value === null || value === undefined)
        return null;
    const found = projectConstants_1.PRIORITIES.find(p => p.value === value);
    return found ? found.label : null; // Return label or null if not found
};
// Helper function to get status label
const getStatusLabel = (value) => {
    if (!value)
        return null;
    const found = projectConstants_1.STATUSES.find(s => s.value === value);
    return found ? found.label : value; // Return label or raw value if not found
};
// Helper to get priority color
const getPriorityColor = (value) => {
    if (value === null || value === undefined)
        return '#888';
    switch (value) {
        case 3: return '#e53935'; // High - Red
        case 2: return '#fb8c00'; // Medium - Orange
        case 1: return '#43a047'; // Low - Green
        default: return '#888';
    }
};
// Helper to get status color
const getStatusColor = (value) => {
    if (!value)
        return '#888';
    switch (value) {
        case 'active': return '#1976d2'; // Blue
        case 'in_progress': return '#fb8c00'; // Orange
        case 'completed': return '#43a047'; // Green
        case 'archived': return '#757575'; // Grey
        case 'pending': return '#9e9e9e'; // Light Grey
        default: return '#888';
    }
};
const ProjectDetailPage = () => {
    const { projectId } = (0, react_router_dom_1.useParams)();
    const navigate = (0, react_router_dom_1.useNavigate)(); // Initialize navigate
    const [project, setProject] = (0, react_1.useState)(null);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const [isDeleting, setIsDeleting] = (0, react_1.useState)(false); // State for delete operation
    (0, react_1.useEffect)(() => {
        // Create AbortController
        const controller = new AbortController();
        const signal = controller.signal;
        const fetchProject = async () => {
            // Keep the check for 'create' as a quick exit
            if (projectId === 'create') {
                setError('无效的项目ID');
                setIsLoading(false);
                setProject(null);
                return;
            }
            if (!projectId) {
                setError('未提供项目ID');
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            setError(null);
            try {
                console.log(`[ProjectDetailPage] Fetching project with ID: ${projectId}`);
                // Pass the signal to the API call
                const response = await (0, projectService_1.getProjectById)(projectId, { signal });
                // Check if the request was aborted before processing response
                if (signal.aborted) {
                    console.log('[ProjectDetailPage] Fetch aborted.');
                    return;
                }
                if (response.success && response.data?.project) {
                    // Use the nested project object
                    setProject(response.data.project);
                }
                else if (response.success && !response.data?.project) {
                    // Handle case where success is true but project data is missing
                    setError('获取项目成功，但未找到项目数据。');
                    setProject(null);
                }
                else {
                    setError(response.message || 'Failed to fetch project details');
                    setProject(null);
                }
            }
            catch (err) {
                // Check if the error is due to abortion
                if (signal.aborted || err.name === 'CanceledError') {
                    console.log('[ProjectDetailPage] Fetch cancelled/aborted.');
                }
                else {
                    console.error('[ProjectDetailPage] Fetch error:', err);
                    setError(err.response?.data?.message || err.message || 'An error occurred');
                    setProject(null);
                }
            }
            finally {
                // Only set loading false if the request wasn't aborted
                if (!signal.aborted) {
                    setIsLoading(false);
                }
            }
        };
        fetchProject();
        // Cleanup function to abort request on unmount or projectId change
        return () => {
            console.log(`[ProjectDetailPage] Cleanup: Aborting fetch for ${projectId}`);
            controller.abort();
        };
    }, [projectId]);
    const handleDelete = async () => {
        if (!projectId)
            return;
        if (!window.confirm(`确定要删除项目 "${project?.name}" 吗？此操作不可撤销。`)) {
            return;
        }
        setIsDeleting(true);
        setError(null);
        try {
            const response = await (0, projectService_1.deleteProject)(projectId);
            if (response.success) {
                console.log('Project deleted successfully');
                navigate('/projects'); // Navigate to projects list after deletion
            }
            else {
                setError(response.message || 'Failed to delete project.');
            }
        }
        catch (err) {
            console.error('Delete project error:', err);
            setError(err.response?.data?.message || err.message || 'An error occurred while deleting the project.');
        }
        finally {
            setIsDeleting(false);
        }
    };
    if (isLoading) {
        return ((0, jsx_runtime_1.jsx)("div", { style: {
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '200px',
                color: '#666'
            }, children: (0, jsx_runtime_1.jsx)("div", { children: (0, jsx_runtime_1.jsx)("p", { style: { fontSize: '1.1rem' }, children: "\u6B63\u5728\u52A0\u8F7D\u9879\u76EE\u8BE6\u60C5..." }) }) }));
    }
    if (error) {
        return ((0, jsx_runtime_1.jsxs)("div", { style: {
                padding: '1rem',
                backgroundColor: '#ffebee',
                color: '#c62828',
                borderRadius: '8px',
                maxWidth: '800px',
                margin: '0 auto',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }, children: [(0, jsx_runtime_1.jsxs)("p", { style: { margin: 0 }, children: ["\u9519\u8BEF: ", error] }), (0, jsx_runtime_1.jsx)("button", { onClick: () => navigate('/projects'), style: {
                        marginTop: '1rem',
                        padding: '0.5rem 1rem',
                        backgroundColor: 'white',
                        border: '1px solid #c62828',
                        borderRadius: '4px',
                        color: '#c62828',
                        cursor: 'pointer'
                    }, children: "\u8FD4\u56DE\u9879\u76EE\u5217\u8868" })] }));
    }
    if (!project) {
        return ((0, jsx_runtime_1.jsxs)("div", { style: {
                padding: '1rem',
                backgroundColor: '#f5f5f5',
                color: '#666',
                borderRadius: '8px',
                maxWidth: '800px',
                margin: '0 auto',
                textAlign: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }, children: [(0, jsx_runtime_1.jsx)("p", { children: "\u672A\u627E\u5230\u9879\u76EE\u4FE1\u606F" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => navigate('/projects'), style: {
                        marginTop: '0.5rem',
                        padding: '0.5rem 1rem',
                        backgroundColor: 'white',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }, children: "\u8FD4\u56DE\u9879\u76EE\u5217\u8868" })] }));
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "project-detail-page", style: {
            maxWidth: '960px',
            margin: '0 auto',
            padding: '1rem'
        }, children: [(0, jsx_runtime_1.jsxs)("div", { style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1.5rem',
                    paddingBottom: '0.75rem',
                    borderBottom: '1px solid #e0e0e0'
                }, children: [(0, jsx_runtime_1.jsx)("h1", { style: { margin: 0, color: '#333' }, children: "\u9879\u76EE\u8BE6\u60C5" }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: "/projects", style: {
                            padding: '0.5rem 1rem',
                            backgroundColor: 'white',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            color: '#555',
                            textDecoration: 'none'
                        }, children: "\u8FD4\u56DE\u9879\u76EE\u5217\u8868" })] }), (0, jsx_runtime_1.jsx)("div", { style: {
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                    marginBottom: '1.5rem',
                    overflow: 'hidden'
                }, children: (0, jsx_runtime_1.jsx)("div", { style: {
                        padding: '1.5rem',
                        position: 'relative'
                    }, children: (0, jsx_runtime_1.jsx)("div", { style: {
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            flexWrap: 'wrap',
                            gap: '1rem'
                        }, children: (0, jsx_runtime_1.jsxs)("div", { style: { flex: '1' }, children: [(0, jsx_runtime_1.jsx)("h2", { style: { margin: '0 0 0.5rem 0', color: '#333', fontSize: '1.75rem' }, children: project.name }), (0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }, children: [project.status && ((0, jsx_runtime_1.jsx)("span", { style: {
                                                display: 'inline-block',
                                                backgroundColor: getStatusColor(project.status),
                                                color: 'white',
                                                padding: '0.25rem 0.75rem',
                                                borderRadius: '4px',
                                                fontSize: '0.875rem',
                                                fontWeight: 'bold'
                                            }, children: getStatusLabel(project.status) })), project.priority !== undefined && project.priority !== null && ((0, jsx_runtime_1.jsxs)("span", { style: {
                                                display: 'inline-block',
                                                backgroundColor: getPriorityColor(project.priority),
                                                color: 'white',
                                                padding: '0.25rem 0.75rem',
                                                borderRadius: '4px',
                                                fontSize: '0.875rem',
                                                fontWeight: 'bold'
                                            }, children: ["\u4F18\u5148\u7EA7: ", getPriorityLabel(project.priority)] })), project.deadline && ((0, jsx_runtime_1.jsxs)("span", { style: {
                                                display: 'inline-block',
                                                backgroundColor: '#f5f5f5',
                                                color: new Date(project.deadline) < new Date() ? '#c62828' : '#333',
                                                padding: '0.25rem 0.75rem',
                                                borderRadius: '4px',
                                                fontSize: '0.875rem'
                                            }, children: ["\u622A\u6B62\u65E5\u671F: ", new Date(project.deadline).toLocaleDateString()] }))] }), project.description && ((0, jsx_runtime_1.jsx)("div", { style: { marginBottom: '1rem' }, children: (0, jsx_runtime_1.jsx)("p", { style: { margin: '0', color: '#555', fontSize: '1rem' }, children: project.description }) }))] }) }) }) }), (0, jsx_runtime_1.jsxs)("div", { style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '1.5rem',
                    marginBottom: '1.5rem'
                }, children: [(0, jsx_runtime_1.jsxs)("div", { style: {
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                            overflow: 'hidden'
                        }, children: [(0, jsx_runtime_1.jsx)("div", { style: {
                                    padding: '1rem',
                                    backgroundColor: '#f5f5f5',
                                    borderBottom: '1px solid #eee',
                                    fontWeight: 'bold',
                                    fontSize: '1.1rem',
                                    color: '#333'
                                }, children: "\u9879\u76EE\u4FE1\u606F" }), (0, jsx_runtime_1.jsx)("div", { style: { padding: '1rem' }, children: (0, jsx_runtime_1.jsx)("table", { style: { width: '100%', borderCollapse: 'collapse' }, children: (0, jsx_runtime_1.jsxs)("tbody", { children: [project.domain && ((0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { style: { padding: '0.5rem 0', borderBottom: '1px solid #eee', color: '#666', width: '35%' }, children: "\u9886\u57DF" }), (0, jsx_runtime_1.jsx)("td", { style: { padding: '0.5rem 0', borderBottom: '1px solid #eee' }, children: project.domain })] })), project.industry && ((0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { style: { padding: '0.5rem 0', borderBottom: '1px solid #eee', color: '#666', width: '35%' }, children: "\u884C\u4E1A" }), (0, jsx_runtime_1.jsx)("td", { style: { padding: '0.5rem 0', borderBottom: '1px solid #eee' }, children: project.industry })] })), project.manager && ((0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { style: { padding: '0.5rem 0', borderBottom: '1px solid #eee', color: '#666', width: '35%' }, children: "\u7BA1\u7406\u5458" }), (0, jsx_runtime_1.jsx)("td", { style: { padding: '0.5rem 0', borderBottom: '1px solid #eee' }, children: project.manager.username })] })), (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { style: { padding: '0.5rem 0', borderBottom: '1px solid #eee', color: '#666', width: '35%' }, children: "\u521B\u5EFA\u4E8E" }), (0, jsx_runtime_1.jsx)("td", { style: { padding: '0.5rem 0', borderBottom: '1px solid #eee' }, children: new Date(project.createdAt).toLocaleString() })] }), (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { style: { padding: '0.5rem 0', color: '#666', width: '35%' }, children: "\u6700\u540E\u66F4\u65B0" }), (0, jsx_runtime_1.jsx)("td", { style: { padding: '0.5rem 0' }, children: new Date(project.updatedAt).toLocaleString() })] })] }) }) })] }), (0, jsx_runtime_1.jsxs)("div", { style: {
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                            overflow: 'hidden'
                        }, children: [(0, jsx_runtime_1.jsx)("div", { style: {
                                    padding: '1rem',
                                    backgroundColor: '#f5f5f5',
                                    borderBottom: '1px solid #eee',
                                    fontWeight: 'bold',
                                    fontSize: '1.1rem',
                                    color: '#333'
                                }, children: "\u8BED\u8A00\u5BF9" }), (0, jsx_runtime_1.jsx)("div", { style: { padding: '1rem' }, children: project.languagePairs && project.languagePairs.length > 0 ? ((0, jsx_runtime_1.jsx)("div", { children: project.languagePairs.map((pair, index) => ((0, jsx_runtime_1.jsxs)("div", { style: {
                                            padding: '0.75rem',
                                            backgroundColor: index % 2 === 0 ? '#f9f9f9' : 'white',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            borderBottom: index !== project.languagePairs.length - 1 ? '1px solid #eee' : 'none'
                                        }, children: [(0, jsx_runtime_1.jsx)("div", { style: { fontWeight: 'bold' }, children: pair.source }), (0, jsx_runtime_1.jsx)("div", { style: { color: '#666' }, children: (0, jsx_runtime_1.jsx)("svg", { width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", xmlns: "http://www.w3.org/2000/svg", children: (0, jsx_runtime_1.jsx)("path", { d: "M5 12H19M19 12L13 6M19 12L13 18", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }) }) }), (0, jsx_runtime_1.jsx)("div", { style: { fontWeight: 'bold' }, children: pair.target })] }, index))) })) : ((0, jsx_runtime_1.jsx)("p", { style: { color: '#666', textAlign: 'center', margin: '1rem 0' }, children: "\u672A\u8BBE\u7F6E\u8BED\u8A00\u5BF9" })) })] })] }), (0, jsx_runtime_1.jsxs)("div", { style: {
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                    overflow: 'hidden',
                    marginBottom: '2rem'
                }, children: [(0, jsx_runtime_1.jsx)("div", { style: {
                            padding: '1rem',
                            backgroundColor: '#f5f5f5',
                            borderBottom: '1px solid #eee',
                            fontWeight: 'bold',
                            fontSize: '1.1rem',
                            color: '#333'
                        }, children: "\u9879\u76EE\u64CD\u4F5C" }), (0, jsx_runtime_1.jsxs)("div", { style: {
                            padding: '1.5rem',
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '1rem'
                        }, children: [(0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: `/projects/${projectId}/files`, style: {
                                    padding: '0.75rem 1.25rem',
                                    backgroundColor: '#e3f2fd',
                                    color: '#1976d2',
                                    border: '1px solid #bbdefb',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    textDecoration: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    fontWeight: 'bold'
                                }, children: "\u67E5\u770B\u6587\u4EF6" }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: `/projects/${projectId}/edit`, style: {
                                    padding: '0.75rem 1.25rem',
                                    backgroundColor: '#fff3e0',
                                    color: '#f57c00',
                                    border: '1px solid #ffe0b2',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    textDecoration: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    fontWeight: 'bold'
                                }, children: "\u7F16\u8F91\u9879\u76EE" }), (0, jsx_runtime_1.jsx)("button", { onClick: handleDelete, disabled: isDeleting, style: {
                                    padding: '0.75rem 1.25rem',
                                    backgroundColor: '#ffebee',
                                    color: '#c62828',
                                    border: '1px solid #ffcdd2',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    opacity: isDeleting ? 0.7 : 1
                                }, children: isDeleting ? '删除中...' : '删除项目' })] })] })] }));
};
exports.default = ProjectDetailPage;

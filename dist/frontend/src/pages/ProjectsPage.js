"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_router_dom_1 = require("react-router-dom");
const projectService_1 = require("../api/projectService");
// Import PRIORITIES and STATUSES to map value to label
const projectConstants_1 = require("../constants/projectConstants");
const axios_1 = __importDefault(require("axios"));
// Helper function to get priority label
const getPriorityLabel = (value) => {
    if (value === null || value === undefined)
        return null;
    const found = projectConstants_1.PRIORITIES.find(p => p.value === value);
    return found ? found.label : null; // Return label or null if not found
};
// Helper to get Status label (optional, can display raw status too)
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
    // Map priority values to colors: high (red), medium (orange), low (green)
    switch (value) {
        case 2: return '#e53935'; // High - Red
        case 1: return '#fb8c00'; // Medium - Orange
        case 0: return '#43a047'; // Low - Green
        default: return '#888';
    }
};
// Helper to get status color
const getStatusColor = (value) => {
    if (!value)
        return '#888';
    switch (value) {
        case 'active': return '#1976d2'; // Blue
        case 'completed': return '#43a047'; // Green
        case 'archived': return '#757575'; // Grey
        case 'draft': return '#9e9e9e'; // Light Grey
        default: return '#888';
    }
};
const ProjectsPage = () => {
    const [projects, setProjects] = (0, react_1.useState)([]);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    // State for filters and search
    const [statusFilter, setStatusFilter] = (0, react_1.useState)('');
    const [priorityFilter, setPriorityFilter] = (0, react_1.useState)('');
    const [searchQuery, setSearchQuery] = (0, react_1.useState)('');
    // Revert to single useEffect hook
    (0, react_1.useEffect)(() => {
        const controller = new AbortController();
        const signal = controller.signal;
        const fetchProjects = async () => {
            setIsLoading(true);
            setError(null);
            const params = {
                limit: 20,
                status: statusFilter || undefined,
                priority: priorityFilter ? parseInt(priorityFilter, 10) : undefined,
                search: searchQuery || undefined,
            };
            try {
                console.log('[ProjectsPage] Fetching projects with params:', params);
                const response = await (0, projectService_1.getProjects)(params, { signal });
                console.log('[ProjectsPage] Raw response received from getProjects:', response);
                if (signal.aborted) {
                    console.log('[ProjectsPage] Request aborted.');
                    return;
                }
                // The response object is { success: boolean, data: { projects: [], pagination: {} }, message?: string }
                // Correctly check for the nested projects array
                if (response && response.success && response.data && Array.isArray(response.data.projects)) {
                    console.log('[ProjectsPage] Successfully found response.data.projects:', response.data.projects);
                    setProjects(response.data.projects);
                    // TODO: Handle pagination from response.data.pagination
                }
                else {
                    // This block runs if response format is unexpected or success is false
                    console.error('[ProjectsPage] Invalid project data structure received or request failed:', response);
                    setError(response?.message || '获取项目数据失败或格式错误');
                    setProjects([]);
                }
            }
            catch (err) {
                if (signal.aborted || axios_1.default.isCancel(err)) {
                    console.log('[ProjectsPage] Fetch cancelled or aborted.');
                }
                else {
                    console.error('[ProjectsPage] API Error fetching projects:', err.response || err);
                    setError(err.response?.data?.message || err.message || '获取项目时发生错误');
                    setProjects([]);
                }
            }
            finally {
                if (!signal.aborted) {
                    console.log('[ProjectsPage] Setting loading false.');
                    setIsLoading(false);
                }
            }
        };
        fetchProjects();
        return () => {
            controller.abort();
        };
        // Restore original dependencies
    }, [statusFilter, priorityFilter, searchQuery]);
    // Handle search input change directly
    const handleSearchChange = (event) => {
        setSearchQuery(event.target.value);
    };
    const handleRefresh = () => {
        // Simply trigger a re-fetch by forcing the useEffect to run again
        setIsLoading(true);
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "projects-page", children: [(0, jsx_runtime_1.jsxs)("div", { className: "page-header", style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1.5rem',
                    padding: '0.5rem 0',
                    borderBottom: '1px solid #e0e0e0'
                }, children: [(0, jsx_runtime_1.jsx)("h1", { style: { margin: 0 }, children: "\u9879\u76EE\u5217\u8868" }), (0, jsx_runtime_1.jsxs)("div", { className: "actions", children: [(0, jsx_runtime_1.jsx)("button", { onClick: handleRefresh, disabled: isLoading, style: {
                                    marginRight: '0.75rem',
                                    padding: '0.5rem 1rem',
                                    backgroundColor: 'white',
                                    border: '1px solid #ccc',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }, children: isLoading ? '刷新中...' : '刷新' }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: "/projects/create", children: (0, jsx_runtime_1.jsx)("button", { style: {
                                        padding: '0.5rem 1rem',
                                        backgroundColor: '#1976d2',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }, children: "\u521B\u5EFA\u65B0\u9879\u76EE" }) })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "filters-container", style: {
                    marginBottom: '1.5rem',
                    padding: '1rem',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '8px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }, children: (0, jsx_runtime_1.jsxs)("div", { style: {
                        display: 'flex',
                        gap: '1rem',
                        flexWrap: 'wrap',
                        alignItems: 'center'
                    }, children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "statusFilter", style: {
                                        marginRight: '0.5rem',
                                        fontWeight: 'bold',
                                        color: '#555'
                                    }, children: "\u72B6\u6001:" }), (0, jsx_runtime_1.jsxs)("select", { id: "statusFilter", value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), style: {
                                        padding: '0.5rem',
                                        borderRadius: '4px',
                                        border: '1px solid #ccc',
                                        minWidth: '120px'
                                    }, children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "\u6240\u6709\u72B6\u6001" }), projectConstants_1.STATUSES.map(s => ((0, jsx_runtime_1.jsx)("option", { value: s.value, children: s.label }, s.value)))] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "priorityFilter", style: {
                                        marginRight: '0.5rem',
                                        fontWeight: 'bold',
                                        color: '#555'
                                    }, children: "\u4F18\u5148\u7EA7:" }), (0, jsx_runtime_1.jsxs)("select", { id: "priorityFilter", value: priorityFilter, onChange: (e) => setPriorityFilter(e.target.value), style: {
                                        padding: '0.5rem',
                                        borderRadius: '4px',
                                        border: '1px solid #ccc',
                                        minWidth: '120px'
                                    }, children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "\u6240\u6709\u4F18\u5148\u7EA7" }), projectConstants_1.PRIORITIES.map(p => ((0, jsx_runtime_1.jsx)("option", { value: p.value, children: p.label }, p.value)))] })] }), (0, jsx_runtime_1.jsxs)("div", { style: { flex: 1, minWidth: '200px' }, children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "searchQuery", style: {
                                        marginRight: '0.5rem',
                                        fontWeight: 'bold',
                                        color: '#555'
                                    }, children: "\u641C\u7D22:" }), (0, jsx_runtime_1.jsx)("input", { type: "text", id: "searchQuery", placeholder: "\u6309\u540D\u79F0/\u63CF\u8FF0\u641C\u7D22...", value: searchQuery, onChange: handleSearchChange, style: {
                                        padding: '0.5rem',
                                        borderRadius: '4px',
                                        border: '1px solid #ccc',
                                        width: 'calc(100% - 4rem)'
                                    } })] })] }) }), isLoading && ((0, jsx_runtime_1.jsx)("div", { style: {
                    display: 'flex',
                    justifyContent: 'center',
                    padding: '2rem',
                    color: '#666'
                }, children: (0, jsx_runtime_1.jsx)("div", { children: "\u6B63\u5728\u52A0\u8F7D\u9879\u76EE..." }) })), error && ((0, jsx_runtime_1.jsxs)("div", { style: {
                    padding: '1rem',
                    backgroundColor: '#ffebee',
                    color: '#c62828',
                    borderRadius: '4px',
                    marginBottom: '1rem'
                }, children: [(0, jsx_runtime_1.jsxs)("p", { style: { margin: 0 }, children: ["\u9519\u8BEF: ", error] }), (0, jsx_runtime_1.jsx)("button", { onClick: handleRefresh, style: {
                            marginTop: '0.5rem',
                            padding: '0.25rem 0.75rem',
                            backgroundColor: 'white',
                            border: '1px solid #c62828',
                            borderRadius: '4px',
                            color: '#c62828',
                            cursor: 'pointer'
                        }, children: "\u91CD\u8BD5" })] })), !isLoading && !error && ((0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: projects.length === 0 ? ((0, jsx_runtime_1.jsxs)("div", { style: {
                        textAlign: 'center',
                        padding: '2rem',
                        backgroundColor: '#f5f5f5',
                        borderRadius: '8px',
                        color: '#666'
                    }, children: [(0, jsx_runtime_1.jsx)("p", { children: "\u672A\u627E\u5230\u7B26\u5408\u6761\u4EF6\u7684\u9879\u76EE\u3002" }), (statusFilter || priorityFilter || searchQuery) && ((0, jsx_runtime_1.jsx)("p", { children: "\u5C1D\u8BD5\u6E05\u9664\u8FC7\u6EE4\u6761\u4EF6\u6216\u4FEE\u6539\u641C\u7D22\u5173\u952E\u8BCD" }))] })) : ((0, jsx_runtime_1.jsx)("div", { className: "project-grid", style: {
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                        gap: '1rem'
                    }, children: projects.map((project) => ((0, jsx_runtime_1.jsxs)("div", { className: "project-card", style: {
                            border: '1px solid #e0e0e0',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            backgroundColor: 'white',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column'
                        }, children: [(0, jsx_runtime_1.jsx)("div", { className: "card-header", style: {
                                    padding: '0.75rem 1rem',
                                    borderBottom: '1px solid #eee',
                                    backgroundColor: '#f9f9f9'
                                }, children: (0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' }, children: [project.status && ((0, jsx_runtime_1.jsx)("span", { style: {
                                                display: 'inline-block',
                                                backgroundColor: getStatusColor(project.status),
                                                color: 'white',
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '4px',
                                                fontSize: '0.75rem',
                                                fontWeight: 'bold'
                                            }, children: getStatusLabel(project.status) })), project.priority !== undefined && project.priority !== null && ((0, jsx_runtime_1.jsx)("span", { style: {
                                                display: 'inline-block',
                                                backgroundColor: getPriorityColor(project.priority),
                                                color: 'white',
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '4px',
                                                fontSize: '0.75rem',
                                                fontWeight: 'bold'
                                            }, children: getPriorityLabel(project.priority) }))] }) }), (0, jsx_runtime_1.jsxs)("div", { className: "card-content", style: {
                                    padding: '1rem',
                                    flex: '1 0 auto',
                                    display: 'flex',
                                    flexDirection: 'column'
                                }, children: [(0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: `/projects/${project._id}`, style: {
                                            fontSize: '1.2rem',
                                            fontWeight: 'bold',
                                            color: '#1976d2',
                                            textDecoration: 'none',
                                            marginBottom: '0.5rem'
                                        }, children: project.name }), project.description && ((0, jsx_runtime_1.jsx)("p", { style: {
                                            margin: '0 0 0.75rem',
                                            color: '#555',
                                            fontSize: '0.9rem'
                                        }, children: project.description })), (0, jsx_runtime_1.jsxs)("div", { style: { marginTop: 'auto' }, children: [project.domain && ((0, jsx_runtime_1.jsxs)("p", { style: { margin: '0.25rem 0', fontSize: '0.85rem' }, children: [(0, jsx_runtime_1.jsx)("strong", { children: "\u9886\u57DF:" }), " ", project.domain] })), project.industry && ((0, jsx_runtime_1.jsxs)("p", { style: { margin: '0.25rem 0', fontSize: '0.85rem' }, children: [(0, jsx_runtime_1.jsx)("strong", { children: "\u884C\u4E1A:" }), " ", project.industry] })), project.deadline && ((0, jsx_runtime_1.jsxs)("p", { style: {
                                                    margin: '0.25rem 0',
                                                    fontSize: '0.85rem',
                                                    color: new Date(project.deadline) < new Date() ? '#c62828' : 'inherit'
                                                }, children: [(0, jsx_runtime_1.jsx)("strong", { children: "\u622A\u6B62\u65E5\u671F:" }), " ", new Date(project.deadline).toLocaleDateString()] })), (0, jsx_runtime_1.jsxs)("p", { style: {
                                                    margin: '0.5rem 0 0',
                                                    fontSize: '0.75rem',
                                                    color: '#757575'
                                                }, children: ["\u521B\u5EFA\u4E8E: ", new Date(project.createdAt).toLocaleDateString()] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "card-footer", style: {
                                    padding: '0.75rem 1rem',
                                    borderTop: '1px solid #eee',
                                    backgroundColor: '#f9f9f9',
                                    display: 'flex',
                                    justifyContent: 'space-between'
                                }, children: [(0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: `/projects/${project._id}`, style: {
                                            textDecoration: 'none',
                                            color: '#1976d2',
                                            fontSize: '0.9rem'
                                        }, children: "\u8BE6\u60C5" }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: `/projects/${project._id}/files`, style: {
                                            textDecoration: 'none',
                                            color: '#1976d2',
                                            fontSize: '0.9rem'
                                        }, children: "\u67E5\u770B\u6587\u4EF6" })] })] }, project._id))) })) }))] }));
};
exports.default = ProjectsPage;

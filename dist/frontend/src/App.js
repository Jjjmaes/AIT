"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_router_dom_1 = require("react-router-dom");
const react_query_1 = require("@tanstack/react-query");
const antd_1 = require("antd");
const zh_CN_1 = __importDefault(require("antd/lib/locale/zh_CN"));
// Layout
const MainLayout_1 = __importDefault(require("./components/layout/MainLayout"));
const AuthLayout_1 = __importDefault(require("./components/layout/AuthLayout"));
// Auth Pages
const LoginPage_1 = __importDefault(require("./pages/LoginPage"));
const RegisterPage_1 = __importDefault(require("./pages/RegisterPage"));
// Dashboard
const DashboardPage_1 = __importDefault(require("./pages/DashboardPage"));
// Project Pages
const ProjectsPage_1 = __importDefault(require("./pages/ProjectsPage"));
const CreateProjectPage_1 = __importDefault(require("./pages/CreateProjectPage"));
const ProjectDetailPage_1 = __importDefault(require("./pages/ProjectDetailPage"));
const EditProjectPage_1 = __importDefault(require("./pages/EditProjectPage"));
// File Pages
const ProjectFilesPage_1 = __importDefault(require("./pages/ProjectFilesPage"));
// Translation & Review Pages
const TranslationCenterPage_1 = __importDefault(require("./pages/TranslationCenterPage"));
const ReviewWorkspacePage_1 = __importDefault(require("./pages/ReviewWorkspacePage"));
const FileReviewPage_1 = __importDefault(require("./pages/FileReviewPage"));
// Prompt Template Pages
const PromptTemplatesPage_1 = __importDefault(require("./pages/PromptTemplatesPage"));
const CreatePromptTemplatePage_1 = __importDefault(require("./pages/CreatePromptTemplatePage"));
const EditPromptTemplatePage_1 = __importDefault(require("./pages/EditPromptTemplatePage"));
// Terminology Pages
const TerminologyPage_1 = __importDefault(require("./pages/TerminologyPage"));
// Translation Memory Pages
const TranslationMemoryPage_1 = __importDefault(require("./pages/TranslationMemoryPage"));
// AI Configuration Pages
const AIConfigListPage_1 = __importDefault(require("./pages/AIConfigListPage"));
const AIConfigCreatePage_1 = __importDefault(require("./pages/AIConfigCreatePage"));
const AIConfigEditPage_1 = __importDefault(require("./pages/AIConfigEditPage"));
// Notification Pages
const NotificationsPage_1 = __importDefault(require("./pages/NotificationsPage"));
// Context
const AuthContext_1 = require("./context/AuthContext");
// Guards
const PrivateRoute_1 = __importDefault(require("./components/auth/PrivateRoute"));
const AdminRoute_1 = __importDefault(require("./components/auth/AdminRoute"));
// Styles
require("./App.css");
// Create React Query client
const queryClient = new react_query_1.QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 5 * 60 * 1000,
        },
    },
});
function App() {
    return ((0, jsx_runtime_1.jsx)(react_query_1.QueryClientProvider, { client: queryClient, children: (0, jsx_runtime_1.jsx)(antd_1.ConfigProvider, { locale: zh_CN_1.default, children: (0, jsx_runtime_1.jsx)(antd_1.App, { children: (0, jsx_runtime_1.jsx)(AuthContext_1.AuthProvider, { children: (0, jsx_runtime_1.jsxs)(react_router_dom_1.Routes, { children: [(0, jsx_runtime_1.jsxs)(react_router_dom_1.Route, { element: (0, jsx_runtime_1.jsx)(AuthLayout_1.default, {}), children: [(0, jsx_runtime_1.jsx)(react_router_dom_1.Route, { path: "/login", element: (0, jsx_runtime_1.jsx)(LoginPage_1.default, {}) }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Route, { path: "/register", element: (0, jsx_runtime_1.jsx)(RegisterPage_1.default, {}) })] }), (0, jsx_runtime_1.jsxs)(react_router_dom_1.Route, { element: (0, jsx_runtime_1.jsx)(PrivateRoute_1.default, { children: (0, jsx_runtime_1.jsx)(MainLayout_1.default, {}) }), children: [(0, jsx_runtime_1.jsx)(react_router_dom_1.Route, { path: "/dashboard", element: (0, jsx_runtime_1.jsx)(DashboardPage_1.default, {}) }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Route, { path: "/projects", element: (0, jsx_runtime_1.jsx)(ProjectsPage_1.default, {}) }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Route, { path: "/projects/create", element: (0, jsx_runtime_1.jsx)(AdminRoute_1.default, { children: (0, jsx_runtime_1.jsx)(CreateProjectPage_1.default, {}) }) }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Route, { path: "/projects/:projectId", element: (0, jsx_runtime_1.jsx)(ProjectDetailPage_1.default, {}) }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Route, { path: "/projects/:projectId/edit", element: (0, jsx_runtime_1.jsx)(AdminRoute_1.default, { children: (0, jsx_runtime_1.jsx)(EditProjectPage_1.default, {}) }) }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Route, { path: "/projects/:projectId/files", element: (0, jsx_runtime_1.jsx)(ProjectFilesPage_1.default, {}) }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Route, { path: "/translate", element: (0, jsx_runtime_1.jsx)(TranslationCenterPage_1.default, {}) }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Route, { path: "/projects/:projectId/translate", element: (0, jsx_runtime_1.jsx)(TranslationCenterPage_1.default, {}) }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Route, { path: "/files/:fileId/review", element: (0, jsx_runtime_1.jsx)(FileReviewPage_1.default, {}) }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Route, { path: "/review-workspace/:fileId", element: (0, jsx_runtime_1.jsx)(ReviewWorkspacePage_1.default, {}) }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Route, { path: "/prompts", element: (0, jsx_runtime_1.jsx)(AdminRoute_1.default, { children: (0, jsx_runtime_1.jsx)(PromptTemplatesPage_1.default, {}) }) }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Route, { path: "/prompts/create", element: (0, jsx_runtime_1.jsx)(AdminRoute_1.default, { children: (0, jsx_runtime_1.jsx)(CreatePromptTemplatePage_1.default, {}) }) }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Route, { path: "/prompts/:promptId/edit", element: (0, jsx_runtime_1.jsx)(AdminRoute_1.default, { children: (0, jsx_runtime_1.jsx)(EditPromptTemplatePage_1.default, {}) }) }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Route, { path: "/ai-configs", element: (0, jsx_runtime_1.jsx)(AdminRoute_1.default, { children: (0, jsx_runtime_1.jsx)(AIConfigListPage_1.default, {}) }) }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Route, { path: "/ai-configs/create", element: (0, jsx_runtime_1.jsx)(AdminRoute_1.default, { children: (0, jsx_runtime_1.jsx)(AIConfigCreatePage_1.default, {}) }) }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Route, { path: "/ai-configs/:configId/edit", element: (0, jsx_runtime_1.jsx)(AdminRoute_1.default, { children: (0, jsx_runtime_1.jsx)(AIConfigEditPage_1.default, {}) }) }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Route, { path: "/terminology", element: (0, jsx_runtime_1.jsx)(TerminologyPage_1.default, {}) }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Route, { path: "/translation-memory", element: (0, jsx_runtime_1.jsx)(TranslationMemoryPage_1.default, {}) }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Route, { path: "/notifications", element: (0, jsx_runtime_1.jsx)(NotificationsPage_1.default, {}) })] }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Route, { path: "/", element: (0, jsx_runtime_1.jsx)(react_router_dom_1.Navigate, { to: "/dashboard", replace: true }) }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Route, { path: "*", element: (0, jsx_runtime_1.jsx)(react_router_dom_1.Navigate, { to: "/dashboard", replace: true }) })] }) }) }) }) }));
}
exports.default = App;

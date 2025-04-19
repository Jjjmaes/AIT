import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/lib/locale/zh_CN';

// Layout
import MainLayout from './components/layout/MainLayout';
import AuthLayout from './components/layout/AuthLayout';

// Auth Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// Dashboard
import DashboardPage from './pages/DashboardPage';

// Project Pages
import ProjectsPage from './pages/ProjectsPage';
import CreateProjectPage from './pages/CreateProjectPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import EditProjectPage from './pages/EditProjectPage';

// File Pages
import ProjectFilesPage from './pages/ProjectFilesPage';

// Translation & Review Pages
import TranslationCenterPage from './pages/TranslationCenterPage';
import ReviewWorkspacePage from './pages/ReviewWorkspacePage';
import FileReviewPage from './pages/FileReviewPage';

// Prompt Template Pages
import PromptTemplatesPage from './pages/PromptTemplatesPage';
import CreatePromptTemplatePage from './pages/CreatePromptTemplatePage';
import EditPromptTemplatePage from './pages/EditPromptTemplatePage';

// Terminology Pages
import TerminologyPage from './pages/TerminologyPage';

// Translation Memory Pages
import TranslationMemoryPage from './pages/TranslationMemoryPage';

// AI Configuration Pages
import AIConfigListPage from './pages/AIConfigListPage';
import AIConfigCreatePage from './pages/AIConfigCreatePage';
import AIConfigEditPage from './pages/AIConfigEditPage';

// Notification Pages
import NotificationsPage from './pages/NotificationsPage';

// Context
import { AuthProvider } from './context/AuthContext';

// Guards
import PrivateRoute from './components/auth/PrivateRoute';
import AdminRoute from './components/auth/AdminRoute';

// Styles
import './App.css';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={zhCN}>
        <AntApp>
          <AuthProvider>
            <Routes>
              {/* Auth Routes */}
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
              </Route>

              {/* Protected Routes */}
              <Route element={<PrivateRoute><MainLayout /></PrivateRoute>}>
                {/* Dashboard */}
                <Route path="/dashboard" element={<DashboardPage />} />

                {/* Projects */}
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/projects/create" element={<AdminRoute><CreateProjectPage /></AdminRoute>} />
                <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
                <Route path="/projects/:projectId/edit" element={<AdminRoute><EditProjectPage /></AdminRoute>} />
                <Route path="/projects/:projectId/files" element={<ProjectFilesPage />} />

                {/* Translation */}
                <Route path="/translate" element={<TranslationCenterPage />} />
                <Route path="/projects/:projectId/translate" element={<TranslationCenterPage />} />
                <Route path="/projects/:projectId/files/:fileId/translate" element={<TranslationCenterPage />} />

                {/* Review */}
                <Route path="/files/:fileId/review" element={<FileReviewPage />} />
                <Route path="/review-workspace/:fileId" element={<ReviewWorkspacePage />} />

                {/* Prompts - Admin Only */}
                <Route path="/prompts" element={<AdminRoute><PromptTemplatesPage /></AdminRoute>} />
                <Route path="/prompts/create" element={<AdminRoute><CreatePromptTemplatePage /></AdminRoute>} />
                <Route path="/prompts/:promptId/edit" element={<AdminRoute><EditPromptTemplatePage /></AdminRoute>} />

                {/* AI Configs - Admin Only */}
                <Route path="/ai-configs" element={<AdminRoute><AIConfigListPage /></AdminRoute>} />
                <Route path="/ai-configs/create" element={<AdminRoute><AIConfigCreatePage /></AdminRoute>} />
                <Route path="/ai-configs/:configId/edit" element={<AdminRoute><AIConfigEditPage /></AdminRoute>} />

                {/* Terminology */}
                <Route path="/terminology" element={<TerminologyPage />} />

                {/* Translation Memory */}
                <Route path="/translation-memory" element={<TranslationMemoryPage />} />

                {/* Notifications */}
                <Route path="/notifications" element={<NotificationsPage />} />
              </Route>

              {/* Redirect */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </AuthProvider>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

export default App;

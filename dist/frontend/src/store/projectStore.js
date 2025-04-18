"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useProjectStore = void 0;
const zustand_1 = require("zustand");
const api_1 = __importDefault(require("../api/api"));
// Define the store creator, removing the unused 'get' parameter
const createProjectSlice = (set /*, get */) => ({
    projects: [],
    currentProject: null,
    isLoading: false,
    error: null,
    // 获取项目列表
    fetchProjects: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await api_1.default.get('/projects');
            set({ projects: response.data.projects });
        }
        catch (error) {
            set({ error: error.response?.data?.message || '获取项目列表失败' });
        }
        finally {
            set({ isLoading: false });
        }
    },
    // 获取单个项目详情
    fetchProjectById: async (id) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api_1.default.get(`/projects/${id}`);
            const project = response.data.project;
            // 设置当前项目
            set({ currentProject: project });
            // 同时更新列表中的项目
            set(state => ({
                projects: state.projects.map(p => p.id === project.id ? project : p),
            }));
        }
        catch (error) {
            set({ error: error.response?.data?.message || '获取项目详情失败' });
        }
        finally {
            set({ isLoading: false });
        }
    },
    // 创建项目
    createProject: async (projectData) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api_1.default.post('/projects', projectData);
            const newProject = response.data.project;
            // 添加到项目列表
            set(state => ({
                projects: [...state.projects, newProject],
            }));
            return newProject;
        }
        catch (error) {
            set({ error: error.response?.data?.message || '创建项目失败' });
            throw error;
        }
        finally {
            set({ isLoading: false });
        }
    },
    // 更新项目
    updateProject: async (id, data) => {
        set({ isLoading: true, error: null });
        try {
            await api_1.default.put(`/projects/${id}`, data);
            // 更新内存中的项目
            set(state => ({
                projects: state.projects.map(project => project.id === id ? { ...project, ...data } : project),
                currentProject: state.currentProject?.id === id
                    ? { ...state.currentProject, ...data }
                    : state.currentProject,
            }));
        }
        catch (error) {
            set({ error: error.response?.data?.message || '更新项目失败' });
            throw error;
        }
        finally {
            set({ isLoading: false });
        }
    },
    // 删除项目
    deleteProject: async (id) => {
        set({ isLoading: true, error: null });
        try {
            await api_1.default.delete(`/projects/${id}`);
            // 从列表中移除
            set(state => ({
                projects: state.projects.filter(project => project.id !== id),
                currentProject: state.currentProject?.id === id ? null : state.currentProject,
            }));
        }
        catch (error) {
            set({ error: error.response?.data?.message || '删除项目失败' });
            throw error;
        }
        finally {
            set({ isLoading: false });
        }
    },
    // 设置当前项目
    setCurrentProject: (project) => {
        set({ currentProject: project });
    },
    // 清除错误
    clearError: () => {
        set({ error: null });
    },
});
// Create the store using the typed creator
exports.useProjectStore = (0, zustand_1.create)(createProjectSlice);

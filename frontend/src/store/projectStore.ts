import { create, StateCreator } from 'zustand';
import api from '../api/api';

export interface Project {
  id: string;
  name: string;
  description: string;
  sourceLanguage: string;
  targetLanguage: string;
  status: 'active' | 'completed' | 'paused';
  progress: number;
  createdAt: string;
  updatedAt: string;
  deadline?: string;
  promptTemplateIds: {
    translation: string;
    review: string;
  };
  assignedUserIds: string[];
}

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;
  
  // 操作方法
  fetchProjects: () => Promise<void>;
  fetchProjectById: (id: string) => Promise<void>;
  createProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'progress'>) => Promise<Project>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setCurrentProject: (project: Project | null) => void;
  clearError: () => void;
}

// Define the store creator, removing the unused 'get' parameter
const createProjectSlice: StateCreator<ProjectState> = (set /*, get */) => ({
  projects: [],
  currentProject: null,
  isLoading: false,
  error: null,
  
  // 获取项目列表
  fetchProjects: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await api.get('/projects');
      set({ projects: response.data.projects });
    } catch (error: any) {
      set({ error: error.response?.data?.message || '获取项目列表失败' });
    } finally {
      set({ isLoading: false });
    }
  },
  
  // 获取单个项目详情
  fetchProjectById: async (id: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await api.get(`/projects/${id}`);
      const project: Project = response.data.project;
      
      // 设置当前项目
      set({ currentProject: project });
      
      // 同时更新列表中的项目
      set(state => ({
        projects: state.projects.map(p => 
          p.id === project.id ? project : p
        ),
      }));
    } catch (error: any) {
      set({ error: error.response?.data?.message || '获取项目详情失败' });
    } finally {
      set({ isLoading: false });
    }
  },
  
  // 创建项目
  createProject: async (projectData) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await api.post('/projects', projectData);
      const newProject: Project = response.data.project;
      
      // 添加到项目列表
      set(state => ({
        projects: [...state.projects, newProject],
      }));
      
      return newProject;
    } catch (error: any) {
      set({ error: error.response?.data?.message || '创建项目失败' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
  
  // 更新项目
  updateProject: async (id: string, data: Partial<Project>) => {
    set({ isLoading: true, error: null });
    
    try {
      await api.put(`/projects/${id}`, data);
      
      // 更新内存中的项目
      set(state => ({
        projects: state.projects.map(project => 
          project.id === id ? { ...project, ...data } : project
        ),
        currentProject: state.currentProject?.id === id 
          ? { ...state.currentProject, ...data } as Project
          : state.currentProject,
      }));
    } catch (error: any) {
      set({ error: error.response?.data?.message || '更新项目失败' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
  
  // 删除项目
  deleteProject: async (id: string) => {
    set({ isLoading: true, error: null });
    
    try {
      await api.delete(`/projects/${id}`);
      
      // 从列表中移除
      set(state => ({
        projects: state.projects.filter(project => project.id !== id),
        currentProject: state.currentProject?.id === id ? null : state.currentProject,
      }));
    } catch (error: any) {
      set({ error: error.response?.data?.message || '删除项目失败' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
  
  // 设置当前项目
  setCurrentProject: (project: Project | null) => {
    set({ currentProject: project });
  },
  
  // 清除错误
  clearError: () => {
    set({ error: null });
  },
});

// Create the store using the typed creator
export const useProjectStore = create<ProjectState>(createProjectSlice); 
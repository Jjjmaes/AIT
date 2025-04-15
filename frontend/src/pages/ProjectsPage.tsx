import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProjects, Project, GetProjectsParams } from '../api/projectService';
// Import PRIORITIES and STATUSES to map value to label
import { PRIORITIES, STATUSES } from '../constants/projectConstants';
import axios from 'axios';

// Helper function to get priority label
const getPriorityLabel = (value: number | undefined | null): string | null => {
    if (value === null || value === undefined) return null;
    const found = PRIORITIES.find(p => p.value === value);
    return found ? found.label : null; // Return label or null if not found
};

// Helper to get Status label (optional, can display raw status too)
const getStatusLabel = (value: string | undefined | null): string | null => {
    if (!value) return null;
    const found = STATUSES.find(s => s.value === value);
    return found ? found.label : value; // Return label or raw value if not found
};

const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // State for filters and search
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Revert to single useEffect hook
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const fetchProjects = async () => {
      setIsLoading(true);
      setError(null);
      const params: GetProjectsParams = {
        limit: 20,
        status: statusFilter || undefined,
        priority: priorityFilter ? parseInt(priorityFilter, 10) : undefined,
        search: searchQuery || undefined,
      };
      try {
        const response = await getProjects(params, { signal });

        if (signal.aborted) {
          return;
        }

        if (response && response.success && response.data && response.data.projects) {
          setProjects(response.data.projects);
        } else {
          setError(response?.message || 'Failed to fetch projects.');
          setProjects([]);
        }
      } catch (err: any) {
        if (signal.aborted) {
        } else if (err.name === 'AbortError' || axios.isCancel(err)) {
        } else {
          console.error('API Error fetching projects:', err.response || err);
          setError(err.response?.data?.message || err.message || 'An error occurred.');
          setProjects([]);
        }
      } finally {
        if (!signal.aborted) {
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
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  return (
    <div>
      <h1>项目列表</h1>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/projects/new">
          <button>创建新项目</button>
        </Link>
      </div>

      {/* Filters and Search Section */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        {/* Status Filter */}
        <div>
          <label htmlFor="statusFilter" style={{ marginRight: '0.5rem' }}>状态:</label>
          <select
            id="statusFilter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">所有状态</option>
            {STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Priority Filter */}
        <div>
          <label htmlFor="priorityFilter" style={{ marginRight: '0.5rem' }}>优先级:</label>
          <select
            id="priorityFilter"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="">所有优先级</option>
            {PRIORITIES.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Search Input */}
        <div>
          <label htmlFor="searchQuery" style={{ marginRight: '0.5rem' }}>搜索:</label>
          <input
            type="text"
            id="searchQuery"
            placeholder="按名称/描述搜索..."
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>
      </div>

      {/* Project List */}
      {isLoading && <p>正在加载项目...</p>}
      {error && <p style={{ color: 'red' }}>错误: {error}</p>}
      {!isLoading && !error && (
        <>
          {projects.length === 0 ? (
            <p>未找到符合条件的项目。</p>
          ) : (
            <ul>
              {projects.map((project) => (
                <li key={project._id}>
                  <Link to={`/projects/${project._id}`}>
                    <strong>{project.name}</strong>
                  </Link>
                  <span style={{ marginLeft: '0.5rem', color: '#555' }}>
                    {/* Display Status */}
                    {project.status && <>[状态: {getStatusLabel(project.status)}] </>}
                    {project.description && <>({project.description}) </>}
                    {project.domain && <>[领域: {project.domain}] </>}
                    {project.industry && <>[行业: {project.industry}] </>}
                    {getPriorityLabel(project.priority) && <>[优先级: {getPriorityLabel(project.priority)}] </>}
                    {project.deadline && <>[截止日期: {new Date(project.deadline).toLocaleDateString()}]</>}
                  </span>
                  <small style={{ marginLeft: '1rem' }}>
                    (创建于: {new Date(project.createdAt).toLocaleDateString()})
                  </small>
                  <Link 
                    to={`/projects/${project._id}/files`} 
                    style={{ marginLeft: '1rem' }}
                  >
                    查看文件
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {/* TODO: Add pagination controls using data from response.data.pagination */}
        </>
      )}
    </div>
  );
};

export default ProjectsPage;
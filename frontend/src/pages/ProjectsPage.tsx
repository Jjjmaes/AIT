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

// Helper to get priority color
const getPriorityColor = (value: number | undefined | null): string => {
    if (value === null || value === undefined) return '#888';
    
    // Map priority values to colors: high (red), medium (orange), low (green)
    switch (value) {
        case 2: return '#e53935'; // High - Red
        case 1: return '#fb8c00'; // Medium - Orange
        case 0: return '#43a047'; // Low - Green
        default: return '#888';
    }
};

// Helper to get status color
const getStatusColor = (value: string | undefined | null): string => {
    if (!value) return '#888';
    
    switch (value) {
        case 'active': return '#1976d2'; // Blue
        case 'completed': return '#43a047'; // Green
        case 'archived': return '#757575'; // Grey
        case 'draft': return '#9e9e9e'; // Light Grey
        default: return '#888';
    }
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
        console.log('[ProjectsPage] Fetching projects with params:', params);
        const response = await getProjects(params, { signal });
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
        } else {
          // This block runs if response format is unexpected or success is false
          console.error('[ProjectsPage] Invalid project data structure received or request failed:', response);
          setError(response?.message || '获取项目数据失败或格式错误');
          setProjects([]);
        }
      } catch (err: any) {
        if (signal.aborted || axios.isCancel(err)) {
          console.log('[ProjectsPage] Fetch cancelled or aborted.');
        } else {
          console.error('[ProjectsPage] API Error fetching projects:', err.response || err);
          setError(err.response?.data?.message || err.message || '获取项目时发生错误');
          setProjects([]);
        }
      } finally {
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
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleRefresh = () => {
    // Simply trigger a re-fetch by forcing the useEffect to run again
    setIsLoading(true);
  };

  return (
    <div className="projects-page">
      <div className="page-header" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1.5rem',
        padding: '0.5rem 0',
        borderBottom: '1px solid #e0e0e0'
      }}>
        <h1 style={{ margin: 0 }}>项目列表</h1>
        
        <div className="actions">
          <button 
            onClick={handleRefresh} 
            disabled={isLoading}
            style={{ 
              marginRight: '0.75rem',
              padding: '0.5rem 1rem',
              backgroundColor: 'white',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {isLoading ? '刷新中...' : '刷新'}
          </button>
          
          <Link to="/projects/create">
            <button style={{ 
              padding: '0.5rem 1rem',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}>
              创建新项目
            </button>
          </Link>
        </div>
      </div>

      {/* Filters and Search Section */}
      <div className="filters-container" style={{ 
        marginBottom: '1.5rem', 
        padding: '1rem',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ 
          display: 'flex', 
          gap: '1rem', 
          flexWrap: 'wrap',
          alignItems: 'center' 
        }}>
          {/* Status Filter */}
          <div>
            <label htmlFor="statusFilter" style={{ 
              marginRight: '0.5rem',
              fontWeight: 'bold',
              color: '#555'
            }}>状态:</label>
            <select
              id="statusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '0.5rem',
                borderRadius: '4px',
                border: '1px solid #ccc',
                minWidth: '120px'
              }}
            >
              <option value="">所有状态</option>
              {STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <label htmlFor="priorityFilter" style={{ 
              marginRight: '0.5rem',
              fontWeight: 'bold',
              color: '#555'
            }}>优先级:</label>
            <select
              id="priorityFilter"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              style={{
                padding: '0.5rem',
                borderRadius: '4px',
                border: '1px solid #ccc',
                minWidth: '120px'
              }}
            >
              <option value="">所有优先级</option>
              {PRIORITIES.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label htmlFor="searchQuery" style={{ 
              marginRight: '0.5rem',
              fontWeight: 'bold',
              color: '#555'
            }}>搜索:</label>
            <input
              type="text"
              id="searchQuery"
              placeholder="按名称/描述搜索..."
              value={searchQuery}
              onChange={handleSearchChange}
              style={{
                padding: '0.5rem',
                borderRadius: '4px',
                border: '1px solid #ccc',
                width: 'calc(100% - 4rem)'
              }}
            />
          </div>
        </div>
      </div>

      {/* Project List */}
      {isLoading && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          padding: '2rem',
          color: '#666'
        }}>
          <div>正在加载项目...</div>
        </div>
      )}
      
      {error && (
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#ffebee', 
          color: '#c62828',
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          <p style={{ margin: 0 }}>错误: {error}</p>
          <button 
            onClick={handleRefresh} 
            style={{ 
              marginTop: '0.5rem',
              padding: '0.25rem 0.75rem',
              backgroundColor: 'white',
              border: '1px solid #c62828',
              borderRadius: '4px',
              color: '#c62828',
              cursor: 'pointer'
            }}
          >
            重试
          </button>
        </div>
      )}
      
      {!isLoading && !error && (
        <>
          {projects.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '2rem', 
              backgroundColor: '#f5f5f5',
              borderRadius: '8px',
              color: '#666'
            }}>
              <p>未找到符合条件的项目。</p>
              {(statusFilter || priorityFilter || searchQuery) && (
                <p>尝试清除过滤条件或修改搜索关键词</p>
              )}
            </div>
          ) : (
            <div className="project-grid" style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '1rem'
            }}>
              {projects.map((project) => (
                <div key={project._id} className="project-card" style={{ 
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  backgroundColor: 'white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <div className="card-header" style={{
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid #eee',
                    backgroundColor: '#f9f9f9'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {/* Status indicator */}
                      {project.status && (
                        <span style={{ 
                          display: 'inline-block',
                          backgroundColor: getStatusColor(project.status),
                          color: 'white',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold'
                        }}>
                          {getStatusLabel(project.status)}
                        </span>
                      )}
                      
                      {/* Priority indicator if available */}
                      {project.priority !== undefined && project.priority !== null && (
                        <span style={{ 
                          display: 'inline-block',
                          backgroundColor: getPriorityColor(project.priority),
                          color: 'white',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold'
                        }}>
                          {getPriorityLabel(project.priority)}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="card-content" style={{ 
                    padding: '1rem',
                    flex: '1 0 auto',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    <Link 
                      to={`/projects/${project._id}`}
                      style={{ 
                        fontSize: '1.2rem', 
                        fontWeight: 'bold',
                        color: '#1976d2',
                        textDecoration: 'none',
                        marginBottom: '0.5rem'
                      }}
                    >
                      {project.name}
                    </Link>
                    
                    {project.description && (
                      <p style={{ 
                        margin: '0 0 0.75rem',
                        color: '#555',
                        fontSize: '0.9rem'
                      }}>
                        {project.description}
                      </p>
                    )}
                    
                    <div style={{ marginTop: 'auto' }}>
                      {project.domain && (
                        <p style={{ margin: '0.25rem 0', fontSize: '0.85rem' }}>
                          <strong>领域:</strong> {project.domain}
                        </p>
                      )}
                      
                      {project.industry && (
                        <p style={{ margin: '0.25rem 0', fontSize: '0.85rem' }}>
                          <strong>行业:</strong> {project.industry}
                        </p>
                      )}
                      
                      {project.deadline && (
                        <p style={{ 
                          margin: '0.25rem 0', 
                          fontSize: '0.85rem',
                          color: new Date(project.deadline) < new Date() ? '#c62828' : 'inherit'
                        }}>
                          <strong>截止日期:</strong> {new Date(project.deadline).toLocaleDateString()}
                        </p>
                      )}
                      
                      <p style={{ 
                        margin: '0.5rem 0 0',  
                        fontSize: '0.75rem', 
                        color: '#757575'
                      }}>
                        创建于: {new Date(project.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="card-footer" style={{ 
                    padding: '0.75rem 1rem',
                    borderTop: '1px solid #eee',
                    backgroundColor: '#f9f9f9',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}>
                    <Link 
                      to={`/projects/${project._id}`}
                      style={{
                        textDecoration: 'none',
                        color: '#1976d2',
                        fontSize: '0.9rem'
                      }}
                    >
                      详情
                    </Link>
                    
                    <Link 
                      to={`/projects/${project._id}/files`}
                      style={{
                        textDecoration: 'none',
                        color: '#1976d2',
                        fontSize: '0.9rem'
                      }}
                    >
                      查看文件
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* TODO: Add pagination controls using data from response.data.pagination */}
        </>
      )}
    </div>
  );
};

export default ProjectsPage;
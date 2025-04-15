import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getProjectById, Project, deleteProject } from '../api/projectService'; // Import API function and type
import { PRIORITIES, STATUSES } from '../constants/projectConstants';

// Helper function to get priority label (could be moved to a utils file)
const getPriorityLabel = (value: number | undefined | null): string | null => {
    if (value === null || value === undefined) return null;
    const found = PRIORITIES.find(p => p.value === value);
    return found ? found.label : null; // Return label or null if not found
};

// Helper function to get status label
const getStatusLabel = (value: string | undefined | null): string | null => {
    if (!value) return null;
    const found = STATUSES.find(s => s.value === value);
    return found ? found.label : value; // Return label or raw value if not found
};

// Helper to get priority color
const getPriorityColor = (value: number | undefined | null): string => {
    if (value === null || value === undefined) return '#888';
    
    switch (value) {
        case 3: return '#e53935'; // High - Red
        case 2: return '#fb8c00'; // Medium - Orange
        case 1: return '#43a047'; // Low - Green
        default: return '#888';
    }
};

// Helper to get status color
const getStatusColor = (value: string | undefined | null): string => {
    if (!value) return '#888';
    
    switch (value) {
        case 'active': return '#1976d2'; // Blue
        case 'in_progress': return '#fb8c00'; // Orange
        case 'completed': return '#43a047'; // Green
        case 'archived': return '#757575'; // Grey
        case 'pending': return '#9e9e9e'; // Light Grey
        default: return '#888';
    }
};

const ProjectDetailPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate(); // Initialize navigate
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false); // State for delete operation

  useEffect(() => {
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
        const response = await getProjectById(projectId, { signal });
        
        // Check if the request was aborted before processing response
        if (signal.aborted) {
          console.log('[ProjectDetailPage] Fetch aborted.');
          return;
        }

        if (response.success && response.data?.project) {
          // Use the nested project object
          setProject(response.data.project);
        } else if (response.success && !response.data?.project) {
          // Handle case where success is true but project data is missing
          setError('获取项目成功，但未找到项目数据。');
          setProject(null);
        } else {
          setError(response.message || 'Failed to fetch project details');
          setProject(null);
        }
      } catch (err: any) {
        // Check if the error is due to abortion
        if (signal.aborted || err.name === 'CanceledError') {
          console.log('[ProjectDetailPage] Fetch cancelled/aborted.');
        } else {
          console.error('[ProjectDetailPage] Fetch error:', err); 
          setError(err.response?.data?.message || err.message || 'An error occurred');
          setProject(null);
        }
      } finally {
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
    if (!projectId) return;

    if (!window.confirm(`确定要删除项目 "${project?.name}" 吗？此操作不可撤销。`)) {
        return;
    }

    setIsDeleting(true);
    setError(null);
    try {
        const response = await deleteProject(projectId);
        if (response.success) {
            console.log('Project deleted successfully');
            navigate('/projects'); // Navigate to projects list after deletion
        } else {
            setError(response.message || 'Failed to delete project.');
        }
    } catch (err: any) {
        console.error('Delete project error:', err);
        setError(err.response?.data?.message || err.message || 'An error occurred while deleting the project.');
    } finally {
        setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '200px',
        color: '#666'
      }}>
        <div>
          <p style={{ fontSize: '1.1rem' }}>正在加载项目详情...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '1rem', 
        backgroundColor: '#ffebee', 
        color: '#c62828',
        borderRadius: '8px',
        maxWidth: '800px',
        margin: '0 auto',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <p style={{ margin: 0 }}>错误: {error}</p>
        <button 
          onClick={() => navigate('/projects')} 
          style={{ 
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            backgroundColor: 'white',
            border: '1px solid #c62828',
            borderRadius: '4px',
            color: '#c62828',
            cursor: 'pointer'
          }}
        >
          返回项目列表
        </button>
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ 
        padding: '1rem', 
        backgroundColor: '#f5f5f5', 
        color: '#666',
        borderRadius: '8px',
        maxWidth: '800px',
        margin: '0 auto',
        textAlign: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <p>未找到项目信息</p>
        <button 
          onClick={() => navigate('/projects')} 
          style={{ 
            marginTop: '0.5rem',
            padding: '0.5rem 1rem',
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          返回项目列表
        </button>
      </div>
    );
  }

  return (
    <div className="project-detail-page" style={{ 
      maxWidth: '960px', 
      margin: '0 auto', 
      padding: '1rem' 
    }}>
      {/* Header with back button */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1.5rem',
        paddingBottom: '0.75rem',
        borderBottom: '1px solid #e0e0e0'
      }}>
        <h1 style={{ margin: 0, color: '#333' }}>项目详情</h1>
        <Link 
          to="/projects" 
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            color: '#555',
            textDecoration: 'none'
          }}
        >
          返回项目列表
        </Link>
      </div>
      
      {/* Project Header Card */}
      <div style={{ 
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
        marginBottom: '1.5rem',
        overflow: 'hidden'
      }}>
        <div style={{ 
          padding: '1.5rem',
          position: 'relative'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div style={{ flex: '1' }}>
              <h2 style={{ margin: '0 0 0.5rem 0', color: '#333', fontSize: '1.75rem' }}>
                {project.name}
              </h2>
              
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {project.status && (
                  <span style={{ 
                    display: 'inline-block',
                    backgroundColor: getStatusColor(project.status),
                    color: 'white',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                    fontWeight: 'bold'
                  }}>
                    {getStatusLabel(project.status)}
                  </span>
                )}
                
                {project.priority !== undefined && project.priority !== null && (
                  <span style={{ 
                    display: 'inline-block',
                    backgroundColor: getPriorityColor(project.priority),
                    color: 'white',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                    fontWeight: 'bold'
                  }}>
                    优先级: {getPriorityLabel(project.priority)}
                  </span>
                )}
                
                {project.deadline && (
                  <span style={{ 
                    display: 'inline-block',
                    backgroundColor: '#f5f5f5',
                    color: new Date(project.deadline) < new Date() ? '#c62828' : '#333',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '4px',
                    fontSize: '0.875rem'
                  }}>
                    截止日期: {new Date(project.deadline).toLocaleDateString()}
                  </span>
                )}
              </div>
              
              {project.description && (
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ margin: '0', color: '#555', fontSize: '1rem' }}>
                    {project.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Project Details Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        {/* Left column - Basic Info */}
        <div style={{ 
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#f5f5f5', 
            borderBottom: '1px solid #eee',
            fontWeight: 'bold',
            fontSize: '1.1rem',
            color: '#333'
          }}>
            项目信息
          </div>
          <div style={{ padding: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {project.domain && (
                  <tr>
                    <td style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee', color: '#666', width: '35%' }}>
                      领域
                    </td>
                    <td style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                      {project.domain}
                    </td>
                  </tr>
                )}
                
                {project.industry && (
                  <tr>
                    <td style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee', color: '#666', width: '35%' }}>
                      行业
                    </td>
                    <td style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                      {project.industry}
                    </td>
                  </tr>
                )}
                
                {project.manager && (
                  <tr>
                    <td style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee', color: '#666', width: '35%' }}>
                      管理员
                    </td>
                    <td style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                      {project.manager.username}
                    </td>
                  </tr>
                )}
                
                <tr>
                  <td style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee', color: '#666', width: '35%' }}>
                    创建于
                  </td>
                  <td style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                    {new Date(project.createdAt).toLocaleString()}
                  </td>
                </tr>
                
                <tr>
                  <td style={{ padding: '0.5rem 0', color: '#666', width: '35%' }}>
                    最后更新
                  </td>
                  <td style={{ padding: '0.5rem 0' }}>
                    {new Date(project.updatedAt).toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Right column - Language Pairs */}
        <div style={{ 
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#f5f5f5', 
            borderBottom: '1px solid #eee',
            fontWeight: 'bold',
            fontSize: '1.1rem',
            color: '#333'
          }}>
            语言对
          </div>
          <div style={{ padding: '1rem' }}>
            {project.languagePairs && project.languagePairs.length > 0 ? (
              <div>
                {project.languagePairs.map((pair, index) => (
                  <div 
                    key={index} 
                    style={{
                      padding: '0.75rem',
                      backgroundColor: index % 2 === 0 ? '#f9f9f9' : 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: index !== project.languagePairs!.length - 1 ? '1px solid #eee' : 'none'
                    }}
                  >
                    <div style={{ fontWeight: 'bold' }}>
                      {pair.source}
                    </div>
                    <div style={{ color: '#666' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div style={{ fontWeight: 'bold' }}>
                      {pair.target}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#666', textAlign: 'center', margin: '1rem 0' }}>
                未设置语言对
              </p>
            )}
          </div>
        </div>
      </div>
      
      {/* Actions Card */}
      <div style={{ 
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        marginBottom: '2rem'
      }}>
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#f5f5f5', 
          borderBottom: '1px solid #eee',
          fontWeight: 'bold',
          fontSize: '1.1rem',
          color: '#333'
        }}>
          项目操作
        </div>
        <div style={{ 
          padding: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          {/* View Files Button */}
          <Link 
            to={`/projects/${projectId}/files`}
            style={{
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
            }}
          >
            查看文件
          </Link>
          
          {/* Edit Project Button */}
          <Link 
            to={`/projects/${projectId}/edit`}
            style={{
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
            }}
          >
            编辑项目
          </Link>
          
          {/* Delete Project Button */}
          <button 
            onClick={handleDelete} 
            disabled={isDeleting}
            style={{
              padding: '0.75rem 1.25rem',
              backgroundColor: '#ffebee',
              color: '#c62828',
              border: '1px solid #ffcdd2',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              opacity: isDeleting ? 0.7 : 1
            }}
          >
            {isDeleting ? '删除中...' : '删除项目'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailPage; 
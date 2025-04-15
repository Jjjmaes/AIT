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

const ProjectDetailPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate(); // Initialize navigate
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false); // State for delete operation

  useEffect(() => {
    if (!projectId) {
      setError('Project ID is missing from URL');
      setIsLoading(false);
      return;
    }

    const fetchProjectDetails = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await getProjectById(projectId);
        if (response.success && response.data) {
          setProject(response.data);
        } else {
          setError(response.message || 'Failed to fetch project details');
          setProject(null); // Clear project data on error
        }
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'An error occurred');
        setProject(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjectDetails();
  }, [projectId]); // Re-run effect if projectId changes

  const handleDelete = async () => {
    if (!projectId) return;

    if (!window.confirm(`Are you sure you want to delete project "${project?.name}"? This action cannot be undone.`)) {
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
    return <p>Loading project details...</p>;
  }

  if (error) {
    return <p style={{ color: 'red' }}>Error: {error}</p>;
  }

  if (!project) {
    return <p>Project not found.</p>;
  }

  return (
    <div>
      <h1>项目详情: {project.name}</h1>
      <p><strong>状态:</strong> {getStatusLabel(project.status) || 'N/A'}</p>
      <div style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}>
        {project.description && <p><strong>描述:</strong> {project.description}</p>}
        {project.domain && <p><strong>领域:</strong> {project.domain}</p>}
        {project.industry && <p><strong>行业:</strong> {project.industry}</p>}
        {getPriorityLabel(project.priority) && <p><strong>优先级:</strong> {getPriorityLabel(project.priority)}</p>}
        {project.deadline && <p><strong>截止日期:</strong> {new Date(project.deadline).toLocaleDateString()}</p>}
      </div>
      <p><strong>创建于:</strong> {new Date(project.createdAt).toLocaleString()}</p>
      <p><strong>最后更新于:</strong> {new Date(project.updatedAt).toLocaleString()}</p>
      {/* Display other project details like manager, languages etc. if available */}
      {project.manager && <p><strong>管理员:</strong> {project.manager.username}</p>}
      {project.languagePairs && project.languagePairs.length > 0 && (
        <div>
          <strong>语言对:</strong>
          <ul>
            {project.languagePairs.map((pair, index) => (
              <li key={index}>{pair.source} -&gt; {pair.target}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginTop: '1rem' }}>
        <Link to={`/projects/${projectId}/files`} style={{ marginRight: '1rem' }}>
          查看文件
        </Link>
        <Link to={`/projects/${projectId}/edit`} style={{ marginRight: '1rem' }}>
          编辑项目
        </Link>
        {/* Add Delete Button */}
        <button 
          onClick={handleDelete} 
          disabled={isDeleting || isLoading} // Disable if deleting or initially loading
          style={{
            backgroundColor: '#dc3545', 
            color: 'white', 
            border: 'none', 
            padding: '0.5rem 1rem', 
            cursor: 'pointer', 
            marginLeft: '1rem',
            borderRadius: '4px'
          }}
        >
          {isDeleting ? '删除中...' : '删除项目'}
        </button>
        <Link to="/projects" style={{ marginLeft: '1rem' }}>返回项目列表</Link>
      </div>
    </div>
  );
};

export default ProjectDetailPage; 
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllAIConfigs, deleteAIConfig, AIConfig } from '../api/aiConfigService';

const AIConfigListPage: React.FC = () => {
  const navigate = useNavigate();
  const [configs, setConfigs] = useState<AIConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getAllAIConfigs();
      if (response.success && response.data?.configs) {
        setConfigs(response.data.configs);
      } else {
        setError(response.message || '无法加载 AI 配置列表');
      }
    } catch (err) {
      console.error('Error fetching AI configs:', err);
      setError('加载 AI 配置列表时出错');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (configId: string) => {
    setConfirmDeleteId(configId);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    
    setIsDeleting(true);
    try {
      const response = await deleteAIConfig(confirmDeleteId);
      if (response.success) {
        setConfigs(configs.filter(config => config._id !== confirmDeleteId));
        setConfirmDeleteId(null);
      } else {
        setError(response.message || '删除 AI 配置失败');
      }
    } catch (err) {
      console.error('Error deleting AI config:', err);
      setError('删除 AI 配置时出错');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setConfirmDeleteId(null);
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
          <p style={{ fontSize: '1.1rem' }}>正在加载 AI 配置列表...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-config-list-page" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1.5rem',
        borderBottom: '1px solid #e0e0e0',
        paddingBottom: '0.75rem'
      }}>
        <h1 style={{ margin: 0, color: '#333' }}>AI 配置管理</h1>
        <button 
          onClick={() => navigate('/ai-configs/create')} 
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 'bold'
          }}
        >
          添加新配置
        </button>
      </div>
      
      {error && (
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#ffebee', 
          color: '#c62828',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      {confirmDeleteId && (
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#fff3e0', 
          borderRadius: '8px',
          marginBottom: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <p style={{ marginTop: 0 }}>确定要删除此 AI 配置吗？此操作不可撤销。</p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              onClick={handleConfirmDelete} 
              disabled={isDeleting}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {isDeleting ? '删除中...' : '确认删除'}
            </button>
            <button 
              onClick={handleCancelDelete} 
              disabled={isDeleting}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'white',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {configs.length === 0 ? (
        <div style={{ 
          padding: '2rem',
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
          textAlign: 'center',
          color: '#666'
        }}>
          <p style={{ fontSize: '1.1rem' }}>尚未创建任何 AI 配置</p>
          <button 
            onClick={() => navigate('/ai-configs/create')} 
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '1rem'
            }}
          >
            添加第一个 AI 配置
          </button>
        </div>
      ) : (
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '8px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              fontSize: '0.95rem'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #eee' }}>提供商</th>
                  <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #eee' }}>Base URL</th>
                  <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #eee' }}>默认模型</th>
                  <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #eee' }}>状态</th>
                  <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #eee' }}>创建日期</th>
                  <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid #eee' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {configs.map(config => (
                  <tr key={config._id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 'bold' }}>{config.providerName}</div>
                      <div style={{ color: '#666', fontSize: '0.85rem' }}>
                        {config.notes && config.notes.length > 50 
                          ? `${config.notes.substring(0, 50)}...` 
                          : config.notes}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>{config.baseURL || '-'}</td>
                    <td style={{ padding: '1rem' }}>{config.defaultModel || '-'}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        display: 'inline-block',
                        padding: '0.35rem 0.75rem',
                        borderRadius: '50px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        backgroundColor: config.isActive ? '#e8f5e9' : '#ffebee',
                        color: config.isActive ? '#2e7d32' : '#c62828'
                      }}>
                        {config.isActive ? '活跃' : '禁用'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {new Date(config.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                        <button 
                          onClick={() => navigate(`/ai-configs/${config._id}/edit`)}
                          style={{
                            padding: '0.4rem 0.75rem',
                            backgroundColor: '#e3f2fd',
                            color: '#1976d2',
                            border: '1px solid #bbdefb',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                          }}
                        >
                          编辑
                        </button>
                        <button 
                          onClick={() => handleDeleteClick(config._id)}
                          disabled={Boolean(confirmDeleteId)}
                          style={{
                            padding: '0.4rem 0.75rem',
                            backgroundColor: '#ffebee',
                            color: '#c62828',
                            border: '1px solid #ef9a9a',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                          }}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIConfigListPage; 
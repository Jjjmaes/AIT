import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getProjectById, updateProject, UpdateProjectPayload } from '../api/projectService';
import { getPromptTemplates, PromptTemplate } from '../api/promptTemplateService';
import { LANGUAGES, DOMAINS, INDUSTRIES, PRIORITIES } from '../constants/projectConstants'; // Import constants

const EditProjectPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [languagePairs, setLanguagePairs] = useState([{ source: '', target: '' }]);
  const [deadline, setDeadline] = useState(''); // Store as string YYYY-MM-DD
  const [priority, setPriority] = useState<number | ''>('');
  const [domain, setDomain] = useState('');
  const [industry, setIndustry] = useState('');
  // State for prompt templates
  const [translationTemplates, setTranslationTemplates] = useState<PromptTemplate[]>([]);
  const [reviewTemplates, setReviewTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTransPrompt, setSelectedTransPrompt] = useState<string>('');
  const [selectedRevPrompt, setSelectedRevPrompt] = useState<string>('');

  // Loading/Error state
  const [isLoadingPage, setIsLoadingPage] = useState(true); // Combined loading state
  const [isUpdating, setIsUpdating] = useState(false); // Separate state for update operation
  const [error, setError] = useState<string | null>(null);

  // Fetch existing project data AND prompt templates
  useEffect(() => {
    if (!projectId) {
      setError('项目 ID 缺失');
      setIsLoadingPage(false);
      return;
    }

    const loadData = async () => {
      setIsLoadingPage(true);
      setError(null);
      try {
        // Fetch project details and templates concurrently
        const [projectResponse, templatesResponse] = await Promise.all([
          getProjectById(projectId),
          getPromptTemplates()
        ]);

        // Process project data
        if (projectResponse.success && projectResponse.data?.project) {
          const project = projectResponse.data.project;
          setName(project.name);
          setDescription(project.description || '');
          setLanguagePairs(project.languagePairs?.length ? project.languagePairs : [{ source: '', target: '' }]);
          // Format date for input type='date' (YYYY-MM-DD)
          setDeadline(project.deadline ? new Date(project.deadline).toISOString().split('T')[0] : '');
          setPriority(project.priority ?? '');
          setDomain(project.domain || '');
          setIndustry(project.industry || '');
          // Set initial selected templates safely accessing _id
          setSelectedTransPrompt(project.defaultTranslationPromptTemplate?._id || '');
          setSelectedRevPrompt(project.defaultReviewPromptTemplate?._id || '');
          // TODO: Handle project-specific templates (translationPromptTemplate, reviewPromptTemplate) if needed

        } else {
          setError(projectResponse.message || '获取项目详情失败');
        }

        // Process templates data
        if (templatesResponse.success && templatesResponse.data?.templates) {
            const allTemplates = templatesResponse.data.templates;
            setTranslationTemplates(allTemplates.filter(t => t.taskType === 'translation'));
            setReviewTemplates(allTemplates.filter(t => t.taskType === 'review'));
        } else {
            console.error('Failed to fetch prompt templates:', templatesResponse.message);
            setError(prev => prev ? `${prev}; 无法加载提示词模板` : '无法加载提示词模板'); // Append or set error
        }

      } catch (err: any) {
        console.error('Error loading edit page data:', err);
        setError(err.response?.data?.message || err.message || '加载编辑数据时出错');
      } finally {
        setIsLoadingPage(false);
      }
    };

    loadData();
  }, [projectId]);

  // Handlers for language pairs (same as CreateProjectPage)
  const handleAddLanguagePair = () => {
    setLanguagePairs([...languagePairs, { source: '', target: '' }]);
  };

  const handleLanguagePairChange = (index: number, field: 'source' | 'target', value: string) => {
    const updatedPairs = [...languagePairs];
    updatedPairs[index][field] = value;
    setLanguagePairs(updatedPairs);
  };

  const handleRemoveLanguagePair = (index: number) => {
    if (languagePairs.length > 1) {
      const updatedPairs = languagePairs.filter((_, i) => i !== index);
      setLanguagePairs(updatedPairs);
    }
  };

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) { setError('无法在没有项目ID的情况下更新'); return; }
    setError(null);
    setIsUpdating(true);

    // Validation (same as CreateProjectPage)
    if (!name.trim()) { setError('项目名称不能为空'); setIsUpdating(false); return; }
    const validLanguagePairs = languagePairs.filter(pair => pair.source.trim() && pair.target.trim());
    if (validLanguagePairs.length === 0) { setError('至少需要一个有效的语言对'); setIsUpdating(false); return; }
    // Add prompt template validation if needed

    const payload: UpdateProjectPayload = {
      // Only include fields that might have changed
      name: name.trim(),
      description: description.trim() || undefined,
      languagePairs: validLanguagePairs.map(pair => ({ source: pair.source.trim(), target: pair.target.trim() })),
      deadline: deadline ? `${deadline}T00:00:00.000Z` : undefined,
      priority: priority === '' ? undefined : Number(priority),
      domain: domain.trim() || undefined,
      industry: industry.trim() || undefined,
      // Add selected prompt template IDs
      defaultTranslationPromptTemplate: selectedTransPrompt || undefined,
      defaultReviewPromptTemplate: selectedRevPrompt || undefined,
    };

    try {
      const response = await updateProject(projectId, payload);
      if (response.success && response.data?.project) {
        console.log('Project updated:', response.data.project);
        navigate(`/projects/${projectId}`);
      } else {
        setError(response.message || '更新项目失败，未知错误。');
      }
    } catch (err: any) {
      console.error('Update project error:', err);
       // Attempt to parse details if available from backend error handling
      let detailedError = '更新项目时发生错误。';
      if (err.response?.data?.details) {
        try {
          // Format the Zod error details for display
          const errorDetails = err.response.data.details;
          const fieldErrors = Object.entries(errorDetails.fieldErrors || {})
            .map(([field, messages]) => `${field}: ${(messages as string[]).join(', ')}`)
            .join('; ');
          const formErrors = (errorDetails.formErrors || []).join(', ');
          detailedError = `验证失败: ${formErrors} ${fieldErrors}`.trim();
        } catch (e) { 
          // Fallback if details parsing fails
          detailedError = err.response?.data?.message || err.message || detailedError;
        } 
      } else {
          detailedError = err.response?.data?.message || err.message || detailedError;
      }
      setError(detailedError);
    } finally {
      setIsUpdating(false);
    }
  };

  // Render logic
  if (isLoadingPage) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '200px',
        color: '#666'
      }}>
        <div>
          <p style={{ fontSize: '1.1rem' }}>正在加载项目详情和模板...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="edit-project-page" style={{ maxWidth: '900px', margin: '0 auto', padding: '1rem' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1.5rem',
        borderBottom: '1px solid #e0e0e0',
        paddingBottom: '0.75rem'
      }}>
        <h1 style={{ margin: 0, color: '#333' }}>编辑项目</h1>
        <button 
          type="button" 
          onClick={() => navigate(`/projects/${projectId}`)} 
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          返回项目详情
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
      
      <form onSubmit={handleSubmit}>
        <div className="form-card" style={{ 
          backgroundColor: 'white', 
          borderRadius: '8px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
          marginBottom: '1.5rem',
          overflow: 'hidden'
        }}>
          <div className="card-header" style={{ 
            padding: '1rem', 
            backgroundColor: '#f5f5f5', 
            borderBottom: '1px solid #eee',
            fontWeight: 'bold',
            fontSize: '1.1rem',
            color: '#333'
          }}>
            基本信息
          </div>
          <div className="card-content" style={{ padding: '1.5rem' }}>
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="projectName" style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: 'bold',
                color: '#333' 
              }}>
                项目名称: <span style={{ color: '#e53935' }}>*</span>
              </label>
              <input
                type="text"
                id="projectName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isUpdating}
                placeholder="输入项目名称"
                style={{ 
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  fontSize: '1rem'
                }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="projectDescription" style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: 'bold',
                color: '#333' 
              }}>
                描述 (可选):
              </label>
              <textarea
                id="projectDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isUpdating}
                rows={3}
                placeholder="输入项目描述"
                style={{ 
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  fontSize: '1rem',
                  resize: 'vertical',
                  minHeight: '100px'
                }}
              />
            </div>
          </div>
        </div>
        
        <div className="form-card" style={{ 
          backgroundColor: 'white', 
          borderRadius: '8px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
          marginBottom: '1.5rem',
          overflow: 'hidden'
        }}>
          <div className="card-header" style={{ 
            padding: '1rem', 
            backgroundColor: '#f5f5f5', 
            borderBottom: '1px solid #eee',
            fontWeight: 'bold',
            fontSize: '1.1rem',
            color: '#333'
          }}>
            语言对设置 <span style={{ color: '#e53935' }}>*</span>
          </div>
          <div className="card-content" style={{ padding: '1.5rem' }}>
            {languagePairs.map((pair, index) => (
              <div key={index} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: '1rem',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}>
                <select
                  value={pair.source}
                  onChange={(e) => handleLanguagePairChange(index, 'source', e.target.value)}
                  required
                  disabled={isUpdating}
                  style={{ 
                    flex: '1',
                    minWidth: '180px',
                    padding: '0.75rem',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontSize: '1rem'
                  }}
                >
                  <option value="" disabled>选择源语言</option>
                  {LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>

                <span style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  width: '40px',
                  color: '#666'
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>

                <select
                  value={pair.target}
                  onChange={(e) => handleLanguagePairChange(index, 'target', e.target.value)}
                  required
                  disabled={isUpdating}
                  style={{ 
                    flex: '1',
                    minWidth: '180px',
                    padding: '0.75rem',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontSize: '1rem'
                  }}
                >
                  <option value="" disabled>选择目标语言</option>
                  {LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>

                {languagePairs.length > 1 && (
                  <button 
                    type="button" 
                    onClick={() => handleRemoveLanguagePair(index)} 
                    disabled={isUpdating}
                    style={{
                      padding: '0.75rem',
                      backgroundColor: '#ffebee',
                      color: '#c62828',
                      border: '1px solid #ef9a9a',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    移除
                  </button>
                )}
              </div>
            ))}
            <button 
              type="button" 
              onClick={handleAddLanguagePair} 
              disabled={isUpdating}
              style={{
                padding: '0.75rem 1.25rem',
                backgroundColor: '#e3f2fd',
                color: '#1976d2',
                border: '1px solid #bbdefb',
                borderRadius: '4px',
                cursor: 'pointer',
                marginTop: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>+</span> 添加语言对
            </button>
          </div>
        </div>
        
        <div className="form-card" style={{ 
          backgroundColor: 'white', 
          borderRadius: '8px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
          marginBottom: '1.5rem',
          overflow: 'hidden'
        }}>
          <div className="card-header" style={{ 
            padding: '1rem', 
            backgroundColor: '#f5f5f5', 
            borderBottom: '1px solid #eee',
            fontWeight: 'bold',
            fontSize: '1.1rem',
            color: '#333'
          }}>
            项目属性设置
          </div>
          <div className="card-content" style={{ padding: '1.5rem' }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
              gap: '1.5rem' 
            }}>
              <div className="form-group">
                <label htmlFor="projectDeadline" style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: 'bold',
                  color: '#333' 
                }}>
                  截止日期 (可选):
                </label>
                <input
                  type="date"
                  id="projectDeadline"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  disabled={isUpdating}
                  style={{ 
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontSize: '1rem'
                  }}
                />
              </div>
              <div className="form-group">
                <label htmlFor="projectPriority" style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: 'bold',
                  color: '#333' 
                }}>
                  优先级 (可选):
                </label>
                <select
                  id="projectPriority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  disabled={isUpdating}
                  style={{ 
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontSize: '1rem'
                  }}
                >
                  <option value="">选择优先级</option>
                  {PRIORITIES.map(p => (
                    <option key={p.value} value={p.value}>{p.label} ({p.value})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="projectDomain" style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: 'bold',
                  color: '#333' 
                }}>
                  领域 (可选):
                </label>
                <select
                  id="projectDomain"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  disabled={isUpdating}
                  style={{ 
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontSize: '1rem'
                  }}
                >
                  <option value="">选择领域</option>
                  {DOMAINS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="projectIndustry" style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: 'bold',
                  color: '#333' 
                }}>
                  行业 (可选):
                </label>
                <select
                  id="projectIndustry"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  disabled={isUpdating}
                  style={{ 
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontSize: '1rem'
                  }}
                >
                  <option value="">选择行业</option>
                  {INDUSTRIES.map(i => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
        
        <div className="form-card" style={{ 
          backgroundColor: 'white', 
          borderRadius: '8px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
          marginBottom: '1.5rem',
          overflow: 'hidden'
        }}>
          <div className="card-header" style={{ 
            padding: '1rem', 
            backgroundColor: '#f5f5f5', 
            borderBottom: '1px solid #eee',
            fontWeight: 'bold',
            fontSize: '1.1rem',
            color: '#333'
          }}>
            提示词模板设置
          </div>
          <div className="card-content" style={{ padding: '1.5rem' }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
              gap: '1.5rem' 
            }}>
              <div className="form-group">
                <label htmlFor="transPrompt" style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: 'bold',
                  color: '#333' 
                }}>
                  翻译提示词 (可选):
                </label>
                <select
                  id="transPrompt"
                  value={selectedTransPrompt}
                  onChange={(e) => setSelectedTransPrompt(e.target.value)}
                  disabled={isUpdating || translationTemplates.length === 0}
                  style={{ 
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontSize: '1rem'
                  }}
                >
                  <option value="">选择翻译提示词模板</option>
                  {translationTemplates.map(t => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>
                {translationTemplates.length === 0 && (
                  <p style={{ color: '#f57c00', margin: '0.5rem 0 0', fontSize: '0.9rem' }}>
                    未找到翻译提示词模板
                  </p>
                )}
              </div>
              
              <div className="form-group">
                <label htmlFor="revPrompt" style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: 'bold',
                  color: '#333' 
                }}>
                  审校提示词 (可选):
                </label>
                <select
                  id="revPrompt"
                  value={selectedRevPrompt}
                  onChange={(e) => setSelectedRevPrompt(e.target.value)}
                  disabled={isUpdating || reviewTemplates.length === 0}
                  style={{ 
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontSize: '1rem'
                  }}
                >
                  <option value="">选择审校提示词模板</option>
                  {reviewTemplates.map(t => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>
                {reviewTemplates.length === 0 && (
                  <p style={{ color: '#f57c00', margin: '0.5rem 0 0', fontSize: '0.9rem' }}>
                    未找到审校提示词模板
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          marginTop: '1.5rem',
          marginBottom: '2rem' 
        }}>
          <button
            type="button"
            onClick={() => navigate(`/projects/${projectId}`)}
            disabled={isUpdating}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'white',
              color: '#555',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            取消
          </button>
          
          <button
            type="submit"
            disabled={isUpdating}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold',
              minWidth: '120px'
            }}
          >
            {isUpdating ? '更新中...' : '保存更改'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditProjectPage; 
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAIConfig, AIConfigPayload } from '../api/aiConfigService';

const AI_PROVIDERS = [
  'OpenAI',
  'Anthropic',
  'Gemini',
  'Azure OpenAI',
  'Cohere',
  'Ollama',
  'Custom'
];

// Common models for different providers
const DEFAULT_MODELS: Record<string, string[]> = {
  'OpenAI': ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
  'Anthropic': ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-2'],
  'Gemini': ['gemini-pro', 'gemini-pro-vision', 'gemini-ultra'],
  'Azure OpenAI': ['gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
  'Cohere': ['command', 'command-light', 'command-plus', 'command-nightly'],
  'Ollama': ['llama3', 'llama2', 'mixtral'],
  'Custom': []
};

// Default base URLs for providers
const DEFAULT_BASE_URLS: Record<string, string> = {
  'OpenAI': 'https://api.openai.com/v1',
  'Anthropic': 'https://api.anthropic.com/v1',
  'Gemini': 'https://generativelanguage.googleapis.com/v1',
  'Azure OpenAI': '', // Depends on specific Azure deployment
  'Cohere': 'https://api.cohere.ai/v1',
  'Ollama': 'http://localhost:11434/api', // Default for local Ollama
  'Custom': ''
};

const AIConfigCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [providerName, setProviderName] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [baseURL, setBaseURL] = useState<string>('');
  const [models, setModels] = useState<string[]>([]);
  const [defaultModel, setDefaultModel] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [newModel, setNewModel] = useState<string>('');
  const [defaultParams, setDefaultParams] = useState<string>('{\n  "temperature": 0.7,\n  "top_p": 1\n}');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle provider change
  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedProvider = e.target.value;
    setProviderName(selectedProvider);
    setModels(DEFAULT_MODELS[selectedProvider] || []);
    setBaseURL(DEFAULT_BASE_URLS[selectedProvider] || '');
    setDefaultModel('');
  };

  // Handle adding a new model
  const handleAddModel = () => {
    if (newModel.trim() && !models.includes(newModel.trim())) {
      setModels([...models, newModel.trim()]);
      setNewModel('');
    }
  };

  // Handle removing a model
  const handleRemoveModel = (model: string) => {
    setModels(models.filter(m => m !== model));
    if (defaultModel === model) {
      setDefaultModel('');
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsCreating(true);

    // Basic validation
    if (!providerName.trim()) {
      setError('提供商名称不能为空');
      setIsCreating(false);
      return;
    }

    if (!apiKey.trim()) {
      setError('API密钥不能为空');
      setIsCreating(false);
      return;
    }

    if (models.length === 0) {
      setError('至少需要一个有效的模型');
      setIsCreating(false);
      return;
    }

    let parsedParams: Record<string, any> = {};
    try {
      parsedParams = defaultParams.trim() ? JSON.parse(defaultParams) : {};
    } catch (err) {
      setError('默认参数JSON格式无效');
      setIsCreating(false);
      return;
    }

    const payload: AIConfigPayload = {
      providerName: providerName.trim(),
      apiKey: apiKey.trim(),
      baseURL: baseURL.trim() || undefined,
      models,
      defaultModel: defaultModel || undefined,
      defaultParams: Object.keys(parsedParams).length > 0 ? parsedParams : undefined,
      isActive,
      notes: notes.trim() || undefined
    };

    try {
      const response = await createAIConfig(payload);
      if (response.success && response.data?.config) {
        navigate('/ai-configs');
      } else {
        setError(response.message || '创建AI配置失败');
      }
    } catch (err: any) {
      console.error('Create AI config error:', err);
      let errorMessage = '创建AI配置时出错';
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      }
      setError(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="create-ai-config-page" style={{ maxWidth: '900px', margin: '0 auto', padding: '1rem' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1.5rem',
        borderBottom: '1px solid #e0e0e0',
        paddingBottom: '0.75rem'
      }}>
        <h1 style={{ margin: 0, color: '#333' }}>创建新 AI 配置</h1>
        <button 
          type="button" 
          onClick={() => navigate('/ai-configs')} 
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          返回配置列表
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
              <label htmlFor="providerName" style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: 'bold',
                color: '#333' 
              }}>
                提供商: <span style={{ color: '#e53935' }}>*</span>
              </label>
              <select
                id="providerName"
                value={providerName}
                onChange={handleProviderChange}
                required
                disabled={isCreating}
                style={{ 
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  fontSize: '1rem'
                }}
              >
                <option value="" disabled>选择 AI 提供商</option>
                {AI_PROVIDERS.map(provider => (
                  <option key={provider} value={provider}>{provider}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="apiKey" style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: 'bold',
                color: '#333' 
              }}>
                API 密钥: <span style={{ color: '#e53935' }}>*</span>
              </label>
              <input
                type="password"
                id="apiKey"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                required
                disabled={isCreating}
                placeholder="输入 API 密钥"
                style={{ 
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  fontSize: '1rem'
                }}
              />
              <p style={{ color: '#666', margin: '0.5rem 0 0', fontSize: '0.9rem' }}>
                API 密钥将被安全加密存储
              </p>
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="baseURL" style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: 'bold',
                color: '#333' 
              }}>
                Base URL: {providerName === 'Azure OpenAI' && <span style={{ color: '#e53935' }}>*</span>}
              </label>
              <input
                type="text"
                id="baseURL"
                value={baseURL}
                onChange={(e) => setBaseURL(e.target.value)}
                required={providerName === 'Azure OpenAI'}
                disabled={isCreating}
                placeholder={providerName === 'Azure OpenAI' 
                  ? "例如: https://your-resource.openai.azure.com/openai/deployments/your-deployment-name" 
                  : "默认值将被使用，如需修改请输入"}
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
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: 'bold',
                color: '#333' 
              }}>
                激活状态:
              </label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="isActive"
                    checked={isActive}
                    onChange={() => setIsActive(true)}
                    disabled={isCreating}
                    style={{ marginRight: '0.5rem' }}
                  />
                  激活
                </label>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="isActive"
                    checked={!isActive}
                    onChange={() => setIsActive(false)}
                    disabled={isCreating}
                    style={{ marginRight: '0.5rem' }}
                  />
                  禁用
                </label>
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
            模型配置 <span style={{ color: '#e53935' }}>*</span>
          </div>
          <div className="card-content" style={{ padding: '1.5rem' }}>
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="models" style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: 'bold',
                color: '#333' 
              }}>
                可用模型:
              </label>
              
              {models.length > 0 ? (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '0.5rem',
                    marginBottom: '1rem'
                  }}>
                    {models.map(model => (
                      <div key={model} style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        backgroundColor: '#f1f8e9',
                        border: '1px solid #c5e1a5',
                        borderRadius: '4px',
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.9rem',
                        gap: '0.5rem'
                      }}>
                        <span>{model}</span>
                        <button 
                          type="button" 
                          onClick={() => handleRemoveModel(model)}
                          disabled={isCreating}
                          aria-label={`删除模型 ${model}`}
                          style={{ 
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#7cb342',
                            fontWeight: 'bold',
                            fontSize: '1rem',
                            padding: '0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '20px',
                            height: '20px'
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p style={{ color: '#f57c00', marginTop: 0 }}>
                  请至少添加一个模型
                </p>
              )}

              <div style={{ 
                display: 'flex', 
                gap: '0.5rem',
                marginBottom: '1rem'
              }}>
                <input
                  type="text"
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  disabled={isCreating}
                  placeholder="输入模型名称"
                  style={{ 
                    flex: '1',
                    padding: '0.75rem',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontSize: '1rem'
                  }}
                />
                <button 
                  type="button" 
                  onClick={handleAddModel}
                  disabled={isCreating || !newModel.trim()}
                  style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: '#e3f2fd',
                    color: '#1976d2',
                    border: '1px solid #bbdefb',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  添加模型
                </button>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label htmlFor="defaultModel" style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: 'bold',
                  color: '#333' 
                }}>
                  默认模型:
                </label>
                <select
                  id="defaultModel"
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                  disabled={isCreating || models.length === 0}
                  style={{ 
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontSize: '1rem'
                  }}
                >
                  <option value="">选择默认模型 (可选)</option>
                  {models.map(model => (
                    <option key={model} value={model}>{model}</option>
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
            高级设置
          </div>
          <div className="card-content" style={{ padding: '1.5rem' }}>
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="defaultParams" style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: 'bold',
                color: '#333' 
              }}>
                默认参数 (JSON 格式):
              </label>
              <textarea
                id="defaultParams"
                value={defaultParams}
                onChange={(e) => setDefaultParams(e.target.value)}
                disabled={isCreating}
                rows={6}
                placeholder='例如: { "temperature": 0.7, "top_p": 1 }'
                style={{ 
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  fontSize: '1rem',
                  fontFamily: 'monospace',
                  resize: 'vertical'
                }}
              />
              <p style={{ color: '#666', margin: '0.5rem 0 0', fontSize: '0.9rem' }}>
                这些参数将作为调用 API 时的默认值，确保使用有效的 JSON 格式
              </p>
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="notes" style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: 'bold',
                color: '#333' 
              }}>
                备注:
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isCreating}
                rows={3}
                placeholder="输入关于此 AI 配置的附加信息"
                style={{ 
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  fontSize: '1rem',
                  resize: 'vertical'
                }}
              />
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
            onClick={() => navigate('/ai-configs')}
            disabled={isCreating}
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
            disabled={isCreating}
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
            {isCreating ? '创建中...' : '创建配置'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AIConfigCreatePage; 
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getFilesByProjectId, uploadFile, ProjectFile } from '../api/fileService';
import { getProjectById } from '../api/projectService'; // Import project service
import { LANGUAGES, LanguageOption } from '../constants/projectConstants'; // Import LANGUAGES

// Interface for project language pairs used locally
interface LocalLanguagePair {
  source: string;
  target: string;
}

const ProjectFilesPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [projectLanguages, setProjectLanguages] = useState<LocalLanguagePair[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  // Default source/target based on project languages after fetch
  const [sourceLanguage, setSourceLanguage] = useState<string>('');
  const [targetLanguage, setTargetLanguage] = useState<string>('');

  // Combined fetch function for files and project details
  const fetchData = useCallback(async () => {
    if (!projectId) {
      setError('Project ID is missing');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    setProjectLanguages([]); // Reset languages

    try {
      // Fetch both in parallel
      const [filesResponse, projectResponse] = await Promise.all([
        getFilesByProjectId(projectId),
        getProjectById(projectId) // Fetch project details
      ]);

      // Process files response
      if (filesResponse.success && filesResponse.data) {
        setFiles(filesResponse.data);
      } else {
        setError(filesResponse.message || 'Failed to fetch files');
        setFiles([]);
      }

      // Process project response
      if (projectResponse.success && projectResponse.data) {
        const fetchedPairs = projectResponse.data.project.languagePairs;
        if (fetchedPairs && fetchedPairs.length > 0) {
          setProjectLanguages(fetchedPairs); // Store project-specific languages
          // Set default source/target from the first pair
          setSourceLanguage(fetchedPairs[0].source);
          setTargetLanguage(fetchedPairs[0].target);
        } else {
          // Handle case where project has no language pairs defined
          // Optionally, allow selection from all LANGUAGES or show a message
          console.warn('Project has no language pairs defined. Allowing selection from all languages.');
          // Keep projectLanguages empty to signal using global list
          setSourceLanguage(''); // Reset selection
          setTargetLanguage('');
        }
      } else {
        // Error fetching project details, potentially show a specific error
        // For now, we'll primarily rely on the file fetch error message
        console.error('Failed to fetch project details:', projectResponse.message);
        setError(prevError => prevError || projectResponse.message || 'Failed to fetch project details');
        setSourceLanguage(''); // Reset selection
        setTargetLanguage('');
      }

    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'An error occurred fetching data';
      console.error('Fetch data error:', err);
      setError(errorMsg);
      setFiles([]);
      setProjectLanguages([]);
      setSourceLanguage('');
      setTargetLanguage('');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      setUploadError(null); // Clear previous errors on new selection
      setUploadSuccess(null);
    }
  };

  // Get available source languages (either from project or all)
  const getAvailableSourceLanguages = (): LanguageOption[] => {
    if (projectLanguages.length > 0) {
        const sourceCodes = [...new Set(projectLanguages.map(p => p.source))];
        return LANGUAGES.filter(lang => sourceCodes.includes(lang.code));
    }
    return LANGUAGES; // Fallback to all languages
  };

  // Get available target languages based on selected source (or all if no source)
  const getAvailableTargetLanguages = (): LanguageOption[] => {
    if (sourceLanguage && projectLanguages.length > 0) {
        const targetCodes = projectLanguages
            .filter(p => p.source === sourceLanguage)
            .map(p => p.target);
        return LANGUAGES.filter(lang => targetCodes.includes(lang.code));
    } else if (projectLanguages.length > 0) {
        // If no source selected but project has pairs, show all unique targets from project
        const targetCodes = [...new Set(projectLanguages.map(p => p.target))];
        return LANGUAGES.filter(lang => targetCodes.includes(lang.code));
    }
    return LANGUAGES; // Fallback to all languages
  };

  const handleSourceLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSourceLang = e.target.value;
    setSourceLanguage(newSourceLang);
    // Reset target language if it's no longer valid for the new source
    if (projectLanguages.length > 0) {
        const validTargets = projectLanguages
            .filter(p => p.source === newSourceLang)
            .map(p => p.target);
        if (!validTargets.includes(targetLanguage)) {
            setTargetLanguage(validTargets[0] || ''); // Set to first valid target or empty
        }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !projectId || !sourceLanguage || !targetLanguage) {
      setUploadError('Please select a file and ensure both source and target languages are selected.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const response = await uploadFile(projectId, selectedFile, sourceLanguage, targetLanguage);
      if (response.success && response.data) {
        setUploadSuccess(`File '${response.data.fileName}' uploaded successfully!`);
        setSelectedFile(null);
        // Reset languages back to default (first pair or empty)
        if (projectLanguages.length > 0) {
            setSourceLanguage(projectLanguages[0].source);
            setTargetLanguage(projectLanguages[0].target);
        } else {
            setSourceLanguage('');
            setTargetLanguage('');
        }
        const fileInput = document.getElementById('file-upload-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        fetchData(); // Re-fetch data to show new file and potentially updated project info
      } else {
        setUploadError(response.message || 'File upload failed.');
      }
    } catch (err: any) {
      setUploadError(err.response?.data?.message || err.message || 'An error occurred during upload.');
    } finally {
      setIsUploading(false);
    }
  };

  // 添加导航到翻译中心的函数
  const navigateToTranslationCenter = () => {
    navigate(`/projects/${projectId}/translate`);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
      {/* Header with back button */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1.5rem',
        paddingBottom: '0.75rem',
        borderBottom: '1px solid #e0e0e0'
      }}>
        <h1 style={{ margin: 0, color: '#333' }}>项目文件管理</h1>
        <Link 
          to={`/projects/${projectId}`} 
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            color: '#555',
            textDecoration: 'none'
          }}
        >
          返回项目详情
        </Link>
      </div>

      {/* Error Display */}
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

      {/* File Upload Card */}
      <div style={{ 
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
        marginBottom: '2rem',
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
          上传新文件
        </div>
        <div style={{ padding: '1.5rem' }}>
          {/* Language Selection */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: '1.5rem',
            marginBottom: '1.5rem'
          }}>
            <div>
              <label 
                htmlFor="sourceLang" 
                style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: 'bold',
                  color: '#333' 
                }}
              >
                源语言 <span style={{ color: '#e53935' }}>*</span>
              </label>
              <select 
                id="sourceLang"
                value={sourceLanguage}
                onChange={handleSourceLanguageChange} 
                disabled={isUploading || isLoading}
                style={{ 
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  fontSize: '1rem'
                }}
                required
              >
                <option value="" disabled={sourceLanguage !== ''}>选择源语言</option>
                {getAvailableSourceLanguages().map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label 
                htmlFor="targetLang" 
                style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: 'bold',
                  color: '#333' 
                }}
              >
                目标语言 <span style={{ color: '#e53935' }}>*</span>
              </label>
              <select 
                id="targetLang"
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                disabled={isUploading || isLoading || !sourceLanguage}
                style={{ 
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  fontSize: '1rem'
                }}
                required
              >
                <option value="" disabled={targetLanguage !== ''}>选择目标语言</option>
                {getAvailableTargetLanguages().map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* File Selection */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label 
              htmlFor="file-upload-input" 
              style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: 'bold',
                color: '#333' 
              }}
            >
              选择文件 <span style={{ color: '#e53935' }}>*</span>
            </label>
            <div style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              flexWrap: 'wrap'
            }}>
              <div style={{ 
                flex: '1',
                border: '1px dashed #ccc',
                borderRadius: '4px',
                padding: '1.5rem',
                textAlign: 'center',
                backgroundColor: '#fafafa',
                minWidth: '250px'
              }}>
                <input 
                  type="file" 
                  id="file-upload-input"
                  onChange={handleFileChange} 
                  disabled={isUploading || isLoading}
                  style={{ display: 'none' }}
                />
                <label 
                  htmlFor="file-upload-input" 
                  style={{ 
                    display: 'block',
                    cursor: isUploading || isLoading ? 'not-allowed' : 'pointer',
                    color: '#1976d2',
                    opacity: isUploading || isLoading ? 0.7 : 1
                  }}
                >
                  <div style={{ marginBottom: '0.5rem' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M11 14.9861C11 15.5384 11.4477 15.9861 12 15.9861C12.5523 15.9861 13 15.5384 13 14.9861V7.82831L16.2428 11.0711C16.6333 11.4616 17.2665 11.4616 17.657 11.0711C18.0475 10.6806 18.0475 10.0474 17.657 9.65692L12.7071 4.70692C12.3166 4.31639 11.6834 4.31639 11.2929 4.70692L6.34292 9.65692C5.95239 10.0474 5.95239 10.6806 6.34292 11.0711C6.73344 11.4616 7.36661 11.4616 7.75713 11.0711L11 7.82831V14.9861Z" fill="currentColor"/>
                      <path d="M4 14H6V18H18V14H20V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V14Z" fill="currentColor"/>
                    </svg>
                  </div>
                  <div>
                    <span style={{ fontWeight: 'bold' }}>点击选择文件</span> 或拖放文件到此处
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
                    支持的格式: TXT, DOC, DOCX, PDF, XLS, XLSX, PPT, PPTX
                  </div>
                </label>
                {selectedFile && (
                  <div style={{ 
                    marginTop: '1rem', 
                    padding: '0.5rem',
                    backgroundColor: '#e3f2fd',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span style={{ fontWeight: 'bold', color: '#0d47a1' }}>
                      已选择: {selectedFile.name}
                    </span>
                    <button 
                      onClick={() => { 
                        setSelectedFile(null);
                        const fileInput = document.getElementById('file-upload-input') as HTMLInputElement;
                        if (fileInput) fileInput.value = '';
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#f44336',
                        cursor: 'pointer',
                        fontSize: '1.25rem'
                      }}
                      title="清除选择"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
              
              <button 
                onClick={handleUpload} 
                disabled={isUploading || !selectedFile || !sourceLanguage || !targetLanguage}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: isUploading || !selectedFile || !sourceLanguage || !targetLanguage ? '#e0e0e0' : '#1976d2',
                  color: isUploading || !selectedFile || !sourceLanguage || !targetLanguage ? '#9e9e9e' : 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isUploading || !selectedFile || !sourceLanguage || !targetLanguage ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  minWidth: '120px'
                }}
              >
                {isUploading ? '上传中...' : '上传文件'}
              </button>
            </div>
          </div>
          
          {/* Upload Status Messages */}
          {uploadError && (
            <div style={{ 
              padding: '0.75rem',
              backgroundColor: '#ffebee',
              color: '#c62828',
              borderRadius: '4px',
              marginTop: '1rem'
            }}>
              <p style={{ margin: 0 }}>{uploadError}</p>
            </div>
          )}
          
          {uploadSuccess && (
            <div style={{ 
              padding: '0.75rem',
              backgroundColor: '#e8f5e9',
              color: '#2e7d32',
              borderRadius: '4px',
              marginTop: '1rem'
            }}>
              <p style={{ margin: 0 }}>{uploadSuccess}</p>
            </div>
          )}
        </div>
      </div>

      {/* Files List */}
      <div style={{ 
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
        marginBottom: '2rem',
        overflow: 'hidden'
      }}>
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#f5f5f5', 
          borderBottom: '1px solid #eee',
          fontWeight: 'bold',
          fontSize: '1.1rem',
          color: '#333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>项目文件列表</span>
          {isLoading && <span style={{ fontSize: '0.875rem', color: '#666' }}>正在加载...</span>}
        </div>
        
        <div style={{ padding: '0' }}>
          {isLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
              加载文件列表...
            </div>
          ) : files.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
              项目中尚未上传任何文件。
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#fafafa' }}>
                  <th style={{ padding: '1rem', borderBottom: '1px solid #eee' }}>文件名</th>
                  <th style={{ padding: '1rem', borderBottom: '1px solid #eee' }}>语言</th>
                  <th style={{ padding: '1rem', borderBottom: '1px solid #eee' }}>状态</th>
                  <th style={{ padding: '1rem', borderBottom: '1px solid #eee' }}>创建日期</th>
                  <th style={{ padding: '1rem', borderBottom: '1px solid #eee' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file._id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 'bold' }}>{file.fileName}</div>
                      {file.originalFilename && file.originalFilename !== file.fileName && (
                        <div style={{ fontSize: '0.75rem', color: '#666' }}>
                          原文件名: {file.originalFilename}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div>{file.sourceLanguage} → {file.targetLanguage}</div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        display: 'inline-block',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        color: 'white',
                        backgroundColor: 
                          file.status === 'PROCESSING' ? '#fb8c00' :
                          file.status === 'READY_FOR_REVIEW' ? '#1976d2' :
                          file.status === 'DONE' ? '#43a047' :
                          file.status === 'ERROR' ? '#c62828' :
                          '#757575'
                      }}>
                        {file.status === 'PROCESSING' ? '处理中' :
                         file.status === 'READY_FOR_REVIEW' ? '待审校' :
                         file.status === 'DONE' ? '已完成' :
                         file.status === 'ERROR' ? '错误' :
                         file.status}
                      </span>
                      {file.progress !== undefined && file.progress < 100 && (
                        <div style={{ 
                          marginTop: '0.5rem', 
                          height: '4px', 
                          backgroundColor: '#e0e0e0',
                          borderRadius: '2px',
                          overflow: 'hidden'
                        }}>
                          <div style={{ 
                            height: '100%', 
                            width: `${file.progress}%`,
                            backgroundColor: '#1976d2'
                          }}></div>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {new Date(file.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {file.status === 'pending' && (
                          <button 
                            onClick={navigateToTranslationCenter}
                            style={{
                              padding: '0.5rem 0.75rem',
                              backgroundColor: '#e3f2fd',
                              color: '#1976d2',
                              border: '1px solid #bbdefb',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            前往翻译中心
                          </button>
                        )}
                        
                        {file.status === 'READY_FOR_REVIEW' && (
                          <Link 
                            to={`/files/${file._id}/review`}
                            style={{
                              padding: '0.5rem 0.75rem',
                              backgroundColor: '#fff3e0',
                              color: '#f57c00',
                              border: '1px solid #ffe0b2',
                              borderRadius: '4px',
                              textDecoration: 'none',
                              display: 'inline-block'
                            }}
                          >
                            审校
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectFilesPage; 
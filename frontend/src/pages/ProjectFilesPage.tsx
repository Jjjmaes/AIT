import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getFilesByProjectId, uploadFile, ProjectFile, startFileTranslation } from '../api/fileService';
import { getProjectById } from '../api/projectService'; // Import project service
import { LANGUAGES, LanguageOption } from '../constants/projectConstants'; // Import LANGUAGES

// Interface for project language pairs used locally
interface LocalLanguagePair {
  source: string;
  target: string;
}

const ProjectFilesPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [projectLanguages, setProjectLanguages] = useState<LocalLanguagePair[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [translatingFileId, setTranslatingFileId] = useState<string | null>(null); // State for tracking translation
  const [translateError, setTranslateError] = useState<string | null>(null); // State for translation error
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
        const fetchedPairs = projectResponse.data.languagePairs;
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
        setUploadSuccess(`File '${response.data.filename}' uploaded successfully!`);
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

  // Handler for clicking the Translate button
  const handleTranslateClick = async (fileId: string) => {
    setTranslatingFileId(fileId); // Indicate which file is being processed
    setTranslateError(null); // Clear previous errors
    try {
      const response = await startFileTranslation(fileId);
      if (response.success) {
        console.log(`Translation started for file ${fileId}`);
        // Option 1: Optimistic update (faster UI, less accurate)
        // setFiles(prevFiles => 
        //   prevFiles.map(f => f._id === fileId ? { ...f, status: 'TRANSLATING' } : f)
        // );
        // Option 2: Re-fetch data (slower UI, more accurate)
        fetchData(); 
      } else {
        setTranslateError(response.message || `Failed to start translation for file ${fileId}.`);
      }
    } catch (err: any) {
      console.error('Start translation error:', err);
      setTranslateError(err.response?.data?.message || err.message || `An error occurred starting translation for file ${fileId}.`);
    } finally {
      setTranslatingFileId(null); // Clear processing state
    }
  };

  return (
    <div>
      <h1>项目 {projectId} 的文件</h1>

      {/* --- File Upload Section --- */}
      <div style={{ border: '1px solid #ccc', padding: '1rem', marginBottom: '1rem' }}>
        <h2>上传新文件</h2>
        <div>
          <label htmlFor="sourceLang">源语言: </label>
          {/* Source Language Select */}
          <select 
            id="sourceLang"
            value={sourceLanguage}
            onChange={handleSourceLanguageChange} 
            disabled={isUploading || isLoading} // Also disable while loading project data
            style={{ marginRight: '1rem', minWidth: '150px' }}
            required
          >
            <option value="" disabled={sourceLanguage !== ''}>选择源语言</option>
            {getAvailableSourceLanguages().map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
            ))}
          </select>

          <label htmlFor="targetLang">目标语言: </label>
          {/* Target Language Select */}
          <select 
            id="targetLang"
            value={targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value)}
            disabled={isUploading || isLoading || !sourceLanguage} // Disable if no source selected
            style={{ minWidth: '150px' }}
            required
          >
            <option value="" disabled={targetLanguage !== ''}>选择目标语言</option>
            {getAvailableTargetLanguages().map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
            ))}
           </select>
        </div>
        <div style={{ marginTop: '0.5rem' }}>
          <input 
            type="file" 
            id="file-upload-input"
            onChange={handleFileChange} 
            disabled={isUploading || isLoading}
            style={{ marginRight: '1rem' }}
          />
          <button 
            onClick={handleUpload} 
            disabled={!selectedFile || !sourceLanguage || !targetLanguage || isUploading || isLoading}
          >
            {isUploading ? '上传中...' : '上传文件'}
          </button>
        </div>
        {uploadError && <p style={{ color: 'red', marginTop: '0.5rem' }}>上传错误: {uploadError}</p>}
        {uploadSuccess && <p style={{ color: 'green', marginTop: '0.5rem' }}>{uploadSuccess}</p>}
      </div>
      {/* --- End File Upload Section --- */}
      
      {/* --- File List Section --- */}
      <h2>已有文件</h2>
      {isLoading && <p>正在加载文件...</p>}
      {error && <p style={{ color: 'red' }}>错误: {error}</p>}

      {!isLoading && !error && (
        <>
          {files.length === 0 ? (
            <p>此项目未找到文件。</p>
          ) : (
            <table border={1} style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px', textAlign: 'left' }}>文件名</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>状态</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>进度</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>语言对</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>单词数</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>上传日期</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {files.map(file => (
                  <tr key={file._id}>
                    <td style={{ padding: '8px' }}>{file.filename}</td>
                    <td style={{ padding: '8px' }}>{file.status}</td>
                    <td style={{ padding: '8px' }}>{file.progress || 0}%</td>
                    <td style={{ padding: '8px' }}>{`${file.originalLanguage} -> ${file.targetLanguage}`}</td>
                    <td style={{ padding: '8px' }}>{file.wordCount ?? 'N/A'}</td>
                    <td style={{ padding: '8px' }}>{new Date(file.createdAt).toLocaleString()}</td>
                    <td style={{ padding: '8px' }}>
                      {/* Translate Button */}
                      {file.status === 'PENDING' && (
                        <button 
                          onClick={() => handleTranslateClick(file._id)}
                          disabled={isLoading || isUploading || !!translatingFileId} // Disable if loading, uploading, or another translation is in progress
                        >
                          {translatingFileId === file._id ? '启动中...' : '开始翻译'}
                        </button>
                      )}
                      {/* Add Review Button later based on status */}
                      {file.status === 'REVIEW_PENDING' && (
                         <Link to={`/projects/${projectId}/files/${file._id}/review`}>
                            <button disabled={isLoading || isUploading || !!translatingFileId}>
                                开始审校
                            </button>
                         </Link>
                      )}
                       {/* Add Delete Button later */}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {translateError && <p style={{ color: 'red', marginTop: '1rem' }}>翻译操作错误: {translateError}</p>}
        </>
      )}

      <div style={{ marginTop: '1rem' }}>
        <Link to={`/projects/${projectId}`}>返回项目详情</Link>
      </div>
    </div>
  );
};

export default ProjectFilesPage; 
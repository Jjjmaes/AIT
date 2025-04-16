import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getFilesByProjectId, uploadFile, FileType } from '../api/fileService';

// Assuming styles are defined elsewhere or remove if not used
const styles = {
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginTop: '1rem' } as React.CSSProperties,
  th: { borderBottom: '2px solid #eee', padding: '12px 8px', background: '#f8f8f8', fontWeight: 600 } as React.CSSProperties,
  td: { borderBottom: '1px solid #eee', padding: '12px 8px' } as React.CSSProperties,
  actionButton: {
    padding: '4px 8px',
    fontSize: '0.85rem',
    cursor: 'pointer',
    background: '#e0e0e0',
    border: 'none',
    borderRadius: '4px'
  } as React.CSSProperties,
};

// Updated status styling function to match FileType status values
const getStatusStyle = (status: FileType['status']): React.CSSProperties => { 
  let backgroundColor = '#f0f0f0';
  let color = '#333';
  switch (status) {
    case 'pending':
      backgroundColor = '#e8f5e9'; color = '#2e7d32'; break;
    case 'processing':
    case 'extracted':
    case 'translating':
    case 'reviewing':
      backgroundColor = '#e3f2fd'; color = '#0d47a1'; break;
    case 'translated':
    case 'review_completed':
      backgroundColor = '#fff9c4'; color = '#f57f17'; break;
    case 'completed':
      backgroundColor = '#dcedc8'; color = '#33691e'; break;
    case 'error':
      backgroundColor = '#ffebee'; color = '#c62828'; break;
  }
  return { backgroundColor, color, padding: '3px 8px', borderRadius: '4px', fontSize: '0.8rem', display: 'inline-block' };
};

const ProjectFilesPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [files, setFiles] = useState<FileType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!projectId) {
      setError('Project ID is missing');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const fetchedFiles = await getFilesByProjectId(projectId);
      setFiles(fetchedFiles);

    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'An error occurred fetching files';
      console.error('Fetch files error:', err);
      setError(errorMsg);
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // --- DEBUG LOGGING ---
    console.log('[ProjectFilesPage] handleFileChange triggered.');
    // --- END DEBUG LOGGING ---
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      // --- DEBUG LOGGING ---
      console.log('[ProjectFilesPage] File selected:', file);
      // --- END DEBUG LOGGING ---
      setSelectedFile(file);
      setUploadError(null);
      setUploadSuccess(null);
    } else {
      // --- DEBUG LOGGING ---
      console.log('[ProjectFilesPage] No file selected or event structure unexpected.');
      // --- END DEBUG LOGGING ---
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !projectId) {
      setUploadError('No file selected or project ID missing.');
      return;
    }

    console.log(`[ProjectFilesPage] Starting upload for ${selectedFile.name} to project ${projectId}`);
    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      // Call the API service function
      const uploadedFile = await uploadFile(selectedFile, projectId);

      console.log('[ProjectFilesPage] Upload successful, received file data:', uploadedFile);

      // Add the newly uploaded file to the beginning of the list
      setFiles(prevFiles => [uploadedFile, ...prevFiles]);
      setUploadSuccess(`文件 '${uploadedFile.fileName}' 上传成功！`);
      setSelectedFile(null); // Clear the selected file input

    } catch (err: any) {
      // Log the detailed error
      console.error('[ProjectFilesPage] Upload failed:', err);
      console.error('[ProjectFilesPage] Error response data:', err.response?.data);

      // Set a user-friendly error message
      const errorMsg = err.response?.data?.message || err.message || '文件上传失败。请检查文件或稍后重试。';
      setUploadError(errorMsg);

    } finally {
      setIsUploading(false);
      console.log('[ProjectFilesPage] Upload process finished.');
    }
  };

  // Removed unused navigateToTranslationCenter function as the logic is directly in the button
  
  // --- DEBUG LOGGING --- 
  console.log('[ProjectFilesPage] Rendering - State values:', { 
    projectId, 
    selectedFile: !!selectedFile, // Log boolean to check if it exists
    isUploading, 
    isLoading, 
    error, 
    uploadError, 
    uploadSuccess 
  });
  // --- END DEBUG LOGGING --- 

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
          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="file-upload-input" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              选择文件:
            </label>
            <input
              id="file-upload-input"
              type="file"
              onChange={handleFileChange}
              style={{ border: '1px solid #ccc', padding: '8px', borderRadius: '4px' }}
            />
            {selectedFile && (
              <p style={{ marginTop: '0.75rem', color: '#555', fontSize: '0.9em' }}>
                已选择: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>

          <div style={{ textAlign: 'right' }}>
            {uploadError && <p style={{ color: '#c62828', marginRight: '1rem', display: 'inline-block' }}>错误: {uploadError}</p>}
            {uploadSuccess && <p style={{ color: '#2e7d32', marginRight: '1rem', display: 'inline-block' }}>{uploadSuccess}</p>}
            <button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              style={{
                padding: '0.6rem 1.2rem',
                backgroundColor: (!selectedFile || isUploading) ? '#e0e0e0' : '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: (!selectedFile || isUploading) ? 'not-allowed' : 'pointer',
                fontWeight: 'bold'
              }}
            >
              {isUploading ? '上传中...' : '上传文件'}
            </button>
          </div>
        </div>
      </div>

      {/* File List Table - Cleaned up structure and fixed errors */}
      <div style={{ marginTop: '2rem' }}> 
        <h2 style={{ marginBottom: '1rem', color: '#333' }}>已上传文件</h2>
        {isLoading ? (
          <p>加载文件中...</p>
        ) : files.length === 0 ? (
          <p style={{ fontStyle: 'italic', color: '#666' }}>此项目尚无文件。</p>
        ) : (
          <table style={styles.table}> 
            <thead> 
              <tr>
                <th style={styles.th}>文件名</th>
                <th style={styles.th}>大小</th>
                <th style={styles.th}>状态</th>
                <th style={styles.th}>上传日期</th> 
                <th style={styles.th}>操作</th>
              </tr>
            </thead> 
            <tbody> 
              {files.map((file) => (
                <tr key={file._id}>
                  <td style={styles.td}>{file.fileName}</td>
                  <td style={styles.td}>{(file.fileSize / 1024).toFixed(2)} KB</td>
                  <td style={styles.td}>
                    <span style={getStatusStyle(file.status)}>
                      {file.status}
                    </span>
                  </td>
                  <td style={styles.td}>{new Date(file.createdAt).toLocaleString('zh-CN')}</td>
                  <td style={styles.td}>
                    {(file.status === 'pending' || file.status === 'translated' || file.status === 'completed') && (
                      <button
                        onClick={() => navigate(`/projects/${projectId}/files/${file._id}/translate`)}
                        style={styles.actionButton}
                      >
                        翻译/编辑
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody> 
          </table> 
        )}
      </div>
    </div>
  );
};

export default ProjectFilesPage; 
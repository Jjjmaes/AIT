import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getFilesByProjectId, uploadFile, FileType } from '../api/fileService';
import { useFileStore, FileState } from '../store/fileStore'; // Import Zustand store AND FileState type
import { useFileProgressSSE } from '../hooks/useFileProgressSSE'; // Import SSE hook
import { Progress, Tag, Button, Table, message, Space } from 'antd'; // Import Ant Design components
import { 
    TranslationOutlined, 
    CheckCircleOutlined, 
    ExclamationCircleOutlined, 
    SyncOutlined, 
    ClockCircleOutlined, 
    FormOutlined // Add FormOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs'; // For date formatting

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

// Map FileStatus values to Ant Design status prop and icons
const getProgressStatus = (status: string): "success" | "exception" | "active" | "normal" => {
  switch (status) {
    case 'completed':
    case 'translated':
    case 'review_completed':
      return 'success';
    case 'error':
      return 'exception';
    case 'translating':
    case 'reviewing':
    case 'processing': // Add processing as active
      return 'active';
    default:
      return 'normal';
  }
};

const getStatusTag = (status: string) => {
  let color = 'default';
  let icon = <ClockCircleOutlined />;
  let text = status.toUpperCase();

  switch (status) {
    case 'pending': color = 'default'; break;
    case 'processing':
    case 'extracted':
       color = 'processing'; icon = <SyncOutlined spin />; break;
    case 'translating': color = 'processing'; icon = <TranslationOutlined />; text = 'TRANSLATING'; break;
    case 'reviewing': color = 'processing'; icon = <FormOutlined />; text = 'REVIEWING'; break;
    case 'translated':
    case 'review_completed':
        color = 'warning'; icon = <TranslationOutlined />; break;
    case 'completed': color = 'success'; icon = <CheckCircleOutlined />; break;
    case 'error': color = 'error'; icon = <ExclamationCircleOutlined />; break;
    default: text = status.toUpperCase(); break;
  }
  return <Tag icon={icon} color={color}>{text}</Tag>;
};

const ProjectFilesPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // --- Zustand Store Integration --- 
  const filesMap = useFileStore((state) => state.files);
  const setFilesInStore = useFileStore((state) => state.setFiles);
  const addFileToStore = useFileStore((state) => state.addFile);
  // Remove file from store if delete functionality is added later
  // const removeFileFromStore = useFileStore((state) => state.removeFile);
  
  // --- Initialize SSE Connection --- 
  useFileProgressSSE(); // This hook manages connection lifecycle

  // Local state for UI interaction (loading, errors, upload form)
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  // Keep uploadError/Success local as they relate to the upload action itself
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // --- Fetch Initial Data --- 
  const fetchData = useCallback(async () => {
    if (!projectId) {
      setError('Project ID is missing');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const fetchedFiles = await getFilesByProjectId(projectId!);
      // --- Normalize and update the Zustand store --- 
      const normalizedFiles = fetchedFiles.map(f => ({
          id: f._id, // Use _id from backend as id
          projectId: f.projectId,
          fileName: f.fileName || f.originalName || 'Unnamed File',
          originalName: f.originalName,
          fileSize: f.fileSize,
          mimeType: f.mimeType,
          type: f.type, // Assuming type is FileType enum string
          // Handle both potential progress structures from backend
          progress: typeof f.progress === 'number' ? f.progress : (f.progress as any)?.percentage ?? 0,
          status: f.status || 'pending', // Default to pending if missing
          storageUrl: f.storageUrl,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
          // Add other fields as needed
      }));
      setFilesInStore(normalizedFiles as FileState[]);
      // --- End Store Update --- 

    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'An error occurred fetching files';
      console.error('Fetch files error:', err);
      setError(errorMsg);
      setFilesInStore([]); // Clear store on error
    } finally {
      setIsLoading(false);
    }
  }, [projectId, setFilesInStore]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- File Upload Handlers --- 
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      setUploadError(null);
      setUploadSuccess(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !projectId) {
      setUploadError('No file selected or project ID missing.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
    const uploadToastKey = 'uploading';
    message.loading({ content: '上传文件中...', key: uploadToastKey, duration: 0 });

    try {
      const uploadedFile = await uploadFile(selectedFile, projectId);
      // --- Add file to Zustand store --- 
      const normalizedFile: FileState = {
          id: uploadedFile._id,
          projectId: uploadedFile.projectId,
          fileName: uploadedFile.fileName || uploadedFile.originalName || 'Unnamed File',
          originalName: uploadedFile.originalName,
          fileSize: uploadedFile.fileSize,
          mimeType: uploadedFile.mimeType,
          type: uploadedFile.type,
          progress: typeof uploadedFile.progress === 'number' ? uploadedFile.progress : (uploadedFile.progress as any)?.percentage ?? 0,
          status: uploadedFile.status || 'pending',
          storageUrl: uploadedFile.storageUrl,
          createdAt: uploadedFile.createdAt,
          updatedAt: uploadedFile.updatedAt,
      };
      addFileToStore(normalizedFile);
      // --- End Store Update --- 

      message.success({ content: `文件 '${normalizedFile.fileName}' 上传成功！`, key: uploadToastKey, duration: 3 });
      setSelectedFile(null); // Clear the selected file input
      // Reset the file input visually (find a better way if possible)
      const input = document.getElementById('file-upload-input') as HTMLInputElement;
      if (input) input.value = ''; 

    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || '文件上传失败。请检查文件或稍后重试。';
      message.error({ content: `上传失败: ${errorMsg}`, key: uploadToastKey, duration: 5 });
      console.error('[ProjectFilesPage] Upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  // --- Convert Map to Array for Rendering --- 
  const fileList = Array.from(filesMap.values()).sort((a, b) => 
     new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  ); // Sort by creation date descending

  // --- Define Table Columns --- 
  const columns = [
    {
      title: '文件名',
      dataIndex: 'fileName',
      key: 'fileName',
      render: (text: string, record: FileState) => (
         // Link to translation center or review page based on status?
        <Link to={`/projects/${projectId}/files/${record.id}/translate`}>{text}</Link> 
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: FileState) => getStatusTag(status),
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      render: (progress: number, record: FileState) => (
         // Use the progress value directly from the store state (already normalized)
         <Progress 
            percent={progress} 
            size="small" 
            status={getProgressStatus(record.status)} 
         />
      ),
    },
     {
      title: '大小',
      dataIndex: 'fileSize',
      key: 'fileSize',
      render: (size: number, record: FileState) => size ? `${(size / 1024).toFixed(2)} KB` : '-',
    },
    {
      title: '上传时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string | Date | undefined, record: FileState) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: FileState) => (
        <Space size="middle">
           {/* Add actions like Download, Delete, Go to Editor/Review */} 
          <Button size="small" onClick={() => navigate(`/projects/${projectId}/files/${record.id}/translate`)}>编辑</Button>
          {/* <Button size="small" danger onClick={() => handleDeleteFile(record.id)}>删除</Button> */} 
        </Space>
      ),
    },
  ];

  // --- Rendering Logic --- 
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

      {/* File List Table using Ant Design */}
      <div style={{ marginTop: '2rem' }}> 
        <Table 
          columns={columns} 
          dataSource={fileList} 
          rowKey="id" // Use file.id as the key
          loading={isLoading} 
          pagination={{ pageSize: 10 }} // Add pagination if desired
        />
      </div>
    </div>
  );
};

export default ProjectFilesPage; 
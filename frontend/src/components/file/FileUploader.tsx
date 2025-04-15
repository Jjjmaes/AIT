import React, { useState } from 'react';
import { 
  Upload, 
  Button, 
  message, 
  Progress, 
  Card, 
  Space, 
  Typography, 
  Alert,
  List,
  Tag
} from 'antd';
import { 
  FileAddOutlined,
  DeleteOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
  FileWordOutlined,
  FileTextOutlined,
  FileUnknownOutlined
} from '@ant-design/icons';
import type { UploadFile, UploadProps, UploadChangeParam } from 'antd/es/upload/interface';
import api from '../../api/api';
import { formatFileSize } from '../../utils/formatUtils';

const { Dragger } = Upload;
const { Title, Text } = Typography;

interface FileUploaderProps {
  projectId: string;
  onUploadComplete: () => void;
  supportedFormats?: string[];
  maxFileSize?: number; // 单位: MB
}

// 扩展名到图标映射
const getFileIcon = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'pdf':
      return <FilePdfOutlined />;
    case 'doc':
    case 'docx':
      return <FileWordOutlined />;
    case 'xls':
    case 'xlsx':
    case 'csv':
      return <FileExcelOutlined />;
    case 'txt':
    case 'md':
    case 'xml':
    case 'json':
      return <FileTextOutlined />;
    default:
      return <FileUnknownOutlined />;
  }
};

// 默认支持的文件格式
const DEFAULT_SUPPORTED_FORMATS = [
  '.doc', '.docx', '.pdf', '.txt', '.xml', '.json', '.md', '.csv', '.xls', '.xlsx'
];

const FileUploader: React.FC<FileUploaderProps> = ({
  projectId,
  onUploadComplete,
  supportedFormats = DEFAULT_SUPPORTED_FORMATS,
  maxFileSize = 20, // 默认20MB
}) => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 上传前检查文件类型和大小
  const beforeUpload = (file: File) => {
    const isFormatValid = supportedFormats.some(format => 
      file.name.toLowerCase().endsWith(format)
    );
    
    if (!isFormatValid) {
      message.error(`不支持${file.name}的文件格式。支持的格式: ${supportedFormats.join(', ')}`);
      return Upload.LIST_IGNORE;
    }
    
    const isSizeValid = file.size / 1024 / 1024 < maxFileSize;
    if (!isSizeValid) {
      message.error(`文件必须小于 ${maxFileSize}MB!`);
      return Upload.LIST_IGNORE;
    }
    
    return true;
  };
  
  // 自定义上传
  const customUpload = async (options: any) => {
    const { file, onProgress, onSuccess, onError } = options;
    
    setUploading(true);
    setError(null);
    
    // 创建FormData
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      // 创建上传请求
      const response = await api.post(
        `/projects/${projectId}/files/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const percent = Math.round(
              (progressEvent.loaded * 100) / (progressEvent.total || 1)
            );
            onProgress({ percent });
          },
        }
      );
      
      onSuccess(response.data, file);
      message.success(`${file.name} 上传成功`);
      onUploadComplete();
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || '上传失败';
      setError(errorMsg);
      onError({ status: err.response?.status, message: errorMsg });
      message.error(`${file.name} 上传失败：${errorMsg}`);
    } finally {
      setUploading(false);
    }
  };
  
  // 处理上传列表变化
  const handleChange: UploadProps['onChange'] = (info: UploadChangeParam<UploadFile<any>>) => {
    // Keep only the last X files if needed, or just update the list
    let fileList = [...info.fileList];
    // fileList = fileList.slice(-5); // Example: keep last 5 files
    
    // Update progress, status etc.
    fileList = fileList.map(file => {
      if (file.response) {
        // Component will show file.url as link
        // file.url = file.response.url; // Example if server returns URL
      }
      return file;
    });

    setFileList(fileList);
  };
  
  // 处理移除文件
  const handleRemove = (file: UploadFile) => {
    setFileList(prev => prev.filter(item => item.uid !== file.uid));
    return true;
  };
  
  // 获取格式友好的支持格式列表
  const getSupportedFormatsText = () => {
    return supportedFormats.map(format => format.replace('.', '')).join(', ');
  };

  return (
    <Card>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Title level={4}>上传文件</Title>
          <Text type="secondary">
            支持的格式: {getSupportedFormatsText()}。单个文件大小限制: {maxFileSize}MB
          </Text>
        </div>
        
        {error && (
          <Alert
            message="上传错误"
            description={error}
            type="error"
            showIcon
            closable
            onClose={() => setError(null)}
          />
        )}
        
        <Dragger
          name="file"
          multiple
          fileList={fileList}
          beforeUpload={beforeUpload}
          customRequest={customUpload}
          onChange={handleChange}
          onRemove={handleRemove}
          disabled={uploading}
          style={{ padding: '20px 0' }}
        >
          <p className="ant-upload-drag-icon">
            <FileAddOutlined style={{ fontSize: 48, color: '#1890ff' }} />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            支持单个或批量上传。上传后文件将自动解析并分段。
          </p>
        </Dragger>
        
        {fileList.length > 0 && (
          <List
            header={<div>上传文件列表</div>}
            bordered
            dataSource={fileList}
            renderItem={(file: UploadFile) => (
              <List.Item
                actions={[
                  <Button 
                    key="delete" 
                    icon={<DeleteOutlined />} 
                    size="small" 
                    danger
                    onClick={() => handleRemove(file)}
                    disabled={file.status === 'uploading'}
                  >
                    移除
                  </Button>
                ]}
              >
                <List.Item.Meta
                  avatar={getFileIcon(file.name)}
                  title={file.name}
                  description={
                    <Space>
                      <Text type="secondary">{formatFileSize(file.size || 0)}</Text>
                      {file.status === 'uploading' && (
                        <Progress percent={file.percent} size="small" />
                      )}
                      {file.status === 'done' && (
                        <Tag color="success">上传成功</Tag>
                      )}
                      {file.status === 'error' && (
                        <Tag color="error">上传失败</Tag>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
        
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            type="primary"
            onClick={onUploadComplete}
            disabled={fileList.some(file => file.status === 'uploading')}
          >
            完成
          </Button>
        </div>
      </Space>
    </Card>
  );
};

export default FileUploader; 
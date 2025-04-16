import React from 'react';
import { Table, Tag, Typography, Button, Empty } from 'antd';
import { CheckCircleOutlined, SyncOutlined, ClockCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

interface FileListProps {
  files: any[]; // Replace with proper type when available
  selectedFileIds: string[];
  onSelectFiles: (fileIds: string[]) => void;
}

const FileList: React.FC<FileListProps> = ({ files, selectedFileIds, onSelectFiles }) => {
  const columns: ColumnsType<any> = [
    {
      title: '文件名',
      dataIndex: 'originalName',
      key: 'originalName',
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          <div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.sourceLanguage} → {record.targetLanguage}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: '大小',
      dataIndex: 'fileSize',
      key: 'fileSize',
      width: 100,
      render: (size) => `${(size / 1024).toFixed(2)} KB`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        let color = 'default';
        let icon = null;
        let text = '未知';

        switch (status) {
          case 'UPLOADED':
            color = 'default';
            icon = <ClockCircleOutlined />;
            text = '已上传';
            break;
          case 'PROCESSING':
            color = 'processing';
            icon = <SyncOutlined spin />;
            text = '处理中';
            break;
          case 'PROCESSED':
            color = 'success';
            icon = <CheckCircleOutlined />;
            text = '已处理';
            break;
          case 'TRANSLATING':
            color = 'processing';
            icon = <SyncOutlined spin />;
            text = '翻译中';
            break;
          case 'TRANSLATED':
            color = 'warning';
            icon = <CheckCircleOutlined />;
            text = '已翻译';
            break;
          case 'REVIEWED':
            color = 'success';
            icon = <CheckCircleOutlined />;
            text = '已审校';
            break;
          case 'ERROR':
            color = 'error';
            text = '错误';
            break;
          default:
            break;
        }

        return <Tag icon={icon} color={color}>{text}</Tag>;
      },
    },
    {
      title: '上传时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date) => new Date(date).toLocaleString('zh-CN'),
    },
  ];

  // --- Add Logging Here ---
  console.log('[FileList] Received files prop:', files);
  console.log('[FileList] Type of files prop:', typeof files);
  console.log('[FileList] Is files an Array?:', Array.isArray(files));
  // --- End Logging ---

  // --- Defensively ensure we have an array --- 
  const filesArray = Array.isArray(files) ? files : [];
  console.log('[FileList] filesArray value before filter:', filesArray);
  // --- End Defensive Check ---

  // Filter files that are eligible for translation 
  // Use the guaranteed array variable
  const eligibleFiles = filesArray.filter(
    (file) => file && (file.status === 'PROCESSED' || file.status === 'UPLOADED') // Added check for file existence
  );

  // If no eligible files, show message
  if (eligibleFiles.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Empty 
          description={
            <span>
              没有可翻译的文件。请确保先上传并处理文件，然后再开始翻译。
            </span>
          } 
        />
        <div style={{ marginTop: 20 }}>
          <Button type="primary" onClick={() => window.history.back()}>
            返回项目
          </Button>
        </div>
      </div>
    );
  }

  const rowSelection = {
    selectedRowKeys: selectedFileIds,
    onChange: (selectedRowKeys: React.Key[]) => {
      onSelectFiles(selectedRowKeys as string[]);
    },
  };

  return (
    <div className="file-list-container">
      <Title level={4}>选择要翻译的文件</Title>
      <Text type="secondary" style={{ marginBottom: '16px', display: 'block' }}>
        选择下列已处理的文件进行翻译。您可以选择多个文件同时翻译。
      </Text>
      
      <Table 
        rowSelection={rowSelection}
        columns={columns} 
        dataSource={eligibleFiles}
        rowKey="id"
        pagination={false}
        bordered
      />
      
      <div style={{ marginTop: '16px', textAlign: 'right' }}>
        <Text type="secondary">
          已选择 {selectedFileIds.length} 个文件
        </Text>
      </div>
    </div>
  );
};

export default FileList; 
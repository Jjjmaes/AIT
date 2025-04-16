import React from 'react';
import { Table, Tag, Typography, Button, Empty } from 'antd';
import { CheckCircleOutlined, SyncOutlined, ClockCircleOutlined, WarningOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { FileType } from '../../api/fileService';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';

dayjs.locale('zh-cn');

const { Title, Text } = Typography;

interface FileListProps {
  files: FileType[];
  selectedFileIds: string[];
  onSelectFiles: (fileIds: string[]) => void;
}

const FileList: React.FC<FileListProps> = ({ files, selectedFileIds, onSelectFiles }) => {
  const columns: ColumnsType<FileType> = [
    {
      title: '文件名',
      dataIndex: 'fileName',
      key: 'fileName',
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          {record.originalName && record.originalName !== text && (
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                (原名: {record.originalName})
              </Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: '大小',
      dataIndex: 'fileSize',
      key: 'fileSize',
      width: 100,
      render: (size) => size != null ? `${(size / 1024).toFixed(2)} KB` : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: FileType['status']) => {
        let color = 'default';
        let icon = null;
        let text = '未知';

        switch (status) {
          case 'pending':
            color = 'cyan';
            icon = <ClockCircleOutlined />;
            text = '准备就绪';
            break;
          case 'processing':
          case 'extracted':
          case 'translating':
          case 'reviewing':
            color = 'processing';
            icon = <SyncOutlined spin />;
            text = status === 'processing' ? '处理中' : 
                   status === 'extracted' ? '提取完成' :
                   status === 'translating' ? '翻译中' : 
                   status === 'reviewing' ? '审校中' : 
                   '进行中';
            break;
          case 'translated':
          case 'review_completed':
            color = 'warning';
            icon = <CheckCircleOutlined />;
            text = '待确认/完成';
            break;
          case 'completed':
            color = 'success';
            icon = <CheckCircleOutlined />;
            text = '已完成';
            break;
          case 'error':
            color = 'error';
            icon = <WarningOutlined />;
            text = '错误';
            break;
          default:
            console.warn(`[FileList] Encountered unexpected file status: ${status}`);
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
      render: (date) => {
        const parsedDate = dayjs(date);
        return parsedDate.isValid() ? parsedDate.format('YYYY-MM-DD HH:mm:ss') : '-';
      },
    },
  ];

  // --- Add More Logging ---
  console.log('[FileList] Received files prop:', files);
  // --- End Logging ---

  // --- Defensively ensure we have an array --- 
  const filesArray = Array.isArray(files) ? files : [];
  console.log('[FileList] filesArray value before filter:', filesArray);
  // --- End Defensive Check ---

  // Log actual statuses received
  filesArray.forEach(file => {
    console.log(`[FileList] File ${file.fileName} status: '${file.status}'`);
  });

  // Filter files that are eligible for translation
  const eligibleFiles = filesArray.filter(
    (file) => file && (
      file.status === 'pending'
    )
  );

  console.log('[FileList] Eligible files after filter:', eligibleFiles);

  // If no eligible files, show message
  if (eligibleFiles.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Empty 
          description={
            <span>
              没有状态为"准备就绪"的文件可供翻译。请确保文件已成功上传和处理。
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
    getCheckboxProps: (record: FileType) => ({
      disabled: record.status !== 'pending',
      name: record.fileName,
    }),
  };

  return (
    <div className="file-list-container">
      <Title level={4}>选择要翻译的文件</Title>
      <Text type="secondary" style={{ marginBottom: '16px', display: 'block' }}>
        选择下列状态为"准备就绪"的文件进行翻译。您可以选择多个文件同时翻译。
      </Text>
      
      <Table 
        rowSelection={rowSelection}
        columns={columns} 
        dataSource={eligibleFiles}
        rowKey="_id"
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
import React, { useMemo } from 'react';
import { Table, Tag, Typography } from 'antd';
import { FileType } from '../types/file';
import dayjs from 'dayjs';

const { Text } = Typography;

export interface FileListProps {
  files: FileType[];
  selectedFileIds: string[];
  onSelectedFilesChange: (fileIds: string[]) => void;
  loading?: boolean;
}

const FileList: React.FC<FileListProps> = ({
  files,
  selectedFileIds,
  onSelectedFilesChange,
  loading = false
}) => {
  // Filter files for eligibility (you can adjust this based on your criteria)
  const eligibleFiles = useMemo(() => {
    return files.filter(file => file.status !== 'processing' && file.status !== 'error');
  }, [files]);

  const columns = [
    {
      title: 'File Name',
      dataIndex: 'originalName',
      key: 'originalName',
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'default';
        if (status === 'ready') color = 'green';
        if (status === 'processing') color = 'blue';
        if (status === 'error') color = 'red';
        
        return <Tag color={color}>{status.toUpperCase()}</Tag>;
      }
    },
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
      render: (size: number) => {
        // Convert bytes to KB or MB
        if (size < 1024) {
          return `${size} B`;
        } else if (size < 1024 * 1024) {
          return `${(size / 1024).toFixed(2)} KB`;
        } else {
          return `${(size / (1024 * 1024)).toFixed(2)} MB`;
        }
      }
    },
    {
      title: 'Uploaded',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm')
    }
  ];

  const rowSelection = {
    selectedRowKeys: selectedFileIds,
    onChange: (selectedRowKeys: React.Key[]) => {
      onSelectedFilesChange(selectedRowKeys as string[]);
    }
  };

  return (
    <Table
      rowSelection={rowSelection}
      columns={columns}
      dataSource={eligibleFiles.map(file => ({ ...file, key: file._id }))}
      pagination={{ pageSize: 5 }}
      loading={loading}
    />
  );
};

export default FileList; 
import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Button, Table, Tag, Space, Modal, message, Tooltip, Alert } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import api from '../api/api'; // Assuming API calls are handled here or via a service

const { Title } = Typography;
const { confirm } = Modal;

// Define type for Prompt Template (adjust based on actual API response)
interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  type: 'translation' | 'review';
  modelId: string; // Or display model name
  sourceLang?: string;
  targetLang?: string;
  domain?: string;
  isActive: boolean;
  createdAt: string;
}

const PromptTemplatesPage: React.FC = () => {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Fetch templates using useCallback
  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null); // Clear previous errors
    try {
      const response = await api.get('/prompts');
      // Improved API response handling
      if (response.status === 200 && response.data) {
        // Assuming API returns { success: boolean, templates: PromptTemplate[] } or just PromptTemplate[]
        setTemplates(response.data.templates || (Array.isArray(response.data) ? response.data : [])); 
      } else {
        throw new Error(response.data?.message || 'Failed to fetch prompt templates');
      }
    } catch (err: any) {
      console.error('Error fetching prompt templates:', err);
      setError(err.message || '加载提示词模板列表失败');
      message.error(err.message || '加载提示词模板列表失败');
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array means this function is created once

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]); // fetchTemplates is now stable

  // Delete handler
  const handleDelete = (id: string) => {
    confirm({
      title: '确认删除?',
      icon: <QuestionCircleOutlined style={{ color: 'red' }} />,
      content: '删除此提示词模板后将无法恢复，确认删除吗？',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          // Replace with actual API call
          const response = await api.delete(`/prompts/${id}`);
          if (response.data?.success || response.status === 200) {
            message.success('模板删除成功');
            fetchTemplates(); // Refresh list
          } else {
            throw new Error(response.data?.message || 'Failed to delete template');
          }
        } catch (error) {
          console.error('Error deleting template:', error);
          message.error('删除模板失败');
        }
      },
    });
  };
  
  // Duplicate handler (optional)
  const handleDuplicate = async (template: PromptTemplate) => {
    message.loading({ content: '正在复制模板...', key: 'duplicate' });
    try {
        // Create payload for new template based on the old one
        const { id, createdAt, ...duplicateData } = template;
        const newName = `${template.name} (复制)`;
        const payload = { ...duplicateData, name: newName };

        // Replace with actual API call
        const response = await api.post('/prompts', payload);
        if (response.status === 201 && response.data) {
            message.success({ content: `模板 '${newName}' 复制成功`, key: 'duplicate' });
            fetchTemplates(); // Refresh list
        } else {
            throw new Error(response.data?.message || 'Failed to duplicate template');
        }
    } catch (err: any) {
        console.error('Error duplicating template:', err);
        message.error({ content: err.message || '复制模板失败', key: 'duplicate' });
    }
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: PromptTemplate) => <Link to={`/prompts/${record.id}/edit`}>{text}</Link>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Tag color={type === 'translation' ? 'blue' : 'green'}>{type === 'translation' ? '翻译' : '审校'}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => <Tag color={isActive ? 'success' : 'default'}>{isActive ? '已启用' : '已禁用'}</Tag>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '语言对',
      key: 'lang',
      render: (_: any, record: PromptTemplate) => (
        <span>{record.sourceLang || '-'} → {record.targetLang || '-'}</span>
      ),
    },
     {
      title: '领域',
      dataIndex: 'domain',
      key: 'domain',
      render: (domain: string | undefined) => domain || '通用',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: PromptTemplate) => (
        <Space size="middle">
          <Tooltip title="编辑">
            <Button icon={<EditOutlined />} onClick={() => navigate(`/prompts/${record.id}/edit`)} />
          </Tooltip>
          <Tooltip title="复制">
            <Button icon={<CopyOutlined />} onClick={() => handleDuplicate(record)} />
          </Tooltip>
          <Tooltip title="删除">
            <Button icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <Title level={2}>提示词模板管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/prompts/create')}>
          创建新模板
        </Button>
      </div>
      {error && <Alert message="加载错误" description={error} type="error" showIcon style={{ marginBottom: 16 }} />}
      <Table 
        columns={columns} 
        dataSource={templates} 
        loading={loading} 
        rowKey="id" 
      />
    </div>
  );
};

export default PromptTemplatesPage; 
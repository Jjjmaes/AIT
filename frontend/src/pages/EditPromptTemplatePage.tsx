import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Breadcrumb, Spin, Alert, message } from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PromptForm, { PromptTemplate } from '../components/promptTemplate/PromptForm';
import api from '../api/api'; // Assuming API calls are handled here or via a service

const { Title } = Typography;

const EditPromptTemplatePage: React.FC = () => {
  const { promptId } = useParams<{ promptId: string }>();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<PromptTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch template data on mount using useCallback
  const fetchTemplate = useCallback(async () => {
    if (!promptId) {
      setError('模板ID缺失');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/prompts/${promptId}`);
      if ((response.data?.success || response.status === 200) && response.data) {
        setTemplate(response.data.template || response.data as PromptTemplate);
      } else {
        throw new Error(response.data?.message || '无法加载模板数据');
      }
    } catch (err: any) {
      console.error('Error fetching prompt template:', err);
      setError(err.message || '加载模板数据失败');
    } finally {
      setLoading(false);
    }
  }, [promptId]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  // Function to handle form submission (update logic)
  const handleUpdate = async (values: PromptTemplate) => {
    if (!promptId) return;
    setSubmitting(true);
    message.loading({ content: '正在更新模板...', key: 'updatePrompt' });
    try {
      const response = await api.put(`/prompts/${promptId}`, values);
      if ((response.data?.success || response.status === 200) && response.data) {
        message.success({ content: '模板更新成功!', key: 'updatePrompt' });
        navigate('/prompts'); // Navigate back to list on success
      } else {
        const errorMsg = response.data?.message || '更新模板失败';
        message.error({ content: errorMsg, key: 'updatePrompt' });
        throw new Error(errorMsg); // Throw for PromptForm to potentially catch
      }
    } catch (err: any) {
      console.error('Error updating prompt template:', err);
      const errorMsg = err.response?.data?.message || err.message || '更新模板时发生网络错误';
      message.error({ content: errorMsg, key: 'updatePrompt' });
      // Re-throw error so PromptForm can display message or handle it
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{textAlign: 'center', padding: '50px'}}><Spin size="large" /></div>;
  }

  if (error) {
    return <Alert message="Error Loading Template" description={error} type="error" showIcon />;
  }

  if (!template) {
    return <Alert message="Template Not Found" description="Could not find the requested template." type="warning" showIcon />;
  }

  return (
    <div>
      <Breadcrumb style={{ marginBottom: '16px' }}>
        <Breadcrumb.Item><Link to="/dashboard">仪表盘</Link></Breadcrumb.Item>
        <Breadcrumb.Item><Link to="/prompts">提示词模板</Link></Breadcrumb.Item>
        <Breadcrumb.Item>编辑模板 ({template.name})</Breadcrumb.Item>
      </Breadcrumb>
      <Title level={2} style={{ marginBottom: '24px' }}>编辑提示词模板</Title>
      <PromptForm 
        onSubmit={handleUpdate} 
        isEditing={true} 
        initialValues={template} 
        submitting={submitting}
      />
    </div>
  );
};

export default EditPromptTemplatePage; 
import React, { useState } from 'react';
import { Typography, Breadcrumb, message } from 'antd';
import { Link } from 'react-router-dom';
import PromptForm from '../components/promptTemplate/PromptForm';
import api from '../api/api'; // Assuming API calls are handled here or via a service

const { Title } = Typography;

const CreatePromptTemplatePage: React.FC = () => {
  const [submitting, setSubmitting] = useState(false);

  // Function to handle form submission (create logic)
  const handleCreate = async (values: any) => {
    setSubmitting(true);
    message.loading({ content: '正在创建模板...', key: 'createPrompt' });
    try {
      // Replace with actual API call using api client or a service function
      const response = await api.post('/prompts', values);
      // Check for success, including common success statuses like 201
      if ((response.data?.success || response.status === 201) && response.data) {
        message.success({ content: '模板创建成功!', key: 'createPrompt' });
        // Force a full page reload to ensure the list page fetches fresh data
        window.location.href = '/prompts';
      } else {
        // Handle API error messages if needed
        const errorMsg = response.data?.message || '创建模板失败';
        console.error('Failed to create prompt template:', errorMsg);
        message.error({ content: errorMsg, key: 'createPrompt' });
        // Don't throw error here, let the form handle its state
      }
    } catch (error: any) {
      console.error('Error creating prompt template:', error);
      const errorMsg = error.response?.data?.message || error.message || '创建模板时发生网络错误';
      message.error({ content: errorMsg, key: 'createPrompt' });
      // Re-throw error so PromptForm can potentially display a general error if needed
      // Consider if the form component needs this re-throw or handles errors internally
      // throw error;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Breadcrumb style={{ marginBottom: '16px' }}>
        <Breadcrumb.Item><Link to="/dashboard">仪表盘</Link></Breadcrumb.Item>
        <Breadcrumb.Item><Link to="/prompts">提示词模板</Link></Breadcrumb.Item>
        <Breadcrumb.Item>创建模板</Breadcrumb.Item>
      </Breadcrumb>
      <Title level={2} style={{ marginBottom: '24px' }}>创建新的提示词模板</Title>
      <PromptForm onSubmit={handleCreate} isEditing={false} submitting={submitting} />
    </div>
  );
};

export default CreatePromptTemplatePage; 
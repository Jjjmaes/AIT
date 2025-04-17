import React, { useEffect } from 'react';
import { Form, Select, Card, Typography, Switch, Radio, Space, Tooltip } from 'antd';
import { InfoCircleOutlined, ExperimentOutlined, BookOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// Placeholder types - replace with actual types from API services
interface TerminologyBase {
  id: string;
  name: string;
  // Add other relevant fields if needed
}

interface TranslationMemory {
  id: string;
  name: string;
  // Add other relevant fields if needed
}


interface TranslationSettingsProps {
  project: any; // Replace with proper type when available
  promptTemplates: any[]; // Replace with proper type when available
  reviewPromptTemplates: any[]; // <-- ADDED: List of review templates
  aiConfigs: any[]; // Replace with proper type when available
  terminologyBases: TerminologyBase[]; // <-- Add terminology bases
  translationMemories: TranslationMemory[]; // <-- Add translation memories
  settings: {
    promptTemplateId: string; // For translation
    reviewPromptTemplateId: string | null;
    aiModelId: string;
    useTerminology: boolean;
    terminologyBaseId?: string | null; // <-- Add selected terminology ID (optional)
    useTranslationMemory: boolean;
    translationMemoryId?: string | null; // <-- Add selected TM ID (optional)
  };
  onSettingsChange: (settings: any) => void;
}

const TranslationSettings: React.FC<TranslationSettingsProps> = ({
  project,
  promptTemplates,
  reviewPromptTemplates, // <-- ADDED: Receive prop
  aiConfigs,
  terminologyBases, // <-- Receive new prop
  translationMemories, // <-- Receive new prop
  settings,
  onSettingsChange,
}) => {
  const [form] = Form.useForm();

  // Initialize form with default/current values
  useEffect(() => {
    if (project) {
      const initialFormValues = {
        promptTemplateId: settings.promptTemplateId || project.defaultTranslationPromptTemplate || '',
        reviewPromptTemplateId: settings.reviewPromptTemplateId || project.defaultReviewPromptTemplate || '',
        aiModelId: settings.aiModelId || (aiConfigs?.[0]?.id || ''),
        useTerminology: settings.useTerminology || false,
        terminologyBaseId: settings.terminologyBaseId || null,
        useTranslationMemory: settings.useTranslationMemory || false,
        translationMemoryId: settings.translationMemoryId || null,
      };
      form.setFieldsValue(initialFormValues);
    }
  }, [project, aiConfigs, settings, form]);

  const handleValuesChange = (_changedValues: any, allValues: any) => {
    const updatedValues = { ...allValues };
    if (!allValues.useTerminology) {
      updatedValues.terminologyBaseId = null;
    }
    if (!allValues.useTranslationMemory) {
      updatedValues.translationMemoryId = null;
    }
    onSettingsChange(updatedValues);
  };

  // Prepare initialValues for the Form component itself
  const formInitialValues = {
    promptTemplateId: settings.promptTemplateId || project?.defaultTranslationPromptTemplate || '',
    reviewPromptTemplateId: settings.reviewPromptTemplateId || project?.defaultReviewPromptTemplate || '',
    aiModelId: settings.aiModelId || (aiConfigs?.[0]?.id || ''),
    useTerminology: settings.useTerminology || false,
    terminologyBaseId: settings.terminologyBaseId || null,
    useTranslationMemory: settings.useTranslationMemory || false,
    translationMemoryId: settings.translationMemoryId || null,
  };

  return (
    <div className="translation-settings">
      <Title level={4}>翻译设置</Title>
      <Paragraph>
        配置以下参数来控制AI翻译的行为和结果质量。选择适合您项目的提示词模板和AI模型。
      </Paragraph>

      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleValuesChange}
        initialValues={formInitialValues}
      >
        <Card title="基本设置" bordered={false} style={{ marginBottom: '24px' }}>
          {/* Translation Prompt Template */}
          <Form.Item
            label={
              <span>
                翻译提示词模板
                <Tooltip title="翻译提示词模板决定了AI如何理解和执行翻译任务">
                  <InfoCircleOutlined style={{ marginLeft: 8 }} />
                </Tooltip>
              </span>
            }
            name="promptTemplateId"
            rules={[{ required: true, message: '请选择翻译提示词模板' }]}
          >
            <Select placeholder="选择翻译提示词模板">
              {promptTemplates.map(template => (
                <Option key={template._id} value={template._id}>
                  {template.name}
                  {template._id === project?.defaultTranslationPromptTemplate && ' (项目默认)'}
                </Option>
              ))}
              {promptTemplates.length === 0 && <Option value="" disabled>无可用翻译模板</Option>}
            </Select>
          </Form.Item>

          {/* Review Prompt Template */}
          <Form.Item
            label={
              <span>
                审校提示词模板
                <Tooltip title="审校提示词模板用于AI辅助审校或生成审校建议">
                  <InfoCircleOutlined style={{ marginLeft: 8 }} />
                </Tooltip>
              </span>
            }
            name="reviewPromptTemplateId"
            rules={[{ required: true, message: '请选择审校提示词模板' }]}
          >
            <Select placeholder="选择审校提示词模板">
              {reviewPromptTemplates.map(template => (
                <Option key={template._id} value={template._id}>
                  {template.name}
                  {template._id === project?.defaultReviewPromptTemplate && ' (项目默认)'}
                </Option>
              ))}
              {reviewPromptTemplates.length === 0 && <Option value="" disabled>无可用审校模板</Option>}
            </Select>
          </Form.Item>

          {/* AI Engine */}
          <Form.Item
            label={
              <span>
                AI引擎
                <Tooltip title="不同的AI引擎有不同的能力和成本">
                  <InfoCircleOutlined style={{ marginLeft: 8 }} />
                </Tooltip>
              </span>
            }
            name="aiModelId"
            rules={[{ required: true, message: '请选择AI引擎' }]}
          >
            <Radio.Group>
              <Space direction="vertical">
                {aiConfigs?.map(config => (
                  <Radio key={config._id} value={config._id}>
                    <Space>
                      <ExperimentOutlined />
                      <span>{config.providerName}</span>
                      <Text type="secondary">{config.notes}</Text>
                    </Space>
                  </Radio>
                ))}
                {!aiConfigs || aiConfigs.length === 0 && <Text type="secondary">无可用AI引擎</Text>}
              </Space>
            </Radio.Group>
          </Form.Item>
        </Card>

        {/* Divider is outside the Cards for better spacing */}
        {/* <Divider style={{ margin: '24px 0' }} /> */}

        <Card title="高级选项" bordered={false}>
          {/* --- Terminology --- */}
          <Form.Item
            label={
              <span>
                使用术语库
                <Tooltip title="启用后，翻译将使用项目术语库确保术语一致性">
                  <InfoCircleOutlined style={{ marginLeft: 8 }} />
                </Tooltip>
              </span>
            }
            name="useTerminology"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          {/* Conditional Terminology Base Selection */}
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.useTerminology !== currentValues.useTerminology}
          >
            {({ getFieldValue }) =>
              getFieldValue('useTerminology') ? (
                <Form.Item
                  name="terminologyBaseId"
                  label="选择术语库"
                  rules={[{ required: true, message: '请选择要使用的术语库' }]}
                  style={{ marginLeft: '24px', marginBottom: '16px' }}
                >
                  <Select placeholder="选择术语库">
                    {terminologyBases?.map(tb => (
                      <Option key={tb.id} value={tb.id}>{tb.name}</Option>
                    ))}
                    {!terminologyBases || terminologyBases.length === 0 && (
                      <Option value="" disabled>无可用术语库</Option>
                    )}
                  </Select>
                </Form.Item>
              ) : null
            }
          </Form.Item>

          {/* --- Translation Memory --- */}
          <Form.Item
            label={
              <span>
                使用翻译记忆库
                <Tooltip title="启用后，翻译将查询记忆库提高一致性">
                  <BookOutlined style={{ marginLeft: 8 }} />
                </Tooltip>
              </span>
            }
            name="useTranslationMemory"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          {/* Conditional Translation Memory Selection */}
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.useTranslationMemory !== currentValues.useTranslationMemory}
          >
            {({ getFieldValue }) =>
              getFieldValue('useTranslationMemory') ? (
                <Form.Item
                  name="translationMemoryId"
                  label="选择翻译记忆库"
                  rules={[{ required: true, message: '请选择要使用的翻译记忆库' }]}
                  style={{ marginLeft: '24px', marginBottom: '16px' }}
                >
                  <Select placeholder="选择翻译记忆库">
                    {translationMemories?.map(tm => (
                      <Option key={tm.id} value={tm.id}>{tm.name}</Option>
                    ))}
                    {!translationMemories || translationMemories.length === 0 && (
                       <Option value="" disabled>没有可用的翻译记忆库</Option>
                    )}
                  </Select>
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </Card>
      </Form>
    </div>
  );
};

export default TranslationSettings; 
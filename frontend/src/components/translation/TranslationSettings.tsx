import React, { useEffect } from 'react';
import { Form, Select, Card, Typography, Switch, Radio, Space, Tooltip, Divider } from 'antd';
import { InfoCircleOutlined, ExperimentOutlined, BookOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface TranslationSettingsProps {
  project: any; // Replace with proper type when available
  promptTemplates: any[]; // Replace with proper type when available
  aiConfigs: any[]; // Replace with proper type when available
  settings: {
    promptTemplateId: string;
    aiModelId: string;
    useTerminology: boolean;
    useTranslationMemory: boolean;
  };
  onSettingsChange: (settings: any) => void;
}

const TranslationSettings: React.FC<TranslationSettingsProps> = ({
  project,
  promptTemplates,
  aiConfigs,
  settings,
  onSettingsChange,
}) => {
  const [form] = Form.useForm();

  // Initialize form with default values from project if available
  useEffect(() => {
    if (project) {
      form.setFieldsValue({
        promptTemplateId: project.defaultTranslationPromptTemplate || project.translationPromptTemplate || settings.promptTemplateId,
        aiModelId: settings.aiModelId || (aiConfigs[0]?.id || ''),
        useTerminology: settings.useTerminology,
        useTranslationMemory: settings.useTranslationMemory,
      });
      
      // Trigger onChange with initial values
      onSettingsChange({
        promptTemplateId: project.defaultTranslationPromptTemplate || project.translationPromptTemplate || settings.promptTemplateId,
        aiModelId: settings.aiModelId || (aiConfigs[0]?.id || ''),
        useTerminology: settings.useTerminology,
        useTranslationMemory: settings.useTranslationMemory,
      });
    }
  }, [project, aiConfigs, settings, form, onSettingsChange]);

  const handleValuesChange = (_changedValues: any, allValues: any) => {
    onSettingsChange(allValues);
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
        initialValues={settings}
      >
        <Card title="基本设置" bordered={false}>
          <Form.Item
            label={
              <span>
                提示词模板
                <Tooltip title="提示词模板决定了AI如何理解和执行翻译任务，不同的模板适用于不同类型的内容">
                  <InfoCircleOutlined style={{ marginLeft: 8 }} />
                </Tooltip>
              </span>
            }
            name="promptTemplateId"
            rules={[{ required: true, message: '请选择提示词模板' }]}
          >
            <Select placeholder="选择提示词模板">
              {promptTemplates.map(template => (
                <Option key={template.id} value={template.id}>
                  {template.name}
                  {template.id === project?.defaultTranslationPromptTemplate && ' (项目默认)'}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label={
              <span>
                AI引擎
                <Tooltip title="不同的AI引擎有不同的能力和成本，请根据您的需求选择合适的引擎">
                  <InfoCircleOutlined style={{ marginLeft: 8 }} />
                </Tooltip>
              </span>
            }
            name="aiModelId"
            rules={[{ required: true, message: '请选择AI引擎' }]}
          >
            <Radio.Group>
              <Space direction="vertical">
                {aiConfigs.map(config => (
                  <Radio key={config.id} value={config.id}>
                    <Space>
                      <ExperimentOutlined />
                      <span>{config.name}</span>
                      <Text type="secondary">{config.description}</Text>
                    </Space>
                  </Radio>
                ))}
              </Space>
            </Radio.Group>
          </Form.Item>
        </Card>

        <Divider style={{ margin: '24px 0' }} />

        <Card title="高级选项" bordered={false}>
          <Form.Item
            label={
              <span>
                使用术语库
                <Tooltip title="启用后，翻译将使用项目设置的术语库确保专业术语翻译一致">
                  <InfoCircleOutlined style={{ marginLeft: 8 }} />
                </Tooltip>
              </span>
            }
            name="useTerminology"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            label={
              <span>
                使用翻译记忆库
                <Tooltip title="启用后，翻译将查询已有的高质量翻译，提高一致性并减少重复工作">
                  <BookOutlined style={{ marginLeft: 8 }} />
                </Tooltip>
              </span>
            }
            name="useTranslationMemory"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Card>
      </Form>
    </div>
  );
};

export default TranslationSettings; 
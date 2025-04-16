import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Select,
  Switch,
  Button,
  Card,
  Space,
  Typography,
  Divider,
  Tag,
  message,
} from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { axiosInstance as api } from '../../api/base';

const { TextArea } = Input;
const { Title, Text } = Typography;
const { Option } = Select;

interface PromptTemplateFormProps {
  initialValues?: PromptTemplate;
  onSubmit: (values: PromptTemplate) => Promise<void>;
  isEditing?: boolean;
  submitting?: boolean;
}

export interface PromptTemplate {
  id?: string;
  name: string;
  description: string;
  type: 'translation' | 'review';
  content: string;
  outputFormat: string;
  variables: string[];
  modelIdentifier: string;
  isActive: boolean;
}

interface AIModel {
  id: string;
  name: string;
  provider: string;
}

const PromptForm: React.FC<PromptTemplateFormProps> = ({
  initialValues,
  onSubmit,
  isEditing = false,
  submitting = false,
}) => {
  const [form] = Form.useForm();
  const [models, setModels] = useState<AIModel[]>([]);
  const [showHelpText, setShowHelpText] = useState(false);
  const [detectedVariables, setDetectedVariables] = useState<string[]>([]);

  // 获取AI模型列表
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await api.get('/ai-configs/ai-models');
        // Correct access path: response.data contains { success: true, data: { models: [...] } }
        const modelsData = response?.data?.data?.models;
        if (modelsData && Array.isArray(modelsData)) {
          setModels(modelsData);
        } else {
          console.error('API response for AI models is missing or not an array:', response?.data);
          message.error('获取AI模型数据格式不正确');
          setModels([]); // Set to empty array to prevent render error
        }
      } catch (error) { // Catch network errors or non-2xx status codes
        console.error('获取AI模型失败', error);
        message.error('获取AI模型列表失败');
        setModels([]); // Also set to empty array on error
      }
    };

    fetchModels();

    // Cleanup function (optional but good practice)
    return () => {
      // Cancel any pending requests if needed
    };
  }, []);

  // 当编辑时，设置初始值
  useEffect(() => {
    if (initialValues && isEditing) {
      form.setFieldsValue(initialValues);
      
      // 检测变量
      if (initialValues.content) {
        detectVariables(initialValues.content);
      }
    }
  }, [initialValues, form, isEditing]);

  // 检测提示词中的变量
  const detectVariables = (content: string) => {
    const variableRegex = /\{\{([a-zA-Z0-9_]+)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = variableRegex.exec(content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    setDetectedVariables(variables);
    
    // 如果是新建表单，自动填充变量字段
    if (!isEditing) {
      form.setFieldValue('variables', variables);
    }
  };

  // 处理提交
  const handleSubmit = async (values: PromptTemplate) => {
    try {
      await onSubmit(values);
      if (!isEditing) {
        form.resetFields();
      }
    } catch (error) {
      console.error(`${isEditing ? '更新' : '创建'}提示词模板失败`, error);
    }
  };

  // 提示词示例
  const getHelpText = () => {
    const type = form.getFieldValue('type');
    
    if (type === 'translation') {
      return `示例提示词：
您是一位专业的翻译专家，精通{{sourceLang}}和{{targetLang}}。
请将以下{{sourceLang}}文本翻译成{{targetLang}}：

{{sourceText}}

要求：
1. 保持原文的意思和风格
2. 翻译要自然流畅
3. 专业术语使用规范译法
4. 保留原文格式`;
    } else {
      return `示例提示词：
您是一位专业的翻译质量审校专家，精通{{sourceLang}}和{{targetLang}}。
请审校以下翻译，指出任何问题并提供修改建议：

原文({{sourceLang}})：
{{sourceText}}

译文({{targetLang}})：
{{translatedText}}

请按以下格式回答：
1. 修改后的译文：(提供完整修改后的译文)
2. 问题列表：(列出发现的问题，每个问题包括：位置、类型、严重程度、描述)`;
    }
  };

  return (
    <Card>
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          isActive: true,
          type: 'translation',
          ...initialValues,
        }}
        onFinish={handleSubmit}
        requiredMark="optional"
      >
        <Title level={4}>{isEditing ? '编辑提示词模板' : '创建提示词模板'}</Title>
        <Divider />

        <Form.Item
          name="name"
          label="模板名称"
          rules={[{ required: true, message: '请输入模板名称' }]}
        >
          <Input placeholder="例如：技术文档翻译提示词" />
        </Form.Item>

        <Form.Item
          name="description"
          label="描述"
          rules={[{ required: true, message: '请输入模板描述' }]}
        >
          <TextArea 
            placeholder="简要描述此提示词模板的用途和适用场景" 
            rows={2} 
          />
        </Form.Item>

        <Space style={{ width: '100%' }} direction="vertical" size="large">
          <Space>
            <Form.Item
              name="type"
              label="模板类型"
              rules={[{ required: true }]}
              style={{ width: 200 }}
            >
              <Select onChange={() => setShowHelpText(false)}>
                <Option value="translation">翻译提示词</Option>
                <Option value="review">审校提示词</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="modelIdentifier"
              label="AI模型"
              rules={[{ required: true, message: '请选择AI模型' }]}
              style={{ width: 200 }}
            >
              <Select placeholder="选择AI模型">
                {models.map(model => (
                  <Option key={model.id} value={model.id}>
                    {model.name} ({model.provider})
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="isActive"
              label="状态"
              valuePropName="checked"
            >
              <Switch 
                checkedChildren="已启用" 
                unCheckedChildren="已禁用" 
              />
            </Form.Item>
          </Space>
        </Space>

        <Form.Item
          name="content"
          label={
            <Space>
              <span>提示词内容</span>
              <Button 
                type="link" 
                icon={<InfoCircleOutlined />} 
                onClick={() => setShowHelpText(!showHelpText)}
              >
                查看示例
              </Button>
            </Space>
          }
          rules={[{ required: true, message: '请输入提示词内容' }]}
          extra={
            <div>
              {detectedVariables.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <Text strong>检测到的变量：</Text>
                  <div style={{ marginTop: 4 }}>
                    {detectedVariables.map(variable => (
                      <Tag key={variable} color="blue">{`{{${variable}}}`}</Tag>
                    ))}
                  </div>
                </div>
              )}
            </div>
          }
        >
          <TextArea 
            rows={10} 
            placeholder="输入提示词内容，使用{{变量名}}表示变量"
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => detectVariables(e.target.value)}
          />
        </Form.Item>

        {showHelpText && (
          <Card size="small" style={{ marginBottom: 16, backgroundColor: '#f5f5f5' }}>
            <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{getHelpText()}</pre>
          </Card>
        )}

        <Form.Item
          name="outputFormat"
          label="输出格式"
          rules={[{ required: true, message: '请输入期望的输出格式' }]}
        >
          <TextArea 
            rows={4} 
            placeholder="描述AI应该返回的输出格式，如JSON格式或特定结构"
          />
        </Form.Item>

        <Form.Item
          name="variables"
          label="变量列表"
          tooltip="提示词中使用的变量，格式为{{变量名}}"
        >
          <Select mode="tags" placeholder="输入变量名后按Enter添加" />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={submitting}
              disabled={submitting}
            >
              {isEditing ? '更新模板' : '创建模板'}
            </Button>
            <Button onClick={() => form.resetFields()}>重置</Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default PromptForm; 
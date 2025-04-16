import React, { useState, useEffect } from 'react';
import { Typography, Table, Button, Input, Space, Form, Modal, Select, message, Tooltip, Upload, Popconfirm } from 'antd';
import { PlusOutlined, UploadOutlined, DeleteOutlined, SearchOutlined, EditOutlined, DownloadOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { axiosInstance as api } from '../api/base';

const { Title } = Typography;
const { Option } = Select;
const { Search } = Input;

interface TranslationMemory {
  id: string;
  name: string;
  sourceLanguage: string;
  targetLanguage: string;
  domain: string;
  entryCount: number;
  createdAt: string;
  lastUpdated: string;
}

const TranslationMemoryPage: React.FC = () => {
  const [memories, setMemories] = useState<TranslationMemory[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [currentMemory, setCurrentMemory] = useState<TranslationMemory | null>(null);
  const [form] = Form.useForm();

  // Fetch translation memories
  const fetchMemories = async () => {
    setLoading(true);
    try {
      // Replace with actual API call
      const response = await api.get('/v1/tm');
      if (response.data?.success || response.status === 200) {
        setMemories(response.data?.data?.memories || response.data?.data || []);
      } else {
        throw new Error(response.data?.message || 'Failed to fetch translation memories');
      }
    } catch (error) {
      console.error('Error fetching translation memories:', error);
      message.error('加载翻译记忆库失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, []);

  const handleOpenModal = (mode: 'create' | 'edit', memory?: TranslationMemory) => {
    setModalMode(mode);
    setCurrentMemory(memory || null);
    if (mode === 'edit' && memory) {
      form.setFieldsValue(memory);
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      if (modalMode === 'create') {
        // Replace with actual API call
        const response = await api.post('/v1/tm', values);
        if (response.data?.success || response.status === 201) {
          message.success('翻译记忆库创建成功');
        } else {
          throw new Error(response.data?.message || 'Failed to create translation memory');
        }
      } else if (modalMode === 'edit' && currentMemory) {
        // Replace with actual API call
        const response = await api.put(`/v1/tm/${currentMemory.id}`, values);
        if (response.data?.success || response.status === 200) {
          message.success('翻译记忆库更新成功');
        } else {
          throw new Error(response.data?.message || 'Failed to update translation memory');
        }
      }
      setModalVisible(false);
      fetchMemories();
    } catch (error) {
      console.error('Error saving translation memory:', error);
      message.error('保存翻译记忆库失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      // Replace with actual API call
      const response = await api.delete(`/v1/tm/${id}`);
      if (response.data?.success || response.status === 200) {
        message.success('翻译记忆库删除成功');
        fetchMemories();
      } else {
        throw new Error(response.data?.message || 'Failed to delete translation memory');
      }
    } catch (error) {
      console.error('Error deleting translation memory:', error);
      message.error('删除翻译记忆库失败');
    }
  };

  const uploadProps: UploadProps = {
    name: 'file',
    action: `${api.defaults.baseURL}/v1/tm/import`,
    headers: {
      authorization: `Bearer ${localStorage.getItem('token')}`,
    },
    onChange(info) {
      if (info.file.status === 'done') {
        message.success(`${info.file.name} 上传成功`);
        fetchMemories();
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} 上传失败`);
      }
    },
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '语言对',
      key: 'languages',
      render: (_: any, record: TranslationMemory) => (
        <span>{record.sourceLanguage} → {record.targetLanguage}</span>
      ),
    },
    {
      title: '领域',
      dataIndex: 'domain',
      key: 'domain',
    },
    {
      title: '条目数',
      dataIndex: 'entryCount',
      key: 'entryCount',
      sorter: (a: TranslationMemory, b: TranslationMemory) => a.entryCount - b.entryCount,
    },
    {
      title: '最后更新',
      dataIndex: 'lastUpdated',
      key: 'lastUpdated',
      render: (date: string) => new Date(date).toLocaleDateString(),
      sorter: (a: TranslationMemory, b: TranslationMemory) => 
        new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: TranslationMemory) => (
        <Space size="middle">
          <Tooltip title="编辑">
            <Button icon={<EditOutlined />} onClick={() => handleOpenModal('edit', record)} />
          </Tooltip>
          <Tooltip title="导出">
            <Button 
              icon={<DownloadOutlined />} 
              onClick={() => window.location.href = `${api.defaults.baseURL}/v1/tm/${record.id}/export`}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Popconfirm
              title="确认删除这个翻译记忆库?"
              onConfirm={() => handleDelete(record.id)}
              okText="确认"
              cancelText="取消"
            >
              <Button danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <Title level={2}>翻译记忆库</Title>
        <Space>
          <Upload {...uploadProps}>
            <Button icon={<UploadOutlined />}>导入</Button>
          </Upload>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal('create')}>
            创建记忆库
          </Button>
        </Space>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <Search
          placeholder="搜索翻译记忆库"
          allowClear
          enterButton={<SearchOutlined />}
          onSearch={(value) => console.log('Search value:', value)}
          style={{ maxWidth: '400px' }}
        />
      </div>

      <Table 
        columns={columns} 
        dataSource={memories} 
        loading={loading} 
        rowKey="id"
      />

      <Modal
        title={modalMode === 'create' ? '创建翻译记忆库' : '编辑翻译记忆库'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入翻译记忆库名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="sourceLanguage"
            label="源语言"
            rules={[{ required: true, message: '请选择源语言' }]}
          >
            <Select>
              <Option value="zh-CN">中文 (简体)</Option>
              <Option value="en-US">英语 (美国)</Option>
              <Option value="ja-JP">日语</Option>
              <Option value="ko-KR">韩语</Option>
              <Option value="fr-FR">法语</Option>
              <Option value="de-DE">德语</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="targetLanguage"
            label="目标语言"
            rules={[{ required: true, message: '请选择目标语言' }]}
          >
            <Select>
              <Option value="zh-CN">中文 (简体)</Option>
              <Option value="en-US">英语 (美国)</Option>
              <Option value="ja-JP">日语</Option>
              <Option value="ko-KR">韩语</Option>
              <Option value="fr-FR">法语</Option>
              <Option value="de-DE">德语</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="domain"
            label="领域"
          >
            <Select>
              <Option value="general">通用</Option>
              <Option value="technical">技术</Option>
              <Option value="legal">法律</Option>
              <Option value="medical">医疗</Option>
              <Option value="financial">金融</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button style={{ marginRight: 8 }} onClick={() => setModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TranslationMemoryPage; 
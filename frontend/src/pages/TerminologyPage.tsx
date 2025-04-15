import React, { useState, useEffect } from 'react';
import { Typography, Table, Button, Input, Space, Form, Modal, Select, message, Tooltip, Upload, Popconfirm, Tag, Tabs } from 'antd';
import { PlusOutlined, UploadOutlined, DeleteOutlined, SearchOutlined, EditOutlined, DownloadOutlined, FilterOutlined } from '@ant-design/icons';
import api from '../api/api';

const { Title, Text } = Typography;
const { Option } = Select;
const { Search } = Input;
const { TabPane } = Tabs;

interface TermBase {
  id: string;
  name: string;
  description: string;
  sourceLanguage: string;
  targetLanguages: string[];
  domain: string;
  termCount: number;
  createdAt: string;
  lastUpdated: string;
}

interface Term {
  id: string;
  source: string;
  target: string;
  definition?: string;
  domain?: string;
  partOfSpeech?: string;
  status: 'approved' | 'pending' | 'rejected';
  termBaseId: string;
  createdAt: string;
  lastUpdated: string;
}

const TerminologyPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('termBases');
  const [termBases, setTermBases] = useState<TermBase[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(false);
  const [termsLoading, setTermsLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [termModalVisible, setTermModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [currentTermBase, setCurrentTermBase] = useState<TermBase | null>(null);
  const [currentTerm, setCurrentTerm] = useState<Term | null>(null);
  const [selectedTermBase, setSelectedTermBase] = useState<string | null>(null);
  const [termForm] = Form.useForm();
  const [form] = Form.useForm();

  // Fetch term bases
  const fetchTermBases = async () => {
    setLoading(true);
    try {
      // Replace with actual API call
      const response = await api.get('/term-bases');
      if (response.data?.success || response.status === 200) {
        setTermBases(response.data.termBases || response.data || []);
      } else {
        throw new Error(response.data?.message || 'Failed to fetch term bases');
      }
    } catch (error) {
      console.error('Error fetching term bases:', error);
      message.error('加载术语库失败');
    } finally {
      setLoading(false);
    }
  };

  // Fetch terms for a specific term base
  const fetchTerms = async (termBaseId: string) => {
    setTermsLoading(true);
    try {
      // Replace with actual API call
      const response = await api.get(`/term-bases/${termBaseId}/terms`);
      if (response.data?.success || response.status === 200) {
        setTerms(response.data.terms || response.data || []);
      } else {
        throw new Error(response.data?.message || 'Failed to fetch terms');
      }
    } catch (error) {
      console.error('Error fetching terms:', error);
      message.error('加载术语失败');
    } finally {
      setTermsLoading(false);
    }
  };

  useEffect(() => {
    fetchTermBases();
  }, []);

  useEffect(() => {
    if (selectedTermBase) {
      fetchTerms(selectedTermBase);
    }
  }, [selectedTermBase]);

  const handleOpenModal = (mode: 'create' | 'edit', termBase?: TermBase) => {
    setModalMode(mode);
    setCurrentTermBase(termBase || null);
    if (mode === 'edit' && termBase) {
      form.setFieldsValue(termBase);
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const handleOpenTermModal = (mode: 'create' | 'edit', term?: Term) => {
    setModalMode(mode);
    setCurrentTerm(term || null);
    if (mode === 'edit' && term) {
      termForm.setFieldsValue(term);
    } else {
      termForm.resetFields();
      if (selectedTermBase) {
        termForm.setFieldsValue({ termBaseId: selectedTermBase });
      }
    }
    setTermModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      if (modalMode === 'create') {
        // Replace with actual API call
        const response = await api.post('/term-bases', values);
        if (response.data?.success || response.status === 201) {
          message.success('术语库创建成功');
        } else {
          throw new Error(response.data?.message || 'Failed to create term base');
        }
      } else if (modalMode === 'edit' && currentTermBase) {
        // Replace with actual API call
        const response = await api.put(`/term-bases/${currentTermBase.id}`, values);
        if (response.data?.success || response.status === 200) {
          message.success('术语库更新成功');
        } else {
          throw new Error(response.data?.message || 'Failed to update term base');
        }
      }
      setModalVisible(false);
      fetchTermBases();
    } catch (error) {
      console.error('Error saving term base:', error);
      message.error('保存术语库失败');
    }
  };

  const handleTermSubmit = async (values: any) => {
    try {
      if (modalMode === 'create') {
        // Replace with actual API call
        const response = await api.post('/terms', values);
        if (response.data?.success || response.status === 201) {
          message.success('术语创建成功');
        } else {
          throw new Error(response.data?.message || 'Failed to create term');
        }
      } else if (modalMode === 'edit' && currentTerm) {
        // Replace with actual API call
        const response = await api.put(`/terms/${currentTerm.id}`, values);
        if (response.data?.success || response.status === 200) {
          message.success('术语更新成功');
        } else {
          throw new Error(response.data?.message || 'Failed to update term');
        }
      }
      setTermModalVisible(false);
      if (selectedTermBase) {
        fetchTerms(selectedTermBase);
      }
    } catch (error) {
      console.error('Error saving term:', error);
      message.error('保存术语失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      // Replace with actual API call
      const response = await api.delete(`/term-bases/${id}`);
      if (response.data?.success || response.status === 200) {
        message.success('术语库删除成功');
        fetchTermBases();
        if (selectedTermBase === id) {
          setSelectedTermBase(null);
          setTerms([]);
        }
      } else {
        throw new Error(response.data?.message || 'Failed to delete term base');
      }
    } catch (error) {
      console.error('Error deleting term base:', error);
      message.error('删除术语库失败');
    }
  };

  const handleDeleteTerm = async (id: string) => {
    try {
      // Replace with actual API call
      const response = await api.delete(`/terms/${id}`);
      if (response.data?.success || response.status === 200) {
        message.success('术语删除成功');
        if (selectedTermBase) {
          fetchTerms(selectedTermBase);
        }
      } else {
        throw new Error(response.data?.message || 'Failed to delete term');
      }
    } catch (error) {
      console.error('Error deleting term:', error);
      message.error('删除术语失败');
    }
  };

  const termBaseColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: TermBase) => (
        <a onClick={() => {setSelectedTermBase(record.id); setActiveTab('terms');}}>
          {text}
        </a>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '源语言',
      dataIndex: 'sourceLanguage',
      key: 'sourceLanguage',
    },
    {
      title: '目标语言',
      dataIndex: 'targetLanguages',
      key: 'targetLanguages',
      render: (languages: string[]) => (
        <>
          {languages.map(lang => (
            <Tag key={lang}>{lang}</Tag>
          ))}
        </>
      ),
    },
    {
      title: '领域',
      dataIndex: 'domain',
      key: 'domain',
    },
    {
      title: '术语数量',
      dataIndex: 'termCount',
      key: 'termCount',
      sorter: (a: TermBase, b: TermBase) => a.termCount - b.termCount,
    },
    {
      title: '最后更新',
      dataIndex: 'lastUpdated',
      key: 'lastUpdated',
      render: (date: string) => new Date(date).toLocaleDateString(),
      sorter: (a: TermBase, b: TermBase) => 
        new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: TermBase) => (
        <Space size="middle">
          <Tooltip title="编辑">
            <Button icon={<EditOutlined />} onClick={() => handleOpenModal('edit', record)} />
          </Tooltip>
          <Tooltip title="导出">
            <Button 
              icon={<DownloadOutlined />} 
              onClick={() => window.location.href = `${api.defaults.baseURL}/term-bases/${record.id}/export`} 
            />
          </Tooltip>
          <Tooltip title="删除">
            <Popconfirm
              title="确认删除这个术语库?"
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

  const termColumns = [
    {
      title: '源术语',
      dataIndex: 'source',
      key: 'source',
    },
    {
      title: '目标术语',
      dataIndex: 'target',
      key: 'target',
    },
    {
      title: '定义',
      dataIndex: 'definition',
      key: 'definition',
      ellipsis: true,
    },
    {
      title: '领域',
      dataIndex: 'domain',
      key: 'domain',
    },
    {
      title: '词性',
      dataIndex: 'partOfSpeech',
      key: 'partOfSpeech',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusMap = {
          approved: { color: 'success', text: '已批准' },
          pending: { color: 'warning', text: '待审核' },
          rejected: { color: 'error', text: '已拒绝' },
        };
        const { color, text } = statusMap[status as keyof typeof statusMap] || { color: 'default', text: status };
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Term) => (
        <Space size="middle">
          <Tooltip title="编辑">
            <Button icon={<EditOutlined />} onClick={() => handleOpenTermModal('edit', record)} />
          </Tooltip>
          <Tooltip title="删除">
            <Popconfirm
              title="确认删除这个术语?"
              onConfirm={() => handleDeleteTerm(record.id)}
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

  const renderTermBases = () => (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <Title level={3}>术语库列表</Title>
        <Space>
          <Upload
            name="file"
            action={`${api.defaults.baseURL}/term-bases/import`}
            headers={{ authorization: `Bearer ${localStorage.getItem('token')}` }}
            onChange={info => {
              if (info.file.status === 'done') {
                message.success(`${info.file.name} 上传成功`);
                fetchTermBases();
              } else if (info.file.status === 'error') {
                message.error(`${info.file.name} 上传失败`);
              }
            }}
          >
            <Button icon={<UploadOutlined />}>导入术语库</Button>
          </Upload>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal('create')}>
            创建术语库
          </Button>
        </Space>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <Search
          placeholder="搜索术语库"
          allowClear
          enterButton={<SearchOutlined />}
          onSearch={(value) => console.log('Search value:', value)}
          style={{ maxWidth: '400px' }}
        />
      </div>

      <Table 
        columns={termBaseColumns} 
        dataSource={termBases} 
        loading={loading} 
        rowKey="id"
      />
    </>
  );

  const renderTerms = () => (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <Title level={3}>术语列表</Title>
          {selectedTermBase && termBases.find(tb => tb.id === selectedTermBase) && (
            <Text>术语库: {termBases.find(tb => tb.id === selectedTermBase)?.name}</Text>
          )}
        </div>
        <Space>
          {selectedTermBase ? (
            <>
              <Upload
                name="file"
                action={`${api.defaults.baseURL}/term-bases/${selectedTermBase}/import-terms`}
                headers={{ authorization: `Bearer ${localStorage.getItem('token')}` }}
                onChange={info => {
                  if (info.file.status === 'done') {
                    message.success(`${info.file.name} 上传成功`);
                    fetchTerms(selectedTermBase);
                  } else if (info.file.status === 'error') {
                    message.error(`${info.file.name} 上传失败`);
                  }
                }}
              >
                <Button icon={<UploadOutlined />}>导入术语</Button>
              </Upload>
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={() => handleOpenTermModal('create')}
              >
                添加术语
              </Button>
            </>
          ) : (
            <Button 
              type="primary" 
              disabled 
              icon={<PlusOutlined />} 
            >
              请先选择术语库
            </Button>
          )}
        </Space>
      </div>

      {!selectedTermBase ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Text>请从术语库标签页选择一个术语库</Text>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
            <Search
              placeholder="搜索术语"
              allowClear
              enterButton={<SearchOutlined />}
              onSearch={(value) => console.log('Search value:', value)}
              style={{ maxWidth: '400px' }}
            />
            <Button icon={<FilterOutlined />}>筛选</Button>
          </div>

          <Table 
            columns={termColumns} 
            dataSource={terms} 
            loading={termsLoading} 
            rowKey="id"
          />
        </>
      )}
    </>
  );

  return (
    <div>
      <Title level={2}>术语管理</Title>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="术语库" key="termBases">
          {renderTermBases()}
        </TabPane>
        <TabPane tab="术语" key="terms">
          {renderTerms()}
        </TabPane>
      </Tabs>

      {/* Term Base Modal */}
      <Modal
        title={modalMode === 'create' ? '创建术语库' : '编辑术语库'}
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
            rules={[{ required: true, message: '请输入术语库名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea rows={3} />
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
            name="targetLanguages"
            label="目标语言"
            rules={[{ required: true, message: '请选择至少一个目标语言' }]}
          >
            <Select mode="multiple">
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

      {/* Term Modal */}
      <Modal
        title={modalMode === 'create' ? '添加术语' : '编辑术语'}
        open={termModalVisible}
        onCancel={() => setTermModalVisible(false)}
        footer={null}
      >
        <Form
          form={termForm}
          layout="vertical"
          onFinish={handleTermSubmit}
        >
          <Form.Item
            name="termBaseId"
            label="术语库"
            hidden
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="source"
            label="源术语"
            rules={[{ required: true, message: '请输入源术语' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="target"
            label="目标术语"
            rules={[{ required: true, message: '请输入目标术语' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="definition"
            label="定义"
          >
            <Input.TextArea rows={2} />
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
          <Form.Item
            name="partOfSpeech"
            label="词性"
          >
            <Select>
              <Option value="noun">名词</Option>
              <Option value="verb">动词</Option>
              <Option value="adjective">形容词</Option>
              <Option value="adverb">副词</Option>
              <Option value="phrase">短语</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="status"
            label="状态"
            initialValue="pending"
          >
            <Select>
              <Option value="approved">已批准</Option>
              <Option value="pending">待审核</Option>
              <Option value="rejected">已拒绝</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button style={{ marginRight: 8 }} onClick={() => setTermModalVisible(false)}>
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

export default TerminologyPage; 
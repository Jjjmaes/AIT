import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Typography, Card, Steps, Button, Alert, Divider, message, Tooltip, Spin, Table, 
  Tag, Space, Row, Col, Badge, Input, Radio, Statistic
} from 'antd';
import { 
  CloudOutlined, TranslationOutlined, InfoCircleOutlined, ArrowRightOutlined, 
  LoadingOutlined, CheckCircleOutlined, ClockCircleOutlined, FileOutlined,
  SyncOutlined, WarningOutlined, SearchOutlined
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from "../context/AuthContext";

import { getProjectById, getProjects, Project } from '../api/projectService';
import { getFilesByProjectId, ProjectFile, startFileTranslation } from '../api/fileService';
import { getPromptTemplates, PromptTemplate } from '../api/promptTemplateService';
import { getAllAIConfigs, AIConfig } from '../api/aiConfigService';

import FileList from '../components/translation/FileList';
import TranslationSettings from '../components/translation/TranslationSettings';
import TranslationProgress from '../components/translation/TranslationProgress';

const { Title, Paragraph, Text } = Typography;
const { Step } = Steps;

const TranslationCenterPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // State for project list (used when no projectId)
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState<boolean>(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // State for translation steps (used when projectId exists)
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [translationSettings, setTranslationSettings] = useState({
    promptTemplateId: '',
    aiModelId: '',
    useTerminology: false,
    useTranslationMemory: false,
  });

  // Statistics for dashboard cards
  const [statistics, setStatistics] = useState({
    totalProjects: 0,
    activeTranslations: 0,
    completedToday: 0,
  });

  // useEffect to fetch projects list if no projectId is provided
  useEffect(() => {
    if (!projectId) {
      const fetchProjects = async () => {
        setProjectsLoading(true);
        setProjectsError(null);
        setProjects([]); // Clear previous projects
        try {
          // Call getProjects without signal
          const responseData = await getProjects({ limit: 100 });

          // --- Log the received data directly --- 
          console.log('[TranslationCenter] Received responseData:', responseData);
          // --- End Logging ---

          // Correctly check the nested data structure
          if (responseData && responseData.data && Array.isArray(responseData.data.projects)) { 
            setProjects(responseData.data.projects);
            
            // Update statistics
            setStatistics({
              totalProjects: responseData.data.projects.length,
              activeTranslations: responseData.data.projects.filter(p => p.status === 'active').length,
              completedToday: responseData.data.projects.filter(p => {
                const today = new Date().toDateString();
                return p.status === 'completed' && new Date(p.updatedAt || '').toDateString() === today;
              }).length,
            });
          } else {
             // Log the received data and set a specific error
             console.error('[TranslationCenter] Invalid project data structure check failed for data:', responseData);
             setProjectsError('错误：项目数据结构无效！请检查API响应。');
          }
        } catch (err: any) {
           // Log the caught error
           console.error('[TranslationCenter] API Error caught fetching projects:', err);
           setProjectsError(err?.message || '获取项目时发生未知错误');
        } finally {
            setProjectsLoading(false);
        }
      };

      fetchProjects();
    } else {
      // Clear project list state if projectId becomes available
      setProjects([]);
      setProjectsLoading(false);
      setProjectsError(null);
    }
  }, [projectId]); // Dependency array includes projectId

  // Fetch specific project data if projectId is present
  const { data: projectResponse, isLoading: projectLoading, error: projectError } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProjectById(projectId as string),
    enabled: !!projectId,
    select: (res) => res?.data?.project,
  });
  const project = projectResponse;

  // Fetch project files
  const { data: filesResponse, isLoading: filesLoading, error: filesFetchError } = useQuery({
    queryKey: ['projectFiles', projectId],
    queryFn: () => getFilesByProjectId(projectId as string),
    enabled: !!projectId,
    select: (res): ProjectFile[] => {
        console.log('[Select Function - Files] Received data:', res);
        if (res?.success && Array.isArray(res.data)) {
            console.log('[Select Function - Files] Structure res.data matched.');
            return res.data;
        } else {
            console.error('[Select Function - Files] Unexpected data structure for project files:', res);
            return [];
        }
    },
  });
  const files = filesResponse;

  // Fetch prompt templates (enabled only if projectId is present)
  const { data: promptTemplatesResponse, isLoading: promptsLoading } = useQuery({
    queryKey: ['promptTemplates', 'translation', projectId],
    queryFn: () => getPromptTemplates(),
    enabled: !!projectId,
    select: (res): PromptTemplate[] => {
      if (res?.success && Array.isArray(res.data)) {
        return res.data;
      }
      return [];
    }
  });
  const promptTemplates = promptTemplatesResponse;

  // Fetch AI models/configs (enabled only if projectId is present)
  const { data: aiConfigsResponse, isLoading: aiConfigsLoading } = useQuery({
    queryKey: ['aiConfigs', projectId],
    queryFn: () => getAllAIConfigs(),
    enabled: !!projectId,
    select: (res): AIConfig[] => {
      if (res?.success && Array.isArray(res.data)) {
        return res.data;
      }
      return [];
    }
  });
  const aiConfigs = aiConfigsResponse;

  // Handler to start the translation process
  const handleStartTranslation = async () => {
    if (!projectId || selectedFileIds.length === 0) {
      message.error('项目ID无效或未选择文件');
      return;
    }
    if (!translationSettings.aiModelId || !translationSettings.promptTemplateId) {
      message.warning('请选择AI引擎和提示词模板');
      return;
    }

    console.log('启动翻译，文件:', selectedFileIds, '设置:', translationSettings);
    message.loading({ content: '正在为所选文件启动翻译...', key: 'startTranslation' });

    const translationPromises = selectedFileIds.map(fileId =>
      startFileTranslation(projectId, fileId /* Add settings if API supports */)
        // We might need to adapt startFileTranslation or have another endpoint
        // that accepts settings like prompt/model ID. For now, calling as is.
        // TODO: Pass translationSettings (promptTemplateId, aiModelId, useTB, useTM)
        //       to the backend when starting translation, if the API supports it.
        //       The current startFileTranslation likely doesn't accept these.
    );

    const results = await Promise.allSettled(translationPromises);

    let successCount = 0;
    let failureCount = 0;
    results.forEach((result, index) => {
      const fileId = selectedFileIds[index];
      if (result.status === 'fulfilled' && result.value.success) {
        console.log(`文件 ${fileId} 翻译启动成功`);
        successCount++;
      } else {
        console.error(`文件 ${fileId} 翻译启动失败:`, result.status === 'rejected' ? result.reason : result.value?.message);
        failureCount++;
      }
    });

    if (successCount > 0) {
      message.success({ content: `${successCount}个文件的翻译已成功启动`, key: 'startTranslation', duration: 2 });
      // Invalidate queries to refetch file list and show updated status
      queryClient.invalidateQueries({ queryKey: ['projectFiles', projectId] });
      // Optionally move to the progress step, though progress is now per-file
      setCurrentStep(prev => Math.min(prev + 1, 2)); // Move to next step or stay at max
    } else {
      message.error({ content: '所有选定文件的翻译启动失败', key: 'startTranslation', duration: 2 });
    }
    if (failureCount > 0 && successCount > 0) {
       message.warning(`${failureCount}个文件的翻译启动失败`, 3);
    }

  };

  // Handle file selection
  const handleFileSelect = (fileIds: string[]) => {
    setSelectedFileIds(fileIds);
  };

  // Handle settings change
  const handleSettingsChange = (settings: any) => {
    setTranslationSettings(settings);
  };

  // Handle navigation for Steps UI
  const handleNext = () => {
    if (currentStep === 0 && selectedFileIds.length === 0) {
      message.warning('请选择至少一个文件继续');
      return;
    }
    if (currentStep === 1) {
      if (!translationSettings.aiModelId || !translationSettings.promptTemplateId) {
        message.warning('请选择AI模型和提示模板');
        return;
      }
    }
    setCurrentStep(prev => prev + 1);
  };

  const handlePrev = () => {
    setCurrentStep(prev => prev - 1);
  };

  // Status configuration for visual consistency
  const statusConfigs = {
    'active': { color: 'blue', icon: <SyncOutlined spin />, text: '进行中' },
    'pending': { color: 'orange', icon: <ClockCircleOutlined />, text: '待处理' },
    'completed': { color: 'green', icon: <CheckCircleOutlined />, text: '已完成' },
    'error': { color: 'red', icon: <WarningOutlined />, text: '错误' },
    'default': { color: 'default', icon: <InfoCircleOutlined />, text: '未知' }
  };

  // Filter projects based on search and active filter
  const filteredProjects = projects.filter(project => {
    const matchesSearch = !searchText || 
      project.name?.toLowerCase().includes(searchText.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchText.toLowerCase());
    
    const matchesFilter = !activeFilter || project.status === activeFilter;
    
    return matchesSearch && matchesFilter;
  });

  // === Conditional Rendering Logic ===

  // Case 1: No projectId - Show project selection
  if (!projectId) {
    if (projectsLoading) {
      return (
        <div className="loading-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
          <Spin size="large" tip="加载项目中..." />
        </div>
      );
    }

    if (projectsError) {
      return (
        <div className="error-container" style={{ padding: '2rem' }}>
          <Alert 
            type="error" 
            message="加载项目列表失败" 
            description={projectsError || '请刷新页面重试'} 
            showIcon
          />
        </div>
      );
    }

    // Status tag renderer
    const renderStatusTag = (status: string) => {
      const config = statusConfigs[status as keyof typeof statusConfigs] || statusConfigs.default;
      return (
        <Tag color={config.color} icon={config.icon}>
          {config.text}
        </Tag>
      );
    };
    
    // Project table columns
    const projectColumns = [
      { 
        title: '项目名称', 
        dataIndex: 'name', 
        key: 'name',
        render: (text: string, record: Project) => (
          <Space direction="vertical" size={0}>
            <Text strong>{text}</Text>
            {record.description && <Text type="secondary" style={{ fontSize: '12px' }}>{record.description}</Text>}
          </Space>
        )
      },
      { 
        title: '语言', 
        key: 'languages',
        render: (_: any, record: Project) => (
          <Space>
            <Tag color="blue">
              {record.languagePairs && record.languagePairs.length > 0 
                ? record.languagePairs[0].source 
                : 'N/A'}
            </Tag>
            <ArrowRightOutlined style={{ color: '#8c8c8c' }} />
            {record.languagePairs && record.languagePairs.length > 0 && (
              <Tag color="green">{record.languagePairs[0].target}</Tag>
            )}
          </Space>
        )
      },
      { 
        title: '优先级', 
        dataIndex: 'priority', 
        key: 'priority',
        render: (priority: string) => {
          const colorMap: Record<string, string> = {
            'low': 'green',
            'medium': 'orange',
            'high': 'red'
          };
          return <Tag color={colorMap[priority] || 'default'}>{priority}</Tag>;
        }
      },
      { 
        title: '状态', 
        dataIndex: 'status', 
        key: 'status',
        render: renderStatusTag
      },
      { 
        title: '创建时间', 
        dataIndex: 'createdAt', 
        key: 'createdAt', 
        render: (date: string) => (
          <Tooltip title={new Date(date).toLocaleString()}>
            {new Date(date).toLocaleDateString()}
          </Tooltip>
        )
      },
      {
        title: '操作',
        key: 'action',
        render: (_: any, record: Project) => (
          <Button 
            type="primary" 
            icon={<ArrowRightOutlined />}
            onClick={() => navigate(`/projects/${record._id}/translate`)}
          >
            选择并翻译
          </Button>
        ),
      },
    ];

    return (
      <div className="translation-center-dashboard">
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card className="welcome-card">
              <Row align="middle" gutter={24}>
                <Col xs={24} md={16}>
                  <Title level={2}>AI翻译中心</Title>
                  <Paragraph>
                    欢迎{user?.name ? `, ${user.name}` : ''}！在此处选择一个项目以进行翻译配置和提交。所有文件翻译必须通过翻译中心进行，以确保正确配置提示词模板、AI引擎和术语表资源。
                  </Paragraph>
                </Col>
                <Col xs={24} md={8} style={{ textAlign: 'center' }}>
                  <img 
                    src="/logo.png" 
                    alt="Translation Platform Logo" 
                    style={{ maxWidth: '100%', maxHeight: '80px', opacity: 0.8 }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
          <Col xs={24} md={8}>
            <Card hoverable>
              <Statistic 
                title="总项目数" 
                value={statistics.totalProjects} 
                prefix={<FileOutlined />} 
              />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card hoverable>
              <Statistic 
                title="活跃翻译" 
                value={statistics.activeTranslations} 
                prefix={<SyncOutlined spin={statistics.activeTranslations > 0} />} 
                valueStyle={{ color: statistics.activeTranslations > 0 ? '#1890ff' : 'inherit' }}
              />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card hoverable>
              <Statistic 
                title="今日完成" 
                value={statistics.completedToday} 
                prefix={<CheckCircleOutlined />} 
                valueStyle={{ color: statistics.completedToday > 0 ? '#52c41a' : 'inherit' }}
              />
            </Card>
          </Col>
        </Row>

        <Card style={{ marginTop: '16px' }}>
          <Title level={3}>项目列表</Title>
          
          <Row gutter={16} style={{ marginBottom: '16px' }}>
            <Col span={12}>
              <Input 
                placeholder="搜索项目..." 
                allowClear
                prefix={<SearchOutlined />}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </Col>
            <Col span={12}>
              <Radio.Group 
                value={activeFilter} 
                onChange={(e) => setActiveFilter(e.target.value)}
                buttonStyle="solid"
              >
                <Radio.Button value={null}>全部</Radio.Button>
                <Radio.Button value="active">进行中</Radio.Button>
                <Radio.Button value="pending">待处理</Radio.Button>
                <Radio.Button value="completed">已完成</Radio.Button>
              </Radio.Group>
            </Col>
          </Row>
          
          <Table 
            columns={projectColumns} 
            dataSource={filteredProjects}
            rowKey="_id" 
            pagination={{ pageSize: 10 }}
            rowClassName={(record) => record.status === 'active' ? 'active-row' : ''}
            loading={projectsLoading}
            locale={{ emptyText: '暂无项目数据' }}
          />
        </Card>
      </div>
    );
  }

  // Case 2: projectId exists - Show Translation Steps UI

  // Loading state for specific project data
  const isProjectDataLoading = projectLoading || filesLoading || promptsLoading || aiConfigsLoading;

  if (isProjectDataLoading) {
    return (
      <div className="loading-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Space direction="vertical" size="middle" style={{ textAlign: 'center' }}>
          <Spin size="large" />
          <Text>加载翻译数据中...</Text>
        </Space>
      </div>
    );
  }

  // Error state for specific project data
  const projectDataError = projectError || filesFetchError;
  if (projectDataError) {
    const errorMsg = (projectDataError as Error)?.message || "获取项目数据失败";
    return (
      <div className="error-container" style={{ padding: '2rem' }}>
        <Alert 
          type="error" 
          message="加载项目数据失败" 
          description={errorMsg}
          showIcon
          action={
            <Button type="primary" onClick={() => navigate(-1)}>
              返回
            </Button>
          }
        />
      </div>
    );
  }

  // Check if project data is available (should be if not loading/error)
  if (!project) {
    return (
      <div className="not-found-container" style={{ padding: '2rem' }}>
        <Alert 
          type="warning" 
          message="未找到项目" 
          description="无法加载翻译中心，请确保项目ID有效。" 
          showIcon
          action={
            <Button type="primary" onClick={() => navigate('/translate')}>
              返回翻译中心
            </Button>
          }
        />
      </div>
    );
  }

  // Step content
  const steps = [
    {
      title: '选择文件',
      icon: <CloudOutlined />,
      content: (
        <FileList 
          files={files || []} 
          onSelectFiles={handleFileSelect} 
          selectedFileIds={selectedFileIds}
        />
      ),
    },
    {
      title: '翻译设置',
      icon: <TranslationOutlined />,
      content: (
        <TranslationSettings 
          project={project} 
          promptTemplates={promptTemplates || []} 
          aiConfigs={aiConfigs || []}
          settings={translationSettings}
          onSettingsChange={handleSettingsChange}
        />
      ),
    },
    {
      title: '翻译进度',
      icon: <LoadingOutlined />,
      content: (
        <TranslationProgress
          // Pass placeholder props to satisfy types - needs refactoring
          jobId={null} 
          status={null} 
          isLoading={false}
          onViewReview={() => {console.warn('onViewReview not implemented for per-file progress yet')}}
        />
      ),
    },
  ];

  return (
    <div className="translation-center-page">
      <Card className="project-translation-card">
        <Row gutter={[0, 16]}>
          <Col span={24}>
            <Space align="center" style={{ marginBottom: '8px' }}>
              <Badge status="processing" />
              <Title level={2} style={{ margin: 0 }}>AI翻译中心</Title>
            </Space>
            
            <Row align="middle">
              <Col flex="auto">
                <Paragraph style={{ margin: 0 }}>
                  <Space>
                    <Text strong>项目：</Text>
                    <Text>{project?.name}</Text>
                    <Tooltip title={`项目ID: ${projectId} | ${project?.languagePairs?.[0]?.source || 'N/A'} → ${project?.languagePairs?.[0]?.target || 'N/A'}`}>
                      <InfoCircleOutlined style={{ color: '#1890ff' }} />
                    </Tooltip>
                  </Space>
                </Paragraph>
                <Paragraph style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#666' }}>
                  请完成以下步骤配置翻译资源，只有通过翻译中心配置并提交的翻译任务才能有效利用提示词模板和术语表。
                </Paragraph>
              </Col>
              <Col>
                <Button 
                  type="link" 
                  onClick={() => navigate(`/projects/${projectId}`)}
                  icon={<ArrowRightOutlined />}
                >
                  查看项目详情
                </Button>
              </Col>
            </Row>
          </Col>
          
          <Col span={24}>
            <Card 
              className="steps-card" 
              bordered={false} 
              bodyStyle={{ 
                padding: '24px',
                background: '#f5f5f5',
                borderRadius: '8px'
              }}
            >
              <Steps current={currentStep} className="translation-steps">
                {steps.map(step => (
                  <Step key={step.title} title={step.title} icon={step.icon} />
                ))}
              </Steps>
            </Card>
          </Col>
          
          <Col span={24}>
            <div className="steps-content" style={{ padding: '16px', minHeight: '300px' }}>
              {currentStep === 1 && (
                <Alert
                  message="必要配置提示"
                  description="请确保完成以下三项关键配置：1. 选择合适的提示词模板；2. 选择AI引擎；3. 启用术语库（如有需要）。只有完成这些配置才能提交有效的翻译任务。"
                  type="warning"
                  showIcon
                  style={{ marginBottom: '16px' }}
                />
              )}
              {steps[currentStep].content}
            </div>
          </Col>
          
          <Col span={24}>
            <Divider style={{ margin: '16px 0' }} />
            
            <div className="steps-action" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {currentStep > 0 && currentStep < 2 && (
                <Button onClick={handlePrev} style={{ marginRight: 8 }}>
                  上一步
                </Button>
              )}
              
              {currentStep === 0 && (
                <Button 
                  type="primary" 
                  onClick={handleNext} 
                  disabled={selectedFileIds.length === 0}
                >
                  下一步
                </Button>
              )}
              
              {currentStep === 1 && (
                <Button 
                  type="primary" 
                  onClick={handleStartTranslation}
                  disabled={!translationSettings.aiModelId || !translationSettings.promptTemplateId}
                >
                  启动翻译
                </Button>
              )}
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default TranslationCenterPage; 
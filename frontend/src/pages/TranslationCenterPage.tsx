import React, { useState, useEffect, useRef } from 'react';
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
import { useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { useAuth } from "../context/AuthContext";

import { getProjectById, getProjects, Project } from '../api/projectService';
import { getFilesByProjectId, FileType } from '../api/fileService';
import { startSingleFileAITranslation, StartSingleFileAIPayload } from '../api/aiTranslationService';
// Assuming PromptTemplate interface includes a 'type' field ('translation' | 'review')
import { getPromptTemplates, PromptTemplate } from '../api/promptTemplateService';
import { getAllAIConfigs, AIConfig } from '../api/aiConfigService';
import { getTerminologyBases, TerminologyBase } from '../api/terminologyService';
import { getTranslationMemories, TranslationMemory } from '../api/translationMemoryService';
import { getTranslationStatus, TranslationStatusResponse } from '../api/translation';
import { startAIReview } from '../api/reviewService';

import FileList from '../components/translation/FileList';
import TranslationSettings from '../components/translation/TranslationSettings';
import TranslationProgress from '../components/translation/TranslationProgress';

const { Title, Paragraph, Text } = Typography;
const { Step } = Steps;

// REMOVED local TypedPromptTemplate interface definition

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
    terminologyBaseId: null as string | null,
    useTranslationMemory: false,
    translationMemoryId: null as string | null,
    retranslateTM: false,
    reviewPromptTemplateId: null as string | null, // Ensure it allows null
  });

  // State for polling
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const [translationStatus, setTranslationStatus] = useState<TranslationStatusResponse | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const intervalRef = useRef<any | null>(null); // Ref to hold interval ID

  // Statistics for dashboard cards
  const [statistics, setStatistics] = useState({
    totalProjects: 0,
    activeTranslations: 0,
    completedToday: 0,
  });

  // Add loading state
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);

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
          // console.log('[TranslationCenter] Received responseData:', responseData);
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
  const { 
    data: filesResponse, 
    isLoading: filesLoading, 
    error: filesFetchError 
  }: UseQueryResult<FileType[], Error> = useQuery<FileType[]>({
    queryKey: ['projectFiles', projectId],
    queryFn: () => getFilesByProjectId(projectId as string),
    enabled: !!projectId,
  });
  const files = filesResponse;

  // Define expected response type from getPromptTemplates
  // Matching the structure suggested by previous linter errors
  interface ActualPromptTemplatesResponse {
    success: boolean;
    data?: { templates: PromptTemplate[] }; // data might contain a nested templates array
    message?: string;
  }

  // Fetch ALL Prompt Templates (assuming no API filter)
  const { data: allPromptTemplatesResponse, isLoading: promptsLoading } = useQuery<ActualPromptTemplatesResponse, Error, PromptTemplate[]>({ // Fetch raw response, select PromptTemplate[]
    queryKey: ['promptTemplates', projectId], // Simplified key based on project
    queryFn: () => getPromptTemplates(), // Call API function WITHOUT arguments
    enabled: !!projectId,
    select: (res) => { // select receives the ActualPromptTemplatesResponse
        // Access the nested templates array based on error details
        return (res?.success && Array.isArray(res.data?.templates)) ? res.data.templates : [];
    }
  });
  const allPromptTemplates = allPromptTemplatesResponse || [];

  // Filter templates client-side (assuming templates have a 'type' property)
  // TODO: Ensure PromptTemplate interface (in promptTemplateService.ts) has a 'type' field ('translation' | 'review')
  // Add safety check for t.type existence
  const translationPromptTemplates = allPromptTemplates.filter((t: PromptTemplate) => t.type && t.type === 'translation');
  const reviewPromptTemplates = allPromptTemplates.filter((t: PromptTemplate) => t.type && t.type === 'review');
  // Add isLoading state for review prompts based on the single query
  const reviewPromptsLoading = promptsLoading; // Use the same loading state


  // Fetch AI models/configs (enabled only if projectId is present)
  const { data: aiConfigsResponse, isLoading: aiConfigsLoading } = useQuery({
    queryKey: ['aiConfigs', projectId],
    queryFn: () => getAllAIConfigs(),
    enabled: !!projectId,
    select: (res): AIConfig[] => {
      // Correctly access the nested 'configs' array
      if (res?.success && Array.isArray(res.data?.configs)) { 
        return res.data.configs; 
      }
      // Log if structure is unexpected
      if(res) { // Log only if res is not undefined
        console.warn('[TranslationCenter] Unexpected AI config response structure:', res);
      } 
      return [];
    }
  });
  const aiConfigs = aiConfigsResponse;

  // Fetch Terminology Bases (enabled only if projectId is present)
  const { data: terminologyBasesResponse, isLoading: tbLoading } = useQuery<TerminologyBase[]>({
    queryKey: ['terminologyBases', projectId],
    queryFn: () => getTerminologyBases({ projectId: projectId as string }),
    enabled: !!projectId,
  });
  const terminologyBases = terminologyBasesResponse || [];

  // Fetch Translation Memories (enabled only if projectId is present)
  const { data: translationMemoriesResponse, isLoading: tmLoading } = useQuery<TranslationMemory[]>({
    queryKey: ['translationMemories', projectId],
    queryFn: () => getTranslationMemories({ projectId: projectId as string }),
    enabled: !!projectId,
  });
  const translationMemories = translationMemoriesResponse || [];

  // Handler to start the translation process
  const handleStartTranslation = async () => {
    if (!projectId || selectedFileIds.length === 0) {
      message.error('项目ID无效或未选择文件');
      return;
    }
    // Add validation checks here based on handleNext logic
    let isValid = true;
    if (!translationSettings.aiModelId) {
        message.warning('请选择AI引擎'); isValid = false;
    }
    if (!translationSettings.promptTemplateId) {
        message.warning('请选择翻译提示词模板'); isValid = false;
    }
    if (!translationSettings.reviewPromptTemplateId) { // Add validation for review template
        message.warning('请选择审校提示词模板'); isValid = false;
    }
    if (translationSettings.useTerminology && !translationSettings.terminologyBaseId) {
        message.warning('请选择要使用的术语库'); isValid = false;
    }
    if (translationSettings.useTranslationMemory && !translationSettings.translationMemoryId) {
        message.warning('请选择要使用的翻译记忆库'); isValid = false;
    }
    if (!isValid) return; // Stop if validation fails

    console.log('启动翻译，文件:', selectedFileIds, '设置:', translationSettings);
    message.loading({ content: '正在为所选文件启动翻译...', key: 'startTranslation' });
    // Reset polling state before starting
    setPollingJobId(null);
    setTranslationStatus(null);
    setIsPolling(false);

    // Get selected file details for better error messages
    const selectedFiles = files?.filter(f => selectedFileIds.includes(f._id)) || [];

    // --- TODO: Adapt backend API call ---
    // The backend endpoint needs to accept the translationSettings object
    // We are calling the existing startFileTranslation which likely doesn't accept settings yet
    // REMOVED unused startRequestPayload variable

    try {
        // Map selected files to API calls using the correct function and payload
        const promises = selectedFileIds.map(fileId => {
            // Construct the payload matching the updated StartSingleFileAIPayload
            const payload: StartSingleFileAIPayload = {
                // Assuming aiModelId from state maps to aiConfigId backend expects
                aiConfigId: translationSettings.aiModelId,
                promptTemplateId: translationSettings.promptTemplateId,
                // Keep other options nested if needed, or remove if not used
                options: {
                  tmId: translationSettings.useTranslationMemory ? translationSettings.translationMemoryId : null,
                  tbId: translationSettings.useTerminology ? translationSettings.terminologyBaseId : null,
                  // Add the retranslateTM flag from state
                  retranslateTM: translationSettings.retranslateTM 
                }
            };
            // Call the correct function that sends the payload
            return startSingleFileAITranslation(projectId!, fileId, payload);
        });
        // Use Promise.allSettled to handle individual failures
        const results = await Promise.allSettled(promises);

        let successCount = 0;
        let failureCount = 0;

        results.forEach((result, index) => {
            const file = selectedFiles[index];
            if (result.status === 'fulfilled' && result.value.success) {
                successCount++;
                console.log(`File ${file.originalName} translation started successfully. Job ID: ${result.value.data?.jobId || 'N/A'}`);
            } else {
                failureCount++;
                const errorMessage = (result.status === 'rejected')
                    ? result.reason?.message || '未知错误'
                    : result.value?.message || '启动失败';
                console.error(`File ${file.originalName} failed to start translation:`, errorMessage);
                // Optionally display individual file errors later
            }
        });

        message.destroy('startTranslation'); // Remove loading message

        if (successCount > 0) {
            message.success({
                content: `${successCount}个文件已成功提交翻译。失败 ${failureCount}个。`,
                key: 'translationResult', // Use a different key
                duration: 5
            });
            
            // --- FIX: Store the ACTUAL Job ID for polling ---            
            // Find the first successful result to get its jobId
            const firstSuccessfulResult = results.find(r => r.status === 'fulfilled' && r.value.success);
            // --- UPDATED: Access jobId inside the nested data object --- 
            const actualJobId = firstSuccessfulResult?.status === 'fulfilled' ? firstSuccessfulResult.value.data?.jobId : null;
            // ---------------------------------------------------------

            if (actualJobId) {
                 setPollingJobId(actualJobId); // <-- Set the correct jobId
                 setCurrentStep(2);
                 queryClient.invalidateQueries({ queryKey: ['projectFiles', projectId] });
            } else {
                 // Handle case where successCount > 0 but couldn't find a jobId (shouldn't happen ideally)
                 message.error({ content: `翻译已启动，但未能获取Job ID进行状态跟踪。`, key: 'translationResult', duration: 5 });
                 setPollingJobId(null);
            }

        } else {
            message.error({ content: `所有 ${failureCount}个文件启动翻译失败。请检查控制台获取详情。`, key: 'translationResult', duration: 5 });
            setPollingJobId(null); // Ensure no polling if all fail
        }

    } catch (error: any) {
        message.destroy('startTranslation');
        console.error('Error during translation start process:', error);
        message.error(error.message || '启动翻译过程中发生意外错误');
        setPollingJobId(null); // Ensure no polling on general error
    }
  };

  // Handle file selection
  const handleFileSelect = (fileIds: string[]) => {
    setSelectedFileIds(fileIds);
  };

  // Update handleSettingsChange to properly type settings
  const handleSettingsChange = (newSettings: typeof translationSettings) => {
    setTranslationSettings(prev => ({ ...prev, ...newSettings }));
  };

  const handleNext = () => {
    if (currentStep === 0 && selectedFileIds.length === 0) {
      message.warning('请选择至少一个文件继续');
      return;
    }
    // Validation for Step 1 (Settings)
    if (currentStep === 1) {
      let isValid = true;
      if (!translationSettings.aiModelId) {
        message.warning('请选择AI引擎');
        isValid = false;
      }
      if (!translationSettings.promptTemplateId) {
        message.warning('请选择翻译提示词模板');
        isValid = false;
      }
      // Only require review template if review step exists or is part of process
      // Assuming it's required for now based on previous context
      if (!translationSettings.reviewPromptTemplateId) {
        message.warning('请选择审校提示词模板');
        isValid = false;
      }
      if (translationSettings.useTerminology && !translationSettings.terminologyBaseId) {
        message.warning('请选择要使用的术语库');
        isValid = false;
      }
      if (translationSettings.useTranslationMemory && !translationSettings.translationMemoryId) {
        message.warning('请选择要使用的翻译记忆库');
        isValid = false;
      }
      if (!isValid) return; // Stop if validation fails
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

  // --- MOVE Polling useEffect Hook HERE (Before conditional returns) ---
  useEffect(() => {
    // Function to clear interval
    const clearPollingInterval = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        setIsPolling(false);
        console.log('Polling stopped.');
      }
    };

    // Reverted: Now we poll using the composite jobId received from the start call
    // const fileIdToPoll = selectedFileIds.length > 0 ? selectedFileIds[0] : null;

    // Only poll if we are on the progress step AND have a pollingJobId
    // if (currentStep === 2 && pollingJobId && fileIdToPoll) { <-- Reverted this condition
    if (currentStep === 2 && pollingJobId) {
      console.log(`Starting polling for jobId: ${pollingJobId}`); // Log the actual jobId
      setIsPolling(true);

      const pollStatus = async () => {
        console.log(`Polling status for jobId: ${pollingJobId}...`); // Use pollingJobId
        try {
          // Fetch the wrapper response { success: boolean, data: TranslationStatusResponse }
          // --- UPDATED: Pass pollingJobId to getTranslationStatus --- 
          const wrapperResponse = await getTranslationStatus(pollingJobId);
          console.log('[TranslationCenter Polling] Received wrapperResponse:', wrapperResponse);
          
          // --- Extract the actual status data --- 
          if (wrapperResponse && wrapperResponse.success && wrapperResponse.data) {
            const statusData: TranslationStatusResponse = wrapperResponse.data;
            console.log('[TranslationCenter Polling] Extracted statusData:', statusData);
            setTranslationStatus(statusData);

            // Stop polling if completed or failed (use extracted data)
            if (statusData.status === 'completed' || statusData.status === 'failed') {
              clearPollingInterval();
            }
          } else {
            // Handle cases where response format is unexpected
            console.error('[TranslationCenter Polling] Invalid status response format:', wrapperResponse);
            message.error('获取翻译状态失败：响应格式无效'); // Use Ant Design message instead
            clearPollingInterval(); // Stop polling on invalid format for now
          }
        } catch (err: any) {
          console.error('Error polling translation status:', err);
          message.error(err.message || '获取翻译状态时出错'); // Use Ant Design message
          clearPollingInterval(); // Stop polling on error for now
        }
      };

      // Initial poll immediately
      pollStatus();
      // Set interval for subsequent polls
      intervalRef.current = setInterval(pollStatus, 5000); // Poll every 5 seconds

      // Cleanup function for useEffect
      return () => {
        clearPollingInterval();
      };
    } else {
      // Clear interval if step changes or jobId becomes null
      clearPollingInterval();
      // Reset status if we navigate away from the progress step
      if (currentStep !== 2) {
          setTranslationStatus(null);
      }
    }
  // Reverted dependency array to only include currentStep and pollingJobId
  }, [currentStep, pollingJobId]); 
  // --- END MOVE Polling useEffect Hook ---

  // Handler to start the REVIEW process
  const handleSubmitReview = async () => {
    // Validation: Ensure we have necessary data
    if (!projectId) {
      message.error('错误：项目ID丢失。');
      return;
    }
    // For now, assume we review the first selected file (consistent with polling)
    const fileIdToReview = selectedFileIds.length > 0 ? selectedFileIds[0] : null;
    if (!fileIdToReview) {
      message.error('错误：未选择要审校的文件。');
      return;
    }
    if (!translationSettings.aiModelId) {
      message.error('错误：未配置AI引擎用于审校。');
      return;
    }
    if (!translationSettings.reviewPromptTemplateId) {
      message.error('错误：未选择审校提示词模板。');
      return;
    }

    setIsSubmittingReview(true);
    message.loading({ content: '正在提交AI自动审校任务...', key: 'submitReview' });

    try {
      const payload = {
        aiConfigId: translationSettings.aiModelId, // Use the same AI model for now?
        reviewPromptTemplateId: translationSettings.reviewPromptTemplateId,
      };

      const response = await startAIReview(projectId, fileIdToReview, payload);

      if (response.success) {
        // Wrap message call in setTimeout to ensure finally block executes
        setTimeout(() => {
          message.success({ content: response.message || 'AI审校已成功启动！', key: 'submitReview', duration: 3 });
        }, 0);
        // TODO: What happens next? 
        // - Start polling review status using response.reviewJobId?
        // - Update local state to show "Reviewing"?
        // - Navigate to a different step/page?
        // For now, we just show the success message.
      } else {
        throw new Error(response.message || '启动AI审校失败。');
      }
    } catch (error: any) {
      message.error({ content: `提交审校失败: ${error.message}`, key: 'submitReview', duration: 3 });
    } finally {
      setIsSubmittingReview(false);
    }
  };

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

  // Loading state for specific project data (includes new queries)
  const isProjectDataLoading = projectLoading || filesLoading || promptsLoading || reviewPromptsLoading || aiConfigsLoading || tbLoading || tmLoading;

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
  const projectDataError = projectError || filesFetchError; // TODO: Add errors from other queries?
  if (projectDataError) {
    const errorMsg = (projectDataError instanceof Error) ? projectDataError.message : "获取项目数据失败"; // Added type check
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
          promptTemplates={translationPromptTemplates}
          reviewPromptTemplates={reviewPromptTemplates}
          aiConfigs={aiConfigs || []} 
          terminologyBases={terminologyBases}
          translationMemories={translationMemories}
          settings={translationSettings}
          onSettingsChange={handleSettingsChange}
        />
      ),
    },
    {
      icon: isPolling ? <SyncOutlined spin /> : (translationStatus?.status === 'completed' ? <CheckCircleOutlined /> : <LoadingOutlined />),
      content: (
        <TranslationProgress
          jobId={pollingJobId}
          status={translationStatus} 
          isLoading={isPolling && !translationStatus} 
          onViewReview={(fileId) => {
              console.log(`Navigating to review for file: ${fileId}`);
              message.info(`审阅功能待实现 (文件 ID: ${fileId})`);
          }}
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
              {steps[currentStep].content}
            </div>
          </Col>

          <Col span={24}>
            <Divider style={{ margin: '16px 0' }} />

            <div className="steps-action" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {currentStep === 1 && (
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
                  disabled={
                    !translationSettings.aiModelId ||
                    !translationSettings.promptTemplateId ||
                    !translationSettings.reviewPromptTemplateId ||
                    (translationSettings.useTerminology && !translationSettings.terminologyBaseId) ||
                    (translationSettings.useTranslationMemory && !translationSettings.translationMemoryId)
                  }
                >
                  提交翻译
                </Button>
              )}

              {currentStep === 2 && (
                <>
                  {translationStatus?.status === 'failed' && (
                    <Button 
                      danger 
                      onClick={() => message.info('重新翻译失败片段功能待实现')}
                    >
                      重新翻译失败片段
                    </Button>
                  )}
                  {translationStatus?.status === 'completed' && (
                    <Button 
                      type="primary" 
                      onClick={handleSubmitReview}
                      loading={isSubmittingReview}
                    >
                      提交审校
                    </Button>
                  )}
                </>
              )}
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default TranslationCenterPage;
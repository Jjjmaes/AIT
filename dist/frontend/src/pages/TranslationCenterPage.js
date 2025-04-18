"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_router_dom_1 = require("react-router-dom");
const antd_1 = require("antd");
const icons_1 = require("@ant-design/icons");
const react_query_1 = require("@tanstack/react-query");
const AuthContext_1 = require("../context/AuthContext");
const projectService_1 = require("../api/projectService");
const fileService_1 = require("../api/fileService");
const aiTranslationService_1 = require("../api/aiTranslationService");
// Assuming PromptTemplate interface includes a 'type' field ('translation' | 'review')
const promptTemplateService_1 = require("../api/promptTemplateService");
const aiConfigService_1 = require("../api/aiConfigService");
const terminologyService_1 = require("../api/terminologyService");
const translationMemoryService_1 = require("../api/translationMemoryService");
const translation_1 = require("../api/translation");
const FileList_1 = __importDefault(require("../components/translation/FileList"));
const TranslationSettings_1 = __importDefault(require("../components/translation/TranslationSettings"));
const TranslationProgress_1 = __importDefault(require("../components/translation/TranslationProgress"));
const { Title, Paragraph, Text } = antd_1.Typography;
const { Step } = antd_1.Steps;
// REMOVED local TypedPromptTemplate interface definition
const TranslationCenterPage = () => {
    const { projectId } = (0, react_router_dom_1.useParams)();
    const navigate = (0, react_router_dom_1.useNavigate)();
    const queryClient = (0, react_query_1.useQueryClient)();
    const { user } = (0, AuthContext_1.useAuth)();
    // State for project list (used when no projectId)
    const [projects, setProjects] = (0, react_1.useState)([]);
    const [projectsLoading, setProjectsLoading] = (0, react_1.useState)(false);
    const [projectsError, setProjectsError] = (0, react_1.useState)(null);
    const [searchText, setSearchText] = (0, react_1.useState)('');
    const [activeFilter, setActiveFilter] = (0, react_1.useState)(null);
    // State for translation steps (used when projectId exists)
    const [currentStep, setCurrentStep] = (0, react_1.useState)(0);
    const [selectedFileIds, setSelectedFileIds] = (0, react_1.useState)([]);
    const [translationSettings, setTranslationSettings] = (0, react_1.useState)({
        promptTemplateId: '',
        aiModelId: '',
        useTerminology: false,
        terminologyBaseId: null,
        useTranslationMemory: false,
        translationMemoryId: null,
        retranslateTM: false,
        reviewPromptTemplateId: null, // Ensure it allows null
    });
    // State for polling
    const [pollingJobId, setPollingJobId] = (0, react_1.useState)(null);
    const [translationStatus, setTranslationStatus] = (0, react_1.useState)(null);
    const [isPolling, setIsPolling] = (0, react_1.useState)(false);
    const [pollingError, setPollingError] = (0, react_1.useState)(null);
    const intervalRef = (0, react_1.useRef)(null); // Ref to hold interval ID
    // Statistics for dashboard cards
    const [statistics, setStatistics] = (0, react_1.useState)({
        totalProjects: 0,
        activeTranslations: 0,
        completedToday: 0,
    });
    // useEffect to fetch projects list if no projectId is provided
    (0, react_1.useEffect)(() => {
        if (!projectId) {
            const fetchProjects = async () => {
                setProjectsLoading(true);
                setProjectsError(null);
                setProjects([]); // Clear previous projects
                try {
                    // Call getProjects without signal
                    const responseData = await (0, projectService_1.getProjects)({ limit: 100 });
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
                    }
                    else {
                        // Log the received data and set a specific error
                        console.error('[TranslationCenter] Invalid project data structure check failed for data:', responseData);
                        setProjectsError('错误：项目数据结构无效！请检查API响应。');
                    }
                }
                catch (err) {
                    // Log the caught error
                    console.error('[TranslationCenter] API Error caught fetching projects:', err);
                    setProjectsError(err?.message || '获取项目时发生未知错误');
                }
                finally {
                    setProjectsLoading(false);
                }
            };
            fetchProjects();
        }
        else {
            // Clear project list state if projectId becomes available
            setProjects([]);
            setProjectsLoading(false);
            setProjectsError(null);
        }
    }, [projectId]); // Dependency array includes projectId
    // Fetch specific project data if projectId is present
    const { data: projectResponse, isLoading: projectLoading, error: projectError } = (0, react_query_1.useQuery)({
        queryKey: ['project', projectId],
        queryFn: () => (0, projectService_1.getProjectById)(projectId),
        enabled: !!projectId,
        select: (res) => res?.data?.project,
    });
    const project = projectResponse;
    // Fetch project files
    const { data: filesResponse, isLoading: filesLoading, error: filesFetchError } = (0, react_query_1.useQuery)({
        queryKey: ['projectFiles', projectId],
        queryFn: () => (0, fileService_1.getFilesByProjectId)(projectId),
        enabled: !!projectId,
    });
    const files = filesResponse;
    // Fetch ALL Prompt Templates (assuming no API filter)
    const { data: allPromptTemplatesResponse, isLoading: promptsLoading } = (0, react_query_1.useQuery)({
        queryKey: ['promptTemplates', projectId], // Simplified key based on project
        queryFn: () => (0, promptTemplateService_1.getPromptTemplates)(), // Call API function WITHOUT arguments
        enabled: !!projectId,
        select: (res) => {
            // Access the nested templates array based on error details
            return (res?.success && Array.isArray(res.data?.templates)) ? res.data.templates : [];
        }
    });
    const allPromptTemplates = allPromptTemplatesResponse || [];
    // Filter templates client-side (assuming templates have a 'type' property)
    // TODO: Ensure PromptTemplate interface (in promptTemplateService.ts) has a 'type' field ('translation' | 'review')
    // Add safety check for t.type existence
    const translationPromptTemplates = allPromptTemplates.filter((t) => t.type && t.type === 'translation');
    const reviewPromptTemplates = allPromptTemplates.filter((t) => t.type && t.type === 'review');
    // Add isLoading state for review prompts based on the single query
    const reviewPromptsLoading = promptsLoading; // Use the same loading state
    // Fetch AI models/configs (enabled only if projectId is present)
    const { data: aiConfigsResponse, isLoading: aiConfigsLoading } = (0, react_query_1.useQuery)({
        queryKey: ['aiConfigs', projectId],
        queryFn: () => (0, aiConfigService_1.getAllAIConfigs)(),
        enabled: !!projectId,
        select: (res) => {
            // Correctly access the nested 'configs' array
            if (res?.success && Array.isArray(res.data?.configs)) {
                return res.data.configs;
            }
            // Log if structure is unexpected
            if (res) { // Log only if res is not undefined
                console.warn('[TranslationCenter] Unexpected AI config response structure:', res);
            }
            return [];
        }
    });
    const aiConfigs = aiConfigsResponse;
    // Fetch Terminology Bases (enabled only if projectId is present)
    const { data: terminologyBasesResponse, isLoading: tbLoading } = (0, react_query_1.useQuery)({
        queryKey: ['terminologyBases', projectId],
        queryFn: () => (0, terminologyService_1.getTerminologyBases)({ projectId: projectId }),
        enabled: !!projectId,
    });
    const terminologyBases = terminologyBasesResponse || [];
    // Fetch Translation Memories (enabled only if projectId is present)
    const { data: translationMemoriesResponse, isLoading: tmLoading } = (0, react_query_1.useQuery)({
        queryKey: ['translationMemories', projectId],
        queryFn: () => (0, translationMemoryService_1.getTranslationMemories)({ projectId: projectId }),
        enabled: !!projectId,
    });
    const translationMemories = translationMemoriesResponse || [];
    // Handler to start the translation process
    const handleStartTranslation = async () => {
        if (!projectId || selectedFileIds.length === 0) {
            antd_1.message.error('项目ID无效或未选择文件');
            return;
        }
        // Add validation checks here based on handleNext logic
        let isValid = true;
        if (!translationSettings.aiModelId) {
            antd_1.message.warning('请选择AI引擎');
            isValid = false;
        }
        if (!translationSettings.promptTemplateId) {
            antd_1.message.warning('请选择翻译提示词模板');
            isValid = false;
        }
        if (!translationSettings.reviewPromptTemplateId) { // Add validation for review template
            antd_1.message.warning('请选择审校提示词模板');
            isValid = false;
        }
        if (translationSettings.useTerminology && !translationSettings.terminologyBaseId) {
            antd_1.message.warning('请选择要使用的术语库');
            isValid = false;
        }
        if (translationSettings.useTranslationMemory && !translationSettings.translationMemoryId) {
            antd_1.message.warning('请选择要使用的翻译记忆库');
            isValid = false;
        }
        if (!isValid)
            return; // Stop if validation fails
        console.log('启动翻译，文件:', selectedFileIds, '设置:', translationSettings);
        antd_1.message.loading({ content: '正在为所选文件启动翻译...', key: 'startTranslation' });
        // Reset polling state before starting
        setPollingJobId(null);
        setTranslationStatus(null);
        setIsPolling(false);
        setPollingError(null);
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
                const payload = {
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
                return (0, aiTranslationService_1.startSingleFileAITranslation)(projectId, fileId, payload);
            });
            // Use Promise.allSettled to handle individual failures
            const results = await Promise.allSettled(promises);
            let successCount = 0;
            let failureCount = 0;
            results.forEach((result, index) => {
                const file = selectedFiles[index];
                if (result.status === 'fulfilled' && result.value.success) {
                    successCount++;
                    console.log(`File ${file.originalName} translation started successfully. Job ID: ${result.value.jobId || 'N/A'}`);
                }
                else {
                    failureCount++;
                    const errorMessage = (result.status === 'rejected')
                        ? result.reason?.message || '未知错误'
                        : result.value?.message || '启动失败';
                    console.error(`File ${file.originalName} failed to start translation:`, errorMessage);
                    // Optionally display individual file errors later
                }
            });
            antd_1.message.destroy('startTranslation'); // Remove loading message
            if (successCount > 0) {
                antd_1.message.success({
                    content: `${successCount}个文件已成功提交翻译。失败 ${failureCount}个。`,
                    key: 'translationResult', // Use a different key
                    duration: 5
                });
                // Set the polling job ID to the ID of the FIRST selected file
                const firstFileId = selectedFileIds.length > 0 ? selectedFileIds[0] : null;
                setPollingJobId(firstFileId);
                setCurrentStep(2);
                // Optionally refetch project files data to show updated status (like 'processing')
                queryClient.invalidateQueries({ queryKey: ['projectFiles', projectId] });
            }
            else {
                antd_1.message.error({ content: `所有 ${failureCount}个文件启动翻译失败。请检查控制台获取详情。`, key: 'translationResult', duration: 5 });
                setPollingJobId(null); // Ensure no polling if all fail
            }
        }
        catch (error) {
            antd_1.message.destroy('startTranslation');
            console.error('Error during translation start process:', error);
            antd_1.message.error(error.message || '启动翻译过程中发生意外错误');
            setPollingJobId(null); // Ensure no polling on general error
        }
    };
    // Handle file selection
    const handleFileSelect = (fileIds) => {
        setSelectedFileIds(fileIds);
    };
    // Update handleSettingsChange to properly type settings
    const handleSettingsChange = (newSettings) => {
        setTranslationSettings(prev => ({ ...prev, ...newSettings }));
    };
    const handleNext = () => {
        if (currentStep === 0 && selectedFileIds.length === 0) {
            antd_1.message.warning('请选择至少一个文件继续');
            return;
        }
        // Validation for Step 1 (Settings)
        if (currentStep === 1) {
            let isValid = true;
            if (!translationSettings.aiModelId) {
                antd_1.message.warning('请选择AI引擎');
                isValid = false;
            }
            if (!translationSettings.promptTemplateId) {
                antd_1.message.warning('请选择翻译提示词模板');
                isValid = false;
            }
            // Only require review template if review step exists or is part of process
            // Assuming it's required for now based on previous context
            if (!translationSettings.reviewPromptTemplateId) {
                antd_1.message.warning('请选择审校提示词模板');
                isValid = false;
            }
            if (translationSettings.useTerminology && !translationSettings.terminologyBaseId) {
                antd_1.message.warning('请选择要使用的术语库');
                isValid = false;
            }
            if (translationSettings.useTranslationMemory && !translationSettings.translationMemoryId) {
                antd_1.message.warning('请选择要使用的翻译记忆库');
                isValid = false;
            }
            if (!isValid)
                return; // Stop if validation fails
        }
        setCurrentStep(prev => prev + 1);
    };
    const handlePrev = () => {
        setCurrentStep(prev => prev - 1);
    };
    // Status configuration for visual consistency
    const statusConfigs = {
        'active': { color: 'blue', icon: (0, jsx_runtime_1.jsx)(icons_1.SyncOutlined, { spin: true }), text: '进行中' },
        'pending': { color: 'orange', icon: (0, jsx_runtime_1.jsx)(icons_1.ClockCircleOutlined, {}), text: '待处理' },
        'completed': { color: 'green', icon: (0, jsx_runtime_1.jsx)(icons_1.CheckCircleOutlined, {}), text: '已完成' },
        'error': { color: 'red', icon: (0, jsx_runtime_1.jsx)(icons_1.WarningOutlined, {}), text: '错误' },
        'default': { color: 'default', icon: (0, jsx_runtime_1.jsx)(icons_1.InfoCircleOutlined, {}), text: '未知' }
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
    (0, react_1.useEffect)(() => {
        // Function to clear interval
        const clearPollingInterval = () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
                setIsPolling(false);
                console.log('Polling stopped.');
            }
        };
        // Only poll if we are on the progress step AND have a job ID
        if (currentStep === 2 && pollingJobId) {
            console.log(`Starting polling for jobId: ${pollingJobId}`);
            setIsPolling(true);
            setPollingError(null);
            const pollStatus = async () => {
                console.log(`Polling status for fileId: ${pollingJobId}...`); // Log the ID being polled
                try {
                    // Fetch the wrapper response { success: boolean, data: TranslationStatusResponse }
                    const wrapperResponse = await (0, translation_1.getTranslationStatus)(pollingJobId);
                    console.log('[TranslationCenter Polling] Received wrapperResponse:', wrapperResponse);
                    // --- Extract the actual status data --- 
                    if (wrapperResponse && wrapperResponse.success && wrapperResponse.data) {
                        const statusData = wrapperResponse.data;
                        console.log('[TranslationCenter Polling] Extracted statusData:', statusData);
                        setTranslationStatus(statusData);
                        setPollingError(null); // Clear error on successful poll
                        // Stop polling if completed or failed (use extracted data)
                        if (statusData.status === 'completed' || statusData.status === 'failed') {
                            clearPollingInterval();
                        }
                    }
                    else {
                        // Handle cases where response format is unexpected
                        console.error('[TranslationCenter Polling] Invalid status response format:', wrapperResponse);
                        setPollingError('无效的状态响应格式');
                        // Optionally stop polling on invalid format
                        // clearPollingInterval();
                    }
                }
                catch (err) {
                    console.error('Error polling translation status:', err);
                    setPollingError(err.message || '获取翻译状态时出错');
                    // Optional: Implement retry logic or stop polling after too many errors
                    // For now, we continue polling even after an error, but show the error
                    // clearPollingInterval(); // Uncomment to stop polling on error
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
        }
        else {
            // Clear interval if step changes or jobId becomes null
            clearPollingInterval();
            // Reset status if we navigate away from the progress step
            if (currentStep !== 2) {
                setTranslationStatus(null);
                // Don't clear pollingJobId here automatically, user might navigate back
                // setPollingJobId(null);
                setPollingError(null);
            }
        }
    }, [currentStep, pollingJobId]); // Dependencies: run effect when step or jobId changes
    // --- END MOVE Polling useEffect Hook ---
    // === Conditional Rendering Logic ===
    // Case 1: No projectId - Show project selection
    if (!projectId) {
        if (projectsLoading) {
            return ((0, jsx_runtime_1.jsx)("div", { className: "loading-container", style: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }, children: (0, jsx_runtime_1.jsx)(antd_1.Spin, { size: "large", tip: "\u52A0\u8F7D\u9879\u76EE\u4E2D..." }) }));
        }
        if (projectsError) {
            return ((0, jsx_runtime_1.jsx)("div", { className: "error-container", style: { padding: '2rem' }, children: (0, jsx_runtime_1.jsx)(antd_1.Alert, { type: "error", message: "\u52A0\u8F7D\u9879\u76EE\u5217\u8868\u5931\u8D25", description: projectsError || '请刷新页面重试', showIcon: true }) }));
        }
        // Status tag renderer
        const renderStatusTag = (status) => {
            const config = statusConfigs[status] || statusConfigs.default;
            return ((0, jsx_runtime_1.jsx)(antd_1.Tag, { color: config.color, icon: config.icon, children: config.text }));
        };
        // Project table columns
        const projectColumns = [
            {
                title: '项目名称',
                dataIndex: 'name',
                key: 'name',
                render: (text, record) => ((0, jsx_runtime_1.jsxs)(antd_1.Space, { direction: "vertical", size: 0, children: [(0, jsx_runtime_1.jsx)(Text, { strong: true, children: text }), record.description && (0, jsx_runtime_1.jsx)(Text, { type: "secondary", style: { fontSize: '12px' }, children: record.description })] }))
            },
            {
                title: '语言',
                key: 'languages',
                render: (_, record) => ((0, jsx_runtime_1.jsxs)(antd_1.Space, { children: [(0, jsx_runtime_1.jsx)(antd_1.Tag, { color: "blue", children: record.languagePairs && record.languagePairs.length > 0
                                ? record.languagePairs[0].source
                                : 'N/A' }), (0, jsx_runtime_1.jsx)(icons_1.ArrowRightOutlined, { style: { color: '#8c8c8c' } }), record.languagePairs && record.languagePairs.length > 0 && ((0, jsx_runtime_1.jsx)(antd_1.Tag, { color: "green", children: record.languagePairs[0].target }))] }))
            },
            {
                title: '优先级',
                dataIndex: 'priority',
                key: 'priority',
                render: (priority) => {
                    const colorMap = {
                        'low': 'green',
                        'medium': 'orange',
                        'high': 'red'
                    };
                    return (0, jsx_runtime_1.jsx)(antd_1.Tag, { color: colorMap[priority] || 'default', children: priority });
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
                render: (date) => ((0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: new Date(date).toLocaleString(), children: new Date(date).toLocaleDateString() }))
            },
            {
                title: '操作',
                key: 'action',
                render: (_, record) => ((0, jsx_runtime_1.jsx)(antd_1.Button, { type: "primary", icon: (0, jsx_runtime_1.jsx)(icons_1.ArrowRightOutlined, {}), onClick: () => navigate(`/projects/${record._id}/translate`), children: "\u9009\u62E9\u5E76\u7FFB\u8BD1" })),
            },
        ];
        return ((0, jsx_runtime_1.jsxs)("div", { className: "translation-center-dashboard", children: [(0, jsx_runtime_1.jsx)(antd_1.Row, { gutter: [16, 16], children: (0, jsx_runtime_1.jsx)(antd_1.Col, { span: 24, children: (0, jsx_runtime_1.jsx)(antd_1.Card, { className: "welcome-card", children: (0, jsx_runtime_1.jsxs)(antd_1.Row, { align: "middle", gutter: 24, children: [(0, jsx_runtime_1.jsxs)(antd_1.Col, { xs: 24, md: 16, children: [(0, jsx_runtime_1.jsx)(Title, { level: 2, children: "AI\u7FFB\u8BD1\u4E2D\u5FC3" }), (0, jsx_runtime_1.jsxs)(Paragraph, { children: ["\u6B22\u8FCE", user?.name ? `, ${user.name}` : '', "\uFF01\u5728\u6B64\u5904\u9009\u62E9\u4E00\u4E2A\u9879\u76EE\u4EE5\u8FDB\u884C\u7FFB\u8BD1\u914D\u7F6E\u548C\u63D0\u4EA4\u3002\u6240\u6709\u6587\u4EF6\u7FFB\u8BD1\u5FC5\u987B\u901A\u8FC7\u7FFB\u8BD1\u4E2D\u5FC3\u8FDB\u884C\uFF0C\u4EE5\u786E\u4FDD\u6B63\u786E\u914D\u7F6E\u63D0\u793A\u8BCD\u6A21\u677F\u3001AI\u5F15\u64CE\u548C\u672F\u8BED\u8868\u8D44\u6E90\u3002"] })] }), (0, jsx_runtime_1.jsx)(antd_1.Col, { xs: 24, md: 8, style: { textAlign: 'center' }, children: (0, jsx_runtime_1.jsx)("img", { src: "/logo.png", alt: "Translation Platform Logo", style: { maxWidth: '100%', maxHeight: '80px', opacity: 0.8 } }) })] }) }) }) }), (0, jsx_runtime_1.jsxs)(antd_1.Row, { gutter: [16, 16], style: { marginTop: '16px' }, children: [(0, jsx_runtime_1.jsx)(antd_1.Col, { xs: 24, md: 8, children: (0, jsx_runtime_1.jsx)(antd_1.Card, { hoverable: true, children: (0, jsx_runtime_1.jsx)(antd_1.Statistic, { title: "\u603B\u9879\u76EE\u6570", value: statistics.totalProjects, prefix: (0, jsx_runtime_1.jsx)(icons_1.FileOutlined, {}) }) }) }), (0, jsx_runtime_1.jsx)(antd_1.Col, { xs: 24, md: 8, children: (0, jsx_runtime_1.jsx)(antd_1.Card, { hoverable: true, children: (0, jsx_runtime_1.jsx)(antd_1.Statistic, { title: "\u6D3B\u8DC3\u7FFB\u8BD1", value: statistics.activeTranslations, prefix: (0, jsx_runtime_1.jsx)(icons_1.SyncOutlined, { spin: statistics.activeTranslations > 0 }), valueStyle: { color: statistics.activeTranslations > 0 ? '#1890ff' : 'inherit' } }) }) }), (0, jsx_runtime_1.jsx)(antd_1.Col, { xs: 24, md: 8, children: (0, jsx_runtime_1.jsx)(antd_1.Card, { hoverable: true, children: (0, jsx_runtime_1.jsx)(antd_1.Statistic, { title: "\u4ECA\u65E5\u5B8C\u6210", value: statistics.completedToday, prefix: (0, jsx_runtime_1.jsx)(icons_1.CheckCircleOutlined, {}), valueStyle: { color: statistics.completedToday > 0 ? '#52c41a' : 'inherit' } }) }) })] }), (0, jsx_runtime_1.jsxs)(antd_1.Card, { style: { marginTop: '16px' }, children: [(0, jsx_runtime_1.jsx)(Title, { level: 3, children: "\u9879\u76EE\u5217\u8868" }), (0, jsx_runtime_1.jsxs)(antd_1.Row, { gutter: 16, style: { marginBottom: '16px' }, children: [(0, jsx_runtime_1.jsx)(antd_1.Col, { span: 12, children: (0, jsx_runtime_1.jsx)(antd_1.Input, { placeholder: "\u641C\u7D22\u9879\u76EE...", allowClear: true, prefix: (0, jsx_runtime_1.jsx)(icons_1.SearchOutlined, {}), onChange: (e) => setSearchText(e.target.value) }) }), (0, jsx_runtime_1.jsx)(antd_1.Col, { span: 12, children: (0, jsx_runtime_1.jsxs)(antd_1.Radio.Group, { value: activeFilter, onChange: (e) => setActiveFilter(e.target.value), buttonStyle: "solid", children: [(0, jsx_runtime_1.jsx)(antd_1.Radio.Button, { value: null, children: "\u5168\u90E8" }), (0, jsx_runtime_1.jsx)(antd_1.Radio.Button, { value: "active", children: "\u8FDB\u884C\u4E2D" }), (0, jsx_runtime_1.jsx)(antd_1.Radio.Button, { value: "pending", children: "\u5F85\u5904\u7406" }), (0, jsx_runtime_1.jsx)(antd_1.Radio.Button, { value: "completed", children: "\u5DF2\u5B8C\u6210" })] }) })] }), (0, jsx_runtime_1.jsx)(antd_1.Table, { columns: projectColumns, dataSource: filteredProjects, rowKey: "_id", pagination: { pageSize: 10 }, rowClassName: (record) => record.status === 'active' ? 'active-row' : '', loading: projectsLoading, locale: { emptyText: '暂无项目数据' } })] })] }));
    }
    // Case 2: projectId exists - Show Translation Steps UI
    // Loading state for specific project data (includes new queries)
    const isProjectDataLoading = projectLoading || filesLoading || promptsLoading || reviewPromptsLoading || aiConfigsLoading || tbLoading || tmLoading;
    if (isProjectDataLoading) {
        return ((0, jsx_runtime_1.jsx)("div", { className: "loading-container", style: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }, children: (0, jsx_runtime_1.jsxs)(antd_1.Space, { direction: "vertical", size: "middle", style: { textAlign: 'center' }, children: [(0, jsx_runtime_1.jsx)(antd_1.Spin, { size: "large" }), (0, jsx_runtime_1.jsx)(Text, { children: "\u52A0\u8F7D\u7FFB\u8BD1\u6570\u636E\u4E2D..." })] }) }));
    }
    // Error state for specific project data
    const projectDataError = projectError || filesFetchError; // TODO: Add errors from other queries?
    if (projectDataError) {
        const errorMsg = (projectDataError instanceof Error) ? projectDataError.message : "获取项目数据失败"; // Added type check
        return ((0, jsx_runtime_1.jsx)("div", { className: "error-container", style: { padding: '2rem' }, children: (0, jsx_runtime_1.jsx)(antd_1.Alert, { type: "error", message: "\u52A0\u8F7D\u9879\u76EE\u6570\u636E\u5931\u8D25", description: errorMsg, showIcon: true, action: (0, jsx_runtime_1.jsx)(antd_1.Button, { type: "primary", onClick: () => navigate(-1), children: "\u8FD4\u56DE" }) }) }));
    }
    // Check if project data is available (should be if not loading/error)
    if (!project) {
        return ((0, jsx_runtime_1.jsx)("div", { className: "not-found-container", style: { padding: '2rem' }, children: (0, jsx_runtime_1.jsx)(antd_1.Alert, { type: "warning", message: "\u672A\u627E\u5230\u9879\u76EE", description: "\u65E0\u6CD5\u52A0\u8F7D\u7FFB\u8BD1\u4E2D\u5FC3\uFF0C\u8BF7\u786E\u4FDD\u9879\u76EEID\u6709\u6548\u3002", showIcon: true, action: (0, jsx_runtime_1.jsx)(antd_1.Button, { type: "primary", onClick: () => navigate('/translate'), children: "\u8FD4\u56DE\u7FFB\u8BD1\u4E2D\u5FC3" }) }) }));
    }
    // Step content
    const steps = [
        {
            title: '选择文件',
            icon: (0, jsx_runtime_1.jsx)(icons_1.CloudOutlined, {}),
            content: ((0, jsx_runtime_1.jsx)(FileList_1.default, { files: files || [], onSelectFiles: handleFileSelect, selectedFileIds: selectedFileIds })),
        },
        {
            title: '翻译设置',
            icon: (0, jsx_runtime_1.jsx)(icons_1.TranslationOutlined, {}),
            content: ((0, jsx_runtime_1.jsx)(TranslationSettings_1.default, { project: project, promptTemplates: translationPromptTemplates, reviewPromptTemplates: reviewPromptTemplates, aiConfigs: aiConfigs || [], terminologyBases: terminologyBases, translationMemories: translationMemories, settings: translationSettings, onSettingsChange: handleSettingsChange })),
        },
        {
            icon: isPolling ? (0, jsx_runtime_1.jsx)(icons_1.SyncOutlined, { spin: true }) : (translationStatus?.status === 'completed' ? (0, jsx_runtime_1.jsx)(icons_1.CheckCircleOutlined, {}) : (0, jsx_runtime_1.jsx)(icons_1.LoadingOutlined, {})),
            content: ((0, jsx_runtime_1.jsx)(TranslationProgress_1.default, { jobId: pollingJobId, status: translationStatus, isLoading: isPolling && !translationStatus, onViewReview: (fileId) => {
                    console.log(`Navigating to review for file: ${fileId}`);
                    antd_1.message.info(`审阅功能待实现 (文件 ID: ${fileId})`);
                } })),
        },
    ];
    return ((0, jsx_runtime_1.jsx)("div", { className: "translation-center-page", children: (0, jsx_runtime_1.jsx)(antd_1.Card, { className: "project-translation-card", children: (0, jsx_runtime_1.jsxs)(antd_1.Row, { gutter: [0, 16], children: [(0, jsx_runtime_1.jsxs)(antd_1.Col, { span: 24, children: [(0, jsx_runtime_1.jsxs)(antd_1.Space, { align: "center", style: { marginBottom: '8px' }, children: [(0, jsx_runtime_1.jsx)(antd_1.Badge, { status: "processing" }), (0, jsx_runtime_1.jsx)(Title, { level: 2, style: { margin: 0 }, children: "AI\u7FFB\u8BD1\u4E2D\u5FC3" })] }), (0, jsx_runtime_1.jsxs)(antd_1.Row, { align: "middle", children: [(0, jsx_runtime_1.jsxs)(antd_1.Col, { flex: "auto", children: [(0, jsx_runtime_1.jsx)(Paragraph, { style: { margin: 0 }, children: (0, jsx_runtime_1.jsxs)(antd_1.Space, { children: [(0, jsx_runtime_1.jsx)(Text, { strong: true, children: "\u9879\u76EE\uFF1A" }), (0, jsx_runtime_1.jsx)(Text, { children: project?.name }), (0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: `项目ID: ${projectId} | ${project?.languagePairs?.[0]?.source || 'N/A'} → ${project?.languagePairs?.[0]?.target || 'N/A'}`, children: (0, jsx_runtime_1.jsx)(icons_1.InfoCircleOutlined, { style: { color: '#1890ff' } }) })] }) }), (0, jsx_runtime_1.jsx)(Paragraph, { style: { margin: '8px 0 0 0', fontSize: '14px', color: '#666' }, children: "\u8BF7\u5B8C\u6210\u4EE5\u4E0B\u6B65\u9AA4\u914D\u7F6E\u7FFB\u8BD1\u8D44\u6E90\uFF0C\u53EA\u6709\u901A\u8FC7\u7FFB\u8BD1\u4E2D\u5FC3\u914D\u7F6E\u5E76\u63D0\u4EA4\u7684\u7FFB\u8BD1\u4EFB\u52A1\u624D\u80FD\u6709\u6548\u5229\u7528\u63D0\u793A\u8BCD\u6A21\u677F\u548C\u672F\u8BED\u8868\u3002" })] }), (0, jsx_runtime_1.jsx)(antd_1.Col, { children: (0, jsx_runtime_1.jsx)(antd_1.Button, { type: "link", onClick: () => navigate(`/projects/${projectId}`), icon: (0, jsx_runtime_1.jsx)(icons_1.ArrowRightOutlined, {}), children: "\u67E5\u770B\u9879\u76EE\u8BE6\u60C5" }) })] })] }), (0, jsx_runtime_1.jsx)(antd_1.Col, { span: 24, children: (0, jsx_runtime_1.jsx)(antd_1.Card, { className: "steps-card", bordered: false, bodyStyle: {
                                padding: '24px',
                                background: '#f5f5f5',
                                borderRadius: '8px'
                            }, children: (0, jsx_runtime_1.jsx)(antd_1.Steps, { current: currentStep, className: "translation-steps", children: steps.map(step => ((0, jsx_runtime_1.jsx)(Step, { title: step.title, icon: step.icon }, step.title))) }) }) }), (0, jsx_runtime_1.jsx)(antd_1.Col, { span: 24, children: (0, jsx_runtime_1.jsx)("div", { className: "steps-content", style: { padding: '16px', minHeight: '300px' }, children: steps[currentStep].content }) }), (0, jsx_runtime_1.jsxs)(antd_1.Col, { span: 24, children: [(0, jsx_runtime_1.jsx)(antd_1.Divider, { style: { margin: '16px 0' } }), (0, jsx_runtime_1.jsxs)("div", { className: "steps-action", style: { display: 'flex', justifyContent: 'flex-end' }, children: [currentStep === 1 && ((0, jsx_runtime_1.jsx)(antd_1.Button, { onClick: handlePrev, style: { marginRight: 8 }, children: "\u4E0A\u4E00\u6B65" })), currentStep === 0 && ((0, jsx_runtime_1.jsx)(antd_1.Button, { type: "primary", onClick: handleNext, disabled: selectedFileIds.length === 0, children: "\u4E0B\u4E00\u6B65" })), currentStep === 1 && ((0, jsx_runtime_1.jsx)(antd_1.Button, { type: "primary", onClick: handleStartTranslation, disabled: !translationSettings.aiModelId ||
                                            !translationSettings.promptTemplateId ||
                                            !translationSettings.reviewPromptTemplateId ||
                                            (translationSettings.useTerminology && !translationSettings.terminologyBaseId) ||
                                            (translationSettings.useTranslationMemory && !translationSettings.translationMemoryId), children: "\u542F\u52A8\u7FFB\u8BD1" })), currentStep === 2 && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [translationStatus?.status === 'failed' && ((0, jsx_runtime_1.jsx)(antd_1.Button, { danger: true, onClick: () => antd_1.message.info('重新翻译失败片段功能待实现'), children: "\u91CD\u65B0\u7FFB\u8BD1\u5931\u8D25\u7247\u6BB5" })), translationStatus?.status === 'completed' && ((0, jsx_runtime_1.jsx)(antd_1.Button, { type: "primary", onClick: () => antd_1.message.info('提交审校功能待实现'), children: "\u63D0\u4EA4\u5BA1\u6821" }))] }))] })] })] }) }) }));
};
exports.default = TranslationCenterPage;

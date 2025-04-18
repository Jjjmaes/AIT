"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const antd_1 = require("antd");
const react_router_dom_1 = require("react-router-dom");
const icons_1 = require("@ant-design/icons");
// Remove the direct api import if no longer needed for other calls in this component
// import { axiosInstance as api } from '../api/base'; 
// Restore api import as it's needed by other functions
const base_1 = require("../api/base");
// Import the service function AND the type
const promptTemplateService_1 = require("../api/promptTemplateService");
const { Title } = antd_1.Typography;
// Define type for Prompt Template (adjust based on actual API response)
// REMOVE local interface definition, use imported one
/*
interface PromptTemplate {
  _id: string; // Use MongoDB default _id
  name: string;
  description: string;
  type: 'translation' | 'review';
  modelId: string; // Or display model name
  sourceLang?: string;
  targetLang?: string;
  domain?: string;
  isActive: boolean;
  createdAt: string;
}
*/
const PromptTemplatesPage = () => {
    const [templates, setTemplates] = (0, react_1.useState)([]); // Now uses imported PromptTemplate type
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const navigate = (0, react_router_dom_1.useNavigate)();
    const [modal, contextHolder] = antd_1.Modal.useModal();
    // Fetch templates using useCallback
    const fetchTemplates = (0, react_1.useCallback)(async () => {
        setLoading(true);
        setError(null); // Clear previous errors
        try {
            // const response = await api.get('/prompts'); // Old incorrect call
            const response = await (0, promptTemplateService_1.getPromptTemplates)(); // Use the service function
            // Correctly handle the nested data structure returned by the service
            let fetchedTemplates = [];
            // The service function already returns the expected structure
            if (response.success && response.data?.templates && Array.isArray(response.data.templates)) {
                fetchedTemplates = response.data.templates;
            }
            else if (response.success && !response.data?.templates) {
                // Handle success case but no templates found
                fetchedTemplates = [];
            }
            else {
                // Use message from the service response if available
                throw new Error(response.message || 'Failed to fetch prompt templates');
            }
            // Ensure every item has a unique id for the Table rowKey
            const validTemplates = fetchedTemplates.filter(t => t && t._id);
            const uniqueTemplates = Array.from(new Map(validTemplates.map(t => [t._id, t])).values());
            setTemplates(uniqueTemplates);
        }
        catch (err) {
            console.error('Error fetching prompt templates:', err);
            setError(err.message || '加载提示词模板列表失败');
            antd_1.message.error(err.message || '加载提示词模板列表失败');
        }
        finally {
            setLoading(false);
        }
    }, []); // Empty dependency array means this function is created once
    (0, react_1.useEffect)(() => {
        fetchTemplates();
    }, [fetchTemplates]); // fetchTemplates is now stable
    // Delete handler
    const handleDelete = (_id) => {
        console.log(`[handleDelete] function called with _id: ${_id}`);
        // Use the modal instance from the hook
        modal.confirm({
            title: '确认删除?',
            icon: (0, jsx_runtime_1.jsx)(icons_1.QuestionCircleOutlined, { style: { color: 'red' } }),
            content: '删除此提示词模板后将无法恢复，确认删除吗？',
            okText: '确认删除',
            cancelText: '取消',
            okType: 'danger',
            onOk: async () => {
                try {
                    const response = await base_1.axiosInstance.delete(`/prompts/${_id}`);
                    if (response.data?.success || response.status === 200) {
                        antd_1.message.success('模板删除成功');
                        fetchTemplates(); // Refresh list
                    }
                    else {
                        throw new Error(response.data?.message || 'Failed to delete template');
                    }
                }
                catch (error) {
                    console.error('Error deleting template:', error);
                    antd_1.message.error('删除模板失败');
                }
            },
        });
    };
    // Duplicate handler (optional)
    const handleDuplicate = async (template) => {
        antd_1.message.loading({ content: '正在复制模板...', key: 'duplicate' });
        try {
            // Create payload for new template based on the old one
            const { _id, createdAt, ...duplicateData } = template;
            const newName = `${template.name} (复制)`;
            const payload = { ...duplicateData, name: newName };
            // Replace with actual API call
            const response = await base_1.axiosInstance.post('/prompts', payload);
            if (response.status === 201 && response.data) {
                antd_1.message.success({ content: `模板 '${newName}' 复制成功`, key: 'duplicate' });
                fetchTemplates(); // Refresh list
            }
            else {
                throw new Error(response.data?.message || 'Failed to duplicate template');
            }
        }
        catch (err) {
            console.error('Error duplicating template:', err);
            antd_1.message.error({ content: err.message || '复制模板失败', key: 'duplicate' });
        }
    };
    const columns = [
        {
            title: '名称',
            dataIndex: 'name',
            key: 'name',
            render: (text, record) => (0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: `/prompts/${record._id}/edit`, children: text }),
        },
        {
            title: '类型',
            dataIndex: 'type',
            key: 'type',
            render: (type) => (0, jsx_runtime_1.jsx)(antd_1.Tag, { color: type === 'translation' ? 'blue' : 'green', children: type === 'translation' ? '翻译' : '审校' }),
        },
        {
            title: '状态',
            dataIndex: 'isActive',
            key: 'isActive',
            render: (isActive) => (0, jsx_runtime_1.jsx)(antd_1.Tag, { color: isActive ? 'success' : 'default', children: isActive ? '已启用' : '已禁用' }),
        },
        {
            title: '描述',
            dataIndex: 'description',
            key: 'description',
            ellipsis: true,
        },
        {
            title: '语言对',
            key: 'lang',
            render: (_, record) => ((0, jsx_runtime_1.jsxs)("span", { children: [record.sourceLang || '-', " \u2192 ", record.targetLang || '-'] })),
        },
        {
            title: '领域',
            dataIndex: 'domain',
            key: 'domain',
            render: (domain) => domain || '通用',
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date) => new Date(date).toLocaleDateString(),
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => ((0, jsx_runtime_1.jsxs)(antd_1.Space, { size: "middle", children: [(0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: "\u7F16\u8F91", children: (0, jsx_runtime_1.jsx)(antd_1.Button, { icon: (0, jsx_runtime_1.jsx)(icons_1.EditOutlined, {}), onClick: () => navigate(`/prompts/${record._id}/edit`) }) }), (0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: "\u590D\u5236", children: (0, jsx_runtime_1.jsx)(antd_1.Button, { icon: (0, jsx_runtime_1.jsx)(icons_1.CopyOutlined, {}), onClick: () => handleDuplicate(record) }) }), (0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: "\u5220\u9664", children: (0, jsx_runtime_1.jsx)(antd_1.Button, { icon: (0, jsx_runtime_1.jsx)(icons_1.DeleteOutlined, {}), danger: true, onClick: () => handleDelete(record._id) }) })] })),
        },
    ];
    return ((0, jsx_runtime_1.jsxs)("div", { children: [contextHolder, (0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }, children: [(0, jsx_runtime_1.jsx)(Title, { level: 2, children: "\u63D0\u793A\u8BCD\u6A21\u677F\u7BA1\u7406" }), (0, jsx_runtime_1.jsx)(antd_1.Button, { type: "primary", icon: (0, jsx_runtime_1.jsx)(icons_1.PlusOutlined, {}), onClick: () => navigate('/prompts/create'), children: "\u521B\u5EFA\u65B0\u6A21\u677F" })] }), error && (0, jsx_runtime_1.jsx)(antd_1.Alert, { message: "\u52A0\u8F7D\u9519\u8BEF", description: error, type: "error", showIcon: true, style: { marginBottom: 16 } }), (0, jsx_runtime_1.jsx)(antd_1.Table, { columns: columns, dataSource: templates, loading: loading, rowKey: "_id" })] }));
};
exports.default = PromptTemplatesPage;

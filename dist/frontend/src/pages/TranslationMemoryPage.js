"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const antd_1 = require("antd");
const icons_1 = require("@ant-design/icons");
const base_1 = require("../api/base");
const { Title } = antd_1.Typography;
const { Option } = antd_1.Select;
const { Search } = antd_1.Input;
const TranslationMemoryPage = () => {
    const [memories, setMemories] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [modalVisible, setModalVisible] = (0, react_1.useState)(false);
    const [modalMode, setModalMode] = (0, react_1.useState)('create');
    const [currentMemory, setCurrentMemory] = (0, react_1.useState)(null);
    const [form] = antd_1.Form.useForm();
    // Fetch translation memories
    const fetchMemories = async () => {
        setLoading(true);
        try {
            // Replace with actual API call
            const response = await base_1.axiosInstance.get('/v1/tm');
            if (response.data?.success || response.status === 200) {
                setMemories(response.data?.data?.memories || response.data?.data || []);
            }
            else {
                throw new Error(response.data?.message || 'Failed to fetch translation memories');
            }
        }
        catch (error) {
            console.error('Error fetching translation memories:', error);
            antd_1.message.error('加载翻译记忆库失败');
        }
        finally {
            setLoading(false);
        }
    };
    (0, react_1.useEffect)(() => {
        fetchMemories();
    }, []);
    const handleOpenModal = (mode, memory) => {
        setModalMode(mode);
        setCurrentMemory(memory || null);
        if (mode === 'edit' && memory) {
            form.setFieldsValue(memory);
        }
        else {
            form.resetFields();
        }
        setModalVisible(true);
    };
    const handleSubmit = async (values) => {
        try {
            if (modalMode === 'create') {
                // Replace with actual API call
                const response = await base_1.axiosInstance.post('/v1/tm', values);
                if (response.data?.success || response.status === 201) {
                    antd_1.message.success('翻译记忆库创建成功');
                }
                else {
                    throw new Error(response.data?.message || 'Failed to create translation memory');
                }
            }
            else if (modalMode === 'edit' && currentMemory) {
                // Replace with actual API call
                const response = await base_1.axiosInstance.put(`/v1/tm/${currentMemory.id}`, values);
                if (response.data?.success || response.status === 200) {
                    antd_1.message.success('翻译记忆库更新成功');
                }
                else {
                    throw new Error(response.data?.message || 'Failed to update translation memory');
                }
            }
            setModalVisible(false);
            fetchMemories();
        }
        catch (error) {
            console.error('Error saving translation memory:', error);
            antd_1.message.error('保存翻译记忆库失败');
        }
    };
    const handleDelete = async (id) => {
        try {
            // Replace with actual API call
            const response = await base_1.axiosInstance.delete(`/v1/tm/${id}`);
            if (response.data?.success || response.status === 200) {
                antd_1.message.success('翻译记忆库删除成功');
                fetchMemories();
            }
            else {
                throw new Error(response.data?.message || 'Failed to delete translation memory');
            }
        }
        catch (error) {
            console.error('Error deleting translation memory:', error);
            antd_1.message.error('删除翻译记忆库失败');
        }
    };
    const uploadProps = {
        name: 'file',
        action: `${base_1.axiosInstance.defaults.baseURL}/v1/tm/import`,
        headers: {
            authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        onChange(info) {
            if (info.file.status === 'done') {
                antd_1.message.success(`${info.file.name} 上传成功`);
                fetchMemories();
            }
            else if (info.file.status === 'error') {
                antd_1.message.error(`${info.file.name} 上传失败`);
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
            render: (_, record) => ((0, jsx_runtime_1.jsxs)("span", { children: [record.sourceLanguage, " \u2192 ", record.targetLanguage] })),
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
            sorter: (a, b) => a.entryCount - b.entryCount,
        },
        {
            title: '最后更新',
            dataIndex: 'lastUpdated',
            key: 'lastUpdated',
            render: (date) => new Date(date).toLocaleDateString(),
            sorter: (a, b) => new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime(),
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => ((0, jsx_runtime_1.jsxs)(antd_1.Space, { size: "middle", children: [(0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: "\u7F16\u8F91", children: (0, jsx_runtime_1.jsx)(antd_1.Button, { icon: (0, jsx_runtime_1.jsx)(icons_1.EditOutlined, {}), onClick: () => handleOpenModal('edit', record) }) }), (0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: "\u5BFC\u51FA", children: (0, jsx_runtime_1.jsx)(antd_1.Button, { icon: (0, jsx_runtime_1.jsx)(icons_1.DownloadOutlined, {}), onClick: () => window.location.href = `${base_1.axiosInstance.defaults.baseURL}/v1/tm/${record.id}/export` }) }), (0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: "\u5220\u9664", children: (0, jsx_runtime_1.jsx)(antd_1.Popconfirm, { title: "\u786E\u8BA4\u5220\u9664\u8FD9\u4E2A\u7FFB\u8BD1\u8BB0\u5FC6\u5E93?", onConfirm: () => handleDelete(record.id), okText: "\u786E\u8BA4", cancelText: "\u53D6\u6D88", children: (0, jsx_runtime_1.jsx)(antd_1.Button, { danger: true, icon: (0, jsx_runtime_1.jsx)(icons_1.DeleteOutlined, {}) }) }) })] })),
        },
    ];
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }, children: [(0, jsx_runtime_1.jsx)(Title, { level: 2, children: "\u7FFB\u8BD1\u8BB0\u5FC6\u5E93" }), (0, jsx_runtime_1.jsxs)(antd_1.Space, { children: [(0, jsx_runtime_1.jsx)(antd_1.Upload, { ...uploadProps, children: (0, jsx_runtime_1.jsx)(antd_1.Button, { icon: (0, jsx_runtime_1.jsx)(icons_1.UploadOutlined, {}), children: "\u5BFC\u5165" }) }), (0, jsx_runtime_1.jsx)(antd_1.Button, { type: "primary", icon: (0, jsx_runtime_1.jsx)(icons_1.PlusOutlined, {}), onClick: () => handleOpenModal('create'), children: "\u521B\u5EFA\u8BB0\u5FC6\u5E93" })] })] }), (0, jsx_runtime_1.jsx)("div", { style: { marginBottom: '16px' }, children: (0, jsx_runtime_1.jsx)(Search, { placeholder: "\u641C\u7D22\u7FFB\u8BD1\u8BB0\u5FC6\u5E93", allowClear: true, enterButton: (0, jsx_runtime_1.jsx)(icons_1.SearchOutlined, {}), onSearch: (value) => console.log('Search value:', value), style: { maxWidth: '400px' } }) }), (0, jsx_runtime_1.jsx)(antd_1.Table, { columns: columns, dataSource: memories, loading: loading, rowKey: "id" }), (0, jsx_runtime_1.jsx)(antd_1.Modal, { title: modalMode === 'create' ? '创建翻译记忆库' : '编辑翻译记忆库', open: modalVisible, onCancel: () => setModalVisible(false), footer: null, children: (0, jsx_runtime_1.jsxs)(antd_1.Form, { form: form, layout: "vertical", onFinish: handleSubmit, children: [(0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "name", label: "\u540D\u79F0", rules: [{ required: true, message: '请输入翻译记忆库名称' }], children: (0, jsx_runtime_1.jsx)(antd_1.Input, {}) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "sourceLanguage", label: "\u6E90\u8BED\u8A00", rules: [{ required: true, message: '请选择源语言' }], children: (0, jsx_runtime_1.jsxs)(antd_1.Select, { children: [(0, jsx_runtime_1.jsx)(Option, { value: "zh-CN", children: "\u4E2D\u6587 (\u7B80\u4F53)" }), (0, jsx_runtime_1.jsx)(Option, { value: "en-US", children: "\u82F1\u8BED (\u7F8E\u56FD)" }), (0, jsx_runtime_1.jsx)(Option, { value: "ja-JP", children: "\u65E5\u8BED" }), (0, jsx_runtime_1.jsx)(Option, { value: "ko-KR", children: "\u97E9\u8BED" }), (0, jsx_runtime_1.jsx)(Option, { value: "fr-FR", children: "\u6CD5\u8BED" }), (0, jsx_runtime_1.jsx)(Option, { value: "de-DE", children: "\u5FB7\u8BED" })] }) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "targetLanguage", label: "\u76EE\u6807\u8BED\u8A00", rules: [{ required: true, message: '请选择目标语言' }], children: (0, jsx_runtime_1.jsxs)(antd_1.Select, { children: [(0, jsx_runtime_1.jsx)(Option, { value: "zh-CN", children: "\u4E2D\u6587 (\u7B80\u4F53)" }), (0, jsx_runtime_1.jsx)(Option, { value: "en-US", children: "\u82F1\u8BED (\u7F8E\u56FD)" }), (0, jsx_runtime_1.jsx)(Option, { value: "ja-JP", children: "\u65E5\u8BED" }), (0, jsx_runtime_1.jsx)(Option, { value: "ko-KR", children: "\u97E9\u8BED" }), (0, jsx_runtime_1.jsx)(Option, { value: "fr-FR", children: "\u6CD5\u8BED" }), (0, jsx_runtime_1.jsx)(Option, { value: "de-DE", children: "\u5FB7\u8BED" })] }) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "domain", label: "\u9886\u57DF", children: (0, jsx_runtime_1.jsxs)(antd_1.Select, { children: [(0, jsx_runtime_1.jsx)(Option, { value: "general", children: "\u901A\u7528" }), (0, jsx_runtime_1.jsx)(Option, { value: "technical", children: "\u6280\u672F" }), (0, jsx_runtime_1.jsx)(Option, { value: "legal", children: "\u6CD5\u5F8B" }), (0, jsx_runtime_1.jsx)(Option, { value: "medical", children: "\u533B\u7597" }), (0, jsx_runtime_1.jsx)(Option, { value: "financial", children: "\u91D1\u878D" })] }) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { children: (0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', justifyContent: 'flex-end' }, children: [(0, jsx_runtime_1.jsx)(antd_1.Button, { style: { marginRight: 8 }, onClick: () => setModalVisible(false), children: "\u53D6\u6D88" }), (0, jsx_runtime_1.jsx)(antd_1.Button, { type: "primary", htmlType: "submit", children: "\u4FDD\u5B58" })] }) })] }) })] }));
};
exports.default = TranslationMemoryPage;

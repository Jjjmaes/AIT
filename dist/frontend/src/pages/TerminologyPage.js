"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const antd_1 = require("antd");
const icons_1 = require("@ant-design/icons");
const base_1 = require("../api/base");
const { Title, Text } = antd_1.Typography;
const { Option } = antd_1.Select;
const { Search } = antd_1.Input;
const { TabPane } = antd_1.Tabs;
const TerminologyPage = () => {
    const [activeTab, setActiveTab] = (0, react_1.useState)('termBases');
    const [termBases, setTermBases] = (0, react_1.useState)([]);
    const [terms, setTerms] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [termsLoading, setTermsLoading] = (0, react_1.useState)(false);
    const [modalVisible, setModalVisible] = (0, react_1.useState)(false);
    const [termModalVisible, setTermModalVisible] = (0, react_1.useState)(false);
    const [modalMode, setModalMode] = (0, react_1.useState)('create');
    const [currentTermBase, setCurrentTermBase] = (0, react_1.useState)(null);
    const [currentTerm, setCurrentTerm] = (0, react_1.useState)(null);
    const [selectedTermBase, setSelectedTermBase] = (0, react_1.useState)(null);
    const [termForm] = antd_1.Form.useForm();
    const [form] = antd_1.Form.useForm();
    // Fetch term bases
    const fetchTermBases = async () => {
        setLoading(true);
        try {
            // Replace with actual API call
            const response = await base_1.axiosInstance.get('/terms');
            console.log("Raw response from GET /terms:", response); // Log raw response
            if (response.data?.success || response.status === 200) {
                // Safely extract the array, ensuring it's always an array
                const terminologiesData = response.data?.data?.terminologies;
                const dataArray = Array.isArray(terminologiesData)
                    ? terminologiesData
                    : Array.isArray(response.data?.data?.docs) // Check for common pagination structure
                        ? response.data.data.docs
                        : Array.isArray(response.data?.data)
                            ? response.data.data
                            : Array.isArray(response.data?.docs) // Check for direct pagination structure
                                ? response.data.docs
                                : []; // Default to empty array if none match
                console.log("Data array passed to setTermBases:", dataArray); // Log the extracted array
                if (dataArray.length > 0) {
                    console.log("Structure of the FIRST term base object:", dataArray[0]);
                }
                else {
                    console.log("Fetched data array is empty.");
                }
                setTermBases(dataArray);
            }
            else {
                throw new Error(response.data?.message || 'Failed to fetch term bases');
            }
        }
        catch (error) {
            console.error('Error fetching term bases:', error);
            antd_1.message.error('加载术语库失败');
        }
        finally {
            setLoading(false);
        }
    };
    // Fetch terms for a specific term base
    const fetchTerms = async (termBaseId) => {
        setTermsLoading(true);
        try {
            // Replace with actual API call
            const response = await base_1.axiosInstance.get(`/terms/${termBaseId}/terms`);
            if (response.data?.success || response.status === 200) {
                setTerms(response.data?.data?.terms || []);
            }
            else {
                throw new Error(response.data?.message || 'Failed to fetch terms');
            }
        }
        catch (error) {
            console.error('Error fetching terms:', error);
            antd_1.message.error('加载术语失败');
        }
        finally {
            setTermsLoading(false);
        }
    };
    (0, react_1.useEffect)(() => {
        fetchTermBases();
    }, []);
    (0, react_1.useEffect)(() => {
        if (selectedTermBase) {
            fetchTerms(selectedTermBase);
        }
    }, [selectedTermBase]);
    const handleOpenModal = (mode, termBase) => {
        console.log('Opening modal in mode:', mode, 'with record:', termBase);
        setModalMode(mode);
        setCurrentTermBase(termBase || null);
        if (mode === 'edit' && termBase) {
            const formData = {
                name: termBase.name,
                description: termBase.description,
                domain: termBase.domain,
                isPublic: termBase.isPublic,
                sourceLanguage: Array.isArray(termBase.languagePairs) && termBase.languagePairs.length > 0
                    ? termBase.languagePairs[0].source
                    : undefined,
                targetLanguages: Array.isArray(termBase.languagePairs)
                    ? termBase.languagePairs.map((p) => p.target)
                    : [],
            };
            console.log('Setting form values for edit:', formData);
            form.setFieldsValue(formData);
        }
        else {
            form.resetFields();
        }
        setModalVisible(true);
    };
    const handleOpenTermModal = (mode, term) => {
        setModalMode(mode);
        setCurrentTerm(term || null);
        if (mode === 'edit' && term) {
            termForm.setFieldsValue(term);
        }
        else {
            termForm.resetFields();
            if (selectedTermBase) {
                termForm.setFieldsValue({ termBaseId: selectedTermBase });
            }
        }
        setTermModalVisible(true);
    };
    const handleSubmit = async (values) => {
        console.log('[handleSubmit] Term Base modal submitted with values:', values);
        try {
            // Transform frontend form values to match backend expectation
            const payload = {
                name: values.name,
                description: values.description,
                domain: values.domain,
                isPublic: values.isPublic ?? false, // Assuming a default if not provided
                languagePairs: values.targetLanguages.map((targetLang) => ({
                    source: values.sourceLanguage,
                    target: targetLang,
                })),
            };
            console.log('[handleSubmit] Transformed payload being sent:', payload);
            if (modalMode === 'create') {
                // Replace with actual API call
                console.log('[handleSubmit] Calling api.post to /terms with payload:', payload);
                const response = await base_1.axiosInstance.post('/terms', payload); // Send transformed payload
                console.log('Full response from POST /terms:', response); // Log the full response
                if (response.data?.success || response.status === 201) {
                    antd_1.message.success('术语库创建成功');
                }
                else {
                    throw new Error(response.data?.message || 'Failed to create term base');
                }
            }
            else if (modalMode === 'edit' && currentTermBase) {
                const termBaseId = currentTermBase._id;
                console.log(`Editing TermBase with ID: ${termBaseId}`);
                if (!termBaseId) {
                    antd_1.message.error('无法获取术语库ID进行更新');
                    return;
                }
                console.log(`[handleSubmit] Calling api.put to /terms/${termBaseId} with payload:`, payload);
                const response = await base_1.axiosInstance.put(`/terms/${termBaseId}`, payload);
                if (response.data?.success || response.status === 200) {
                    antd_1.message.success('术语库更新成功');
                }
                else {
                    throw new Error(response.data?.message || 'Failed to update term base');
                }
            }
            setModalVisible(false);
            fetchTermBases();
        }
        catch (error) {
            console.error('Error saving term base:', error);
            console.error('Error saving term base (full error object):', error); // Log full error object
            antd_1.message.error('保存术语库失败');
        }
    };
    const handleTermSubmit = async (values) => {
        try {
            if (modalMode === 'create') {
                // Replace with actual API call
                if (!values.termBaseId)
                    throw new Error('Term base ID is required');
                const response = await base_1.axiosInstance.put(`/terms/${values.termBaseId}/terms`, values);
                if (response.data?.success || response.status === 201 || response.status === 200) {
                    antd_1.message.success('术语创建成功');
                }
                else {
                    throw new Error(response.data?.message || 'Failed to create term');
                }
            }
            else if (modalMode === 'edit' && currentTerm) {
                // Replace with actual API call
                const response = await base_1.axiosInstance.put(`/terms/${currentTerm.termBaseId}/terms`, values);
                if (response.data?.success || response.status === 200) {
                    antd_1.message.success('术语更新成功');
                }
                else {
                    throw new Error(response.data?.message || 'Failed to update term');
                }
            }
            setTermModalVisible(false);
            if (selectedTermBase) {
                fetchTerms(selectedTermBase);
            }
        }
        catch (error) {
            console.error('Error saving term:', error);
            antd_1.message.error('保存术语失败');
        }
    };
    const handleDelete = async (id) => {
        console.log('handleDelete called with ID:', id);
        if (!id) {
            console.error('handleDelete called with invalid ID!');
            antd_1.message.error('无法删除：无效的ID');
            return;
        }
        try {
            // Replace with actual API call
            const response = await base_1.axiosInstance.delete(`/terms/${id}`);
            if (response.data?.success || response.status === 200) {
                antd_1.message.success('术语库删除成功');
                fetchTermBases();
                if (selectedTermBase === id) {
                    setSelectedTermBase(null);
                    setTerms([]);
                }
            }
            else {
                throw new Error(response.data?.message || 'Failed to delete term base');
            }
        }
        catch (error) {
            console.error('Error deleting term base:', error);
            antd_1.message.error('删除术语库失败');
        }
    };
    const handleDeleteTerm = async (id) => {
        try {
            // Replace with actual API call
            if (!selectedTermBase)
                throw new Error('No term base selected');
            const response = await base_1.axiosInstance.delete(`/terms/${selectedTermBase}/terms`, { data: { source: id } });
            if (response.data?.success || response.status === 200) {
                antd_1.message.success('术语删除成功');
                if (selectedTermBase) {
                    fetchTerms(selectedTermBase);
                }
            }
            else {
                throw new Error(response.data?.message || 'Failed to delete term');
            }
        }
        catch (error) {
            console.error('Error deleting term:', error);
            antd_1.message.error('删除术语失败');
        }
    };
    // Function to handle exporting a term base
    const handleExport = async (terminologyId) => {
        if (!terminologyId) {
            antd_1.message.error('无法导出：无效的ID');
            return;
        }
        try {
            antd_1.message.loading({ content: '正在准备导出文件...', key: 'exporting' });
            const response = await base_1.axiosInstance.get(`/terms/${terminologyId}/export`, {
                responseType: 'blob', // Important to handle binary file data
            });
            // Extract filename from content-disposition header if available
            const contentDisposition = response.headers['content-disposition'];
            let filename = `terminology_${terminologyId}.csv`; // Default filename
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/);
                if (filenameMatch && filenameMatch.length === 2) {
                    filename = filenameMatch[1];
                }
            }
            // Create a Blob from the response data
            const blob = new Blob([response.data], { type: response.headers['content-type'] || 'application/octet-stream' });
            // Create a temporary link to trigger the download
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            // Clean up
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            antd_1.message.success({ content: '文件导出成功！', key: 'exporting', duration: 2 });
        }
        catch (error) {
            console.error('Error exporting term base:', error);
            antd_1.message.error({
                content: `导出失败: ${error.response?.data?.message || error.message || '未知错误'}`,
                key: 'exporting',
                duration: 3
            });
        }
    };
    // Custom request function for Ant Design Upload component
    const handleCustomRequest = async (options) => {
        const { onSuccess, onError, file, action } = options;
        console.log('handleCustomRequest options:', { onSuccess: !!onSuccess, onError: !!onError, file, action }); // Log options
        const token = localStorage.getItem('authToken');
        if (!token) {
            antd_1.message.error('未找到认证令牌，请重新登录。');
            onError(new Error('Authorization token not found'));
            return;
        }
        const formData = new FormData();
        formData.append('file', file); // Use 'file' or match backend expected field name
        try {
            console.log(`[CustomRequest] Posting to action: ${action}`); // Log action
            const response = await base_1.axiosInstance.post(action, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data',
                },
                onUploadProgress: () => {
                    // options.onProgress({ percent: (event.loaded / event.total * 100) }); // Optional progress
                },
            });
            console.log('[CustomRequest] API call successful, response data:', response.data); // Log response data
            console.log('[CustomRequest] Calling onSuccess...'); // Log before onSuccess
            onSuccess(response.data, file);
            antd_1.message.success(`${file.name} 上传并处理成功: ${response.data?.message || ''}`);
            fetchTermBases(); // Refresh list after successful import/processing
            if (action.includes('/terms/') && action.includes('/import')) {
                const parts = action.split('/');
                const termBaseId = parts[parts.length - 2]; // Extract termBaseId if importing terms
                if (termBaseId && termBaseId !== 'import') {
                    fetchTerms(termBaseId);
                }
            }
        }
        catch (err) {
            console.error('Custom request failed:', err); // Log raw error
            console.log('[CustomRequest] Calling onError...'); // Log before onError
            const errorMsg = err.response?.data?.message || err.message || '上传失败';
            antd_1.message.error(`${file.name} 上传失败: ${errorMsg}`);
            onError(err);
        }
    };
    const termBaseColumns = [
        {
            title: '名称',
            dataIndex: 'name',
            key: 'name',
            render: (text, record) => ((0, jsx_runtime_1.jsx)("a", { onClick: () => { setSelectedTermBase(record._id); setActiveTab('terms'); }, children: text })),
        },
        {
            title: '描述',
            dataIndex: 'description',
            key: 'description',
            ellipsis: true,
        },
        {
            title: '源语言',
            dataIndex: 'languagePairs',
            key: 'sourceLanguage',
            render: (pairs) => (Array.isArray(pairs) && pairs.length > 0 ? pairs[0].source : '-'),
        },
        {
            title: '目标语言',
            dataIndex: 'languagePairs',
            key: 'targetLanguages',
            render: (pairs) => ((0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: Array.isArray(pairs)
                    ? pairs.map(pair => ((0, jsx_runtime_1.jsx)(antd_1.Tag, { children: pair.target }, `${pair.source}-${pair.target}`)))
                    : '-' })),
        },
        {
            title: '领域',
            dataIndex: 'domain',
            key: 'domain',
        },
        {
            title: '术语数量',
            dataIndex: 'terms',
            key: 'termCount',
            render: (terms) => (Array.isArray(terms) ? terms.length : 0),
            sorter: (a, b) => (Array.isArray(a.terms) ? a.terms.length : 0) -
                (Array.isArray(b.terms) ? b.terms.length : 0),
        },
        {
            title: '最后更新',
            dataIndex: 'updatedAt',
            key: 'lastUpdated',
            render: (date) => date ? new Date(date).toLocaleDateString() : '-',
            sorter: (a, b) => new Date(a.updatedAt || 0).getTime() - new Date(b.updatedAt || 0).getTime(),
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => ((0, jsx_runtime_1.jsxs)(antd_1.Space, { size: "middle", children: [(0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: "\u7F16\u8F91", children: (0, jsx_runtime_1.jsx)(antd_1.Button, { icon: (0, jsx_runtime_1.jsx)(icons_1.EditOutlined, {}), onClick: () => handleOpenModal('edit', record) }) }, `edit-${record._id}`), (0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: "\u5BFC\u51FA", children: (0, jsx_runtime_1.jsx)(antd_1.Button, { icon: (0, jsx_runtime_1.jsx)(icons_1.DownloadOutlined, {}), onClick: () => handleExport(record._id) }) }, `export-${record._id}`), (0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: "\u5220\u9664", children: (0, jsx_runtime_1.jsx)(antd_1.Popconfirm, { title: "\u786E\u8BA4\u5220\u9664\u8FD9\u4E2A\u672F\u8BED\u5E93?", onConfirm: () => handleDelete(record._id), okText: "\u786E\u8BA4", cancelText: "\u53D6\u6D88", children: (0, jsx_runtime_1.jsx)(antd_1.Button, { danger: true, icon: (0, jsx_runtime_1.jsx)(icons_1.DeleteOutlined, {}) }) }) }, `delete-${record._id}`)] })),
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
            render: (status) => {
                const statusMap = {
                    approved: { color: 'success', text: '已批准' },
                    pending: { color: 'warning', text: '待审核' },
                    rejected: { color: 'error', text: '已拒绝' },
                };
                const { color, text } = statusMap[status] || { color: 'default', text: status };
                return (0, jsx_runtime_1.jsx)(antd_1.Tag, { color: color, children: text });
            },
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => ((0, jsx_runtime_1.jsxs)(antd_1.Space, { size: "middle", children: [(0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: "\u7F16\u8F91", children: (0, jsx_runtime_1.jsx)(antd_1.Button, { icon: (0, jsx_runtime_1.jsx)(icons_1.EditOutlined, {}), onClick: () => handleOpenTermModal('edit', record) }) }), (0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: "\u5220\u9664", children: (0, jsx_runtime_1.jsx)(antd_1.Popconfirm, { title: "\u786E\u8BA4\u5220\u9664\u8FD9\u4E2A\u672F\u8BED?", onConfirm: () => handleDeleteTerm(record.id), okText: "\u786E\u8BA4", cancelText: "\u53D6\u6D88", children: (0, jsx_runtime_1.jsx)(antd_1.Button, { danger: true, icon: (0, jsx_runtime_1.jsx)(icons_1.DeleteOutlined, {}) }) }) })] })),
        },
    ];
    const renderTermBases = () => ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }, children: [(0, jsx_runtime_1.jsx)(Title, { level: 3, children: "\u672F\u8BED\u5E93\u5217\u8868" }), (0, jsx_runtime_1.jsxs)(antd_1.Space, { children: [(0, jsx_runtime_1.jsx)(antd_1.Upload, { name: "file", customRequest: (options) => handleCustomRequest({ ...options, action: `${base_1.axiosInstance.defaults.baseURL}/terms/import` }), accept: ".csv,.xlsx,.json", showUploadList: false, children: (0, jsx_runtime_1.jsx)(antd_1.Button, { icon: (0, jsx_runtime_1.jsx)(icons_1.UploadOutlined, {}), children: "\u5BFC\u5165\u672F\u8BED\u5E93" }) }), (0, jsx_runtime_1.jsx)(antd_1.Button, { type: "primary", icon: (0, jsx_runtime_1.jsx)(icons_1.PlusOutlined, {}), onClick: () => handleOpenModal('create'), children: "\u521B\u5EFA\u672F\u8BED\u5E93" })] })] }), (0, jsx_runtime_1.jsx)("div", { style: { marginBottom: '16px' }, children: (0, jsx_runtime_1.jsx)(Search, { placeholder: "\u641C\u7D22\u672F\u8BED\u5E93", allowClear: true, enterButton: (0, jsx_runtime_1.jsx)(icons_1.SearchOutlined, {}), onSearch: (value) => console.log('Search value:', value), style: { maxWidth: '400px' } }) }), (0, jsx_runtime_1.jsx)(antd_1.Table, { columns: termBaseColumns, dataSource: termBases, loading: loading, rowKey: "_id" })] }));
    const renderTerms = () => ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }, children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(Title, { level: 3, children: "\u672F\u8BED\u5217\u8868" }), selectedTermBase && termBases.find(tb => tb.id === selectedTermBase) && ((0, jsx_runtime_1.jsxs)(Text, { children: ["\u672F\u8BED\u5E93: ", termBases.find(tb => tb.id === selectedTermBase)?.name] }))] }), (0, jsx_runtime_1.jsx)(antd_1.Space, { children: selectedTermBase ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(antd_1.Upload, { name: "file", customRequest: (options) => handleCustomRequest({ ...options, action: `${base_1.axiosInstance.defaults.baseURL}/terms/${selectedTermBase}/import` }), accept: ".csv,.xlsx,.json", showUploadList: false, children: (0, jsx_runtime_1.jsx)(antd_1.Button, { icon: (0, jsx_runtime_1.jsx)(icons_1.UploadOutlined, {}), children: "\u5BFC\u5165\u672F\u8BED" }) }), (0, jsx_runtime_1.jsx)(antd_1.Button, { type: "primary", icon: (0, jsx_runtime_1.jsx)(icons_1.PlusOutlined, {}), onClick: () => handleOpenTermModal('create'), children: "\u6DFB\u52A0\u672F\u8BED" })] })) : ((0, jsx_runtime_1.jsx)(antd_1.Button, { type: "primary", disabled: true, icon: (0, jsx_runtime_1.jsx)(icons_1.PlusOutlined, {}), children: "\u8BF7\u5148\u9009\u62E9\u672F\u8BED\u5E93" })) })] }), !selectedTermBase ? ((0, jsx_runtime_1.jsx)("div", { style: { textAlign: 'center', padding: '40px 0' }, children: (0, jsx_runtime_1.jsx)(Text, { children: "\u8BF7\u4ECE\u672F\u8BED\u5E93\u6807\u7B7E\u9875\u9009\u62E9\u4E00\u4E2A\u672F\u8BED\u5E93" }) })) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("div", { style: { marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }, children: [(0, jsx_runtime_1.jsx)(Search, { placeholder: "\u641C\u7D22\u672F\u8BED", allowClear: true, enterButton: (0, jsx_runtime_1.jsx)(icons_1.SearchOutlined, {}), onSearch: (value) => console.log('Search value:', value), style: { maxWidth: '400px' } }), (0, jsx_runtime_1.jsx)(antd_1.Button, { icon: (0, jsx_runtime_1.jsx)(icons_1.FilterOutlined, {}), children: "\u7B5B\u9009" })] }), (0, jsx_runtime_1.jsx)(antd_1.Table, { columns: termColumns, dataSource: terms, loading: termsLoading, rowKey: "id" })] }))] }));
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(Title, { level: 2, children: "\u672F\u8BED\u7BA1\u7406" }), (0, jsx_runtime_1.jsxs)(antd_1.Tabs, { activeKey: activeTab, onChange: setActiveTab, children: [(0, jsx_runtime_1.jsx)(TabPane, { tab: "\u672F\u8BED\u5E93", children: renderTermBases() }, "termBases"), (0, jsx_runtime_1.jsx)(TabPane, { tab: "\u672F\u8BED", children: renderTerms() }, "terms")] }), (0, jsx_runtime_1.jsx)(antd_1.Modal, { title: modalMode === 'create' ? '创建术语库' : '编辑术语库', open: modalVisible, onCancel: () => setModalVisible(false), footer: null, children: (0, jsx_runtime_1.jsxs)(antd_1.Form, { form: form, layout: "vertical", onFinish: handleSubmit, children: [(0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "name", label: "\u540D\u79F0", rules: [{ required: true, message: '请输入术语库名称' }], children: (0, jsx_runtime_1.jsx)(antd_1.Input, {}) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "description", label: "\u63CF\u8FF0", children: (0, jsx_runtime_1.jsx)(antd_1.Input.TextArea, { rows: 3 }) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "sourceLanguage", label: "\u6E90\u8BED\u8A00", rules: [{ required: true, message: '请选择源语言' }], children: (0, jsx_runtime_1.jsxs)(antd_1.Select, { children: [(0, jsx_runtime_1.jsx)(Option, { value: "zh-CN", children: "\u4E2D\u6587 (\u7B80\u4F53)" }), (0, jsx_runtime_1.jsx)(Option, { value: "en-US", children: "\u82F1\u8BED (\u7F8E\u56FD)" }), (0, jsx_runtime_1.jsx)(Option, { value: "ja-JP", children: "\u65E5\u8BED" }), (0, jsx_runtime_1.jsx)(Option, { value: "ko-KR", children: "\u97E9\u8BED" }), (0, jsx_runtime_1.jsx)(Option, { value: "fr-FR", children: "\u6CD5\u8BED" }), (0, jsx_runtime_1.jsx)(Option, { value: "de-DE", children: "\u5FB7\u8BED" })] }) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "targetLanguages", label: "\u76EE\u6807\u8BED\u8A00", rules: [{ required: true, message: '请选择至少一个目标语言' }], children: (0, jsx_runtime_1.jsxs)(antd_1.Select, { mode: "multiple", children: [(0, jsx_runtime_1.jsx)(Option, { value: "zh-CN", children: "\u4E2D\u6587 (\u7B80\u4F53)" }), (0, jsx_runtime_1.jsx)(Option, { value: "en-US", children: "\u82F1\u8BED (\u7F8E\u56FD)" }), (0, jsx_runtime_1.jsx)(Option, { value: "ja-JP", children: "\u65E5\u8BED" }), (0, jsx_runtime_1.jsx)(Option, { value: "ko-KR", children: "\u97E9\u8BED" }), (0, jsx_runtime_1.jsx)(Option, { value: "fr-FR", children: "\u6CD5\u8BED" }), (0, jsx_runtime_1.jsx)(Option, { value: "de-DE", children: "\u5FB7\u8BED" })] }) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "domain", label: "\u9886\u57DF", children: (0, jsx_runtime_1.jsxs)(antd_1.Select, { children: [(0, jsx_runtime_1.jsx)(Option, { value: "general", children: "\u901A\u7528" }), (0, jsx_runtime_1.jsx)(Option, { value: "technical", children: "\u6280\u672F" }), (0, jsx_runtime_1.jsx)(Option, { value: "legal", children: "\u6CD5\u5F8B" }), (0, jsx_runtime_1.jsx)(Option, { value: "medical", children: "\u533B\u7597" }), (0, jsx_runtime_1.jsx)(Option, { value: "financial", children: "\u91D1\u878D" })] }) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { children: (0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', justifyContent: 'flex-end' }, children: [(0, jsx_runtime_1.jsx)(antd_1.Button, { style: { marginRight: 8 }, onClick: () => setModalVisible(false), children: "\u53D6\u6D88" }), (0, jsx_runtime_1.jsx)(antd_1.Button, { type: "primary", htmlType: "submit", children: "\u4FDD\u5B58" })] }) })] }) }), (0, jsx_runtime_1.jsx)(antd_1.Modal, { title: modalMode === 'create' ? '添加术语' : '编辑术语', open: termModalVisible, onCancel: () => setTermModalVisible(false), footer: null, children: (0, jsx_runtime_1.jsxs)(antd_1.Form, { form: termForm, layout: "vertical", onFinish: handleTermSubmit, children: [(0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "termBaseId", label: "\u672F\u8BED\u5E93", hidden: true, children: (0, jsx_runtime_1.jsx)(antd_1.Input, {}) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "source", label: "\u6E90\u672F\u8BED", rules: [{ required: true, message: '请输入源术语' }], children: (0, jsx_runtime_1.jsx)(antd_1.Input, {}) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "target", label: "\u76EE\u6807\u672F\u8BED", rules: [{ required: true, message: '请输入目标术语' }], children: (0, jsx_runtime_1.jsx)(antd_1.Input, {}) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "definition", label: "\u5B9A\u4E49", children: (0, jsx_runtime_1.jsx)(antd_1.Input.TextArea, { rows: 2 }) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "domain", label: "\u9886\u57DF", children: (0, jsx_runtime_1.jsxs)(antd_1.Select, { children: [(0, jsx_runtime_1.jsx)(Option, { value: "general", children: "\u901A\u7528" }), (0, jsx_runtime_1.jsx)(Option, { value: "technical", children: "\u6280\u672F" }), (0, jsx_runtime_1.jsx)(Option, { value: "legal", children: "\u6CD5\u5F8B" }), (0, jsx_runtime_1.jsx)(Option, { value: "medical", children: "\u533B\u7597" }), (0, jsx_runtime_1.jsx)(Option, { value: "financial", children: "\u91D1\u878D" })] }) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "partOfSpeech", label: "\u8BCD\u6027", children: (0, jsx_runtime_1.jsxs)(antd_1.Select, { children: [(0, jsx_runtime_1.jsx)(Option, { value: "noun", children: "\u540D\u8BCD" }), (0, jsx_runtime_1.jsx)(Option, { value: "verb", children: "\u52A8\u8BCD" }), (0, jsx_runtime_1.jsx)(Option, { value: "adjective", children: "\u5F62\u5BB9\u8BCD" }), (0, jsx_runtime_1.jsx)(Option, { value: "adverb", children: "\u526F\u8BCD" }), (0, jsx_runtime_1.jsx)(Option, { value: "phrase", children: "\u77ED\u8BED" })] }) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "status", label: "\u72B6\u6001", initialValue: "pending", children: (0, jsx_runtime_1.jsxs)(antd_1.Select, { children: [(0, jsx_runtime_1.jsx)(Option, { value: "approved", children: "\u5DF2\u6279\u51C6" }), (0, jsx_runtime_1.jsx)(Option, { value: "pending", children: "\u5F85\u5BA1\u6838" }), (0, jsx_runtime_1.jsx)(Option, { value: "rejected", children: "\u5DF2\u62D2\u7EDD" })] }) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { children: (0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', justifyContent: 'flex-end' }, children: [(0, jsx_runtime_1.jsx)(antd_1.Button, { style: { marginRight: 8 }, onClick: () => setTermModalVisible(false), children: "\u53D6\u6D88" }), (0, jsx_runtime_1.jsx)(antd_1.Button, { type: "primary", htmlType: "submit", children: "\u4FDD\u5B58" })] }) })] }) })] }));
};
exports.default = TerminologyPage;

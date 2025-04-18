"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_router_dom_1 = require("react-router-dom");
const projectService_1 = require("../api/projectService");
const promptTemplateService_1 = require("../api/promptTemplateService");
const userService_1 = require("../api/userService");
const projectConstants_1 = require("../constants/projectConstants");
const CreateProjectPage = () => {
    const navigate = (0, react_router_dom_1.useNavigate)();
    const [name, setName] = (0, react_1.useState)('');
    const [description, setDescription] = (0, react_1.useState)('');
    const [languagePairs, setLanguagePairs] = (0, react_1.useState)([{ source: '', target: '' }]);
    const [deadline, setDeadline] = (0, react_1.useState)('');
    const [priority, setPriority] = (0, react_1.useState)('');
    const [domain, setDomain] = (0, react_1.useState)('');
    const [industry, setIndustry] = (0, react_1.useState)('');
    const [translationTemplates, setTranslationTemplates] = (0, react_1.useState)([]);
    const [reviewTemplates, setReviewTemplates] = (0, react_1.useState)([]);
    const [selectedTransPrompt, setSelectedTransPrompt] = (0, react_1.useState)('');
    const [selectedRevPrompt, setSelectedRevPrompt] = (0, react_1.useState)('');
    const [availableReviewers, setAvailableReviewers] = (0, react_1.useState)([]);
    const [selectedReviewers, setSelectedReviewers] = (0, react_1.useState)([]);
    const [error, setError] = (0, react_1.useState)(null);
    const [isLoadingPage, setIsLoadingPage] = (0, react_1.useState)(true);
    const [isCreating, setIsCreating] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        const fetchData = async () => {
            setIsLoadingPage(true);
            setError(null);
            try {
                const [templateResponse, reviewerResponse] = await Promise.all([
                    (0, promptTemplateService_1.getPromptTemplates)(),
                    (0, userService_1.getReviewers)()
                ]);
                if (templateResponse.success && templateResponse.data?.templates) {
                    const allTemplates = templateResponse.data.templates;
                    setTranslationTemplates(allTemplates.filter(t => t.taskType === 'translation'));
                    setReviewTemplates(allTemplates.filter(t => t.taskType === 'review'));
                }
                else {
                    console.error('Failed to fetch prompt templates:', templateResponse.message);
                    setError((prevError) => (prevError ? prevError + '; ' : '') + '无法加载提示词模板列表');
                }
                if (reviewerResponse.success && reviewerResponse.data?.users) {
                    setAvailableReviewers(reviewerResponse.data.users);
                }
                else {
                    console.error('Failed to fetch reviewers:', reviewerResponse.message);
                    setError((prevError) => (prevError ? prevError + '; ' : '') + '无法加载审校人员列表');
                }
            }
            catch (err) {
                console.error('Error fetching initial data:', err);
                setError('加载页面数据时出错');
            }
            finally {
                setIsLoadingPage(false);
            }
        };
        fetchData();
    }, []);
    const handleAddLanguagePair = () => {
        setLanguagePairs([...languagePairs, { source: '', target: '' }]);
    };
    const handleLanguagePairChange = (index, field, value) => {
        const updatedPairs = [...languagePairs];
        updatedPairs[index][field] = value;
        setLanguagePairs(updatedPairs);
    };
    const handleRemoveLanguagePair = (index) => {
        if (languagePairs.length > 1) {
            const updatedPairs = languagePairs.filter((_, i) => i !== index);
            setLanguagePairs(updatedPairs);
        }
    };
    const handleReviewerChange = (event) => {
        const selectedOptions = Array.from(event.target.selectedOptions, option => option.value);
        setSelectedReviewers(selectedOptions);
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setIsCreating(true);
        if (!name.trim()) {
            setError('项目名称不能为空');
            setIsCreating(false);
            return;
        }
        const validLanguagePairs = languagePairs.filter(pair => pair.source.trim() && pair.target.trim());
        if (validLanguagePairs.length === 0) {
            setError('至少需要一个有效的语言对');
            setIsCreating(false);
            return;
        }
        const payload = {
            name: name.trim(),
            description: description.trim() || undefined,
            languagePairs: validLanguagePairs.map(pair => ({ source: pair.source.trim(), target: pair.target.trim() })),
            deadline: deadline ? `${deadline}T00:00:00.000Z` : undefined,
            priority: priority === '' ? undefined : Number(priority),
            domain: domain.trim() || undefined,
            industry: industry.trim() || undefined,
            defaultTranslationPromptTemplate: selectedTransPrompt || undefined,
            defaultReviewPromptTemplate: selectedRevPrompt || undefined,
            reviewers: selectedReviewers.length > 0 ? selectedReviewers : undefined,
        };
        try {
            const response = await (0, projectService_1.createProject)(payload);
            if (response.success && response.data?.project) {
                console.log('Project created:', response.data.project);
                navigate(`/projects/${response.data.project._id}/files`);
            }
            else {
                setError(response.message || '创建项目失败，未知错误。');
            }
        }
        catch (err) {
            console.error('Create project error:', err);
            let detailedError = '创建项目时发生错误。';
            if (err.response?.data?.details) {
                try {
                    const errorDetails = err.response.data.details;
                    const fieldErrors = Object.entries(errorDetails.fieldErrors || {})
                        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
                        .join('; ');
                    const formErrors = (errorDetails.formErrors || []).join(', ');
                    detailedError = `验证失败: ${formErrors} ${fieldErrors}`.trim();
                }
                catch (e) {
                    detailedError = err.response?.data?.message || err.message || detailedError;
                }
            }
            else {
                detailedError = err.response?.data?.message || err.message || detailedError;
            }
            setError(detailedError);
        }
        finally {
            setIsCreating(false);
        }
    };
    if (isLoadingPage) {
        return ((0, jsx_runtime_1.jsx)("div", { style: {
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '200px',
                color: '#666'
            }, children: (0, jsx_runtime_1.jsx)("div", { children: (0, jsx_runtime_1.jsx)("p", { style: { fontSize: '1.1rem' }, children: "\u6B63\u5728\u52A0\u8F7D\u9875\u9762\u548C\u6A21\u677F..." }) }) }));
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "create-project-page", style: { maxWidth: '900px', margin: '0 auto', padding: '1rem' }, children: [(0, jsx_runtime_1.jsxs)("div", { style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1.5rem',
                    borderBottom: '1px solid #e0e0e0',
                    paddingBottom: '0.75rem'
                }, children: [(0, jsx_runtime_1.jsx)("h1", { style: { margin: 0, color: '#333' }, children: "\u521B\u5EFA\u65B0\u9879\u76EE" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => navigate('/projects'), style: {
                            padding: '0.5rem 1rem',
                            backgroundColor: 'white',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }, children: "\u8FD4\u56DE\u9879\u76EE\u5217\u8868" })] }), error && ((0, jsx_runtime_1.jsx)("div", { style: {
                    padding: '1rem',
                    backgroundColor: '#ffebee',
                    color: '#c62828',
                    borderRadius: '8px',
                    marginBottom: '1.5rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }, children: (0, jsx_runtime_1.jsx)("p", { style: { margin: 0 }, children: error }) })), (0, jsx_runtime_1.jsxs)("form", { onSubmit: handleSubmit, children: [(0, jsx_runtime_1.jsxs)("div", { className: "form-card", style: {
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                            marginBottom: '1.5rem',
                            overflow: 'hidden'
                        }, children: [(0, jsx_runtime_1.jsx)("div", { className: "card-header", style: {
                                    padding: '1rem',
                                    backgroundColor: '#f5f5f5',
                                    borderBottom: '1px solid #eee',
                                    fontWeight: 'bold',
                                    fontSize: '1.1rem',
                                    color: '#333'
                                }, children: "\u57FA\u672C\u4FE1\u606F" }), (0, jsx_runtime_1.jsxs)("div", { className: "card-content", style: { padding: '1.5rem' }, children: [(0, jsx_runtime_1.jsxs)("div", { className: "form-group", style: { marginBottom: '1.25rem' }, children: [(0, jsx_runtime_1.jsxs)("label", { htmlFor: "projectName", style: {
                                                    display: 'block',
                                                    marginBottom: '0.5rem',
                                                    fontWeight: 'bold',
                                                    color: '#333'
                                                }, children: ["\u9879\u76EE\u540D\u79F0: ", (0, jsx_runtime_1.jsx)("span", { style: { color: '#e53935' }, children: "*" })] }), (0, jsx_runtime_1.jsx)("input", { type: "text", id: "projectName", value: name, onChange: (e) => setName(e.target.value), required: true, disabled: isCreating, placeholder: "\u8F93\u5165\u9879\u76EE\u540D\u79F0", style: {
                                                    width: '100%',
                                                    padding: '0.75rem',
                                                    borderRadius: '4px',
                                                    border: '1px solid #ccc',
                                                    fontSize: '1rem'
                                                } })] }), (0, jsx_runtime_1.jsxs)("div", { className: "form-group", style: { marginBottom: '1.25rem' }, children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "projectDescription", style: {
                                                    display: 'block',
                                                    marginBottom: '0.5rem',
                                                    fontWeight: 'bold',
                                                    color: '#333'
                                                }, children: "\u63CF\u8FF0 (\u53EF\u9009):" }), (0, jsx_runtime_1.jsx)("textarea", { id: "projectDescription", value: description, onChange: (e) => setDescription(e.target.value), disabled: isCreating, rows: 3, placeholder: "\u8F93\u5165\u9879\u76EE\u63CF\u8FF0", style: {
                                                    width: '100%',
                                                    padding: '0.75rem',
                                                    borderRadius: '4px',
                                                    border: '1px solid #ccc',
                                                    fontSize: '1rem',
                                                    resize: 'vertical',
                                                    minHeight: '100px'
                                                } })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "form-card", style: {
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                            marginBottom: '1.5rem',
                            overflow: 'hidden'
                        }, children: [(0, jsx_runtime_1.jsxs)("div", { className: "card-header", style: {
                                    padding: '1rem',
                                    backgroundColor: '#f5f5f5',
                                    borderBottom: '1px solid #eee',
                                    fontWeight: 'bold',
                                    fontSize: '1.1rem',
                                    color: '#333'
                                }, children: ["\u8BED\u8A00\u5BF9\u8BBE\u7F6E ", (0, jsx_runtime_1.jsx)("span", { style: { color: '#e53935' }, children: "*" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "card-content", style: { padding: '1.5rem' }, children: [languagePairs.map((pair, index) => ((0, jsx_runtime_1.jsxs)("div", { style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            marginBottom: '1rem',
                                            flexWrap: 'wrap',
                                            gap: '0.5rem'
                                        }, children: [(0, jsx_runtime_1.jsxs)("select", { value: pair.source, onChange: (e) => handleLanguagePairChange(index, 'source', e.target.value), required: true, disabled: isCreating, style: {
                                                    flex: '1',
                                                    minWidth: '180px',
                                                    padding: '0.75rem',
                                                    borderRadius: '4px',
                                                    border: '1px solid #ccc',
                                                    fontSize: '1rem'
                                                }, children: [(0, jsx_runtime_1.jsx)("option", { value: "", disabled: true, children: "\u9009\u62E9\u6E90\u8BED\u8A00" }), projectConstants_1.LANGUAGES.map(lang => ((0, jsx_runtime_1.jsx)("option", { value: lang.code, children: lang.name }, lang.code)))] }), (0, jsx_runtime_1.jsx)("span", { style: {
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    width: '40px',
                                                    color: '#666'
                                                }, children: (0, jsx_runtime_1.jsx)("svg", { width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", xmlns: "http://www.w3.org/2000/svg", children: (0, jsx_runtime_1.jsx)("path", { d: "M5 12H19M19 12L13 6M19 12L13 18", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }) }) }), (0, jsx_runtime_1.jsxs)("select", { value: pair.target, onChange: (e) => handleLanguagePairChange(index, 'target', e.target.value), required: true, disabled: isCreating, style: {
                                                    flex: '1',
                                                    minWidth: '180px',
                                                    padding: '0.75rem',
                                                    borderRadius: '4px',
                                                    border: '1px solid #ccc',
                                                    fontSize: '1rem'
                                                }, children: [(0, jsx_runtime_1.jsx)("option", { value: "", disabled: true, children: "\u9009\u62E9\u76EE\u6807\u8BED\u8A00" }), projectConstants_1.LANGUAGES.map(lang => ((0, jsx_runtime_1.jsx)("option", { value: lang.code, children: lang.name }, lang.code)))] }), languagePairs.length > 1 && ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleRemoveLanguagePair(index), disabled: isCreating, style: {
                                                    padding: '0.75rem',
                                                    backgroundColor: '#ffebee',
                                                    color: '#c62828',
                                                    border: '1px solid #ef9a9a',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }, children: "\u79FB\u9664" }))] }, index))), (0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: handleAddLanguagePair, disabled: isCreating, style: {
                                            padding: '0.75rem 1.25rem',
                                            backgroundColor: '#e3f2fd',
                                            color: '#1976d2',
                                            border: '1px solid #bbdefb',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            marginTop: '0.5rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem'
                                        }, children: [(0, jsx_runtime_1.jsx)("span", { style: { fontSize: '1.2rem', lineHeight: 1 }, children: "+" }), " \u6DFB\u52A0\u8BED\u8A00\u5BF9"] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "form-card", style: {
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                            marginBottom: '1.5rem',
                            overflow: 'hidden'
                        }, children: [(0, jsx_runtime_1.jsx)("div", { className: "card-header", style: {
                                    padding: '1rem',
                                    backgroundColor: '#f5f5f5',
                                    borderBottom: '1px solid #eee',
                                    fontWeight: 'bold',
                                    fontSize: '1.1rem',
                                    color: '#333'
                                }, children: "\u9879\u76EE\u5C5E\u6027\u8BBE\u7F6E" }), (0, jsx_runtime_1.jsx)("div", { className: "card-content", style: { padding: '1.5rem' }, children: (0, jsx_runtime_1.jsxs)("div", { style: {
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                                        gap: '1.5rem'
                                    }, children: [(0, jsx_runtime_1.jsxs)("div", { className: "form-group", children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "projectDeadline", style: {
                                                        display: 'block',
                                                        marginBottom: '0.5rem',
                                                        fontWeight: 'bold',
                                                        color: '#333'
                                                    }, children: "\u622A\u6B62\u65E5\u671F (\u53EF\u9009):" }), (0, jsx_runtime_1.jsx)("input", { type: "date", id: "projectDeadline", value: deadline, onChange: (e) => setDeadline(e.target.value), disabled: isCreating, style: {
                                                        width: '100%',
                                                        padding: '0.75rem',
                                                        borderRadius: '4px',
                                                        border: '1px solid #ccc',
                                                        fontSize: '1rem'
                                                    } })] }), (0, jsx_runtime_1.jsxs)("div", { className: "form-group", children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "projectPriority", style: {
                                                        display: 'block',
                                                        marginBottom: '0.5rem',
                                                        fontWeight: 'bold',
                                                        color: '#333'
                                                    }, children: "\u4F18\u5148\u7EA7 (\u53EF\u9009):" }), (0, jsx_runtime_1.jsxs)("select", { id: "projectPriority", value: priority, onChange: (e) => setPriority(e.target.value === '' ? '' : parseInt(e.target.value, 10)), disabled: isCreating, style: {
                                                        width: '100%',
                                                        padding: '0.75rem',
                                                        borderRadius: '4px',
                                                        border: '1px solid #ccc',
                                                        fontSize: '1rem'
                                                    }, children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "\u9009\u62E9\u4F18\u5148\u7EA7" }), projectConstants_1.PRIORITIES.map(p => ((0, jsx_runtime_1.jsxs)("option", { value: p.value, children: [p.label, " (", p.value, ")"] }, p.value)))] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "form-group", children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "projectDomain", style: {
                                                        display: 'block',
                                                        marginBottom: '0.5rem',
                                                        fontWeight: 'bold',
                                                        color: '#333'
                                                    }, children: "\u9886\u57DF (\u53EF\u9009):" }), (0, jsx_runtime_1.jsxs)("select", { id: "projectDomain", value: domain, onChange: (e) => setDomain(e.target.value), disabled: isCreating, style: {
                                                        width: '100%',
                                                        padding: '0.75rem',
                                                        borderRadius: '4px',
                                                        border: '1px solid #ccc',
                                                        fontSize: '1rem'
                                                    }, children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "\u9009\u62E9\u9886\u57DF" }), projectConstants_1.DOMAINS.map(d => ((0, jsx_runtime_1.jsx)("option", { value: d, children: d }, d)))] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "form-group", children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "projectIndustry", style: {
                                                        display: 'block',
                                                        marginBottom: '0.5rem',
                                                        fontWeight: 'bold',
                                                        color: '#333'
                                                    }, children: "\u884C\u4E1A (\u53EF\u9009):" }), (0, jsx_runtime_1.jsxs)("select", { id: "projectIndustry", value: industry, onChange: (e) => setIndustry(e.target.value), disabled: isCreating, style: {
                                                        width: '100%',
                                                        padding: '0.75rem',
                                                        borderRadius: '4px',
                                                        border: '1px solid #ccc',
                                                        fontSize: '1rem'
                                                    }, children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "\u9009\u62E9\u884C\u4E1A" }), projectConstants_1.INDUSTRIES.map(i => ((0, jsx_runtime_1.jsx)("option", { value: i, children: i }, i)))] })] })] }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "form-card", style: {
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                            marginBottom: '1.5rem',
                            overflow: 'hidden'
                        }, children: [(0, jsx_runtime_1.jsx)("div", { className: "card-header", style: {
                                    padding: '1rem',
                                    backgroundColor: '#f5f5f5',
                                    borderBottom: '1px solid #eee',
                                    fontWeight: 'bold',
                                    fontSize: '1.1rem',
                                    color: '#333'
                                }, children: "\u63D0\u793A\u8BCD\u6A21\u677F\u8BBE\u7F6E" }), (0, jsx_runtime_1.jsx)("div", { className: "card-content", style: { padding: '1.5rem' }, children: (0, jsx_runtime_1.jsxs)("div", { style: {
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                                        gap: '1.5rem'
                                    }, children: [(0, jsx_runtime_1.jsxs)("div", { className: "form-group", children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "translationPrompt", style: {
                                                        display: 'block',
                                                        marginBottom: '0.5rem',
                                                        fontWeight: 'bold',
                                                        color: '#333'
                                                    }, children: "\u7FFB\u8BD1\u63D0\u793A\u8BCD (\u53EF\u9009):" }), (0, jsx_runtime_1.jsxs)("select", { id: "translationPrompt", value: selectedTransPrompt, onChange: (e) => setSelectedTransPrompt(e.target.value), disabled: isCreating || translationTemplates.length === 0, style: {
                                                        width: '100%',
                                                        padding: '0.75rem',
                                                        borderRadius: '4px',
                                                        border: '1px solid #ccc',
                                                        fontSize: '1rem'
                                                    }, children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "\u9009\u62E9\u7FFB\u8BD1\u63D0\u793A\u8BCD\u6A21\u677F" }), translationTemplates.map(t => ((0, jsx_runtime_1.jsx)("option", { value: t._id, children: t.name }, t._id)))] }), translationTemplates.length === 0 && ((0, jsx_runtime_1.jsx)("p", { style: { color: '#f57c00', margin: '0.5rem 0 0', fontSize: '0.9rem' }, children: "\u672A\u627E\u5230\u7FFB\u8BD1\u63D0\u793A\u8BCD\u6A21\u677F" }))] }), (0, jsx_runtime_1.jsxs)("div", { className: "form-group", children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "reviewPrompt", style: {
                                                        display: 'block',
                                                        marginBottom: '0.5rem',
                                                        fontWeight: 'bold',
                                                        color: '#333'
                                                    }, children: "\u5BA1\u6821\u63D0\u793A\u8BCD (\u53EF\u9009):" }), (0, jsx_runtime_1.jsxs)("select", { id: "reviewPrompt", value: selectedRevPrompt, onChange: (e) => setSelectedRevPrompt(e.target.value), disabled: isCreating || reviewTemplates.length === 0, style: {
                                                        width: '100%',
                                                        padding: '0.75rem',
                                                        borderRadius: '4px',
                                                        border: '1px solid #ccc',
                                                        fontSize: '1rem'
                                                    }, children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "\u9009\u62E9\u5BA1\u6821\u63D0\u793A\u8BCD\u6A21\u677F" }), reviewTemplates.map(t => ((0, jsx_runtime_1.jsx)("option", { value: t._id, children: t.name }, t._id)))] }), reviewTemplates.length === 0 && ((0, jsx_runtime_1.jsx)("p", { style: { color: '#f57c00', margin: '0.5rem 0 0', fontSize: '0.9rem' }, children: "\u672A\u627E\u5230\u5BA1\u6821\u63D0\u793A\u8BCD\u6A21\u677F" }))] })] }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "form-card", style: {
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                            marginBottom: '2rem',
                            overflow: 'hidden'
                        }, children: [(0, jsx_runtime_1.jsx)("div", { className: "card-header", style: {
                                    padding: '1rem',
                                    backgroundColor: '#f5f5f5',
                                    borderBottom: '1px solid #eee',
                                    fontWeight: 'bold',
                                    fontSize: '1.1rem',
                                    color: '#333'
                                }, children: "\u56E2\u961F\u8BBE\u7F6E" }), (0, jsx_runtime_1.jsx)("div", { className: "card-content", style: { padding: '1.5rem' }, children: (0, jsx_runtime_1.jsxs)("div", { className: "form-group", children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "reviewers", style: {
                                                display: 'block',
                                                marginBottom: '0.5rem',
                                                fontWeight: 'bold',
                                                color: '#333'
                                            }, children: "\u5BA1\u6821\u4EBA\u5458 (\u53EF\u9009):" }), (0, jsx_runtime_1.jsx)("select", { id: "reviewers", multiple: true, value: selectedReviewers, onChange: handleReviewerChange, disabled: isCreating || availableReviewers.length === 0, style: {
                                                width: '100%',
                                                padding: '0.75rem',
                                                borderRadius: '4px',
                                                border: '1px solid #ccc',
                                                fontSize: '1rem',
                                                minHeight: '120px'
                                            }, children: availableReviewers.map(reviewer => ((0, jsx_runtime_1.jsxs)("option", { value: reviewer._id, children: [reviewer.username, " (", reviewer.email, ")"] }, reviewer._id))) }), availableReviewers.length === 0 && ((0, jsx_runtime_1.jsx)("p", { style: { color: '#f57c00', margin: '0.5rem 0 0', fontSize: '0.9rem' }, children: "\u672A\u627E\u5230\u53EF\u7528\u7684\u5BA1\u6821\u4EBA\u5458" })), availableReviewers.length > 0 && ((0, jsx_runtime_1.jsx)("p", { style: { color: '#666', margin: '0.5rem 0 0', fontSize: '0.9rem' }, children: "\u6309\u4F4F Ctrl \u952E (Mac \u4E0A\u4E3A Command \u952E) \u53EF\u9009\u62E9\u591A\u4E2A\u5BA1\u6821\u4EBA\u5458" }))] }) })] }), (0, jsx_runtime_1.jsxs)("div", { style: {
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginTop: '1.5rem',
                            marginBottom: '2rem'
                        }, children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => navigate('/projects'), disabled: isCreating, style: {
                                    padding: '0.75rem 1.5rem',
                                    backgroundColor: 'white',
                                    color: '#555',
                                    border: '1px solid #ccc',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '1rem',
                                    fontWeight: 'bold'
                                }, children: "\u53D6\u6D88" }), (0, jsx_runtime_1.jsx)("button", { type: "submit", disabled: isCreating, style: {
                                    padding: '0.75rem 1.5rem',
                                    backgroundColor: '#1976d2',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '1rem',
                                    fontWeight: 'bold',
                                    minWidth: '120px'
                                }, children: isCreating ? '创建中...' : '创建项目' })] })] })] }));
};
exports.default = CreateProjectPage;

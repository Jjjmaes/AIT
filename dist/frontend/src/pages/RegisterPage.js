"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const antd_1 = require("antd");
const icons_1 = require("@ant-design/icons");
const react_router_dom_1 = require("react-router-dom");
const base_1 = require("../api/base");
const { Title } = antd_1.Typography;
const RegisterPage = () => {
    const [form] = antd_1.Form.useForm();
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const navigate = (0, react_router_dom_1.useNavigate)();
    const handleSubmit = async (values) => {
        setError(null);
        if (values.password !== values.confirmPassword) {
            setError('两次输入的密码不一致');
            return;
        }
        setLoading(true);
        try {
            // Replace with actual API call
            const response = await base_1.axiosInstance.post('/auth/register', {
                name: values.name,
                email: values.email,
                password: values.password,
            });
            if (response.data?.success || response.status === 201) {
                antd_1.message.success('注册成功！请登录。');
                navigate('/login');
            }
            else {
                throw new Error(response.data?.message || '注册失败');
            }
        }
        catch (err) {
            const errorMsg = err.response?.data?.message || err.message || '注册过程中发生错误';
            setError(errorMsg);
            console.error('Registration error:', err);
        }
        finally {
            setLoading(false);
        }
    };
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(Title, { level: 4, style: { textAlign: 'center', marginBottom: 24 }, children: "\u521B\u5EFA\u65B0\u8D26\u6237" }), error && ((0, jsx_runtime_1.jsx)(antd_1.Alert, { message: error, type: "error", showIcon: true, style: { marginBottom: 16 }, closable: true, onClose: () => setError(null) })), (0, jsx_runtime_1.jsxs)(antd_1.Form, { form: form, name: "register", onFinish: handleSubmit, layout: "vertical", requiredMark: false, children: [(0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "name", rules: [{ required: true, message: '请输入您的姓名' }], children: (0, jsx_runtime_1.jsx)(antd_1.Input, { prefix: (0, jsx_runtime_1.jsx)(icons_1.UserOutlined, {}), placeholder: "\u59D3\u540D", size: "large" }) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "email", rules: [
                            { required: true, message: '请输入邮箱地址' },
                            { type: 'email', message: '请输入有效的邮箱地址' }
                        ], children: (0, jsx_runtime_1.jsx)(antd_1.Input, { prefix: (0, jsx_runtime_1.jsx)(icons_1.MailOutlined, {}), placeholder: "\u90AE\u7BB1\u5730\u5740", size: "large" }) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "password", rules: [
                            { required: true, message: '请输入密码' },
                            { min: 6, message: '密码至少需要6位' }
                        ], hasFeedback // Shows validation status icon
                        : true, children: (0, jsx_runtime_1.jsx)(antd_1.Input.Password, { prefix: (0, jsx_runtime_1.jsx)(icons_1.LockOutlined, {}), placeholder: "\u5BC6\u7801 (\u81F3\u5C116\u4F4D)", size: "large" }) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "confirmPassword", dependencies: ['password'], rules: [
                            { required: true, message: '请确认密码' },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    if (!value || getFieldValue('password') === value) {
                                        return Promise.resolve();
                                    }
                                    return Promise.reject(new Error('两次输入的密码不一致'));
                                },
                            }),
                        ], hasFeedback: true, children: (0, jsx_runtime_1.jsx)(antd_1.Input.Password, { prefix: (0, jsx_runtime_1.jsx)(icons_1.LockOutlined, {}), placeholder: "\u786E\u8BA4\u5BC6\u7801", size: "large" }) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { children: (0, jsx_runtime_1.jsx)(antd_1.Button, { type: "primary", htmlType: "submit", size: "large", loading: loading, block: true, children: "\u6CE8\u518C" }) }), (0, jsx_runtime_1.jsxs)(antd_1.Form.Item, { style: { textAlign: 'center', marginBottom: 0 }, children: ["\u5DF2\u6709\u8D26\u6237? ", (0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: "/login", children: "\u7ACB\u5373\u767B\u5F55" })] })] })] }));
};
exports.default = RegisterPage;

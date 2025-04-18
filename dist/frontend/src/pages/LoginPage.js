"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const antd_1 = require("antd");
const icons_1 = require("@ant-design/icons");
const AuthContext_1 = require("../context/AuthContext");
const { Title } = antd_1.Typography;
const LoginPage = () => {
    const { login, error, loading } = (0, AuthContext_1.useAuth)();
    const [form] = antd_1.Form.useForm();
    const [localError, setLocalError] = (0, react_1.useState)(null);
    const handleSubmit = async (values) => {
        // // Check might not be necessary anymore, but keep for safety?
        // if (!values.email && !values.password) {
        //   // console.log('[LoginPage] handleSubmit called with empty values, skipping.');
        //   return;
        // }
        // console.log('[LoginPage] handleSubmit executing with:', values);
        setLocalError(null);
        try {
            await login(values.email, values.password);
        }
        catch (err) {
            // Error is already set in auth context
            // console.log('[LoginPage] Login failed, error should be set in context.');
        }
    };
    // Simplified handler for the button click
    const handleButtonClick = () => {
        form.validateFields()
            .then(values => {
            // console.log('[LoginPage] Manual validation success, calling handleSubmit.');
            handleSubmit(values);
        })
            .catch(info => {
            // console.log('[LoginPage] Manual validation failed:', info);
            // Optionally handle validation failure feedback here if needed
        });
    };
    // console.log(`[LoginPage] Rendering - Loading: ${loading}, Error: ${error}`);
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(Title, { level: 4, style: { textAlign: 'center', marginBottom: 24 }, children: "\u7528\u6237\u767B\u5F55" }), (error || localError) && ((0, jsx_runtime_1.jsx)(antd_1.Alert, { message: error || localError, type: "error", showIcon: true, style: { marginBottom: 16 } })), (0, jsx_runtime_1.jsxs)(antd_1.Form, { form: form, name: "login", 
                // onFinish={handleSubmit} // REMOVED onFinish
                layout: "vertical", requiredMark: false, autoComplete: "off", children: [(0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "email", rules: [
                            { required: true, message: '请输入邮箱地址' },
                            { type: 'email', message: '请输入有效的邮箱地址' }
                        ], children: (0, jsx_runtime_1.jsx)(antd_1.Input, { prefix: (0, jsx_runtime_1.jsx)(icons_1.UserOutlined, {}), placeholder: "\u90AE\u7BB1\u5730\u5740", size: "large", autoComplete: "off" }) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "password", rules: [{ required: true, message: '请输入密码' }], children: (0, jsx_runtime_1.jsx)(antd_1.Input.Password, { prefix: (0, jsx_runtime_1.jsx)(icons_1.LockOutlined, {}), placeholder: "\u5BC6\u7801", size: "large", autoComplete: "new-password" }) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { children: (0, jsx_runtime_1.jsx)(antd_1.Button, { type: "primary", 
                            // htmlType="submit" // REMOVED htmlType
                            onClick: handleButtonClick, size: "large", loading: loading, block: true, children: "\u767B\u5F55" }) })] })] }));
};
exports.default = LoginPage;

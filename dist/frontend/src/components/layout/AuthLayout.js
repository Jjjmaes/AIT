"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_router_dom_1 = require("react-router-dom");
const antd_1 = require("antd");
const AuthContext_1 = require("../../context/AuthContext");
const { Title } = antd_1.Typography;
const { Content } = antd_1.Layout;
const AuthLayout = () => {
    const { user, loading } = (0, AuthContext_1.useAuth)();
    const navigate = (0, react_router_dom_1.useNavigate)();
    (0, react_1.useEffect)(() => {
        if (!loading && user) {
            navigate('/dashboard');
        }
    }, [user, loading, navigate]);
    return ((0, jsx_runtime_1.jsx)(antd_1.Layout, { style: { minHeight: '100vh', background: '#f0f2f5' }, children: (0, jsx_runtime_1.jsx)(Content, { style: {
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '50px 20px'
            }, children: (0, jsx_runtime_1.jsxs)(antd_1.Space, { direction: "vertical", size: "large", style: { width: '100%', maxWidth: 400 }, children: [(0, jsx_runtime_1.jsx)("div", { style: { textAlign: 'center' }, children: (0, jsx_runtime_1.jsx)(Title, { level: 2, children: "AI\u8F85\u52A9\u7FFB\u8BD1\u5BA1\u6821\u5E73\u53F0" }) }), (0, jsx_runtime_1.jsx)(antd_1.Card, { variant: "borderless", style: { width: '100%', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }, children: (0, jsx_runtime_1.jsx)(react_router_dom_1.Outlet, {}) })] }) }) }));
};
exports.default = AuthLayout;

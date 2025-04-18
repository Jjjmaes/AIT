"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_router_dom_1 = require("react-router-dom");
const AuthContext_1 = require("../../context/AuthContext");
const antd_1 = require("antd");
const AdminRoute = ({ children }) => {
    const { user, loading, isAdmin } = (0, AuthContext_1.useAuth)();
    if (loading) {
        return ((0, jsx_runtime_1.jsx)("div", { style: {
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh'
            }, children: (0, jsx_runtime_1.jsx)(antd_1.Spin, { size: "large", tip: "\u52A0\u8F7D\u4E2D..." }) }));
    }
    if (!user) {
        return (0, jsx_runtime_1.jsx)(react_router_dom_1.Navigate, { to: "/login", replace: true });
    }
    if (!isAdmin) {
        return ((0, jsx_runtime_1.jsx)(antd_1.Result, { status: "403", title: "\u65E0\u6743\u9650", subTitle: "\u62B1\u6B49\uFF0C\u60A8\u6CA1\u6709\u8BBF\u95EE\u8BE5\u9875\u9762\u7684\u6743\u9650", extra: (0, jsx_runtime_1.jsx)(react_router_dom_1.Navigate, { to: "/dashboard", replace: true }) }));
    }
    return children ? (0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: children }) : (0, jsx_runtime_1.jsx)(react_router_dom_1.Outlet, {});
};
exports.default = AdminRoute;

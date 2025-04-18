"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_router_dom_1 = require("react-router-dom");
const AuthContext_1 = require("../../context/AuthContext");
const antd_1 = require("antd");
const PrivateRoute = ({ children }) => {
    const { user, loading } = (0, AuthContext_1.useAuth)();
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
    return children ? (0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: children }) : (0, jsx_runtime_1.jsx)(react_router_dom_1.Outlet, {});
};
exports.default = PrivateRoute;

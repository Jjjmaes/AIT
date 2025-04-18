"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_router_dom_1 = require("react-router-dom");
const authService_1 = require("../api/authService");
const ProtectedRoute = () => {
    console.log("--- Entering ProtectedRoute --- Location:", (0, react_router_dom_1.useLocation)().pathname);
    const location = (0, react_router_dom_1.useLocation)();
    const isAuth = (0, authService_1.isAuthenticated)();
    console.log("--- ProtectedRoute Check --- isAuth:", isAuth);
    if (!isAuth) {
        console.log("--- ProtectedRoute: Redirecting to /login ---");
        return (0, jsx_runtime_1.jsx)(react_router_dom_1.Navigate, { to: "/login", state: { from: location }, replace: true });
    }
    console.log("--- ProtectedRoute: Rendering Outlet --- Now rendering child component...");
    // If authenticated, render the child route element
    return (0, jsx_runtime_1.jsx)(react_router_dom_1.Outlet, {});
};
exports.default = ProtectedRoute;

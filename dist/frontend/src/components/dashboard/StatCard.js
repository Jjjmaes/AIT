"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const antd_1 = require("antd");
const icons_1 = require("@ant-design/icons");
const { Text } = antd_1.Typography;
const StatCard = ({ title, value, suffix, prefix, tooltip, color, loading = false, icon, onClick, }) => {
    return ((0, jsx_runtime_1.jsxs)(antd_1.Card, { hoverable: !!onClick, onClick: onClick, style: {
            cursor: onClick ? 'pointer' : 'default',
            height: '100%'
        }, bodyStyle: {
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '100%',
            padding: '16px',
        }, children: [(0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }, children: [(0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', alignItems: 'center' }, children: [(0, jsx_runtime_1.jsx)(Text, { strong: true, children: title }), tooltip && ((0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: tooltip, children: (0, jsx_runtime_1.jsx)(icons_1.QuestionCircleOutlined, { style: { marginLeft: 4, color: '#8c8c8c' } }) }))] }), icon && (0, jsx_runtime_1.jsx)("div", { children: icon })] }), (0, jsx_runtime_1.jsx)(antd_1.Statistic, { value: value, suffix: suffix, prefix: prefix, valueStyle: { color }, loading: loading })] }));
};
exports.default = StatCard;

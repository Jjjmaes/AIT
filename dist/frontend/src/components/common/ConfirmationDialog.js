"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const material_1 = require("@mui/material");
const ConfirmationDialog = ({ open, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', loading = false, }) => {
    return ((0, jsx_runtime_1.jsxs)(material_1.Dialog, { open: open, onClose: onClose, "aria-labelledby": "confirmation-dialog-title", "aria-describedby": "confirmation-dialog-description", children: [(0, jsx_runtime_1.jsx)(material_1.DialogTitle, { id: "confirmation-dialog-title", children: title }), (0, jsx_runtime_1.jsx)(material_1.DialogContent, { children: (0, jsx_runtime_1.jsx)(material_1.DialogContentText, { id: "confirmation-dialog-description", children: message }) }), (0, jsx_runtime_1.jsxs)(material_1.DialogActions, { sx: { p: '16px 24px' }, children: [(0, jsx_runtime_1.jsx)(material_1.Button, { onClick: onClose, disabled: loading, color: "inherit", children: cancelText }), (0, jsx_runtime_1.jsx)(material_1.Button, { onClick: onConfirm, disabled: loading, color: "error", variant: "contained", autoFocus: true, children: loading ? (0, jsx_runtime_1.jsx)(material_1.CircularProgress, { size: 24, color: "inherit" }) : confirmText })] })] }));
};
exports.default = ConfirmationDialog;

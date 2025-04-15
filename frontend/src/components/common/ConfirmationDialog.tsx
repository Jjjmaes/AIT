import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Button,
    CircularProgress
} from '@mui/material';

interface ConfirmationDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string | React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    loading?: boolean; // Optional loading state for the confirm button
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
    open,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    loading = false,
}) => {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            aria-labelledby="confirmation-dialog-title"
            aria-describedby="confirmation-dialog-description"
        >
            <DialogTitle id="confirmation-dialog-title">{title}</DialogTitle>
            <DialogContent>
                <DialogContentText id="confirmation-dialog-description">
                    {message}
                </DialogContentText>
            </DialogContent>
            <DialogActions sx={{ p: '16px 24px' }}>
                <Button onClick={onClose} disabled={loading} color="inherit">
                    {cancelText}
                </Button>
                <Button onClick={onConfirm} disabled={loading} color="error" variant="contained" autoFocus>
                    {loading ? <CircularProgress size={24} color="inherit" /> : confirmText}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ConfirmationDialog; 
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import color from '../../constant/color.json';

import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';

export default function BaseDialog({
  open,
  onClose,
  title,
  children,
  severity,
  actions,
  maxWidth = 'sm',
  fullWidth = true,
}) {
  // mapping severity
  const severityConfig = {
    info: {
      color: color.primary,
      icon: <InfoIcon fontSize="large" />,
    },
    success: {
      color: color.green,
      icon: <CheckCircleIcon fontSize="large" />,
    },
    warning: {
      color: color.warning,
      icon: <WarningAmberIcon fontSize="large" />,
    },
    error: {
      color: color.danger,
      icon: <ErrorOutlineIcon fontSize="large" />,
    },
  };

  const config = severity ? severityConfig[severity] : null;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
    >
      {/* HEADER */}
      <DialogTitle
        sx={{
          m: 0,
          p: 2,
          bgcolor: color.primary,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <InfoIcon fontSize="large" />
        <Typography variant="h6" sx={{ color: 'white' }}>
          {title}
        </Typography>
      </DialogTitle>

      {/* CONTENT */}
      <DialogContent dividers>
        <Box display="flex" alignItems="center" gap={2} flexDirection="column">
          {config && (
            <Box sx={{ color: config.color, fontSize: 50 }}>{config.icon}</Box>
          )}
          <Box textAlign="center">
            {typeof children === 'string' ? (
              <Typography>{children}</Typography>
            ) : (
              children
            )}
          </Box>
        </Box>
      </DialogContent>

      {/* ACTIONS */}
      {actions && <DialogActions>{actions}</DialogActions>}
    </Dialog>
  );
}

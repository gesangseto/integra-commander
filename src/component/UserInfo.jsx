import LogoutIcon from '@mui/icons-material/LogoutOutlined';

import {
  Box,
  Button,
  Dialog,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useState } from 'react';
import {
  useAuthStore,
  useAuthStorePanelA,
  useAuthStorePanelB,
} from '../store/authStore';
import { useConfirm } from './ConfirmProvider';
import BaseDialog from './atom/BaseDialog';

const BootstrapDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialogContent-root': {
    padding: theme.spacing(2),
  },
  '& .MuiDialogActions-root': {
    padding: theme.spacing(1),
  },
}));

export default function UserInfo({ open, onClose, panel }) {
  const [tabActive, setTabActive] = useState(0);
  const { confirm: showConfirm } = useConfirm();
  const userInfo =
    panel == 'a'
      ? useAuthStorePanelA((state) => state.user)
      : panel == 'b'
        ? useAuthStorePanelB((state) => state.user)
        : useAuthStore((state) => state.user);

  const logout =
    panel == 'a'
      ? useAuthStorePanelA((state) => state.logout)
      : panel == 'b'
        ? useAuthStorePanelB((state) => state.logout)
        : useAuthStore((state) => state.logout);

  const handleTabChange = (event, newValue) => {
    setTabActive(newValue);
  };

  const UserInformation = () => {
    return (
      <Box flex={1} m={1}>
        <Box display="flex" alignItems="center" m={1}>
          <Typography sx={{ width: 300 }}>Username</Typography>
          <TextField
            size="small"
            fullWidth
            value={userInfo.username}
            disabled
          />
        </Box>
        <Box display="flex" alignItems="center" m={1}>
          <Typography sx={{ width: 300 }}>Email</Typography>
          <TextField size="small" fullWidth value={userInfo.email} disabled />
        </Box>
        <Box display="flex" alignItems="center" m={1}>
          <Typography sx={{ width: 300 }}>Full Name</Typography>
          <TextField
            size="small"
            fullWidth
            value={userInfo.full_name}
            disabled
          />
        </Box>
        <Box display="flex" alignItems="center" m={1}>
          <Typography sx={{ width: 300 }}>Department</Typography>
          <TextField
            size="small"
            fullWidth
            value={userInfo.department_name}
            disabled
          />
        </Box>
        <Box display="flex" alignItems="center" m={1}>
          <Typography sx={{ width: 300 }}>Section</Typography>
          <TextField
            size="small"
            fullWidth
            value={userInfo.section_name}
            disabled
          />
        </Box>
      </Box>
    );
  };
  const ChangePassword = () => {
    return (
      <Box flex={1} m={1}>
        <Box display="flex" alignItems="center" m={1}>
          <Typography sx={{ width: 300 }}>Current Password</Typography>
          <TextField size="small" fullWidth label="Current Password" />
        </Box>
        <Box display="flex" alignItems="center" m={1}>
          <Typography sx={{ width: 300 }}>New Password</Typography>
          <TextField size="small" fullWidth label="New Password" />
        </Box>
        <Box display="flex" alignItems="center" m={1}>
          <Typography sx={{ width: 300 }}>Confirm New Password</Typography>
          <TextField size="small" fullWidth label="Confirm New Password" />
        </Box>
      </Box>
    );
  };
  return (
    <BootstrapDialog
      onClose={onClose}
      aria-labelledby="customized-dialog-title"
      open={open}
      fullWidth
      maxWidth="sm" // xs | sm | md | lg | xl
    >
      <BaseDialog
        open={open}
        onClose={onClose}
        title={'User Information'}
        actions={
          tabActive == 0 ? (
            <Button
              variant="contained"
              color="error"
              startIcon={<LogoutIcon />}
              onClick={async () => {
                const ok = await showConfirm({
                  title: 'User Logout Confirmation',
                  message: 'Anda akan logout. Lanjutkan?',
                  severity: 'warning',
                });
                if (ok) {
                  logout();
                  onClose();
                }
              }}
            >
              Logout
            </Button>
          ) : (
            <Button autoFocus onClick={onClose}>
              Save Changes
            </Button>
          )
        }
      >
        {userInfo && (
          <Box>
            <Tabs
              value={tabActive}
              onChange={handleTabChange}
              aria-label="basic tabs example"
            >
              <Tab label="User Profile" />
              <Tab label="Change Password" />
            </Tabs>
            <Paper sx={{ flex: 1, p: 1, minHeight: 300 }}>
              {tabActive == 0 ? <UserInformation /> : <ChangePassword />}
            </Paper>
          </Box>
        )}
      </BaseDialog>
    </BootstrapDialog>
  );
}

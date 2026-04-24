import { Box, Button, Divider, Stack, Typography } from '@mui/material';
import { darken, lighten } from '@mui/material/styles';
import { invoke } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
import WindowOutlinedIcon from '@mui/icons-material/WindowOutlined';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import SettingsIcon from '@mui/icons-material/Settings';
import { useNavigate } from 'react-router-dom';
import { useConfirm } from '../ConfirmProvider';
import { SpaceDashboard } from '@mui/icons-material';

export default function SideBar() {
  const navigate = useNavigate();

  const { confirm: showConfirm } = useConfirm();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const defaultColor = '#226aa5';

  const sxButton = (props = {}) => {
    const { disabled } = props;
    return {
      borderRadius: 3,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: disabled ? lighten(color, 1) : defaultColor,
      border: disabled ? null : 2,
      color: 'white',
      '&:hover': {
        backgroundColor: disabled ? null : darken(defaultColor, 0.5),
      },
    };
  };
  useEffect(() => {
    formatDate();
    const interval = setInterval(formatDate, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = () => {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');

    const HH = pad(now.getHours());
    const mm = pad(now.getMinutes());
    const ss = pad(now.getSeconds());

    const dd = pad(now.getDate());
    const MM = pad(now.getMonth() + 1); // 🔥 fix month
    const yy = now.toLocaleDateString('en-US', { year: '2-digit' });

    setTime(`${HH}:${mm}:${ss}`);
    setDate(`${dd}/${MM}/${yy}`);
  };

  return (
    <Box
      sx={{
        width: 100,
        height: '96.7vh',
        bgcolor: '#070069',
        color: 'white',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {/* TIME */}
      <Box textAlign="center">
        <Typography variant="h5" fontWeight="bold">
          {time}
        </Typography>
        <Typography variant="body2">{date}</Typography>
      </Box>

      <Divider sx={{ bgcolor: '#555' }} />

      {/* BUTTON GROUP */}
      <Stack spacing={1}>
        <Button sx={sxButton()} onClick={() => navigate('/')}>
          <SpaceDashboard fontSize="large" />
        </Button>
      </Stack>

      <Divider sx={{ bgcolor: '#555' }} />

      <Stack spacing={1} mt="auto">
        {/* <Button sx={sxButton()} onClick={() => navigate('/setting')}>
          <SettingsIcon fontSize="large" />
        </Button> */}
        <Button
          sx={{ ...sxButton(), backgroundColor: 'red' }}
          onClick={async () => {
            const ok = await showConfirm({
              title: 'Shotdown',
              message: 'Anda yakin ingin Shutdown PC?',
              severity: 'warning',
            });
            if (ok) await invoke('shutdown');
          }}
        >
          <PowerSettingsNewIcon />
          Shutdown
        </Button>
      </Stack>
    </Box>
  );
}

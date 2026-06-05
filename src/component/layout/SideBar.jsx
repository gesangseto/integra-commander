import {
  Box,
  Button,
  Divider,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { darken, lighten } from '@mui/material/styles';
import { invoke } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
import WindowOutlinedIcon from '@mui/icons-material/WindowOutlined';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import SettingsIcon from '@mui/icons-material/Settings';
import { useNavigate } from 'react-router-dom';
import { useConfirm } from '../ConfirmProvider';
import { DashboardOutlined } from '@mui/icons-material';
import color from '../../constant/color.json';

let menu = [
  { id: 0, name: 'Dashboard', route: '/' },
  { id: 1, name: 'Setting', route: '/setting' },
];

export default function SideBar() {
  const navigate = useNavigate();
  const { confirm: showConfirm } = useConfirm();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const defaultColor = '#226aa5';
  const [activeMenu, setActiveMenu] = useState(0);

  const sxButton = (props = {}) => {
    const { disabled } = props;
    return {
      borderRadius: 3,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: disabled ? lighten(defaultColor, 0.5) : defaultColor,
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

  const handleClickMenu = (id) => {
    let findMenu = menu.find((it) => it.id == id);
    if (findMenu) {
      navigate(findMenu.route);
      setActiveMenu(id);
    }
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
        <Tooltip title="Dashboard">
          <Button
            sx={sxButton({ disabled: activeMenu === 0 ? true : false })}
            onClick={() => handleClickMenu(0)}
          >
            <DashboardOutlined fontSize="large" />
          </Button>
        </Tooltip>
      </Stack>

      <Divider sx={{ bgcolor: '#555' }} />

      <Stack spacing={1} mt="auto">
        <Tooltip title="Settings">
          <Button
            aria-label="Settings"
            sx={sxButton({ disabled: activeMenu === 1 ? true : false })}
            onClick={() => handleClickMenu(1)}
          >
            <SettingsIcon fontSize="large" />
          </Button>
        </Tooltip>
        <Tooltip title="Shutdown">
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
          </Button>
        </Tooltip>
      </Stack>
    </Box>
  );
}

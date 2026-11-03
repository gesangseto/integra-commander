import {
  Box,
  Button,
  Divider,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { invoke } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import SettingsIcon from '@mui/icons-material/Settings';
import { useNavigate } from 'react-router-dom';
import { useConfirm } from '../ConfirmProvider';
import { DashboardOutlined } from '@mui/icons-material';

let menu = [
  { id: 0, name: 'Dashboard', route: '/' },
  { id: 1, name: 'Setting', route: '/setting' },
];

// Gaya tombol navigasi sidebar (persegi membulat, aksen biru saat aktif).
const navButtonSx = (active) => ({
  minWidth: 0,
  width: 52,
  height: 52,
  borderRadius: '14px',
  color: active ? '#2563eb' : '#cbd5e1',
  backgroundColor: active ? '#dbeafe' : 'transparent',
  border: '1px solid',
  borderColor: active ? '#bfdbfe' : 'transparent',
  transition: 'all .18s ease',
  '&:hover': {
    backgroundColor: active ? '#dbeafe' : 'rgba(255,255,255,0.1)',
    color: active ? '#1d4ed8' : '#ffffff',
  },
});

export default function SideBar() {
  const navigate = useNavigate();
  const { confirm: showConfirm } = useConfirm();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [activeMenu, setActiveMenu] = useState(0);

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
        width: 96,
        height: '99vh',
        bgcolor: '#070069',
        borderRight: '1px solid #070066',
        p: 1.5,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1.5,
        boxSizing: 'border-box',
      }}
    >
      {/* TIME */}
      <Box textAlign="center" sx={{ width: '100%' }}>
        <Typography
          variant="subtitle1"
          fontWeight={800}
          sx={{ color: '#ffffff', letterSpacing: 0.5 }}
        >
          {time}
        </Typography>
        <Typography variant="caption" sx={{ color: '#bfdbfe' }}>
          {date}
        </Typography>
      </Box>

      <Divider sx={{ width: '100%', borderColor: 'rgba(255,255,255,0.2)' }} />

      {/* BUTTON GROUP */}
      <Stack spacing={1} alignItems="center">
        <Tooltip title="Dashboard">
          <Button
            sx={navButtonSx(activeMenu === 0)}
            onClick={() => handleClickMenu(0)}
          >
            <DashboardOutlined fontSize="medium" />
          </Button>
        </Tooltip>
      </Stack>

      <Stack spacing={1} mt="auto" alignItems="center">
        <Tooltip title="Settings">
          <Button
            aria-label="Settings"
            sx={{
              ...navButtonSx(false),
              backgroundColor: '#2563eb',
              color: '#ffffff',
              borderColor: '#2563eb',
              '&:hover': { backgroundColor: '#1d4ed8', color: '#ffffff' },
            }}
            onClick={() => handleClickMenu(1)}
          >
            <SettingsIcon fontSize="medium" />
          </Button>
        </Tooltip>
        <Tooltip title="Shutdown">
          <Button
            sx={{
              ...navButtonSx(false),
              backgroundColor: '#dc2626',
              color: '#ffffff',
              borderColor: '#dc2626',
              '&:hover': { backgroundColor: '#b91c1c', color: '#ffffff' },
            }}
            onClick={async () => {
              const ok = await showConfirm({
                title: 'Shotdown',
                message: 'Anda yakin ingin Shutdown PC?',
                severity: 'warning',
              });
              if (ok) await invoke('shutdown');
            }}
          >
            <PowerSettingsNewIcon fontSize="medium" />
          </Button>
        </Tooltip>
      </Stack>
    </Box>
  );
}

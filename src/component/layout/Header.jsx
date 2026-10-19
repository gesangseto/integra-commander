import { PowerSettingsNew } from '@mui/icons-material';
import { Circle } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  keyframes,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { invoke } from '@tauri-apps/api/core';
import { Command } from '@tauri-apps/plugin-shell';
import { useEffect, useState } from 'react';
import mertrackLogo from '../../assets/mertrack.png';
import { showGlobalAlert } from '../AlertProvider';
import { useAppStore } from '../../store/pathStore';
import { useAppStatusStore } from '../../store/appStatusStore';
import { useSettingStore } from '../../store/settingStore';

const blinkRed = keyframes`
  0% { background-color: #ff8383; }
  50% { background-color: #a30505; }
  100% { background-color: #ff8383; }
`;
const blinkGreen = keyframes`
  0% { background-color: #00b12c; }
  50% { background-color: #00b12c; }
  100% { background-color: #00b12c; }
`;

function Header() {
  const store = useAppStore();
  const isAdmin = useAppStatusStore((s) => s.isAdmin);
  const { workingDirectory, appName } = useSettingStore((s) => s.form);
  const [settingUp, setSettingUp] = useState(false);
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      try {
        // 1. Fetch Nginx menggunakan path dari store
        const nginxOut = await Command.create('run-command', [
          '/C',
          'nginx',
          '-p',
          store.nginxPath,
          '-v',
        ]).execute();
        const nv = (nginxOut.stdout || nginxOut.stderr || '')
          .replace('nginx version: ', '')
          .trim();

        // 2. Fetch yang lain
        const pm2Out = await Command.create('run-command', [
          '/C',
          'pm2',
          '-v',
        ]).execute();
        const nodeOut = await Command.create('run-command', [
          '/C',
          'node',
          '-v',
        ]).execute();
        const npmOut = await Command.create('run-command', [
          '/C',
          'npm',
          '-v',
        ]).execute();

        // Deteksi lokasi pm2.cmd secara dinamis supaya startup script bisa memanggilnya
        if (!store.pm2Path) {
          const pm2Where = await Command.create('run-command', [
            '/C',
            'where',
            'pm2.cmd',
          ]).execute();
          const firstMatch = (pm2Where.stdout || '')
            .split('\n')
            .map((s) => s.trim())
            .find((s) => s.length > 0);
          store.setPm2Path(firstMatch || '');
        }

        // Update sekaligus ke Store
        store.setVersions({
          nginx: nv || 'Error',
          pm2: pm2Out.code === 0 ? pm2Out.stdout.trim() : 'Error',
          node: nodeOut.stdout.trim() || 'Error',
          npm: npmOut.stdout.trim() || 'Error',
        });
      } catch (err) {
        // Salah satu tool (nginx/pm2/node/npm) tidak ditemukan → jangan biarkan
        // unhandled rejection; tandai Error dan beri tahu user sekali.
        store.setVersions({
          nginx: 'Error',
          pm2: 'Error',
          node: 'Error',
          npm: 'Error',
        });
        showGlobalAlert(`Gagal membaca versi tool: ${err}`, 'warning');
      }
    };

    fetchAll();
  }, [store.nginxPath]); // Auto-refresh jika user merubah folder Nginx

  const handleSetupStartup = () => {
    if (!workingDirectory) {
      showGlobalAlert(
        'Working directory belum diatur! Silakan atur di menu Settings.',
        'warning',
      );
      return;
    }
    setPassword('');
    setPasswordDialog(true);
  };

  const handleConfirmSetup = async () => {
    if (!password) {
      showGlobalAlert('Password tidak boleh kosong.', 'warning');
      return;
    }
    if (!store.pm2Path) {
      showGlobalAlert(
        'Lokasi pm2.cmd belum terdeteksi. Buka tab versi terlebih dahulu, lalu coba lagi.',
        'warning',
      );
      return;
    }
    setPasswordDialog(false);
    setSettingUp(true);
    try {
      const startupResult = await invoke('create_startup_script', {
        workingDirectory,
        nginxPath: store.nginxPath,
        pm2Path: store.pm2Path,
        appName: appName || 'IntegraCommander',
        password,
      });

      const autorunResult = await invoke('create_autorun_commander');

      showGlobalAlert(`${startupResult}\n${autorunResult}`, 'success');
    } catch (err) {
      showGlobalAlert(String(err), 'error');
    } finally {
      setSettingUp(false);
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 2,
        border: '1px solid #e5e7eb',
        bgcolor: '#ffffff',
        p: 0.75,
      }}
    >
      <Grid container spacing={1} alignItems="center">
        <Grid size={12}>
          {/* 3 BAGIAN HORIZONTAL: IMAGE | DEVICE INFO | SETUP STARTUP */}
          <Box
            display="flex"
            alignItems="center"
            height={38}
            overflow="visible"
          >
            {/* BAGIAN 1 - IMAGE INFO */}
            <Box
              flex={1}
              display="flex"
              alignItems="center"
              overflow="visible"
            >
              <img
                src={mertrackLogo}
                style={{ height: 48, width: 'auto' }}
                loading="lazy"
              />
            </Box>

            {/* BAGIAN 2 - DEVICE INFO (di tengah) */}
            <Box flex={1} display="flex" justifyContent="center">
              <Box
                sx={{
                  minWidth: 300,
                  height: 38,
                  borderRadius: '10px',
                  bgcolor: '#f8fafc',
                  border: '1px solid #e5e7eb',
                  px: 1.5,
                  gap: 0.75,
                  display: 'flex',
                  justifyContent: 'space-evenly',
                  alignItems: 'center',
                }}
              >
                <Typography
                  variant="body2"
                  fontWeight="bold"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    fontSize: 12.5,
                  }}
                >
                  <Circle
                    sx={{ fontSize: 12 }}
                    color={store.nodeVersion ? 'success' : 'error'}
                  />
                  node {store.nodeVersion}
                </Typography>
                <Typography
                  variant="body2"
                  fontWeight="bold"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    fontSize: 12.5,
                  }}
                >
                  <Circle
                    sx={{ fontSize: 12 }}
                    color={store.npmVersion ? 'success' : 'error'}
                  />
                  npm {store.npmVersion}
                </Typography>
                <Typography
                  variant="body2"
                  fontWeight="bold"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    fontSize: 12.5,
                  }}
                >
                  <Circle
                    sx={{ fontSize: 12 }}
                    color={store.pm2Version ? 'success' : 'error'}
                  />
                  pm2 {store.pm2Version}
                </Typography>
              </Box>
            </Box>

            {/* BAGIAN 3 - SETUP STARTUP BUTTON (paling kanan) */}
            <Box
              flex={1}
              display="flex"
              alignItems="center"
              justifyContent="flex-end"
              pr={1}
            >
              <Button
                variant="contained"
                color="primary"
                size="small"
                disabled={settingUp}
                onClick={handleSetupStartup}
                startIcon={
                  settingUp ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : (
                    <PowerSettingsNew fontSize="small" />
                  )
                }
                sx={{ px: 1.5, py: 0.5, borderRadius: '10px', fontSize: 12.5 }}
              >
                {settingUp ? 'Setting...' : 'Setup Startup'}
              </Button>
            </Box>
          </Box>
        </Grid>
      </Grid>

      {isAdmin === false && (
        <Alert
          severity="warning"
          sx={{
            mt: 0.5,
            py: 0,
            borderRadius: 1.5,
            fontSize: 11.5,
            lineHeight: 1.35,
            alignItems: 'center',
            '& .MuiAlert-icon': { fontSize: 16, py: 0, mr: 0.75 },
            '& .MuiAlert-message': { py: 0.4 },
          }}
        >
          Aplikasi harus dijalankan sebagai <strong>Administrator</strong>. Tutup
          lalu buka kembali dengan <strong>Run as administrator</strong> agar PM2
          berfungsi (pemantauan PM2 dihentikan).
        </Alert>
      )}

      {/* PASSWORD DIALOG UNTUK TASK SCHEDULER */}
      <Dialog
        open={passwordDialog}
        onClose={() => setPasswordDialog(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Windows User Password</DialogTitle>
        <DialogContent>
          <Box mt={1}>
            <TextField
              fullWidth
              type="password"
              label="Password user Windows (untuk menjalankan tanpa logon)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmSetup();
              }}
              autoFocus
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordDialog(false)} disabled={settingUp}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmSetup}
            disabled={settingUp}
          >
            {settingUp ? 'Processing...' : 'Create Task'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

export default Header;

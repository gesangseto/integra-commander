import { PowerSettingsNew } from '@mui/icons-material';
import { Circle } from '@mui/icons-material';
import {
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
} from '@mui/material';
import { invoke } from '@tauri-apps/api/core';
import { Command } from '@tauri-apps/plugin-shell';
import { useEffect, useState } from 'react';
import mertrackLogo from '../../assets/mertrack.png';
import { showGlobalAlert } from '../AlertProvider';
import { useAppStore } from '../../store/pathStore';
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
  const { workingDirectory, appName } = useSettingStore((s) => s.form);
  const [settingUp, setSettingUp] = useState(false);
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
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
        pm2: pm2Out.stdout.trim() || 'Error',
        node: nodeOut.stdout.trim() || 'Error',
        npm: npmOut.stdout.trim() || 'Error',
      });
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
      const result = await invoke('create_startup_script', {
        workingDirectory,
        nginxPath: store.nginxPath,
        pm2Path: store.pm2Path,
        appName: appName || 'IntegraCommander',
        password,
      });
      showGlobalAlert(result, 'success');
    } catch (err) {
      showGlobalAlert(String(err), 'error');
    } finally {
      setSettingUp(false);
    }
  };

  return (
    <Paper sx={{ borderRadius: 2 }}>
      <Grid container spacing={2} alignItems="center">
        <Grid item size={12}>
          {/* IMAGE INFO */}
          <Box display="flex">
            <Box flex={1}>
              <img
                src={mertrackLogo}
                style={{ height: 75, width: 'auto' }}
                loading="lazy"
              />
            </Box>
            {/* DEVICE INFO */}
            <Box flex={1} alignContent={'center'} mx={5}>
              <Box
                sx={{
                  width: 450,
                  height: 60,
                  borderRadius: 3,
                  bgcolor: '#ffffff',
                  border: 1,
                  // Properti untuk mengetengahkan teks:
                  display: 'flex',
                  justifyContent: 'space-evenly',
                  alignItems: 'center',
                  color: 'black', // Agar teks kontras dengan background merah
                  fontWeight: 'bold',
                  fontSize: '1.2rem',
                }}
              >
                <span
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Circle
                    fontSize="small"
                    color={store.nodeVersion ? 'success' : 'error'}
                  />
                  node {store.nodeVersion}
                </span>
                <span
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Circle
                    fontSize="small"
                    color={store.npmVersion ? 'success' : 'error'}
                  />
                  npm {store.npmVersion}
                </span>
                <span
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Circle
                    fontSize="small"
                    color={store.pm2Version ? 'success' : 'error'}
                  />
                  pm2 {store.pm2Version}
                </span>
              </Box>
            </Box>
            {/* SETUP STARTUP BUTTON */}
            <Box
              flex={0.5}
              display="flex"
              alignItems="center"
              justifyContent="flex-end"
              pr={2}
              mr={2}
            >
              <Button
                variant="outlined"
                size="small"
                color="warning"
                disabled={settingUp}
                onClick={handleSetupStartup}
                startIcon={
                  settingUp ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <PowerSettingsNew />
                  )
                }
                sx={{ fontWeight: 600, textTransform: 'none' }}
              >
                {settingUp ? 'Setting...' : 'Setup Startup'}
              </Button>
            </Box>
          </Box>
        </Grid>
      </Grid>

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

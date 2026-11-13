import { PowerSettingsNew } from '@mui/icons-material';
import { Circle } from '@mui/icons-material';
import {
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
} from '@mui/icons-material';
import {
  Hub as TsRemoteIcon,
  HubOutlined as TsRemoteOutlinedIcon,
} from '@mui/icons-material';
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
  IconButton,
  keyframes,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { invoke } from '@tauri-apps/api/core';
import { Command } from '@tauri-apps/plugin-shell';
import { useEffect, useState } from 'react';
import mertrackLogo from '../../assets/mertrack.png';
import { showGlobalAlert } from '../AlertProvider';
import { useConfirm } from '../ConfirmProvider';
import DialogGitAuthentication from '../DialogGitAuthentication';
import DialogTailscaleAuthentication from '../DialogTailscaleAuthentication';
import { useAppStore } from '../../store/pathStore';
import { useAppStatusStore } from '../../store/appStatusStore';
import { useSettingStore } from '../../store/settingStore';
import { gitValidation } from '../../utility/gitUtility';
import useGitAuth from '../../utility/useGitAuth';
import useTailscaleAuth from '../../utility/useTailscaleAuth';
import {
  normalizeHostname,
  tailscaleValidation,
} from '../../utility/tailscaleUtility';

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
  const { confirm: showConfirm } = useConfirm();
  const isAdmin = useAppStatusStore((s) => s.isAdmin);
  const { workingDirectory, appName } = useSettingStore((s) => s.form);
  const [settingUp, setSettingUp] = useState(false);
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');

  // ===== GIT AUTHENTICATION (ikon gembok) =====
  const gitAuth = useSettingStore((s) => s.gitAuth);
  const setGitAuth = useSettingStore((s) => s.setGitAuth);
  const [gitForm, setGitForm] = useGitAuth();
  const [gitDialog, setGitDialog] = useState(false);
  const [savingGit, setSavingGit] = useState(false);
  const hasGitAuth = Boolean(gitAuth.username && gitAuth.password);

  const handleSaveGitAuth = async () => {
    setSavingGit(true);
    const validasi = await gitValidation(gitForm);
    setSavingGit(false);
    if (validasi.error) {
      showGlobalAlert(validasi.message, 'error');
      return;
    }
    setGitAuth(gitForm);
    setGitDialog(false);
    showGlobalAlert(
      'Git authentication tersimpan. Semua form akan terisi otomatis.',
      'success',
    );
  };

  const handleDeleteGitAuth = async () => {
    const ok = await showConfirm({
      title: 'Hapus Git Authentication',
      message:
        'Kredensial Git yang tersimpan akan dihapus, semua form kembali kosong dan perlu diisi manual. Lanjut?',
      severity: 'danger',
    });
    if (!ok) return;
    setGitAuth({ username: '', password: '' });
    setGitDialog(false);
    showGlobalAlert('Git authentication dihapus.', 'success');
  };

  // ===== TAILSCALE AUTHENTICATION (ikon hub, sebelah gembok Git) =====
  const tailscaleAuth = useSettingStore((s) => s.tailscaleAuth);
  const setTailscaleAuth = useSettingStore((s) => s.setTailscaleAuth);
  const [tailscaleForm, setTailscaleForm] = useTailscaleAuth();
  const [tailscaleDialog, setTailscaleDialog] = useState(false);
  // Auth key boleh kosong (login browser), jadi hostname/server juga dihitung.
  const hasTailscaleAuth = Boolean(
    tailscaleAuth.authKey ||
    tailscaleAuth.hostname ||
    tailscaleAuth.loginServer,
  );

  const handleSaveTailscaleAuth = () => {
    const validasi = tailscaleValidation(tailscaleForm);
    if (validasi.error) {
      showGlobalAlert(validasi.message, 'error');
      return;
    }
    setTailscaleAuth({
      authKey: tailscaleForm.authKey.trim(),
      hostname: normalizeHostname(tailscaleForm.hostname),
      loginServer: tailscaleForm.loginServer.trim(),
    });
    setTailscaleDialog(false);
    showGlobalAlert(
      'Kredensial Tailscale tersimpan. Buka menu Remote Connection untuk gabung ke tailnet.',
      'success',
    );
  };

  const handleDeleteTailscaleAuth = async () => {
    const ok = await showConfirm({
      title: 'Hapus Kredensial Tailscale',
      message:
        'Kredensial Tailscale yang tersimpan (auth key, hostname, login server) akan dihapus. PC yang sudah terlanjur gabung tetap terhubung sampai diputus dari menu Remote Connection. Lanjut?',
      severity: 'danger',
    });
    if (!ok) return;
    setTailscaleAuth({ authKey: '', hostname: '', loginServer: '' });
    setTailscaleDialog(false);
    showGlobalAlert('Kredensial Tailscale dihapus.', 'success');
  };

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
            <Box flex={1} display="flex" alignItems="center" overflow="visible">
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

            {/* BAGIAN 3 - GIT AUTH + SETUP STARTUP BUTTON (paling kanan) */}
            <Box
              flex={1}
              display="flex"
              alignItems="center"
              justifyContent="flex-end"
              gap={1}
              pr={1}
            >
              <Tooltip
                title={
                  hasGitAuth
                    ? `TERSIMPAN — Git authentication atas nama "${gitAuth.username}". Klik untuk memperbarui atau menghapus.`
                    : 'BELUM TERSIMPAN — Klik untuk menyimpan Git authentication agar semua form terisi otomatis.'
                }
              >
                <IconButton
                  size="small"
                  disabled={savingGit}
                  onClick={() => setGitDialog(true)}
                  sx={{
                    width: 34,
                    height: 34,
                    border: hasGitAuth
                      ? '1px solid #16a34a'
                      : '1px dashed #94a3b8',
                    borderRadius: '10px',
                    color: hasGitAuth ? '#16a34a' : '#ff9100',
                    backgroundColor: hasGitAuth
                      ? 'rgba(22,163,74,0.12)'
                      : 'transparent',
                    '&:hover': {
                      backgroundColor: hasGitAuth
                        ? 'rgba(22,163,74,0.2)'
                        : 'rgba(255,145,0,0.08)',
                    },
                  }}
                >
                  {savingGit ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : hasGitAuth ? (
                    <LockIcon fontSize="small" />
                  ) : (
                    <LockOpenIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
              {/* <Tooltip
                title={
                  hasTailscaleAuth
                    ? `TERSIMPAN — Kredensial Tailscale untuk bergabung sebagai "${tailscaleAuth.hostname || 'nama PC ini'}"${tailscaleAuth.loginServer ? ` ke server ${tailscaleAuth.loginServer}` : ''}${tailscaleAuth.authKey ? ' dengan auth key' : ' lewat login browser'}. Klik untuk memperbarui atau menghapus.`
                    : 'BELUM TERSIMPAN — Klik untuk menyimpan nama/login server tailnet. Auth key opsional; tanpa auth key, Remote Connection login lewat browser.'
                }
              >
                <IconButton
                  size="small"
                  onClick={() => setTailscaleDialog(true)}
                  sx={{
                    width: 34,
                    height: 34,
                    border: hasTailscaleAuth
                      ? '1px solid #7c3aed'
                      : '1px dashed #94a3b8',
                    borderRadius: '10px',
                    color: hasTailscaleAuth ? '#7c3aed' : '#ff9100',
                    backgroundColor: hasTailscaleAuth
                      ? 'rgba(124,58,237,0.12)'
                      : 'transparent',
                    '&:hover': {
                      backgroundColor: hasTailscaleAuth
                        ? 'rgba(124,58,237,0.2)'
                        : 'rgba(255,145,0,0.08)',
                    },
                  }}
                >
                  {hasTailscaleAuth ? (
                    <TsRemoteIcon fontSize="small" />
                  ) : (
                    <TsRemoteOutlinedIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip> */}
              <Button
                variant="outlined"
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
                sx={{
                  px: 1.5,
                  py: 0.5,
                  borderRadius: '10px',
                  fontSize: 12.5,
                  color: '#ff9100',
                  borderColor: '#ff9100',
                  backgroundColor: 'transparent',
                  '&:hover': {
                    borderColor: '#ff9100',
                    backgroundColor: 'rgba(255,145,0,0.08)',
                  },
                }}
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
          Aplikasi harus dijalankan sebagai <strong>Administrator</strong>.
          Tutup lalu buka kembali dengan <strong>Run as administrator</strong>{' '}
          agar PM2 berfungsi (pemantauan PM2 dihentikan).
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

      <DialogGitAuthentication
        open={gitDialog}
        onClose={() => {
          if (!savingGit) setGitDialog(false);
        }}
        gitForm={gitForm}
        setGitForm={setGitForm}
        loading={savingGit}
        title="Simpan Git Authentication"
        submitLabel="Simpan"
        onDelete={hasGitAuth ? handleDeleteGitAuth : undefined}
        onSubmit={handleSaveGitAuth}
      />

      <DialogTailscaleAuthentication
        open={tailscaleDialog}
        onClose={() => setTailscaleDialog(false)}
        tailscaleForm={tailscaleForm}
        setTailscaleForm={setTailscaleForm}
        title="Simpan Kredensial Tailscale"
        submitLabel="Simpan"
        onDelete={hasTailscaleAuth ? handleDeleteTailscaleAuth : undefined}
        onSubmit={handleSaveTailscaleAuth}
      />
    </Paper>
  );
}

export default Header;

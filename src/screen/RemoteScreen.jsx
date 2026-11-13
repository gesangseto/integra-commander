import {
  ContentCopy,
  Launch,
  NetworkPing as PingIcon,
  RocketLaunch,
  Refresh,
  Stop,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useAlert } from '../component/AlertProvider';
import { useConfirm } from '../component/ConfirmProvider';
import { useRemoteStore } from '../store/remoteStore';
import { useSettingStore } from '../store/settingStore';
import useTailscaleAuth from '../utility/useTailscaleAuth';
import {
  cancelJoin,
  explainJoinError,
  getComputerName,
  getRemoteInfo,
  installTailscale,
  joinTailnet,
  loginWithBrowser,
  logoutTailnet,
  normalizeHostname,
  openUrl,
  pingHost,
  tailscaleValidation,
} from '../utility/tailscaleUtility';

// Warna status backend Tailscale -> Chip MUI.
const stateColor = (backendState) => {
  switch (String(backendState || '').toLowerCase()) {
    case 'running':
      return 'success';
    case 'needslogin':
      return 'warning';
    case 'stopped':
      return 'default';
    default:
      return 'error';
  }
};

const timeAgo = (iso) => {
  if (!iso) return '-';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '-';
  const menit = Math.floor(diff / 60000);
  if (menit < 1) return 'baru saja';
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  return `${Math.floor(jam / 24)} hari lalu`;
};

const dateOnly = (iso) => {
  if (!iso || String(iso).startsWith('0001')) return '-';
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? '-'
    : date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
};

/**
 * Menu Remote Connection: menjadikan PC ini bagian dari satu tailnet Tailscale,
 * sehingga PC di lokasi berbeda saling mengakses service seperti di LAN sendiri.
 */
export default function RemoteScreen() {
  const { showAlert } = useAlert();
  const { confirm: showConfirm } = useConfirm();

  const info = useRemoteStore((s) => s.info);
  const loadingStatus = useRemoteStore((s) => s.loadingStatus);
  const joining = useRemoteStore((s) => s.joining);
  const installing = useRemoteStore((s) => s.installing);
  const log = useRemoteStore((s) => s.log);
  const setInfo = useRemoteStore((s) => s.setInfo);
  const setLoadingStatus = useRemoteStore((s) => s.setLoadingStatus);
  const setJoining = useRemoteStore((s) => s.setJoining);
  const setInstalling = useRemoteStore((s) => s.setInstalling);
  const appendLog = useRemoteStore((s) => s.appendLog);
  const clearLog = useRemoteStore((s) => s.clearLog);

  const setTailscaleAuth = useSettingStore((s) => s.setTailscaleAuth);
  const frontendPort = useSettingStore((s) => s.form.frontendPort);
  const [tailscaleForm, setTailscaleForm] = useTailscaleAuth();

  // Port service yang dibuka saat tombol "Buka" ditekan (IP tailnet peer).
  const [servicePort, setServicePort] = useState('');

  const refresh = async () => {
    setLoadingStatus(true);
    try {
      setInfo(await getRemoteInfo());
    } catch (error) {
      showAlert(`Gagal membaca status Tailscale: ${error}`, 'error');
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    refresh();
    if (!tailscaleForm.hostname) {
      getComputerName().then((name) =>
        setTailscaleForm((prev) => ({ ...prev, hostname: normalizeHostname(name) })),
      );
    }
  }, []);

  const handleInstall = async () => {
    setInstalling(true);
    clearLog();
    try {
      const result = await installTailscale(appendLog);
      if (result.code === 0) {
        showAlert('Tailscale terpasang. Jalankan lagi bila perlu restart PC.', 'success');
      } else {
        showAlert('Instalasi Tailscale gagal. Install manual dari tailscale.com.', 'error');
      }
    } catch (error) {
      showAlert(String(error), 'error');
    } finally {
      setInstalling(false);
      refresh();
    }
  };

  // Nilai yang dipakai gabung ikut disimpan agar PC ini tinggal pakai lagi.
  const persistForm = () =>
    setTailscaleAuth({
      authKey: tailscaleForm.authKey.trim(),
      hostname: normalizeHostname(tailscaleForm.hostname),
      loginServer: tailscaleForm.loginServer.trim(),
    });

  const runJoin = async (start) => {
    setJoining(true);
    clearLog();
    try {
      const result = await start();
      if (result.code === 0) {
        showAlert('Bergabung ke tailnet.', 'success');
      } else {
        showAlert(explainJoinError(result.output), 'error');
      }
    } catch (error) {
      showAlert(explainJoinError(String(error)), 'error');
    } finally {
      setJoining(false);
      refresh();
    }
  };

  const handleJoin = async () => {
    const validasi = tailscaleValidation(tailscaleForm);
    if (validasi.error) {
      showAlert(validasi.message, 'error');
      return;
    }
    persistForm();
    await runJoin(() =>
      joinTailnet({
        authKey: tailscaleForm.authKey.trim(),
        hostname: normalizeHostname(tailscaleForm.hostname),
        loginServer: tailscaleForm.loginServer.trim(),
        onLine: appendLog,
      }),
    );
  };

  // Login Tailscale tanpa auth key: CLI mencetak halaman login, user masuk
  // dengan akunnya (termasuk akun domain sendiri), PC langsung terdaftar.
  const handleBrowserLogin = async () => {
    const validasi = tailscaleValidation(tailscaleForm);
    if (validasi.error) {
      showAlert(validasi.message, 'error');
      return;
    }
    persistForm();
    await runJoin(() =>
      loginWithBrowser({
        hostname: normalizeHostname(tailscaleForm.hostname),
        loginServer: tailscaleForm.loginServer.trim(),
        onLine: appendLog,
        onAuthUrl: (url) =>
          openUrl(url).catch((error) =>
            showAlert(
              `Browser tidak terbuka (${error}). Pakai tombol "Buka halaman login" di bawah.`,
              'warning',
            ),
          ),
      }),
    );
  };

  const handleCancelJoin = async () => {
    if (await cancelJoin()) showAlert('Proses gabung dibatalkan.', 'warning');
    setJoining(false);
  };

  const handleLogout = async () => {
    const ok = await showConfirm({
      title: 'Keluar dari Tailnet',
      message:
        'PC ini diputus dari tailnet. Untuk gabung lagi, pakai "Login lewat browser" (atau auth key yang masih berlaku). Lanjut?',
      severity: 'danger',
    });
    if (!ok) return;
    try {
      await logoutTailnet();
      showAlert('Keluar dari tailnet.', 'success');
    } catch (error) {
      showAlert(String(error), 'error');
    } finally {
      refresh();
    }
  };

  const handlePing = async (peer) => {
    const target = peer.ip || peer.dnsName;
    if (!target) {
      showAlert('Peer tidak punya IP tailnet.', 'warning');
      return;
    }
    const result = await pingHost(target);
    showAlert(
      result.ok
        ? `${peer.hostName} (${target}) merespons. ${result.detail}`
        : `${peer.hostName} (${target}) tidak merespons. ${result.detail}`,
      result.ok ? 'success' : 'error',
    );
  };

  const handleOpen = async (peer) => {
    const host = peer.ip || peer.dnsName;
    if (!host) {
      showAlert('Peer tidak punya IP tailnet.', 'warning');
      return;
    }
    const url = servicePort ? `http://${host}:${servicePort}` : `http://${host}`;
    try {
      await openUrl(url);
    } catch (error) {
      showAlert(`Gagal membuka ${url}: ${error}`, 'error');
    }
  };

  const handleCopy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      showAlert('Disalin ke clipboard.', 'success');
    } catch (_) {
      showAlert('Gagal menyalin.', 'error');
    }
  };

  const installed = Boolean(info?.installed);
  const self = info?.self;
  const isRunning = String(info?.backendState).toLowerCase() === 'running';
  const hasAuthKey = Boolean(tailscaleForm.authKey?.trim());

  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        width: '100%',
        p: 2,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        overflow: 'hidden',
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 3,
      }}
    >
      {/* ========================================================= */}
      {/* ================= HEADER + REFRESH ====================== */}
      {/* ========================================================= */}
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="h6" fontWeight="bold">
          Remote Connection
        </Typography>
        <Chip
          size="small"
          label={
            !installed
              ? 'Tailscale belum terpasang'
              : isRunning
                ? `Terhubung${info.tailnet ? ` · ${info.tailnet}` : ''}`
                : `Belum terhubung (${info?.backendState || 'stopped'})`
          }
          color={
            !installed ? 'default' : isRunning ? 'success' : stateColor(info?.backendState)
          }
        />
        <Box sx={{ ml: 'auto' }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={
              loadingStatus ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                <Refresh fontSize="small" />
              )
            }
            onClick={refresh}
            disabled={loadingStatus || joining || installing}
          >
            Refresh
          </Button>
        </Box>
      </Stack>

      {/* ========================================================= */}
      {/* ================= KARTU PC INI + KREDENSIAL ============= */}
      {/* ========================================================= */}
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Box
            sx={{
              border: '1px solid #e5e7eb',
              borderRadius: 2,
              p: 1.5,
              height: '100%',
              boxSizing: 'border-box',
            }}
          >
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              PC ini
            </Typography>

            {!installed ? (
              <Stack spacing={1.5}>
                <Typography variant="body2" color="text.secondary">
                  {info?.problem ||
                    'Tailscale belum terpasang di PC ini. Pasang lewat winget, atau unduh dari tailscale.com/download.'}
                </Typography>
                <Box>
                  <Button
                    variant="contained"
                    onClick={handleInstall}
                    disabled={installing || joining}
                    startIcon={
                      installing ? (
                        <CircularProgress size={14} color="inherit" />
                      ) : (
                        <RocketLaunch fontSize="small" />
                      )
                    }
                  >
                    {installing ? 'Menginstal...' : 'Pasang Tailscale'}
                  </Button>
                </Box>
              </Stack>
            ) : (
              <Stack spacing={0.75}>
                <Row label="Hostname" value={self?.hostName || '-'} />
                <Row
                  label="IP tailnet"
                  value={self?.ip || '-'}
                  action={
                    self?.ip ? (
                      <IconButton
                        size="small"
                        onClick={() => handleCopy(self.ip)}
                        aria-label="Salin IP tailnet"
                      >
                        <ContentCopy fontSize="small" />
                      </IconButton>
                    ) : null
                  }
                />
                <Row label="DNS" value={self?.dnsName || '-'} />
                <Row label="Tailnet" value={info.tailnet || '-'} />
                <Row label="Versi" value={info.version || '-'} />
                <Row label="Kunci kedaluwarsa" value={dateOnly(self?.keyExpiry)} />
                <Row
                  label="Koneksi"
                  value={
                    self?.curAddr
                      ? `langsung ${self.curAddr}`
                      : self?.relay
                        ? `lewat relay ${self.relay}`
                        : 'belum terhubung'
                  }
                />
                <Box sx={{ mt: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    {isRunning ? (
                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        startIcon={<Stop fontSize="small" />}
                        onClick={handleLogout}
                        disabled={joining}
                      >
                        Keluar dari tailnet
                      </Button>
                    ) : joining ? (
                      <>
                        <Button
                          size="small"
                          variant="contained"
                          disabled
                          startIcon={<CircularProgress size={14} color="inherit" />}
                        >
                          Menyambung...
                        </Button>
                        <Button size="small" onClick={handleCancelJoin}>
                          Batalkan
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<RocketLaunch fontSize="small" />}
                          onClick={handleBrowserLogin}
                          disabled={installing}
                        >
                          Login lewat browser
                        </Button>
                        <Tooltip title="Jalur otomatis tanpa membuka browser. Umur auth key maksimal 90 hari, kosongkan kolomnya kalau tidak punya.">
                          <Box component="span">
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={handleJoin}
                              disabled={installing || !hasAuthKey}
                            >
                              Gabung pakai auth key
                            </Button>
                          </Box>
                        </Tooltip>
                      </>
                    )}
                  </Stack>
                  {!isRunning && info?.authURL && (
                    <Button
                      size="small"
                      color="warning"
                      sx={{ mt: 0.5, px: 0 }}
                      onClick={() => openUrl(info.authURL)}
                    >
                      Buka halaman login
                    </Button>
                  )}
                </Box>
              </Stack>
            )}
          </Box>
        </Grid>

        {/* ---- KREDENSIAL ---- */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Box
            sx={{
              border: '1px solid #e5e7eb',
              borderRadius: 2,
              p: 1.5,
              height: '100%',
              boxSizing: 'border-box',
            }}
          >
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              Kredensial tailnet
            </Typography>

            <Stack spacing={1.25}>
              <TextField
                size="small"
                fullWidth
                type="password"
                label="Auth Key (opsional)"
                placeholder="tskey-auth-..."
                helperText="Kosong = pakai login browser di atas. Auth key dibatasi 1-90 hari dan tidak bisa diperpanjang, jadi hanya praktis untuk PC baru."
                value={tailscaleForm.authKey}
                onChange={(e) =>
                  setTailscaleForm((prev) => ({ ...prev, authKey: e.target.value }))
                }
              />
              <TextField
                size="small"
                fullWidth
                label="Hostname di tailnet"
                value={tailscaleForm.hostname}
                onChange={(e) =>
                  setTailscaleForm((prev) => ({ ...prev, hostname: e.target.value }))
                }
              />
              <TextField
                size="small"
                fullWidth
                label="Login server (opsional)"
                placeholder="https://headscalesaya:8443"
                value={tailscaleForm.loginServer}
                onChange={(e) =>
                  setTailscaleForm((prev) => ({ ...prev, loginServer: e.target.value }))
                }
              />
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  size="small"
                  label="Port service peer"
                  helperText="mis. 80 atau 3000"
                  value={servicePort}
                  onChange={(e) =>
                    setServicePort(e.target.value.replace(/[^0-9]/g, ''))
                  }
                  sx={{ width: 180 }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    const validasi = tailscaleValidation(tailscaleForm);
                    if (validasi.error) {
                      showAlert(validasi.message, 'error');
                      return;
                    }
                    persistForm();
                    showAlert(validasi.message, 'success');
                  }}
                >
                  Simpan kredensial
                </Button>
              </Stack>
              {frontendPort && (
                <Typography variant="caption" color="text.secondary">
                  Tip: isi port service peer dengan port frontend/backend dari
                  Settings supaya tombol Buka langsung mengarah ke aplikasi.
                </Typography>
              )}
            </Stack>
          </Box>
        </Grid>
      </Grid>

      {/* ========================================================= */}
      {/* ================= DAFTAR PEER =========================== */}
      {/* ========================================================= */}
      <Divider />
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Typography variant="subtitle2" fontWeight="bold" mb={1}>
          Perangkat di tailnet
        </Typography>

        {installed && info?.problem && (
          <Alert severity="warning" sx={{ mb: 1 }}>
            {info.problem}
          </Alert>
        )}

        <TableContainer
          sx={{
            flex: 1,
            minHeight: 0,
            border: '1px solid #e5e7eb',
            borderRadius: 2,
          }}
        >
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Hostname</TableCell>
                <TableCell>IP tailnet</TableCell>
                <TableCell>OS</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Terakhir terlihat</TableCell>
                <TableCell align="right">Aksi</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(info?.peers || []).map((peer) => (
                <TableRow key={peer.id || peer.hostName} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {peer.hostName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {peer.dnsName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Salin IP">
                      <Box
                        component="span"
                        sx={{ cursor: 'pointer' }}
                        onClick={() => handleCopy(peer.ip)}
                      >
                        {peer.ip || '-'}
                      </Box>
                    </Tooltip>
                  </TableCell>
                  <TableCell>{peer.os || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={peer.online ? 'online' : 'offline'}
                      color={peer.online ? 'success' : 'default'}
                    />
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ ml: 1 }}
                    >
                      {peer.curAddr ? `langsung ${peer.curAddr}` : peer.relay || ''}
                    </Typography>
                  </TableCell>
                  <TableCell>{timeAgo(peer.lastSeen)}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handlePing(peer)}
                      aria-label={`Ping ${peer.hostName}`}
                    >
                      <PingIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleOpen(peer)}
                      disabled={!isRunning}
                      aria-label={`Buka ${peer.hostName}`}
                    >
                      <Launch fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {!loadingStatus && (info?.peers || []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      {isRunning
                        ? 'Belum ada perangkat lain di tailnet ini.'
                        : 'Sambungkan PC ini ke tailnet untuk melihat perangkat lain.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* ========================================================= */}
      {/* ================= LOG PROSES ============================ */}
      {/* ========================================================= */}
      {log.length > 0 && (
        <Box
          sx={{
            flexShrink: 0,
            maxHeight: 120,
            overflow: 'auto',
            bgcolor: '#0f172a',
            color: '#e2e8f0',
            borderRadius: 2,
            p: 1,
            fontFamily: 'monospace',
            fontSize: 11.5,
            whiteSpace: 'pre-wrap',
          }}
        >
          {log.join('\n')}
        </Box>
      )}
    </Paper>
  );
}

function Row({ label, value, action }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Typography variant="body2" color="text.secondary" sx={{ width: 110, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-all' }}>
        {value}
      </Typography>
      {action}
    </Stack>
  );
}

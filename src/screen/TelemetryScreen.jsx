import { OpenInNew, Refresh } from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { Command } from '@tauri-apps/plugin-shell';
import { useCallback, useEffect, useState } from 'react';

/**
 * URL UI otel-gui. Service ini dipasang lewat
 * PM2 Management → Deployment Manager → Plugin → Install Telemetry
 * dan berjalan sebagai proses PM2 `telemetry`.
 */
const TELEMETRY_URL = 'http://localhost:4318';
const TELEMETRY_HEALTH_URL = `${TELEMETRY_URL}/api/config`;

/**
 * Halaman Telemetry: menampilkan UI otel-gui di dalam webview (iframe).
 *
 * Karena service berjalan terpisah di port 4318, halaman ini mengecek
 * ketersediaannya lebih dulu agar bisa menampilkan panduan bila service
 * belum terpasang / sedang mati.
 *
 * @component
 * @returns {JSX.Element} Halaman Telemetry
 */
export default function TelemetryScreen() {
  // 'checking' | 'online' | 'offline'
  const [status, setStatus] = useState('checking');
  // Dipakai untuk memaksa iframe reload.
  const [reloadKey, setReloadKey] = useState(0);

  const checkStatus = useCallback(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(TELEMETRY_HEALTH_URL, {
        signal: controller.signal,
        cache: 'no-store',
      });
      setStatus(res.ok ? 'online' : 'offline');
    } catch {
      setStatus('offline');
    } finally {
      clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    checkStatus();
    // Cek berkala supaya halaman otomatis terhubung setelah service
    // di-install / di-restart dari tab PM2.
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const handleReload = () => {
    setReloadKey((key) => key + 1);
    checkStatus();
  };

  const handleOpenBrowser = () => {
    // `start` membuka URL di browser default tanpa perlu izin plugin baru.
    Command.create('run-command', ['/C', 'start', TELEMETRY_URL]).execute();
  };

  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        width: '100%',
        p: 0,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: 'transparent',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 0.5, pb: 1 }}
      >
        <Typography variant="h5" fontWeight="bold">
          Telemetry
        </Typography>

        {status === 'checking' ? (
          <Chip
            size="small"
            icon={<CircularProgress size={12} />}
            label="Checking..."
            variant="outlined"
          />
        ) : (
          <Chip
            size="small"
            label={status === 'online' ? 'Running' : 'Offline'}
            color={status === 'online' ? 'success' : 'error'}
            variant="outlined"
          />
        )}

        <Typography variant="caption" color="text.secondary">
          {TELEMETRY_URL}
        </Typography>

        <Box sx={{ flex: 1 }} />

        <Button size="small" startIcon={<Refresh />} onClick={handleReload}>
          Reload
        </Button>
        <Button
          size="small"
          startIcon={<OpenInNew />}
          onClick={handleOpenBrowser}
          disabled={status !== 'online'}
        >
          Buka di Browser
        </Button>
      </Stack>

      <Divider />

      <Box sx={{ flex: 1, minHeight: 0, position: 'relative', mt: 1 }}>
        {status === 'online' ? (
          <Box
            component="iframe"
            key={reloadKey}
            title="otel-gui"
            src={TELEMETRY_URL}
            sx={{
              display: 'block',
              width: '100%',
              height: '100%',
              border: 0,
              borderRadius: 1,
              backgroundColor: '#fff',
            }}
          />
        ) : status === 'checking' ? (
          <Stack
            alignItems="center"
            justifyContent="center"
            spacing={2}
            sx={{ height: '100%' }}
          >
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Menghubungkan ke {TELEMETRY_URL}...
            </Typography>
          </Stack>
        ) : (
          <Stack
            alignItems="center"
            justifyContent="center"
            spacing={1.5}
            sx={{ height: '100%', textAlign: 'center', px: 3 }}
          >
            <Typography variant="h6" fontWeight="bold">
              Telemetry belum berjalan
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Service tidak merespons di {TELEMETRY_URL}. Pasang terlebih dahulu
              lewat{' '}
              <strong>
                PM2 Management → Deployment Manager → Plugin → Install Telemetry
              </strong>
              , lalu klik Retry.
            </Typography>
            <Stack direction="row" spacing={1} mt={1}>
              <Button
                variant="contained"
                startIcon={<Refresh />}
                onClick={handleReload}
              >
                Retry
              </Button>
              <Button startIcon={<OpenInNew />} onClick={handleOpenBrowser}>
                Buka di Browser
              </Button>
            </Stack>
          </Stack>
        )}
      </Box>
    </Paper>
  );
}

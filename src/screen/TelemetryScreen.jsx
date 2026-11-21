import { Refresh } from '@mui/icons-material';
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
import { useCallback, useEffect, useState } from 'react';

import { useSettingStore } from '../store/settingStore';
import { resolveTelemetryUrl } from '../utility/telemetryUtility';

/**
 * Halaman Telemetry: menampilkan UI otel-gui di dalam webview (iframe).
 *
 * Endpoint diambil dari Setting → Telemetry → `OTEL Exporter OTLP Endpoint`,
 * sehingga otel-gui bisa diarahkan ke IP/endpoint server (bukan hanya
 * `localhost`). Service-nya sendiri dipasang lewat
 * PM2 Management → Deployment Manager → Plugin → Telemetry, dan berjalan
 * sebagai proses PM2 `telemetry` dengan `PORT` sesuai endpoint tersebut.
 *
 * Halaman ini mengecek ketersediaan service lebih dulu agar bisa
 * menampilkan panduan bila service belum terpasang / sedang mati.
 *
 * @component
 * @returns {JSX.Element} Halaman Telemetry
 */
export default function TelemetryScreen() {
  // 'checking' | 'online' | 'offline'
  const [status, setStatus] = useState('checking');
  // Dipakai untuk memaksa iframe reload.
  const [reloadKey, setReloadKey] = useState(0);

  const endpoint = useSettingStore(
    (state) => state.form.otelExporterOtlpEndpoint,
  );
  // Origin otel-gui mengikuti endpoint OTLP pada Setting.
  const telemetryUrl = resolveTelemetryUrl(endpoint);
  const healthUrl = `${telemetryUrl}/api/config`;

  const checkStatus = useCallback(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(healthUrl, {
        signal: controller.signal,
        cache: 'no-store',
      });
      setStatus(res.ok ? 'online' : 'offline');
    } catch {
      setStatus('offline');
    } finally {
      clearTimeout(timer);
    }
  }, [healthUrl]);

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

        <Box sx={{ flex: 1 }} />

        <Button size="small" startIcon={<Refresh />} onClick={handleReload}>
          Reload
        </Button>
      </Stack>

      <Divider />

      <Box sx={{ flex: 1, minHeight: 0, position: 'relative', mt: 1 }}>
        {status === 'online' ? (
          <Box
            component="iframe"
            key={reloadKey}
            title="otel-gui"
            src={telemetryUrl}
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
              Menghubungkan ke {telemetryUrl}...
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
              Service tidak merespons di {telemetryUrl}. Pasang / update lewat{' '}
              <strong>
                PM2 Management → Deployment Manager → Plugin → Telemetry
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
            </Stack>
          </Stack>
        )}
      </Box>
    </Paper>
  );
}

import { useEffect, useRef, useState } from 'react';

import { Lock as LockIcon } from '@mui/icons-material';
import {
  Paper,
  Typography,
  Box,
  TextField,
  Grid,
  Button,
  Divider,
  MenuItem,
  Switch,
  FormControlLabel,
} from '@mui/material';

import DialogGitAuthentication from '../component/DialogGitAuthentication';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

import { useSettingStore } from '../store/settingStore';
import useGitAuthGate from '../utility/useGitAuthGate';
import { useConfirm } from '../component/ConfirmProvider';
import { useAlert } from '../component/AlertProvider';
import { gitValidation } from '../utility/gitUtility';
import { isEnabled, enable, disable } from '@tauri-apps/plugin-autostart';

const listTimezone = [
  { offset: '-11:00', name: 'Pacific/Midway', label: '(GMT-11:00) Midway' },
  { offset: '-10:00', name: 'America/Adak', label: '(GMT-10:00) Adak' },
  { offset: '-10:00', name: 'Pacific/Honolulu', label: '(GMT-10:00) Honolulu' },
  {
    offset: '-09:00',
    name: 'America/Anchorage',
    label: '(GMT-09:00) Anchorage',
  },
  {
    offset: '-08:00',
    name: 'America/Los_Angeles',
    label: '(GMT-08:00) Pacific Time',
  },
  {
    offset: '-07:00',
    name: 'America/Denver',
    label: '(GMT-07:00) Mountain Time',
  },
  {
    offset: '-06:00',
    name: 'America/Chicago',
    label: '(GMT-06:00) Central Time',
  },
  {
    offset: '-05:00',
    name: 'America/New_York',
    label: '(GMT-05:00) Eastern Time',
  },
  {
    offset: '-04:00',
    name: 'America/Halifax',
    label: '(GMT-04:00) Atlantic Time',
  },
  {
    offset: '-03:00',
    name: 'America/Buenos_Aires',
    label: '(GMT-03:00) Buenos Aires',
  },
  { offset: '-01:00', name: 'Atlantic/Azores', label: '(GMT-01:00) Azores' },
  {
    offset: '+00:00',
    name: 'Europe/London',
    label: '(GMT+00:00) London, Dublin',
  },
  {
    offset: '+01:00',
    name: 'Europe/Paris',
    label: '(GMT+01:00) Paris, Berlin, Rome',
  },
  {
    offset: '+02:00',
    name: 'Europe/Cairo',
    label: '(GMT+02:00) Cairo, Athens',
  },
  {
    offset: '+03:00',
    name: 'Europe/Moscow',
    label: '(GMT+03:00) Moscow, Baghdad',
  },
  {
    offset: '+04:00',
    name: 'Asia/Dubai',
    label: '(GMT+04:00) Dubai, Abu Dhabi',
  },
  {
    offset: '+05:30',
    name: 'Asia/Kolkata',
    label: '(GMT+05:30) Mumbai, New Delhi',
  },
  {
    offset: '+07:00',
    name: 'Asia/Jakarta',
    label: '(GMT+07:00) Jakarta, Bangkok',
  },
  {
    offset: '+08:00',
    name: 'Asia/Singapore',
    label: '(GMT+08:00) Singapore, Beijing',
  },
  { offset: '+09:00', name: 'Asia/Tokyo', label: '(GMT+09:00) Tokyo, Seoul' },
  { offset: '+09:30', name: 'Australia/Darwin', label: '(GMT+09:30) Darwin' },
  {
    offset: '+10:00',
    name: 'Australia/Sydney',
    label: '(GMT+10:00) Sydney, Melbourne',
  },
  {
    offset: '+12:00',
    name: 'Pacific/Auckland',
    label: '(GMT+12:00) Auckland, Fiji',
  },
];

const listBpomUrl = [
  { value: 'https://ttac.pom.go.id/api/v3/', label: 'BPOM Live' },
  {
    value: 'https://ttacdev.pom.go.id/dev/public/api/v3/',
    label: 'BPOM Development',
  },
];
function SettingScreen() {
  const { showAlert } = useAlert();
  const { confirm: showConfirm } = useConfirm();
  // ================= ZUSTAND =================
  const zustandForm = useSettingStore((state) => state.form);
  const setForm = useSettingStore((state) => state.setForm);
  const resetStore = useSettingStore((state) => state.resetForm);
  // ================= LOCAL FORM =================
  const [form, setLocalForm] = useState(zustandForm);
  const isSaving = useRef(false);

  // Sinkronkan form lokal dari zustand setelah persist/rehydrasi agar nilai
  // yang sudah disimpan (contoh bpomUrl live/development) tidak tertimpa
  // nilai default awal saat layar dibuka ulang.
  useEffect(() => {
    if (isSaving.current) return;
    setLocalForm(zustandForm);
  }, [zustandForm]);
  const {
    ready: gitAuthReady,
    open: openGitDialog,
    setOpen: setOpenGitDialog,
    gitForm,
    setGitForm,
  } = useGitAuthGate(handleUnlock);
  const setGitAuth = useSettingStore((state) => state.setGitAuth);
  // ===== UNLOCK VIA GIT AUTH (saat membuka Setting) =====
  // Bila kredensial Git tersimpan & valid → langsung terbuka tanpa prompt.
  // Jika belum → layar di-blur dan wajib unlock via git auth (lalu tersimpan).
  const [settingUnlocked, setSettingUnlocked] = useState(gitAuthReady);
  const [isUnlocking, setIsUnlocking] = useState(false);
  // ================= AUTOSTART =================
  const [checked, setChecked] = useState(false);
  // ================= LOAD IP =================
  useEffect(() => {
    if (!form.serverIp) {
      (async () => {
        const ip = await invoke('get_local_ip');

        setLocalForm((prev) => ({
          ...prev,
          serverIp: ip,
        }));
      })();
    }
  }, []);

  // Cek status autostart saat komponen dimuat
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const enabled = await isEnabled();
        setChecked(enabled);
      } catch (err) {
        console.error('Failed to get autostart status:', err);
        showAlert(err.message || 'Gagal membaca status autostart', 'error');
      }
    };
    checkStatus();
  }, []);

  useEffect(() => {
    if (form.databaseDialect) {
      setLocalForm((prev) => ({
        ...prev,
        databasePort: form.databaseDialect == 'mssql' ? 1433 : 5432,
      }));
    }
  }, [form.databaseDialect]);
  // Handler toggle switch
  const handleToggle = async (event) => {
    const newChecked = event.target.checked;
    setChecked(newChecked); // Optimistic update

    try {
      if (newChecked) {
        await enable();
      } else {
        await disable();
      }
    } catch (err) {
      console.error('Failed to toggle autostart:', err);
      showAlert(err.message || 'Gagal mengubah status autostart', 'error');
      // Rollback jika gagal
      const currentStatus = await isEnabled();
      setChecked(currentStatus);
    }
  };
  // ================= HANDLE CHANGE =================
  const handleChange = (key, value) => {
    setLocalForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // ================= BROWSE FOLDER =================
  const handleBrowseFolder = async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: true,
      });

      if (selected) {
        handleChange('workingDirectory', selected);
      }
    } catch (error) {
      console.error(error);
    }
  };

  // ================= SAVE =================
  const handleSave = () => {
    isSaving.current = true;
    resetStore(); // reset store sebelum menyimpan
    setForm(form); // simpan ke zustand
    isSaving.current = false;
    showAlert('Saved successfully', 'success');
  };

  // ================= RESET =================
  const handleReset = () => {
    resetStore();
    setLocalForm(useSettingStore.getState().form);
  };

  // Validasi kredensial Git untuk membuka (unblur) layar Setting.
  async function handleUnlock() {
    setIsUnlocking(true);
    const validasi = await gitValidation(gitForm);
    setIsUnlocking(false);
    if (validasi.error) {
      showAlert(validasi.message, 'error');
      return;
    }
    setGitAuth(gitForm);
    setSettingUnlocked(true);
    setOpenGitDialog(false);
    showAlert('Settings unlocked', 'success');
  }

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <Paper
        elevation={0}
        sx={{
          height: '100%',
          width: '100%',
          p: 2.5,
          boxSizing: 'border-box',
          overflowY: 'auto',
          overflowX: 'hidden',
          backgroundColor: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 3,
          filter: settingUnlocked ? 'none' : 'blur(8px)',
          transition: 'filter .2s ease',
          pointerEvents: settingUnlocked ? 'auto' : 'none',
          userSelect: settingUnlocked ? 'auto' : 'none',
        }}
      >
        {/* ========================================================= */}
      {/* ================= APPLICATION =========================== */}
      {/* ========================================================= */}
      <Box mt={2}>
        <Typography variant="h6" fontWeight="bold" mb={1.5}>
          Application
        </Typography>
        <Box>
          <Grid container spacing={1.5}>
            <Grid size={4}>
              <TextField
                size="small"
                fullWidth
                label="App Name"
                value={form.appName || ''}
                helperText="Tidak boleh menggunakan spasi"
                onChange={(e) => {
                  const value = e.target.value.replace(/\s/g, '');
                  handleChange('appName', value);
                }}
              />
            </Grid>
            <Grid size={4}>
              <TextField
                size="small"
                fullWidth
                label="Server IP"
                value={form.serverIp || ''}
                onChange={(e) => handleChange('serverIp', e.target.value)}
              />
            </Grid>
            <Grid size={4}>
              <TextField
                size="small"
                fullWidth
                label="Login Timeout (Minute)"
                value={form.loginTimeout || ''}
                helperText="Hanya angka"
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  handleChange('loginTimeout', value);
                }}
              />
            </Grid>
            <Grid size={4} sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                fullWidth
                label="Working Directory"
                value={form.workingDirectory || ''}
                onChange={(e) =>
                  handleChange('workingDirectory', e.target.value)
                }
              />
              <Button
                variant="contained"
                onClick={handleBrowseFolder}
                sx={{ maxHeight: 40 }}
              >
                Browse
              </Button>
            </Grid>
            <Grid size={4}>
              <TextField
                size="small"
                select
                fullWidth
                label="Default Range Load Transaction"
                value={form.rangeTransaction || 'last_1_week'}
                onChange={(e) =>
                  handleChange('rangeTransaction', e.target.value)
                }
              >
                <MenuItem value="last_1_week">Last 1 Week</MenuItem>
                <MenuItem value="last_month">Last Month</MenuItem>
                <MenuItem value="last_3_month">Last 3 Month</MenuItem>
                <MenuItem value="last_6_month">Last 6 Month</MenuItem>
                <MenuItem value="all">All</MenuItem>
              </TextField>
            </Grid>
            <Grid size={4}>
              <TextField
                size="small"
                select
                fullWidth
                label="Timezone"
                value={form.timezone || 'Asia/Jakarta'}
                onChange={(e) => handleChange('timezone', e.target.value)}
              >
                {listTimezone.map((tz) => (
                  <MenuItem key={tz.name} value={tz.name}>
                    {tz.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={4}>
              <TextField
                size="small"
                select
                fullWidth
                label="App Mode"
                value={form.appMode || 'development'}
                onChange={(e) => handleChange('appMode', e.target.value)}
              >
                <MenuItem value="development">Development</MenuItem>
                <MenuItem value="production">Production</MenuItem>
              </TextField>
            </Grid>

            {/* <Grid size={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={checked}
                    onChange={handleToggle}
                    color="primary"
                    inputProps={{ 'aria-label': 'autostart switch' }}
                  />
                }
                label="Auto Start Application"
              />
            </Grid> */}
          </Grid>
        </Box>
      </Box>
      {/* ========================================================= */}
      {/* ================= DATABASE SETUP =========================== */}
      {/* ========================================================= */}
      <Divider sx={{ mt: 2 }} />
      <Box mt={1.5}>
        <Typography variant="h6" fontWeight="bold" mb={1.5}>
          Database Setup
        </Typography>

        <Box sx={{ flexGrow: 1 }}>
          <Grid container spacing={1.5}>
            <Grid size={6}>
              <TextField
                size="small"
                select
                fullWidth
                label="Database Dialect"
                value={form.databaseDialect || 'postgres'}
                onChange={(e) =>
                  handleChange('databaseDialect', e.target.value)
                }
              >
                <MenuItem value="postgres">PostgreSql</MenuItem>
                <MenuItem value="mssql">Microsoft SQL</MenuItem>
              </TextField>
            </Grid>
            <Grid size={6}>
              <TextField
                size="small"
                fullWidth
                label="Database Port"
                value={form.databasePort || ''}
                onChange={(e) => handleChange('databasePort', e.target.value)}
              />
            </Grid>
            <Grid size={4}>
              <TextField
                size="small"
                fullWidth
                label="Database Name"
                value={form.databaseName || ''}
                onChange={(e) => handleChange('databaseName', e.target.value)}
              />
            </Grid>
            <Grid size={4}>
              <TextField
                size="small"
                fullWidth
                label="Database User"
                value={form.databaseUser || ''}
                onChange={(e) => handleChange('databaseUser', e.target.value)}
              />
            </Grid>
            <Grid size={4}>
              <TextField
                size="small"
                fullWidth
                type="password"
                label="Database Password"
                value={form.databasePassword || ''}
                onChange={(e) =>
                  handleChange('databasePassword', e.target.value)
                }
              />
            </Grid>
          </Grid>
        </Box>
      </Box>
      {/* ========================================================= */}
      {/* ================= BACKEND =============================== */}
      {/* ========================================================= */}
      <Divider sx={{ mt: 2 }} />
      <Box mt={1.5}>
        <Typography variant="h6" fontWeight="bold" mb={1.5}>
          Network Settings
        </Typography>

        <Box sx={{ flexGrow: 1 }}>
          <Grid container spacing={1.5}>
            <Grid size={2}>
              <TextField
                size="small"
                fullWidth
                label="Port Backend"
                value={form.backendPort || ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, '');

                  handleChange('backendPort', value);
                }}
              />
            </Grid>
            <Grid size={3}>
              <TextField
                size="small"
                fullWidth
                label="Branch Backend"
                placeholder="Default"
                helperText="Leave blank for default branch"
                value={form.backendBranch || ''}
                onChange={(e) => handleChange('backendBranch', e.target.value)}
              />
            </Grid>
            <Grid size={2}></Grid>
            <Grid size={2}>
              <TextField
                size="small"
                fullWidth
                label="Port Frontend"
                value={form.frontendPort || ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  handleChange('frontendPort', value);
                }}
              />
            </Grid>
            <Grid size={3}>
              <TextField
                size="small"
                fullWidth
                label="Branch Frontend"
                placeholder="Default"
                helperText="Leave blank for default branch"
                value={form.frontendBranch || ''}
                onChange={(e) => handleChange('frontendBranch', e.target.value)}
              />
            </Grid>
          </Grid>
        </Box>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}></Grid>
        </Grid>
      </Box>

      {/* ========================================================= */}
      {/* ================= TELEMETRY (OPENTELEMETRY) ============= */}
      {/* ========================================================= */}
      <Divider sx={{ mt: 2 }} />
      <Box mt={1.5}>
        <Typography variant="h6" fontWeight="bold" mb={1.5}>
          Telemetry
        </Typography>

        <Box>
          <Grid container spacing={1.5}>
            <Grid size={6} sx={{ display: 'flex', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.telemetryEnabled === 'true'}
                    onChange={(e) =>
                      handleChange(
                        'telemetryEnabled',
                        e.target.checked ? 'true' : 'false',
                      )
                    }
                    color="primary"
                    inputProps={{ 'aria-label': 'telemetry switch' }}
                  />
                }
                label="Enabled"
              />
            </Grid>
            <Grid size={6}></Grid>
            <Grid size={6}>
              <TextField
                size="small"
                fullWidth
                label="OTEL Service Name"
                value={form.otelServiceName || ''}
                helperText="Tidak boleh menggunakan spasi"
                onChange={(e) => {
                  const value = e.target.value.replace(/\s/g, '');
                  handleChange('otelServiceName', value);
                }}
              />
            </Grid>
            <Grid size={6}>
              <TextField
                size="small"
                fullWidth
                label="Service Version"
                value={form.otelServiceVersion || ''}
                onChange={(e) =>
                  handleChange('otelServiceVersion', e.target.value)
                }
              />
            </Grid>
            <Grid size={6}>
              <TextField
                size="small"
                fullWidth
                label="Metric Export Interval (ms)"
                value={form.otelMetricExportInterval || ''}
                helperText="Hanya angka"
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  handleChange('otelMetricExportInterval', value);
                }}
              />
            </Grid>
            <Grid size={6}>
              <TextField
                size="small"
                fullWidth
                label="OTEL Exporter OTLP Endpoint"
                placeholder="http://localhost:4318"
                value={form.otelExporterOtlpEndpoint || ''}
                helperText="Contoh: http://localhost:1234 atau http://<IP Server>:1234. Endpoint ini juga dipakai otel-gui (PORT) dan halaman Telemetry."
                onChange={(e) =>
                  handleChange('otelExporterOtlpEndpoint', e.target.value)
                }
              />
            </Grid>
          </Grid>
        </Box>
      </Box>

      {/* ========================================================= */}
      {/* ================= CONNECTOR / BPOM CONFIG ============== */}
      {/* ========================================================= */}
      <Divider sx={{ mt: 2 }} />
      <Box mt={1.5}>
        <Typography variant="h6" fontWeight="bold" mb={1.5}>
          Connector
        </Typography>

        {/* ========================================================= */}
        {/* ================= BPOM CONFIG =========================== */}
        {/* ========================================================= */}
        <Box mt={2}>
          <Typography variant="h6" fontWeight="bold" mb={1.5}>
            BPOM Config
          </Typography>
          <Box>
            <Grid container spacing={1.5}>
              <Grid size={4}>
                <TextField
                  size="small"
                  select
                  fullWidth
                  label="Target"
                  value={
                    form.bpomUrl ||
                    'https://ttacdev.pom.go.id/dev/public/api/v3/'
                  }
                  onChange={(e) => handleChange('bpomUrl', e.target.value)}
                >
                  {listBpomUrl.map((tz) => (
                    <MenuItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={4}>
                <TextField
                  size="small"
                  fullWidth
                  label="BPOM Email"
                  type="email"
                  value={form.bpomEmail || ''}
                  helperText="Tidak boleh menggunakan spasi"
                  onChange={(e) => {
                    const value = e.target.value.replace(/\s/g, '');
                    handleChange('bpomEmail', value);
                  }}
                />
              </Grid>
              <Grid size={4}>
                <TextField
                  size="small"
                  fullWidth
                  type="password"
                  label="BPOM Password"
                  value={form.bpomPassword || ''}
                  onChange={(e) => handleChange('bpomPassword', e.target.value)}
                />
              </Grid>
              <Grid size={4}>
                <TextField
                  size="small"
                  fullWidth
                  label="BPOM App Name"
                  value={form.bpomAppName || ''}
                  helperText="Tidak boleh menggunakan spasi"
                  onChange={(e) => {
                    const value = e.target.value.replace(/\s/g, '');
                    handleChange('bpomAppName', value);
                  }}
                />
              </Grid>
              <Grid size={4}>
                <TextField
                  size="small"
                  fullWidth
                  label="BPOM App Port"
                  value={form.bpomAppPort || ''}
                  helperText="Hanya angka"
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    handleChange('bpomAppPort', value);
                  }}
                />
              </Grid>
            </Grid>
          </Box>
        </Box>
      </Box>
      {/* ========================================================= */}
      {/* ================= ACTION ================================ */}
      {/* ========================================================= */}
      <Box mt={3} display="flex" justifyContent="flex-end" gap={1.5}>
        {/* <Button variant="outlined" onClick={handleReset}>
          Reset
        </Button> */}
        <Button
          variant="contained"
          onClick={async () => {
            const ok = await showConfirm({
              title: 'Save Settings',
              message: 'Apakah anda yakin ingin menyimpan perubahan?',
              severity: 'danger',
            });
            if (!ok) return;
            // Layar sudah di-unlock via git auth saat dibuka → simpan langsung.
            handleSave();
          }}
        >
          Save Settings
        </Button>
      </Box>
      </Paper>

      {!settingUnlocked && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(2px)',
            borderRadius: 3,
            p: 2,
          }}
        >
          <Paper elevation={4} sx={{ p: 3, textAlign: 'center', maxWidth: 360 }}>
            <LockIcon color="primary" sx={{ fontSize: 40 }} />
            <Typography variant="h6" fontWeight="bold" mt={1}>
              Setting terkunci
            </Typography>
            <Typography variant="body2" color="text.secondary" my={1.5}>
              Autentikasi Git diperlukan untuk melihat / mengedit pengaturan.
            </Typography>
            <Button
              variant="contained"
              startIcon={<LockIcon />}
              onClick={() => setOpenGitDialog(true)}
            >
              Unlock dengan Git Auth
            </Button>
          </Paper>
        </Box>
      )}

      <DialogGitAuthentication
        open={openGitDialog}
        onClose={() => {
          if (!isUnlocking) setOpenGitDialog(false);
        }}
        gitForm={gitForm}
        setGitForm={setGitForm}
        loading={isUnlocking}
        title="Unlock Settings"
        submitLabel="Unlock"
        onSubmit={handleUnlock}
      />
    </Box>
  );
}

export default SettingScreen;

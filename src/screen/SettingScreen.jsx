import { useEffect, useState } from 'react';

import {
  Paper,
  Typography,
  Box,
  TextField,
  Grid,
  Button,
  Divider,
  MenuItem,
} from '@mui/material';

import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

import { useSettingStore } from '../store/settingStore';
import { useConfirm } from '../component/ConfirmProvider';
import { useAlert } from '../component/AlertProvider';

function SettingScreen() {
  const { showAlert } = useAlert();
  const { confirm: showConfirm } = useConfirm();
  // ================= ZUSTAND =================
  const zustandForm = useSettingStore((state) => state.form);

  const setForm = useSettingStore((state) => state.setForm);

  const resetStore = useSettingStore((state) => state.resetForm);

  // ================= LOCAL FORM =================
  const [form, setLocalForm] = useState(zustandForm);

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

  useEffect(() => {
    if (form.databaseDialect) {
      setLocalForm((prev) => ({
        ...prev,
        databasePort: form.databaseDialect == 'mssql' ? 1433 : 5432,
      }));
    }
  }, [form.databaseDialect]);

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
    // simpan ke zustand
    setForm(form);
    showAlert('Saved successfully', 'success');
  };

  // ================= RESET =================
  const handleReset = () => {
    resetStore();

    setLocalForm(useSettingStore.getState().form);
  };

  return (
    <Paper
      sx={{
        height: '100%',
        width: '100%',
        px: 3,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* ========================================================= */}
      {/* ================= APPLICATION =========================== */}
      {/* ========================================================= */}
      <Box mt={3}>
        <Typography variant="h6" fontWeight="bold" mb={2}>
          Application
        </Typography>
        <Box>
          <Grid container spacing={2}>
            <Grid size={6}>
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
            <Grid size={6}>
              <TextField
                size="small"
                fullWidth
                label="Server IP"
                value={form.serverIp || ''}
                onChange={(e) => handleChange('serverIp', e.target.value)}
              />
            </Grid>
            <Grid size={6}>
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
            <Grid size={6} sx={{ display: 'flex', gap: 1 }}>
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
            <Grid size={6}>
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
              </TextField>
            </Grid>
          </Grid>
        </Box>
      </Box>
      {/* ========================================================= */}
      {/* ================= DATABASE SETUP =========================== */}
      {/* ========================================================= */}
      <Divider sx={{ mt: 3 }} />
      <Box mt={2}>
        <Typography variant="h6" fontWeight="bold" mb={2}>
          Database Setup
        </Typography>

        <Box sx={{ flexGrow: 1 }}>
          <Grid container spacing={2}>
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
      <Divider sx={{ mt: 3 }} />
      <Box mt={2}>
        <Typography variant="h6" fontWeight="bold" mb={2}>
          Network Settings
        </Typography>

        <Box sx={{ flexGrow: 1 }}>
          <Grid container spacing={2}>
            <Grid size={6}>
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
            <Grid size={6}>
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
          </Grid>
        </Box>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}></Grid>
        </Grid>
      </Box>

      {/* ========================================================= */}
      {/* ================= ACTION ================================ */}
      {/* ========================================================= */}
      <Box mt={5} display="flex" justifyContent="flex-end" gap={2}>
        <Button variant="outlined" onClick={handleReset}>
          Reset
        </Button>

        <Button
          variant="contained"
          onClick={async () => {
            const ok = await showConfirm({
              title: 'Save Settings',
              message: 'Apakah anda yakin ingin menyimpan perubahan?',
              severity: 'danger',
            });
            if (ok) {
              handleSave();
            }
          }}
        >
          Save Settings
        </Button>
      </Box>
    </Paper>
  );
}

export default SettingScreen;

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

function SettingScreen() {
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

    console.log('Saved:', form);
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
        p: 3,
        overflow: 'auto',
        boxSizing: 'border-box',
      }}
    >
      {/* ================= HEADER ================= */}
      <Typography variant="h5" fontWeight="bold">
        Application Settings
      </Typography>

      <Typography variant="body2" color="text.secondary" mt={1}>
        Konfigurasi aplikasi Integra Commander
      </Typography>

      {/* ========================================================= */}
      {/* ================= APPLICATION =========================== */}
      {/* ========================================================= */}
      <Box mt={5}>
        <Typography variant="h6" fontWeight="bold" mb={2}>
          Application
        </Typography>

        <Divider sx={{ mb: 3 }} />

        <Grid container spacing={3}>
          {/* ================= APP NAME ================= */}
          <Grid item xs={12} md={6}>
            <TextField
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
          {/* ================= SERVER IP ================= */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Server IP"
              value={form.serverIp || ''}
              onChange={(e) => handleChange('serverIp', e.target.value)}
            />
          </Grid>

          {/* ================= LOGIN TIMEOUT ================= */}
          <Grid item xs={12} md={6}>
            <TextField
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

          {/* ================= WORKING DIRECTORY ================= */}
          <Grid item xs={12} md={6}>
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                width: '100%',
              }}
            >
              <TextField
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
                sx={{
                  minWidth: 110,
                  whiteSpace: 'nowrap',
                }}
              >
                Browse
              </Button>
            </Box>
          </Grid>

          {/* ================= RANGE ================= */}
          <Grid item xs={12} md={6}>
            <TextField
              select
              sx={{ minWidth: 250 }}
              label="Default Range Load Transaction"
              value={form.rangeTransaction || 'last_1_week'}
              onChange={(e) => handleChange('rangeTransaction', e.target.value)}
            >
              <MenuItem value="last_1_week">Last 1 Week</MenuItem>

              <MenuItem value="last_month">Last Month</MenuItem>

              <MenuItem value="last_3_month">Last 3 Month</MenuItem>

              <MenuItem value="last_6_month">Last 6 Month</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Box>
      {/* ========================================================= */}
      {/* ================= DATABASE SETUP =========================== */}
      {/* ========================================================= */}
      <Box mt={5}>
        <Typography variant="h6" fontWeight="bold" mb={2}>
          Database Setup
        </Typography>

        <Divider sx={{ mb: 3 }} />

        <Grid container spacing={3}>
          {/* ================= DB DIALECT ================= */}
          <Grid item xs={12} md={6}>
            <TextField
              select
              fullWidth
              label="Database Dialect"
              value={form.databaseDialect || 'postgres'}
              onChange={(e) => handleChange('databaseDialect', e.target.value)}
            >
              <MenuItem value="postgres">PostgreSql</MenuItem>
              <MenuItem value="mssql">Microsoft SQL</MenuItem>
            </TextField>
          </Grid>
          {/* ================= DB PORT ================= */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Database Port"
              value={form.databasePort || ''}
              onChange={(e) => handleChange('databasePort', e.target.value)}
            />
          </Grid>
          {/* ================= DB NAME ================= */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Database Name"
              value={form.databaseName || ''}
              onChange={(e) => handleChange('databaseName', e.target.value)}
            />
          </Grid>

          {/* ================= DB USER ================= */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Database User"
              value={form.databaseUser || ''}
              onChange={(e) => handleChange('databaseUser', e.target.value)}
            />
          </Grid>

          {/* ================= DB PASSWORD ================= */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="password"
              label="Database Password"
              value={form.databasePassword || ''}
              onChange={(e) => handleChange('databasePassword', e.target.value)}
            />
          </Grid>
        </Grid>
      </Box>

      {/* ========================================================= */}
      {/* ================= BACKEND =============================== */}
      {/* ========================================================= */}
      <Box mt={5}>
        <Typography variant="h6" fontWeight="bold" mb={2}>
          Backend
        </Typography>

        <Divider sx={{ mb: 3 }} />

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Port Backend"
              value={form.backendPort || ''}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, '');

                handleChange('backendPort', value);
              }}
            />
          </Grid>
        </Grid>
      </Box>

      {/* ========================================================= */}
      {/* ================= FRONTEND ============================== */}
      {/* ========================================================= */}
      <Box mt={5}>
        <Typography variant="h6" fontWeight="bold" mb={2}>
          Frontend
        </Typography>

        <Divider sx={{ mb: 3 }} />

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
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

      {/* ========================================================= */}
      {/* ================= ACTION ================================ */}
      {/* ========================================================= */}
      <Box mt={5} display="flex" justifyContent="flex-end" gap={2}>
        <Button variant="outlined" onClick={handleReset}>
          Reset
        </Button>

        <Button variant="contained" onClick={handleSave}>
          Save Settings
        </Button>
      </Box>
    </Paper>
  );
}

export default SettingScreen;

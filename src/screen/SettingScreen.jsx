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

import DialogGitAuthentication from '../component/DialogGitAuthentication';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

import { useSettingStore } from '../store/settingStore';
import { useConfirm } from '../component/ConfirmProvider';
import { useAlert } from '../component/AlertProvider';
import { gitValidation } from '../utility/gitUtility';

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
  const [gitForm, setGitForm] = useState({ username: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [openGitDialog, setOpenGitDialog] = useState(false);
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
      <DialogGitAuthentication
        open={openGitDialog}
        onClose={() => setOpenGitDialog(false)}
        gitForm={gitForm}
        setGitForm={setGitForm}
        loading={isLoading}
        onSubmit={async () => {
          setIsLoading(true);
          let validasi = await gitValidation(gitForm);
          if (!validasi.error) {
            handleSave();
            setOpenGitDialog(false);
          } else {
            showAlert(validasi.message, 'error');
          }
          setIsLoading(false);
        }}
      />
      {/* ========================================================= */}
      {/* ================= APPLICATION =========================== */}
      {/* ========================================================= */}
      <Box mt={3}>
        <Typography variant="h6" fontWeight="bold" mb={2}>
          Application
        </Typography>
        <Box>
          <Grid container spacing={2}>
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
          </Grid>
        </Box>
      </Box>
      {/* ========================================================= */}
      {/* ================= BPOM CONFIG =========================== */}
      {/* ========================================================= */}
      <Box mt={3}>
        <Typography variant="h6" fontWeight="bold" mb={2}>
          BPOM Config
        </Typography>
        <Box>
          <Grid container spacing={2}>
            <Grid size={4}>
              <TextField
                size="small"
                select
                fullWidth
                label="Target"
                value={
                  form.bpomUrl || 'https://ttacdev.pom.go.id/dev/public/api/v3/'
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
          <Grid item xs={12} md={6}></Grid>
        </Grid>
      </Box>
      {/* ========================================================= */}
      {/* ================= ACTION ================================ */}
      {/* ========================================================= */}
      <Box mt={5} display="flex" justifyContent="flex-end" gap={2}>
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
            if (ok) {
              setOpenGitDialog(true);
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

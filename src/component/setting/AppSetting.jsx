import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { Box, Button, TextField, Typography } from '@mui/material';
import Paper from '@mui/material/Paper';
import { useState } from 'react';
import { useAlert } from '../AlertProvider';

import appConfig from '../../models/mertrack/AppConfig';
import { useConfig } from '../../store/configStore';

export default function AppSetting() {
  const { showAlert } = useAlert();
  const setConfig = useConfig((state) => state.setData);
  const getConfig = useConfig((state) => state.config);
  const [form, setForm] = useState(getConfig);
  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };
  const handleSave = async () => {
    await appConfig.update(form, { id: form.id });
    setConfig(form);
    showAlert('Saved successfully', 'success');
  };

  return (
    <Paper sx={{ p: 3, width: '50%' }}>
      <Typography variant="h6" mb={2}>
        Application Setting
      </Typography>

      {/* Device ID */}
      <Box display="flex" alignItems="center" mb={2}>
        <Typography sx={{ width: 200 }}>Device ID</Typography>
        <TextField
          name="code"
          onChange={handleChange}
          size="small"
          fullWidth
          value={form.code || ''}
        />
      </Box>
      {/* Username */}
      <Box display="flex" alignItems="center" mb={2}>
        <Typography sx={{ width: 200 }}>Username SA</Typography>
        <TextField
          size="small"
          name="username"
          onChange={handleChange}
          fullWidth
          value={form.username || ''}
        />
      </Box>
      {/* Password */}
      <Box display="flex" alignItems="center" mb={2}>
        <Typography sx={{ width: 200 }}>Password SA</Typography>
        <TextField
          name="password"
          type="password"
          onChange={handleChange}
          size="small"
          fullWidth
          value={form.password || ''}
        />
      </Box>

      <Box
        sx={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          display: 'flex',
        }}
      >
        <Button
          onClick={() => handleSave()}
          startIcon={<SaveOutlinedIcon fontSize="small" color="success" />}
        >
          Save Changes
        </Button>
      </Box>
    </Paper>
  );
}

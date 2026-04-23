import ConnectWithoutContactOutlinedIcon from '@mui/icons-material/ConnectWithoutContactOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { Box, Button, TextField, Typography } from '@mui/material';
import Paper from '@mui/material/Paper';
import axios from 'axios';
import { useState } from 'react';
import { useAlert } from '../AlertProvider';

import appConfig from '../../models/mertrack/AppConfig';
import { useConfig } from '../../store/configStore';

export default function () {
  const { showAlert } = useAlert();
  const [isLoading, setIsLoading] = useState(false);
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
    await appConfig.update(form, { where: { id: form.id } });
    setConfig(form);
    showAlert('Saved successfully', 'success');
  };
  const handleTestConnection = async () => {
    setIsLoading(true);
    try {
      await axios.get(
        `http://${form.ip_server}:${form.port_server}/api/version`,
      );
      showAlert('Connection success', 'success');
    } catch (error) {
      showAlert(`${error}`, 'error');
    }
    setIsLoading(false);
  };

  return (
    <Paper sx={{ p: 3, width: '50%' }}>
      <Typography variant="h6" mb={2}>
        Server Setting
      </Typography>

      {/* IP Server */}
      <Box display="flex" alignItems="center" mb={2}>
        <Typography sx={{ width: 200 }}>IP Server</Typography>
        <TextField
          size="small"
          fullWidth
          name="ip_server"
          value={form.ip_server || ''}
          onChange={handleChange}
          placeholder="192.168.1.1"
        />
      </Box>

      {/* Port Server */}
      <Box display="flex" alignItems="center" mb={2}>
        <Typography sx={{ width: 200 }}>Port Server</Typography>
        <TextField
          size="small"
          fullWidth
          name="port_server"
          value={form.port_server || ''}
          onChange={handleChange}
          placeholder="3000"
        />
      </Box>

      {/* Connection Timeout */}
      <Box display="flex" alignItems="center" mb={2}>
        <Typography sx={{ width: 200 }}>Connection Timeout</Typography>
        <TextField
          size="small"
          fullWidth
          name="timeout"
          value={form.timeout || ''}
          onChange={handleChange}
          placeholder="5000 (ms)"
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
        <Button
          loading={isLoading}
          onClick={() => handleTestConnection()}
          startIcon={
            isLoading ? null : (
              <ConnectWithoutContactOutlinedIcon
                fontSize="small"
                color="warning"
              />
            )
          }
        >
          Test Connection
        </Button>
      </Box>
    </Paper>
  );
}

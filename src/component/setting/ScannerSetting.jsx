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
    await appConfig.update(form, { id: form.id });
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
    <Box>
      <Paper sx={{ p: 3, width: '50%' }}>
        <Typography variant="h6" mb={2}>
          Scanner 1 Setting
        </Typography>

        <Box display="flex" alignItems="center" mb={2}>
          <Typography sx={{ width: 200 }}>Scanner Name</Typography>
          <TextField
            size="small"
            fullWidth
            name="scanner1_name"
            value={form.scanner1_name || ''}
            onChange={handleChange}
          />
        </Box>
        <Box display="flex" alignItems="center" mb={2}>
          <Typography sx={{ width: 200 }}>Model</Typography>
          <TextField
            size="small"
            fullWidth
            name="scanner1_model"
            value={form.scanner1_model || ''}
            onChange={handleChange}
          />
        </Box>
        <Box display="flex" alignItems="center" mb={2}>
          <Typography sx={{ width: 200 }}>COM Port</Typography>
          <TextField
            size="small"
            fullWidth
            name="scanner1_comport"
            value={form.scanner1_comport || ''}
            onChange={handleChange}
            placeholder="COM1"
          />
        </Box>
        <Box display="flex" alignItems="center" mb={2}>
          <Typography sx={{ width: 200 }}>Baudrate</Typography>
          <TextField
            size="small"
            fullWidth
            name="scanner1_baudrate"
            value={form.scanner1_baudrate || ''}
            onChange={handleChange}
            placeholder="9600"
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
          {/* <Button
            loading={isLoading}
            onClick={() => handleTestConnection(1)}
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
          </Button> */}
        </Box>
      </Paper>
      <Paper sx={{ p: 3, width: '50%' }}>
        <Typography variant="h6" mb={2}>
          Scanner 2 Setting
        </Typography>

        <Box display="flex" alignItems="center" mb={2}>
          <Typography sx={{ width: 200 }}>Scanner Name</Typography>
          <TextField
            size="small"
            fullWidth
            name="scanner2_name"
            value={form.scanner2_name || ''}
            onChange={handleChange}
          />
        </Box>
        <Box display="flex" alignItems="center" mb={2}>
          <Typography sx={{ width: 200 }}>Model</Typography>
          <TextField
            size="small"
            fullWidth
            name="scanner2_model"
            value={form.scanner2_model || ''}
            onChange={handleChange}
          />
        </Box>
        <Box display="flex" alignItems="center" mb={2}>
          <Typography sx={{ width: 200 }}>COM Port</Typography>
          <TextField
            size="small"
            fullWidth
            name="scanner2_comport"
            value={form.scanner2_comport || ''}
            onChange={handleChange}
            placeholder="COM1"
          />
        </Box>
        <Box display="flex" alignItems="center" mb={2}>
          <Typography sx={{ width: 200 }}>Baudrate</Typography>
          <TextField
            size="small"
            fullWidth
            name="scanner2_baudrate"
            value={form.scanner2_baudrate || ''}
            onChange={handleChange}
            placeholder="9600"
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
          {/* <Button
            loading={isLoading}
            onClick={() => handleTestConnection(2)}
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
          </Button> */}
        </Box>
      </Paper>
    </Box>
  );
}

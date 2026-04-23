import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { Box, Button, TextField, Typography } from '@mui/material';
import Paper from '@mui/material/Paper';
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

  return (
    <Paper sx={{ p: 3, width: '50%' }}>
      <Typography variant="h6" mb={2}>
        Weigher Setting
      </Typography>

      <Box display="flex" alignItems="center" mb={2}>
        <Typography sx={{ width: 200 }}>Weigher Name</Typography>
        <TextField
          size="small"
          fullWidth
          name="weighing_name"
          value={form.weighing_name || ''}
          onChange={handleChange}
        />
      </Box>
      <Box display="flex" alignItems="center" mb={2}>
        <Typography sx={{ width: 200 }}>Model</Typography>
        <TextField
          size="small"
          fullWidth
          name="weighing_model"
          value={form.weighing_model || ''}
          onChange={handleChange}
        />
      </Box>
      <Box display="flex" alignItems="center" mb={2}>
        <Typography sx={{ width: 200 }}>COM Port</Typography>
        <TextField
          size="small"
          fullWidth
          name="weighing_comport"
          value={form.weighing_comport || ''}
          onChange={handleChange}
          placeholder="COM1"
        />
      </Box>
      <Box display="flex" alignItems="center" mb={2}>
        <Typography sx={{ width: 200 }}>Baudrate</Typography>
        <TextField
          size="small"
          fullWidth
          name="weighing_baudrate"
          value={form.weighing_baudrate || ''}
          onChange={handleChange}
          placeholder="9600"
        />
      </Box>
      <Box display="flex" alignItems="center" mb={2}>
        <Typography sx={{ width: 200 }}>Databit</Typography>
        <TextField
          size="small"
          fullWidth
          name="weighing_databit"
          value={form.weighing_databit || ''}
          onChange={handleChange}
          placeholder="7"
          type="number"
        />
      </Box>
      <Box display="flex" alignItems="center" mb={2}>
        <Typography sx={{ width: 200 }}>Mode</Typography>
        <TextField
          size="small"
          fullWidth
          name="weighing_mode"
          value={form.weighing_mode || ''}
          onChange={handleChange}
          placeholder="once"
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
  );
}

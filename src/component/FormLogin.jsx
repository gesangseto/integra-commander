import { Box, Button, Paper, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import appConfig from '../models/mertrack/AppConfig';
import MstUser from '../models/mertrack/MstUser';
import {
  useAuthStore,
  useAuthStorePanelA,
  useAuthStorePanelB,
} from '../store/authStore';
import { useAlert } from './AlertProvider';
import BaseDialog from './atom/BaseDialog';

export default function FormLogin({ open, onClose, onLogin, panel }) {
  const { showAlert } = useAlert();
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    username: '',
    password: '',
  });

  const loginStore = useAuthStore((state) => state.login);
  const loginStoreA = useAuthStorePanelA((state) => state.login);
  const loginStoreB = useAuthStorePanelB((state) => state.login);
  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async () => {
    if (!form.username || !form.password) {
      setError('Username dan Password wajib diisi');
      return;
    }
    setError('');
    let auth;
    // Login SA
    let super_admin = await appConfig.findOne({
      where: {
        username: form.username,
        password: form.password,
      },
    });
    if (super_admin) {
      auth = { ...super_admin, full_name: 'Super Admin' };
    } else {
      // Login User Biasa
      let get_user = await MstUser.findOne({
        where: {
          username: form.username,
          pwd: form.password,
          status: 'Active',
        },
      });
      if (get_user) {
        auth = { ...get_user };
      } else {
        return showAlert(`Username atau password salah`, 'error');
      }
    }
    if (auth) {
      if (panel == 'a') loginStoreA(auth);
      else if (panel == 'b') loginStoreB(auth);
      else loginStore(auth);
      setForm({ username: '', password: '' });
      onLogin(auth);
      return showAlert(`Selamat datang ${auth.full_name}`, 'success');
    }
  };

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      title={`User Login ${panel !== 'main' ? `Panel ${panel}` : ''}`}
      actions={
        <Box>
          {/* <Button onClick={onClose}>Batal</Button> */}
          <Button variant="contained" onClick={handleSubmit}>
            Login
          </Button>
        </Box>
      }
    >
      <Paper sx={{ py: 4, px: 2 }}>
        <Box display="flex" flexDirection="column" alignItems="center">
          <Box display="flex" alignItems="center" m={1}>
            <Typography sx={{ width: 250 }}>Username</Typography>
            <TextField
              size="small"
              label="username"
              name="username"
              fullWidth
              value={form.username}
              onChange={handleChange}
            />
          </Box>
          <Box display="flex" alignItems="center" m={1}>
            <Typography sx={{ width: 250 }}>Password</Typography>
            <TextField
              size="small"
              fullWidth
              value={form.password}
              label="Password"
              name="password"
              type="password"
              onChange={handleChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSubmit();
                }
              }}
            />
          </Box>
          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}
        </Box>
      </Paper>
    </BaseDialog>
  );
}

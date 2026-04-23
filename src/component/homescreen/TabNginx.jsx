import React, { useState } from 'react';
import {
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Box,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';

export default function TabNginx() {
  const [nginxList, setNginxList] = useState([
    {
      id: 1,
      name: 'Main Website',
      port: '80',
      domain: 'example.com',
      target: 'http://localhost:3000',
    },
    {
      id: 2,
      name: 'Backend API',
      port: '443',
      domain: 'api.example.com',
      target: 'http://localhost:5000',
    },
  ]);

  const [openNginxForm, setOpenNginxForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [nginxForm, setNginxForm] = useState({
    id: null,
    name: '',
    port: '80',
    domain: '',
    target: '',
  });

  const handleSaveNginx = () => {
    if (!nginxForm.name || !nginxForm.domain || !nginxForm.target)
      return alert('Data wajib diisi!');
    if (isEditMode) {
      setNginxList(
        nginxList.map((item) => (item.id === nginxForm.id ? nginxForm : item)),
      );
    } else {
      setNginxList([...nginxList, { ...nginxForm, id: Date.now() }]);
    }
    setOpenNginxForm(false);
    setNginxForm({ id: null, name: '', port: '80', domain: '', target: '' });
  };

  const handleDeleteNginx = (id) => {
    setNginxList(nginxList.filter((item) => item.id !== id));
  };

  return (
    <Box mt={2}>
      <Box display="flex" justifyContent="space-between" mb={2}>
        <Typography variant="h6">Virtual Hosts Nginx</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            setIsEditMode(false);
            setOpenNginxForm(true);
          }}
        >
          Tambah Config
        </Button>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
            <TableRow>
              <TableCell>
                <strong>Nama</strong>
              </TableCell>
              <TableCell>
                <strong>Domain</strong>
              </TableCell>
              <TableCell>
                <strong>Port</strong>
              </TableCell>
              <TableCell>
                <strong>Reverse Proxy Target</strong>
              </TableCell>
              <TableCell align="center">
                <strong>Aksi</strong>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {nginxList.map((site) => (
              <TableRow key={site.id}>
                <TableCell>{site.name}</TableCell>
                <TableCell>{site.domain}</TableCell>
                <TableCell>{site.port}</TableCell>
                <TableCell>{site.target}</TableCell>
                <TableCell align="center">
                  <Tooltip title="Edit">
                    <IconButton
                      color="info"
                      onClick={() => {
                        setIsEditMode(true);
                        setNginxForm(site);
                        setOpenNginxForm(true);
                      }}
                    >
                      <Edit />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton
                      color="error"
                      onClick={() => handleDeleteNginx(site.id)}
                    >
                      <Delete />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* MODAL NGINX FORM */}
      <Dialog
        open={openNginxForm}
        onClose={() => setOpenNginxForm(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {isEditMode ? 'Edit Config Nginx' : 'Tambah Config Nginx'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Nama Config"
            fullWidth
            variant="outlined"
            value={nginxForm.name}
            onChange={(e) =>
              setNginxForm({ ...nginxForm, name: e.target.value })
            }
          />
          <TextField
            margin="dense"
            label="Domain / IP"
            fullWidth
            variant="outlined"
            value={nginxForm.domain}
            onChange={(e) =>
              setNginxForm({ ...nginxForm, domain: e.target.value })
            }
          />
          <TextField
            margin="dense"
            label="Port"
            fullWidth
            variant="outlined"
            value={nginxForm.port}
            onChange={(e) =>
              setNginxForm({ ...nginxForm, port: e.target.value })
            }
          />
          <TextField
            margin="dense"
            label="Proxy Pass Target"
            fullWidth
            variant="outlined"
            value={nginxForm.target}
            onChange={(e) =>
              setNginxForm({ ...nginxForm, target: e.target.value })
            }
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenNginxForm(false)} color="inherit">
            Batal
          </Button>
          <Button onClick={handleSaveNginx} variant="contained" color="primary">
            Simpan
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

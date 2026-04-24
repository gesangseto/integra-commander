import {
  Add,
  Delete,
  Edit,
  FolderOpen,
  MonitorHeart,
  Refresh,
  RocketLaunch,
  Settings,
  Stop,
  Visibility,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
// Import API Plugin Tauri v2
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { Command } from '@tauri-apps/plugin-shell';
import { useAlert } from '../AlertProvider';
import { openLocation } from '../../utility';

export default function TabPm2() {
  const { showAlert } = useAlert();
  // ================= STATE MANAGEMENT =================
  const [pm2List, setPm2List] = useState([]);

  // Modals Visibility
  const [openPm2Form, setOpenPm2Form] = useState(false);
  const [openEnvDialog, setOpenEnvDialog] = useState(false);
  const [openDetailDialog, setOpenDetailDialog] = useState(false);

  // Form and Data State
  const [isEditMode, setIsEditMode] = useState(false);
  const [pm2Form, setPm2Form] = useState({ name: '', path: '', id: null });
  const [envContent, setEnvContent] = useState('');
  const [currentEnvPath, setCurrentEnvPath] = useState('');
  const [activeAppName, setActiveAppName] = useState('');
  const [selectedProcess, setSelectedProcess] = useState(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      initPm2();
    }, 5000); // Tunggu 5 detik setelah mount baru panggil resurrect
    return () => clearTimeout(timeout);
  }, []);

  const initPm2 = async () => {
    try {
      // Pisahkan setiap argumen ke dalam array
      let bangunin = Command.create('run-command', ['/C', 'pm2', 'resurrect']);
      const output = await bangunin.execute();
      fetchPm2List();
    } catch (error) {
      showAlert(`${error}`, 'error');
    }
  };

  useEffect(() => {
    fetchPm2List();
    const interval = setInterval(fetchPm2List, 10000); // Auto-refresh data setiap 10 detik
    return () => clearInterval(interval);
  }, []);

  // ================= FETCH DATA PM2 =================
  const fetchPm2List = async () => {
    try {
      const pm2 = Command.create('run-command', ['/C', 'pm2', 'jlist']);
      const output = await pm2.execute();
      if (output.stdout) {
        setPm2List(JSON.parse(output.stdout));
      }
    } catch (error) {
      showAlert(`Error saat fetching pm2: ${error}`, 'error');
    }
  };

  // ================= PM2 ACTIONS =================

  // Fungsi memilih file script biner melalui explorer native
  const handleSelectFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          { name: 'JavaScript', extensions: ['js', 'json', 'cjs', 'mjs'] },
        ],
      });
      if (selected) {
        // Otomatis mengiris nama file untuk dijadikan label nama aplikasi jika kosong
        const fileName = selected
          .split('\\')
          .pop()
          .split('/')
          .pop()
          .replace(/\.[^/.]+$/, '');
        setPm2Form({
          ...pm2Form,
          path: selected,
          name: pm2Form.name || fileName,
        });
      }
    } catch (error) {
      showAlert(`${error}`, 'error');
    }
  };

  const syncPm2Session = async () => {
    // Jalankan di background tanpa mengganggu UI
    await Command.create('run-command', [
      '/C',
      'pm2',
      'save',
      '--force',
    ]).execute();
  };

  // Fungsi simpan penambahan dan pengeditan app
  const handleSavePm2 = async () => {
    if (!pm2Form.path || !pm2Form.name) return alert('Data wajib diisi!');
    try {
      if (isEditMode) {
        // Delete yang lama
        await Command.create('run-command', [
          '/C',
          'pm2',
          'delete',
          pm2Form.id,
        ]).execute();
      }
      // Bentuk app yang baru
      const lastSlash = Math.max(
        pm2Form.path.lastIndexOf('\\'),
        pm2Form.path.lastIndexOf('/'),
      );
      const folderPath = pm2Form.path.substring(0, lastSlash);
      await Command.create('run-command', [
        '/C',
        'pm2',
        'start',
        pm2Form.path,
        '--name',
        pm2Form.name,
        '--cwd', // <--- Set Current Working Directory
        folderPath,
      ]).execute();
      setOpenPm2Form(false);
      setPm2Form({ name: '', path: '', id: null });
      fetchPm2List();
      await syncPm2Session(); // <--- Sinkronisasi otomatis
    } catch (error) {
      showAlert(`${error}`, 'error');
    }
  };

  // Fungsi dinamis untuk stop, restart, delete
  const handlePm2Action = async (action, identifier) => {
    try {
      await Command.create('run-command', [
        '/C',
        'pm2',
        action,
        identifier,
      ]).execute();

      // Berikan jeda 500ms agar PM2 menyelesaikan operasi I/O
      await new Promise((r) => setTimeout(r, 500));
      syncPm2Session();
      fetchPm2List();
    } catch (error) {
      showAlert(`${error}`, 'error');
    }
  };
  // FITUR: Buka PM2 Monit di Jendela CMD Terpisah
  const handleOpenExternalMonit = async (procId) => {
    try {
      // Membuka jendela terminal baru dan menjalankan monit khusus ID tersebut
      await Command.create('run-command', [
        '/C',
        'start',
        'cmd',
        '/k',
        `pm2 monit ${procId}`,
      ]).execute();
    } catch (error) {
      showAlert(`${error}`, 'error');
    }
  };
  // ================= .ENV EDIT LOGIC =================
  const handleOpenEnv = async (proc) => {
    try {
      const scriptPath = proc.pm2_env.pm_exec_path;
      const lastSlash = Math.max(
        scriptPath.lastIndexOf('\\'),
        scriptPath.lastIndexOf('/'),
      );
      const directory = scriptPath.substring(0, lastSlash);
      const envFilePath = `${directory}\\.env`; // Memastikan path Windows konsisten menggunakan backslash

      setCurrentEnvPath(envFilePath);
      setActiveAppName(proc.name);

      const content = await readTextFile(envFilePath);
      setEnvContent(content);
      setOpenEnvDialog(true);
    } catch (error) {
      showAlert(`${error}`, 'error');
    }
  };

  const handleSaveEnv = async () => {
    try {
      await writeTextFile(currentEnvPath, envContent);
      setOpenEnvDialog(false);
      // Merestart dengan flag update-env agar mengambil value berkas baru
      await Command.create('run-command', [
        '/C',
        'pm2',
        'restart',
        activeAppName,
        '--update-env',
      ]).execute();
      syncPm2Session();
      fetchPm2List();
      showAlert(`Berhasil merubah file.`, 'success');
    } catch (error) {
      showAlert(`${error}`, 'error');
    }
  };

  // ================= DETAIL & LOG =================
  const handleOpenDetail = (proc) => {
    setSelectedProcess(proc);
    setOpenDetailDialog(true);
  };

  const handleOpenLocation = (fullPath) => {
    openLocation(fullPath, (err) => showAlert(err, 'error'));
  };
  // Menghitung string durasi online proses
  const formatUptime = (timestamp) => {
    if (!timestamp) return '0s';
    const uptimeMs = Date.now() - timestamp;
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}hari ${hours % 24}jam`;
    if (hours > 0) return `${hours}jam ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  // ================= VIEW LAYOUT =================
  return (
    <Box mt={2}>
      <Box display="flex" justifyContent="space-between" mb={2}>
        <Typography variant="h6" fontWeight="bold">
          PM2 Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            setIsEditMode(false);
            setOpenPm2Form(true);
          }}
        >
          Tambah App
        </Button>
      </Box>
      {/* TABEL UTAMA PM2 */}
      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
            <TableRow>
              <TableCell>
                <strong>ID</strong>
              </TableCell>
              <TableCell>
                <strong>Nama</strong>
              </TableCell>
              <TableCell>
                <strong>Status</strong>
              </TableCell>
              <TableCell>
                <strong>RAM</strong>
              </TableCell>
              <TableCell>
                <strong>CPU</strong>
              </TableCell>
              <TableCell align="center">
                <strong>Aksi</strong>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pm2List.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  Tidak ada proses PM2 yang berjalan
                </TableCell>
              </TableRow>
            ) : (
              pm2List.map((proc) => (
                <TableRow key={proc.pm_id}>
                  <TableCell>{proc.pm_id}</TableCell>
                  <TableCell>{proc.name}</TableCell>
                  <TableCell>
                    <Chip
                      label={proc.pm2_env.status}
                      color={
                        proc.pm2_env.status === 'online' ? 'success' : 'error'
                      }
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {(proc.monit.memory / 1024 / 1024).toFixed(1)} MB
                  </TableCell>
                  <TableCell>{proc.monit.cpu} %</TableCell>
                  <TableCell align="center">
                    <Tooltip title="View Detail">
                      <IconButton
                        color="primary"
                        onClick={() => handleOpenDetail(proc)}
                      >
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Monitor CMD">
                      <IconButton
                        color="secondary"
                        onClick={() => handleOpenExternalMonit(proc.pm_id)}
                      >
                        <MonitorHeart />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Stop">
                      <IconButton
                        color="warning"
                        onClick={() => handlePm2Action('stop', proc.name)}
                      >
                        <Stop />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Restart">
                      <IconButton
                        color="success"
                        onClick={() => handlePm2Action('restart', proc.name)}
                      >
                        <Refresh />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit .env">
                      <IconButton
                        color="secondary"
                        onClick={() => handleOpenEnv(proc)}
                      >
                        <Settings />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit App">
                      <IconButton
                        color="info"
                        onClick={() => {
                          setIsEditMode(true);
                          setPm2Form({
                            name: proc.name,
                            path: proc.pm2_env.pm_exec_path,
                            id: proc.name,
                          });
                          setOpenPm2Form(true);
                        }}
                      >
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        color="error"
                        onClick={() => handlePm2Action('delete', proc.name)}
                      >
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {/* 1. DIALOG FORM TAMBAH/EDIT PM2 */}
      <Dialog
        open={openPm2Form}
        onClose={() => setOpenPm2Form(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {isEditMode ? 'Edit Aplikasi PM2' : 'Tambah Aplikasi PM2'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Nama Aplikasi"
            fullWidth
            variant="outlined"
            value={pm2Form.name}
            onChange={(e) => setPm2Form({ ...pm2Form, name: e.target.value })}
          />
          <Box display="flex" gap={1} alignItems="center" mt={2}>
            <TextField
              label="Path File Script (JS)"
              fullWidth
              variant="outlined"
              value={pm2Form.path}
              disabled
            />
            <Button
              variant="contained"
              startIcon={<FolderOpen />}
              onClick={handleSelectFile}
              sx={{ height: '56px', whiteSpace: 'nowrap' }}
            >
              Cari
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenPm2Form(false)} color="inherit">
            Batal
          </Button>
          <Button onClick={handleSavePm2} variant="contained" color="primary">
            Simpan
          </Button>
        </DialogActions>
      </Dialog>
      {/* 2. DIALOG EDIT .ENV */}
      <Dialog
        open={openEnvDialog}
        onClose={() => setOpenEnvDialog(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          Mengedit file .env: <b>{activeAppName}</b>
        </DialogTitle>
        <DialogContent>
          <Typography
            variant="caption"
            color="textSecondary"
            sx={{ mb: 1, display: 'block' }}
          >
            Lokasi: {currentEnvPath}
          </Typography>
          <TextField
            multiline
            rows={12}
            fullWidth
            variant="outlined"
            value={envContent}
            onChange={(e) => setEnvContent(e.target.value)}
            sx={{ fontFamily: 'monospace' }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenEnvDialog(false)} color="inherit">
            Batal
          </Button>
          <Button onClick={handleSaveEnv} variant="contained" color="success">
            Simpan & Restart
          </Button>
        </DialogActions>
      </Dialog>
      {/* 3. DIALOG VIEW DETAIL PM2 */}
      <Dialog
        open={openDetailDialog}
        onClose={() => setOpenDetailDialog(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle
          sx={{
            pb: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography variant="h6" component="span" fontWeight="bold">
              Detail Proses:{' '}
            </Typography>
            <Typography variant="h6" component="span" color="primary">
              {selectedProcess?.name}
            </Typography>
          </Box>
          <Chip
            label={selectedProcess?.pm2_env.status.toUpperCase()}
            color={
              selectedProcess?.pm2_env.status === 'online' ? 'success' : 'error'
            }
            size="small"
            sx={{ fontWeight: 'bold' }}
          />
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ py: 3 }}>
          {selectedProcess && (
            <Grid container spacing={4}>
              <Grid container spacing={2}>
                {[
                  { label: 'ID Aplikasi', value: selectedProcess.pm_id },
                  {
                    label: 'Status',
                    value: selectedProcess.pm2_env.status.toUpperCase(),
                    isChip: true,
                  },
                  { label: 'Sistem PID', value: selectedProcess.pid },
                  {
                    label: 'Uptime',
                    value: formatUptime(selectedProcess.pm2_env.pm_uptime),
                  },
                  {
                    label: 'Mode Eksekusi',
                    value: selectedProcess.pm2_env.exec_mode,
                  },
                  {
                    label: 'Versi Node',
                    value: selectedProcess.pm2_env.node_version,
                  },
                  {
                    label: 'Restarts',
                    value: selectedProcess.pm2_env.restart_time,
                    color: 'warning.main',
                  },
                  {
                    label: 'Memori',
                    value: `${(selectedProcess.monit.memory / 1024 / 1024).toFixed(2)} MB`,
                  },
                ].map((item, index) => (
                  <Grid item xs={6} sm={3} key={index}>
                    <Box
                      sx={{
                        p: 1.5,
                        bgcolor: '#fcfcfd',
                        border: '1px solid #eef0f2',
                        borderRadius: 2,
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography
                        variant="caption"
                        color="textSecondary"
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.65rem',
                          textTransform: 'uppercase',
                          mb: 0.5,
                        }}
                      >
                        {item.label}
                      </Typography>

                      {item.isChip ? (
                        <Chip
                          label={item.value}
                          size="small"
                          color={item.value === 'ONLINE' ? 'success' : 'error'}
                          sx={{
                            fontWeight: 'bold',
                            fontSize: '0.7rem',
                            height: 20,
                            width: 'fit-content',
                          }}
                        />
                      ) : (
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 'bold',
                            color: item.color || 'text.primary',
                          }}
                        >
                          {item.value || 'N/A'}
                        </Typography>
                      )}
                    </Box>
                  </Grid>
                ))}
              </Grid>

              <Grid item xs={12} sx={{ width: '100%' }}>
                <Box
                  sx={{
                    mt: 1,
                    p: 2,
                    bgcolor: '#f8f9fa',
                    borderRadius: 2,
                    border: '1px solid #e0e0e0',
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    color="primary"
                    sx={{ mb: 2, fontWeight: 'bold' }}
                  >
                    Informasi Lokasi & Log
                  </Typography>

                  <PathRow
                    label="Lokasi Eksekusi"
                    path={selectedProcess.pm2_env.pm_exec_path}
                    onOpen={() =>
                      handleOpenLocation(selectedProcess.pm2_env.pm_exec_path)
                    }
                  />

                  <PathRow
                    label="Log Output (stdout)"
                    path={selectedProcess.pm2_env.pm_out_log_path}
                    onOpen={() =>
                      handleOpenLocation(
                        selectedProcess.pm2_env.pm_out_log_path,
                      )
                    }
                  />

                  <PathRow
                    label="Log Error (stderr)"
                    path={selectedProcess.pm2_env.pm_err_log_path}
                    onOpen={() =>
                      handleOpenLocation(
                        selectedProcess.pm2_env.pm_err_log_path,
                      )
                    }
                  />
                </Box>
              </Grid>
            </Grid>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, bgcolor: '#f5f5f5' }}>
          <Button
            onClick={() => setOpenDetailDialog(false)}
            variant="contained"
            disableElevation
          >
            Tutup
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
const DetailItem = ({ label, value, color = 'text.primary' }) => (
  <Box>
    <Typography
      variant="caption"
      color="textSecondary"
      sx={{ textTransform: 'uppercase', fontWeight: 600 }}
    >
      {label}
    </Typography>
    <Typography variant="body1" sx={{ color: color, fontWeight: 500 }}>
      {value}
    </Typography>
  </Box>
);
const PathRow = ({ label, path, onOpen }) => (
  <Box sx={{ mb: 2 }}>
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        mb: 0.5,
      }}
    >
      <Typography
        variant="caption"
        color="textSecondary"
        sx={{ fontWeight: 600 }}
      >
        {label}
      </Typography>
      <Button
        size="small"
        startIcon={<FolderOpen sx={{ fontSize: 16 }} />}
        onClick={onOpen}
        sx={{ py: 0, textTransform: 'none', fontSize: '0.75rem' }}
      >
        Buka Folder
      </Button>
    </Box>
    <Typography
      variant="body2"
      sx={{
        fontFamily: 'monospace',
        bgcolor: '#ffffff',
        p: 1,
        borderRadius: 1,
        border: '1px dashed #ccc',
        fontSize: '0.8rem',
        wordBreak: 'break-all',
      }}
    >
      {path}
    </Typography>
  </Box>
);

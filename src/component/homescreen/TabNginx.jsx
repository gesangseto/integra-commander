import { useEffect, useState } from 'react';

import {
  Add,
  Delete,
  Edit,
  ElectricalServices,
  Folder,
  FolderOpen,
  PlayArrow,
  PlayArrowOutlined,
  Refresh,
  Stop,
  StopCircleTwoTone,
  StopOutlined,
  Storage,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
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

// Import Tauri Plugins v2
import { open } from '@tauri-apps/plugin-dialog';
import {
  exists,
  mkdir,
  readTextFile,
  remove,
  writeTextFile,
  readDir,
} from '@tauri-apps/plugin-fs';
import { Command } from '@tauri-apps/plugin-shell';
import { useAppStore } from '../../store/pathStore'; // Sesuaikan path file store Anda
import { openLocation } from '../../utility';
import { useAlert } from '../AlertProvider';
export default function TabNginx() {
  const { showAlert } = useAlert();
  const { nginxPath, setNginxPath } = useAppStore();
  // Folder default tempat menyimpan file .conf (Hardcoded sesuai permintaan)
  const [NGINX_CONF_DIR, setNGINX_CONF_DIR] = useState(
    `${nginxPath}\\conf\\sites-enabled`,
  );
  const [nginxList, setNginxList] = useState([]);
  const [openNginxForm, setOpenNginxForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const [nginxForm, setNginxForm] = useState({
    id: null,
    name: '',
    port: '80',
    domain: '',
    target: '',
    rootPath: `${nginxPath}`, // Default root path
  });
  useEffect(() => {
    if (nginxPath) {
      setNGINX_CONF_DIR(`${nginxPath}\\conf\\sites-enabled`);
      initializeNginxConfig(nginxPath);
      fetchNginxList();
    }
  }, [nginxPath]);

  const fetchNginxList = async () => {
    try {
      // 1. Baca daftar file di folder sites-enabled
      const entries = await readDir(NGINX_CONF_DIR);
      const tempList = [];

      for (const entry of entries) {
        // Hanya proses file yang berakhiran .conf
        if (entry.isFile && entry.name.endsWith('.conf')) {
          const filePath = `${NGINX_CONF_DIR}\\${entry.name}`;
          const content = await readTextFile(filePath);

          // 2. Ekstrak data menggunakan REGEX
          const domainMatch = content.match(/server_name\s+(.+);/);
          const portMatch = content.match(/listen\s+(\d+);/);
          const rootMatch = content.match(/root\s+"(.+)";/);
          const proxyMatch = content.match(/proxy_pass\s+(.+);/);

          tempList.push({
            id: Math.random(), // ID sementara untuk UI
            name: entry.name.replace('.conf', ''),
            fileName: entry.name,
            domain: domainMatch ? domainMatch[1] : 'N/A',
            port: portMatch ? portMatch[1] : '80',
            rootPath: rootMatch ? rootMatch[1] : '',
            target: proxyMatch ? proxyMatch[1] : '',
          });
        }
      }

      setNginxList(tempList);
    } catch (err) {
      console.error('Gagal sinkronisasi folder Nginx:', err);
    }
  };
  const handleBrowseFolder = async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: true, // Mode pilih folder
      });

      if (selected) {
        console.log(selected);

        // Simpan path baru ke Zustand (otomatis tersimpan ke LocalStorage)
        setNginxPath(selected);
      }
    } catch (error) {
      console.error('Gagal memilih folder:', error);
    }
  };
  // Fungsi pilih folder root untuk setiap host
  const handleSelectRoot = async () => {
    try {
      const selected = await open({ multiple: false, directory: true });
      if (selected) {
        setNginxForm({ ...nginxForm, rootPath: selected });
      }
    } catch (error) {
      console.error('Error selecting root folder:', error);
    }
  };

  const reloadNginx = async () => {
    try {
      const cmd = Command.create('run-command', [
        '/C',
        'nginx',
        '-p',
        nginxPath,
        '-s',
        'reload',
      ]);
      const output = await cmd.execute();
      if (output.code === 0) alert('Nginx Reload Success!');
      else alert('Gagal Reload. Pastikan nginx.exe ada di PATH.');

      console.log(output);
    } catch (err) {
      alert('Error: ' + err);
    }
  };

  const openFolder = (item) => {
    openLocation(item?.rootPath, (err) => showAlert(err, 'error'));
  };

  const handleSaveNginx = async () => {
    if (!nginxForm.name || !nginxForm.domain)
      return alert('Nama dan Domain wajib diisi!');

    try {
      // 1. Pastikan folder NGINX_CONF_DIR tersedia
      // Jika folder 'sites-enabled' belum ada, kita buat secara otomatis
      const isFolderExist = await exists(NGINX_CONF_DIR);
      if (!isFolderExist) {
        await mkdir(NGINX_CONF_DIR, { recursive: true });
      }

      const fileName = `${nginxForm.name.toLowerCase().replace(/\s+/g, '-')}.conf`;

      // Gunakan join path manual yang aman untuk Windows
      const fullConfPath = `${NGINX_CONF_DIR.replace(/[\\/]$/, '')}\\${fileName}`;

      // 2. Konfigurasi Nginx
      const configContent = `server {
    listen ${nginxForm.port};
    server_name ${nginxForm.domain};

    root "${nginxForm.rootPath.replace(/\\/g, '/')}";
    index index.html index.htm;

    location / {
        try_files $uri $uri/ @proxy;
    }

    location @proxy {
        ${nginxForm.target ? `proxy_pass ${nginxForm.target};` : '# No proxy pass'}
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}`;

      // 3. Tulis file
      await writeTextFile(fullConfPath, configContent);

      // 4. Update State
      if (isEditMode) {
        setNginxList(
          nginxList.map((item) =>
            item.id === nginxForm.id ? { ...nginxForm, fileName } : item,
          ),
        );
      } else {
        setNginxList([
          ...nginxList,
          { ...nginxForm, id: Date.now(), fileName },
        ]);
      }

      await reloadNginx();
      setOpenNginxForm(false);
      alert('Konfigurasi berhasil disimpan!');
    } catch (err) {
      console.error('Error Detail:', err);
      // Menampilkan pesan error spesifik dari OS (seperti Permission Denied)
      alert(
        `Gagal: ${err}. \n\nPastikan aplikasi berjalan sebagai Administrator jika menulis di Drive C.`,
      );
    }
  };

  const handleDeleteNginx = async (item) => {
    console.log(item);

    if (!window.confirm(`Hapus konfigurasi ${item.name}?`)) return;
    try {
      console.log(`${NGINX_CONF_DIR}\\${item.fileName}`);

      await remove(`${NGINX_CONF_DIR}\\${item.fileName}`);
      setNginxList(nginxList.filter((site) => site.id !== item.id));
      await reloadNginx();
    } catch (err) {
      console.log(err);

      alert('Gagal menghapus file .conf');
    }
  };

  const handleStartNginx = async () => {
    try {
      // We use 'start' command so the terminal window doesn't hang the app
      const cmd = Command.create('run-command', [
        '/C',
        'start',
        '/B', // Runs in background
        'nginx.exe',
        '-p',
        nginxPath,
      ]);

      cmd.execute();
      alert('Nginx started successfully!');
    } catch (err) {
      alert('Error: ' + err);
    }
  };
  const handleStopNginx = async () => {
    try {
      // Gunakan taskkill untuk memastikan Nginx benar-benar mati total di Windows
      const cmd = await Command.create('run-command', [
        '/C',
        'taskkill /F /IM nginx.exe /T',
      ]).execute();

      if (cmd.code === 0) {
        alert('Nginx Berhasil Dihentikan!');
      } else {
        alert('Nginx memang sedang tidak berjalan.');
      }
    } catch (err) {
      alert('Error Stop: ' + err);
    }
  };
  const initializeNginxConfig = async (nginxPath) => {
    try {
      const mainConfPath = `${nginxPath}\\conf\\nginx.conf`;
      const sitesEnabledDir = `${nginxPath}\\conf\\sites-enabled`;

      // 1. Pastikan folder sites-enabled ada
      if (!(await exists(sitesEnabledDir))) {
        await mkdir(sitesEnabledDir, { recursive: true });
      }

      // 2. Baca file nginx.conf utama
      let content = await readTextFile(mainConfPath);

      // 3. Cek apakah sudah ada include sites-enabled
      if (content.includes('include sites-enabled/*.conf;')) {
        console.log('Konfigurasi sudah benar.');
        return true;
      }

      // 4. Logic Penyisipan: Cari kurung kurawal tutup terakhir dari blok http
      // Kita mencari '}' terakhir yang biasanya menutup blok http
      const lastIndex = content.lastIndexOf('}');

      if (lastIndex !== -1) {
        const newContent =
          content.substring(0, lastIndex) +
          '\n    # Added by Mertrack Manager\n    include sites-enabled/*.conf;\n' +
          content.substring(lastIndex);

        await writeTextFile(mainConfPath, newContent);
        alert('Nginx.conf berhasil di-patch! Folder sites-enabled diaktifkan.');
        return true;
      }
    } catch (err) {
      console.error('Gagal inisialisasi Nginx:', err);
      alert('Gagal mengedit nginx.conf. Pastikan path benar dan Run as Admin.');
      return false;
    }
  };
  return (
    <Box mt={2}>
      <Box sx={{ mb: 4 }}>
        {/* Bagian Atas: Info Lokasi Nginx (Global) */}
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            mb: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            bgcolor: '#f8f9fa',
            borderRadius: 2,
          }}
        >
          <Box sx={{ flexGrow: 1 }}>
            <Typography
              variant="caption"
              color="textSecondary"
              fontWeight="bold"
              sx={{ ml: 1 }}
            >
              NGINX BASE DIRECTORY
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={nginxPath} // Gunakan nginxPath dari store, bukan rootPath form
              InputProps={{
                readOnly: true,
                startAdornment: (
                  <FolderOpen
                    fontSize="small"
                    sx={{ mr: 1, color: 'action.active' }}
                  />
                ),
              }}
              sx={{ bgcolor: 'white', mt: 0.5 }}
            />
          </Box>
          <Button
            variant="outlined"
            color="primary"
            onClick={handleBrowseFolder}
            startIcon={<FolderOpen />}
            sx={{ height: 40, mt: 2.5 }}
          >
            Ubah Path
          </Button>
        </Paper>

        {/* Bagian Bawah: Header Tabel & Kontrol Service */}
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" fontWeight="bold" color="primary.main">
            Host Management
          </Typography>

          <Box display="flex" alignItems="center" gap={1.5}>
            {/* Group Service Control */}
            <Paper
              variant="outlined"
              sx={{
                display: 'flex',
                p: 0.5,
                borderRadius: 2,
                bgcolor: '#fff',
                boxShadow: '0px 2px 4px rgba(0,0,0,0.05)',
              }}
            >
              <Tooltip title="Start Nginx">
                <IconButton
                  color="success"
                  onClick={handleStartNginx}
                  size="small"
                >
                  <PlayArrow />
                </IconButton>
              </Tooltip>
              <Tooltip title="Stop Nginx">
                <IconButton
                  color="error"
                  onClick={handleStopNginx}
                  size="small"
                >
                  <Stop />
                </IconButton>
              </Tooltip>
              <Tooltip title="Reload Configuration">
                <IconButton color="warning" onClick={reloadNginx} size="small">
                  <Refresh />
                </IconButton>
              </Tooltip>
            </Paper>

            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => {
                setIsEditMode(false);
                setNginxForm({
                  id: null,
                  name: '',
                  port: '80',
                  domain: '',
                  target: '',
                  rootPath: 'C:\\nginx\\html',
                });
                setOpenNginxForm(true);
              }}
              sx={{ borderRadius: 2, px: 3 }}
            >
              Tambah Host
            </Button>
          </Box>
        </Box>
      </Box>

      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ borderRadius: 2 }}
      >
        <Table>
          <TableHead sx={{ backgroundColor: '#f8f9fa' }}>
            <TableRow>
              <TableCell>
                <strong>Nama Config</strong>
              </TableCell>
              <TableCell>
                <strong>Domain / Port</strong>
              </TableCell>
              <TableCell>
                <strong>Root Path</strong>
              </TableCell>
              <TableCell>
                <strong>Proxy Target</strong>
              </TableCell>
              <TableCell align="center">
                <strong>Aksi</strong>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {nginxList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  Belum ada data.
                </TableCell>
              </TableRow>
            ) : (
              nginxList.map((site) => (
                <TableRow key={site.id}>
                  <TableCell>{site.name}</TableCell>
                  <TableCell>
                    {site.domain}:{site.port}
                  </TableCell>
                  <TableCell>
                    <Tooltip title={site.rootPath}>
                      <Typography
                        variant="body2"
                        noWrap
                        sx={{ maxWidth: 200, fontFamily: 'monospace' }}
                      >
                        {site.rootPath}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>
                    {site.target || '-'}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      color="warning"
                      onClick={() => openFolder(site)}
                    >
                      <Folder />
                    </IconButton>
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
                    <IconButton
                      color="error"
                      onClick={() => handleDeleteNginx(site)}
                    >
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={openNginxForm}
        onClose={() => setOpenNginxForm(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{isEditMode ? 'Edit Host' : 'Tambah Host'}</DialogTitle>
        <Divider />
        <DialogContent
          sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 3 }}
        >
          <TextField
            label="Nama Config"
            fullWidth
            value={nginxForm.name}
            disabled={isEditMode}
            onChange={(e) =>
              setNginxForm({ ...nginxForm, name: e.target.value })
            }
            placeholder="mertrack-api"
          />

          <Box display="flex" gap={2}>
            <TextField
              label="Domain / IP"
              fullWidth
              value={nginxForm.domain}
              onChange={(e) =>
                setNginxForm({ ...nginxForm, domain: e.target.value })
              }
              placeholder="localhost"
            />
            <TextField
              label="Port"
              sx={{ width: 120 }}
              value={nginxForm.port}
              onChange={(e) =>
                setNginxForm({ ...nginxForm, port: e.target.value })
              }
            />
          </Box>

          <Box>
            <Typography
              variant="caption"
              color="textSecondary"
              fontWeight="bold"
            >
              ROOT DIRECTORY
            </Typography>
            <Box display="flex" gap={1} mt={0.5}>
              <TextField
                fullWidth
                size="small"
                value={nginxForm.rootPath}
                InputProps={{
                  readOnly: true,
                  startAdornment: (
                    <Folder sx={{ mr: 1, color: 'gray' }} fontSize="small" />
                  ),
                }}
              />
              <Button
                variant="outlined"
                onClick={handleSelectRoot}
                startIcon={<Storage />}
              >
                Browse
              </Button>
            </Box>
          </Box>

          <TextField
            label="Proxy Pass (Opsional)"
            fullWidth
            value={nginxForm.target}
            onChange={(e) =>
              setNginxForm({ ...nginxForm, target: e.target.value })
            }
            placeholder="http://localhost:5000"
            InputProps={{
              startAdornment: (
                <ElectricalServices
                  sx={{ mr: 1, color: 'gray' }}
                  fontSize="small"
                />
              ),
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: '#f9f9f9' }}>
          <Button onClick={() => setOpenNginxForm(false)}>Batal</Button>
          <Button onClick={handleSaveNginx} variant="contained">
            Simpan & Apply
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

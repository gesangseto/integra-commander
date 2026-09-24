import { useEffect, useState } from 'react';

import {
  Delete,
  Folder,
  FolderOpen,
  PlayArrow,
  Refresh,
  RocketLaunch,
  Stop,
} from '@mui/icons-material';
import {
  Box,
  Button,
  CircularProgress,
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

// Import Tauri Plugins v2
import { open } from '@tauri-apps/plugin-dialog';
import {
  exists,
  mkdir,
  readDir,
  readTextFile,
  remove,
  writeTextFile,
} from '@tauri-apps/plugin-fs';
import { Command } from '@tauri-apps/plugin-shell';
import { useAppStore } from '../../store/pathStore'; // Sesuaikan path file store Anda
import { useSettingStore } from '../../store/settingStore';
import { openLocation } from '../../utility';
import { useAlert } from '../AlertProvider';
import DialogGitAuthentication from '../DialogGitAuthentication';
import { gitCloneFe } from '../../utility/gitUtility';
import { useConfirm } from '../ConfirmProvider';

const DEPLOY_APPS = [
  {
    key: 'frontend',
    title: 'Install / Update Mertrack Frontend',
    description: 'Install + nginx',
  },
];

const FRONTEND_CONFIG_FILE = 'MERTRACK-FRONTEND.conf';

export default function TabNginx() {
  const { showAlert } = useAlert();
  const { confirm: showConfirm } = useConfirm();
  const { nginxPath, setNginxPath } = useAppStore();
  const [NGINX_CONF_DIR, setNGINX_CONF_DIR] = useState(
    `${nginxPath}\\conf\\sites-enabled`,
  );
  const setting = useSettingStore((state) => state.form);
  const [gitForm, setGitForm] = useState({ username: '', password: '' });
  const [openGitDialog, setOpenGitDialog] = useState(false);
  const [selectedDeploy, setSelectedDeploy] = useState('');
  const [openDeployDialog, setOpenDeployDialog] = useState(false);
  const [deployLoading, setDeployLoading] = useState('');
  const [deletingConfig, setDeletingConfig] = useState('');
  const [deployLogs, setDeployLogs] = useState([]);

  const [nginxList, setNginxList] = useState([]);

  const tempDir = `${setting.workingDirectory}\\temp`;
  const serviceDir = `${setting.workingDirectory}\\public`;
  useEffect(() => {
    if (nginxPath) {
      setNGINX_CONF_DIR(`${nginxPath}\\conf\\sites-enabled`);
      initializeNginxConfig(nginxPath);
      fetchNginxList();
    }
  }, [nginxPath]);

  const runCommand = async (args, cwd) => {
    appendLog(args.join(' '));
    const cmd = Command.create('run-command', args, {
      cwd,
    });
    const output = await cmd.execute();
    if (output.stderr) {
      appendLog(output.stderr);
    }
    return output;
  };
  const appendLog = (msg) => {
    setDeployLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${msg}`,
    ]);
  };

  // helper update/add env
  const setEnvValue = (content, key, value) => {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      return content.replace(regex, `${key}="${value}"`);
    }
    return `${content.trim()}\n${key}="${value}"\n`;
  };

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
            id: entry.name,
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
        // Simpan path baru ke Zustand (otomatis tersimpan ke LocalStorage)
        setNginxPath(selected);
      }
    } catch (error) {
      console.error('Gagal memilih folder:', error);
    }
  };

  const reloadNginx = async ({
    notifySuccess = true,
    notifyError = true,
  } = {}) => {
    try {
      if (!nginxPath) throw new Error('Nginx path belum dikonfigurasi.');

      const validation = await Command.create('run-command', [
        '/C',
        'nginx',
        '-p',
        nginxPath,
        '-t',
      ]).execute();
      if (validation.code !== 0) {
        throw new Error(
          validation.stderr ||
            validation.stdout ||
            'Konfigurasi Nginx tidak valid.',
        );
      }

      const output = await Command.create('run-command', [
        '/C',
        'nginx',
        '-p',
        nginxPath,
        '-s',
        'reload',
      ]).execute();
      if (output.code !== 0) {
        throw new Error(
          output.stderr ||
            output.stdout ||
            'Nginx gagal melakukan reload konfigurasi.',
        );
      }
      if (notifySuccess) showAlert('Nginx reload successfully.', 'success');
      return true;
    } catch (err) {
      if (notifyError) showAlert(`${err}`, 'error');
      return false;
    }
  };

  const openFolder = (item) => {
    openLocation(item?.rootPath, (err) => showAlert(err, 'error'));
  };

  const handleDeploy = async (type) => {
    if (!nginxPath || !setting.workingDirectory || !setting.frontendPort) {
      showAlert(
        'Nginx path, working directory, dan frontend port wajib dikonfigurasi sebelum deployment.',
        'error',
      );
      return;
    }

    const frontendPort = Number(setting.frontendPort);
    if (
      !Number.isInteger(frontendPort) ||
      frontendPort < 1 ||
      frontendPort > 65535
    ) {
      showAlert('Frontend port harus berupa angka antara 1 dan 65535.', 'error');
      return;
    }

    setDeployLoading(type);
    setDeployLogs([]);

    try {
      // Hapus folder temp
      await runCommand(
        ['/C', 'rmdir', '/S', '/Q', tempDir],
        setting.workingDirectory,
      ).catch(() => {});
      // =====================================================
      // START DEPLOYMENT
      // =====================================================
      appendLog('Starting deployment...');
      // =====================================================
      // CLONE REPOSITORY
      // =====================================================
      appendLog('Cloning repository...');
      let cloneResult;
      if (setting.frontendBranch) {
        cloneResult = await gitCloneFe({
          ...gitForm,
          directory: tempDir,
          branch: setting.frontendBranch,
        });
      } else {
        cloneResult = await gitCloneFe({ ...gitForm, directory: tempDir });
      }
      if (cloneResult.error) {
        throw new Error(cloneResult.message);
      }
      // =====================================================
      // UPDATE FILE .ENV
      // =====================================================
      // Variable environment yang akan diupdate
      let envField = {
        VUE_APP_URL_API_MERTRACK: `http://${setting.serverIp}:${setting.backendPort}`,
        VUE_APP_DEFAULT_DATE_FILTER: setting.rangeTransaction,
      };
      appendLog('Updating .env file...');
      // Path file .env
      const envPath = `${tempDir}\\.env`;
      // Isi env existing
      let currentEnv = '';
      try {
        // Membaca .env jika ada
        currentEnv = await readTextFile(envPath);
      } catch {
        // Jika tidak ada maka buat baru
        appendLog('.env not found, creating new file...');
      }
      // Loop semua envField lalu update/add ke .env
      for (const key in envField) {
        currentEnv = setEnvValue(currentEnv, key, envField[key] || '');
      }
      // Simpan hasil env terbaru
      await writeTextFile(envPath, currentEnv);
      // =====================================================
      // INSTALL DEPENDENCIES
      // =====================================================
      appendLog('Installing dependencies...');
      await runCommand(['/C', 'npm', 'install'], tempDir);
      // =====================================================
      // BUILD PROJECT
      // =====================================================
      appendLog('Building application...');
      // npm run build
      await runCommand(['/C', 'npm', 'run', 'build'], tempDir);
      // =====================================================
      // COPY BUILD OUTPUT TO NGINX PUBLIC DIRECTORY
      // =====================================================
      appendLog('Copying build output to public directory...');
      await runCommand(
        ['/C', 'xcopy', `${tempDir}\\dist`, serviceDir, '/E', '/I', '/Y'],
        setting.workingDirectory,
      );
      // =====================================================
      // UPDATE NGINX ACTIVE SITES
      // =====================================================
      const configSaved = await handleSaveNginx();
      if (!configSaved) throw new Error('Gagal menyimpan konfigurasi Nginx.');
      // =====================================================
      // HAPUS TEMP DIRECTORY
      // =====================================================
      appendLog('Cleaning temp directory...');
      // Hapus folder temp
      await runCommand(
        ['/C', 'rmdir', '/S', '/Q', tempDir],
        setting.workingDirectory,
      );
      showAlert('Deployment success', 'success');
    } catch (err) {
      showAlert(`${err}`, 'error');
      appendLog(`Deployment failed: ${err}`);
    } finally {
      setDeployLoading('');
      appendLog('Done deployment process');
    }
  };

  const handleSaveNginx = async () => {
    try {
      // 1. Pastikan folder NGINX_CONF_DIR tersedia
      // Jika folder 'sites-enabled' belum ada, kita buat secara otomatis
      const isFolderExist = await exists(NGINX_CONF_DIR);
      if (!isFolderExist) {
        await mkdir(NGINX_CONF_DIR, { recursive: true });
      }

      const fileName = FRONTEND_CONFIG_FILE;

      // Gunakan join path manual yang aman untuk Windows
      const fullConfPath = `${NGINX_CONF_DIR.replace(/[\\/]$/, '')}\\${fileName}`;

      // 2. Konfigurasi Nginx
      const configContent = `server {
    listen ${setting.frontendPort};
    server_name localhost;
    root "${serviceDir.replace(/\\/g, '/')}";
    index index.html index.htm;
    location / {
          try_files $uri /index.html;
    }
}`;

      // 3. Tulis file
      await writeTextFile(fullConfPath, configContent);

      await fetchNginxList();
      if (!(await reloadNginx({ notifySuccess: false, notifyError: false }))) {
        throw new Error('Konfigurasi Nginx tidak disimpan karena validasi gagal.');
      }
      showAlert('Configuration has been saved successfully!.', 'success');
      return true;
    } catch (err) {
      showAlert(`${err}`, 'error');
      return false;
    }
  };

  const handleDeleteNginx = async (item) => {
    if (deployLoading || deletingConfig) return;

    const shouldDeleteConfig = await showConfirm({
      title: 'Hapus Konfigurasi Frontend',
      message: `Hapus konfigurasi Nginx "${item.name}"?`,
      severity: 'danger',
    });
    if (!shouldDeleteConfig) return;

    setDeletingConfig(item.fileName);
    try {
      await remove(`${NGINX_CONF_DIR}\\${item.fileName}`);
      if (!(await reloadNginx({ notifySuccess: false, notifyError: false }))) {
        throw new Error(
          'Konfigurasi terhapus, tetapi Nginx gagal melakukan reload.',
        );
      }
      await fetchNginxList();

      const canDeleteDeployment =
        item.fileName === FRONTEND_CONFIG_FILE &&
        item.rootPath.replace(/[\\/]+$/, '').toLowerCase() ===
          serviceDir.replace(/[\\/]+$/, '').toLowerCase();
      let shouldDeleteDeployment = false;

      if (canDeleteDeployment) {
        shouldDeleteDeployment = await showConfirm({
          title: 'Hapus File Deployment',
          message: `Hapus seluruh file hasil deployment frontend di "${serviceDir}"? Jangan pilih OK jika folder tersebut digunakan aplikasi lain.`,
          severity: 'danger',
        });

        if (shouldDeleteDeployment && (await exists(serviceDir))) {
          const entries = await readDir(serviceDir);
          await Promise.all(
            entries.map((entry) =>
              remove(`${serviceDir}\\${entry.name}`, { recursive: true }),
            ),
          );
        }
      }

      showAlert(
        shouldDeleteDeployment
          ? 'Konfigurasi Nginx dan file frontend berhasil dihapus.'
          : canDeleteDeployment
            ? 'Konfigurasi Nginx berhasil dihapus. File frontend tetap dipertahankan.'
            : 'Konfigurasi Nginx berhasil dihapus.',
        'success',
      );
    } catch (err) {
      showAlert(`${err}`, 'error');
    } finally {
      setDeletingConfig('');
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

      const output = await cmd.execute();
      if (output.code !== 0) {
        throw new Error(
          output.stderr || output.stdout || 'Nginx gagal dijalankan.',
        );
      }
      showAlert('Nginx started successfully', 'success');
    } catch (err) {
      showAlert(`${err}`, 'error');
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
        showAlert('Nginx stopped successfully', 'success');
      } else {
        showAlert('Nginx has already stopped', 'success');
      }
    } catch (err) {
      showAlert(`${err}`, 'error');
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
        showAlert(
          'nginx.conf has been patched successfully! The sites-enabled folder has been enabled.',
          'success',
        );
        return true;
      }
    } catch (err) {
      showAlert(
        `Failed to edit nginx.conf. Please ensure the path is correct and run the application as Administrator.\n${err}`,
        'error',
      );
      return false;
    }
  };
  return (
    <Box
      mt={1}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <Box sx={{ mb: 2 }}>
        {/* Bagian Atas: Info Lokasi Nginx (Global) */}
        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            mb: 2,
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
            sx={{ height: 36, mt: 2.5 }}
          >
            Ubah Path
          </Button>
          <Tooltip title="Start Nginx">
            <IconButton
              sx={{ height: 36, mt: 2.5 }}
              color="success"
              onClick={handleStartNginx}
              disabled={!nginxPath}
              size="small"
            >
              <PlayArrow />
            </IconButton>
          </Tooltip>
          <Tooltip title="Stop Nginx">
            <IconButton
              sx={{ height: 36, mt: 2.5 }}
              color="error"
              onClick={handleStopNginx}
              size="small"
            >
              <Stop />
            </IconButton>
          </Tooltip>
          <Tooltip title="Reload Configuration">
            <IconButton
              sx={{ height: 36, mt: 2.5 }}
              color="warning"
              onClick={reloadNginx}
              disabled={!nginxPath}
              size="small"
            >
              <Refresh />
            </IconButton>
          </Tooltip>
        </Paper>

        {/* Bagian Bawah: Header Tabel & Kontrol Service */}
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" fontWeight="bold" color="primary.main">
            NGINX Management
          </Typography>

          <Box display="flex" alignItems="center" gap={1.5}>
            {/* Group Service Control */}
            <Button
              variant="contained"
              startIcon={<RocketLaunch />}
              onClick={() => setOpenDeployDialog(true)}
            >
              Tambah / Update App
            </Button>
          </Box>
        </Box>
      </Box>
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ flex: 1, minHeight: 0, overflow: 'auto', borderRadius: 2 }}
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
            {!nginxPath ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  Path Nginx belum dikonfigurasi. Silakan pilih folder Nginx
                  terlebih dahulu.
                </TableCell>
              </TableRow>
            ) : nginxList.length === 0 ? (
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
                      color="error"
                      onClick={() => handleDeleteNginx(site)}
                      disabled={deployLoading !== '' || deletingConfig !== ''}
                    >
                      {deletingConfig === site.fileName ? (
                        <CircularProgress size={20} />
                      ) : (
                        <Delete />
                      )}
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Dialog
        open={openDeployDialog}
        onClose={() => setOpenDeployDialog(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Deployment Manager</DialogTitle>

        <DialogContent>
          <Grid container spacing={2}>
            {DEPLOY_APPS.map((app) => (
              <Grid item xs={12} md={6} key={app.key}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    minWidth: 320,
                  }}
                >
                  <Typography variant="h6" fontWeight="bold">
                    {app.title}
                  </Typography>

                  <Typography variant="body2" color="text.secondary" mt={1}>
                    {app.description}
                  </Typography>

                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={
                      deployLoading === app.key ? (
                        <CircularProgress size={20} />
                      ) : (
                        <RocketLaunch />
                      )
                    }
                    sx={{ mt: 3 }}
                    disabled={deployLoading !== ''}
                    onClick={() => {
                      setSelectedDeploy(app.key);
                      setOpenGitDialog(true);
                    }}
                  >
                    {deployLoading === app.key ? 'Processing...' : 'Execute'}
                  </Button>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle1" fontWeight="bold" mb={1}>
            Deployment Logs
          </Typography>

          <Paper
            variant="outlined"
            sx={{
              p: 2,
              bgcolor: '#111',
              color: '#00ff90',
              height: 200,
              overflow: 'auto',
              fontFamily: 'monospace',
              fontSize: 13,
            }}
          >
            {deployLogs.length === 0 ? (
              <Typography variant="body2">No logs...</Typography>
            ) : (
              deployLogs.map((log, idx) => <Box key={idx}>{log}</Box>)
            )}
          </Paper>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setDeployLogs([])}>Clear</Button>
          <Button onClick={() => setOpenDeployDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      <DialogGitAuthentication
        open={openGitDialog}
        onClose={() => setOpenGitDialog(false)}
        gitForm={gitForm}
        setGitForm={setGitForm}
        loading={deployLoading !== ''}
        onSubmit={async () => {
          setOpenGitDialog(false);
          await handleDeploy(selectedDeploy, gitForm);
        }}
      />
    </Box>
  );
}

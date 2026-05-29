import {
  Delete,
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

import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { Command } from '@tauri-apps/plugin-shell';

import { useAlert } from '../AlertProvider';
import { openLocation } from '../../utility';
import { useSettingStore } from '../../store/settingStore';
import DialogGitAuthentication from '../DialogGitAuthentication';

const DEPLOY_APPS = [
  {
    key: 'api_core_fresh',
    title: 'Fresh Install Api Core Mertrack',
    description: 'Install + Seeder + PM2',
  },
  {
    key: 'api_core_update',
    title: 'Install / Update Api Core Mertrack',
    description: 'Pull latest source & reload PM2',
  },
  {
    key: 'bpom_api',
    title: 'Install / Update BPOM API',
    description: 'Deploy BPOM API service',
  },
  {
    key: 'logrotate',
    title: 'Install Logrotate',
    description: 'Setup PM2 log rotation',
  },
];

export default function TabPm2() {
  const { showAlert } = useAlert();
  const [openGitDialog, setOpenGitDialog] = useState(false);
  const [selectedDeploy, setSelectedDeploy] = useState('');
  const [gitForm, setGitForm] = useState({
    username: '',
    password: '',
  });
  const setting = useSettingStore((state) => state.form);

  const [pm2List, setPm2List] = useState([]);

  const [openEnvDialog, setOpenEnvDialog] = useState(false);
  const [openDetailDialog, setOpenDetailDialog] = useState(false);
  const [openDeployDialog, setOpenDeployDialog] = useState(false);

  const [envContent, setEnvContent] = useState('');
  const [currentEnvPath, setCurrentEnvPath] = useState('');
  const [activeAppName, setActiveAppName] = useState('');
  const [selectedProcess, setSelectedProcess] = useState(null);

  const [deployLoading, setDeployLoading] = useState('');
  const [deployLogs, setDeployLogs] = useState([]);

  useEffect(() => {
    fetchPm2List();

    const interval = setInterval(fetchPm2List, 10000);

    return () => clearInterval(interval);
  }, []);

  const appendLog = (msg) => {
    setDeployLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${msg}`,
    ]);
  };

  const runCommand = async (args, cwd) => {
    appendLog(args.join(' '));
    const cmd = Command.create('run-command', args, {
      cwd,
    });
    const output = await cmd.execute();
    // if (output.stdout) {
    //   appendLog(output.stdout);
    // }
    if (output.stderr) {
      appendLog(output.stderr);
    }
    return output;
  };

  const fetchPm2List = async () => {
    try {
      const pm2 = Command.create('run-command', ['/C', 'pm2', 'jlist']);

      const output = await pm2.execute();

      if (output.stdout) {
        setPm2List(JSON.parse(output.stdout));
      }
    } catch (error) {
      showAlert(`${error}`, 'error');
    }
  };

  const syncPm2Session = async () => {
    await Command.create('run-command', [
      '/C',
      'pm2',
      'save',
      '--force',
    ]).execute();
  };

  const handlePm2Action = async (action, identifier) => {
    try {
      await Command.create('run-command', [
        '/C',
        'pm2',
        action,
        identifier,
      ]).execute();

      await new Promise((r) => setTimeout(r, 500));

      syncPm2Session();

      fetchPm2List();
    } catch (error) {
      showAlert(`${error}`, 'error');
    }
  };

  const handleOpenExternalMonit = async (procId) => {
    try {
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

  const handleOpenEnv = async (proc) => {
    try {
      const scriptPath = proc.pm2_env.pm_exec_path;

      const lastSlash = Math.max(
        scriptPath.lastIndexOf('\\'),
        scriptPath.lastIndexOf('/'),
      );

      const directory = scriptPath.substring(0, lastSlash);

      const envFilePath = `${directory}\\.env`;

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

  const handleOpenDetail = (proc) => {
    setSelectedProcess(proc);

    setOpenDetailDialog(true);
  };

  const handleOpenLocation = (fullPath) => {
    openLocation(fullPath, (err) => showAlert(err, 'error'));
  };

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
  const handleDeploy = async (type) => {
    try {
      // =====================================================
      // START DEPLOYMENT
      // =====================================================
      // Menandai deploy sedang berjalan
      setDeployLoading(type);
      // Reset log deployment sebelumnya
      setDeployLogs([]);
      // Tambahkan log awal
      appendLog('Starting deployment...');

      // =====================================================
      // INSTALL PM2 LOGROTATE
      // =====================================================
      // Jika user memilih install logrotate
      // maka tidak perlu proses clone/build
      if (type === 'logrotate') {
        await runCommand(['/C', 'pm2', 'install', 'pm2-logrotate'], 'C:\\');
        appendLog('Logrotate installed');
        return;
      }

      // =====================================================
      // MENENTUKAN NAMA SERVICE
      // =====================================================
      // Tentukan nama PM2 service berdasarkan type deployment
      const serviceName =
        type === 'api_core_fresh' || type === 'api_core_update'
          ? setting.appName
          : 'BPOM-API';

      // =====================================================
      // MENENTUKAN REPOSITORY GIT
      // =====================================================
      // Tentukan repository git berdasarkan service
      const gitUrl =
        type === 'api_core_fresh' || type === 'api_core_update'
          ? 'https://gitlab.com/mertrack/mertrack-core'
          : 'https://gitlab.com/gesang/connector-bpom';

      // =====================================================
      // MEMBENTUK URL AUTHENTICATION GIT
      // =====================================================

      // Menyisipkan username + password/token
      // agar git clone private repository bisa berjalan
      const authUrl = gitUrl.replace(
        'https://',
        `https://${encodeURIComponent(gitForm.username)}:${encodeURIComponent(gitForm.password)}@`,
      );

      // =====================================================
      // MENENTUKAN DIRECTORY
      // =====================================================

      // Folder temporary clone git
      const tempDir = `${setting.workingDirectory}\\temp\\${serviceName}`;
      // Folder hasil build
      const buildDir = `${setting.workingDirectory}\\temp\\${serviceName}\\build`;
      // Folder final service production
      const serviceDir = `${setting.workingDirectory}\\service`;

      // =====================================================
      // CLONE REPOSITORY
      // =====================================================

      appendLog('Cloning repository...');

      // Clone latest source code
      await runCommand(
        ['/C', 'git', 'clone', '--depth', '1', authUrl, tempDir],
        setting.workingDirectory,
      );

      // =====================================================
      // UPDATE FILE .ENV
      // =====================================================
      // Variable environment yang akan diupdate
      let envField = {
        APP_NAME: setting.appName,
        APP_PORT: setting.backendPort,
        LOGIN_TIMEOUT: 15,
        DB_DATABASE: setting.databaseName,
        DB_USER: setting.databaseUser,
        DB_PASSWORD: setting.databasePassword,
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
      // npm install
      await runCommand(['/C', 'npm', 'install'], tempDir);

      // =====================================================
      // BUILD PROJECT
      // =====================================================
      appendLog('Building application...');
      // npm run build
      await runCommand(['/C', 'npm', 'run', 'build'], tempDir);

      // =====================================================
      // COPY BUILD KE SERVICE PRODUCTION
      // =====================================================
      appendLog('Copying build to service...');
      // Copy seluruh build ke folder service
      await runCommand(
        ['/C', 'xcopy', buildDir, serviceDir, '/E', '/I', '/Y'],
        setting.workingDirectory,
      );
      // Copy seluruh node_module ke folder service
      await runCommand(
        [
          '/C',
          'xcopy',
          `${tempDir}\\node_modules`,
          `${serviceDir}\\node_modules`,
          '/E',
          '/I',
          '/Y',
        ],
        setting.workingDirectory,
      );

      // =====================================================
      // CHECK PM2 SERVICE
      // =====================================================
      appendLog('Checking PM2 service...');
      // Ambil list PM2
      const pm2 = await runCommand(
        ['/C', 'pm2', 'jlist'],
        setting.workingDirectory,
      );

      // =====================================================
      // RELOAD ATAU START PM2
      // =====================================================
      // Jika service sudah ada
      if (pm2.stdout.includes(`"name":"${serviceName}"`)) {
        appendLog('Reloading PM2 service...');
        // Reload PM2
        await runCommand(['/C', 'pm2', 'reload', serviceName], serviceDir);
      } else {
        appendLog('Starting PM2 service...');
        // Start PM2 baru
        await runCommand(
          ['/C', 'pm2', 'start', `${serviceName}.js`, '--name', serviceName],
          serviceDir,
        );
      }

      // =====================================================
      // SAVE PM2 SESSION
      // =====================================================
      appendLog('Saving PM2 session...');
      // Simpan agar auto startup saat reboot
      await syncPm2Session();

      // =====================================================
      // HAPUS TEMP DIRECTORY
      // =====================================================
      appendLog('Cleaning temp directory...');
      // Hapus folder temp
      await runCommand(
        ['/C', 'rmdir', '/S', '/Q', tempDir],
        setting.workingDirectory,
      );

      // =====================================================
      // SUCCESS
      // =====================================================
      appendLog('Deployment success');
      // Refresh table PM2
      fetchPm2List();
      // Alert success
      showAlert('Deployment success', 'success');
    } catch (err) {
      // =====================================================
      // ERROR HANDLER
      // =====================================================

      appendLog(`ERROR: ${err}`);
      showAlert(`${err}`, 'error');
    } finally {
      // =====================================================
      // FINISH LOADING
      // =====================================================

      setDeployLoading('');
    }
  };
  // helper update/add env
  const setEnvValue = (content, key, value) => {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      return content.replace(regex, `${key}=${value}`);
    }
    return `${content.trim()}\n${key}=${value}\n`;
  };

  return (
    <Box mt={2}>
      <Box display="flex" justifyContent="space-between" mb={2}>
        <Typography variant="h6" fontWeight="bold" color="primary.main">
          PM2 Management
        </Typography>

        <Button
          variant="contained"
          startIcon={<RocketLaunch />}
          onClick={() => setOpenDeployDialog(true)}
        >
          Tambah / Update App
        </Button>
      </Box>
      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Nama</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>RAM</TableCell>
              <TableCell>CPU</TableCell>
              <TableCell align="center">Aksi</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {pm2List.map((proc) => (
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
            ))}
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
                    p: 2,
                    borderRadius: 2,
                    minWidth: 375,
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
                    startIcon={<RocketLaunch />}
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

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle1" fontWeight="bold" mb={1}>
            Deployment Logs
          </Typography>

          <Paper
            variant="outlined"
            sx={{
              p: 2,
              bgcolor: '#111',
              color: '#00ff90',
              height: 250,
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

const PathRow = ({ label, path, onOpen }) => (
  <Box sx={{ mb: 2 }}>
    <Box
      sx={{
        display: 'flex',
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

      <Button size="small" startIcon={<FolderOpen />} onClick={onOpen}>
        Open Folder
      </Button>
    </Box>

    <Typography
      variant="body2"
      sx={{
        fontFamily: 'monospace',
        bgcolor: '#fff',
        p: 1,
        borderRadius: 1,
        border: '1px dashed #ccc',
      }}
    >
      {path}
    </Typography>
  </Box>
);

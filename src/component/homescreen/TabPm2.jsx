import {
  Article,
  CleaningServices,
  Delete,
  Refresh,
  RocketLaunch,
  Stop,
} from '@mui/icons-material';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import {
  Backdrop,
  Box,
  Button,
  Chip,
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
  Tooltip,
  Typography,
} from '@mui/material';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { Command } from '@tauri-apps/plugin-shell';
import { useEffect, useState } from 'react';
import Pm2LogViewer from '../Pm2LogViewer';

import { useSettingStore } from '../../store/settingStore';
import { humanizeText, openLocation } from '../../utility';
import { gitClone, gitValidation } from '../../utility/gitUtility';
import { useAlert } from '../AlertProvider';
import { useConfirm } from '../ConfirmProvider';
import DialogGitAuthentication from '../DialogGitAuthentication';

/**
 * Daftar aplikasi yang dapat di-deploy melalui tab PM2 Management.
 *
 * @constant
 * @type {Array<{key: string, title: string, description: string, git_url: string|null}>}
 * @property {string} key          - Identifikasi unik jenis deployment (dipakai sebagai `type` di handleDeploy).
 * @property {string} title        - Judul yang ditampilkan di UI.
 * @property {string} description  - Deskripsi singkat untuk UI.
 * @property {string|null} git_url - URL repository Git. `null` untuk jenis yang tidak butuh clone (mis. logrotate).
 */
const DEPLOY_APPS = [
  {
    key: 'API_CORE',
    title: 'Update Api Core Mertrack',
    description: 'Pull latest source & reload PM2',
    git_url: 'https://gitlab.com/mertrack/mertrack-core',
  },
  {
    key: 'API_BPOM',
    title: 'Install / Update BPOM API',
    description: 'Deploy BPOM API service',
    git_url: 'https://gitlab.com/gesang/connector-bpom',
  },
  {
    key: 'logrotate',
    title: 'Install Logrotate',
    description: 'Setup PM2 log rotation',
    git_url: null,
  },
];

/**
 * Komponen utama untuk manajemen proses PM2.
 *
 * Menyediakan:
 * - Tabel daftar proses PM2 (auto-refresh tiap 10 detik)
 * - Aksi per proses: monitor log, update .env, stop, restart, delete
 * - Dialog deployment untuk API_CORE, API_BPOM, dan logrotate
 * - Dialog autentikasi Git sebelum clone repository
 *
 * Alur deployment (API_CORE / API_BPOM):
 *   1. Bersihkan folder temp
 *   2. Clone repository ke folder temp
 *   3. Tulis file .env dari setting aplikasi
 *   4. `npm install` + `npm run build` di folder temp
 *   5. Salin hasil build ke folder services (overwrite, folder services TIDAK dihapus)
 *   6. `npm install --omit=dev` di folder services (kecuali API_BPOM)
 *   7. Start/reload proses PM2
 *   8. Bersihkan folder temp
 *
 * @component
 * @returns {JSX.Element} UI manajemen PM2
 */
export default function TabPm2() {
  const { showAlert } = useAlert();
  const { confirm: showConfirm } = useConfirm();
  const [isLoading, setIsLoading] = useState(false);
  const [openGitDialog, setOpenGitDialog] = useState(false);
  const [selectedDeploy, setSelectedDeploy] = useState('');
  const [gitForm, setGitForm] = useState({ username: '', password: '' });

  const setting = useSettingStore((state) => state.form);

  const [pm2List, setPm2List] = useState([]);

  const [openDeployDialog, setOpenDeployDialog] = useState(false);

  const [openLogViewer, setOpenLogViewer] = useState(false);
  const [selectedProcess, setSelectedProcess] = useState(null);

  const [deployLoading, setDeployLoading] = useState('');
  const [deployLogs, setDeployLogs] = useState([]);

  const tempDir = `${setting.workingDirectory}\\temp`;
  const serviceDir = `${setting.workingDirectory}\\services`;

  useEffect(() => {
    fetchPm2List();
    const interval = setInterval(fetchPm2List, 10000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Menambahkan pesan log ke state `deployLogs` dengan timestamp lokal.
   * @param {string} msg - Pesan yang akan ditambahkan ke log deployment.
   */
  const appendLog = (msg) => {
    setDeployLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${msg}`,
    ]);
  };

  /**
   * Menjalankan perintah shell melalui plugin Tauri `run-command`.
   * Mencatat perintah + stderr ke log deployment, dan melempar error
   * jika exit code != 0 (agar kegagalan build/install tidak lolos diam-diam).
   *
   * @param {string[]} args - Argumen perintah (diawali `/C` untuk cmd.exe).
   * @param {string} cwd    - Working directory tempat perintah dijalankan.
   * @returns {Promise<import('@tauri-apps/plugin-shell').CommandOutput>} Output perintah.
   * @throws {Error} Jika perintah gagal (exit code != 0).
   */
  const runCommand = async (args, cwd) => {
    appendLog(args.join(' '));
    const cmd = Command.create('run-command', args, {
      cwd,
    });
    const output = await cmd.execute();
    if (output.stderr) {
      appendLog(output.stderr);
    }
    if (output.code !== 0) {
      throw new Error(
        output.stderr || output.stdout || `Command failed (${output.code})`,
      );
    }
    return output;
  };
  /**
   * Mengambil daftar proses PM2 (`pm2 jlist`) dan memperkaya data
   * dengan `rootPath` (direktori script) serta `scriptPath`.
   * Dipanggil saat mount dan di-refresh otomatis tiap 10 detik.
   *
   * @returns {Promise<void>}
   */
  const fetchPm2List = async () => {
    try {
      const pm2 = Command.create('run-command', ['/C', 'pm2', 'jlist']);
      const output = await pm2.execute();
      if (output.code === 1) throw new Error(output.stderr);
      if (output.stdout) {
        const parsedData = JSON.parse(output.stdout);

        const enrichedData = parsedData.map((proc) => {
          const execPath = proc.pm2_env?.pm_exec_path || '';
          // Ambil direktori dari script path
          const rootPath =
            execPath.substring(0, execPath.lastIndexOf('/')) ||
            execPath.substring(0, execPath.lastIndexOf('\\')) ||
            null;

          return {
            ...proc,
            rootPath: rootPath,
            scriptPath: execPath,
          };
        });

        setPm2List(enrichedData);
      }
    } catch (error) {
      showAlert(`${error}`, 'error');
    }
  };
  /**
   * Menyimpan session PM2 ke disk (`pm2 save --force`) agar daftar proses
   * tetap ada setelah server/PC di-restart.
   * @returns {Promise<void>}
   */
  const syncPm2Session = async () => {
    await Command.create('run-command', [
      '/C',
      'pm2',
      'save',
      '--force',
    ]).execute();
  };

  /**
   * Menyimpan session PM2 dan menampilkan notifikasi hasilnya.
   * @returns {Promise<void>}
   */
  const handleSavePm2 = async () => {
    setIsLoading(true);
    try {
      await syncPm2Session();
      fetchPm2List();
      showAlert('PM2 session saved successfully', 'success');
    } catch (error) {
      showAlert(`${error}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Membersihkan cache npm (`npm cache clean --force`) dengan konfirmasi
   * terlebih dahulu, lalu menampilkan notifikasi hasilnya.
   * @returns {Promise<void>}
   */
  const handleClearNpmCache = async () => {
    const ok = await showConfirm({
      title: 'Clear NPM Cache',
      message: 'Apakah anda yakin ingin membersihkan cache npm?',
      severity: 'danger',
    });
    if (!ok) return;
    setIsLoading(true);
    try {
      await runCommand(
        ['/C', 'npm', 'cache', 'clean', '--force'],
        setting.workingDirectory,
      );
      showAlert('NPM cache cleared successfully', 'success');
    } catch (error) {
      showAlert(`${error}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Menjalankan aksi PM2 (stop/restart/delete) pada proses tertentu,
   * lalu me-refresh tabel setelah jeda 500ms.
   *
   * @param {'stop'|'restart'|'delete'} action - Aksi PM2 yang dijalankan.
   * @param {string} identifier - Nama proses PM2 target.
   * @returns {Promise<void>}
   */
  const handlePm2Action = async (action, identifier) => {
    setIsLoading(true);
    try {
      await Command.create('run-command', [
        '/C',
        'pm2',
        action,
        identifier,
      ]).execute();

      await new Promise((r) => setTimeout(r, 500));
      fetchPm2List();
      showAlert(
        `${humanizeText(action)} ${humanizeText(identifier)} successfully`,
        'success',
      );
    } catch (error) {
      showAlert(`${error}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Memperbarui file `.env` pada folder services proses PM2,
   * lalu me-restart proses tersebut agar konfigurasi baru diterapkan.
   *
   * @param {Object} item - Objek proses PM2 (dari `pm2List`), memakai `item.name`.
   * @returns {Promise<void>}
   */
  const handleReloadEnv = async (item) => {
    try {
      await updateFileEnv(`${serviceDir}`);
      await handlePm2Action('restart', item.name);
    } catch (error) {
      showAlert(`${error}`, 'error');
    }
  };

  /**
   * Menjalankan proses deployment aplikasi berdasarkan tipe yang dipilih.
   *
   * Alur umum:
   * 1. Bersihkan folder temp (jika ada).
   * 2. Tentukan nama service & port dari setting (API_CORE / API_BPOM).
   * 3. Untuk `logrotate` → langsung install pm2-logrotate dan selesai.
   * 4. Clone + build aplikasi ke folder temp (`buildBackend`).
   * 5. Install dependency produksi di folder services (kecuali API_BPOM).
   * 6. Start/reload proses PM2 (`deployBackend`).
   * 7. Bersihkan folder temp.
   *
   * Catatan: Folder `services` TIDAK dihapus selama deployment —
   * hasil build hanya di-overwrite di atas isi folder yang sudah ada
   * (file seperti `.env` dan `node_modules` yang sudah ada tetap dipertahankan).
   *
   * @param {string} type - Kunci deployment dari `DEPLOY_APPS` ('API_CORE' | 'API_BPOM' | 'logrotate').
   * @returns {Promise<void>}
   */
  const handleDeploy = async (type) => {
    try {
      // Hapus folder temp
      await runCommand(
        ['/C', 'rmdir', '/S', '/Q', tempDir],
        setting.workingDirectory,
      ).catch(() => {});
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
      // MENENTUKAN NAMA SERVICE DAN PORT
      // =====================================================
      // Tentukan nama PM2 service berdasarkan type deployment
      const deployApp = DEPLOY_APPS.find((it) => it.key === type);
      if (!deployApp) {
        throw new Error(`Unknown deployment type: ${type}`);
      }
      let deploy_info = JSON.parse(JSON.stringify(deployApp));
      if (deploy_info.key == 'API_CORE') {
        deploy_info.title = setting.appName;
        deploy_info.port = setting.backendPort;
      } else if (deploy_info.key == 'API_BPOM') {
        deploy_info.title = setting.bpomAppName;
        deploy_info.port = setting.bpomAppPort;
      }
      // =====================================================
      // JIKA logrotate CUKUP SAMPAI SINI
      // =====================================================
      if (deploy_info.key === 'logrotate') {
        return await deployLogRotate();
      }

      // =====================================================
      // CLONE AND BUILD FUNCTION
      // =====================================================
      await buildBackend(deploy_info);
      // =====================================================
      // INSTALL NODE MODULES DI SERVICE PRODUCTION
      // =====================================================
      if (type !== 'API_BPOM') {
        appendLog('Installing production dependencies...');
        await runCommand(['/C', 'npm', 'install', '--omit=dev'], serviceDir);
      }
      // =====================================================
      // DEPLOY KE PM2
      // =====================================================
      await deployBackend(deploy_info);
      showAlert('Deployment success', 'success');
    } catch (err) {
      showAlert(`${err}`, 'error');
      appendLog(`Deployment failed`);
    } finally {
      // =====================================================
      // HAPUS TEMP DIRECTORY (SELALU DIJALANKAN)
      // =====================================================
      // Folder temp bekas build dihapus di blok `finally` agar
      // tetap dibersihkan baik deployment sukses maupun gagal.
      appendLog('Cleaning temp directory...');
      await runCommand(
        ['/C', 'rmdir', '/S', '/Q', tempDir],
        setting.workingDirectory,
      ).catch(() => {});
      setDeployLoading('');
      appendLog('Done deployment process');
    }
  };

  /**
   * Menginstall modul PM2 logrotate untuk rotasi log otomatis.
   * @returns {Promise<void>}
   */
  const deployLogRotate = async () => {
    await runCommand(['/C', 'pm2', 'install', 'pm2-logrotate'], 'C:\\');
    appendLog('Logrotate installed');
    return;
  };

  /**
   * Men-deploy aplikasi backend ke PM2:
   * - Jika service sudah terdaftar → `pm2 reload`
   * - Jika belum → `pm2 start <script>.js --name <title>` dari folder services
   *
   * Untuk API_CORE dan API_BPOM, nama file script diambil dari
   * `package.json -> name` (mis. `mertrack-core.js`), sedangkan nama
   * proses PM2 diambil dari settingStore -> appName (mis. `Integra`).
   *
   * @param {Object} options - Informasi deployment.
   * @param {string} options.title - Nama service PM2 (dari settingStore -> appName untuk API_CORE).
   * @param {string} [options.scriptName] - Nama file script tanpa ekstensi (dari package.json -> name, khusus API_CORE dan API_BPOM).
   * @returns {Promise<void>}
   */
  const deployBackend = async (options) => {
    const { title, scriptName } = options;
    try {
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
      // Cek apakah service sudah terdaftar di PM2 (parse JSON, bukan string match)
      let serviceExists = false;
      try {
        const pm2Processes = JSON.parse(pm2.stdout);
        serviceExists = pm2Processes.some((proc) => proc.name === title);
      } catch {
        // Fallback ke string matching jika output bukan JSON valid
        serviceExists = pm2.stdout.includes(`"name":"${title}"`);
      }
      // Jika service sudah ada
      if (serviceExists) {
        appendLog('Reloading PM2 service...');
        // Reload PM2
        await runCommand(['/C', 'pm2', 'reload', title], serviceDir);
      } else {
        appendLog('Starting PM2 service...');
        // Start PM2 baru
        // Nama file script: dari package.json -> name (khusus API_CORE dan API_BPOM),
        // fallback ke nama service jika tidak tersedia.
        const scriptFile = scriptName ? `${scriptName}.js` : `${title}.js`;
        await runCommand(
          ['/C', 'pm2', 'start', scriptFile, '--name', title],
          serviceDir,
        );
      }
      // =====================================================
      // SAVE PM2 SESSION
      // =====================================================
      // Success
      // =====================================================
      appendLog('Deployment success');
      // Refresh table PM2
      fetchPm2List();
    } catch (err) {
      throw err;
    }
  };

  /**
   * Clone repository, tulis `.env`, install dependency, build, lalu
   * salin hasil build ke folder services.
   *
   * Alur:
   * 1. Clone repository (dengan branch opsional untuk API_CORE) ke folder temp.
   * 2. Baca `package.json -> name` sebagai `options.scriptName` (khusus API_CORE dan API_BPOM)
   *    untuk menentukan nama file entry PM2 (mis. `mertrack-core.js`).
   * 3. Tulis file `.env` dari setting aplikasi.
   * 4. `npm install` di folder temp.
   * 5. `npm run build` di folder temp (output ke `temp/build`).
   * 6. `xcopy` hasil build ke folder services dengan flag `/E /I /Y`
   *    (overwrite file yang ada, folder services TIDAK dihapus).
   *
   * Catatan: `package.json` TIDAK dimodifikasi selama proses ini.
   *
   * @param {Object} options - Informasi deployment.
   * @param {string} options.key - Kunci deployment ('API_CORE' | 'API_BPOM').
   * @returns {Promise<void>}
   * @throws {Error} Jika clone gagal atau perintah build/install gagal.
   */
  const buildBackend = async (options) => {
    const { key } = options;

    try {
      // =====================================================
      // MENENTUKAN DIRECTORY
      // =====================================================
      const buildDir = `${tempDir}\\build`;
      // =====================================================
      // CLONE REPOSITORY
      // =====================================================
      appendLog('Cloning repository...');
      let param = { ...options, ...gitForm, directory: tempDir };
      if (key == 'API_CORE' && setting.backendBranch) {
        param = { ...param, branch: setting.backendBranch };
      }
      const cloneResult = await gitClone(param);
      if (cloneResult.error) {
        throw new Error(cloneResult.message);
      }

      // =====================================================
      // AMBIL NAMA SCRIPT DARI PACKAGE.JSON (KHUSUS API_CORE DAN API_BPOM)
      // =====================================================
      // Nama file entry PM2 diambil dari field `name` pada package.json
      // hasil clone (mis. `mertrack-core` → `mertrack-core.js`).
      // Nama proses PM2 tetap diambil dari settingStore -> appName.
      // PENTING: package.json dibaca SEBELUM build (langsung dari hasil
      // clone), bukan dari hasil build/copy — karena `npm run build` bisa
      // menimpa/menghapus package.json di folder build.
      if (key === 'API_CORE' || key === 'API_BPOM') {
        const packageJson = JSON.parse(
          await readTextFile(`${tempDir}\\package.json`),
        );
        options.scriptName = packageJson.name;
        appendLog(`Script file: ${packageJson.name}.js`);
      }

      // =====================================================
      // UPDATE FILE .ENV
      // =====================================================
      await updateFileEnv(`${tempDir}`);
      // =====================================================
      // INSTALL DEPENDENCIES DI TEMP FOLDER
      // =====================================================
      appendLog('Installing dependencies...');
      await runCommand(['/C', 'npm', 'install'], tempDir);
      // =====================================================
      // BUILD PROJECT
      // =====================================================
      appendLog('Building application...');
      await runCommand(['/C', 'npm', 'run', 'build'], tempDir);
      // =====================================================
      // COPY BUILD KE SERVICE PRODUCTION
      // =====================================================
      appendLog('Copying build to service...');
      await runCommand(
        ['/C', 'xcopy', buildDir, serviceDir, '/E', '/I', '/Y'],
        setting.workingDirectory,
      );
    } catch (err) {
      throw err;
    }
  };

  /**
   * Menulis / memperbarui file `.env` pada path tertentu berdasarkan
   * setting aplikasi (nama app, port, database, BPOM, dll).
   * Jika file belum ada, akan dibuat baru.
   *
   * @param {string} path - Direktori tempat file `.env` berada.
   * @returns {Promise<void>}
   */
  const updateFileEnv = async (path) => {
    // =====================================================
    // UPDATE FILE .ENV
    // =====================================================
    appendLog('Updating .env file...');
    let envField = {
      APP_NAME: setting.appName,
      APP_PORT: setting.backendPort,
      APP_TIMEZONE: setting.timezone,

      LOGIN_TIMEOUT: 15,
      DB_DIALECT: setting.databaseDialect,
      DB_PORT: setting.databasePort,
      DB_DATABASE: setting.databaseName,
      DB_USER: setting.databaseUser,
      DB_PASSWORD: setting.databasePassword,

      BPOM_URL: setting.bpomUrl,
      BPOM_EMAIL: setting.bpomEmail,
      BPOM_PASSWORD: setting.bpomPassword,

      CONNECTOR_BPOM: setting.bpomAppPort,
      CONNECTOR_BPOM_NAME: setting.bpomAppName,
    };

    const envPath = `${path}\\.env`;
    let currentEnv = '';
    try {
      currentEnv = await readTextFile(envPath);
    } catch {
      appendLog('.env not found, creating new file...');
    }
    for (const key in envField)
      currentEnv = setEnvValue(currentEnv, key, envField[key] || '');
    await writeTextFile(envPath, currentEnv);
  };

  /**
   * Helper untuk menambah / memperbarui satu key pada konten file `.env`.
   * Jika key sudah ada → nilai diganti; jika belum → ditambahkan di akhir.
   *
   * @param {string} content - Konten file `.env` saat ini.
   * @param {string} key - Nama variabel env.
   * @param {string} value - Nilai variabel env.
   * @returns {string} Konten `.env` yang sudah diperbarui.
   */
  const setEnvValue = (content, key, value) => {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      return content.replace(regex, `${key}=${value}`);
    }
    return `${content.trim()}\n${key}=${value}\n`;
  };

  /**
   * Memformat timestamp uptime (ms) menjadi string yang mudah dibaca,
   * mis. `2d 3h`, `5h 30m`, `10m 5s`, `45s`.
   *
   * @param {number} timestamp - Timestamp uptime dalam milidetik (dari PM2).
   * @returns {string} Uptime terformat.
   */
  const formatUptime = (timestamp) => {
    if (!timestamp) return '0s';
    const uptimeMs = Date.now() - timestamp;
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  return (
    <Box mt={2}>
      <Box display="flex" justifyContent="space-between" mb={2}>
        <Typography variant="h6" fontWeight="bold" color="primary.main">
          PM2 Management
        </Typography>

        <Box display="flex" gap={1}>
          <Tooltip title="Clear Cache">
            <Box
              onClick={handleClearNpmCache}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 1,
                border: 1,
                borderColor: 'warning.main',
                borderRadius: 1,
                color: 'warning.main',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <CleaningServices />
            </Box>
          </Tooltip>
          <Button
            color="success"
            variant="outlined"
            onClick={async () => {
              const ok = await showConfirm({
                title: 'Save PM2',
                message: 'Apakah anda yakin ingin menyimpan session PM2?',
                severity: 'danger',
              });
              if (ok) {
                setOpenGitDialog(true);
                setSelectedDeploy('');
              }
            }}
          >
            Save PM2
          </Button>
          <Button
            variant="contained"
            startIcon={<RocketLaunch />}
            onClick={() => setOpenDeployDialog(true)}
          >
            Tambah / Update App
          </Button>
        </Box>
      </Box>
      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Nama</TableCell>
              <TableCell>Path</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Up Time</TableCell>
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
                  <Tooltip title={proc.rootPath}>
                    <Button
                      size="small"
                      variant="text"
                      color="primary"
                      onClick={() => openLocation(proc.rootPath)}
                      disabled={!proc.rootPath}
                      style={{
                        fontFamily: 'monospace',
                        maxWidth: '200px',
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {proc.rootPath || '-'}
                    </Button>
                  </Tooltip>
                </TableCell>

                <TableCell>
                  <Chip
                    label={proc.pm2_env.status}
                    color={
                      proc.pm2_env.status === 'online' ? 'success' : 'error'
                    }
                    size="small"
                  />
                </TableCell>

                <TableCell>{formatUptime(proc.pm2_env.pm_uptime)}</TableCell>
                <TableCell>
                  {(proc.monit.memory / 1024 / 1024).toFixed(1)} MB
                </TableCell>

                <TableCell>{proc.monit.cpu} %</TableCell>

                <TableCell align="center">
                  <Tooltip title="Monitor CMD">
                    <IconButton
                      color="info"
                      onClick={() => {
                        setSelectedProcess(proc);
                        setOpenLogViewer(true);
                      }}
                    >
                      <Article />
                    </IconButton>
                  </Tooltip>
                  {proc.name !== 'pm2-logrotate' ? (
                    <Tooltip title="Update .env">
                      <IconButton
                        color="info"
                        onClick={() => handleReloadEnv(proc)}
                      >
                        <UploadFileOutlinedIcon />
                      </IconButton>
                    </Tooltip>
                  ) : null}

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
        loading={deployLoading !== '' || isLoading}
        onSubmit={async () => {
          if (!selectedDeploy) {
            setIsLoading(true);
            const validasi = await gitValidation(gitForm);
            if (validasi.error) {
              setIsLoading(false);
              showAlert(validasi.message, 'error');
              return;
            }
            setOpenGitDialog(false);
            await handleSavePm2();
            setIsLoading(false);
            return;
          }
          setOpenGitDialog(false);
          await handleDeploy(selectedDeploy, gitForm);
        }}
      />
      <Backdrop
        open={isLoading}
        sx={{
          zIndex: 9999,
          color: '#fff',
          flexDirection: 'column',
          gap: 2,
          backgroundColor: 'rgba(0,0,0,0.75)',
        }}
      >
        <CircularProgress color="inherit" />
        <Typography variant="h6">Processing...</Typography>
      </Backdrop>
      <Pm2LogViewer
        open={openLogViewer}
        onClose={() => setOpenLogViewer(false)}
        process={selectedProcess}
      />
    </Box>
  );
}

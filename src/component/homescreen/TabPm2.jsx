import {
  Article,
  Autorenew,
  Delete,
  DeleteForever,
  Info,
  Refresh,
  RocketLaunch,
  Stop,
} from '@mui/icons-material';
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
import {
  exists,
  mkdir,
  readTextFile,
  writeTextFile,
} from '@tauri-apps/plugin-fs';
import { Command } from '@tauri-apps/plugin-shell';
import { Fragment, useEffect, useRef, useState } from 'react';
import Pm2LogViewer from '../Pm2LogViewer';

import { useSettingStore } from '../../store/settingStore';
import { useAppStore } from '../../store/pathStore';
import { useAppStatusStore } from '../../store/appStatusStore';
import { useDeployStore } from '../../store/deployStore';
import { humanizeText, openLocation } from '../../utility';
import {
  gitClone,
  gitValidation,
  gitVersionInfo,
} from '../../utility/gitUtility';
import useGitAuth from '../../utility/useGitAuth';
import { useAlert } from '../AlertProvider';
import { useConfirm } from '../ConfirmProvider';
import DialogGitAuthentication from '../DialogGitAuthentication';
import DialogVersionInfo from '../DialogVersionInfo';

/**
 * Daftar aplikasi yang dapat di-deploy melalui tab PM2 Management.
 *
 * @constant
 * @type {Array<{key: string, title: string, description: string, git_url: string|null, group?: string}>}
 * @property {string} key          - Identifikasi unik jenis deployment (dipakai sebagai `type` di handleDeploy).
 * @property {string} title        - Judul yang ditampilkan di UI.
 * @property {string} description  - Deskripsi singkat untuk UI.
 * @property {string|null} git_url - URL repository Git. `null` untuk jenis yang tidak butuh clone (mis. logrotate).
 * @property {string} [group]      - Grup tampilan di dialog Deployment Manager (mis. 'Plugin').
 */
const DEPLOY_APPS = [
  {
    key: 'API_CORE',
    title: 'Api Core Mertrack',
    description: 'Pull latest source & reload PM2',
    git_url: 'https://gitlab.com/mertrack/mertrack-core',
    group: 'Service',
  },
  {
    key: 'API_BPOM',
    title: 'Connector BPOM',
    description: 'Deploy BPOM API service',
    git_url: 'https://gitlab.com/gesang/connector-bpom',
    group: 'Service',
  },
  {
    key: 'telemetry',
    title: 'Telemetry',
    description: 'Clone, build & jalankan otel-gui (OpenTelemetry viewer)',
    git_url: 'https://github.com/metafab/otel-gui',
    group: 'Plugin',
  },
  {
    key: 'logrotate',
    title: 'Logrotate',
    description: 'Setup PM2 log rotation',
    git_url: null,
    group: 'Plugin',
  },
];

// Repository publik otel-gui + konfigurasi deployment Telemetry.
const TELEMETRY_REPO = 'https://github.com/metafab/otel-gui';
// Relatif terhadap working directory, mis. <workingDirectory>\plugin\otel-gui
const TELEMETRY_DIR_PATH = 'plugin\\otel-gui';
// File layout otel-gui yang header bawaannya dihapus sebelum build.
const TELEMETRY_LAYOUT_FILE = 'src\\routes\\+layout.svelte';
const TELEMETRY_LAYOUT_GIT_PATH = 'src/routes/+layout.svelte';
// Blok <header class="app-header">...</header> (termasuk indentasi & newline).
const TELEMETRY_HEADER_REGEX =
  /[ \t]*<header class="app-header">[\s\S]*?<\/header>[ \t]*\r?\n?/;
const TELEMETRY_PM2_NAME = 'telemetry';
const TELEMETRY_PORT = 4318;
// Versi Node.js minimum yang didukung otel-gui (package.json -> engines).
const TELEMETRY_MIN_NODE = { major: 22, minor: 17 };

/**
 * Komponen utama untuk manajemen proses PM2.
 *
 * Menyediakan:
 * - Tabel daftar proses PM2 (auto-refresh tiap 10 detik)
 * - Aksi per proses: monitor log, stop, restart, delete
 * - Tombol "Reload .env": perbarui file .env lalu reload semua proses PM2
 * - Dialog deployment untuk API_CORE, API_BPOM, telemetry, dan logrotate
 * - Dialog autentikasi Git sebelum clone repository privat (API_CORE / API_BPOM)
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
  const [gitForm, setGitForm] = useGitAuth();

  const setting = useSettingStore((state) => state.form);
  const isAdmin = useAppStatusStore((state) => state.isAdmin);
  const setIsAdmin = useAppStatusStore((state) => state.setIsAdmin);
  const deployInfo = useAppStore((state) => state.deployInfo);
  const setDeployInfo = useAppStore((state) => state.setDeployInfo);

  const [versionInfo, setVersionInfo] = useState(null);

  const [pm2List, setPm2List] = useState([]);

  const [openReloadDialog, setOpenReloadDialog] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [pendingReload, setPendingReload] = useState(false);
  const [reloadMode, setReloadMode] = useState('soft');

  const [openLogViewer, setOpenLogViewer] = useState(false);
  const [selectedProcess, setSelectedProcess] = useState(null);

  // Status Deployment Manager diambil dari store global supaya proses build
  // yang sedang berjalan tetap terlihat walau dialog ditutup / pindah halaman.
  const {
    open: openDeployDialog,
    setOpen: setOpenDeployDialog,
    target: deployLoading,
    start: startDeploy,
    finish: finishDeploy,
    logs: deployLogs,
    appendLog,
    clearLogs: clearDeployLogs,
  } = useDeployStore();
  const deployLogsRef = useRef(null);

  // Auto-scroll Deployment Logs ke bawah setiap ada log baru
  useEffect(() => {
    const el = deployLogsRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [deployLogs]);

  const tempDir = `${setting.workingDirectory}\\temp`;
  const serviceDir = `${setting.workingDirectory}\\services`;

  useEffect(() => {
    // Bila aplikasi TIDAK berjalan sebagai Administrator, PM2 tidak bisa
    // diakses (connect EPERM \\.\pipe\rpc.sock). Hentikan polling agar tidak
    // terjadi looping pemanggilan PM2 yang gagal.
    if (isAdmin === false) return undefined;

    fetchPm2List();
    const interval = setInterval(fetchPm2List, 10000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  /**
   * Menjalankan perintah shell melalui plugin Tauri `run-command` dengan
   * streaming output real-time ke Deployment Logs (stdout & stderr
   * ditampilkan per baris saat proses berjalan, bukan setelah selesai).
   * Melempar error jika exit code != 0 (agar kegagalan build/install
   * tidak lolos diam-diam).
   *
   * @param {string[]} args - Argumen perintah (diawali `/C` untuk cmd.exe).
   * @param {string} cwd    - Working directory tempat perintah dijalankan.
   * @param {Object} [options] - Opsi tambahan.
   * @param {boolean} [options.logStdout=true] - Jika `false`, stdout TIDAK
   *   ditampilkan ke log (dipakai untuk perintah yang outputnya data,
   *   mis. `pm2 jlist`).
   * @returns {Promise<{code: number, stdout: string, stderr: string}>} Output perintah.
   * @throws {Error} Jika perintah gagal (exit code != 0).
   */
  const runCommand = async (args, cwd, { logStdout = true } = {}) => {
    appendLog(args.join(' '));
    const cmd = Command.create('run-command', args, {
      cwd,
    });
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let settled = false;
      const settle = (fn, val) => {
        if (settled) return;
        settled = true;
        fn(val);
      };
      // Stream output real-time ke Deployment Logs
      cmd.stdout.on('data', (line) => {
        stdout += line;
        if (logStdout && line) appendLog(line.trim());
      });
      cmd.stderr.on('data', (line) => {
        stderr += line;
        if (line) appendLog(line.trim());
      });
      cmd.on('error', (error) => settle(reject, new Error(error)));
      cmd.on('close', (data) => {
        if (data.code !== 0) {
          settle(reject, new Error(stderr || `Command failed (${data.code})`));
        } else {
          settle(resolve, { code: data.code, stdout, stderr });
        }
      });
      cmd.spawn().catch((err) => settle(reject, new Error(err)));
    });
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
      const message = String(error);
      // PM2 tidak dapat diakses tanpa hak Administrator → tandai non-admin
      // agar polling dihentikan dan warning tampil di header.
      if (message.includes('EPERM') || message.includes('rpc.sock')) {
        setIsAdmin(false);
        return;
      }
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
   * Menjalankan ulang (start) sebuah proses PM2 memakai konfigurasi aslinya:
   * interpreter, interpreter-args (alias node-args), working directory, serta
   * mode cluster & jumlah instance bila ada. Dipakai oleh Force Reload setelah
   * `pm2 delete`.
   *
   * @param {Object} proc - Objek proses PM2 hasil `pm2 jlist` (yang di-enrich).
   * @returns {Promise<void>}
   */
  const startPm2Process = async (proc) => {
    const env = proc.pm2_env || {};
    const args = ['/C', 'pm2', 'start', proc.scriptPath, '--name', proc.name];

    // Pertahankan interpreter asli (mis. python3, bash, atau path venv/dll).
    // Nilai default PM2 ('node') dilewati agar tidak menambah opsi mubazir.
    if (env.exec_interpreter && env.exec_interpreter !== 'node') {
      args.push('--interpreter', env.exec_interpreter);
    }

    // Pertahankan interpreter-args (alias node-args) bila ada.
    // Nilainya bisa berupa string atau array.
    let interpArgs = env.node_args ?? env.interpreter_args;
    if (Array.isArray(interpArgs)) interpArgs = interpArgs.join(' ');
    if (interpArgs) {
      args.push('--interpreter-args', String(interpArgs));
    }

    // Pertahankan mode cluster beserta jumlah instance-nya
    if (env.exec_mode === 'cluster_mode') {
      args.push('-i', String(env.instances ?? 1));
    }

    await Command.create('run-command', args, {
      cwd: env.pm_cwd || proc.rootPath || setting.workingDirectory,
    }).execute();
  };

  /**
   * Memperbarui file `.env` di folder services dari setting aplikasi, lalu
   * menerapkannya ke SEMUA proses PM2 (kecuali `pm2-logrotate`) dengan salah
   * satu dari dua mode:
   *
   * - `soft` → `pm2 reload <name> --update-env`
   *   Reload graceful tanpa downtime. `--update-env` memaksa PM2 mengambil
   *   ulang environment, karena PM2 menyimpan cache env dan TIDAK
   *   memperbaruinya pada restart/reload biasa. Cocok untuk perubahan umum,
   *   namun pada sebagian kasus nilai `.env` lama bisa masih ter-cache.
   *
   * - `force` → `pm2 delete <name>` lalu `pm2 start ...` ulang
   *   Mematikan proses lalu menjalankannya kembali dari nol sehingga app
   *   membaca ulang `.env` secara bersih. Ada downtime singkat; dipakai saat
   *   nilai env masih "nyangkut" setelah soft reload.
   *
   * Proses diproses bergantian dengan jeda 10 detik antar proses agar reload
   * tidak saling menumpuk. Setelah selesai, session PM2 disimpan (`pm2 save`).
   *
   * @param {'soft'|'force'} mode - Mode penerapan environment.
   * @returns {Promise<void>}
   */
  /**
   * Memilih mode Reload .env lalu membuka dialog autentikasi Git (memakai
   * alur auth yang sama seperti aksi deploy/save lainnya). Reload baru
   * dijalankan setelah kredensial Git tervalidasi.
   *
   * @param {'soft'|'force'} mode - Mode penerapan environment.
   */
  const chooseReload = (mode) => {
    setReloadMode(mode);
    setSelectedDeploy('');
    setPendingReload(true);
    setOpenReloadDialog(false);
    setOpenGitDialog(true);
  };

  /**
   * @param {'soft'|'force'} mode - Mode penerapan environment.
   * @returns {Promise<void>}
   */
  const handleReloadEnv = async (mode = 'soft') => {
    if (isAdmin === false) {
      showAlert(
        'Aplikasi harus dijalankan sebagai Administrator untuk reload PM2.',
        'warning',
      );
      return;
    }
    setOpenReloadDialog(false);
    setPendingReload(false);
    setIsReloading(true);
    try {
      await updateFileEnv(serviceDir);

      const targets = pm2List.filter(
        (proc) => proc.name !== 'pm2-logrotate' && proc.name !== 'telemetry',
      );

      if (targets.length === 0) {
        showAlert('Tidak ada proses PM2 untuk di-reload', 'warning');
        return;
      }

      for (let i = 0; i < targets.length; i++) {
        const proc = targets[i];

        if (mode === 'force') {
          await Command.create('run-command', [
            '/C',
            'pm2',
            'delete',
            proc.name,
          ]).execute();
          await startPm2Process(proc);
        } else {
          await Command.create('run-command', [
            '/C',
            'pm2',
            'reload',
            proc.name,
            '--update-env',
          ]).execute();
        }

        // Jeda 10 detik sebelum proses berikutnya (tidak perlu setelah yang terakhir)
        if (i < targets.length - 1) {
          await new Promise((r) => setTimeout(r, 10000));
        }
      }

      await syncPm2Session();
      await new Promise((r) => setTimeout(r, 200));
      fetchPm2List();
      showAlert(
        mode === 'force'
          ? 'Force reload .env successfully'
          : 'Soft reload .env successfully',
        'success',
      );
    } catch (error) {
      showAlert(`${error}`, 'error');
    } finally {
      setIsReloading(false);
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
   * @param {string} type - Kunci deployment dari `DEPLOY_APPS` ('API_CORE' | 'API_BPOM' | 'telemetry' | 'logrotate').
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
      // Menandai deploy sedang berjalan + reset log deployment sebelumnya
      startDeploy(type);
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
      // JIKA logrotate / telemetry CUKUP SAMPAI SINI
      // =====================================================
      if (deploy_info.key === 'logrotate') {
        return await deployLogRotate();
      }
      if (deploy_info.key === 'telemetry') {
        await deployTelemetry();
        showAlert('Telemetry installed', 'success');
        return;
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
      finishDeploy();
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
   * Men-deploy otel-gui (OpenTelemetry viewer) sebagai proses PM2 `telemetry`.
   *
   * Alur:
   * 1. Cek versi Node.js (otel-gui butuh Node >= 22.17).
   * 2. Clone repo otel-gui, atau tarik update bila folder sudah ada.
   * 3. Hentikan proses PM2 `telemetry` (bila ada) agar file build tidak terkunci.
   * 4. `npm install`, hapus header bawaan otel-gui, lalu `npm run build`.
   * 5. Start PM2 `telemetry` dari `build/index.js` lalu verifikasi status `online`.
   *
   * Folder instalasi: `<workingDirectory>\plugin\otel-gui` — berisi source,
   * node_modules, `build`, dan `proto` (proto dibutuhkan otel-gui saat runtime).
   *
   * @returns {Promise<void>}
   * @throws {Error} Jika working directory belum diatur, Node.js terlalu lama,
   *   atau clone/install/build gagal.
   */
  const deployTelemetry = async () => {
    if (!setting.workingDirectory) {
      throw new Error(
        'Working directory belum diatur. Buka menu Setting terlebih dahulu.',
      );
    }

    const telemetryDir = `${setting.workingDirectory}\\${TELEMETRY_DIR_PATH}`;

    // =====================================================
    // CEK VERSI NODE
    // =====================================================
    appendLog('Checking Node.js version...');
    let nodeOut;
    try {
      nodeOut = await runCommand(
        ['/C', 'node', '-v'],
        setting.workingDirectory,
        { logStdout: false },
      );
    } catch {
      throw new Error(
        'Node.js tidak ditemukan. Pastikan Node.js >= 22.17 sudah terpasang dan ada di PATH.',
      );
    }
    const nodeVersion = nodeOut.stdout.trim().replace(/^v/i, '');
    const [nodeMajor = 0, nodeMinor = 0] = nodeVersion.split('.').map(Number);
    if (
      nodeMajor < TELEMETRY_MIN_NODE.major ||
      (nodeMajor === TELEMETRY_MIN_NODE.major &&
        nodeMinor < TELEMETRY_MIN_NODE.minor)
    ) {
      throw new Error(
        `Telemetry membutuhkan Node.js >= ${TELEMETRY_MIN_NODE.major}.${TELEMETRY_MIN_NODE.minor} (terpasang: ${
          nodeVersion || 'tidak diketahui'
        }).`,
      );
    }
    appendLog(`Node.js ${nodeVersion} OK`);

    // =====================================================
    // CLONE ATAU UPDATE SOURCE
    // =====================================================
    let needClone = !(await exists(telemetryDir));
    if (!needClone) {
      appendLog('Updating otel-gui source...');
      try {
        // File layout sengaja dimodifikasi (header dihapus) pada build
        // sebelumnya. Kembalikan dulu agar `git pull --ff-only` tidak gagal
        // karena perubahan lokal.
        await runCommand(
          ['/C', 'git', 'checkout', '--', TELEMETRY_LAYOUT_GIT_PATH],
          telemetryDir,
        ).catch(() => {});
        // `--ff-only` agar update tidak pernah membuat merge commit dan
        // tidak menimpa perubahan lokal secara diam-diam.
        await runCommand(['/C', 'git', 'pull', '--ff-only'], telemetryDir);
      } catch {
        // Bedakan folder kosong/bukan repo (aman di-clone ulang) dengan
        // repo yang punya perubahan lokal / divergen (jangan dihapus).
        let isGitRepo = true;
        try {
          await runCommand(
            ['/C', 'git', 'rev-parse', '--is-inside-work-tree'],
            telemetryDir,
            { logStdout: false },
          );
        } catch {
          isGitRepo = false;
        }
        if (isGitRepo) {
          throw new Error(
            'Gagal memperbarui otel-gui (git pull --ff-only). Periksa perubahan lokal di folder plugin\\otel-gui lalu coba lagi.',
          );
        }
        appendLog(
          'Folder plugin\\otel-gui bukan repository git valid, clone ulang...',
        );
        await runCommand(
          ['/C', 'rmdir', '/S', '/Q', telemetryDir],
          setting.workingDirectory,
        ).catch(() => {});
        needClone = true;
      }
    }
    if (needClone) {
      appendLog('Cloning otel-gui...');
      // Pastikan folder induk `<workingDirectory>\plugin` tersedia sebelum clone.
      await mkdir(`${setting.workingDirectory}\\plugin`, {
        recursive: true,
      }).catch(() => {});
      await runCommand(
        ['/C', 'git', 'clone', '--depth', '1', TELEMETRY_REPO, telemetryDir],
        setting.workingDirectory,
      );
    }
    const version = await gitVersionInfo(telemetryDir);
    if (version.commit) {
      appendLog(
        `Telemetry version: ${version.branch} (${version.commit.slice(0, 8)})`,
      );
      setDeployInfo(`PM2:${TELEMETRY_PM2_NAME}`, {
        ...version,
        deployedAt: new Date().toLocaleString(),
      });
    }

    // =====================================================
    // HENTIKAN PROSES LAMA (BILA ADA) SEBELUM INSTALL/BUILD
    // =====================================================
    // Dilakukan setelah source siap supaya service lama tetap hidup bila
    // update source gagal. File build/node_modules tidak boleh terkunci
    // saat npm install & build berjalan di Windows.
    appendLog('Stopping telemetry process (if any)...');
    await Command.create(
      'run-command',
      ['/C', 'pm2', 'stop', TELEMETRY_PM2_NAME],
      { cwd: setting.workingDirectory },
    )
      .execute()
      .catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // =====================================================
    // INSTALL DEPENDENCIES & BUILD
    // =====================================================
    appendLog('Installing telemetry dependencies...');
    await runCommand(
      ['/C', 'npm', 'install', '--no-audit', '--no-fund'],
      telemetryDir,
    );
    appendLog('Building telemetry...');
    // Hapus header bawaan otel-gui sebelum build (cukup di source hasil
    // clone/update, tidak memengaruhi repo aslinya).
    try {
      const layoutPath = `${telemetryDir}\\${TELEMETRY_LAYOUT_FILE}`;
      const layout = await readTextFile(layoutPath);
      const patchedLayout = layout.replace(TELEMETRY_HEADER_REGEX, '');
      if (patchedLayout === layout) {
        appendLog('Header otel-gui tidak ditemukan, patch dilewati.');
      } else {
        await writeTextFile(layoutPath, patchedLayout);
        appendLog('Header otel-gui dihapus sebelum build.');
      }
    } catch (err) {
      appendLog(`Patch header otel-gui dilewati: ${err}`);
    }
    await runCommand(['/C', 'npm', 'run', 'build'], telemetryDir);

    // =====================================================
    // START PM2
    // =====================================================
    appendLog('Starting telemetry service...');
    await Command.create(
      'run-command',
      ['/C', 'pm2', 'delete', TELEMETRY_PM2_NAME],
      { cwd: setting.workingDirectory },
    )
      .execute()
      .catch(() => {});
    await runCommand(
      ['/C', 'pm2', 'start', 'build/index.js', '--name', TELEMETRY_PM2_NAME],
      telemetryDir,
    );
    await Command.create('run-command', ['/C', 'pm2', 'save', '--force'], {
      cwd: setting.workingDirectory,
    })
      .execute()
      .catch(() => {});

    // =====================================================
    // VERIFIKASI STATUS PM2
    // =====================================================
    // Beri waktu proses boot, lalu pastikan PM2 benar-benar `online`.
    appendLog('Verifying telemetry process...');
    await new Promise((resolve) => setTimeout(resolve, 3000));
    let pm2Status = '';
    try {
      const jlist = await Command.create(
        'run-command',
        ['/C', 'pm2', 'jlist'],
        { cwd: setting.workingDirectory },
      ).execute();
      const proc = JSON.parse(jlist.stdout).find(
        (item) => item.name === TELEMETRY_PM2_NAME,
      );
      pm2Status = proc?.pm2_env?.status || 'not found';
    } catch {
      appendLog('Tidak dapat membaca status PM2 (output bukan JSON).');
    }
    if (pm2Status) {
      appendLog(`Telemetry PM2 status: ${pm2Status}`);
      if (pm2Status !== 'online') {
        throw new Error(
          `Telemetry gagal berjalan di PM2 (status: ${pm2Status}). Cek log proses telemetry.`,
        );
      }
    }

    appendLog(`Telemetry running at http://localhost:${TELEMETRY_PORT}`);
    fetchPm2List();
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
        { logStdout: false },
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
      const requestedBranch =
        key == 'API_CORE' ? setting.backendBranch || '' : '';
      appendLog(
        `Cloning repository... branch: ${
          requestedBranch || 'default (branch utama repo)'
        }`,
      );
      let param = { ...options, ...gitForm, directory: tempDir };
      if (requestedBranch) {
        param = { ...param, branch: requestedBranch };
      }
      const cloneResult = await gitClone(param);
      if (cloneResult.error) {
        throw new Error(cloneResult.message);
      }
      const version = await gitVersionInfo(tempDir);
      if (version.commit) {
        appendLog(
          `Branch ter-checkout: ${version.branch} • Last Version ${version.branch} (${version.commit.slice(0, 8)})`,
        );
        // Dicatat untuk tombol informasi versi di list PM2.
        setDeployInfo(`PM2:${options.title}`, {
          ...version,
          deployedAt: new Date().toLocaleString(),
        });
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
      APP_MODE: setting.appMode,

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
    <Box
      mt={1}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <Box display="flex" justifyContent="space-between" mb={1}>
        <Typography variant="h6" fontWeight="bold" color="primary.main">
          PM2 Management
        </Typography>

        <Box display="flex" gap={1}>
          <Tooltip title="Reload .env">
            <Box
              onClick={() => setOpenReloadDialog(true)}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 1,
                border: 1,
                borderColor: 'info.main',
                borderRadius: 1,
                color: 'info.main',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Autorenew />
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
          <Tooltip
            title={
              deployLoading !== ''
                ? 'Deployment sedang berjalan — klik untuk melihat progresnya'
                : ''
            }
          >
            <Button
              variant="contained"
              startIcon={
                deployLoading !== '' ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <RocketLaunch />
                )
              }
              onClick={() => setOpenDeployDialog(true)}
            >
              Tambah / Update App
            </Button>
          </Tooltip>
        </Box>
      </Box>
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}
      >
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
                  <Tooltip title="Informasi Versi">
                    <IconButton
                      color="info"
                      onClick={() =>
                        setVersionInfo({
                          title: proc.name,
                          info: deployInfo[`PM2:${proc.name}`] || null,
                        })
                      }
                    >
                      <Info />
                    </IconButton>
                  </Tooltip>
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
        open={openReloadDialog}
        onClose={() => setOpenReloadDialog(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Reload .env</DialogTitle>

        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            File .env diperbarui dari setting lalu diterapkan ke semua proses
            PM2. Pilih metode penerapannya:
          </Typography>

          <Box display="flex" flexDirection="column" gap={1} mt={2}>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<Autorenew />}
              onClick={() => chooseReload('soft')}
            >
              Soft Reload (reload --update-env)
            </Button>

            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteForever />}
              onClick={() => chooseReload('force')}
            >
              Force Reload (delete + start)
            </Button>
          </Box>

          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            mt={2}
          >
            Soft: tanpa downtime, memaksa PM2 ambil ulang environment. Force:
            hapus &amp; start ulang proses (downtime singkat) agar .env dibaca
            ulang sepenuhnya.
          </Typography>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpenReloadDialog(false)}>Batal</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={openDeployDialog}
        onClose={() => setOpenDeployDialog(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Deployment Manager</DialogTitle>

        <DialogContent>
          <Grid container spacing={2}>
            {DEPLOY_APPS.map((app, index) => {
              // Divider grup (mis. "Plugin") ditampilkan sekali di awal grup.
              const showGroupDivider =
                app.group && DEPLOY_APPS[index - 1]?.group !== app.group;
              return (
                <Fragment key={app.key}>
                  {showGroupDivider && (
                    <Grid size={{ xs: 12 }}>
                      <Divider textAlign="left" sx={{ mt: 1 }}>
                        <Typography
                          variant="overline"
                          color="text.secondary"
                          sx={{ letterSpacing: 1.5, fontWeight: 'bold' }}
                        >
                          {app.group}
                        </Typography>
                      </Divider>
                    </Grid>
                  )}
                  <Grid size={{ xs: 12, md: 6 }}>
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
                          // API_CORE & API_BPOM butuh kredensial Git privat.
                          // Plugin (telemetry/logrotate) langsung dieksekusi.
                          if (
                            app.key === 'API_CORE' ||
                            app.key === 'API_BPOM'
                          ) {
                            setSelectedDeploy(app.key);
                            setOpenGitDialog(true);
                          } else {
                            handleDeploy(app.key);
                          }
                        }}
                      >
                        {deployLoading === app.key
                          ? 'Processing...'
                          : 'Execute'}
                      </Button>
                    </Paper>
                  </Grid>
                </Fragment>
              );
            })}
          </Grid>

          <Divider sx={{ my: 2 }} />

          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <Typography variant="subtitle1" fontWeight="bold">
              Deployment Logs
            </Typography>
            {deployLoading !== '' && (
              <>
                <CircularProgress size={14} />
                <Typography variant="body2" color="text.secondary">
                  deployment masih berjalan, silakan tutup dialog ini — proses
                  tetap lanjut
                </Typography>
              </>
            )}
          </Box>

          <Paper
            ref={deployLogsRef}
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
          <Button onClick={clearDeployLogs}>Clear</Button>
          <Button onClick={() => setOpenDeployDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      <DialogGitAuthentication
        open={openGitDialog}
        onClose={() => {
          setOpenGitDialog(false);
          setPendingReload(false);
        }}
        gitForm={gitForm}
        setGitForm={setGitForm}
        loading={deployLoading !== '' || isLoading}
        onSubmit={async () => {
          // Jalur Reload .env (memakai autentikasi Git seperti aksi lain)
          if (pendingReload) {
            setIsLoading(true);
            const validasi = await gitValidation(gitForm);
            setIsLoading(false);
            if (validasi.error) {
              showAlert(validasi.message, 'error');
              return;
            }
            setOpenGitDialog(false);
            await handleReloadEnv(reloadMode);
            return;
          }

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
      <DialogVersionInfo
        open={Boolean(versionInfo)}
        onClose={() => setVersionInfo(null)}
        title={versionInfo?.title}
        info={versionInfo?.info}
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
      {isReloading && (
        <Paper
          elevation={6}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2,
            py: 1.5,
            borderRadius: 2,
            border: 1,
            borderColor: 'info.main',
          }}
        >
          <CircularProgress size={20} />
          <Typography variant="body2" fontWeight="medium">
            Aplikasi sedang direload, silakan cek berkala.
          </Typography>
        </Paper>
      )}
      <Pm2LogViewer
        open={openLogViewer}
        onClose={() => setOpenLogViewer(false)}
        process={selectedProcess}
      />
    </Box>
  );
}

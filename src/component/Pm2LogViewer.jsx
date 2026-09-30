import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField,
  Typography,
} from '@mui/material';

import {
  DeleteForeverOutlined,
  ExitToAppOutlined,
} from '@mui/icons-material';
import { readDir, remove } from '@tauri-apps/plugin-fs';
import { Command } from '@tauri-apps/plugin-shell';

import { gitValidation } from '../utility/gitUtility';
import { useAlert } from './AlertProvider';
import { useConfirm } from './ConfirmProvider';
import DialogGitAuthentication from './DialogGitAuthentication';

/**
 * Menentukan folder tempat PM2 menyimpan log file sebuah proses.
 * Sumber: `pm2_env.pm_out_log_path` (fallback `pm_err_log_path`), mis.
 * `C:\Users\user\.pm2\logs\Integra-out.log` → `C:\Users\user\.pm2\logs`.
 *
 * @param {Object} proc - Objek proses PM2 hasil `pm2 jlist`.
 * @returns {string|null} Path folder log, atau `null` jika tidak ditemukan.
 */
function getLogDir(proc) {
  const logPath =
    proc?.pm2_env?.pm_out_log_path || proc?.pm2_env?.pm_err_log_path;
  if (!logPath) return null;
  const idx = Math.max(logPath.lastIndexOf('\\'), logPath.lastIndexOf('/'));
  return idx >= 0 ? logPath.slice(0, idx) : null;
}

/**
 * Menentukan nama dasar file log aktif (tanpa ekstensi) yang dipakai untuk
 * mendeteksi file hasil rotasi. pm2-logrotate menambahkan suffix
 * `__<timestamp>` pada file hasil rotasi, mis.
 * `Integra-out.log` → `Integra-out__2026-09-30-10-00-00.log`
 * (atau `.log.gz` bila `pm2-logrotate:compress` aktif).
 *
 * @param {Object} proc - Objek proses PM2 hasil `pm2 jlist`.
 * @returns {string} Nama dasar file log, mis. `Integra-out`.
 */
function getLogBaseName(proc) {
  const logPath =
    proc?.pm2_env?.pm_out_log_path || proc?.pm2_env?.pm_err_log_path;
  const fileName = logPath ? logPath.split(/[\\/]/).pop() || '' : '';
  return fileName.replace(/\.log(\.gz)?$/i, '') || `${proc?.name || 'pm2'}-out`;
}

/**
 * Viewer log PM2 dengan monitoring real-time.
 *
 * Menyediakan:
 * - Monitoring log proses (`pm2 logs <name> --lines 200`) tiap 2 detik
 * - Pencarian log, auto scroll, clear screen, copy log
 * - Tombol hapus log hasil rotasi (`pm2-logrotate`) + truncate log aktif,
 *   dengan gate Git Authentication (validasi kredensial via `git ls-remote`)
 *
 * @component
 * @param {Object} props
 * @param {boolean} props.open    - Apakah dialog viewer terbuka.
 * @param {Function} props.onClose - Callback saat dialog ditutup.
 * @param {Object} props.process  - Objek proses PM2 (dari `pm2 jlist`).
 * @returns {JSX.Element} UI log viewer.
 */
export default function Pm2LogViewer({ open, onClose, process }) {
  const { showAlert } = useAlert();
  const { confirm: showConfirm } = useConfirm();

  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);

  // Log hasil rotasi (pm2-logrotate) milik proses yang sedang dibuka
  const [rotatedLogs, setRotatedLogs] = useState([]);
  const [openGitDialog, setOpenGitDialog] = useState(false);
  const [gitForm, setGitForm] = useState({ username: '', password: '' });
  const [isPurging, setIsPurging] = useState(false);

  const bottomRef = useRef(null);

  // Nilai turunan yang stabil (tidak bergantung identitas object `process`)
  const processName = process?.name || '';
  const logDir = useMemo(() => getLogDir(process), [process]);
  const logBase = useMemo(() => getLogBaseName(process), [process]);

  const filteredLogs = useMemo(() => {
    return logs.filter((line) =>
      line.toLowerCase().includes(search.toLowerCase()),
    );
  }, [logs, search]);

  // =====================================================
  // AUTO SCROLL
  // =====================================================
  useEffect(() => {
    if (!autoScroll) return;

    bottomRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [filteredLogs, autoScroll]);

  // =====================================================
  // LOAD LOG
  // =====================================================
  const loadLogs = useCallback(async () => {
    if (!processName) return;
    try {
      const result = await Command.create('run-command', [
        '/C',
        'pm2',
        'logs',
        processName,
        '--lines',
        '200',
        '--nostream',
      ]).execute();
      const content = `${result.stdout || ''}\n${result.stderr || ''}`;
      const lines = content.split(/\r?\n/).filter((v) => v.trim() !== '');
      setLogs(lines);
    } catch (err) {
      setLogs([`ERROR: ${err}`]);
    }
  }, [processName]);

  useEffect(() => {
    if (!open || !processName) return;

    let interval;

    loadLogs();
    // refresh tiap 2 detik
    interval = setInterval(loadLogs, 2000);
    return () => {
      clearInterval(interval);
    };
  }, [open, processName, loadLogs]);

  // =====================================================
  // LOAD LOG HASIL ROTASI (LOGROTATE)
  // =====================================================
  const loadRotatedLogs = useCallback(async () => {
    if (!logDir || !logBase) {
      setRotatedLogs([]);
      return;
    }
    try {
      const entries = await readDir(logDir);
      const found = entries
        .filter(
          (entry) =>
            !entry.isDirectory &&
            entry.name.startsWith(`${logBase}__`) &&
            /\.log(\.gz)?$/i.test(entry.name),
        )
        .map((entry) => ({ name: entry.name, path: `${logDir}\\${entry.name}` }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setRotatedLogs(found);
    } catch {
      // Folder log tidak bisa dibaca (mis. proses tanpa out/error log)
      setRotatedLogs([]);
    }
  }, [logDir, logBase]);

  useEffect(() => {
    if (!open) {
      setRotatedLogs([]);
      return;
    }
    loadRotatedLogs();
    // cek ulang tiap 5 detik (rotasi bisa terjadi saat dialog terbuka)
    const interval = setInterval(loadRotatedLogs, 5000);
    return () => clearInterval(interval);
  }, [open, loadRotatedLogs]);

  // =====================================================
  // HAPUS LOG ROTASI + TRUNCATE LOG AKTIF
  // =====================================================
  const purgeLogs = useCallback(async () => {
    setIsPurging(true);
    try {
      // 1. Hapus file log hasil rotasi milik proses ini saja
      const targets = rotatedLogs.filter((file) =>
        file.name.startsWith(`${logBase}__`),
      );
      const failed = [];
      for (const file of targets) {
        try {
          await remove(file.path);
        } catch (err) {
          failed.push(`${file.name} (${err})`);
        }
      }

      // 2. Kosongkan log aktif (out.log / error.log) via `pm2 flush`
      await Command.create('run-command', [
        '/C',
        'pm2',
        'flush',
        processName,
      ]).execute();

      await Promise.all([loadRotatedLogs(), loadLogs()]);

      if (failed.length > 0) {
        showAlert(
          `${targets.length - failed.length} file log rotasi dihapus, ${failed.length} gagal: ${failed.join('; ')}. Log aktif sudah dikosongkan.`,
          'warning',
        );
      } else {
        showAlert(
          `${targets.length} file log rotasi dihapus & log aktif dikosongkan`,
          'success',
        );
      }
    } catch (err) {
      showAlert(`${err}`, 'error');
    } finally {
      setIsPurging(false);
    }
  }, [rotatedLogs, logBase, processName, loadRotatedLogs, loadLogs, showAlert]);

  const stripAnsi = (text = '') => {
    return text.replace(
      // eslint-disable-next-line no-control-regex
      /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g,
      '',
    );
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: {
            height: '90vh',
            borderRadius: 3,
            overflow: 'hidden',
          },
        }}
      >
        {/* ========================================= */}
        {/* HEADER */}
        {/* ========================================= */}
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            bgcolor: 'primary.main',
            color: '#fff',
          }}
        >
          <Box>
            <Typography variant="h6" fontWeight="bold">
              PM2 Log Viewer
            </Typography>

            <Typography variant="caption">{process?.name || '-'}</Typography>
          </Box>
        </DialogTitle>

        {/* ========================================= */}
        {/* CONTENT */}
        {/* ========================================= */}
        <DialogContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            p: 3,
          }}
        >
          {/* STATUS */}
          <Box
            sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2, mt: 2 }}
          >
            <Chip
              label={process?.pm2_env?.status || 'unknown'}
              color={process?.pm2_env?.status === 'online' ? 'success' : 'error'}
            />

            <Chip variant="outlined" label={`PID : ${process?.pid || '-'}`} />

            <Chip color="warning" label={`CPU : ${process?.monit?.cpu || 0}%`} />

            <Chip
              color="info"
              label={`RAM : ${(
                (process?.monit?.memory || 0) /
                1024 /
                1024
              ).toFixed(2)} MB`}
            />

            <Chip
              variant="outlined"
              color={rotatedLogs.length > 0 ? 'warning' : 'default'}
              label={`Logrotate : ${rotatedLogs.length} file`}
            />
          </Box>

          {/* TOOLBAR */}
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              alignItems: 'center',
              mb: 2,
              flexWrap: 'wrap',
            }}
          >
            <TextField
              size="small"
              label="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                />
              }
              label="Auto Scroll"
            />

            <Button
              variant="outlined"
              color="warning"
              onClick={() => setLogs([])}
            >
              Clear Screen
            </Button>

            <Button
              variant="outlined"
              onClick={() => {
                navigator.clipboard.writeText(filteredLogs.join('\n'));
              }}
            >
              Copy Log
            </Button>

            <Button
              variant="outlined"
              color="error"
              disabled={isPurging || !processName}
              startIcon={
                isPurging ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <DeleteForeverOutlined />
                )
              }
              onClick={async () => {
                const ok = await showConfirm({
                  title: 'Delete Logrotate Logs',
                  message:
                    rotatedLogs.length > 0
                      ? `Hapus ${rotatedLogs.length} file log hasil rotasi (logrotate) dan kosongkan log aktif (out/error) untuk proses "${processName}"?`
                      : `Tidak ada file log rotasi. Log aktif (out/error) proses "${processName}" akan dikosongkan.`,
                  severity: 'danger',
                });
                if (ok) {
                  setOpenGitDialog(true);
                }
              }}
            >
              Delete Logrotate Logs ({rotatedLogs.length})
            </Button>
          </Box>

          {/* TERMINAL */}
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              bgcolor: '#0d1117',
              color: '#7ee787',
              p: 2,
              borderRadius: 2,
              border: '1px solid #30363d',
              fontFamily: 'Consolas, Monaco, monospace',
              fontSize: 13,
            }}
          >
            {filteredLogs.length === 0 ? (
              <Typography
                sx={{
                  color: '#8b949e',
                  fontFamily: 'inherit',
                }}
              >
                Waiting for log data...
              </Typography>
            ) : (
              filteredLogs.map((line, idx) => (
                <Typography
                  key={idx}
                  component="div"
                  sx={{
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {stripAnsi(line)}
                </Typography>
              ))
            )}

            <div ref={bottomRef} />
          </Box>
        </DialogContent>

        {/* ========================================= */}
        {/* FOOTER */}
        {/* ========================================= */}
        <DialogActions
          sx={{
            justifyContent: 'space-between',
            px: 3,
            py: 1.5,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Live PM2 Log Monitoring
          </Typography>

          <Button
            variant="contained"
            color="error"
            startIcon={<ExitToAppOutlined />}
            onClick={onClose}
          >
            Exit Log Viewer
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========================================= */}
      {/* GATE: GIT AUTHENTICATION */}
      {/* ========================================= */}
      <DialogGitAuthentication
        open={openGitDialog}
        onClose={() => {
          if (!isPurging) setOpenGitDialog(false);
        }}
        gitForm={gitForm}
        setGitForm={setGitForm}
        loading={isPurging}
        onSubmit={async () => {
          setIsPurging(true);
          // Validasi kredensial Git sebelum menghapus log
          const validasi = await gitValidation(gitForm);
          if (validasi.error) {
            setIsPurging(false);
            showAlert(validasi.message, 'error');
            return;
          }
          setOpenGitDialog(false);
          await purgeLogs();
        }}
      />
    </>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField,
  Typography,
} from '@mui/material';

import { ExitToAppOutlined } from '@mui/icons-material';
import { Command } from '@tauri-apps/plugin-shell';

export default function Pm2LogViewer({ open, onClose, process }) {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);

  const bottomRef = useRef(null);

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
  useEffect(() => {
    if (!open || !process?.name) return;

    let interval;

    const loadLogs = async () => {
      try {
        const result = await Command.create('run-command', [
          '/C',
          'pm2',
          'logs',
          process.name,
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
    };
    loadLogs();
    // refresh tiap 2 detik
    interval = setInterval(loadLogs, 2000);
    return () => {
      clearInterval(interval);
    };
  }, [open, process]);

  const stripAnsi = (text = '') => {
    return text.replace(
      // eslint-disable-next-line no-control-regex
      /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g,
      '',
    );
  };

  return (
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
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2, mt: 2 }}>
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
  );
}

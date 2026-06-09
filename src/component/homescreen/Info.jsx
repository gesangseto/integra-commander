import { Box, Grid, LinearProgress, Typography } from '@mui/material';
import { listen } from '@tauri-apps/api/event';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSettingStore } from '../../store/settingStore';
import {
  getDatabaseStatus,
  getNginxStatus,
  getNodejsStatus,
} from '../../utility';

export default function Info() {
  const setting = useSettingStore((state) => state.form);
  const [data, setData] = useState({
    cpu: 0,
    memory: 0,
    storage: 0,
    totalMemoryMB: 0,
    usedMemoryMB: 0,
  });

  const [dataPemakaian, setDataPemakaian] = useState({
    nginx: 0,
    nodejs: 0,
    database: 0,
  });

  const [lastUpdate, setLastUpdate] = useState('--:--:--');

  const loadingRef = useRef(false);

  const totalMertrackMemory = useMemo(() => {
    return (
      Number(dataPemakaian.nginx || 0) +
      Number(dataPemakaian.nodejs || 0) +
      Number(dataPemakaian.database || 0)
    );
  }, [dataPemakaian]);

  // =====================================================
  // LISTEN SYSTEM STATS DARI TAURI
  // =====================================================
  useEffect(() => {
    let cleanup;

    listen('sys-stats', (event) => {
      setData(event.payload);
    }).then((unlisten) => {
      cleanup = unlisten;
    });

    return () => {
      cleanup?.();
    };
  }, []);

  // =====================================================
  // LOAD PROCESS USAGE
  // =====================================================
  useEffect(() => {
    const loadStatus = async () => {
      if (loadingRef.current) return;

      loadingRef.current = true;

      try {
        const [nginx, nodejs, database] = await Promise.all([
          getNginxStatus(),
          getNodejsStatus(),
          getDatabaseStatus(
            setting.databaseDialect === 'mssql'
              ? 'sqlservr.exe'
              : 'postgres.exe',
          ),
        ]);

        setDataPemakaian({
          nginx: Number(nginx) || 0,
          nodejs: Number(nodejs) || 0,
          database: Number(database) || 0,
        });

        setLastUpdate(
          new Date().toLocaleTimeString('id-ID', {
            hour12: false,
          }),
        );
      } catch (err) {
        console.error(err);
      } finally {
        loadingRef.current = false;
      }
    };

    loadStatus();

    const interval = setInterval(loadStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Box
      sx={{
        backgroundColor: '#313131',
        color: '#fff',
        px: 4,
        py: 2,
        borderRadius: 3,
      }}
    >
      <Grid container spacing={3}>
        {/* ===================================================== */}
        {/* SYSTEM RESOURCE */}
        {/* ===================================================== */}
        <Grid size={6}>
          <Typography
            variant="overline"
            sx={{
              letterSpacing: 1.5,
              fontWeight: 'bold',
            }}
          >
            System Resources
          </Typography>

          <Box mt={1}>
            <ResourceItemPercent
              label="CPU Usage"
              value={data.cpu}
              color="#00e5ff"
            />

            <ResourceItemPercent
              label="Memory Usage"
              value={data.memory}
              color="#ff00ff"
            />

            <ResourceItemPercent
              label="Disk Storage"
              value={data.storage}
              color="#ff9100"
            />
          </Box>
        </Grid>

        {/* ===================================================== */}
        {/* MERTRACK RESOURCE */}
        {/* ===================================================== */}
        <Grid size={6}>
          <Typography
            variant="overline"
            sx={{
              letterSpacing: 1.5,
              fontWeight: 'bold',
            }}
          >
            Mertrack Memory Usage
          </Typography>

          <Box mt={1}>
            <ResourceItemMemory
              label="NodeJS"
              value={dataPemakaian.nodejs}
              totalMB={data.totalMemoryMB}
              color="#00e5ff"
            />

            <ResourceItemMemory
              label="Nginx"
              value={dataPemakaian.nginx}
              totalMB={data.totalMemoryMB}
              color="#ff00ff"
            />

            <ResourceItemMemory
              label="Database"
              value={dataPemakaian.database}
              totalMB={data.totalMemoryMB}
              color="#ff9100"
            />
          </Box>
        </Grid>
      </Grid>

      {/* ===================================================== */}
      {/* FOOTER INFO */}
      {/* ===================================================== */}
      <Box
        mt={1}
        pt={1}
        display="flex"
        justifyContent="space-between"
        borderTop="1px solid rgba(255,255,255,0.08)"
      >
        <Typography variant="caption" color="gray">
          Total RAM : {(data.totalMemoryMB / 1024).toFixed(1)} GB
        </Typography>
        <Typography variant="caption" color="gray">
          Mertrack Total Usage RAM :
          {(data.totalMemoryMB > 0
            ? (totalMertrackMemory / data.totalMemoryMB) * 100
            : 0
          ).toFixed(2)}
          %
        </Typography>

        {/* <Typography variant="caption" color="gray">
          Last Update : {lastUpdate}
        </Typography> */}
      </Box>
    </Box>
  );
}

// =====================================================
// PERCENT ITEM
// =====================================================
const ResourceItemPercent = ({ label, value = 0, color }) => {
  const percent = Number(value) || 0;

  return (
    <Box mb={1.5}>
      <Box display="flex" justifyContent="space-between" mb={0.5}>
        <Typography variant="body2">{label}</Typography>

        <Typography
          sx={{
            fontFamily: 'monospace',
            fontWeight: 'bold',
          }}
        >
          {percent.toFixed(1)}%
        </Typography>
      </Box>

      <LinearProgress
        variant="determinate"
        value={Math.min(percent, 100)}
        sx={{
          height: 10,
          borderRadius: 5,
          bgcolor: 'rgba(255,255,255,0.08)',
          '& .MuiLinearProgress-bar': {
            bgcolor: color,
          },
        }}
      />
    </Box>
  );
};

// =====================================================
// MEMORY ITEM
// =====================================================
const ResourceItemMemory = ({ label, value = 0, totalMB = 0, color }) => {
  const usedMB = Number(value) || 0;

  const percent = totalMB > 0 ? (usedMB / totalMB) * 100 : 0;

  return (
    <Box mb={1.5}>
      <Box display="flex" justifyContent="space-between" mb={0.5}>
        <Typography variant="body2">{label}</Typography>

        <Typography
          sx={{
            fontFamily: 'monospace',
            fontWeight: 'bold',
          }}
        >
          {usedMB.toFixed(0)} MB / {(totalMB / 1024).toFixed(1)} GB (
          {percent.toFixed(1)}%)
        </Typography>
      </Box>

      <LinearProgress
        variant="determinate"
        value={Math.min(percent, 100)}
        sx={{
          height: 10,
          borderRadius: 5,
          bgcolor: 'rgba(255,255,255,0.08)',
          '& .MuiLinearProgress-bar': {
            bgcolor: color,
          },
        }}
      />
    </Box>
  );
};

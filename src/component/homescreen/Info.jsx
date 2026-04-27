import { Box, LinearProgress, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { Command } from '@tauri-apps/plugin-shell';
import { listen } from '@tauri-apps/api/event';
export default function Info() {
  const [data, setData] = useState({
    cpu: 0,
    memory: 0,
    storage: 0,
  });

  // Di dalam komponen React Anda
  useEffect(() => {
    const unlisten = listen('sys-stats', (event) => {
      const data = event.payload;
      setData(data);
    });
    fetchFullStats();
    return () => {
      unlisten.then((f) => f()); // Cleanup saat komponen unmount
    };
  }, []);

  const runPostgresQuery = async (query) => {
    try {
      const pass = 'm3r1nD003092021';
      const connectionString = `postgresql://postgres:${pass}@127.0.0.1:5432/postgres`;
      const script = `psql "${connectionString}" -t -A -c "${query}"`;
      const cmd = Command.create('run-command', ['/C', `${script}`]);

      console.log('Executing:', script);
      const output = await cmd.execute();
      console.log(output);
      if (output.code !== 0) {
        console.error('Stderr Output:', output.stderr);
        throw new Error(output.stderr);
      }
      return output.stdout.trim();
    } catch (error) {
      console.error('Postgres Error:', error);
      return null;
    }
  };

  const fetchFullStats = async () => {
    const sql = `SELECT row_to_json(t) FROM (SELECT (SELECT count(*) FROM pg_stat_activity) as connections, (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_queries, (SELECT count(*) FROM pg_stat_activity WHERE wait_event IS NOT NULL) as blocked_queries, (SELECT pg_size_pretty(pg_database_size(current_database()))) as db_size, (SELECT round(sum(blks_hit)*100/nullif(sum(blks_hit+blks_read),0),2) FROM pg_stat_database) as cache_hit_ratio, (SELECT sum(xact_commit) FROM pg_stat_database) as total_commits, (SELECT sum(xact_rollback) FROM pg_stat_database) as total_rollbacks) t;`;

    const res = await runPostgresQuery(sql);
    console.log(res);

    if (res) {
      const data = JSON.parse(res);
      console.log('Postgres Dashboard Data:', data);
      // Masukkan ke state React Anda
    }
  };
  // ================= VIEW LAYOUT =================
  return (
    <Box
      sx={{
        backgroundColor: '#313131',
        color: '#ffffff',
        px: 5,
        py: 2,
        borderRadius: 4,
      }}
    >
      {/* TABEL UTAMA PM2 */}
      <Typography
        variant="overline"
        sx={{ letterSpacing: 1.5, fontWeight: 'bold' }}
      >
        System Resources
      </Typography>

      <Box sx={{ mt: 1 }}>
        <ResourceItem label="CPU Usage" value={data.cpu} color="#00e5ff" />
        <ResourceItem
          label="Memory Usage"
          value={data.memory}
          color="#ff00ff"
        />
        <ResourceItem
          label="System Disk Storage"
          value={data.storage}
          color="#ff9100"
        />
      </Box>
    </Box>
  );
}

const ResourceItem = ({ label, value, color }) => (
  <Box sx={{ mb: 1.5 }}>
    <Box display="flex" justifyContent="space-between" mb={1}>
      <Typography variant="body1" sx={{ fontWeight: 500, fontSize: '0.9rem' }}>
        {label}
      </Typography>
      <Typography
        variant="body1"
        sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}
      >
        {value.toFixed(1)}%
      </Typography>
    </Box>
    <LinearProgress
      variant="determinate"
      value={value > 100 ? 100 : value} // Proteksi agar bar tidak overflow
      sx={{
        height: 10,
        borderRadius: 5,
        bgcolor: 'rgba(255,255,255,0.05)',
        '& .MuiLinearProgress-bar': {
          bgcolor: color,
          borderRadius: 5,
          transition: 'transform 0.4s linear', // Transmisi bar lebih smooth
        },
      }}
    />
  </Box>
);

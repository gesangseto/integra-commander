import { Circle } from '@mui/icons-material';
import { Box, Grid, keyframes, Paper } from '@mui/material';
import { Command } from '@tauri-apps/plugin-shell';
import { useEffect } from 'react';
import mertrackLogo from '../../assets/mertrack.png';
import { useAppStore } from '../../store/pathStore';

const blinkRed = keyframes`
  0% { background-color: #ff8383; }
  50% { background-color: #a30505; }
  100% { background-color: #ff8383; }
`;
const blinkGreen = keyframes`
  0% { background-color: #00b12c; }
  50% { background-color: #00b12c; }
  100% { background-color: #00b12c; }
`;

function Header() {
  const store = useAppStore();
  useEffect(() => {
    const fetchAll = async () => {
      // 1. Fetch Nginx menggunakan path dari store
      const nginxOut = await Command.create('run-command', [
        '/C',
        'nginx',
        '-p',
        store.nginxPath,
        '-v',
      ]).execute();
      const nv = (nginxOut.stdout || nginxOut.stderr || '')
        .replace('nginx version: ', '')
        .trim();

      // 2. Fetch yang lain
      const pm2Out = await Command.create('run-command', [
        '/C',
        'pm2',
        '-v',
      ]).execute();
      const nodeOut = await Command.create('run-command', [
        '/C',
        'node',
        '-v',
      ]).execute();
      const npmOut = await Command.create('run-command', [
        '/C',
        'npm',
        '-v',
      ]).execute();

      // Update sekaligus ke Store
      store.setVersions({
        nginx: nv || 'Error',
        pm2: pm2Out.stdout.trim() || 'Error',
        node: nodeOut.stdout.trim() || 'Error',
        npm: npmOut.stdout.trim() || 'Error',
      });
    };

    fetchAll();
  }, [store.nginxPath]); // Auto-refresh jika user merubah folder Nginx

  return (
    <Paper sx={{ borderRadius: 2 }}>
      <Grid container spacing={2} alignItems="center">
        <Grid item size={12}>
          {/* IMAGE INFO */}
          <Box display="flex">
            <Box flex={1}>
              <img
                src={mertrackLogo}
                style={{ height: 75, width: 'auto' }}
                loading="lazy"
              />
            </Box>
            {/* DEVICE INFO */}
            <Box flex={1} alignContent={'center'} mx={5}>
              <Box
                sx={{
                  width: 450,
                  height: 60,
                  borderRadius: 3,
                  bgcolor: '#ffffff',
                  border: 1,
                  // Properti untuk mengetengahkan teks:
                  display: 'flex',
                  justifyContent: 'space-evenly',
                  alignItems: 'center',
                  color: 'black', // Agar teks kontras dengan background merah
                  fontWeight: 'bold',
                  fontSize: '1.2rem',
                }}
              >
                <span
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Circle
                    fontSize="small"
                    color={store.nodeVersion ? 'success' : 'error'}
                  />
                  node {store.nodeVersion}
                </span>
                <span
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Circle
                    fontSize="small"
                    color={store.npmVersion ? 'success' : 'error'}
                  />
                  npm {store.npmVersion}
                </span>
                <span
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Circle
                    fontSize="small"
                    color={store.pm2Version ? 'success' : 'error'}
                  />
                  pm2 {store.pm2Version}
                </span>
              </Box>
            </Box>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
}

export default Header;

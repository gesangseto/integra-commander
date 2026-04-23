import { Circle } from '@mui/icons-material';
import { Box, Grid, keyframes, Paper } from '@mui/material';
import { Command } from '@tauri-apps/plugin-shell';
import { useEffect } from 'react';
import mertrackLogo from '../../assets/mertrack.png';
import '../../css/layout/Header.css';
import { versionStore } from '../../store/versionStore';

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
  const versionNginx = versionStore((state) => state.nginx);
  const versionNpm = versionStore((state) => state.npm);
  const versionPm2 = versionStore((state) => state.pm2);
  const versionNode = versionStore((state) => state.node);
  const setNginx = versionStore((state) => state.setNginx);
  const setPm2 = versionStore((state) => state.setPm2);
  const setNpm = versionStore((state) => state.setNpm);
  const setNode = versionStore((state) => state.setNode);

  useEffect(() => {
    async function fetchNginx() {
      let nginx = Command.create('run-command', ['/C', 'nginx', '-v']);
      nginx = await nginx.execute();
      if (nginx.stdout) setNginx(nginx.stdout);
      else setNginx(nginx.stderr);
    }
    async function fetchPm2() {
      let pm2 = Command.create('run-command', ['/C', 'pm2', '-v']);
      pm2 = await pm2.execute();
      setPm2(pm2.stdout);
    }
    async function fetchNode() {
      let node = Command.create('run-command', ['/C', 'node', '-v']);
      node = await node.execute();
      setNode(node.stdout);
    }
    async function fetchNpm() {
      let npm = Command.create('run-command', ['/C', 'npm', '-v']);
      npm = await npm.execute();
      setNpm(npm.stdout);
    }
    if (!versionNginx) fetchNginx();
    if (!versionPm2) fetchPm2();
    if (!versionNode) fetchNode();
    if (!versionNpm) fetchNpm();
  }, []);

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
            {/* PRODUCTION INFO */}
            <Box flex={1} alignContent={'center'} mx={5}>
              <Box
                sx={{
                  width: 450,
                  height: 60,
                  borderRadius: 3,
                  // Properti untuk mengetengahkan teks:
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '1.2rem',
                  // Tambahkan animasi kedap-kedip yang tadi jika mau
                  animation: `${versionNginx ? blinkGreen : blinkRed} 1s infinite ease-in-out`,
                }}
              >
                Website {versionNginx ? 'Active' : 'Inactive'}
              </Box>
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
                    color={versionNode ? 'success' : 'error'}
                  />
                  node {versionNode}
                </span>
                <span
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Circle
                    fontSize="small"
                    color={versionNpm ? 'success' : 'error'}
                  />
                  npm {versionNpm}
                </span>
                <span
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Circle
                    fontSize="small"
                    color={versionPm2 ? 'success' : 'error'}
                  />
                  pm2 {versionPm2}
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

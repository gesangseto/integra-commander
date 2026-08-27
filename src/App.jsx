import { Box } from '@mui/material';
import { invoke } from '@tauri-apps/api/core';
import { Command } from '@tauri-apps/plugin-shell';
import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Footer from './component/layout/Footer';
import Header from './component/layout/Header';
import SideBar from './component/layout/SideBar';
import HomeScreen from './screen/HomeScreen';
import SettingScreen from './screen/SettingScreen';
import Splash from './screen/Splash';
import { useAppStore } from './store/pathStore';
import { showGlobalAlert } from './component/AlertProvider';

function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const { nginxPath, setNginxPath } = useAppStore();

  useEffect(() => {
    const initApp = async () => {
      try {
        // =====================================================
        // CEK ADMIN PRIVILEGES
        // =====================================================
        const admin = await invoke('is_admin');
        if (!admin) {
          showGlobalAlert(
            'Aplikasi berjalan tanpa hak Admin. Fitur "Setup Startup" membutuhkan Run as Administrator.',
            'warning'
          );
        }
        // =====================================================
        // PM2 RESURRECT
        // =====================================================
        await Command.create('run-command', [
          '/C',
          'pm2',
          'resurrect',
        ]).execute();
        // =====================================================
        // START NGINX JIKA PATH ADA
        // =====================================================
        if (nginxPath) {
          // CHECK NGINX RUNNING
          const nginxCheck = await Command.create('run-command', [
            '/C',
            'tasklist',
          ]).execute();
          // START NGINX
          if (!nginxCheck.stdout.toLowerCase().includes('nginx.exe')) {
            Command.create('run-command', [
              '/C',
              'start',
              '/B',
              'nginx.exe',
              '-p',
              nginxPath,
            ]).execute();
          }
        }
        setReady(true);
      } catch (err) {
        setReady(true);
      }
    };

    initApp();
  }, []);

  if (!ready) return <Splash />;

  return (
    <BrowserRouter>
      <Box
        sx={{
          display: 'flex',
          height: '100vh',
          width: '100vw',
          overflow: 'hidden',
          backgroundColor: '#f8fafc',
        }}
      >
        <Box sx={{ flexShrink: 0, height: '100vh', overflow: 'hidden' }}>
          <SideBar />
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minWidth: 0,
            height: '100vh',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ flexShrink: 0, zIndex: 2 }}>
            <Header />
          </Box>

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              px: 1,
              py: 1,
            }}
          >
            <Routes>
              <Route path="/" element={<HomeScreen user={user} />} />
              <Route path="/setting" element={<SettingScreen />} />
            </Routes>
          </Box>

          <Box sx={{ flexShrink: 0 }}>
            <Footer />
          </Box>
        </Box>
      </Box>
    </BrowserRouter>
  );
}

export default App;

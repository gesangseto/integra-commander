import { Box } from '@mui/material';
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

function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const { nginxPath, setNginxPath } = useAppStore();

  useEffect(() => {
    const initApp = async () => {
      try {
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
      <Box display="flex" height="100vh">
        <SideBar />
        <Box display="flex" flexDirection="column" flex={1}>
          <Header />
          <Box flex={1}>
            <Routes>
              <Route path="/" element={<HomeScreen user={user} />} />
              <Route path="/setting" element={<SettingScreen />} />
            </Routes>
          </Box>

          <Footer />
        </Box>
      </Box>
    </BrowserRouter>
  );
}

export default App;

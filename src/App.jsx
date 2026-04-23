import { Box } from '@mui/material';
import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Footer from './component/layout/Footer';
import Header from './component/layout/Header';
import SideBar from './component/layout/SideBar';
import database from './configuration/database';
import { syncStructureMain } from './models';
import HomeScreen from './screen/HomeScreen';
import SettingScreen from './screen/SettingScreen';
import Splash from './screen/Splash';
import { useConfig } from './store/configStore';
import { syncAppConfig } from './sync/mertrackDb';

function App() {
  const setConfig = useConfig((state) => state.setData);
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        // 🔌 INIT MAIN DB
        await database.initMain();
        await syncStructureMain();
        // Syncron base data Pack Master
        setConfig(await syncAppConfig());

        setReady(true);
      } catch (err) {
        console.error('❌ Init error:', err);
      }
    };

    init();
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

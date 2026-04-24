import {
  Box,
  Divider,
  Grid,
  Paper,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useState } from 'react';

// Import komponen terpisah
import Info from '../component/homescreen/Info';
import TabNginx from '../component/homescreen/TabNginx';
import TabPm2 from '../component/homescreen/TabPm2';

export default function Home() {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  return (
    <Paper
      sx={{ height: '100%', width: '100%', p: 3, boxSizing: 'border-box' }}
    >
      <Info />

      <Divider sx={{ my: 1 }} />
      <Typography variant="h5" fontWeight="bold" mb={1}>
        Server Control Panel
      </Typography>

      {/* Navigasi Tab */}
      <Tabs
        value={tabValue}
        onChange={handleTabChange}
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="PM2" />
        <Tab label="Nginx" />
      </Tabs>

      {/* Konten sesuai tab yang aktif */}
      {tabValue === 0 && <TabPm2 />}
      {tabValue === 1 && <TabNginx />}
    </Paper>
  );
}

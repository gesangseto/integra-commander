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
      sx={{
        height: '100%',
        width: '100%',
        p: 2,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Info />

      <Divider sx={{ my: 0.5 }} />
      <Typography variant="h5" fontWeight="bold" mb={0.5}>
        Server Control Panel
      </Typography>

      {/* Navigasi Tab */}
      <Tabs
        value={tabValue}
        onChange={handleTabChange}
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="BACKEND" />
        <Tab label="FRONTEND" />
      </Tabs>

      {/* Konten sesuai tab yang aktif */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {tabValue === 0 && <TabPm2 />}
        {tabValue === 1 && <TabNginx />}
      </Box>
    </Paper>
  );
}

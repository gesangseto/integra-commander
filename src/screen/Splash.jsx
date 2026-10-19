import React, { useState, useEffect } from 'react';
import { Paper, Box, CircularProgress, Typography } from '@mui/material';

export default function Splash() {
  const [status, setStatus] = useState('Menginisialisasi sistem...');

  useEffect(() => {
    // Simulasi perubahan teks status agar terasa lebih dinamis
    const timers = [
      setTimeout(() => setStatus('Menghubungkan ke PM2...'), 1000),
      setTimeout(() => setStatus('Membaca konfigurasi Nginx...'), 2000),
      setTimeout(() => setStatus('Mempersiapkan dashboard...'), 3000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <Paper
      elevation={0}
      sx={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)',
        borderRadius: 0,
        boxSizing: 'border-box',
      }}
    >
      <Box sx={{ position: 'relative', display: 'inline-flex', mb: 3 }}>
        {/* Efek glow di belakang loader */}
        <Box
          sx={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            boxShadow: '0 0 30px 5px rgba(37, 99, 235, 0.25)',
          }}
        />
        <CircularProgress size={60} thickness={4} sx={{ color: '#2563eb' }} />
      </Box>

      <Typography
        variant="h6"
        fontWeight="bold"
        letterSpacing={1}
        gutterBottom
        sx={{ color: '#0f172a' }}
      >
        Integra Commander
      </Typography>

      <Typography variant="body2" sx={{ color: '#64748b' }}>
        {status}
      </Typography>

      <Typography variant="caption" sx={{ color: '#94a3b8', mt: 3 }}>
        V1
      </Typography>
    </Paper>
  );
}

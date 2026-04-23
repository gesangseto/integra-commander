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
      sx={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1a1a24', // Latar belakang gelap estetik
        color: '#ffffff',
        boxSizing: 'border-box',
        borderRadius: 0, // Datar agar menyatu dengan borderless window
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
            boxShadow: '0 0 30px 5px rgba(0, 210, 255, 0.4)',
          }}
        />
        <CircularProgress size={60} thickness={4} sx={{ color: '#00d2ff' }} />
      </Box>

      <Typography variant="h6" fontWeight="bold" letterSpacing={1} gutterBottom>
        Integra Commander
      </Typography>

      <Typography variant="body2" sx={{ color: '#8a8a9e' }}>
        {status}
      </Typography>

      <Typography variant="caption" sx={{ color: '#52526b', mt: 3 }}>
        V1
      </Typography>
    </Paper>
  );
}

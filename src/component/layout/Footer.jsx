import { Box, Paper, Typography } from '@mui/material';
import { Business, Copyright, Language } from '@mui/icons-material';
import { Divider } from '@mui/material';

function Footer() {
  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 2,
        px: 2,
        py: 1,
        border: '1px solid #e0e0e0',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: '#fff',
      }}
    >
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        flexWrap="wrap"
        gap={1}
      >
        <Typography variant="body2" fontWeight="bold">
          MERTRACK
        </Typography>

        <Typography variant="caption" sx={{ opacity: 0.8 }}>
          Powered by PT Merindo Makmur
        </Typography>

        <Typography
          variant="caption"
          component="a"
          href="https://merindo.co.id"
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            color: '#90caf9',
            textDecoration: 'none',
          }}
        >
          merindo.co.id
        </Typography>
      </Box>
    </Paper>
  );
}

export default Footer;

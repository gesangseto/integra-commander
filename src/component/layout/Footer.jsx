import { Box, Paper, Typography } from '@mui/material';

function Footer() {
  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 3,
        px: 2,
        py: 0.75,
        border: '1px solid #182136',
        backgroundColor: '#182136',
      }}
    >
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        flexWrap="wrap"
        gap={1}
      >
        <Typography variant="body2" fontWeight={700} sx={{ color: '#f8f8f8' }}>
          MERTRACK
        </Typography>

        <Typography variant="caption" sx={{ color: '#e5e7eb' }}>
          Powered by PT Merindo Makmur
        </Typography>

        <Typography
          variant="caption"
          component="a"
          href="https://merindo.co.id"
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            color: '#e5e7eb',
            textDecoration: 'none',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          merindo.co.id
        </Typography>
      </Box>
    </Paper>
  );
}

export default Footer;

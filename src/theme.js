import { createTheme } from '@mui/material/styles';

/**
 * Tema compact khusus area Form & Konten (Home + Setting).
 * Membuat font, input, tombol, tabel, dan dialog lebih kecil
 * agar pas dan rapi di layar 1920x1080.
 *
 * Header / SideBar / Footer TIDAK terpengaruh (di luar ThemeProvider ini).
 */
const compactTheme = createTheme({
  typography: {
    fontSize: 13, // base 14 -> 13
    h5: { fontSize: '1.1rem', fontWeight: 700 },
    h6: { fontSize: '0.95rem', fontWeight: 700 },
    body1: { fontSize: '0.8125rem' }, // 13px
    body2: { fontSize: '0.75rem' }, // 12px
    caption: { fontSize: '0.6875rem' }, // 11px
    overline: { fontSize: '0.625rem' }, // 10px
    button: { fontSize: '0.75rem' }, // 12px
  },
  components: {
    MuiTextField: {
      defaultProps: { size: 'small' },
    },
    MuiButton: {
      defaultProps: { size: 'small' },
    },
    MuiIconButton: {
      defaultProps: { size: 'small' },
    },
    MuiChip: {
      defaultProps: { size: 'small' },
    },
    MuiTable: {
      defaultProps: { size: 'small' },
    },
    MuiTab: {
      styleOverrides: {
        root: { minHeight: 36, fontSize: '0.8125rem' },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 36 },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { height: 6, borderRadius: 3 },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: { fontSize: '1rem', padding: '12px 16px' },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: { padding: '12px 16px' },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: { padding: '8px 16px' },
      },
    },
  },
});

export default compactTheme;
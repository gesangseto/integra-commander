import { createTheme } from '@mui/material/styles';

/**
 * Tema "Light Clean" modern untuk area Form & Konten (Home + Setting).
 * Palet terang, aksen biru brand Mertrack, sudut membulat, tabel & dialog
 * ringan. Header / SideBar / Footer memakai styling sendiri (di luar
 * ThemeProvider ini) namun tetap mengikuti palet yang sama.
 */
const compactTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2563eb',
      dark: '#1d4ed8',
      light: '#dbeafe',
      contrastText: '#ffffff',
    },
    secondary: { main: '#64748b' },
    success: { main: '#16a34a', light: '#dcfce7' },
    warning: { main: '#f59e0b', light: '#fef3c7' },
    error: { main: '#dc2626', light: '#fee2e2' },
    info: { main: '#0891b2', light: '#cffafe' },
    background: { default: '#f5f7fb', paper: '#ffffff' },
    text: { primary: '#0f172a', secondary: '#64748b', disabled: '#94a3b8' },
    divider: '#e5e7eb',
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily:
      "'Inter','Segoe UI',system-ui,-apple-system,Roboto,Helvetica,Arial,sans-serif",
    fontSize: 13,
    h5: { fontSize: '1.15rem', fontWeight: 700 },
    h6: { fontSize: '1rem', fontWeight: 700 },
    body1: { fontSize: '0.8125rem' }, // 13px
    body2: { fontSize: '0.75rem' }, // 12px
    caption: { fontSize: '0.6875rem' }, // 11px
    overline: { fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em' },
    button: { fontSize: '0.8125rem', fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: '#f5f7fb' },
      },
    },
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
    MuiButton: {
      defaultProps: { size: 'small', disableElevation: true },
      styleOverrides: {
        root: { textTransform: 'none', borderRadius: 10, fontWeight: 600 },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small' },
    },
    MuiIconButton: {
      defaultProps: { size: 'small' },
      styleOverrides: { root: { borderRadius: 10 } },
    },
    MuiChip: {
      defaultProps: { size: 'small' },
      styleOverrides: { root: { borderRadius: 8, fontWeight: 600 } },
    },
    MuiTable: {
      defaultProps: { size: 'small' },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-root': {
            backgroundColor: '#f9fafb',
            color: '#475569',
            fontWeight: 700,
            borderBottom: '1px solid #e5e7eb',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: '1px solid #f1f5f9' },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': { backgroundColor: '#f8fafc' },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 38,
          fontSize: '0.8125rem',
          fontWeight: 600,
          textTransform: 'none',
        },
      },
    },
    MuiTabs: {
      styleOverrides: { root: { minHeight: 38 } },
    },
    MuiLinearProgress: {
      styleOverrides: { root: { height: 6, borderRadius: 3 } },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 14 } },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: { fontSize: '1rem', fontWeight: 700, padding: '14px 18px' },
      },
    },
    MuiDialogContent: {
      styleOverrides: { root: { padding: '16px 18px' } },
    },
    MuiDialogActions: {
      styleOverrides: { root: { padding: '12px 18px' } },
    },
    MuiTooltip: {
      defaultProps: { arrow: true },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: '#e5e7eb' } },
    },
  },
});

export default compactTheme;

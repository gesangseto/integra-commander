import {
  Dialog,
  DialogContent,
  DialogTitle,
  Typography,
  Box,
  Button,
  DialogActions,
} from '@mui/material';

/**
 * Menampilkan versi terakhir yang ter-deploy pada satu item list:
 * branch, commit hash, dan pesan commit terakhir.
 *
 * @param {{open:boolean, onClose:Function, title:string, info:?Object}} props
 * @param {Object} [info] - Catatan dari `gitVersionInfo`; `null` bila item
 *   belum pernah di-deploy dengan versi app ini.
 */
function DialogVersionInfo({ open, onClose, title, info }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {title}{' '}
        {info && info.commit
          ? ` ${info.branch || '-'} (${info.commit.slice(0, 8)})`
          : ''}
      </DialogTitle>

      <DialogContent>
        {info && info.commit ? (
          <>
            <Box
              mt={1.5}
              p={1.5}
              sx={{
                border: '1px solid #e5e7eb',
                borderRadius: 2,
                bgcolor: '#f8fafc',
                fontFamily: 'monospace',
                fontSize: 12.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 220,
                overflowY: 'auto',
              }}
            >
              {info.message || '(pesan commit kosong)'}
            </Box>

            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              mt={1.5}
            >
              {`Commit: ${info.commit}`}
              {info.deployedAt ? ` • Deploy: ${info.deployedAt}` : ''}
            </Typography>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Belum ada catatan versi untuk item ini. Deploy ulang item tersebut
            dengan versi aplikasi ini agar branch dan commit terakhir tercatat.
          </Typography>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Tutup</Button>
      </DialogActions>
    </Dialog>
  );
}

export default DialogVersionInfo;

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';

function DialogTailscaleAuthentication({
  open,
  onClose,
  tailscaleForm,
  setTailscaleForm,
  onSubmit,
  loading = false,
  title = 'Tailscale Authentication',
  submitLabel = 'Simpan',
  onDelete,
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>

      <DialogContent>
        <Box mt={1}>
          <TextField
            fullWidth
            type="password"
            label="Auth Key Tailscale (opsional)"
            placeholder="tskey-auth-..."
            helperText="Kosongkan bila tidak memakai auth key: menu Remote Connection akan login lewat browser, tanpa kunci. Auth key dibuat di admin console (Generate auth key), umur maksimalnya 90 hari."
            value={tailscaleForm.authKey}
            onChange={(e) =>
              setTailscaleForm((prev) => ({ ...prev, authKey: e.target.value }))
            }
          />
        </Box>

        <Box mt={3}>
          <TextField
            fullWidth
            label="Hostname di Tailnet"
            placeholder="kosong = nama PC ini"
            helperText="Huruf kecil, angka, dan tanda hubung."
            value={tailscaleForm.hostname}
            onChange={(e) =>
              setTailscaleForm((prev) => ({
                ...prev,
                hostname: e.target.value,
              }))
            }
          />
        </Box>

        <Box mt={3}>
          <TextField
            fullWidth
            label="Login Server"
            placeholder="kosong = tailscale.com (bisa)"
            helperText="Isi hanya bila memakai server tailnet sendiri, mis. https://headscale.rumah.com:8443"
            value={tailscaleForm.loginServer}
            onChange={(e) =>
              setTailscaleForm((prev) => ({
                ...prev,
                loginServer: e.target.value,
              }))
            }
          />
        </Box>
      </DialogContent>

      <DialogActions>
        {onDelete && (
          <Button color="error" onClick={onDelete} disabled={loading} sx={{ mr: 'auto' }}>
            Hapus
          </Button>
        )}

        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>

        <Button variant="contained" onClick={onSubmit} disabled={loading}>
          {loading ? 'Processing...' : submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default DialogTailscaleAuthentication;

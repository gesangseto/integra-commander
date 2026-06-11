import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';

function DialogGitAuthentication({
  open,
  onClose,
  gitForm,
  setGitForm,
  onSubmit,
  loading = false,
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Git Authentication</DialogTitle>

      <DialogContent>
        <Box mt={1}>
          <TextField
            fullWidth
            label="Git Username"
            value={gitForm.username}
            onChange={(e) =>
              setGitForm((prev) => ({
                ...prev,
                username: e.target.value,
              }))
            }
          />
        </Box>

        <Box mt={3}>
          <TextField
            fullWidth
            type="password"
            label="Git Password / Personal Access Token"
            value={gitForm.password}
            onChange={(e) =>
              setGitForm((prev) => ({
                ...prev,
                password: e.target.value,
              }))
            }
          />
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>

        <Button variant="contained" onClick={onSubmit} disabled={loading}>
          {loading ? 'Processing...' : 'Execute'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default DialogGitAuthentication;

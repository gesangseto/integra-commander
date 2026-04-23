import { Box, Button, Paper, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { login } from '../service/Authentication';
import {
  useAuthStore,
  useAuthStorePanelA,
  useAuthStorePanelB,
} from '../store/authStore';
import { useAlert } from './AlertProvider';
import BaseDialog from './atom/BaseDialog';
import { getPO } from '../service/Production';
import { useBatchStore } from '../store/batchStore';
import { syncStructureBatch } from '../models';

export default function FormOpenBatch({ open, onClose, onSubmit, panel }) {
  const processOrder = useBatchStore((state) => state.setPo);
  const { showAlert } = useAlert();
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    id: '',
    batch_no: '',
    process_order_erp: '',
  });

  const loginStore = useAuthStore((state) => state.login);
  const loginStoreA = useAuthStorePanelA((state) => state.login);
  const loginStoreB = useAuthStorePanelB((state) => state.login);
  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async () => {
    if (!form.id && !form.batch_no && !form.process_order_erp) {
      setError('ID, Batch No atau ERP Po No wajib diisi');
      return;
    }
    setError('');
    let param = { status: 4 };
    if (form.id) param.id = form.id;
    if (form.batch_no) param.batch_no = form.batch_no;
    if (form.process_order_erp)
      param.process_order_erp = form.process_order_erp;
    let resp = await getPO(param);
    if (resp && !resp.error && resp.grand_total == 1) {
      onSubmit(resp);
      let data = resp.data[0];
      processOrder(data);
      setForm({ id: '', batch_no: '', process_order_erp: '' });
      showAlert(resp.message, 'success');
      // Lakuakn SYNC Karena pasti ini database baru
      await syncStructureBatch(`${data.process_order_erp}`);
    } else {
      let msg = '';
      if (form.id) msg = `ID [${form.id}] `;
      if (form.batch_no) msg = `Batch No [${form.batch_no}] `;
      if (form.process_order_erp) msg = `ERP No [${form.process_order_erp}]`;
      showAlert(`${msg} not found`, 'error');
    }
  };

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      title={`Open Batch`}
      actions={
        <Box>
          {/* <Button onClick={onClose}>Batal</Button> */}
          <Button variant="contained" onClick={handleSubmit}>
            Confirm
          </Button>
        </Box>
      }
    >
      <Paper sx={{ py: 4, px: 2 }}>
        <Box display="flex" flexDirection="column" alignItems="center">
          <Box display="flex" alignItems="center" m={1}>
            <Typography sx={{ width: 250 }}>ID</Typography>
            <TextField
              size="small"
              label="ID"
              name="id"
              fullWidth
              value={form.id}
              onChange={handleChange}
            />
          </Box>
          <Box display="flex" alignItems="center" m={1}>
            <Typography sx={{ width: 250 }}>Batch No</Typography>
            <TextField
              size="small"
              label="Batch No"
              name="batch_no"
              fullWidth
              value={form.batch_no}
              onChange={handleChange}
            />
          </Box>
          <Box display="flex" alignItems="center" m={1}>
            <Typography sx={{ width: 250 }}>PO ERP. No.</Typography>
            <TextField
              size="small"
              label="Process Order Erp"
              name="process_order_erp"
              fullWidth
              value={form.process_order_erp}
              onChange={handleChange}
            />
          </Box>
          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}
        </Box>
      </Paper>
    </BaseDialog>
  );
}

import { Button, Typography } from '@mui/material';
import { createContext, useContext, useState } from 'react';
import BaseDialog from './atom/BaseDialog';

const ConfirmContext = createContext();
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState({
    title: '',
    message: '',
    severity: 'info',
  });
  const [resolver, setResolver] = useState(null);

  const confirm = ({
    title = 'Konfirmasi',
    message = '',
    severity = 'info',
  }) => {
    setOptions({ title, message, severity });
    setOpen(true);

    return new Promise((resolve) => {
      setResolver(() => resolve);
    });
  };

  const handleClose = (result) => {
    setOpen(false);
    if (resolver) resolver(result);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <BaseDialog
        open={open}
        onClose={() => handleClose(false)}
        title={options.title}
        severity={options.severity}
        actions={
          <>
            <Button onClick={() => handleClose(false)}>Batal</Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => handleClose(true)}
            >
              OK
            </Button>
          </>
        }
      >
        <Typography variant="h5" textAlign={'center'}>
          {options.message}
        </Typography>
      </BaseDialog>
    </ConfirmContext.Provider>
  );
}

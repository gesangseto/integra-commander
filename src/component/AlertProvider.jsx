import React, { createContext, useContext, useState, useEffect } from 'react';
import { Snackbar, Alert } from '@mui/material';

const AlertContext = createContext();

// ✅ GLOBAL
let globalShowAlert = null;

export const setGlobalAlert = (fn) => {
  globalShowAlert = fn;
};

export const showGlobalAlert = (message, severity = 'info') => {
  if (globalShowAlert) {
    globalShowAlert(message, severity);
  } else {
    console.warn('Alert belum siap');
  }
};

export const AlertProvider = ({ children }) => {
  const [alert, setAlert] = useState({
    open: false,
    message: '',
    severity: 'info',
  });
  const showAlert = (message, severity = 'info') => {
    setAlert({
      open: true,
      message: `${message}`, // pastikan string
      severity,
      key: new Date().getTime(), // 🔥 paksa update
    });
  };

  const handleClose = () => {
    setAlert({ ...alert, open: false });
  };

  // 🔥 REGISTER GLOBAL
  useEffect(() => {
    setGlobalAlert(showAlert);
  }, []);

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}

      <Snackbar
        open={alert.open}
        autoHideDuration={3000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={alert.severity} variant="filled" onClose={handleClose}>
          {alert.message}
        </Alert>
      </Snackbar>
    </AlertContext.Provider>
  );
};

export const useAlert = () => useContext(AlertContext);

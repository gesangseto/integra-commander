import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Font Inter dibundel lokal supaya tampil identik di semua komputer,
// termasuk yang tidak punya Inter dan berjalan tanpa internet.
import '@fontsource-variable/inter';

import { ConfirmProvider } from './component/ConfirmProvider';
import { AlertProvider } from './component/AlertProvider';

ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode>
  <ConfirmProvider>
    <AlertProvider>
      <App />
    </AlertProvider>
  </ConfirmProvider>,
  // </React.StrictMode>,
);

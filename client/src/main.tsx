import './index.css';

import { Provider } from 'react-redux';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { ThemeProvider } from './components/app/ThemeProvider';
import { Toaster } from './components/ui/sonner';
import { getSystemTheme } from './utils';
import { router } from './routes';
import store from './redux/store';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="kw-ui-theme">
      <Provider store={store}>
        <RouterProvider router={router} />
        <Toaster
        richColors
        position="top-right"
        closeButton
        duration={10000}
        theme={getSystemTheme() === 'light' ? 'light' : 'dark'}
      />
      </Provider>
    </ThemeProvider>
  </React.StrictMode>,
);

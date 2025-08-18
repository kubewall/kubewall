import './index.css';
import './components/app/Common/ScrollBar';

import { Provider } from 'react-redux';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { ThemeProvider } from './components/app/ThemeProvider';
import { Toaster } from './components/ui/sonner';
import { getSystemTheme } from './utils';
import { applySavedThemePalette } from './utils/theme';
import { router } from './routes';
import store from './redux/store';

// Apply saved theme palette before app mounts so CSS variables are ready
applySavedThemePalette();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="kw-ui-theme">
      <Provider store={store}>
        <RouterProvider router={router} />
        <Toaster
        richColors
        position="top-right"
        closeButton
        duration={5000}
        theme={getSystemTheme() === 'light' ? 'light' : 'dark'}
      />
      </Provider>
    </ThemeProvider>
  </React.StrictMode>,
);

import './index.css';
import './components/app/Common/ScrollBar';

import { Provider } from 'react-redux';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { ThemeProvider, useTheme } from './components/app/ThemeProvider';
import { Toaster } from './components/ui/sonner';
import { router } from './routes';
import store from './redux/store';

const ThemedToaster = () => {
  const { isDark } = useTheme();
  return (
    <Toaster
      richColors
      position="top-right"
      closeButton
      duration={10000}
      theme={isDark ? 'dark' : 'light'}
    />
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="kw-ui-theme">
      <Provider store={store}>
        <RouterProvider router={router} />
        <ThemedToaster />
      </Provider>
    </ThemeProvider>
  </React.StrictMode>,
);

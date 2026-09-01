import './index.css';
import './components/app/Common/ScrollBar';

import { Provider } from 'react-redux';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { ThemeProvider, useTheme } from './components/app/ThemeProvider';
import { Toaster } from './components/ui/sonner';
import { initSound } from './lib/sound';
import { router } from './routes';
import store from './redux/store';

// Creates the uisfx player under the stored sound preference and installs its
// delegated `data-uisfx-*` listeners before anything renders, so the first hover
// over a cue-carrying element already sounds.
initSound();

const ThemedToaster = () => {
  const { isDark } = useTheme();
  return (
    <Toaster
      richColors
      position="bottom-right"
      closeButton
      duration={8000}
      visibleToasts={3}
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

import { defineConfig } from 'vite';
import path from "path";
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port:5173,
    proxy: {
      "/api/v1/" : 'http://127.0.0.1:7080/',
    },
  },
});

import { defineConfig } from 'vite';
import { existsSync } from 'fs';
import path from "path";
import react from '@vitejs/plugin-react';
import http from 'http';

// enterprise-client lives inside client/ so it shares node_modules naturally.
// No special module resolution config needed.
const enterpriseRoot = path.resolve(__dirname, './enterprise-client/client');
const enterprisePresent = existsSync(path.join(enterpriseRoot, 'addons/index.ts'));

// Build alias array. Specific entries MUST come before the generic "@" alias
// otherwise "@" expands first and the specific "@/addons" entries never match.
const aliases = [
  ...(enterprisePresent
    ? [
        {
          find: /^@\/addons$/,
          replacement: path.resolve(enterpriseRoot, 'addons/index.ts'),
        },
        {
          find: /^@\/capabilities$/,
          replacement: path.resolve(enterpriseRoot, 'capabilities/index.ts'),
        },
      ]
    : []),
  // Generic @/ → src/ catch-all (must be last)
  {
    find: '@',
    replacement: path.resolve(__dirname, './src'),
  },
];

// Dedicated agents with keepAlive disabled so SSE and WS long-lived connections
// don't block the connection pool for regular POST/GET/DELETE requests.
const noKeepAliveAgent = new http.Agent({ keepAlive: false });

export default defineConfig({
  plugins: [react()],
  resolve: { alias: aliases },
  server: {
    port: 5173,
    proxy: {
      // WebSocket proxy — terminal exec sessions WS endpoint only
      '/api/v1/pods/exec/sessions': {
        target: 'http://127.0.0.1:7080/',
        ws: true,
        changeOrigin: true,
        agent: noKeepAliveAgent,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            if ((err as NodeJS.ErrnoException).code === 'ECONNRESET') return;
            console.error('[vite proxy error]', err);
          });
          proxy.on('proxyReqWs', (_proxyReq, _req, socket) => {
            socket.on('error', (err) => {
              if ((err as NodeJS.ErrnoException).code === 'ECONNRESET') return;
              console.error('[vite ws socket error]', err);
            });
          });
        },
      },
      // HTTP proxy — all other API calls
      // keepAlive disabled so SSE connections don't block POST/DELETE requests.
      '/api/v1/': {
        target: 'http://127.0.0.1:7080/',
        changeOrigin: true,
        agent: noKeepAliveAgent,
      },
    },
  },
});

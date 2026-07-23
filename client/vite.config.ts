import { defineConfig } from 'vite';
import { existsSync } from 'fs';
import path from "path";
import react from '@vitejs/plugin-react';
import http from 'http';
import { compression } from 'vite-plugin-compression2';

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

// Groups stable, rarely-changing framework packages into their own chunks so a
// kubewall release that only touches app code doesn't invalidate the browser's
// cache of React/Redux/Radix/TanStack. Matches are anchored on the exact
// node_modules package boundary (trailing slash after the package name) so
// e.g. "react" can't accidentally swallow "react-markdown" or
// "@monaco-editor/react" - those stay with the async chunks that already
// code-split them (Monaco, xterm, kwAI) instead of leaking into eager vendor.
function manualChunks(id: string) {
  if (!id.includes('/node_modules/')) {
    return undefined;
  }
  if (id.includes('/node_modules/@radix-ui/')) {
    return 'vendor-radix';
  }
  if (id.includes('/node_modules/@tanstack/')) {
    return 'vendor-tanstack';
  }
  if (id.includes('/node_modules/@xterm/')) {
    // Without an explicit chunk, Rollup's automatic splitting merges xterm
    // into whichever single dynamic importer it considers "unique" to -
    // here, the whole KwDetails route - so every details page (not just a
    // Pod's Logs tab) would pay for it. Pinning it isolates it into its own
    // async chunk, fetched only when the log/terminal view actually mounts.
    return 'vendor-xterm';
  }
  if (
    id.includes('/node_modules/react-redux/') ||
    id.includes('/node_modules/@reduxjs/toolkit/') ||
    id.includes('/node_modules/redux/') ||
    id.includes('/node_modules/redux-thunk/') ||
    id.includes('/node_modules/immer/') ||
    id.includes('/node_modules/reselect/')
  ) {
    return 'vendor-redux';
  }
  if (
    id.includes('/node_modules/react/') ||
    id.includes('/node_modules/react-dom/') ||
    id.includes('/node_modules/scheduler/')
  ) {
    return 'vendor-react';
  }
  return undefined;
}

export default defineConfig({
  plugins: [
    react(),
    // Precompresses build output to .gz/.br alongside the originals (build-only,
    // no dev-server or runtime cost). The backend picks whichever variant the
    // client's Accept-Encoding allows, falling back to the uncompressed file.
    compression({ threshold: 1024 }),
  ],
  resolve: { alias: aliases },
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
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

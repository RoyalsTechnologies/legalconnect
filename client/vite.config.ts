import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In Docker the API is reachable by service name; running directly on the host
// it is on localhost.
const apiTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          icons: ['@ant-design/icons'],
        },
      },
    },
  },
  server: {
    port: 5173,
    // Bind all interfaces so the dev server is reachable from outside the container.
    host: true,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});

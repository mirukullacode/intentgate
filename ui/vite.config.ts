import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:4747',
      '/audio': 'http://localhost:4747',
      '/ws': { target: 'ws://localhost:4747', ws: true },
    },
  },
});

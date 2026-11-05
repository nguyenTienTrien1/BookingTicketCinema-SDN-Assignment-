import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['5bb8-113-182-234-42.ngrok-free.app'],
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});

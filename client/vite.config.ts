import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

const useHttps = process.env.VITE_HTTPS === 'true';

export default defineConfig({
  plugins: useHttps ? [basicSsl()] : [],
  server: {
    host: true,
    port: 5173,
    https: useHttps
  }
});

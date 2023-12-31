import vue from '@vitejs/plugin-vue';
// @ts-ignore
import dns from 'dns';
import {defineConfig} from 'vite';

// https://vitejs.dev/config/server-options.html#server-host
dns.setDefaultResultOrder('verbatim');

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 3000,
  },
  optimizeDeps: {
    exclude: ['emsl-generator']
  }
});

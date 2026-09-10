import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, import.meta.dirname, ''), ...process.env };
  const target = env.DEV_API_TARGET || 'http://127.0.0.1:3000';
  const publicHost = env.DEV_PUBLIC_ORIGIN
    ? new URL(env.DEV_PUBLIC_ORIGIN).hostname
    : undefined;

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      allowedHosts: publicHost ? [publicHost] : [],
      proxy: {
        '/api/': { target, changeOrigin: true },
        '/colyseus/': {
          target,
          changeOrigin: true,
          ws: true,
          rewrite: (path: string) => path.replace(/^\/colyseus/, ''),
        },
      },
    },
  };
});

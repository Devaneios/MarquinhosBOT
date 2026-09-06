import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  // Discord's Activity CSP only allows frame-src https://localhost:* for
  // local dev (confirmed directly from a real CSP violation message) —
  // plain http, and 127.0.0.1 instead of the literal hostname `localhost`,
  // are both rejected outright. HTTPS is provided by a Cloudflare tunnel
  // in front of this dev server, not by Vite itself.
  plugins: [react(), tailwindcss()],
  server: {
    // Bind every interface (both IPv4 and IPv6) so `localhost` resolves
    // correctly here regardless of which address family the OS/browser/
    // Discord's client picks — Vite's plain default previously bound
    // IPv6-loopback (::1) only, which broke IPv4-only resolvers.
    host: true,
    allowedHosts: ['marquinhos.frois.net.br'],
  },
});

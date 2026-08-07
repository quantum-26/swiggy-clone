import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server : {
    port: 5173,
    //  Will point this at api-gateway once search hits a real endpoint
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        // Gateway mounts routes at /restaurants and /auth directly, with
        // no /api prefix. Frontend code stays semantically prefixed with
        // /api/* (so it's obvious at a glance which fetch calls hit the
        // backend), and this strips the prefix before forwarding.
        // Now fetch('/api/restaurants?search=pizza') correctly 
        // becomes http://localhost:4000/restaurants?search=pizza on the wire.
        rewrite: (path) => path.replace(/^\/api/,''),

      }
    }
  }
})

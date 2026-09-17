import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Dev-only proxy so the client can call /api and /uploads without CORS
// juggling or hardcoding a host — it always talks to whatever server the
// browser loaded the page from, which also holds true in production if the
// two are ever served from behind the same origin.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:4000',
      '/uploads': 'http://127.0.0.1:4000',
      '/socket.io': {
        target: 'http://127.0.0.1:4000',
        ws: true,
      },
    },
  },
})

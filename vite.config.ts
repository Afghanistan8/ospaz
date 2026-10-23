import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/strike': {
        target: 'https://api.strikefinance.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/strike/, ''),
      },
    },
  },
})

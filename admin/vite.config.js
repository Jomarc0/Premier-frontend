import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5174, 
    proxy: {
      '/api': {
        target: 'http://localhost:8080', 
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          // The browser is same-origin with Vite. Do not forward its Origin
          // header to the backend, where local production-origin settings may
          // reject it before the login controller is reached.
          proxy.on('proxyReq', (request) => request.removeHeader('origin'));
        },
      },
      '/ws-native': {
        target: 'ws://localhost:8080',
        ws: true,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReqWs', (request) => request.removeHeader('origin'));
        },
      }
    }
  }
})

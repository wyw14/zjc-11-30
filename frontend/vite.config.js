import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 4529,
    proxy: {
      '/api': {
        target: 'http://localhost:4029',
        changeOrigin: true
      }
    }
  }
})

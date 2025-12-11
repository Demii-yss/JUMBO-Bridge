
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/JUMBO-Bridge/', // 設定 GitHub Pages 的 base path，請根據您的 repository 名稱調整
  server: {
    port: 3001,
    strictPort: true
  }
})

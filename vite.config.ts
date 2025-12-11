
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/JUMBO-Bridge/', // 設定 GitHub Pages 的 base path，請根據您的 repository 名稱調整
  server: {
    port: 3001,
    strictPort: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined,
      }
    },
    assetsInlineLimit: 0, // 不內聯任何資源，確保所有檔案都有正確的副檔名
    modulePreload: false, // 禁用模組預載入，可能有助於解決 MIME 類型問題
  }
})

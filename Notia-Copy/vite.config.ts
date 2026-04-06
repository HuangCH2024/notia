import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // 显式包含依赖，防止 Vite 预构建失败
    include: ['@supabase/supabase-js', 'tslib']
  }
})
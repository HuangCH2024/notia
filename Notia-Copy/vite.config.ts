import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/notia/',
  plugins: [react()],
  optimizeDeps: {
    include: ['@supabase/supabase-js', 'tslib']
  }
})
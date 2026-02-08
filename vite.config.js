import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Use root path in local dev; use GitHub Pages project base in production.
  base: process.env.NODE_ENV === 'production' ? '/peggy-starter/' : '/',
})

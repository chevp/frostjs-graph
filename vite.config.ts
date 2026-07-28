import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Served from https://chevp.github.io/frostjs-graph/ (GitHub Pages project site).
export default defineConfig({
  base: '/frostjs-graph/',
  plugins: [vue()],
})

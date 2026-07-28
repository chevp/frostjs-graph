import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Builds src/web-component.ts into a single self-contained ES module — the
// `<frost-graph>` custom element, with Vue bundled in. Run *after* the main
// `vite build` (emptyOutDir:false so it lands alongside index.html in the
// same dist/, next to demo.html copied from public/).
export default defineConfig({
  plugins: [vue()],
  build: {
    emptyOutDir: false,
    lib: {
      entry: 'src/web-component.ts',
      name: 'FrostGraphElement',
      formats: ['es'],
      fileName: () => 'frost-graph.js',
    },
  },
})

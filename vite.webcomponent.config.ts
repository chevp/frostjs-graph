import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Builds src/web-component.ts into a single self-contained ES module — the
// `<frost-graph>` custom element, with Vue bundled in, for consumers who
// want to drop in just this one file. index.html itself no longer depends
// on this output; it imports src/web-component.ts directly via the main
// `vite build`. Run *after* the main build (emptyOutDir:false so it lands
// alongside index.html in the same dist/).
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

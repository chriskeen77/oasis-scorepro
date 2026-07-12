import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Single-file build: everything (pdf.js worker included) is bundled into one
// JS chunk, then scripts/build-singlefile.mjs inlines it into index.html.
// Used to publish the app as a self-contained page (e.g. a Claude Artifact).
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_SINGLEFILE': 'true',
  },
  build: {
    outDir: 'dist-artifact',
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
})

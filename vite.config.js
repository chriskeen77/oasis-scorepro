import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Force esbuild pre-bundling for CJS packages to avoid rolldown naming conflicts
    include: ['recharts', 'react-is', 'prop-types'],
  },
  build: {
    // Disable minification to avoid rolldown variable-naming collision in CJS transforms
    minify: false,
    chunkSizeWarningLimit: 700,
  },
})

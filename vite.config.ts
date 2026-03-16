import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        quietDeps: true,
      },
    },
  },
  optimizeDeps: {
    // transformers.js uses dynamic imports internally and must be excluded
    // from Vite's pre-bundling to work correctly with WASM
    exclude: ['@huggingface/transformers'],
  },
})

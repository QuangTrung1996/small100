import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Point to the TypeScript source for development
      'small100-onnx-translator': path.resolve(__dirname, '../plugin/src'),
    },
  },
  server: {
    port: 5173,
    open: true,
    // Ensure public directory is served with correct MIME types
    middlewareMode: false,
    fs: {
      // Allow serving WASM files from node_modules
      allow: ['..'],
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Ensure WASM files are copied to dist
    copyPublicDir: true,
  },
  // Configure for ONNX Runtime Web and Transformers
  optimizeDeps: {
    include: ['onnxruntime-web'],
  },
  // Handle WASM files
  assetsInclude: ['**/*.wasm', '**/*.onnx'],
});

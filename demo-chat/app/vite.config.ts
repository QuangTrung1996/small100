import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Plugin to serve WASM files with correct MIME type
function wasmContentTypePlugin(): Plugin {
  return {
    name: "wasm-content-type-plugin",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.endsWith(".wasm")) {
          res.setHeader("Content-Type", "application/wasm");
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), wasmContentTypePlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  assetsInclude: ["**/*.wasm"],
  optimizeDeps: {
    exclude: ["onnxruntime-web"],
  },
});

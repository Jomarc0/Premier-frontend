import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5177,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on("proxyReq", (request) => request.removeHeader("origin"));
        },
      },
      "/ws-native": {
        target: "ws://localhost:8080",
        ws: true,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("proxyReqWs", (request) => request.removeHeader("origin"));
        },
      },
    },
  },
});

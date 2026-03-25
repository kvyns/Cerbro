import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const deploymentId = env.VITE_DEPLOYMENT_ID || "";

  const proxy = deploymentId
    ? {
        "/api/verify": {
          target: "https://script.google.com",
          changeOrigin: true,
          secure: true,
          rewrite: () => `/macros/s/${deploymentId}/exec`,
        },
      }
    : undefined;

  return {
    plugins: [react()],
    server: proxy ? { proxy } : undefined,
  };
});

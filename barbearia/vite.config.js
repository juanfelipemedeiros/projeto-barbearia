import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // em desenvolvimento (npm run dev), /api é repassado ao Flask
  server: { proxy: { "/api": "http://localhost:5001" } },
});

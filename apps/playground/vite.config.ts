import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// ADR-0011: the Playground is a downstream consumer of the engine. It is
// intentionally excluded from the engine build gate and runs on its own.
export default defineConfig({
  plugins: [react()],
  server: { port: 4173 },
});

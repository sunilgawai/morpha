import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// ADR-0011: the Inspector runs independently of the Playground and of the
// engine build gate. It attaches to a running engine through public APIs only.
export default defineConfig({
  plugins: [react()],
  server: { port: 4174 },
});

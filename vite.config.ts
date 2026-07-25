import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Mirrors the /pay-return redirect from vercel.json so Cashfree's POST-back works in dev too.
// Without it Vite's SPA fallback (GET-only) 404s the return and the user never gets back.
const payReturnRedirect = (): Plugin => ({
  name: "pay-return-redirect",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = req.url ?? "";
      if (!url.startsWith("/pay-return")) return next();
      res.statusCode = 303;
      res.setHeader("Location", url.slice("/pay-return".length) || "/");
      res.end();
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), payReturnRedirect(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    target: "es2020",
    sourcemap: false,
  },
}));

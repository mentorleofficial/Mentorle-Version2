import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";

// Intercept invitation/recovery hash or code redirects synchronously before React mounts to prevent Router stripping
if (
  (window.location.pathname !== "/reset-password" &&
    window.location.hash &&
    (window.location.hash.includes("type=invite") || window.location.hash.includes("type=recovery") || window.location.hash.includes("type=signup"))) ||
  (window.location.pathname === "/" && window.location.search && window.location.search.includes("code="))
) {
  window.location.replace("/reset-password" + window.location.hash + window.location.search);
} else {
  createRoot(document.getElementById("root")!).render(
    <HelmetProvider>
      <App />
    </HelmetProvider>
  );
}

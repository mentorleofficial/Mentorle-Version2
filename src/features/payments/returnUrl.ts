// Cashfree sends the user back with a POST, but the app is a static SPA — Vercel answers POST
// on a static route with 405, and Vite's dev fallback only rewrites GET, so it 404s. Returns
// are routed through /pay-return/* instead, which both hosts bounce back as a 303 GET to the
// same path (vercel.json redirects; the payReturnRedirect plugin in vite.config.ts locally).
export const RETURN_PREFIX = "/pay-return";

export function paymentReturnUrl(path?: string): string {
  const target = path ?? window.location.pathname + window.location.search;
  return `${window.location.origin}${RETURN_PREFIX}${target.startsWith("/") ? target : `/${target}`}`;
}

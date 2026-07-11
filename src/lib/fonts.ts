// Curated Google Fonts available in admin Branding settings.
// Stack key = display name (also stored in DB), value = Google Fonts spec.

export type FontKind = "body" | "heading";

export const BODY_FONTS: { name: string; gf: string; stack: string }[] = [
  { name: "DM Sans", gf: "DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400", stack: "'DM Sans', system-ui, sans-serif" },
  { name: "Inter", gf: "Inter:wght@400;500;600;700", stack: "'Inter', system-ui, sans-serif" },
  { name: "Roboto", gf: "Roboto:wght@400;500;700", stack: "'Roboto', system-ui, sans-serif" },
  { name: "Poppins", gf: "Poppins:wght@400;500;600;700", stack: "'Poppins', system-ui, sans-serif" },
  { name: "Lato", gf: "Lato:wght@400;700", stack: "'Lato', system-ui, sans-serif" },
  { name: "Nunito", gf: "Nunito:wght@400;600;700", stack: "'Nunito', system-ui, sans-serif" },
  { name: "Work Sans", gf: "Work+Sans:wght@400;500;600;700", stack: "'Work Sans', system-ui, sans-serif" },
  { name: "Manrope", gf: "Manrope:wght@400;500;600;700", stack: "'Manrope', system-ui, sans-serif" },
];

export const HEADING_FONTS: { name: string; gf: string; stack: string }[] = [
  { name: "DM Serif Display", gf: "DM+Serif+Display", stack: "'DM Serif Display', Georgia, serif" },
  { name: "Playfair Display", gf: "Playfair+Display:wght@400;600;700", stack: "'Playfair Display', Georgia, serif" },
  { name: "Lora", gf: "Lora:wght@400;600;700", stack: "'Lora', Georgia, serif" },
  { name: "Merriweather", gf: "Merriweather:wght@400;700", stack: "'Merriweather', Georgia, serif" },
  { name: "Space Grotesk", gf: "Space+Grotesk:wght@400;500;600;700", stack: "'Space Grotesk', system-ui, sans-serif" },
  { name: "Fraunces", gf: "Fraunces:wght@400;600;700", stack: "'Fraunces', Georgia, serif" },
  { name: "Cormorant Garamond", gf: "Cormorant+Garamond:wght@400;600;700", stack: "'Cormorant Garamond', Georgia, serif" },
  { name: "Bricolage Grotesque", gf: "Bricolage+Grotesque:wght@400;600;700", stack: "'Bricolage Grotesque', system-ui, sans-serif" },
];

const ALL = [...BODY_FONTS, ...HEADING_FONTS];

export const getFontStack = (name: string): string =>
  ALL.find((f) => f.name === name)?.stack ?? "system-ui, sans-serif";

export const loadBrandingFonts = (bodyFont: string, headingFont: string) => {
  const body = ALL.find((f) => f.name === bodyFont) ?? BODY_FONTS[0];
  const heading = ALL.find((f) => f.name === headingFont) ?? HEADING_FONTS[0];
  const families = [body.gf, heading.gf].filter(Boolean).join("&family=");
  const href = `https://fonts.googleapis.com/css2?family=${families}&display=swap`;

  let link = document.getElementById("branding-fonts") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = "branding-fonts";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  if (link.href !== href) link.href = href;

  const root = document.documentElement;
  root.style.setProperty("--font-sans", body.stack);
  root.style.setProperty("--font-serif", heading.stack);
};

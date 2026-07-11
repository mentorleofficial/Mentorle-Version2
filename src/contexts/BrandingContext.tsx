import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadBrandingFonts } from "@/lib/fonts";

interface BrandingConfig {
  app_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  login_bg_url: string | null;
  sidebar_background: string;
  sidebar_foreground: string;
  sidebar_primary: string;
  body_font: string;
  heading_font: string;
  mentor_community_url: string;
  leaderboard_enabled: boolean;
  leaderboard_refresh_hours: number;
  site_url: string;
}

const defaultBranding: BrandingConfig = {
  app_name: "Mentorship Platform",
  logo_url: null,
  primary_color: "199 89% 32%",
  secondary_color: "40 33% 94%",
  accent_color: "31 95% 55%",
  login_bg_url: null,
  sidebar_background: "220 25% 10%",
  sidebar_foreground: "40 33% 96%",
  sidebar_primary: "199 89% 48%",
  body_font: "DM Sans",
  heading_font: "DM Serif Display",
  mentor_community_url: "",
  leaderboard_enabled: true,
  leaderboard_refresh_hours: 24,
  site_url: "https://mentorle.vercel.app/",
};

const BrandingContext = createContext<BrandingConfig>(defaultBranding);

export const applyBrandingToDom = (config: BrandingConfig) => {
  const root = document.documentElement;
  root.style.setProperty("--primary", config.primary_color);
  root.style.setProperty("--secondary", config.secondary_color);
  root.style.setProperty("--accent", config.accent_color);
  root.style.setProperty("--sidebar-background", config.sidebar_background);
  root.style.setProperty("--sidebar-foreground", config.sidebar_foreground);
  root.style.setProperty("--sidebar-primary", config.sidebar_primary);
  root.style.setProperty("--sidebar-ring", config.sidebar_primary);
  root.style.setProperty("--sidebar-accent", config.sidebar_primary);
  root.style.setProperty("--sidebar-accent-foreground", "0 0% 100%");
  root.style.setProperty("--sidebar-primary-foreground", "0 0% 100%");
  loadBrandingFonts(config.body_font, config.heading_font);
  // White-label: sync document title and favicon link href text
  if (config.app_name) document.title = config.app_name;
};

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branding, setBranding] = useState<BrandingConfig>(defaultBranding);

  useEffect(() => {
    // Apply defaults immediately so fonts load even before fetch resolves
    applyBrandingToDom(defaultBranding);
    const fetchBranding = async () => {
      const { data } = await supabase.from("branding").select("*").limit(1).single();
      if (data) {
        const config: BrandingConfig = {
          app_name: data.app_name,
          logo_url: data.logo_url,
          primary_color: data.primary_color,
          secondary_color: data.secondary_color,
          accent_color: data.accent_color,
          login_bg_url: data.login_bg_url,
          sidebar_background: (data as any).sidebar_background ?? defaultBranding.sidebar_background,
          sidebar_foreground: (data as any).sidebar_foreground ?? defaultBranding.sidebar_foreground,
          sidebar_primary: (data as any).sidebar_primary ?? defaultBranding.sidebar_primary,
          body_font: (data as any).body_font ?? defaultBranding.body_font,
          heading_font: (data as any).heading_font ?? defaultBranding.heading_font,
          mentor_community_url: (data as any).mentor_community_url ?? "",
          leaderboard_enabled: (data as any).leaderboard_enabled ?? true,
          leaderboard_refresh_hours: (data as any).leaderboard_refresh_hours ?? 24,
          site_url: (data as any).site_url ?? defaultBranding.site_url,
        };
        setBranding(config);
        applyBrandingToDom(config);
      }
    };
    fetchBranding();
  }, []);

  return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
};

export const useBranding = () => useContext(BrandingContext);

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { hexToHsl, hslToHex, isValidHsl } from "@/lib/color";
import { applyBrandingToDom } from "@/contexts/BrandingContext";
import { BODY_FONTS, HEADING_FONTS, getFontStack, loadBrandingFonts } from "@/lib/fonts";
import { Upload, X, RotateCcw, Image as ImageIcon } from "lucide-react";

interface BrandingRow {
  id: string;
  app_name: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  logo_url: string | null;
  login_bg_url: string | null;
  sidebar_background: string;
  sidebar_foreground: string;
  sidebar_primary: string;
  body_font: string;
  heading_font: string;
  mentor_community_url: string;
  leaderboard_enabled: boolean;
  site_url: string;
  supabase_api_url: string;
  leaderboard_refresh_hours: number;
}

const DEFAULTS = {
  primary: "199 89% 32%",
  secondary: "40 33% 94%",
  accent: "31 95% 55%",
  sidebar_background: "220 25% 10%",
  sidebar_foreground: "40 33% 96%",
  sidebar_primary: "199 89% 48%",
  body_font: "DM Sans",
  heading_font: "DM Serif Display",
};

const PRESETS = [
  { name: "Default", primary: "199 89% 32%", secondary: "40 33% 94%", accent: "31 95% 55%" },
  { name: "Ocean", primary: "210 90% 45%", secondary: "200 30% 95%", accent: "180 75% 50%" },
  { name: "Forest", primary: "142 60% 30%", secondary: "60 20% 95%", accent: "30 80% 55%" },
  { name: "Sunset", primary: "340 80% 50%", secondary: "20 30% 96%", accent: "40 95% 60%" },
];

const SIDEBAR_PRESETS = [
  { name: "Midnight", bg: "220 25% 10%", fg: "40 33% 96%", primary: "199 89% 48%" },
  { name: "Slate", bg: "215 28% 17%", fg: "210 20% 96%", primary: "199 89% 60%" },
  { name: "Light", bg: "0 0% 100%", fg: "220 25% 15%", primary: "199 89% 32%" },
  { name: "Cream", bg: "40 33% 96%", fg: "220 25% 15%", primary: "31 95% 50%" },
];

const ColorTile = ({
  label,
  value,
  defaultValue,
  onChange,
}: {
  label: string;
  value: string;
  defaultValue: string;
  onChange: (next: string) => void;
}) => {
  const [advanced, setAdvanced] = useState(false);
  const hex = useMemo(() => (isValidHsl(value) ? hslToHex(value) : "#000000"), [value]);
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <button
          type="button"
          onClick={() => onChange(defaultValue)}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          title="Reset to default"
        >
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </div>
      <div className="flex items-center gap-3">
        <label
          className="relative h-12 w-12 cursor-pointer rounded-md border border-border overflow-hidden shadow-sm"
          style={{ backgroundColor: hex }}
        >
          <input
            type="color"
            value={hex}
            onChange={(e) => onChange(hexToHsl(e.target.value))}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
        <div className="flex-1">
          <div className="font-mono text-sm uppercase">{hex}</div>
          <button
            type="button"
            onClick={() => setAdvanced((v) => !v)}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            {advanced ? "Hide" : "Advanced"} (HSL)
          </button>
        </div>
      </div>
      {advanced && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="199 89% 32%"
          className="font-mono text-xs"
        />
      )}
    </div>
  );
};

const BrandingSettings = () => {
  const { toast } = useToast();
  const [original, setOriginal] = useState<BrandingRow | null>(null);
  const [draft, setDraft] = useState<BrandingRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);
  const bgInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("branding").select("*").limit(1).single();
      if (data) {
        const row = data as BrandingRow;
        setOriginal(row);
        setDraft(row);
      }
    })();
  }, []);

  const dirty = useMemo(() => {
    if (!original || !draft) return false;
    return JSON.stringify(original) !== JSON.stringify(draft);
  }, [original, draft]);

  const update = (patch: Partial<BrandingRow>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d));

  const uploadAsset = async (file: File, kind: "logo" | "bg") => {
    const ext = file.name.split(".").pop() || "png";
    const path = `${kind}/${Date.now()}.${ext}`;
    const setBusy = kind === "logo" ? setUploadingLogo : setUploadingBg;
    setBusy(true);
    const { error } = await supabase.storage.from("branding-assets").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    setBusy(false);
    if (error) {
      toast({ variant: "destructive", title: "Upload failed", description: error.message });
      return;
    }
    const { data } = supabase.storage.from("branding-assets").getPublicUrl(path);
    if (kind === "logo") update({ logo_url: data.publicUrl });
    else update({ login_bg_url: data.publicUrl });
  };

  // Live-preview fonts as the admin tweaks them, even before saving
  useEffect(() => {
    if (!draft) return;
    loadBrandingFonts(draft.body_font, draft.heading_font);
  }, [draft?.body_font, draft?.heading_font]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const { error } = await supabase
      .from("branding")
      .update({
        app_name: draft.app_name,
        primary_color: draft.primary_color,
        secondary_color: draft.secondary_color,
        accent_color: draft.accent_color,
        logo_url: draft.logo_url,
        login_bg_url: draft.login_bg_url,
        sidebar_background: draft.sidebar_background,
        sidebar_foreground: draft.sidebar_foreground,
        sidebar_primary: draft.sidebar_primary,
        body_font: draft.body_font,
        heading_font: draft.heading_font,
        mentor_community_url: draft.mentor_community_url,
        leaderboard_enabled: draft.leaderboard_enabled,
        site_url: draft.site_url,
        supabase_api_url: draft.supabase_api_url,
      })
      .eq("id", draft.id);
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
      return;
    }
    toast({ title: "Saved", description: "Branding updated successfully." });
    applyBrandingToDom(draft);
    setOriginal(draft);
  };

  if (!draft) {
    return <div className="text-muted-foreground text-sm">Loading branding…</div>;
  }

  const primaryHex = isValidHsl(draft.primary_color) ? hslToHex(draft.primary_color) : "#000";
  const secondaryHex = isValidHsl(draft.secondary_color) ? hslToHex(draft.secondary_color) : "#000";
  const accentHex = isValidHsl(draft.accent_color) ? hslToHex(draft.accent_color) : "#000";
  const sbBgHex = isValidHsl(draft.sidebar_background) ? hslToHex(draft.sidebar_background) : "#111";
  const sbFgHex = isValidHsl(draft.sidebar_foreground) ? hslToHex(draft.sidebar_foreground) : "#fff";
  const sbPrimaryHex = isValidHsl(draft.sidebar_primary) ? hslToHex(draft.sidebar_primary) : "#3b82f6";

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_360px]">
      {/* LEFT: controls */}
      <div className="space-y-6">
        {/* Identity */}
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
            <CardDescription>Your platform name and logo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>App name</Label>
              <Input value={draft.app_name} onChange={(e) => update({ app_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Site URL</Label>
              <Input 
                value={draft.site_url || ""} 
                onChange={(e) => update({ site_url: e.target.value })} 
                placeholder="https://mentorle.vercel.app/"
              />
              <p className="text-xs text-muted-foreground">
                The production URL of the web application. Used for links in invitation and review emails.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Supabase API URL</Label>
              <Input 
                value={draft.supabase_api_url || ""} 
                onChange={(e) => update({ supabase_api_url: e.target.value })} 
                placeholder="http://localhost:54321"
              />
              <p className="text-xs text-muted-foreground">
                The URL of your Supabase API instance. Used by database cron jobs and Edge Functions (e.g. reminders).
              </p>
            </div>
            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-md border border-border bg-muted flex items-center justify-center overflow-hidden">
                  {draft.logo_url ? (
                    <img src={draft.logo_url} alt="logo" className="h-full w-full object-contain" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    ref={logoInput}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadAsset(f, "logo");
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => logoInput.current?.click()}
                    disabled={uploadingLogo}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploadingLogo ? "Uploading…" : draft.logo_url ? "Replace" : "Upload"}
                  </Button>
                  {draft.logo_url && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => update({ logo_url: null })}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Colors */}
        <Card>
          <CardHeader>
            <CardTitle>Colors</CardTitle>
            <CardDescription>Pick brand colors. Use a preset to apply them all at once.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() =>
                    update({
                      primary_color: p.primary,
                      secondary_color: p.secondary,
                      accent_color: p.accent,
                    })
                  }
                  className="group flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted transition"
                >
                  <span className="flex">
                    <span className="h-4 w-4 rounded-full border border-background" style={{ backgroundColor: hslToHex(p.primary) }} />
                    <span className="h-4 w-4 -ml-1 rounded-full border border-background" style={{ backgroundColor: hslToHex(p.secondary) }} />
                    <span className="h-4 w-4 -ml-1 rounded-full border border-background" style={{ backgroundColor: hslToHex(p.accent) }} />
                  </span>
                  {p.name}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <ColorTile
                label="Primary"
                value={draft.primary_color}
                defaultValue={DEFAULTS.primary}
                onChange={(v) => update({ primary_color: v })}
              />
              <ColorTile
                label="Secondary"
                value={draft.secondary_color}
                defaultValue={DEFAULTS.secondary}
                onChange={(v) => update({ secondary_color: v })}
              />
              <ColorTile
                label="Accent"
                value={draft.accent_color}
                defaultValue={DEFAULTS.accent}
                onChange={(v) => update({ accent_color: v })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Sidebar colors */}
        <Card>
          <CardHeader>
            <CardTitle>Sidebar colors</CardTitle>
            <CardDescription>Customize the navigation sidebar background, text, and active item.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {SIDEBAR_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() =>
                    update({
                      sidebar_background: p.bg,
                      sidebar_foreground: p.fg,
                      sidebar_primary: p.primary,
                    })
                  }
                  className="group flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted transition"
                >
                  <span className="flex">
                    <span className="h-4 w-4 rounded-full border border-background" style={{ backgroundColor: hslToHex(p.bg) }} />
                    <span className="h-4 w-4 -ml-1 rounded-full border border-background" style={{ backgroundColor: hslToHex(p.fg) }} />
                    <span className="h-4 w-4 -ml-1 rounded-full border border-background" style={{ backgroundColor: hslToHex(p.primary) }} />
                  </span>
                  {p.name}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <ColorTile
                label="Background"
                value={draft.sidebar_background}
                defaultValue={DEFAULTS.sidebar_background}
                onChange={(v) => update({ sidebar_background: v })}
              />
              <ColorTile
                label="Text"
                value={draft.sidebar_foreground}
                defaultValue={DEFAULTS.sidebar_foreground}
                onChange={(v) => update({ sidebar_foreground: v })}
              />
              <ColorTile
                label="Active item"
                value={draft.sidebar_primary}
                defaultValue={DEFAULTS.sidebar_primary}
                onChange={(v) => update({ sidebar_primary: v })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Typography */}
        <Card>
          <CardHeader>
            <CardTitle>Typography</CardTitle>
            <CardDescription>Choose the fonts used for body text and headings across the app.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Body font</Label>
                <Select value={draft.body_font} onValueChange={(v) => update({ body_font: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BODY_FONTS.map((f) => (
                      <SelectItem key={f.name} value={f.name}>
                        <span style={{ fontFamily: f.stack }}>{f.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Heading font</Label>
                <Select value={draft.heading_font} onValueChange={(v) => update({ heading_font: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HEADING_FONTS.map((f) => (
                      <SelectItem key={f.name} value={f.name}>
                        <span style={{ fontFamily: f.stack }}>{f.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-4 space-y-1">
              <div className="text-2xl leading-tight" style={{ fontFamily: getFontStack(draft.heading_font) }}>
                The quick brown fox
              </div>
              <div className="text-sm text-muted-foreground" style={{ fontFamily: getFontStack(draft.body_font) }}>
                Pack my box with five dozen liquor jugs — 0123456789.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Login background */}
        <Card>
          <CardHeader>
            <CardTitle>Login background</CardTitle>
            <CardDescription>Optional image shown on the sign-in page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="aspect-video w-full rounded-md border border-border overflow-hidden bg-muted flex items-center justify-center">
              {draft.login_bg_url ? (
                <img src={draft.login_bg_url} alt="background" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-muted-foreground">No background image</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                ref={bgInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadAsset(f, "bg");
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => bgInput.current?.click()}
                disabled={uploadingBg}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploadingBg ? "Uploading…" : draft.login_bg_url ? "Replace" : "Upload"}
              </Button>
              {draft.login_bg_url && (
                <Button type="button" variant="ghost" size="sm" onClick={() => update({ login_bg_url: null })}>
                  <X className="h-4 w-4 mr-2" /> Remove
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Engagement */}
        <Card>
          <CardHeader>
            <CardTitle>Mentor engagement</CardTitle>
            <CardDescription>Optional community link shown to mentors, and leaderboard visibility.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Mentor community URL</Label>
              <Input
                placeholder="https://community.example.com"
                value={draft.mentor_community_url}
                onChange={(e) => update({ mentor_community_url: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                When set, a "Mentor Community" link appears in the mentor sidebar.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <Label className="text-sm">Show leaderboard to mentors</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Admins can always view the leaderboard.
                </p>
              </div>
              <input
                type="checkbox"
                className="h-5 w-5 accent-primary cursor-pointer"
                checked={draft.leaderboard_enabled}
                onChange={(e) => update({ leaderboard_enabled: e.target.checked })}
              />
            </div>
          </CardContent>
        </Card>
        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 rounded-lg border border-border bg-card/95 backdrop-blur p-3 shadow-sm">
          <span className="mr-auto text-xs text-muted-foreground">
            {dirty ? "Unsaved changes" : "All changes saved"}
          </span>
          <Button variant="ghost" disabled={!dirty || saving} onClick={() => setDraft(original)}>
            Discard
          </Button>
          <Button onClick={save} disabled={!dirty || saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      {/* RIGHT: live preview */}
      <div className="md:sticky md:top-6 self-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Live preview</CardTitle>
            <CardDescription>How your brand will look</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-hidden flex">
              {/* mini sidebar */}
              <div
                className="w-24 shrink-0 p-2 space-y-1 text-[10px]"
                style={{ backgroundColor: sbBgHex, color: sbFgHex, fontFamily: getFontStack(draft.body_font) }}
              >
                <div className="font-semibold mb-2 truncate">{draft.app_name || "App"}</div>
                <div className="rounded px-1.5 py-1" style={{ backgroundColor: sbPrimaryHex, color: "#fff" }}>
                  Dashboard
                </div>
                <div className="px-1.5 py-1 opacity-80">Users</div>
                <div className="px-1.5 py-1 opacity-80">Settings</div>
              </div>
              {/* main panel */}
              <div className="flex-1">
                <div
                  className="flex items-center gap-2 px-4 py-3 border-b border-border"
                  style={{ backgroundColor: secondaryHex }}
                >
                  <div className="h-7 w-7 rounded bg-background flex items-center justify-center overflow-hidden border border-border">
                    {draft.logo_url ? (
                      <img src={draft.logo_url} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-[10px] font-bold" style={{ color: primaryHex }}>
                        {(draft.app_name || "A").slice(0, 1)}
                      </span>
                    )}
                  </div>
                  <span className="font-semibold text-sm" style={{ color: primaryHex, fontFamily: getFontStack(draft.body_font) }}>
                    {draft.app_name || "App name"}
                  </span>
                </div>
                <div className="p-4 space-y-3 bg-card">
                  <h3
                    className="text-lg leading-tight"
                    style={{ color: primaryHex, fontFamily: getFontStack(draft.heading_font) }}
                  >
                    Welcome back
                  </h3>
                  <p className="text-xs text-muted-foreground" style={{ fontFamily: getFontStack(draft.body_font) }}>
                    Your brand colors and fonts will appear consistently across the app.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className="rounded-md px-3 py-1.5 text-xs font-medium text-white shadow-sm"
                      style={{ backgroundColor: primaryHex }}
                    >
                      Primary action
                    </button>
                    <button
                      className="rounded-md px-3 py-1.5 text-xs font-medium border"
                      style={{ borderColor: primaryHex, color: primaryHex }}
                    >
                      Secondary
                    </button>
                    <Badge style={{ backgroundColor: accentHex, color: "#fff" }}>Accent</Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BrandingSettings;

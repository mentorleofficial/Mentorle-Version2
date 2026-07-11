import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Copy, CheckCircle2, AlertCircle, XCircle } from "lucide-react";

interface JwtRow {
  id: string;
  enabled: boolean;
  issuer: string;
  audience: string;
  algorithm: string;
  public_key: string;
  jwks_url: string;
  login_redirect_url: string;
  logout_redirect_url: string;
  token_param_name: string;
  claim_email: string;
  claim_full_name: string;
  claim_user_id: string;
  claim_role: string;
  default_role: "admin" | "mentor" | "mentee";
  auto_provision: boolean;
  allowed_clock_skew_seconds: number;
}

const ALGORITHMS = ["RS256", "RS384", "RS512", "ES256", "ES384", "HS256"];

const Section = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">{title}</CardTitle>
      {description && <CardDescription>{description}</CardDescription>}
    </CardHeader>
    <CardContent className="space-y-4">{children}</CardContent>
  </Card>
);

const JwtSettings = () => {
  const { toast } = useToast();
  const [original, setOriginal] = useState<JwtRow | null>(null);
  const [draft, setDraft] = useState<JwtRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [keyMode, setKeyMode] = useState<"jwks" | "pem">("jwks");
  const [testToken, setTestToken] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const callbackUrl = `${window.location.origin}/auth/jwt/callback`;

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("jwt_config").select("*").limit(1).single();
      if (data) {
        const row = data as unknown as JwtRow;
        setOriginal(row);
        setDraft(row);
        setKeyMode(row.jwks_url ? "jwks" : "pem");
      }
    })();
  }, []);

  const dirty = useMemo(() => {
    if (!original || !draft) return false;
    return JSON.stringify(original) !== JSON.stringify(draft);
  }, [original, draft]);

  const status = useMemo(() => {
    if (!draft) return { label: "Loading", tone: "muted" as const };
    if (!draft.enabled) return { label: "Disabled", tone: "muted" as const };
    const hasKey = !!(draft.jwks_url || draft.public_key);
    if (!draft.issuer || !draft.audience || !hasKey) {
      return { label: "Misconfigured", tone: "destructive" as const };
    }
    return { label: "Active", tone: "success" as const };
  }, [draft]);

  const update = (patch: Partial<JwtRow>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d));

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const { id, ...payload } = draft;
    const { error } = await supabase.from("jwt_config").update(payload).eq("id", id);
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
      return;
    }
    toast({ title: "Saved", description: "JWT configuration updated." });
    setOriginal(draft);
  };

  const copyCallback = async () => {
    await navigator.clipboard.writeText(callbackUrl);
    toast({ title: "Copied", description: "Callback URL copied to clipboard." });
  };

  const runTest = async () => {
    if (!testToken.trim()) return;
    setTesting(true);
    setTestResult(null);
    const { data, error } = await supabase.functions.invoke("validate-jwt-config", {
      body: { token: testToken.trim() },
    });
    setTesting(false);
    if (error) {
      setTestResult({ ok: false, errors: [error.message] });
      return;
    }
    setTestResult(data);
  };

  if (!draft) return <div className="text-muted-foreground text-sm">Loading JWT config…</div>;

  return (
    <div className="space-y-6">
      {/* Status */}
      <Card>
        <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-6">
          <div className="flex items-center gap-3">
            <Switch checked={draft.enabled} onCheckedChange={(v) => update({ enabled: v })} />
            <div>
              <div className="font-medium">External SSO (JWT)</div>
              <div className="text-xs text-muted-foreground">
                Allow users to sign in via an external identity provider.
              </div>
            </div>
          </div>
          <Badge
            variant={status.tone === "success" ? "default" : status.tone === "destructive" ? "destructive" : "secondary"}
            className="self-start sm:self-auto"
          >
            {status.label}
          </Badge>
        </CardContent>
      </Card>

      {/* Identity provider */}
      <Section title="Identity provider" description="Issuer and audience that must match the incoming JWT.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Issuer (iss)</Label>
            <Input value={draft.issuer} onChange={(e) => update({ issuer: e.target.value })} placeholder="https://idp.example.com" />
          </div>
          <div className="space-y-2">
            <Label>Audience (aud)</Label>
            <Input value={draft.audience} onChange={(e) => update({ audience: e.target.value })} placeholder="your-app-id" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Algorithm</Label>
          <Select value={draft.algorithm} onValueChange={(v) => update({ algorithm: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ALGORITHMS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Section>

      {/* Signing keys */}
      <Section title="Signing keys" description="Provide one of: a JWKS URL (recommended) or a static public key.">
        <Tabs value={keyMode} onValueChange={(v) => setKeyMode(v as "jwks" | "pem")}>
          <TabsList>
            <TabsTrigger value="jwks">JWKS URL</TabsTrigger>
            <TabsTrigger value="pem">Public key (PEM)</TabsTrigger>
          </TabsList>
          <TabsContent value="jwks" className="space-y-2 mt-4">
            <Label>JWKS endpoint</Label>
            <Input
              value={draft.jwks_url}
              onChange={(e) => update({ jwks_url: e.target.value })}
              placeholder="https://idp.example.com/.well-known/jwks.json"
            />
            <p className="text-xs text-muted-foreground">Keys are fetched and cached automatically.</p>
          </TabsContent>
          <TabsContent value="pem" className="space-y-2 mt-4">
            <Label>Public key</Label>
            <Textarea
              rows={6}
              value={draft.public_key}
              onChange={(e) => update({ public_key: e.target.value })}
              className="font-mono text-xs"
              placeholder="-----BEGIN PUBLIC KEY-----&#10;...&#10;-----END PUBLIC KEY-----"
            />
          </TabsContent>
        </Tabs>
      </Section>

      {/* Redirects */}
      <Section title="Redirect URLs" description="Configure where users go before and after sign-in.">
        <div className="space-y-2">
          <Label>Callback URL (paste this into your IdP)</Label>
          <div className="flex gap-2">
            <Input readOnly value={callbackUrl} className="font-mono text-xs" />
            <Button type="button" variant="outline" size="icon" onClick={copyCallback}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Login redirect</Label>
            <Input
              value={draft.login_redirect_url}
              onChange={(e) => update({ login_redirect_url: e.target.value })}
              placeholder="https://idp.example.com/login"
            />
          </div>
          <div className="space-y-2">
            <Label>Logout redirect</Label>
            <Input
              value={draft.logout_redirect_url}
              onChange={(e) => update({ logout_redirect_url: e.target.value })}
              placeholder="https://idp.example.com/logout"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Token parameter name</Label>
          <Input
            value={draft.token_param_name}
            onChange={(e) => update({ token_param_name: e.target.value })}
            placeholder="token"
          />
          <p className="text-xs text-muted-foreground">Query/hash parameter that carries the JWT on callback.</p>
        </div>
      </Section>

      {/* Claim mapping */}
      <Section title="Claim mapping" description="Tell us which claim in the JWT holds each piece of user info.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Email claim</Label>
            <Input value={draft.claim_email} onChange={(e) => update({ claim_email: e.target.value })} placeholder="email" />
          </div>
          <div className="space-y-2">
            <Label>Full name claim</Label>
            <Input value={draft.claim_full_name} onChange={(e) => update({ claim_full_name: e.target.value })} placeholder="name" />
          </div>
          <div className="space-y-2">
            <Label>User ID claim</Label>
            <Input value={draft.claim_user_id} onChange={(e) => update({ claim_user_id: e.target.value })} placeholder="sub" />
            <p className="text-xs text-muted-foreground">Stored as <code>external_id</code>.</p>
          </div>
          <div className="space-y-2">
            <Label>Role claim (optional)</Label>
            <Input value={draft.claim_role} onChange={(e) => update({ claim_role: e.target.value })} placeholder="role" />
          </div>
        </div>
      </Section>

      {/* Provisioning */}
      <Section title="Provisioning" description="What happens the first time a user signs in.">
        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <div>
            <div className="font-medium text-sm">Auto-provision new users</div>
            <div className="text-xs text-muted-foreground">Create a Lovable user automatically when they sign in for the first time.</div>
          </div>
          <Switch checked={draft.auto_provision} onCheckedChange={(v) => update({ auto_provision: v })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Default role</Label>
            <Select value={draft.default_role} onValueChange={(v) => update({ default_role: v as JwtRow["default_role"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mentee">Mentee</SelectItem>
                <SelectItem value="mentor">Mentor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Allowed clock skew (seconds)</Label>
            <Input
              type="number"
              min={0}
              value={draft.allowed_clock_skew_seconds}
              onChange={(e) => update({ allowed_clock_skew_seconds: parseInt(e.target.value || "0", 10) })}
            />
          </div>
        </div>
      </Section>

      {/* Test */}
      <Section title="Test a token" description="Paste a JWT to verify the signature and preview mapped claims.">
        <Textarea
          rows={4}
          value={testToken}
          onChange={(e) => setTestToken(e.target.value)}
          placeholder="eyJhbGciOiJIUzI1NiIs..."
          className="font-mono text-xs"
        />
        <div className="flex justify-end">
          <Button type="button" onClick={runTest} disabled={!testToken.trim() || testing} variant="outline">
            {testing ? "Validating…" : "Validate token"}
          </Button>
        </div>
        {testResult && (
          <div
            className={`rounded-md border p-3 text-sm space-y-2 ${
              testResult.ok ? "border-green-500/40 bg-green-500/5" : "border-destructive/40 bg-destructive/5"
            }`}
          >
            <div className="flex items-center gap-2 font-medium">
              {testResult.ok ? (
                <><CheckCircle2 className="h-4 w-4 text-green-600" /> Token is valid</>
              ) : (
                <><XCircle className="h-4 w-4 text-destructive" /> Validation failed</>
              )}
            </div>
            {testResult.errors?.length > 0 && (
              <ul className="text-xs text-destructive list-disc pl-5">
                {testResult.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
              </ul>
            )}
            {testResult.mapped && (
              <div className="text-xs">
                <div className="font-medium mb-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Mapped user
                </div>
                <pre className="bg-muted/50 rounded p-2 overflow-auto">{JSON.stringify(testResult.mapped, null, 2)}</pre>
              </div>
            )}
            {testResult.payload && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Raw payload</summary>
                <pre className="bg-muted/50 rounded p-2 overflow-auto mt-1">{JSON.stringify(testResult.payload, null, 2)}</pre>
              </details>
            )}
          </div>
        )}
      </Section>

      {/* Save bar */}
      <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 rounded-lg border border-border bg-card/95 backdrop-blur p-3 shadow-sm">
        <span className="mr-auto text-xs text-muted-foreground">
          {dirty ? "Unsaved changes" : "All changes saved"}
        </span>
        <Button variant="ghost" disabled={!dirty || saving} onClick={() => { setDraft(original); setKeyMode(original?.jwks_url ? "jwks" : "pem"); }}>
          Discard
        </Button>
        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
};

export default JwtSettings;

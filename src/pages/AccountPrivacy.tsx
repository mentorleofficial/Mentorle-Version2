import { formatISTDate, formatISTDateTime } from "@/lib/datetime";
import { useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import {
useCurrentPolicy,
  useMyLatestConsent,
  useMyDsrs,
  useCreateDsr,
  useWithdrawConsent,
  useAcceptPolicy,
  PolicyKind,
} from "@/features/privacy/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Download, FileEdit, Trash2, LogOut, Loader2 } from "lucide-react";

const KIND_META: Record<PolicyKind, { label: string; icon: typeof Download; description: string }> = {
  export: { label: "Download my data", icon: Download, description: "Receive a JSON file with all your data." },
  correction: { label: "Request correction", icon: FileEdit, description: "Ask an admin to correct your information." },
  deletion: { label: "Request deletion", icon: Trash2, description: "Ask us to delete your account and data." },
  withdrawal: { label: "Withdraw consent", icon: LogOut, description: "Withdraw consent and disable your account." },
};

const STATUS_VARIANT: Record<string, "secondary" | "default" | "outline" | "destructive"> = {
  pending: "secondary",
  in_review: "default",
  completed: "outline",
  rejected: "destructive",
};

const AccountPrivacy = () => {
  const { user } = useAuth();
  const { data: policy } = useCurrentPolicy();
  const { data: consent } = useMyLatestConsent(user?.id);
  const { data: dsrs } = useMyDsrs(user?.id);
  const createDsr = useCreateDsr();
  const accept = useAcceptPolicy();
  const withdraw = useWithdrawConsent();
  const [openKind, setOpenKind] = useState<PolicyKind | null>(null);
  const [message, setMessage] = useState("");
  const [exporting, setExporting] = useState(false);

  if (!user) return null;

  const exportNow = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("export-user-data", { body: {} });
      if (error) throw error;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `my-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      // Also log the request
      await createDsr.mutateAsync({ userId: user.id, kind: "export", message: "Self-service export" });
      toast({ title: "Export ready", description: "Your data was downloaded." });
    } catch (e) {
      toast({ title: "Export failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const submitRequest = async () => {
    if (!openKind) return;
    await createDsr.mutateAsync({ userId: user.id, kind: openKind, message });
    if (openKind === "withdrawal" && consent && !consent.withdrawn_at) {
      await withdraw.mutateAsync(consent.id);
    }
    setOpenKind(null);
    setMessage("");
    toast({ title: "Request submitted", description: "An admin will review it shortly." });
  };

  return (
    <AppLayout>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="font-serif text-2xl">Privacy & My Data</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your consent and exercise your data rights.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current consent</CardTitle>
            <CardDescription>
              Active policy: {policy ? `v${policy.version}` : "—"}{" "}
              {policy && (
                <Link to="/privacy-policy" className="underline ml-1">
                  Read policy
                </Link>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {consent ? (
              <div className="text-sm">
                You accepted v{consent.policy_version} on{" "}
                {formatISTDateTime(consent.accepted_at)}
                {consent.withdrawn_at && (
                  <Badge variant="destructive" className="ml-2">
                    Withdrawn {formatISTDate(consent.withdrawn_at)}
                  </Badge>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">You have not yet accepted the privacy policy.</p>
            )}
            <div className="flex gap-2">
              {policy && (!consent || consent.policy_version !== policy.version || consent.withdrawn_at) && (
                <Button
                  size="sm"
                  onClick={() => accept.mutateAsync({ userId: user.id, version: policy.version })}
                  disabled={accept.isPending}
                >
                  Accept current policy
                </Button>
              )}
              {consent && !consent.withdrawn_at && (
                <Button size="sm" variant="outline" onClick={() => setOpenKind("withdrawal")}>
                  Withdraw consent
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your data rights</CardTitle>
            <CardDescription>Submit a request and an admin will respond.</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            {(Object.entries(KIND_META) as [PolicyKind, typeof KIND_META[PolicyKind]][]).map(([kind, meta]) => {
              const Icon = meta.icon;
              return (
                <button
                  key={kind}
                  onClick={() => (kind === "export" ? exportNow() : setOpenKind(kind))}
                  disabled={exporting && kind === "export"}
                  className="text-left rounded-md border p-4 hover:bg-accent transition-colors disabled:opacity-60"
                >
                  <div className="flex items-center gap-2 font-medium text-sm">
                    {exporting && kind === "export" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                    {meta.label}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{meta.description}</p>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {openKind && openKind !== "export" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{KIND_META[openKind].label}</CardTitle>
              <CardDescription>{KIND_META[openKind].description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Add any details for the admin (optional)…"
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
                rows={4}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setOpenKind(null)}>
                  Cancel
                </Button>
                <Button onClick={submitRequest} disabled={createDsr.isPending}>
                  {createDsr.isPending ? "Submitting…" : "Submit request"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">My requests</CardTitle>
          </CardHeader>
          <CardContent>
            {!dsrs?.length ? (
              <p className="text-sm text-muted-foreground">You haven't submitted any privacy requests yet.</p>
            ) : (
              <ul className="divide-y">
                {dsrs.map((r) => (
                  <li key={r.id} className="py-3 flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium capitalize">{r.kind}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatISTDateTime(r.created_at)}
                      </div>
                      {r.message && <div className="text-xs mt-1">{r.message}</div>}
                      {r.admin_notes && (
                        <>
                          <Separator className="my-2" />
                          <div className="text-xs">
                            <span className="font-medium">Admin: </span>
                            {r.admin_notes}
                          </div>
                        </>
                      )}
                    </div>
                    <Badge variant={STATUS_VARIANT[r.status] ?? "secondary"}>{r.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AccountPrivacy;

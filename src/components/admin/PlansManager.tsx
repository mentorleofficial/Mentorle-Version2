import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

// The plans shown on mentorle.in's pricing page (subscription_plans): add, edit, reorder, hide and delete.
// "free" is the display-only starter tier, "one_time" a pass bought for N months (Pro Pass), "subscription"
// the legacy auto-renewing Plus plans (kept for their members, not creatable here).

type Billing = "free" | "one_time" | "subscription";

interface Plan {
  id: string;
  name: string;
  slug: string;
  billing: Billing;
  price: number;
  access_months: number | null;
  session_discount_percent: number;
  event_discount_percent: number;
  free_sessions: number;
  free_sessions_period: "month" | "year";
  tagline: string;
  intro: string;
  benefits: string[];
  badge: string;
  featured: boolean;
  cta_label: string;
  price_note: string;
  sort_order: number;
  is_active: boolean;
}

type Draft = Omit<Plan, "id"> & { id: string | null };

const blank = (sortOrder: number): Draft => ({
  id: null,
  name: "",
  slug: "",
  billing: "one_time",
  price: 0,
  access_months: 12,
  session_discount_percent: 0,
  event_discount_percent: 0,
  free_sessions: 0,
  free_sessions_period: "year",
  tagline: "",
  intro: "",
  benefits: [],
  badge: "",
  featured: false,
  cta_label: "",
  price_note: "",
  sort_order: sortOrder,
  is_active: true,
});

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const fromRow = (row: Record<string, unknown>): Plan => ({
  id: row.id as string,
  name: (row.name as string) ?? "",
  slug: (row.slug as string) ?? "",
  billing: ((row.billing as Billing) ?? "subscription") as Billing,
  price: Number(row.price ?? 0),
  access_months: row.access_months == null ? null : Number(row.access_months),
  session_discount_percent: Number(row.session_discount_percent ?? 0),
  event_discount_percent: Number(row.event_discount_percent ?? 0),
  free_sessions: Number(row.free_sessions ?? 0),
  free_sessions_period: (row.free_sessions_period as "month" | "year") ?? "year",
  tagline: (row.tagline as string) ?? "",
  intro: (row.intro as string) ?? "",
  benefits: Array.isArray(row.benefits) ? (row.benefits as string[]) : [],
  badge: (row.badge as string) ?? "",
  featured: Boolean(row.featured),
  cta_label: (row.cta_label as string) ?? "",
  price_note: (row.price_note as string) ?? "",
  sort_order: Number(row.sort_order ?? 0),
  is_active: Boolean(row.is_active),
});

const billingLabel = (plan: Pick<Plan, "billing" | "access_months">) =>
  plan.billing === "free" ? "Free tier" : plan.billing === "one_time" ? `One-time · ${plan.access_months ?? 12} months` : "Subscription (legacy)";

function problems(draft: Draft, commissionPercent: number) {
  const list: string[] = [];
  if (!draft.name.trim()) list.push("Give the plan a name.");
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(draft.slug)) list.push("The URL name can use lowercase letters, numbers and single hyphens.");
  if (draft.billing === "one_time" && !(draft.price > 0)) list.push("A paid pass needs a price above ₹0.");
  if (draft.billing === "one_time" && !(Number(draft.access_months) >= 1 && Number(draft.access_months) <= 60)) list.push("Access must be 1–60 months.");
  for (const [label, value] of [
    ["Session discount", draft.session_discount_percent],
    ["Event discount", draft.event_discount_percent],
  ] as const)
    if (value < 0 || value > 100) list.push(`${label} must be 0–100%.`);
  if (draft.free_sessions < 0 || draft.free_sessions > 100) list.push("Free sessions must be 0–100.");
  const warnings: string[] = [];
  if (draft.session_discount_percent > commissionPercent || draft.event_discount_percent > commissionPercent)
    warnings.push(`A discount above the ${commissionPercent}% commission means the platform pays the difference on each booking.`);
  return { errors: list, warnings };
}

export default function PlansManager({ commissionPercent }: { commissionPercent: number }) {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [members, setMembers] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState<Draft | null>(null);
  const [benefitsText, setBenefitsText] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Plan | null>(null);

  const load = useCallback(async () => {
    const [{ data: rows }, { data: memberRows }] = await Promise.all([
      supabase.from("subscription_plans").select("*").order("sort_order").order("price"),
      supabase.from("memberships").select("plan_id").in("status", ["active", "pending", "past_due"]),
    ]);
    setPlans(((rows ?? []) as Record<string, unknown>[]).map(fromRow));
    const counts: Record<string, number> = {};
    for (const row of memberRows ?? []) if (row.plan_id) counts[row.plan_id] = (counts[row.plan_id] ?? 0) + 1;
    setMembers(counts);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const open = (plan: Plan | null) => {
    const next = plan ? { ...plan } : blank((plans[plans.length - 1]?.sort_order ?? 0) + 1);
    setDraft(next);
    setBenefitsText(next.benefits.join("\n"));
    setSlugTouched(Boolean(plan));
  };
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => (current ? { ...current, [key]: value } : current));

  const save = async () => {
    if (!draft) return;
    const benefits = benefitsText.split("\n").map((line) => line.trim()).filter(Boolean);
    const candidate = { ...draft, benefits, price: draft.billing === "free" ? 0 : draft.price };
    const { errors } = problems(candidate, commissionPercent);
    if (errors.length) {
      toast({ variant: "destructive", title: "Check the plan", description: errors[0] });
      return;
    }
    setSaving(true);
    const row = {
      name: candidate.name.trim(),
      slug: candidate.slug,
      billing: candidate.billing,
      interval: candidate.billing === "subscription" ? undefined : "year",
      price: candidate.price,
      access_months: candidate.billing === "one_time" ? Number(candidate.access_months) : null,
      session_discount_percent: Number(candidate.session_discount_percent) || 0,
      event_discount_percent: Number(candidate.event_discount_percent) || 0,
      free_sessions: Number(candidate.free_sessions) || 0,
      free_sessions_period: candidate.free_sessions_period,
      monthly_quota: candidate.free_sessions_period === "month" ? Number(candidate.free_sessions) || 0 : 0,
      tagline: candidate.tagline.trim(),
      intro: candidate.intro.trim(),
      benefits,
      badge: candidate.badge.trim(),
      featured: candidate.featured,
      cta_label: candidate.cta_label.trim(),
      price_note: candidate.price_note.trim(),
      sort_order: candidate.sort_order,
      is_active: candidate.is_active,
      updated_at: new Date().toISOString(),
    };
    const query = candidate.id
      ? supabase.from("subscription_plans").update(row as never).eq("id", candidate.id)
      : supabase.from("subscription_plans").insert(row as never);
    const { error } = await query;
    setSaving(false);
    if (error) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: error.message.includes("subscription_plans_slug_key") ? "Another plan already uses that URL name." : error.message,
      });
      return;
    }
    toast({ title: candidate.id ? "Plan saved" : "Plan added", description: "The pricing page updates within a few minutes." });
    setDraft(null);
    void load();
  };

  const toggleActive = async (plan: Plan, isActive: boolean) => {
    setPlans((current) => current.map((p) => (p.id === plan.id ? { ...p, is_active: isActive } : p)));
    const { error } = await supabase.from("subscription_plans").update({ is_active: isActive } as never).eq("id", plan.id);
    if (error) {
      toast({ variant: "destructive", title: "Couldn't update", description: error.message });
      void load();
    }
  };

  // Swaps two neighbours, then numbers every plan 0, 1, 2… in the new order.
  const move = async (index: number, delta: -1 | 1) => {
    if (!plans[index + delta]) return;
    const order = [...plans];
    [order[index], order[index + delta]] = [order[index + delta], order[index]];
    setPlans(order.map((plan, position) => ({ ...plan, sort_order: position })));
    await Promise.all(
      order.map((plan, position) => (plan.sort_order === position ? null : supabase.from("subscription_plans").update({ sort_order: position } as never).eq("id", plan.id))),
    );
    void load();
  };

  const remove = async (plan: Plan) => {
    setDeleting(null);
    const { count } = await supabase.from("memberships").select("id", { count: "exact", head: true }).eq("plan_id", plan.id);
    if (count) {
      // Members (current or past) point at it: hide it from sale instead of deleting.
      await toggleActive(plan, false);
      toast({ title: "Plan hidden", description: `${count} membership${count === 1 ? "" : "s"} use this plan, so it was hidden from sale instead of deleted.` });
      return;
    }
    const { error } = await supabase.from("subscription_plans").delete().eq("id", plan.id);
    toast(error ? { variant: "destructive", title: "Delete failed", description: error.message } : { title: "Plan deleted" });
    void load();
  };

  const check = draft ? problems({ ...draft, benefits: [] }, commissionPercent) : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Plans</CardTitle>
          <CardDescription>
            Shown on mentorle.in/pricing in this order. Discounts and free sessions apply to members as soon as you save. Hidden plans stop selling; members keep
            theirs until it ends.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => open(null)}>
          <Plus className="mr-1.5 h-4 w-4" /> Add plan
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {plans.length === 0 && <p className="text-sm text-muted-foreground">No plans yet.</p>}
        {plans.map((plan, index) => (
          <div key={plan.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center">
            <div className="flex shrink-0 gap-1 sm:flex-col">
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => void move(index, -1)} aria-label={`Move ${plan.name} up`}>
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === plans.length - 1} onClick={() => void move(index, 1)} aria-label={`Move ${plan.name} down`}>
                <ArrowDown className="h-4 w-4" />
              </Button>
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{plan.name}</span>
                <Badge variant="secondary" className="text-xs">{billingLabel(plan)}</Badge>
                {plan.featured && <Badge className="text-xs">{plan.badge || "Featured"}</Badge>}
                {!plan.is_active && <Badge variant="outline" className="text-xs">Hidden</Badge>}
                {members[plan.id] ? <span className="text-xs text-muted-foreground">{members[plan.id]} current member{members[plan.id] === 1 ? "" : "s"}</span> : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {plan.billing === "free" ? "₹0" : `₹${plan.price.toLocaleString("en-IN")}`}
                {plan.session_discount_percent > 0 && ` · ${plan.session_discount_percent}% off 1:1 sessions`}
                {plan.event_discount_percent > 0 && ` · ${plan.event_discount_percent}% off events`}
                {plan.free_sessions > 0 && ` · ${plan.free_sessions} free session${plan.free_sessions === 1 ? "" : "s"} / ${plan.free_sessions_period}`}
                {` · ${plan.benefits.length} benefit${plan.benefits.length === 1 ? "" : "s"}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor={`plan-active-${plan.id}`} className="text-xs">
                  On sale
                </Label>
                <Switch id={`plan-active-${plan.id}`} checked={plan.is_active} onCheckedChange={(value) => void toggleActive(plan, value)} />
              </div>
              <Button variant="outline" size="sm" onClick={() => open(plan)}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleting(plan)} aria-label={`Delete ${plan.name}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={!!draft} onOpenChange={(value) => !value && setDraft(null)}>
        <DialogContent className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? `Edit ${draft.name || "plan"}` : "Add a plan"}</DialogTitle>
            <DialogDescription>What it costs, what members get, and how its card reads on the pricing page.</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-6">
              <section className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="plan-name">Name</Label>
                  <Input
                    id="plan-name"
                    value={draft.name}
                    onChange={(e) => {
                      set("name", e.target.value);
                      if (!slugTouched) set("slug", slugify(e.target.value));
                    }}
                    placeholder="Pro Pass"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="plan-slug">URL name</Label>
                  <Input
                    id="plan-slug"
                    value={draft.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      set("slug", slugify(e.target.value));
                    }}
                    placeholder="pro-pass"
                  />
                  <p className="text-xs text-muted-foreground">Used in links like /pricing?plan={draft.slug || "pro-pass"}.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  {draft.billing === "subscription" ? (
                    <p className="text-sm text-muted-foreground">Subscription (legacy Plus): kept for existing members.</p>
                  ) : (
                    <Select value={draft.billing} onValueChange={(value) => set("billing", value as Billing)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="one_time">Paid pass (one-time payment)</SelectItem>
                        <SelectItem value="free">Free tier (shown, not bought)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                {draft.billing !== "free" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="plan-price">Price (₹)</Label>
                      <Input id="plan-price" type="number" min={1} value={draft.price} onChange={(e) => set("price", Number(e.target.value))} />
                    </div>
                    {draft.billing === "one_time" && (
                      <div className="space-y-1.5">
                        <Label htmlFor="plan-months">Access (months)</Label>
                        <Input id="plan-months" type="number" min={1} max={60} value={draft.access_months ?? 12} onChange={(e) => set("access_months", Number(e.target.value))} />
                      </div>
                    )}
                  </div>
                )}
              </section>

              {draft.billing !== "free" && (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">Member benefits at checkout</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="plan-session-discount">Discount on paid 1:1 sessions (%)</Label>
                      <Input id="plan-session-discount" type="number" min={0} max={100} value={draft.session_discount_percent} onChange={(e) => set("session_discount_percent", Number(e.target.value))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="plan-event-discount">Discount on paid events (%)</Label>
                      <Input id="plan-event-discount" type="number" min={0} max={100} value={draft.event_discount_percent} onChange={(e) => set("event_discount_percent", Number(e.target.value))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="plan-free">Free 1:1 sessions</Label>
                      <div className="flex gap-2">
                        <Input id="plan-free" type="number" min={0} max={100} value={draft.free_sessions} onChange={(e) => set("free_sessions", Number(e.target.value))} />
                        <Select value={draft.free_sessions_period} onValueChange={(value) => set("free_sessions_period", value as "month" | "year")}>
                          <SelectTrigger className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="year">per year</SelectItem>
                            <SelectItem value="month">per month</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-xs text-muted-foreground">Usable on offerings marked "Plus eligible". 0 = none.</p>
                    </div>
                  </div>
                  {check?.warnings.map((warning) => (
                    <p key={warning} className="text-xs text-amber-600">
                      {warning}
                    </p>
                  ))}
                </section>
              )}

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Pricing card</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="plan-tagline">Tagline</Label>
                    <Input id="plan-tagline" value={draft.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder="For people ready to invest in their growth…" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="plan-intro">Line above the benefits</Label>
                    <Input id="plan-intro" value={draft.intro} onChange={(e) => set("intro", e.target.value)} placeholder="Everything in Free, plus:" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="plan-note">Note under the price</Label>
                    <Input id="plan-note" value={draft.price_note} onChange={(e) => set("price_note", e.target.value)} placeholder="About ₹417 a month" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="plan-benefits">Benefits (one per line)</Label>
                    <Textarea id="plan-benefits" rows={6} value={benefitsText} onChange={(e) => setBenefitsText(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Wrap the lead in **double asterisks** to make it bold, e.g. **12 masterclasses a year** to build skills.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="plan-cta">Button label</Label>
                    <Input id="plan-cta" value={draft.cta_label} onChange={(e) => set("cta_label", e.target.value)} placeholder={draft.billing === "free" ? "Join the Free Community" : `Get ${draft.name || "this plan"}`} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="plan-badge">Badge</Label>
                    <Input id="plan-badge" value={draft.badge} onChange={(e) => set("badge", e.target.value)} placeholder="Most Popular" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="plan-featured" checked={draft.featured} onCheckedChange={(value) => set("featured", value)} />
                    <Label htmlFor="plan-featured">Highlight this card</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="plan-active" checked={draft.is_active} onCheckedChange={(value) => set("is_active", value)} />
                    <Label htmlFor="plan-active">On sale</Label>
                  </div>
                </div>
              </section>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : draft?.id ? "Save plan" : "Add plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(value) => !value && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              It disappears from the pricing page. If anyone has (or had) this plan, it's hidden from sale instead, so their membership keeps working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && void remove(deleting)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

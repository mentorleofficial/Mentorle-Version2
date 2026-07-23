import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface PlanRow {
  id: string;
  name: string;
  interval: string;
  price: number;
  currency: string;
  monthly_quota: number;
  benefits: string[];
  is_active: boolean;
  max_amount: number | null;
}

const PaymentSettings = () => {
  const { toast } = useToast();
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [commission, setCommission] = useState<string | number>(20);
  const [plusPayout, setPlusPayout] = useState<string | number>(50);
  const [plusDiscount, setPlusDiscount] = useState<string | number>(0);
  const [savingFees, setSavingFees] = useState(false);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from("payment_settings").select("*").limit(1).maybeSingle();
      if (s) {
        setSettingsId(s.id);
        setCommission(s.commission_percent);
        setPlusPayout(s.plus_payout_percent);
        setPlusDiscount((s as { plus_discount_percent?: number }).plus_discount_percent ?? 0);
      }
      const { data: p } = await supabase.from("subscription_plans").select("*").order("price");
      if (p) {
        setPlans(
          p.map((row) => ({
            id: row.id,
            name: row.name,
            interval: row.interval,
            price: Number(row.price),
            currency: row.currency,
            monthly_quota: row.monthly_quota,
            benefits: Array.isArray(row.benefits) ? (row.benefits as string[]) : [],
            is_active: row.is_active,
            max_amount: (() => {
              const v = (row as { max_amount?: number | string | null }).max_amount;
              return v != null ? Number(v) : null;
            })(),
          })),
        );
      }
    })();
  }, []);

  const saveFees = async () => {
    if (!settingsId) return;
    if (Number(plusDiscount) > Number(commission)) {
      toast({
        variant: "destructive",
        title: "Discount too high",
        description: "The Plus member discount can't exceed the commission % — otherwise the platform loses money on discounted bookings.",
      });
      return;
    }
    setSavingFees(true);
    // plus_discount_percent becomes typed once migration 20260722220000 is applied + types regenerated.
    const feesPayload = {
      commission_percent: Number(commission) || 0,
      plus_payout_percent: Number(plusPayout) || 0,
      plus_discount_percent: Number(plusDiscount) || 0,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("payment_settings")
      .update(feesPayload as never)
      .eq("id", settingsId);
    setSavingFees(false);
    toast(
      error
        ? { variant: "destructive", title: "Save failed", description: error.message }
        : { title: "Fees saved" },
    );
  };

  const updatePlan = (id: string, patch: Partial<PlanRow>) =>
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const savePlan = async (plan: PlanRow) => {
    setSavingPlanId(plan.id);
    // max_amount becomes a typed column once migration 20260722200000 is applied + types regenerated.
    const payload = {
      name: plan.name,
      price: Number(plan.price) || 0,
      monthly_quota: Number(plan.monthly_quota) || 0,
      benefits: plan.benefits.map((b) => b.trim()).filter(Boolean),
      is_active: plan.is_active,
      max_amount: plan.max_amount != null ? Number(plan.max_amount) : null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("subscription_plans")
      .update(payload as never)
      .eq("id", plan.id);
    setSavingPlanId(null);
    toast(
      error
        ? { variant: "destructive", title: "Save failed", description: error.message }
        : { title: "Plan saved" },
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Fees &amp; payouts</CardTitle>
          <CardDescription>How much the platform keeps and mentors earn. Applies to new bookings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Commission on paid 1:1 sessions and events (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Mentor earns the price minus this. E.g. 20 → mentor keeps 80%.</p>
            </div>
            <div className="space-y-2">
              <Label>Plus session payout to mentor (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={plusPayout}
                onChange={(e) => setPlusPayout(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">When a Plus member books free, the mentor earns this % of the list price.</p>
            </div>
            <div className="space-y-2">
              <Label>Plus member discount on paid items (%)</Label>
              <Input
                type="number"
                min={0}
                max={Number(commission) || 0}
                value={plusDiscount}
                onChange={(e) => setPlusDiscount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Discount Plus members get on paid 1:1s and events. Must be ≤ the commission ({commission || 0}%) — the discount comes out of the platform's cut. 0 = no discount.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveFees} disabled={savingFees}>
              {savingFees ? "Saving…" : "Save fees"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mentorle Plus plans</CardTitle>
          <CardDescription>Set pricing for the monthly and yearly plans. Prices are shown to members on the Go Plus page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {plans.length === 0 && <p className="text-sm text-muted-foreground">No plans found.</p>}
          {plans.map((plan) => (
            <div key={plan.id} className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{plan.name}</span>
                  <Badge variant="secondary" className="text-xs capitalize">{plan.interval}ly</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Active</Label>
                  <Switch checked={plan.is_active} onCheckedChange={(v) => updatePlan(plan.id, { is_active: v })} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input value={plan.name} onChange={(e) => updatePlan(plan.id, { name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Price (₹ / {plan.interval})</Label>
                  <Input
                    type="number"
                    min={0}
                    value={plan.price}
                    onChange={(e) => updatePlan(plan.id, { price: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Free sessions / month</Label>
                  <Input
                    type="number"
                    min={0}
                    value={plan.monthly_quota}
                    onChange={(e) => updatePlan(plan.id, { monthly_quota: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mandate ceiling (₹, optional)</Label>
                <Input
                  type="number"
                  min={0}
                  value={plan.max_amount ?? ""}
                  onChange={(e) =>
                    updatePlan(plan.id, { max_amount: e.target.value === "" ? null : Number(e.target.value) })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Max we're authorized to auto-debit. Set above the price to allow raising it later for active members without re-approval. Blank = exact price.
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Benefits (one per line)</Label>
                <Textarea
                  rows={4}
                  value={plan.benefits.join("\n")}
                  onChange={(e) => updatePlan(plan.id, { benefits: e.target.value.split("\n") })}
                />
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={() => savePlan(plan)} disabled={savingPlanId === plan.id}>
                  {savingPlanId === plan.id ? "Saving…" : "Save plan"}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentSettings;

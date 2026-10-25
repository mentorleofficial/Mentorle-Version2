import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import PlansManager from "@/components/admin/PlansManager";

// Admin → Settings → Payments: the platform's fees, then the plans sold on mentorle.in's pricing page.
// Member discounts are set per plan (PlansManager), not here.
const PaymentSettings = () => {
  const { toast } = useToast();
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [commission, setCommission] = useState<string | number>(20);
  const [plusPayout, setPlusPayout] = useState<string | number>(50);
  const [savingFees, setSavingFees] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from("payment_settings").select("*").limit(1).maybeSingle();
      if (s) {
        setSettingsId(s.id);
        setCommission(s.commission_percent);
        setPlusPayout(s.plus_payout_percent);
      }
    })();
  }, []);

  const saveFees = async () => {
    if (!settingsId) return;
    setSavingFees(true);
    const { error } = await supabase
      .from("payment_settings")
      .update({
        commission_percent: Number(commission) || 0,
        plus_payout_percent: Number(plusPayout) || 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", settingsId);
    setSavingFees(false);
    toast(error ? { variant: "destructive", title: "Save failed", description: error.message } : { title: "Fees saved" });
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
              <Label htmlFor="fee-commission">Commission on paid 1:1 sessions and events (%)</Label>
              <Input id="fee-commission" type="number" min={0} max={100} value={commission} onChange={(e) => setCommission(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Mentor earns the full price minus this. E.g. 25 → mentor keeps 75%. Member discounts come out of the platform's share, so keep each plan's
                discount at or below this.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fee-payout">Free-session payout to mentor (%)</Label>
              <Input id="fee-payout" type="number" min={0} max={100} value={plusPayout} onChange={(e) => setPlusPayout(e.target.value)} />
              <p className="text-xs text-muted-foreground">When a member books with a plan's free session, the mentor earns this % of the list price.</p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveFees} disabled={savingFees}>
              {savingFees ? "Saving…" : "Save fees"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <PlansManager commissionPercent={Number(commission) || 0} />
    </div>
  );
};

export default PaymentSettings;

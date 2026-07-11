import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck } from "lucide-react";

const ApplicationPolicySettings = () => {
  const { toast } = useToast();
  const [id, setId] = useState<string | null>(null);
  const [cooldownDays, setCooldownDays] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase.from("branding").select("id, rejection_cooldown_days").limit(1).maybeSingle();
        if (error) throw error;
        if (data) {
          setId(data.id);
          setCooldownDays(data.rejection_cooldown_days);
        }
      } catch (err: any) {
        toast({ variant: "destructive", title: "Error loading settings", description: err.message });
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [toast]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("branding")
        .update({ rejection_cooldown_days: cooldownDays })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Settings saved", description: "Application policy settings updated successfully." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Save failed", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-muted-foreground text-sm">Loading application policy settings…</div>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Mentor Applications Policy</CardTitle>
              <CardDescription>
                Configure policies, review behaviors, and cooldown windows for applying mentors.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cooldown-days">Rejection Cooldown Period (Days)</Label>
            <Input
              id="cooldown-days"
              type="number"
              min={0}
              max={365}
              value={cooldownDays}
              onChange={(e) => setCooldownDays(parseInt(e.target.value, 10) || 0)}
              className="max-w-[200px]"
            />
            <p className="text-xs text-muted-foreground">
              The number of days a mentor applicant must wait before they can reapply if their application is rejected. Set to 0 to disable the cooldown period.
            </p>
          </div>

          <div className="flex justify-end pt-2 border-t mt-6">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ApplicationPolicySettings;

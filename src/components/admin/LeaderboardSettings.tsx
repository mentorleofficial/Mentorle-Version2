import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const LeaderboardSettings = () => {
  const { toast } = useToast();
  const [rowId, setRowId] = useState<string | null>(null);
  const [refreshHours, setRefreshHours] = useState<string | number>(24);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("branding")
        .select("id, leaderboard_refresh_hours")
        .limit(1).maybeSingle();
      if (error) {
        console.error("Failed to load leaderboard settings:", error);
        return;
      }
      if (data) {
        setRowId(data.id);
        setRefreshHours((data as any).leaderboard_refresh_hours ?? 24);
      }
    };
    load();
  }, []);

  const save = async () => {
    if (!rowId) {
      toast({ variant: "destructive", title: "Save failed", description: "Settings not loaded yet." });
      return;
    }
    setSaving(true);
    const parsedHours = parseInt(String(refreshHours)) || 24;
    const { error } = await supabase
      .from("branding")
      .update({ leaderboard_refresh_hours: parsedHours })
      .eq("id", rowId);
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: "Save failed", description: error.message });
    } else {
      toast({ title: "Settings saved successfully" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leaderboard settings</CardTitle>
        <CardDescription>
          Configure the automatic recalculation interval of the mentor leaderboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Leaderboard Auto-Refresh Interval (hours)</Label>
          <Input
            type="number"
            min={1}
            placeholder="24"
            value={refreshHours}
            onChange={(e) => setRefreshHours(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            The interval in hours after which the leaderboard stats will automatically recalculate. Default is 24 hours.
          </p>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default LeaderboardSettings;

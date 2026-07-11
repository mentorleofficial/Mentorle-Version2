import { formatISTDateTime } from "@/lib/datetime";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Send } from "lucide-react";
interface OutboundEvent {
  id: string;
  event_type: string;
  status: "pending" | "sent" | "failed";
  attempts: number;
  last_error: string;
  created_at: string;
  sent_at: string | null;
}

const EdubridgeSettings = () => {
  const { toast } = useToast();
  const [rowId, setRowId] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [refreshHours, setRefreshHours] = useState<string | number>(24);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [events, setEvents] = useState<OutboundEvent[]>([]);

  const load = async () => {
    try {
      const { data, error } = await supabase
        .from("branding")
        .select("id, edubridge_webhook_url, edubridge_enabled, leaderboard_refresh_hours")
        .limit(1).maybeSingle();

      if (error) {
        console.warn("Failed to load branding with leaderboard_refresh_hours, trying fallback:", error);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("branding")
          .select("id, edubridge_webhook_url, edubridge_enabled")
          .limit(1).maybeSingle();

        if (fallbackError) {
          console.error("Fallback load failed:", fallbackError);
          return;
        }

        if (fallbackData) {
          setRowId(fallbackData.id);
          setUrl((fallbackData as any).edubridge_webhook_url ?? "");
          setEnabled((fallbackData as any).edubridge_enabled ?? false);
          setRefreshHours(24);
        }
        return;
      }

      if (data) {
        setRowId(data.id);
        setUrl((data as any).edubridge_webhook_url ?? "");
        setEnabled((data as any).edubridge_enabled ?? false);
        setRefreshHours((data as any).leaderboard_refresh_hours ?? 24);
      }
    } catch (err) {
      console.error("Error loading settings:", err);
    }

    const { data: evs } = await supabase
      .from("outbound_events")
      .select("id, event_type, status, attempts, last_error, created_at, sent_at")
      .order("created_at", { ascending: false })
      .limit(25);
    setEvents((evs as OutboundEvent[]) ?? []);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!rowId) {
      toast({ variant: "destructive", title: "Save failed", description: "Settings not loaded yet." });
      return;
    }
    setSaving(true);
    const parsedHours = parseInt(String(refreshHours)) || 24;

    const { error } = await supabase
      .from("branding")
      .update({
        edubridge_webhook_url: url.trim(),
        edubridge_enabled: enabled,
        leaderboard_refresh_hours: parsedHours,
      })
      .eq("id", rowId);

    if (error) {
      console.warn("Failed to save with leaderboard_refresh_hours, trying fallback:", error);
      const { error: fallbackError } = await supabase
        .from("branding")
        .update({
          edubridge_webhook_url: url.trim(),
          edubridge_enabled: enabled,
        })
        .eq("id", rowId);

      setSaving(false);

      if (fallbackError) {
        toast({ variant: "destructive", title: "Save failed", description: fallbackError.message });
      } else {
        toast({
          title: "EduBridge settings saved",
          description: "Note: Leaderboard interval was not saved because the column does not exist in the database. Please run migrations.",
        });
      }
    } else {
      setSaving(false);
      toast({ title: "Settings saved successfully" });
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("sync-to-edubridge", { body: {} });
    setSyncing(false);
    if (error || data?.error) {
      toast({ variant: "destructive", title: "Sync failed", description: error?.message || data?.error });
    } else {
      toast({ title: "Sync complete", description: `Sent ${data?.sent ?? 0} · Failed ${data?.failed ?? 0}` });
      load();
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>EduBridge integration</CardTitle>
          <CardDescription>
            Forward session and mentor lifecycle events to your EduBridge webhook. Events are signed with HMAC-SHA256
            using the <code className="text-xs">EDUBRIDGE_WEBHOOK_SECRET</code> secret (optional).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <Input
              placeholder="https://edubridge.example.com/webhooks/mentorle"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label className="text-sm">Enable outbound sync</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                When off, events are still queued but not delivered.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={syncNow} disabled={syncing || !enabled || !url.trim()}>
              {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Sync now
            </Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader>
          <CardTitle>Recent outbound events</CardTitle>
          <CardDescription>Last 25 events queued for EduBridge.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No events yet</TableCell></TableRow>
              ) : events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.event_type}</TableCell>
                  <TableCell>
                    <Badge variant={e.status === "sent" ? "default" : e.status === "failed" ? "destructive" : "secondary"}>
                      {e.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{e.attempts}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{formatISTDateTime(e.created_at)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate" title={e.last_error}>
                    {e.last_error || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default EdubridgeSettings;

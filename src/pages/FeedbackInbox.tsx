import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Star, Send, Filter } from "lucide-react";
import { formatISTDateTime } from "@/lib/datetime";
import { toast } from "sonner";

type Audience = "mentor" | "mentee";

interface Row {
  id: string;
  rating: number;
  comment: string | null;
  audience: Audience;
  created_at: string;
  response: string | null;
  responded_at: string | null;
  session: {
    id: string;
    scheduled_at: string;
    title: string | null;
    mentor_id: string;
    mentee_id: string;
  } | null;
  submitter: { id: string; full_name: string; avatar_url: string | null } | null;
}

const Stars = ({ n, size = "h-4 w-4" }: { n: number; size?: string }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => (
      <Star key={s} className={`${size} ${s <= n ? "fill-yellow-500 text-yellow-500" : "text-border"}`} />
    ))}
  </div>
);

interface SurveyResponseItem {
  question: string;
  answer: string;
}

const parseSurveyText = (text: string): SurveyResponseItem[] | null => {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const items: SurveyResponseItem[] = [];

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx !== -1) {
      const question = line.substring(0, colonIdx).trim();
      const answer = line.substring(colonIdx + 1).trim();
      items.push({ question, answer });
    }
  }

  return items.length > 0 ? items : null;
};

const parseComment = (comment: string | null) => {
  if (!comment) return { userComment: "", surveyItems: null };

  const delimiter = "---\nSurvey Responses:\n";
  const delimiterIndex = comment.indexOf(delimiter);

  if (delimiterIndex !== -1) {
    const userComment = comment.substring(0, delimiterIndex).trim();
    const surveyText = comment.substring(delimiterIndex + delimiter.length);
    return { userComment, surveyItems: parseSurveyText(surveyText) };
  }

  if (comment.startsWith("Survey Responses:\n")) {
    const surveyText = comment.replace("Survey Responses:\n", "");
    return { userComment: "", surveyItems: parseSurveyText(surveyText) };
  }

  return { userComment: comment, surveyItems: null };
};

const FeedbackInbox = () => {
  const { profile } = useAuth();
  const role = profile?.role;
  const audience: Audience | null = role === "mentor" ? "mentor" : role === "mentee" ? "mentee" : null;

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"all" | "needs" | "responded">("all");
  const [respondTo, setRespondTo] = useState<Row | null>(null);
  const [responseText, setResponseText] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<{ submitterName: string; items: SurveyResponseItem[] } | null>(null);

  useEffect(() => {
    if (!profile?.id || !audience) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("feedback")
        .select(
          "id, rating, comment, audience, created_at, response, responded_at, session:sessions!feedback_session_id_fkey(id, scheduled_at, title, mentor_id, mentee_id), submitter:users!feedback_submitted_by_fkey(id, full_name, avatar_url)"
        )
        .eq("audience", audience)
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      const filtered = ((data as any[]) || []).filter((r) =>
        audience === "mentor" ? r.session?.mentor_id === profile.id : r.session?.mentee_id === profile.id
      );
      setRows(filtered as Row[]);
      setLoading(false);
    })();
  }, [profile?.id, audience]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (status === "needs" && r.response) return false;
      if (status === "responded" && !r.response) return false;
      return true;
    });
  }, [rows, status]);

  const stats = useMemo(() => {
    const total = rows.length;
    const responded = rows.filter((r) => r.response).length;
    const needs = total - responded;
    const avg = total ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / total) * 10) / 10 : 0;
    return { total, responded, needs, avg };
  }, [rows]);

  const openRespond = (r: Row) => {
    setRespondTo(r);
    setResponseText(r.response || "");
  };

  const submitResponse = async () => {
    if (!respondTo) return;
    const text = responseText.trim();
    if (!text) return;
    setSaving(true);
    const { error } = await supabase
      .from("feedback")
      .update({ response: text, responded_at: new Date().toISOString() })
      .eq("id", respondTo.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Response sent");
    setRows((rs) =>
      rs.map((r) =>
        r.id === respondTo.id ? { ...r, response: text, responded_at: new Date().toISOString() } : r
      )
    );
    setRespondTo(null);
    setResponseText("");
  };

  if (!audience) {
    return (
      <AppLayout>
        <p className="text-muted-foreground">Feedback inbox is only available for mentors and mentees.</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-7 w-7" /> Feedback Inbox
          </h1>
          <p className="text-muted-foreground text-sm">View and respond to feedback on your sessions</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Feedback</CardTitle></CardHeader>
            <CardContent><span className="text-3xl font-bold">{stats.total}</span></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Needs Response</CardTitle></CardHeader>
            <CardContent><span className="text-3xl font-bold text-accent">{stats.needs}</span></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Responded</CardTitle></CardHeader>
            <CardContent><span className="text-3xl font-bold text-primary">{stats.responded}</span></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Average Rating</CardTitle></CardHeader>
            <CardContent><span className="text-3xl font-bold">{stats.avg || "—"}</span></CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="needs">Needs Response</SelectItem>
              <SelectItem value="responded">Responded</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">No feedback yet.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => {
              const initials = r.submitter?.full_name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";
              const responded = !!r.response;
              const { userComment, surveyItems } = parseComment(r.comment);

              return (
                <Card key={r.id} className={`border-l-4 ${responded ? "border-l-primary" : "border-l-accent"}`}>
                  <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      <div className="flex-1 min-w-0 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">Session</Badge>
                          {responded ? (
                            <Badge className="bg-primary/10 text-primary border-primary/20">Responded</Badge>
                          ) : (
                            <Badge className="bg-accent/15 text-accent-foreground border-accent/30">Needs Response</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={r.submitter?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm">{r.submitter?.full_name || "—"}</div>
                            <div className="text-xs text-muted-foreground">
                              {r.session ? formatISTDateTime(r.session.scheduled_at) : formatISTDateTime(r.created_at)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Stars n={r.rating} />
                          <span className="text-xs text-muted-foreground">{r.rating}/5</span>
                        </div>
                        {userComment ? (
                          <div className="rounded-md bg-muted/40 p-3 text-sm whitespace-pre-wrap">{userComment}</div>
                        ) : surveyItems ? (
                          <div className="text-xs text-muted-foreground italic">No text comment submitted. Click "View Survey" to see ratings.</div>
                        ) : null}
                        {r.response && (
                          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
                            <div className="text-xs font-medium text-primary mb-1">Your response</div>
                            <div className="whitespace-pre-wrap">{r.response}</div>
                            {r.responded_at && (
                              <div className="text-xs text-muted-foreground mt-1">{formatISTDateTime(r.responded_at)}</div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="sm:w-40 shrink-0 space-y-2">
                        {surveyItems && (
                          <Button
                            variant="outline"
                            className="w-full flex items-center justify-center gap-2 border-yellow-500/30 hover:border-yellow-500 hover:bg-yellow-500/5"
                            onClick={() => setSelectedSurvey({ submitterName: r.submitter?.full_name || "Mentee", items: surveyItems })}
                          >
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                            View Survey
                          </Button>
                        )}
                        <Button variant="outline" className="w-full" onClick={() => openRespond(r)}>
                          <Send className="h-4 w-4 mr-2" />
                          {responded ? "Edit Response" : "Respond"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={!!respondTo} onOpenChange={(o) => !o && setRespondTo(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Respond to feedback</DialogTitle>
              <DialogDescription>
                Your response will be visible to {respondTo?.submitter?.full_name || "the submitter"} and to admins.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              rows={5}
              maxLength={1000}
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              placeholder="Write your response…"
            />
            <p className="text-xs text-muted-foreground">{responseText.length}/1000 characters</p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRespondTo(null)}>Cancel</Button>
              <Button onClick={submitResponse} disabled={saving || !responseText.trim()}>
                {saving ? "Sending…" : "Send Response"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedSurvey} onOpenChange={(o) => !o && setSelectedSurvey(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Survey Details</DialogTitle>
              <DialogDescription>
                Detailed survey responses from <strong>{selectedSurvey?.submitterName}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              {selectedSurvey?.items.map((item, idx) => {
                const starMatch = item.answer.match(/^(\d)\s*\/\s*5\s*stars$/);
                const starRating = starMatch ? parseInt(starMatch[1], 10) : null;

                return (
                  <div key={idx} className="space-y-1.5 border-b pb-3 last:border-0 last:pb-0">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {item.question}
                    </div>
                    {starRating !== null ? (
                      <div className="flex items-center gap-2">
                        <Stars n={starRating} size="h-5 w-5" />
                        <span className="text-sm font-semibold text-foreground">{starRating} / 5</span>
                      </div>
                    ) : (
                      <div className="text-sm font-semibold text-foreground bg-muted/40 px-3 py-1.5 rounded-lg inline-block">
                        {item.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <DialogFooter>
              <Button onClick={() => setSelectedSurvey(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default FeedbackInbox;

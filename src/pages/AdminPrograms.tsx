import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, ArrowRight, Calendar, Users } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Program = Database["public"]["Tables"]["programs"]["Row"];

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "") || "program";

const AdminPrograms = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [counts, setCounts] = useState<Record<string, { mentors: number; mentees: number }>>({});
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", status: "draft" as "draft" | "active" | "archived",
    starts_on: "", ends_on: "", capacity: "",
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("programs").select("*").order("created_at", { ascending: false });
    setPrograms(data || []);
    if (data?.length) {
      const ids = data.map((p) => p.id);
      const { data: countRows } = await supabase
        .rpc("get_program_member_counts", { program_ids: ids });
      const c: Record<string, { mentors: number; mentees: number }> = {};
      ids.forEach((id) => (c[id] = { mentors: 0, mentees: 0 }));
      (countRows as any[] || []).forEach((r: any) => {
        c[r.program_id] = { mentors: Number(r.mentor_count) || 0, mentees: Number(r.mentee_count) || 0 };
      });
      setCounts(c);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return programs;
    const q = query.toLowerCase();
    return programs.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  }, [programs, query]);

  const create = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const slug = slugify(form.name) + "-" + Math.random().toString(36).slice(2, 6);
    const { error } = await supabase.from("programs").insert({
      name: form.name.trim(),
      slug,
      description: form.description,
      status: form.status,
      starts_on: form.starts_on || null,
      ends_on: form.ends_on || null,
      capacity: form.capacity ? Number(form.capacity) : null,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: "Create failed", description: error.message });
      return;
    }
    toast({ title: "Program created" });
    setOpen(false);
    setForm({ name: "", description: "", status: "draft", starts_on: "", ends_on: "", capacity: "" });
    load();
  };

  const statusVariant = (s: string) => s === "active" ? "default" : s === "draft" ? "secondary" : "outline";

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Programs</h1>
            <p className="text-muted-foreground mt-1">Cohorts and tracks. Map mentors to mentees inside each program.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New program</Button>
            </DialogTrigger>
            <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
              <DialogHeader><DialogTitle>Create program</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Spring 2026 Engineering Cohort" />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Starts on</Label>
                    <Input type="date" value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ends on</Label>
                    <Input type="date" value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Capacity</Label>
                    <Input type="number" min={0} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={create} disabled={saving || !form.name.trim()}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search programs…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No programs yet. Create one to get started.</CardContent></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((p) => (
              <Card key={p.id} className="hover:border-primary/40 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg leading-tight">{p.name}</CardTitle>
                    <Badge variant={statusVariant(p.status) as any} className="capitalize">{p.status}</Badge>
                  </div>
                  {p.description && <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{p.description}</p>}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {(p.starts_on || p.ends_on) && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {p.starts_on || "—"} → {p.ends_on || "—"}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {counts[p.id]?.mentors ?? 0} mentors · {counts[p.id]?.mentees ?? 0} mentees
                      {p.capacity ? ` / ${p.capacity}` : ""}
                    </span>
                  </div>
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <Link to={`/admin/programs/${p.slug}`}>Open mapping board <ArrowRight className="h-4 w-4 ml-2" /></Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminPrograms;

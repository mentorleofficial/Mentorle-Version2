import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus,
  Edit2,
  Trash2,
  Clock,
  Coins,
  Tag,
  Loader2,
  Play,
  Pause,
  Archive,
  MoreVertical,
  Users,
} from "lucide-react";

export interface MentorshipOffering {
  id: string;
  mentor_id: string;
  title: string;
  description: string | null;
  category: string;
  price: number;
  currency: string;
  duration_minutes: number;
  status: string;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  "General Mentorship",
  "Resume Review",
  "Portfolio Review",
  "Career Guidance",
  "Mock Interview",
  "Code Review",
  "Project Guidance",
  "Other",
];

const MentorOfferings = () => {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOffering, setSelectedOffering] = useState<MentorshipOffering | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("30");
  const [price, setPrice] = useState("0");
  const [status, setStatus] = useState("draft");
  const [category, setCategory] = useState("General Mentorship");

  const { data: offerings = [], isLoading } = useQuery<MentorshipOffering[]>({
    queryKey: ["mentor", "offerings", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentorship_offerings")
        .select("*")
        .eq("mentor_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as MentorshipOffering[]) ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (
      payload: Omit<MentorshipOffering, "id" | "mentor_id" | "created_at" | "updated_at"> & { id?: string }
    ) => {
      if (payload.id) {
        const { error } = await supabase
          .from("mentorship_offerings")
          .update({
            title: payload.title,
            description: payload.description,
            duration_minutes: payload.duration_minutes,
            price: payload.price,
            status: payload.status,
            category: payload.category,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("mentorship_offerings")
          .insert({
            mentor_id: user!.id,
            title: payload.title,
            description: payload.description,
            duration_minutes: payload.duration_minutes,
            price: payload.price,
            status: payload.status,
            category: payload.category,
          });
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["mentor", "offerings", user?.id] });
      qc.invalidateQueries({ queryKey: ["mentor-profile", user?.id] });
      await refreshProfile();
      toast({ title: selectedOffering ? "Offering updated" : "Offering created successfully" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Failed to save offering", description: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mentorship_offerings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["mentor", "offerings", user?.id] });
      qc.invalidateQueries({ queryKey: ["mentor-profile", user?.id] });
      await refreshProfile();
      toast({ title: "Offering deleted successfully" });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Failed to delete offering", description: err.message });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("mentorship_offerings")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["mentor", "offerings", user?.id] });
      qc.invalidateQueries({ queryKey: ["mentor-profile", user?.id] });
      await refreshProfile();
      toast({ title: "Status updated successfully" });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Failed to update status", description: err.message });
    },
  });

  const resetForm = () => {
    setSelectedOffering(null);
    setTitle("");
    setDescription("");
    setDuration("30");
    setPrice("0");
    setStatus("draft");
    setCategory("General Mentorship");
  };

  const handleEdit = (o: MentorshipOffering) => {
    setSelectedOffering(o);
    setTitle(o.title);
    setDescription(o.description ?? "");
    setDuration(String(o.duration_minutes));
    setPrice(String(o.price));
    setStatus(o.status);
    setCategory(CATEGORIES.includes(o.category) ? o.category : "Other");
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ variant: "destructive", title: "Title is required" });
      return;
    }
    saveMutation.mutate({
      id: selectedOffering?.id,
      title: title.trim(),
      description: description.trim() || null,
      duration_minutes: Number(duration),
      price: Number(price),
      status,
      category,
      currency: "INR",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-emerald-500/15 hover:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/35">
            Active
          </Badge>
        );
      case "paused":
        return (
          <Badge className="bg-amber-500/15 hover:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/35">
            Paused
          </Badge>
        );
      case "archived":
        return (
          <Badge className="bg-destructive/15 hover:bg-destructive/15 text-destructive border border-destructive/35">
            Archived
          </Badge>
        );
      default:
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        {/* Page Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Offerings & Services</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage the mentorship sessions you offer. Mentees book sessions under these specific offerings.
            </p>
          </div>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Offering
          </Button>
        </div>

        {/* Loading */}
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-12">
            <Loader2 className="h-6 w-6 animate-spin" /> Loading offerings…
          </div>
        ) : offerings.length === 0 ? (
          /* Empty State */
          <Card className="border-dashed p-12 text-center flex flex-col items-center justify-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Tag className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-lg">No offerings created yet</CardTitle>
            <CardDescription className="max-w-md mt-1 mb-6">
              Create at least one offering (like a 30-minute Career Guidance session) to complete your profile and start accepting bookings.
            </CardDescription>
            <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Create Your First Offering
            </Button>
          </Card>
        ) : (
          /* Cards Grid */
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {offerings.map((o) => (
              <Card
                key={o.id}
                className="group flex flex-col justify-between border bg-card hover:shadow-md transition-all duration-200 hover:border-border/80"
              >
                {/* Card Header */}
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base font-semibold leading-snug tracking-tight line-clamp-2 flex-1">
                      {o.title}
                    </CardTitle>

                    {/* Status + Three-dot menu */}
                    <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
                      {getStatusBadge(o.status)}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                            aria-label="More actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {/* Edit */}


                          <DropdownMenuSeparator />

                          {/* Pause / Activate */}
                          {o.status === "active" ? (
                            <DropdownMenuItem
                              onClick={() => updateStatusMutation.mutate({ id: o.id, status: "paused" })}
                            >
                              <Pause className="h-4 w-4 mr-2" />
                              Pause offering
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => updateStatusMutation.mutate({ id: o.id, status: "active" })}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Set as active
                            </DropdownMenuItem>
                          )}

                          {/* Archive */}
                          {o.status !== "archived" && (
                            <DropdownMenuItem
                              onClick={() => updateStatusMutation.mutate({ id: o.id, status: "archived" })}
                            >
                              <Archive className="h-4 w-4 mr-2" />
                              Archive
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuSeparator />

                          {/* Delete */}
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive focus:bg-destructive/10"
                            onClick={() => {
                              if (confirm("Delete this offering? This cannot be undone.")) {
                                deleteMutation.mutate(o.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Description */}
                  {o.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed mt-1">
                      {o.description}
                    </p>
                  )}
                </CardHeader>

                {/* Card Content */}
                <CardContent className="pt-0">
                  {/* Meta row: duration, price, category */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground py-3 border-t border-b mb-4">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="font-medium text-foreground">{o.duration_minutes} min</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Coins className="h-3.5 w-3.5" />
                      <span className="font-semibold text-foreground">
                        {o.price === 0 ? "Free" : `₹${o.price.toLocaleString("en-IN")}`}
                      </span>
                    </div>
                    <div className="ml-auto">
                      <span className="inline-flex items-center gap-1 text-xs bg-muted text-muted-foreground rounded-full px-2.5 py-0.5">
                        <Tag className="h-3 w-3" />
                        {o.category}
                      </span>
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 font-medium"
                      onClick={() => handleEdit(o)}
                    >
                      <Edit2 className="h-3.5 w-3.5 mr-2" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 font-medium"
                      onClick={() => navigate(`/mentor/offerings/${o.id}/bookings`)}
                    >
                      <Users className="h-3.5 w-3.5 mr-2" />
                      View bookings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create / Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[600px] max-h-[90vh] flex flex-col">
            <DialogHeader className="shrink-0">
              <DialogTitle>{selectedOffering ? "Edit Offering" : "Add Offering"}</DialogTitle>
              <DialogDescription>
                Fill in the details for this session offering. Offerings represent different services mentees can book.
              </DialogDescription>
            </DialogHeader>

            <form id="offering-form" onSubmit={handleSubmit} className="space-y-4 py-2 overflow-y-auto flex-1 pr-1">
              <div className="space-y-1.5">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g. 1-on-1 Mock Interview"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <MarkdownEditor
                  value={description}
                  onChange={setDescription}
                  placeholder="Describe what this session covers, how you will help, and what the mentee should prepare..."
                  rows={4}
                />
                <p className="text-xs text-right text-muted-foreground">{description.length}/1000</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="duration">Duration *</Label>
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger id="duration">
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">60 minutes</SelectItem>
                      <SelectItem value="90">90 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="price">Price (INR) *</Label>
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    placeholder="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="category">Category *</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="status">Status *</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </form>

            <DialogFooter className="shrink-0 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" form="offering-form" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>
                ) : (
                  "Save Offering"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default MentorOfferings;
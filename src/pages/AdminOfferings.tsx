import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Search,
  Filter,
  RefreshCw,
  Play,
  Pause,
  Eye,
  EyeOff,
  Loader2,
  Tag,
} from "lucide-react";

export interface AdminOfferingRow {
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
  mentor?: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  } | null;
  bookings?: {
    count: number;
  }[];
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

const AdminOfferings = () => {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: offerings = [], isLoading, refetch, isFetching } = useQuery<AdminOfferingRow[]>({
    queryKey: ["admin", "offerings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentorship_offerings")
        .select(`
          *,
          mentor:users!mentorship_offerings_mentor_id_fkey(full_name, email, avatar_url),
          bookings:sessions!sessions_offering_id_fkey(count)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as any) ?? [];
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, category }: { id: string; category: string }) => {
      const { error } = await supabase
        .from("mentorship_offerings")
        .update({ category, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "offerings"] });
      toast({
        title: "Category updated",
        description: "The mentorship offering category has been updated successfully.",
      });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Failed to update category",
        description: err.message,
      });
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
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["admin", "offerings"] });
      toast({
        title: "Status updated",
        description: `Offering status has been changed to '${variables.status}' successfully.`,
      });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Failed to update status",
        description: err.message,
      });
    },
  });

  const handleStatusToggle = (offering: AdminOfferingRow) => {
    const newStatus = offering.status === "active" ? "paused" : "active";
    updateStatusMutation.mutate({ id: offering.id, status: newStatus });
  };

  const handleHideToggle = (offering: AdminOfferingRow) => {
    if (offering.status !== "archived") {
      if (!confirm("Hide this offering from all mentee listings?")) return;
      updateStatusMutation.mutate({ id: offering.id, status: "archived" });
    } else {
      updateStatusMutation.mutate({ id: offering.id, status: "active" });
    }
  };

  // Compile list of unique categories actually present in offerings for filter selection
  const dynamicCategories = useMemo(() => {
    const set = new Set(CATEGORIES);
    offerings.forEach((o) => {
      if (o.category) set.add(o.category);
    });
    return Array.from(set);
  }, [offerings]);

  const filteredOfferings = useMemo(() => {
    return offerings.filter((offering) => {
      // Status filter
      if (statusFilter !== "all" && offering.status !== statusFilter) {
        return false;
      }
      // Category filter
      if (categoryFilter !== "all" && offering.category !== categoryFilter) {
        return false;
      }
      // Text search (title or mentor name)
      if (searchTerm.trim() !== "") {
        const query = searchTerm.toLowerCase();
        const titleMatch = offering.title?.toLowerCase().includes(query);
        const mentorName = offering.mentor?.full_name || "";
        const mentorMatch = mentorName.toLowerCase().includes(query);
        return titleMatch || mentorMatch;
      }
      return true;
    });
  }, [offerings, statusFilter, categoryFilter, searchTerm]);

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

  const formatPrice = (offering: AdminOfferingRow) => {
    if (offering.price === 0) return "Free";
    const amount = Number(offering.price).toFixed(2);
    return `${offering.currency || "INR"} ${amount}`;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Mentorship Listings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              View and moderate all mentorship offerings and their performance.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading || isFetching}
            className="flex items-center gap-2"
          >
            {isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>

        {/* Filters Panel */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span>Filters</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              {/* Search Bar */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Search (title or mentor)
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search offerings..."
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Status
                </label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Category Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Category
                </label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {dynamicCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Showing stats info */}
              <div className="text-sm text-muted-foreground py-2 md:text-right">
                Showing <span className="font-semibold text-foreground">{filteredOfferings.length}</span> of{" "}
                <span className="font-semibold text-foreground">{offerings.length}</span> offerings
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Listings Table */}
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Title</TableHead>
                  <TableHead>Mentor</TableHead>
                  <TableHead className="min-w-[180px]">Category</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Bookings</TableHead>
                  <TableHead className="text-right w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Loading mentorship offerings...
                    </TableCell>
                  </TableRow>
                ) : filteredOfferings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      No offerings found matching current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOfferings.map((offering) => {
                    const bookingsCount = offering.bookings?.[0]?.count ?? 0;
                    return (
                      <TableRow key={offering.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell>
                          <div className="font-medium line-clamp-2" title={offering.title}>
                            {offering.title}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-foreground">
                            {offering.mentor?.full_name || "Unknown"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {offering.mentor?.email || ""}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={offering.category || ""}
                            onValueChange={(val) =>
                              updateCategoryMutation.mutate({ id: offering.id, category: val })
                            }
                            disabled={updateCategoryMutation.isPending}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Uncategorized" />
                            </SelectTrigger>
                            <SelectContent>
                              {dynamicCategories.map((cat) => (
                                <SelectItem key={cat} value={cat} className="text-xs">
                                  {cat}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {offering.duration_minutes} min
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          {formatPrice(offering)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(offering.status)}
                        </TableCell>
                        <TableCell className="text-muted-foreground font-semibold">
                          {bookingsCount}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Start/Pause Action */}
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 transition-all"
                              onClick={() => handleStatusToggle(offering)}
                              disabled={updateStatusMutation.isPending}
                              title={offering.status === "active" ? "Pause offering" : "Activate offering"}
                            >
                              {offering.status === "active" ? (
                                <Pause className="h-4 w-4" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>

                            {/* Hide/Unhide Action */}
                            <Button
                              variant="outline"
                              size="icon"
                              className={`h-8 w-8 transition-all ${
                                offering.status === "archived"
                                  ? "text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                                  : "text-destructive border-destructive/20 hover:bg-destructive/10"
                              }`}
                              onClick={() => handleHideToggle(offering)}
                              disabled={updateStatusMutation.isPending}
                              title={offering.status === "archived" ? "Unhide offering" : "Hide offering"}
                            >
                              {offering.status === "archived" ? (
                                <Eye className="h-4 w-4" />
                              ) : (
                                <EyeOff className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminOfferings;

import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMyPrograms } from "@/features/programs/hooks/useMyPrograms";
import { useMentorMentees, type MentorMenteeRow } from "@/features/mentor-mentees/useMentorMentees";
import { MenteeDetailsDialog } from "@/features/mentor-mentees/components/MenteeDetailsDialog";
import { Search, Users } from "lucide-react";

const initials = (name: string) =>
  name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

const MentorMentees = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const { data: rows = [], isLoading } = useMentorMentees(user?.id);
  const { data: myPrograms = [] } = useMyPrograms();

  const [selectedMenteeId, setSelectedMenteeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const programFilter = params.get("program") || "all";

  // Filter by program and search
  const filteredRows = useMemo(() => {
    let result = rows;

    // Program filter
    if (programFilter !== "all") {
      result = result.filter((r) => r.program.slug === programFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((r) =>
        r.mentee.full_name?.toLowerCase().includes(q) ||
        r.mentee.email?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [rows, programFilter, searchQuery]);

  const byProgram = useMemo(() => {
    return filteredRows.reduce<Record<string, MentorMenteeRow[]>>((acc, r) => {
      (acc[r.program.id] ||= []).push(r);
      return acc;
    }, {});
  }, [filteredRows]);

  const setFilter = (val: string) => {
    const next = new URLSearchParams(params);
    if (val === "all") next.delete("program");
    else next.set("program", val);
    setParams(next, { replace: true });
  };

  const totalMentees = filteredRows.length;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">My Mentees</h1>
                <p className="text-muted-foreground mt-1">
                  Manage and connect with all your mentees
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search mentees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Program Filter */}
            {myPrograms.length > 0 && (
              <Select value={programFilter} onValueChange={setFilter}>
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue placeholder="Filter by program" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  {myPrograms.map((p) => (
                    <SelectItem key={p.id} value={p.slug}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Stats */}
        {!isLoading && totalMentees > 0 && (
          <div className="text-sm text-muted-foreground">
            Showing {totalMentees} mentee{totalMentees !== 1 ? "s" : ""}
            {programFilter !== "all" && " in this program"}
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading your mentees...
            </CardContent>
          </Card>
        ) : filteredRows.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No mentees found</h3>
              <p className="text-muted-foreground mt-2">
                {searchQuery
                  ? "No matches for your search."
                  : programFilter !== "all"
                    ? "No mentees enrolled in this program yet."
                    : "You don't have any mentees enrolled yet."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {Object.values(byProgram).map((group) => {
              const program = group[0].program;
              return (
                <Card key={program.id} className="overflow-hidden">
                  <CardHeader className="pb-4 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl">{program.name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {group.length} mentee{group.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <Badge variant="secondary" className="capitalize">
                        {program.status}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-0">
                    <div className="divide-y">
                      {group.map((r) => (
                        <div
                          key={r.key}
                          className="flex items-center gap-4 p-5 hover:bg-muted/50 transition-colors group"
                        >
                          <Avatar className="h-11 w-11 border">
                            <AvatarImage src={r.mentee.avatar_url ?? undefined} alt={r.mentee.full_name ?? "Mentee"} />
                            <AvatarFallback className="bg-muted text-sm">
                              {initials(r.mentee.full_name)}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{r.mentee.full_name}</p>
                            <p className="text-sm text-muted-foreground truncate">
                              {r.mentee.email}
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            {r.assigned && (
                              <Badge variant="default" className="text-xs">
                                1:1 Assigned
                              </Badge>
                            )}

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedMenteeId(r.mentee.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              View Details
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <MenteeDetailsDialog
        menteeId={selectedMenteeId}
        open={!!selectedMenteeId}
        onOpenChange={(open) => {
          if (!open) setSelectedMenteeId(null);
        }}
      />
    </AppLayout>
  );
};

export default MentorMentees;
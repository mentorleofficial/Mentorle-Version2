import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Mail, Phone } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import RefreshButton from "@/components/RefreshButton";
import TablePagination from "@/components/TablePagination";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

// Admin → Speaker requests: organisers asking for a speaker from mentorle.in's /speaker-hub/request
// (submit_speaker_request notifies admins). Newest first; admins track each one as new → contacted → closed.

// The table isn't in the generated types yet.
const db = supabase as unknown as SupabaseClient;
const PER_PAGE = 20;

type SpeakerRequest = {
  id: string;
  speaker_name: string | null;
  name: string;
  email: string;
  phone: string | null;
  organization: string;
  event_name: string;
  event_type: string;
  event_date: string | null;
  audience_size: string;
  format: string;
  city: string | null;
  message: string | null;
  status: "new" | "contacted" | "closed";
  created_at: string;
};

const EVENT_TYPES: Record<string, string> = {
  conference: "Conference",
  university: "University / college",
  corporate: "Corporate / offsite",
  workshop: "Workshop",
  webinar: "Webinar",
  other: "Other",
};
const AUDIENCE: Record<string, string> = { under_50: "Under 50", "50_200": "50–200", "200_500": "200–500", "500_plus": "500+" };
const FORMATS: Record<string, string> = { in_person: "In person", online: "Online", hybrid: "Hybrid" };
const STATUSES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "closed", label: "Closed" },
] as const;

const AdminSpeakerRequests = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | SpeakerRequest["status"]>("all");
  const [page, setPage] = useState(0);

  const { data: rows = [], isFetching, refetch } = useQuery<SpeakerRequest[]>({
    queryKey: ["admin", "speaker-requests"],
    queryFn: async () => {
      const { data, error } = await db.from("speaker_requests").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SpeakerRequest[];
    },
  });

  const setStatus = async (row: SpeakerRequest, status: SpeakerRequest["status"]) => {
    const { error } = await db.from("speaker_requests").update({ status, updated_at: new Date().toISOString() }).eq("id", row.id);
    if (error) toast({ title: "Couldn't update the request", description: error.message, variant: "destructive" });
    void queryClient.invalidateQueries({ queryKey: ["admin", "speaker-requests"] });
  };

  const shown = filter === "all" ? rows : rows.filter((row) => row.status === filter);
  const totalPages = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = shown.slice(safePage * PER_PAGE, (safePage + 1) * PER_PAGE);
  const newCount = rows.filter((row) => row.status === "new").length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl">Speaker requests</h1>
            <p className="mt-1 text-sm text-muted-foreground">Organisers asking for a speaker from mentorle.in's Speaker Hub.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={filter}
              onValueChange={(value) => {
                setFilter(value as typeof filter);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ({rows.length})</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label} ({rows.filter((row) => row.status === s.value).length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <RefreshButton onClick={() => refetch()} spinning={isFetching} />
          </div>
        </div>

        {newCount > 0 && <p className="text-sm font-medium">{newCount === 1 ? "1 new request" : `${newCount} new requests`}</p>}

        {paged.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">{rows.length ? "No requests with this status." : "No speaker requests yet."}</CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {paged.map((row) => (
              <Card key={row.id} className={row.status === "new" ? "border-primary/40" : undefined}>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                  <div className="min-w-0">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                      {row.event_name}
                      {row.status === "new" && <Badge>New</Badge>}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {row.organization} · asked for <span className="font-medium text-foreground">{row.speaker_name ?? "any speaker"}</span> · {format(new Date(row.created_at), "d MMM yyyy, h:mm a")}
                    </CardDescription>
                  </div>
                  <Select value={row.status} onValueChange={(value) => void setStatus(row, value as SpeakerRequest["status"])}>
                    <SelectTrigger className="w-36" aria-label={`Status of ${row.event_name}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardHeader>
                <CardContent className="grid gap-4 text-sm md:grid-cols-[1fr_1fr]">
                  <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1.5">
                    <dt className="text-muted-foreground">Contact</dt>
                    <dd className="font-medium">{row.name}</dd>
                    <dt className="text-muted-foreground">Email</dt>
                    <dd>
                      <a href={`mailto:${row.email}`} className="inline-flex items-center gap-1.5 underline underline-offset-2">
                        <Mail className="h-3.5 w-3.5" /> {row.email}
                      </a>
                    </dd>
                    <dt className="text-muted-foreground">Phone</dt>
                    <dd>
                      {row.phone ? (
                        <a href={`tel:${row.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 underline underline-offset-2">
                          <Phone className="h-3.5 w-3.5" /> {row.phone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </dl>
                  <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1.5">
                    <dt className="text-muted-foreground">Event</dt>
                    <dd>{EVENT_TYPES[row.event_type] ?? row.event_type}</dd>
                    <dt className="text-muted-foreground">Date</dt>
                    <dd>{row.event_date ? format(new Date(`${row.event_date}T00:00:00`), "d MMM yyyy") : "Not decided"}</dd>
                    <dt className="text-muted-foreground">Audience</dt>
                    <dd>{AUDIENCE[row.audience_size] ?? row.audience_size}</dd>
                    <dt className="text-muted-foreground">Format</dt>
                    <dd>
                      {FORMATS[row.format] ?? row.format}
                      {row.city ? ` · ${row.city}` : ""}
                    </dd>
                  </dl>
                  {row.message && <p className="whitespace-pre-line rounded-md bg-muted/40 p-3 md:col-span-2">{row.message}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <TablePagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </AppLayout>
  );
};

export default AdminSpeakerRequests;

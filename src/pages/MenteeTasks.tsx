import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useMenteeTasks, type MenteeTaskRow } from "@/features/action-items/useMenteeTasks";
import { useToggleActionItem } from "@/features/action-items/useActionItems";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ListTodo,
  CheckCircle2,
  AlertCircle,
  Clock,
  CalendarDays,
  Paperclip,
  ExternalLink,
  Download,
  FileText,
  Image as ImageIcon,
  FolderArchive,
  Code2,
  File as FileIcon,
} from "lucide-react";
import { formatISTDate, formatISTDateTime } from "@/lib/datetime";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Filter = "all" | "open" | "done" | "overdue";

const getFileIcon = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(ext)) return <ImageIcon className="h-3.5 w-3.5 text-blue-500" />;
  if (ext === "pdf") return <FileText className="h-3.5 w-3.5 text-red-500" />;
  if (["zip", "rar", "tar", "gz", "7z"].includes(ext)) return <FolderArchive className="h-3.5 w-3.5 text-amber-500" />;
  if (["js", "ts", "jsx", "tsx", "html", "css", "json", "py", "go", "cpp", "c", "sh"].includes(ext)) return <Code2 className="h-3.5 w-3.5 text-emerald-500" />;
  return <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />;
};

const isOverdue = (t: MenteeTaskRow) =>
  t.status === "open" && t.due_date && new Date(t.due_date) < new Date(new Date().toDateString());

export default function MenteeTasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: tasks = [], isLoading } = useMenteeTasks(user?.id);
  const toggle = useToggleActionItem();
  const [filter, setFilter] = useState<Filter>("open");

  const counts = useMemo(() => {
    const open = tasks.filter((t) => t.status === "open").length;
    const done = tasks.filter((t) => t.status === "done").length;
    const overdue = tasks.filter(isOverdue).length;
    return { open, done, overdue, all: tasks.length };
  }, [tasks]);

  const filtered = useMemo(() => {
    const arr = tasks.filter((t) => {
      if (filter === "open") return t.status === "open";
      if (filter === "done") return t.status === "done";
      if (filter === "overdue") return isOverdue(t);
      return true;
    });
    return [...arr].sort((a, b) => {
      const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      if (ad !== bd) return ad - bd;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [tasks, filter]);

  const handleToggle = async (t: MenteeTaskRow) => {
    try {
      await toggle(t);
    } catch (e) {
      toast({ variant: "destructive", title: "Update failed", description: (e as Error).message });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div>
          <div className="flex items-center gap-2">
            <ListTodo className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">My Tasks</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Action items assigned by your mentors across all your sessions.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Open" value={counts.open} icon={Clock} tone="text-primary" />
          <StatCard label="Overdue" value={counts.overdue} icon={AlertCircle} tone="text-destructive" />
          <StatCard label="Done" value={counts.done} icon={CheckCircle2} tone="text-emerald-600" />
          <StatCard label="Total" value={counts.all} icon={ListTodo} tone="text-muted-foreground" />
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="open">Open ({counts.open})</TabsTrigger>
            <TabsTrigger value="overdue">Overdue ({counts.overdue})</TabsTrigger>
            <TabsTrigger value="done">Done ({counts.done})</TabsTrigger>
            <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-10 text-center">
            <ListTodo className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {filter === "all" ? "You have no tasks yet." : `No ${filter} tasks.`}
            </p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {filtered.map((t) => {
              const overdue = isOverdue(t);
              const mentorInitials = (t.mentor?.full_name ?? "?")
                .split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
              return (
                <li key={t.id}>
                  <Card className={cn(
                    "p-4 flex items-start gap-3 transition-shadow hover:shadow-md",
                    t.status === "done" && "bg-muted/40",
                    overdue && "border-destructive/40"
                  )}>
                    <Checkbox
                      checked={t.status === "done"}
                      onCheckedChange={() => handleToggle(t)}
                      className="mt-1"
                      aria-label="Mark complete"
                    />
                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <p className={cn(
                            "font-medium text-sm leading-snug",
                            t.status === "done" && "line-through text-muted-foreground"
                          )}>
                            {t.title}
                          </p>
                          <div className="flex items-center gap-2">
                            {t.status === "done" ? (
                              <Badge className="text-[10px] gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
                                <CheckCircle2 className="h-3 w-3" /> Done
                              </Badge>
                            ) : overdue ? (
                              <Badge variant="destructive" className="text-[10px] gap-1">
                                <AlertCircle className="h-3 w-3" /> Overdue
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] gap-1">
                                <Clock className="h-3 w-3" /> Open
                              </Badge>
                            )}
                            {t.due_date && (
                              <Badge variant="outline" className="text-[10px] gap-1">
                                <CalendarDays className="h-3 w-3" />
                                Due {formatISTDate(t.due_date)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {t.description && (
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap">{t.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 flex-wrap">
                        <Button
                          size="sm"
                          variant={t.status === "done" ? "outline" : "default"}
                          onClick={() => handleToggle(t)}
                          className="h-7 text-xs gap-1"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {t.status === "done" ? "Mark as open" : "Mark complete"}
                        </Button>
                        {t.status === "done" && t.completed_at && (
                          <span className="text-[10px] text-muted-foreground">
                            Completed {formatISTDateTime(t.completed_at)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3 flex-wrap text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={t.mentor?.avatar_url ?? undefined} />
                            <AvatarFallback className="text-[10px]">{mentorInitials}</AvatarFallback>
                          </Avatar>
                          <span className="text-muted-foreground truncate">
                            From <span className="font-medium text-foreground">{t.mentor?.full_name ?? "Mentor"}</span>
                          </span>
                          {t.session && (
                            <>
                              <span className="text-muted-foreground">·</span>
                              <button
                                onClick={() => navigate("/mentee/sessions")}
                                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 truncate"
                                title={t.session.title ?? "Session"}
                              >
                                <span className="truncate max-w-[180px]">{t.session.title ?? "Session"}</span>
                                {t.session.scheduled_at && (
                                  <span className="text-muted-foreground/70">
                                    ({formatISTDateTime(t.session.scheduled_at)})
                                  </span>
                                )}
                                <ExternalLink className="h-3 w-3 shrink-0" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {(t.mentor_attachments?.length || t.mentee_attachments?.length) ? (
                        <div className="pt-3 border-t space-y-2">
                          {t.mentor_attachments && t.mentor_attachments.length > 0 && (
                            <AttachmentList label="From mentor" items={t.mentor_attachments} />
                          )}
                          {t.mentee_attachments && t.mentee_attachments.length > 0 && (
                            <AttachmentList label="Your uploads" items={t.mentee_attachments} />
                          )}
                        </div>
                      ) : null}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppLayout>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: string }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <Icon className={cn("h-5 w-5", tone)} />
      <div>
        <div className="text-xl font-bold leading-none">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </div>
    </Card>
  );
}

function AttachmentList({ label, items }: { label: string; items: { name: string; url: string }[] }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase flex items-center gap-1">
        <Paperclip className="h-3 w-3" /> {label}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((att, i) => (
          <a
            key={i}
            href={att.url}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center justify-between gap-2 rounded-lg border bg-muted/30 hover:bg-muted/50 p-2 text-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-background border">
                {getFileIcon(att.name)}
              </div>
              <span className="font-medium truncate" title={att.name}>{att.name}</span>
            </div>
            <Download className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
          </a>
        ))}
      </div>
    </div>
  );
}

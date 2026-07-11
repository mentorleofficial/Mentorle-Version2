import { formatISTDate } from "@/lib/datetime";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, Users, UserCheck, Search, GraduationCap, UserCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchProgramBySlug,
  fetchProgramMentors,
  fetchProgramMentees,
  fetchProgramTags,
  fetchMyAssignedMentees,
  type Program,
  type ProgramTag,
  type ProgramMember,
} from "@/features/programs/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MenteeDetailsDialog } from "@/features/mentor-mentees/components/MenteeDetailsDialog";

const initials = (n: string) =>
  n.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";

const MenteeCard = ({
  mentee,
  badge,
  onClick,
}: {
  mentee: ProgramMember;
  badge?: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "group flex flex-col items-center rounded-xl border bg-card/50 p-5 text-center w-full transition-all",
      "hover:border-primary/40 hover:bg-card hover:shadow-sm cursor-pointer"
    )}
  >
    <Avatar className="h-14 w-14 border-2 border-background shadow-sm">
      <AvatarImage src={mentee.avatar_url ?? undefined} alt={mentee.full_name} />
      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
        {initials(mentee.full_name)}
      </AvatarFallback>
    </Avatar>
    <p className="mt-3 font-semibold text-sm leading-snug line-clamp-2 w-full">
      {mentee.full_name}
    </p>
    {badge && (
      <Badge variant="secondary" className="mt-2 text-[10px] font-medium">
        {badge}
      </Badge>
    )}
    <span className="mt-3 text-[11px] text-muted-foreground group-hover:text-primary transition-colors">
      View profile
    </span>
  </button>
);

const MentorCard = ({
  name,
  avatarUrl,
  subtitle,
}: {
  name: string;
  avatarUrl?: string | null;
  subtitle?: string;
}) => (
  <div className="flex flex-col items-center rounded-xl border bg-card/50 p-5 text-center">
    <Avatar className="h-14 w-14 border-2 border-background shadow-sm">
      <AvatarImage src={avatarUrl ?? undefined} alt={name} />
      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
    <p className="mt-3 font-semibold text-sm leading-snug line-clamp-2 w-full">{name}</p>
    {subtitle && (
      <p className="mt-1 text-xs text-muted-foreground line-clamp-2 w-full">{subtitle}</p>
    )}
  </div>
);

const EmptyState = ({ icon: Icon, message }: { icon: React.ElementType; message: string }) => (
  <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 py-14 text-center">
    <Icon className="h-9 w-9 text-muted-foreground/50 mx-auto mb-3" />
    <p className="text-sm text-muted-foreground">{message}</p>
  </div>
);

const MentorProgramDetail = () => {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [program, setProgram] = useState<Program | null>(null);
  const [coMentors, setCoMentors] = useState<ProgramMember[]>([]);
  const [myMentees, setMyMentees] = useState<ProgramMember[]>([]);
  const [allMentees, setAllMentees] = useState<ProgramMember[]>([]);
  const [tags, setTags] = useState<ProgramTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMenteeId, setSelectedMenteeId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      const p = await fetchProgramBySlug(slug);
      setProgram(p);
      if (p) {
        const [m, t, mm, am] = await Promise.all([
          fetchProgramMentors(p.id),
          fetchProgramTags(p.id),
          fetchMyAssignedMentees(p.id, user.id),
          fetchProgramMentees(p.id),
        ]);
        setCoMentors(m.filter((x) => x.id !== user.id));
        setTags(t);
        setMyMentees(mm);
        setAllMentees(am);
      }
      setLoading(false);
    })();
  }, [slug, user?.id]);

  const filteredAllMentees = allMentees.filter((m) =>
    m.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mb-20 space-y-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-10 w-full max-w-lg rounded-lg" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </AppLayout>
    );
  }

  if (!program) {
    return (
      <AppLayout>
        <Card className="max-w-md mx-auto mt-12">
          <CardContent className="py-12 text-center space-y-4">
            <p className="text-muted-foreground">Program not found.</p>
            <Button onClick={() => navigate("/mentor/programs")}>
              Back to Programs
            </Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const hsl = program.color || "221 83% 53%";
  const totalMentors = coMentors.length + 1;

  return (
    <AppLayout>
      <div className="max-w-7xl mb-20 space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/mentor/programs")}
          className="-ml-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Programs
        </Button>

        {/* Program Header */}
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="h-3 w-full" style={{ backgroundColor: `hsl(${hsl})` }} />
          <CardHeader className="pt-6 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-2 min-w-0">
                <CardTitle className="text-2xl font-bold">{program.name}</CardTitle>
                {program.description && (
                  <p className="text-muted-foreground text-[15px] leading-relaxed max-w-2xl">
                    {program.description}
                  </p>
                )}
              </div>
              <Badge variant="secondary" className="capitalize text-sm px-4 py-1.5 shrink-0">
                {program.status}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 pb-6">
            <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 shrink-0" />
                <span>{totalMentors} Mentor{totalMentors !== 1 && "s"}</span>
              </div>
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 shrink-0" />
                <span>{allMentees.length} Mentee{allMentees.length !== 1 && "s"}</span>
              </div>
              {program.starts_on && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>
                    {formatISTDate(program.starts_on)}
                    {program.ends_on && ` — ${formatISTDate(program.ends_on)}`}
                  </span>
                </div>
              )}
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <Badge key={t.id} variant="outline" className="font-normal">
                    {t.label}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="my-mentees" className="w-full">
          <TabsList className="grid w-full max-w-xl grid-cols-3 h-10">
            <TabsTrigger value="my-mentees" className="text-xs sm:text-sm">
              My Mentees ({myMentees.length})
            </TabsTrigger>
            <TabsTrigger value="all-mentees" className="text-xs sm:text-sm">
              All Mentees ({allMentees.length})
            </TabsTrigger>
            <TabsTrigger value="co-mentors" className="text-xs sm:text-sm">
              Co-Mentors ({coMentors.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-mentees" className="mt-5">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-lg">My Mentees</CardTitle>
                    <CardDescription>
                      Mentees explicitly assigned to you in this program
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {myMentees.length === 0 ? (
                  <EmptyState icon={UserCircle} message="No mentees assigned to you yet." />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {myMentees.map((mentee) => (
                      <MenteeCard
                        key={mentee.id}
                        mentee={mentee}
                        badge="Assigned"
                        onClick={() => setSelectedMenteeId(mentee.id)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all-mentees" className="mt-5">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-lg">All Mentees</CardTitle>
                      <CardDescription>
                        Everyone enrolled in this program
                      </CardDescription>
                    </div>
                  </div>
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredAllMentees.length === 0 ? (
                  <EmptyState
                    icon={Search}
                    message={searchTerm ? "No matching mentees found." : "No mentees in this program yet."}
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredAllMentees.map((mentee) => {
                      const isMine = myMentees.some((x) => x.id === mentee.id);
                      return (
                        <MenteeCard
                          key={mentee.id}
                          mentee={mentee}
                          badge={isMine ? "Yours" : undefined}
                          onClick={() => setSelectedMenteeId(mentee.id)}
                        />
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="co-mentors" className="mt-5">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-lg">Co-Mentors</CardTitle>
                    <CardDescription>
                      Other mentors participating in this program
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {coMentors.length === 0 ? (
                  <EmptyState icon={Users} message="You are the only mentor in this program." />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {coMentors.map((mentor) => {
                      const profile = mentor.mentor_profiles?.[0];
                      const subtitle =
                        profile?.current_role ||
                        profile?.headline ||
                        undefined;
                      return (
                        <MentorCard
                          key={mentor.id}
                          name={mentor.full_name}
                          avatarUrl={mentor.avatar_url}
                          subtitle={subtitle}
                        />
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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

export default MentorProgramDetail;

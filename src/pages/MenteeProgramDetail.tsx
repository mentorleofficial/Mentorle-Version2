import { formatISTDate } from "@/lib/datetime";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, Users, Search, UserCheck, Share2, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchMenteeProgramOverview } from "@/features/programs/api";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import MentorExpertiseTags from "@/components/badges/MentorExpertiseTags";
import { toast } from "sonner";


const initials = (n: string) =>
  n.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";

const MenteeProgramDetail = () => {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sharedId, setSharedId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["mentee-program-overview", slug, user?.id],
    queryFn: () => fetchMenteeProgramOverview(slug, user!.id),
    enabled: !!user?.id && !!slug,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <Skeleton className="lg:col-span-5 h-80" />
            <Skeleton className="lg:col-span-7 h-96" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (isError || !data) {
    return (
      <AppLayout>
        <div className="max-w-5xl mx-auto px-6 py-10">
          <Card>
            <CardContent className="py-16 text-center space-y-4">
              <p className="text-muted-foreground">We couldn't load this program.</p>
              <Button variant="outline" onClick={() => refetch()}>Try again</Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const { program, mentors, tags, assignedMentor } = data;
  const hsl = program.color || "221 83% 53%";

  const otherMentors = assignedMentor
    ? mentors.filter((m) => m.id !== assignedMentor.id)
    : mentors;

  const assignedProfile = assignedMentor?.mentor_profiles?.[0];
  const assignedTopTag = assignedProfile?.current_role;
  const assignedExpertise = assignedProfile?.expertise ?? [];
  const assignedVisibleTags = assignedExpertise.slice(0, 2);
  const assignedRemainingCount = assignedExpertise.length - assignedVisibleTags.length;
  const assignedSubtitle =
    assignedProfile?.headline ||
    assignedProfile?.current_organization ||
    assignedMentor?.email ||
    "";

  return (
    <AppLayout>
      <div className="max-w-7xl mb-20 space-y-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/mentee/programs")}
          className="-ml-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Programs
        </Button>

        {/* Program Header */}
        <Card className="overflow-hidden border-0 shadow-lg">
          
          <CardHeader className="pt-4 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-3">
                <CardTitle className="text-2xl font-bold">{program.name}</CardTitle>
                {program.description && (
                  <p className="text-lg text-muted-foreground max-w-2xl">{program.description}</p>
                )}
              </div>
              <Badge variant="secondary" className="capitalize text-sm px-4 py-1.5">
                {program.status}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pb-8">
            <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <span>{mentors.length} Mentor{mentors.length !== 1 && "s"}</span>
              </div>
              {program.starts_on && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Assigned Mentor */}
          <div className="lg:col-span-5">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-xl">
                  <UserCheck className="h-5 w-5 text-green-600" />
                  Your Assigned Mentor
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                {assignedMentor ? (
                  <TooltipProvider>
                  <div className="relative overflow-hidden rounded-2xl aspect-[4/5] max-w-xs sm:max-w-sm mx-auto bg-[#1a1a2e] group cursor-pointer"
                    onClick={() => navigate(`/book/${assignedMentor.id}?programId=${program.id}`)}>

                    {/* Top Right Actions */}
                    <div className="absolute top-3 right-3 z-20 flex gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const url = `${window.location.origin}/book/${assignedMentor.id}`;
                          navigator.clipboard.writeText(url);
                          setSharedId(assignedMentor.id);
                          toast.success("Link copied");
                          setTimeout(() => setSharedId(null), 1500);
                        }}
                        className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70"
                      >
                        {sharedId === assignedMentor.id ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                      </button>
                    </div>

                    {assignedMentor.avatar_url ? (
                      <img
                        src={assignedMentor.avatar_url}
                        alt={assignedMentor.full_name}
                        className="absolute inset-0 w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="rounded-full bg-white/10 text-white text-3xl font-medium w-20 h-20 flex items-center justify-center">
                          {initials(assignedMentor.full_name)}
                        </div>
                      </div>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 z-10 px-3 pb-3 pt-10"
                      style={{ background: "linear-gradient(to top, rgba(0,0,0,0.95) 50%, rgba(0,0,0,0.6) 80%, transparent)" }}>
                      {assignedTopTag && (
                        <p className="text-[9px] sm:text-[10px] text-white/70 uppercase tracking-wider font-semibold truncate mb-0.5">
                          {assignedTopTag}
                        </p>
                      )}
                      <h3 className="font-bold text-white text-base leading-tight">{assignedMentor.full_name}</h3>
                      {assignedSubtitle && (
                        <p className="text-white/70 text-sm mt-1 line-clamp-2">{assignedSubtitle}</p>
                      )}

                      <MentorExpertiseTags tags={assignedExpertise} />

                      <div className="flex items-center justify-between mt-4 gap-3">
                        {assignedProfile?.years_experience ? (
                          <div className="text-white/75 text-sm">
                            <span className="font-bold text-white">{assignedProfile.years_experience}</span> Yrs
                          </div>
                        ) : (
                          <span />
                        )}
                        <Button
                          size="sm"
                          className="bg-white text-black hover:bg-white/90"
                          asChild
                        >
                          <Link to={`/book/${assignedMentor.id}?programId=${program.id}`}>
                            Book Session
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                  </TooltipProvider>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    You haven't been assigned a mentor yet.
                    <p className="mt-2 text-sm">Browse available mentors below.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Other Mentors */}
          <div className="lg:col-span-7">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl">
                    {assignedMentor ? "Other Mentors" : "Available Mentors"}
                  </CardTitle>
                  <CardDescription>
                    {otherMentors.length} mentor{otherMentors.length !== 1 && "s"} in this program
                  </CardDescription>
                </div>
                {mentors.length > 0 && (
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/mentors?program=${program.slug}`}>
                      <Search className="mr-2 h-4 w-4" />
                      Browse All
                    </Link>
                  </Button>
                )}
              </CardHeader>

              <CardContent>
                {otherMentors.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    No other mentors available in this program yet.
                  </div>
                ) : (
                  <TooltipProvider>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {otherMentors.map((mentor) => {
                        const profile = mentor.mentor_profiles?.[0];
                        const topTag = profile?.current_role;
                        const expertiseTags = profile?.expertise ?? [];
                        const visibleTags = expertiseTags.slice(0, 2);
                        const remainingCount = expertiseTags.length - visibleTags.length;

                        return (
                          <Card
                            key={mentor.id}
                            onClick={() => navigate(`/book/${mentor.id}?programId=${program.id}`)}
                            className="group relative overflow-hidden cursor-pointer border-0 rounded-2xl aspect-[3/4] bg-[#1a1a2e] hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
                          >
                            {/* Top Right Actions */}
                            <div className="absolute top-3 right-3 z-20 flex gap-1.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const url = `${window.location.origin}/book/${mentor.id}`;
                                  navigator.clipboard.writeText(url);
                                  setSharedId(mentor.id);
                                  toast.success("Link copied");
                                  setTimeout(() => setSharedId(null), 1500);
                                }}
                                className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm text-white hover:bg-black/70"
                              >
                                {sharedId === mentor.id ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                              </button>
                            </div>

                            {mentor.avatar_url ? (
                              <img
                                src={mentor.avatar_url}
                                alt={mentor.full_name}
                                className="absolute inset-0 w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <div className="rounded-full bg-white/10 text-white text-4xl font-medium w-24 h-24 flex items-center justify-center">
                                  {initials(mentor.full_name)}
                                </div>
                              </div>
                            )}

                            <div
                              className="absolute bottom-0 left-0 right-0 z-10 px-3 pb-3 pt-10"
                              style={{
                                background: "linear-gradient(to top, rgba(0,0,0,0.94) 55%, rgba(0,0,0,0.45) 82%, transparent 100%)",
                              }}
                            >
                              {topTag && (
                                <p className="text-[9px] sm:text-[10px] text-white/70 uppercase tracking-wider font-semibold truncate mb-0.5">
                                  {topTag}
                                </p>
                              )}
                              <h3 className="font-bold text-white text-[15px] leading-tight truncate">
                                {mentor.full_name}
                              </h3>

                              <MentorExpertiseTags tags={expertiseTags} />

                              <div className="flex items-center justify-between gap-2 mt-2">
                                {profile?.years_experience ? (
                                  <div className="text-[11px] text-white/75 whitespace-nowrap">
                                    <span className="text-[13px] font-bold text-white">
                                      {profile.years_experience}
                                    </span>{" "}
                                    Yrs
                                  </div>
                                ) : (
                                  <span />
                                )}
                                <Button
                                  size="sm"
                                  className="h-7 px-3 text-[11px] font-bold bg-white text-black hover:bg-white/90 rounded-md"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/book/${mentor.id}?programId=${program.id}`);
                                  }}
                                >
                                  Book
                                </Button>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </TooltipProvider>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default MenteeProgramDetail;
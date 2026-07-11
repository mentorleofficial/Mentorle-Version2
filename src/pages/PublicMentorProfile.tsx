import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import BookingModal from "@/components/sessions/BookingModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { markdownToHtml } from "@/components/ui/markdown-editor";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useBranding } from "@/contexts/BrandingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import BadgeChip from "@/components/badges/BadgeChip";
import SocialShareButtons from "@/components/SocialShareButtons";
import { useMentorBadges } from "@/features/badges/api";
import { ensureAbsoluteUrl } from "@/lib/utils";
import {
  Briefcase,
  GraduationCap,
  Linkedin,
  Globe,
  Building2,
  Calendar,
  Sparkles,
  ArrowLeft,
  Star,
  Tag,
  Clock,
  Coins,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

type Qualification = {
  institution: string;
  degree: string;
  field?: string;
  start_year?: string;
  end_year?: string;
};

type Experience = {
  company: string;
  title: string;
  start_date: string;
  end_date?: string;
  description?: string;
};

type PublicMentor = {
  user_id: string;
  slug: string | null;
  full_name: string;
  avatar_url: string | null;
  headline: string;
  bio: string;
  expertise: string[];
  years_experience: number;
  current_organization: string;
  current_role: string;
  linkedin_url: string;
  portfolio_url: string;
  qualifications: Qualification[];
  experiences: Experience[];
};

const initialsOf = (name: string) =>
  name.split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "M";

const formatMonth = (s?: string) => {
  if (!s) return "Present";
  try {
    const [y, m] = s.split("-");
    if (!m) return y;
    return new Date(Number(y), Number(m) - 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  } catch {
    return s;
  }
};

const PublicMentorProfile = () => {
  const { mentorId } = useParams<{ mentorId: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const branding = useBranding();
  const { toast } = useToast();
  const [mentor, setMentor] = useState<PublicMentor | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [rating, setRating] = useState<{ avg: number; count: number }>({ avg: 0, count: 0 });
  const [offeringDetail, setOfferingDetail] = useState<any>(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingOffering, setBookingOffering] = useState<any>(null);
  const { data: mentorBadges = [] } = useMentorBadges(mentor?.user_id);
  const bookingTargetId = mentor?.user_id ?? mentorId;

  const handleBook = (offering?: any) => {
    if (!user) {
      const profilePath = mentor?.slug ? `/mentors/${mentor.slug}` : `/mentors/${bookingTargetId}`;
      navigate(`/login?redirect=${encodeURIComponent(profilePath)}`);
      return;
    }
    if (role !== "mentee") {
      toast({ title: "Booking unavailable", description: "Only mentee accounts can book sessions from this page." });
      return;
    }
    setBookingOffering(offering ?? null);
    setBookingModalOpen(true);
  };

  // Fetch active offerings
  const { data: offerings = [] } = useQuery<any[]>({
    queryKey: ["public-offerings", mentor?.user_id],
    enabled: !!mentor?.user_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentorship_offerings")
        .select("*")
        .eq("mentor_id", mentor!.user_id)
        .eq("status", "active")
        .order("duration_minutes");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const fetch = async () => {
      if (!mentorId) return;
      setLoading(true);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mentorId);

      // SECURITY DEFINER RPC: returns only public-safe mentor fields, no email.
      const { data: rows } = await supabase.rpc("get_public_mentor", {
        _slug_or_id: mentorId,
      });
      const mp = Array.isArray(rows) && rows.length ? (rows[0] as any) : null;

      if (!mp) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // If accessed via UUID but slug exists, redirect to pretty URL
      if (isUuid && mp.slug) {
        navigate(`/mentors/${mp.slug}`, { replace: true });
        return;
      }

      setMentor({
        user_id: mp.user_id,
        slug: mp.slug ?? null,
        full_name: mp.full_name ?? "Mentor",
        avatar_url: mp.avatar_url ?? null,
        headline: mp.headline ?? "",
        bio: mp.bio ?? "",
        expertise: mp.expertise ?? [],
        years_experience: mp.years_experience ?? 0,
        current_organization: mp.current_organization ?? "",
        current_role: mp.current_role ?? "",
        linkedin_url: mp.linkedin_url ?? "",
        portfolio_url: mp.portfolio_url ?? "",
        qualifications: (mp.qualifications as Qualification[]) ?? [],
        experiences: (mp.experiences as Experience[]) ?? [],
      });
      setLoading(false);

      // Aggregate mentor rating
      const { data: fb } = await supabase
        .from("feedback")
        .select("rating, sessions!inner(mentor_id)")
        .eq("audience", "mentor")
        .eq("sessions.mentor_id", mp.user_id);
      if (fb && fb.length) {
        const avg = fb.reduce((s: number, r: any) => s + r.rating, 0) / fb.length;
        setRating({ avg: Math.round(avg * 10) / 10, count: fb.length });
      }
    };
    fetch();
  }, [mentorId]);

  const onBook = () => handleBook();

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (notFound || !mentor) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <CardTitle>Mentor not found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              This profile doesn't exist or isn't currently active.
            </p>
            <Button asChild variant="outline">
              <Link to="/"><ArrowLeft className="h-4 w-4" /> Back home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const title = `${mentor.full_name} — Mentor on ${branding.app_name}`;
  const description = mentor.headline || mentor.bio.slice(0, 155) || `Mentor with ${mentor.years_experience}+ years of experience.`;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-muted/20">
        <Helmet>
          <title>{title}</title>
          <meta name="description" content={description} />
          <meta property="og:title" content={title} />
          <meta property="og:description" content={description} />
          <meta property="og:type" content="profile" />
          {mentor.avatar_url && <meta property="og:image" content={mentor.avatar_url} />}
          <meta name="twitter:card" content="summary_large_image" />
        </Helmet>
        <div className="mx-auto max-w-7xl px-4 py-8">
          {/* HERO */}
          <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-primary/5">
            <div className="p-8 lg:p-10">
              <div className="flex flex-col gap-8 lg:flex-row">
                <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
                  <AvatarImage src={mentor.avatar_url ?? undefined} />
                  <AvatarFallback className="text-3xl">
                    {initialsOf(mentor.full_name)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-bold">
                      {mentor.full_name}
                    </h1>

                    {mentorBadges.length > 0 && (
                      <Badge className="rounded-full">
                        Top Mentor
                      </Badge>
                    )}
                  </div>

                  {mentor.headline && (
                    <p className="mt-2 text-lg text-muted-foreground">
                      {mentor.headline}
                    </p>
                  )}

                  <div className="mt-6 flex flex-wrap gap-6">
                    {mentor.current_role &&
                      mentor.current_organization && (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary" />
                          <span>
                            {mentor.current_role} @{" "}
                            {mentor.current_organization}
                          </span>
                        </div>
                      )}

                    {mentor.years_experience > 0 && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span>
                          {mentor.years_experience}+ years
                        </span>
                      </div>
                    )}

                    {rating.count > 0 && (
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                        <span>
                          {rating.avg} ({rating.count})
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <Button size="lg" onClick={onBook}>
                      Book Session
                    </Button>

                    {mentor.linkedin_url && (
                      <Button variant="outline" asChild>
                        <a
                          href={ensureAbsoluteUrl(
                            mentor.linkedin_url
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Linkedin className="mr-2 h-4 w-4" />
                          LinkedIn
                        </a>
                      </Button>
                    )}

                    {mentor.portfolio_url && (
                      <Button variant="outline" asChild>
                        <a
                          href={ensureAbsoluteUrl(
                            mentor.portfolio_url
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Globe className="mr-2 h-4 w-4" />
                          Portfolio
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* MAIN GRID */}
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
            {/* CONTENT */}
            <div className="space-y-8">
              {/* BADGES */}
              {mentorBadges.length > 0 && (
                <Card className="rounded-3xl">
                  <CardContent className="p-6">
                    <h3 className="mb-4 font-semibold">
                      Achievements
                    </h3>

                    <div className="flex flex-wrap gap-2">
                      {mentorBadges.map((mb) => (
                        <BadgeChip
                          key={mb.id}
                          badge={mb.badge}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ABOUT */}
              {mentor.bio && (
                <Card className="rounded-3xl">
                  <CardContent className="p-8">
                    <h2 className="mb-4 text-xl font-bold">
                      About
                    </h2>

                    <p className="whitespace-pre-line leading-8 text-muted-foreground">
                      {mentor.bio}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* EXPERTISE */}
              {mentor.expertise.length > 0 && (
                <Card className="rounded-3xl">
                  <CardContent className="p-8">
                    <div className="mb-5 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      <h2 className="text-xl font-bold">
                        Expertise
                      </h2>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {mentor.expertise.map((e) => (
                        <Badge
                          key={e}
                          variant="secondary"
                          className="rounded-full px-4 py-2"
                        >
                          {e}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* OFFERINGS */}
              {offerings.length > 0 && (
                <section>
                  <h2 className="mb-5 text-2xl font-bold">
                    Services
                  </h2>

                  <div className="grid gap-5 md:grid-cols-2">
                    {offerings.map((o) => (
                      <Card
                        key={o.id}
                        className="overflow-hidden rounded-3xl border transition-all hover:-translate-y-1 hover:shadow-xl"
                      >
                        <div className="h-1 bg-gradient-to-r from-primary to-primary/40" />

                        <CardContent className="p-6">
                          <h3 className="text-lg font-semibold">
                            {o.title}
                          </h3>

                          {o.description && (
                            <div className="mt-3">
                              <div
                                className="text-sm text-muted-foreground line-clamp-3 [&_h1]:text-sm [&_h2]:text-sm [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4"
                                dangerouslySetInnerHTML={{ __html: markdownToHtml(o.description) }}
                              />
                              <button
                                onClick={() => setOfferingDetail(o)}
                                className="mt-1 text-xs text-primary hover:underline"
                              >
                                Learn more
                              </button>
                            </div>
                          )}

                          <div className="mt-6 flex items-center justify-between">
                            <div>
                              <div className="text-3xl font-bold">
                                {o.price === 0
                                  ? "Free"
                                  : `₹${o.price}`}
                              </div>

                              <div className="mt-1 text-sm text-muted-foreground">
                                {o.duration_minutes} min
                              </div>
                            </div>

                            <Clock className="h-8 w-8 text-primary/40" />
                          </div>

                          <Button
                            className="mt-6 w-full"
                            onClick={() => handleBook(o)}
                          >
                            Book Session
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              )}

              {/* OFFERING DETAIL DIALOG */}
              <Dialog open={!!offeringDetail} onOpenChange={(open) => !open && setOfferingDetail(null)}>
                <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{offeringDetail?.title}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {offeringDetail?.description && (
                      <div
                        className="text-sm text-muted-foreground [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-sm [&_h2]:font-semibold [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 leading-relaxed space-y-2"
                        dangerouslySetInnerHTML={{ __html: markdownToHtml(offeringDetail.description) }}
                      />
                    )}
                    <div className="flex gap-6 pt-3 border-t text-sm font-medium">
                      <span>{offeringDetail?.duration_minutes} min</span>
                      <span>{offeringDetail?.price === 0 ? "Free" : `₹${offeringDetail?.price}`}</span>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => { const o = offeringDetail; setOfferingDetail(null); handleBook(o); }}
                    >
                      Book Session
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* EXPERIENCE */}
              {mentor.experiences.length > 0 && (
                <Card className="rounded-3xl">
                  <CardContent className="p-8">
                    <div className="mb-8 flex items-center gap-2">
                      <Briefcase className="h-5 w-5 text-primary" />
                      <h2 className="text-xl font-bold">
                        Experience
                      </h2>
                    </div>

                    <div className="relative border-l pl-8">
                      {mentor.experiences.map((x, i) => (
                        <div
                          key={i}
                          className="relative mb-10"
                        >
                          <div className="absolute -left-[41px] top-1 h-4 w-4 rounded-full bg-primary" />

                          <h3 className="font-semibold">
                            {x.title}
                          </h3>

                          <p className="text-sm text-muted-foreground">
                            {x.company}
                          </p>

                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatMonth(x.start_date)} –{" "}
                            {formatMonth(x.end_date)}
                          </p>

                          {x.description && (
                            <p className="mt-3 text-sm text-muted-foreground">
                              {x.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* EDUCATION */}
              {mentor.qualifications.length > 0 && (
                <Card className="rounded-3xl">
                  <CardContent className="p-8">
                    <div className="mb-6 flex items-center gap-2">
                      <GraduationCap className="h-5 w-5 text-primary" />
                      <h2 className="text-xl font-bold">
                        Education
                      </h2>
                    </div>

                    <div className="space-y-6">
                      {mentor.qualifications.map(
                        (q, i) => (
                          <div key={i}>
                            <h3 className="font-semibold">
                              {q.institution}
                            </h3>

                            <p className="text-sm text-muted-foreground">
                              {[q.degree, q.field]
                                .filter(Boolean)
                                .join(" • ")}
                            </p>

                            <p className="mt-1 text-xs text-muted-foreground">
                              {q.start_year} –{" "}
                              {q.end_year ||
                                "Present"}
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* SIDEBAR */}
            <aside>
              <div className="sticky top-6 space-y-4">
                <Card className="rounded-3xl border-primary/20">
                  <CardContent className="p-6">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">
                        Starting from
                      </p>

                      <div className="mt-2 text-5xl font-bold">
                        ₹
                        {offerings[0]?.price ??
                          0}
                      </div>

                      <p className="mt-2 text-sm text-muted-foreground">
                        per session
                      </p>
                    </div>

                    <Button
                      className="mt-6 w-full"
                      size="lg"
                      onClick={onBook}
                    >
                      Book Session
                    </Button>
                  </CardContent>
                </Card>

                <Card className="rounded-3xl">
                  <CardContent className="p-6">
                    <SocialShareButtons
                      url={
                        typeof window !== "undefined"
                          ? window.location.href
                          : ""
                      }
                      text={`Check out ${mentor.full_name}`}
                    />
                  </CardContent>
                </Card>
              </div>
            </aside>
          </div>

          <div className="mt-10 text-center text-xs text-muted-foreground">
            Powered by {branding.app_name}
          </div>
        </div>

      </div>

      {mentor && (
        <BookingModal
          mentorId={mentor.user_id}
          offeringId={bookingOffering?.id}
          open={bookingModalOpen}
          onOpenChange={(open) => { if (!open) { setBookingModalOpen(false); setBookingOffering(null); } }}
        />
      )}
    </TooltipProvider>
  );
};

export default PublicMentorProfile;

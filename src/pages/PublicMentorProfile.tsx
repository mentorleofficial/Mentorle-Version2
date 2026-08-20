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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import BadgeChip from "@/components/badges/BadgeChip";
import SocialShareButtons from "@/components/SocialShareButtons";
import { useMentorBadges } from "@/features/badges/api";
import { ensureAbsoluteUrl, cn } from "@/lib/utils";
import {
  Briefcase,
  GraduationCap,
  Linkedin,
  Globe,
  Building2,
  ArrowLeft,
  Star,
  Clock,
  ArrowRight,
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
  location?: string;
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
  is_live?: boolean;
  is_owner_preview?: boolean;
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

const formatPrice = (price?: number | null) => {
  if (price == null) return "—";
  if (price === 0) return "Free";
  return `₹${Number(price).toLocaleString("en-IN")}`;
};

const PublicMentorProfile = () => {
  const { slug: slugOrId } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, role, loading: authLoading } = useAuth();
  const branding = useBranding();
  const { toast } = useToast();
  const [mentor, setMentor] = useState<PublicMentor | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rating, setRating] = useState<{ avg: number; count: number }>({ avg: 0, count: 0 });
  const [offeringDetail, setOfferingDetail] = useState<any>(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingOffering, setBookingOffering] = useState<any>(null);
  const { data: mentorBadges = [] } = useMentorBadges(mentor?.user_id);
  const bookingTargetId = mentor?.user_id ?? slugOrId;

  const publicProfilePath = mentor?.slug
    ? `/mentor/${mentor.slug}`
    : `/mentor/${bookingTargetId}`;

  const handleBook = (offering?: any) => {
    if (mentor?.is_owner_preview) {
      toast({
        title: "Profile not live yet",
        description: "Mentees can book only after an admin activates your public profile.",
      });
      return;
    }
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(publicProfilePath)}`);
      return;
    }
    if (role !== "mentee") {
      toast({ title: "Booking unavailable", description: "Only mentee accounts can book sessions from this page." });
      return;
    }
    setBookingOffering(offering ?? null);
    setBookingModalOpen(true);
  };

  const { data: offerings = [] } = useQuery<any[]>({
    queryKey: ["public-offerings", mentor?.user_id],
    enabled: !!mentor?.user_id && !mentor?.is_owner_preview,
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
    if (authLoading) return;

    const fetch = async () => {
      if (!slugOrId) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setLoading(true);
      setNotFound(false);
      setLoadError(null);
      setMentor(null);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);

      const { data: rows, error: rpcError } = await supabase.rpc("get_public_mentor", {
        _slug_or_id: slugOrId,
      });

      if (rpcError) {
        console.error("[public-mentor] get_public_mentor failed", rpcError);
        setLoadError(rpcError.message || "Failed to load mentor profile");
        setNotFound(true);
        setLoading(false);
        return;
      }

      const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
      const mp = list.length ? (list[0] as any) : null;

      if (!mp) {
        if (user?.id) {
          let ownQuery = supabase
            .from("mentor_profiles")
            .select("user_id, slug, is_active, headline, bio, expertise, years_experience, current_organization, current_role, linkedin_url, portfolio_url, qualifications, experiences")
            .eq("user_id", user.id);
          if (isUuid) {
            if (slugOrId.toLowerCase() !== user.id.toLowerCase()) {
              setNotFound(true);
              setLoading(false);
              return;
            }
          } else {
            ownQuery = ownQuery.eq("slug", slugOrId);
          }
          const { data: own } = await ownQuery.maybeSingle();
          if (own && own.user_id === user.id) {
            const { data: u } = await supabase
              .from("users")
              .select("full_name, avatar_url")
              .eq("id", user.id)
              .maybeSingle();
            if (isUuid && own.slug) {
              navigate(`/mentor/${own.slug}`, { replace: true });
              return;
            }
            setMentor({
              user_id: own.user_id,
              slug: own.slug ?? null,
              full_name: u?.full_name ?? "Mentor",
              avatar_url: u?.avatar_url ?? null,
              headline: own.headline ?? "",
              bio: own.bio ?? "",
              expertise: own.expertise ?? [],
              years_experience: own.years_experience ?? 0,
              current_organization: own.current_organization ?? "",
              current_role: own.current_role ?? "",
              linkedin_url: own.linkedin_url ?? "",
              portfolio_url: own.portfolio_url ?? "",
              qualifications: (own.qualifications as Qualification[]) ?? [],
              experiences: (own.experiences as Experience[]) ?? [],
              is_live: !!own.is_active,
              is_owner_preview: !own.is_active,
            });
            setLoading(false);
            return;
          }
        }
        setNotFound(true);
        setLoading(false);
        return;
      }

      if (isUuid && mp.slug) {
        navigate(`/mentor/${mp.slug}`, { replace: true });
        return;
      }

      const live = mp.is_active !== false;
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
        is_live: live,
        is_owner_preview: !live,
      });
      setLoading(false);

      if (!live) return;

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
  }, [slugOrId, navigate, user?.id, authLoading]);

  const onBook = () => handleBook();

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-[hsl(var(--background))]">
        <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
          <Skeleton className="h-14 w-40" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !mentor) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[hsl(var(--background))]">
        <div className="max-w-md w-full text-center space-y-4">
          <p className="font-serif text-3xl tracking-tight">Mentor not found</p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            This profile doesn&apos;t exist, or it isn&apos;t live yet. Public profiles appear after an admin activates the mentor.
          </p>
          {slugOrId && (
            <p className="text-xs text-muted-foreground font-mono break-all">/mentor/{slugOrId}</p>
          )}
          {loadError && (
            <p className="text-xs text-destructive break-all">{loadError}</p>
          )}
          <Button asChild variant="outline" className="mt-2">
            <Link to="/login">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to login
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const title = `${mentor.full_name} — Mentor on ${branding.app_name}`;
  const description = mentor.headline || mentor.bio.slice(0, 155) || `Mentor with ${mentor.years_experience}+ years of experience.`;
  const lowestPrice = offerings.length
    ? Math.min(...offerings.map((o) => Number(o.price ?? 0)))
    : null;
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-foreground">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="profile" />
        {mentor.avatar_url && <meta property="og:image" content={mentor.avatar_url} />}
        <meta name="twitter:card" content="summary_large_image" />
        {mentor.slug && (
          <link
            rel="canonical"
            href={`${typeof window !== "undefined" ? window.location.origin : ""}/mentor/${mentor.slug}`}
          />
        )}
      </Helmet>

      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-[hsl(var(--background))]/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to={user ? "/dashboard" : "/login"} className="flex items-center gap-2.5 min-w-0">
            {branding.logo_url ? (
              <img src={branding.logo_url} alt="" className="h-8 w-8 rounded-md object-cover shrink-0" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-semibold shrink-0">
                {branding.app_name.charAt(0)}
              </span>
            )}
            <span className="font-serif text-lg tracking-tight truncate">{branding.app_name}</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <SocialShareButtons url={shareUrl} text={`Check out ${mentor.full_name} on ${branding.app_name}`} />
            </div>
            <Button size="sm" className="hidden sm:inline-flex" onClick={onBook}>
              Book session
            </Button>
          </div>
        </div>
      </header>

      {mentor.is_owner_preview && (
        <div className="border-b border-amber-500/25 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-950 dark:text-amber-100">
          Preview only — your public profile is not live yet. An admin must activate your account before mentees can open this link or book you.
        </div>
      )}

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/50">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 10% 0%, hsl(var(--primary) / 0.14), transparent 55%), radial-gradient(ellipse 60% 50% at 100% 20%, hsl(var(--accent) / 0.10), transparent 50%)",
          }}
        />
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 pb-10 pt-8 sm:pt-12 sm:pb-14">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-end sm:gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <Avatar className="h-28 w-28 sm:h-36 sm:w-36 rounded-2xl border border-border/80 shadow-lg ring-4 ring-background">
              <AvatarImage src={mentor.avatar_url ?? undefined} className="object-cover" />
              <AvatarFallback className="rounded-2xl text-3xl font-serif bg-primary/10 text-primary">
                {initialsOf(mentor.full_name)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {mentorBadges.length > 0 && (
                  <Badge variant="secondary" className="rounded-md font-normal">
                    Top mentor
                  </Badge>
                )}
                {rating.count > 0 && (
                  <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                    {rating.avg}
                    <span className="text-muted-foreground/70">({rating.count})</span>
                  </span>
                )}
              </div>

              <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl tracking-tight leading-[1.1]">
                {mentor.full_name}
              </h1>

              {mentor.headline && (
                <p className="max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
                  {mentor.headline}
                </p>
              )}

              <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-sm text-muted-foreground">
                {(mentor.current_role || mentor.current_organization) && (
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    {[mentor.current_role, mentor.current_organization].filter(Boolean).join(" · ")}
                  </span>
                )}
                {mentor.years_experience > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5 text-primary shrink-0" />
                    {mentor.years_experience}+ years experience
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="lg" onClick={onBook} className="gap-2">
                  Book a session
                  <ArrowRight className="h-4 w-4" />
                </Button>
                {mentor.linkedin_url && (
                  <Button variant="outline" size="lg" asChild>
                    <a href={ensureAbsoluteUrl(mentor.linkedin_url)} target="_blank" rel="noopener noreferrer">
                      <Linkedin className="mr-2 h-4 w-4" />
                      LinkedIn
                    </a>
                  </Button>
                )}
                {mentor.portfolio_url && (
                  <Button variant="outline" size="lg" asChild>
                    <a href={ensureAbsoluteUrl(mentor.portfolio_url)} target="_blank" rel="noopener noreferrer">
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

      {/* Body */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-14 pb-28 lg:pb-14">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-16">
          <div className="space-y-12 min-w-0">
            {mentorBadges.length > 0 && (
              <section className="animate-in fade-in duration-700">
                <h2 className="font-serif text-2xl tracking-tight mb-4">Achievements</h2>
                <div className="flex flex-wrap gap-2">
                  {mentorBadges.map((mb) => (
                    <BadgeChip key={mb.id} badge={mb.badge} />
                  ))}
                </div>
              </section>
            )}

            {mentor.bio && (
              <section>
                <h2 className="font-serif text-2xl tracking-tight mb-4">About</h2>
                <p className="whitespace-pre-line text-[15px] sm:text-base leading-7 text-muted-foreground">
                  {mentor.bio}
                </p>
              </section>
            )}

            {mentor.expertise.length > 0 && (
              <section>
                <h2 className="font-serif text-2xl tracking-tight mb-4">Expertise</h2>
                <div className="flex flex-wrap gap-2">
                  {mentor.expertise.map((e) => (
                    <span
                      key={e}
                      className="inline-flex rounded-full border border-border bg-secondary/60 px-3.5 py-1.5 text-sm"
                    >
                      {e}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {offerings.length > 0 && (
              <section id="services">
                <div className="mb-5 flex items-end justify-between gap-3">
                  <h2 className="font-serif text-2xl tracking-tight">Sessions</h2>
                  {lowestPrice != null && (
                    <p className="text-sm text-muted-foreground">
                      From {formatPrice(lowestPrice)}
                    </p>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {offerings.map((o) => (
                    <article
                      key={o.id}
                      className={cn(
                        "group flex flex-col rounded-2xl border border-border bg-card p-5",
                        "transition-all duration-300 hover:border-primary/35 hover:shadow-md",
                      )}
                    >
                      <h3 className="font-semibold text-base leading-snug">{o.title}</h3>
                      {o.description && (
                        <div className="mt-2 flex-1">
                          <div
                            className="text-sm text-muted-foreground line-clamp-3 [&_p]:m-0 [&_ul]:list-disc [&_ul]:pl-4"
                            dangerouslySetInnerHTML={{ __html: markdownToHtml(o.description) }}
                          />
                          <button
                            type="button"
                            onClick={() => setOfferingDetail(o)}
                            className="mt-1.5 text-xs font-medium text-primary hover:underline"
                          >
                            Learn more
                          </button>
                        </div>
                      )}
                      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/70 pt-4">
                        <div>
                          <p className="text-xl font-semibold tracking-tight">{formatPrice(o.price)}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {o.duration_minutes} min
                          </p>
                        </div>
                        <Button size="sm" onClick={() => handleBook(o)}>
                          Book
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {mentor.experiences.length > 0 && (
              <section>
                <h2 className="font-serif text-2xl tracking-tight mb-6">Experience</h2>
                <ol className="relative space-y-0 border-l border-border ml-2">
                  {mentor.experiences.map((x, i) => (
                    <li key={i} className="relative pl-6 pb-8 last:pb-0">
                      <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                      <h3 className="font-semibold leading-snug">{x.title}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">{x.company}</p>
                      <p className="text-xs text-muted-foreground/80 mt-1">
                        {formatMonth(x.start_date)} – {formatMonth(x.end_date)}
                        {x.location ? ` · ${x.location}` : ""}
                      </p>
                      {x.description && (
                        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{x.description}</p>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {mentor.qualifications.length > 0 && (
              <section>
                <h2 className="font-serif text-2xl tracking-tight mb-5">Education</h2>
                <ul className="space-y-5">
                  {mentor.qualifications.map((q, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <GraduationCap className="h-4 w-4" />
                      </span>
                      <div>
                        <h3 className="font-semibold leading-snug">{q.institution}</h3>
                        <p className="text-sm text-muted-foreground">
                          {[q.degree, q.field].filter(Boolean).join(" · ")}
                        </p>
                        <p className="text-xs text-muted-foreground/80 mt-0.5">
                          {q.start_year} – {q.end_year || "Present"}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* Desktop sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-4">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Book with {mentor.full_name.split(" ")[0]}</p>
                {lowestPrice != null ? (
                  <p className="mt-2 font-serif text-3xl tracking-tight">
                    {formatPrice(lowestPrice)}
                    <span className="ml-1 text-sm font-sans font-normal text-muted-foreground">from</span>
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Sessions available on request</p>
                )}
                <Button className="mt-4 w-full" size="lg" onClick={onBook}>
                  Book session
                </Button>
                {offerings.length > 0 && (
                  <a href="#services" className="mt-3 block text-center text-xs text-primary hover:underline">
                    View {offerings.length} session{offerings.length === 1 ? "" : "s"}
                  </a>
                )}
              </div>
              <div className="rounded-2xl border border-border bg-card/60 p-4">
                <SocialShareButtons
                  url={shareUrl}
                  text={`Check out ${mentor.full_name} on ${branding.app_name}`}
                  label="Share profile"
                />
              </div>
            </div>
          </aside>
        </div>

        <p className="mt-16 text-center text-xs text-muted-foreground">
          Powered by {branding.app_name}
        </p>
      </div>

      {/* Mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[hsl(var(--background))]/95 backdrop-blur-md p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{mentor.full_name}</p>
            <p className="text-xs text-muted-foreground">
              {lowestPrice != null ? `From ${formatPrice(lowestPrice)}` : "Book a session"}
            </p>
          </div>
          <Button onClick={onBook} className="shrink-0">
            Book
          </Button>
        </div>
      </div>

      <Dialog open={!!offeringDetail} onOpenChange={(open) => !open && setOfferingDetail(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">{offeringDetail?.title}</DialogTitle>
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
              <span>{formatPrice(offeringDetail?.price)}</span>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                const o = offeringDetail;
                setOfferingDetail(null);
                handleBook(o);
              }}
            >
              Book session
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BookingModal
        mentorId={mentor.user_id}
        offeringId={bookingOffering?.id}
        open={bookingModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setBookingModalOpen(false);
            setBookingOffering(null);
          }
        }}
      />
    </div>
  );
};

export default PublicMentorProfile;

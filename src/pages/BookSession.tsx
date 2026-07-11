import { useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import BookingModal from "@/components/sessions/BookingModal";
import OfferingCard from "@/components/booking/OfferingCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Briefcase,
  Clock,
  Globe,
  Linkedin,
  Sparkles,
  Timer,
} from "lucide-react";
import { markdownToHtml } from "@/components/ui/markdown-editor";
import { useBookSessionStatic, type BookingOffering } from "@/features/mentee-booking/useBookSessionData";

const BookSession = () => {
  const { mentorId } = useParams<{ mentorId: string }>();
  const [params] = useSearchParams();
  const preselectedOfferingId = params.get("offering") ?? undefined;
  const navigate = useNavigate();

  const { data: staticData, isPending } = useBookSessionStatic(mentorId);
  const mentor = staticData?.mentor ?? null;
  const mentorProfile = staticData?.mentorProfile ?? null;
  const offerings = staticData?.offerings ?? [];

  const [selectedOfferingId, setSelectedOfferingId] = useState<string | undefined>(
    preselectedOfferingId
  );
  const [modalOpen, setModalOpen] = useState(!!preselectedOfferingId);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [detailOffering, setDetailOffering] = useState<BookingOffering | null>(null);

  const mentorInitials =
    mentor?.full_name
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase() ?? "")
      .join("") || "M";

  const timezone = mentorProfile?.timezone
    ? mentorProfile.timezone.replace("Asia/Kolkata", "IST")
    : "IST";

  const roleLine = [mentor?.current_role, mentor?.current_organization]
    .filter(Boolean)
    .join(" · ");

  const bio = mentor?.bio ?? "";
  const bioIsLong = bio.length > 240;
  const bioDisplay = bioExpanded || !bioIsLong ? bio : `${bio.slice(0, 240).trim()}…`;

  if (!mentorId) return null;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-5 space-y-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="grid gap-8 lg:grid-cols-[360px_1fr] items-start">
          {/* Left column — Mentor */}
          <aside className="lg:sticky lg:top-6 self-start">
            {isPending ? (
              <Skeleton className="h-[600px] rounded-2xl" />
            ) : mentor ? (
              <Card className="overflow-hidden">
                <CardContent className="p-5 space-y-5">
                  {/* 3:4 aspect ratio image */}
                  <div className="aspect-[3/4] w-full max-w-[240px] md:max-w-[280px] lg:max-w-full mx-auto overflow-hidden rounded-2xl ring-1 ring-border bg-muted">
                    {mentor.avatar_url ? (
                      <img
                        src={mentor.avatar_url}
                        alt={mentor.full_name ?? "Mentor"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-primary/10 text-primary text-5xl md:text-6xl font-bold">
                        {mentorInitials}
                      </div>
                    )}
                  </div>

                  {/* Identity */}
                  <div className="space-y-1.5">
                    <h1 className="text-2xl font-bold tracking-tight leading-tight">
                      {mentor.full_name}
                    </h1>
                    {roleLine && (
                      <p className="text-sm text-muted-foreground flex items-start gap-1.5">
                        <Briefcase className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>{roleLine}</span>
                      </p>
                    )}
                    {mentor.headline && (
                      <p className="text-sm text-foreground/80 pt-1">{mentor.headline}</p>
                    )}
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="gap-1">
                      <Globe className="h-3 w-3" /> {timezone}
                    </Badge>
                    <Badge variant="secondary" className="gap-1">
                      <Clock className="h-3 w-3" />
                      {mentorProfile?.minimum_notice_hours ?? 0}h notice
                    </Badge>
                    <Badge variant="secondary" className="gap-1">
                      <Timer className="h-3 w-3" />
                      {mentorProfile?.buffer_time_minutes ?? 0}m buffer
                    </Badge>
                    {mentor.years_experience != null && (
                      <Badge variant="secondary" className="gap-1">
                        <Sparkles className="h-3 w-3" />
                        {mentor.years_experience}+ yrs
                      </Badge>
                    )}
                  </div>

                  {mentor.linkedin_url && (
                    <a
                      href={mentor.linkedin_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      <Linkedin className="h-4 w-4" /> View LinkedIn
                    </a>
                  )}

                  {/* Bio */}
                  {bio && (
                    <div className="pt-4 border-t">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        About
                      </p>
                      <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">
                        {bioDisplay}
                      </p>
                      {bioIsLong && (
                        <button
                          type="button"
                          onClick={() => setBioExpanded((v) => !v)}
                          className="mt-1 text-xs font-medium text-primary hover:underline"
                        >
                          {bioExpanded ? "Show less" : "Read more"}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Expertise */}
                  {mentor.expertise && mentor.expertise.length > 0 && (
                    <div className="pt-4 border-t">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        Expertise
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {mentor.expertise.map((tag) => (
                          <Badge key={tag} variant="outline" className="font-normal">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  Mentor not found or not available for booking.
                </CardContent>
              </Card>
            )}
          </aside>

          {/* Right column — Offerings */}
          <section className="space-y-4 min-w-0">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-xl font-bold">Choose an offering</h2>
                <p className="text-sm text-muted-foreground">
                  Select a session type to book with this mentor.
                </p>
              </div>
              {mentor && (
                <p className="text-xs text-muted-foreground">
                  All times in <span className="font-medium">{timezone}</span>
                </p>
              )}
            </div>

            {isPending ? (
              <div className="grid gap-5 sm:grid-cols-1 xl:grid-cols-2">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-[280px] rounded-[10px]" />
                ))}
              </div>
            ) : offerings.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  This mentor has no active offerings right now.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-5 sm:grid-cols-1 xl:grid-cols-2">
                {offerings.map((offering) => (
                  <OfferingCard
                    key={offering.id}
                    hideMentor
                    offering={offering}
                    onBook={() => {
                      setSelectedOfferingId(offering.id);
                      setModalOpen(true);
                    }}
                    onLearnMore={() => setDetailOffering(offering)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Learn more dialog */}
      <Dialog open={!!detailOffering} onOpenChange={(open) => !open && setDetailOffering(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailOffering?.title}</DialogTitle>
          </DialogHeader>
          {detailOffering && (
            <div className="space-y-4">
              {detailOffering.description && (
                <div
                  className="text-sm text-muted-foreground [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-sm [&_h2]:font-semibold [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 leading-relaxed space-y-2"
                  dangerouslySetInnerHTML={{
                    __html: markdownToHtml(detailOffering.description),
                  }}
                />
              )}
              <div className="flex gap-6 pt-3 border-t text-sm font-medium">
                <span>{detailOffering.duration_minutes} min</span>
                <span>
                  {detailOffering.price === 0 ? "Free" : `₹${detailOffering.price}`}
                </span>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  setSelectedOfferingId(detailOffering.id);
                  setDetailOffering(null);
                  setModalOpen(true);
                }}
              >
                Book this session
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BookingModal
        mentorId={mentorId}
        offeringId={selectedOfferingId}
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setSelectedOfferingId(undefined);
        }}
      />
    </AppLayout>
  );
};

export default BookSession;

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import AppLayout from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, X, UserSearch, Filter, ChevronDown, Heart, Share2, Check } from "lucide-react";
import { toast } from "sonner";
import { useMentors, useMenteeFavorites, useToggleFavorite } from "@/features/mentors";
import { useMyPrograms } from "@/features/programs/hooks/useMyPrograms";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ExpertiseFilter from "@/features/mentors/components/ExpertiseFilter";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import MentorExpertiseTags from "@/components/badges/MentorExpertiseTags";
import { cn } from "@/lib/utils";

const MentorDirectory = () => {
  const [search, setSearch] = useState("");
  const [selectedExpertise, setSelectedExpertise] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [experienceRange, setExperienceRange] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [selectedSessionType, setSelectedSessionType] = useState("");
  const [hasAvailability, setHasAvailability] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [sharedId, setSharedId] = useState<string | null>(null);

  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: mentors = [], isLoading } = useMentors();
  const { data: myPrograms = [] } = useMyPrograms();
  const { data: favorites = [] } = useMenteeFavorites(user?.id);
  const toggleFavoriteMutation = useToggleFavorite();

  const { data: offerings = [] } = useQuery({
    queryKey: ["mentorship_offerings", "all-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentorship_offerings")
        .select("*")
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
  });

  const { data: availability = [] } = useQuery({
    queryKey: ["mentor_availability", "all-slots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentor_availability")
        .select("mentor_id");
      if (error) throw error;
      return data;
    },
  });

  const [mentorPrograms, setMentorPrograms] = useState<
    Record<string, { id: string; name: string; slug: string; color: string }[]>
  >({});

  useEffect(() => {
    if (myPrograms.length === 0) {
      setMentorPrograms({});
      return;
    }
    (async () => {
      const programIds = myPrograms.map((p) => p.id);
      const { data: pm } = await supabase
        .from("program_mentors")
        .select("program_id, mentor_id")
        .in("program_id", programIds);
      const byMentor: Record<string, { id: string; name: string; slug: string; color: string }[]> = {};
      const programMap = new Map(myPrograms.map((p) => [p.id, p]));
      (pm || []).forEach((row: any) => {
        const p = programMap.get(row.program_id);
        if (!p) return;
        (byMentor[row.mentor_id] ||= []).push({ id: p.id, name: p.name, slug: p.slug, color: p.color });
      });
      setMentorPrograms(byMentor);
    })();
  }, [myPrograms]);

  const activeProgramSlug = params.get("program");
  const activeProgram = activeProgramSlug ? myPrograms.find((p) => p.slug === activeProgramSlug) : null;

  const allExpertise = useMemo(() => {
    const set = new Set<string>();
    mentors.forEach((m) =>
      m.mentor_profiles?.[0]?.expertise?.forEach((e) => e && set.add(e))
    );
    return Array.from(set);
  }, [mentors]);

  const offeringsByMentor = useMemo(() => {
    const map: Record<string, typeof offerings> = {};
    offerings.forEach((off) => {
      (map[off.mentor_id] ||= []).push(off);
    });
    return map;
  }, [offerings]);

  const availableMentorIds = useMemo(() => {
    return new Set(availability.map((a) => a.mentor_id));
  }, [availability]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return mentors.filter((m) => {
      const profile = m.mentor_profiles?.[0];
      const exp = profile?.expertise ?? [];

      // 1. Search term filter (searches name, bio, headline, role, company, or expertise)
      const matchesSearch =
        !q ||
        m.full_name.toLowerCase().includes(q) ||
        exp.some((e) => e.toLowerCase().includes(q)) ||
        profile?.bio?.toLowerCase().includes(q) ||
        profile?.headline?.toLowerCase().includes(q) ||
        profile?.current_role?.toLowerCase().includes(q) ||
        profile?.current_organization?.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      // 2. Expertise filter (multi-select)
      if (selectedExpertise.length > 0) {
        const has = selectedExpertise.every((tag) => exp.includes(tag));
        if (!has) return false;
      }

      // 3. Active Program filter
      if (activeProgram) {
        const inProg = (mentorPrograms[m.id] || []).some((p) => p.id === activeProgram.id);
        if (!inProg) return false;
      }

      // 4. Experience filter
      if (experienceRange) {
        const years = profile?.years_experience ?? 0;
        if (experienceRange === "0-2" && (years < 0 || years > 2)) return false;
        if (experienceRange === "3-5" && (years < 3 || years > 5)) return false;
        if (experienceRange === "6-10" && (years < 6 || years > 10)) return false;
        if (experienceRange === "10+" && years < 10) return false;
      }

      // 5. Price filter
      if (priceRange) {
        const mentorOfferings = offeringsByMentor[m.id] || [];
        const hasMatchingPrice = mentorOfferings.some((off) => {
          const price = off.price ?? 0;
          if (priceRange === "free") return price === 0;
          if (priceRange === "0-500") return price > 0 && price <= 500;
          if (priceRange === "500-1000") return price > 500 && price <= 1000;
          if (priceRange === "1000-2000") return price > 1000 && price <= 2000;
          if (priceRange === "2000+") return price > 2000;
          return true;
        });
        if (!hasMatchingPrice) return false;
      }

      // 6. Session Type filter
      if (selectedSessionType) {
        const mentorOfferings = offeringsByMentor[m.id] || [];
        const hasMatchingType = mentorOfferings.some((off) => {
          const cat = off.category?.toLowerCase() || "";
          const title = off.title?.toLowerCase() || "";
          if (selectedSessionType === "1-on-1") {
            return cat.includes("1-on-1") || title.includes("1-on-1") || cat.includes("video") || title.includes("video") || cat === "mentorship";
          }
          if (selectedSessionType === "group") {
            return cat.includes("group") || title.includes("group");
          }
          if (selectedSessionType === "email") {
            return cat.includes("email") || title.includes("email") || cat.includes("text") || title.includes("text");
          }
          if (selectedSessionType === "review") {
            return cat.includes("review") || title.includes("review") || cat.includes("code") || title.includes("code") || cat.includes("resume") || title.includes("resume");
          }
          return true;
        });
        if (!hasMatchingType) return false;
      }

      // 7. Availability filter
      if (hasAvailability) {
        if (!availableMentorIds.has(m.id)) return false;
      }

      // 8. Favorites filter
      if (showFavorites) {
        if (!favorites.includes(m.id)) return false;
      }

      return true;
    });
  }, [
    mentors,
    search,
    activeProgram,
    mentorPrograms,
    selectedExpertise,
    experienceRange,
    priceRange,
    selectedSessionType,
    hasAvailability,
    showFavorites,
    favorites,
    offeringsByMentor,
    availableMentorIds,
  ]);

  const setProgramFilter = (slug: string | null) => {
    const next = new URLSearchParams(params);
    if (slug) next.set("program", slug);
    else next.delete("program");
    setParams(next, { replace: true });
  };

  const clearAll = () => {
    setSearch("");
    setSelectedExpertise([]);
    setProgramFilter(null);
    setExperienceRange("");
    setPriceRange("");
    setSelectedSessionType("");
    setHasAvailability(false);
    setShowFavorites(false);
  };

  const hasActiveFilters =
    search ||
    selectedExpertise.length > 0 ||
    !!activeProgram ||
    experienceRange ||
    priceRange ||
    selectedSessionType ||
    hasAvailability ||
    showFavorites;

  return (
    <AppLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Find a Mentor</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Browse available mentors and book a session.
          </p>
        </div>

        {/* Filter bar */}
        <div className="sticky top-0 z-20 -mx-2 px-2 py-3 bg-background/80 backdrop-blur-md border-b">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 h-10"
                placeholder="Search by name, skill, topic, role, company..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <ExpertiseFilter
              options={allExpertise}
              selected={selectedExpertise}
              onChange={setSelectedExpertise}
            />

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="h-10 gap-2 text-muted-foreground hover:text-foreground"
            >
              <Filter className="h-4 w-4" />
              Filters
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", showFilters && "rotate-180")} />
            </Button>

            {myPrograms.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setProgramFilter(null)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition-colors",
                    !activeProgram
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-muted",
                  )}
                >
                  All programs
                </button>
                {myPrograms.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setProgramFilter(p.slug)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs transition-colors",
                      activeProgram?.id === p.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "hover:bg-muted",
                    )}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="ml-auto h-8 text-xs" onClick={clearAll}>
                Clear all
              </Button>
            )}
          </div>

          {/* Expandable Advanced Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-muted/50 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Experience Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Experience</label>
                <select
                  value={experienceRange}
                  onChange={(e) => setExperienceRange(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Any Experience</option>
                  <option value="0-2">0-2 years</option>
                  <option value="3-5">3-5 years</option>
                  <option value="6-10">6-10 years</option>
                  <option value="10+">10+ years</option>
                </select>
              </div>

              {/* Price Range Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Price Range</label>
                <select
                  value={priceRange}
                  onChange={(e) => setPriceRange(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Any Price</option>
                  <option value="free">Free</option>
                  <option value="0-500">₹0 - ₹500</option>
                  <option value="500-1000">₹500 - ₹1,000</option>
                  <option value="1000-2000">₹1,000 - ₹2,000</option>
                  <option value="2000+">₹2,000+</option>
                </select>
              </div>

              {/* Session Type Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Session Type</label>
                <select
                  value={selectedSessionType}
                  onChange={(e) => setSelectedSessionType(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">All Types</option>
                  <option value="1-on-1">1-on-1 Video Call</option>
                  <option value="group">Group Session</option>
                  <option value="email">Email/Text Support</option>
                  <option value="review">Project/Code Review</option>
                </select>
              </div>

              {/* Checkboxes Group */}
              <div className="flex flex-col justify-end gap-3 pb-1 md:col-span-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hasAvailability"
                    checked={hasAvailability}
                    onChange={(e) => setHasAvailability(e.target.checked)}
                    className="h-4 w-4 rounded border-input bg-background text-primary focus:ring-ring accent-black cursor-pointer"
                  />
                  <label htmlFor="hasAvailability" className="text-sm font-medium leading-none cursor-pointer">
                    Available Now
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="showFavorites"
                    checked={showFavorites}
                    onChange={(e) => setShowFavorites(e.target.checked)}
                    className="h-4 w-4 rounded border-input bg-background text-primary focus:ring-ring accent-black cursor-pointer"
                  />
                  <label htmlFor="showFavorites" className="text-sm font-medium leading-none cursor-pointer">
                    Show Favorites Only
                  </label>
                </div>
              </div>
            </div>
          )}

          {selectedExpertise.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {selectedExpertise.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2.5 py-1"
                >
                  {tag}
                  <button
                    onClick={() =>
                      setSelectedExpertise(selectedExpertise.filter((t) => t !== tag))
                    }
                    className="hover:bg-primary/20 rounded-full p-0.5"
                    aria-label={`Remove ${tag}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="text-xs text-muted-foreground mt-2">
            {isLoading ? "Loading…" : `Showing ${filtered.length} of ${mentors.length} mentor${filtered.length === 1 ? "" : "s"}`}
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] w-full rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <UserSearch className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">No mentors match your filters</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Try a different search or clear filters to see everyone.
            </p>
            <Button variant="outline" size="sm" onClick={clearAll}>
              Clear filters
            </Button>
          </div>
        ) : (
          <TooltipProvider delayDuration={150}>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filtered.map((m) => {
                const profile = m.mentor_profiles?.[0];
                const initials = m.full_name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase();
                const topTag = profile?.current_role;
                const expertiseTags = profile?.expertise ?? [];
                const visibleTags = expertiseTags.slice(0, 2);
                const remainingCount = expertiseTags.length - visibleTags.length;
                const isFav = favorites.includes(m.id);

                return (
                  <Card
                    key={m.id}
                    onClick={() => navigate(`/book/${m.id}`)}
                    className="group relative overflow-hidden cursor-pointer border-0 rounded-2xl aspect-[3/4] bg-[#1a1a2e] hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
                  >
                    {/* Share & Favorite Toggle Buttons */}
                    <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const url = `${window.location.origin}/mentors/${m.id}`;
                          try {
                            await navigator.clipboard.writeText(url);
                            setSharedId(m.id);
                            toast.success("Link copied to clipboard");
                            setTimeout(() => setSharedId((cur) => (cur === m.id ? null : cur)), 1500);
                          } catch {
                            toast.error("Could not copy link");
                          }
                        }}
                        className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm text-white/90 hover:scale-105 hover:bg-black/60 transition-all duration-200"
                        title="Copy share link"
                        aria-label="Copy share link"
                      >
                        {sharedId === m.id ? (
                          <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[2.5px]" />
                        ) : (
                          <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[2.5px]" />
                        )}
                      </button>
                      {user && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavoriteMutation.mutate({
                              userId: user.id,
                              mentorId: m.id,
                              isFavorite: isFav,
                            });
                          }}
                          className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm text-white/80 hover:scale-105 hover:bg-black/60 transition-all duration-200"
                          title={isFav ? "Remove from favorites" : "Add to favorites"}
                        >
                          <Heart
                            className={cn(
                              "h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[2.5px] transition-colors",
                              isFav ? "fill-red-500 text-red-500" : "text-white/95"
                            )}
                          />
                        </button>
                      )}
                    </div>

                    {m.avatar_url ? (
                      <img
                        src={m.avatar_url}
                        alt={m.full_name}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="rounded-full flex items-center justify-center bg-white/10 text-white/60 text-3xl font-medium w-24 h-24">
                          {initials}
                        </div>
                      </div>
                    )}

                    <div
                      className="absolute bottom-0 left-0 right-0 z-10 px-3 pb-3 pt-14"
                      style={{
                        background:
                          "linear-gradient(to top, rgba(0,0,0,0.94) 55%, rgba(0,0,0,0.45) 82%, transparent 100%)",
                      }}
                    >
                      {topTag && (
                        <p className="text-[9px] sm:text-[10px] text-white/75 font-semibold tracking-wide uppercase truncate mb-0.5">
                          {topTag}
                        </p>
                      )}
                      <h3 className="font-bold text-white text-[15px] leading-tight truncate">
                        {m.full_name}
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
                            navigate(`/book/${m.id}`);
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
      </div>
    </AppLayout>
  );
};

export default MentorDirectory;

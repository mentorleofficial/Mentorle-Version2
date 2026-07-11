import { memo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Compass, Share2, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import MentorExpertiseTags from "@/components/badges/MentorExpertiseTags";
import type { RecommendedMentor } from "@/features/mentee-dashboard/useMenteeDashboardData";

const initials = (n: string) =>
  n.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";

const RecommendedMentors = ({ mentors }: { mentors: RecommendedMentor[] }) => {
  const navigate = useNavigate();
  const [sharedId, setSharedId] = useState<string | null>(null);

  if (mentors.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Compass className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Recommended Mentors for you</CardTitle>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/mentors">Browse all mentors</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {mentors.map((m) => {
              const topTag = m.current_role;
              const expertiseTags = m.expertise ?? [];
              const visibleTags = expertiseTags.slice(0, 2);
              const remainingCount = expertiseTags.length - visibleTags.length;

              return (
                <Card
                  key={m.user_id}
                  onClick={() => navigate(`/book/${m.user_id}`)}
                  className="group relative overflow-hidden cursor-pointer border-0 rounded-2xl aspect-[3/4] bg-[#1a1a2e] hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="absolute top-3 right-3 z-20 flex gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const url = `${window.location.origin}/book/${m.user_id}`;
                        navigator.clipboard.writeText(url);
                        setSharedId(m.user_id);
                        toast.success("Link copied");
                        setTimeout(() => setSharedId(null), 1500);
                      }}
                      className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm text-white hover:bg-black/70"
                    >
                      {sharedId === m.user_id ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                    </button>
                  </div>

                  {m.avatar_url ? (
                    <img
                      src={m.avatar_url}
                      alt={m.full_name}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="rounded-full bg-white/10 text-white text-4xl font-medium w-24 h-24 flex items-center justify-center">
                        {initials(m.full_name)}
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
                      <p className="text-[9px] sm:text-[10px] text-white/75 font-semibold tracking-wide uppercase truncate mb-0.5">
                        {topTag}
                      </p>
                    )}
                    <h3 className="font-bold text-white text-[15px] leading-tight truncate">
                      {m.full_name}
                    </h3>

                    <MentorExpertiseTags tags={expertiseTags} />

                    <div className="flex items-center justify-between gap-2 mt-2">
                      {m.years_experience ? (
                        <div className="text-[11px] text-white/75 whitespace-nowrap">
                          <span className="text-[13px] font-bold text-white">
                            {m.years_experience}
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
                          navigate(`/book/${m.user_id}`);
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
      </CardContent>
    </Card>
  );
};

export default /* @__PURE__ */ memo(RecommendedMentors);

import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, Github, Globe, Clock, Linkedin, FileText, MapPin,
  Briefcase, GraduationCap, Instagram,
} from "lucide-react";
import { useMenteeDetailsForMentor } from "../useMentorMentees";
import { formatTimeWindow } from "@/features/mentee-onboarding/profileOptions";

interface MenteeDetailsDialogProps {
  menteeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const Chips = ({ items }: { items: string[] }) =>
  items.length === 0 ? (
    <span className="text-sm text-muted-foreground italic">Not specified</span>
  ) : (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span
          key={t}
          className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs text-primary"
        >
          {t}
        </span>
      ))}
    </div>
  );

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="text-xs uppercase tracking-wide text-muted-foreground block mb-1.5">
    {children}
  </span>
);

export const MenteeDetailsDialog = ({ menteeId, open, onOpenChange }: MenteeDetailsDialogProps) => {
  const { data: profile, isLoading, error } = useMenteeDetailsForMentor(menteeId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg md:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mentee Details</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error || !profile ? (
          <div className="py-6 text-center text-destructive text-sm">
            Failed to load mentee profile details.
          </div>
        ) : (
          <div className="space-y-5 pt-4 text-sm">
            {/* Header Profile Summary */}
            <div className="flex items-center gap-4 pb-4 border-b">
              <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center text-xl font-bold uppercase overflow-hidden text-slate-700 shrink-0">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.full_name} className="h-full w-full object-cover" />
                ) : (
                  profile.full_name.split(" ").map((s) => s.charAt(0)).slice(0, 2).join("")
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold truncate">{profile.full_name}</h3>
                {profile.headline ? (
                  <p className="text-sm text-muted-foreground mt-0.5 truncate">{profile.headline}</p>
                ) : (
                  <p className="text-sm text-muted-foreground mt-0.5 italic">Mentee</p>
                )}
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                  {profile.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />{profile.location}
                    </span>
                  )}
                  {profile.timezone && (
                    <span className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />{profile.timezone}
                    </span>
                  )}
                  {profile.current_status && (
                    <Badge variant="secondary" className="text-xs">{profile.current_status}</Badge>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Preferred time windows */}
            <div>
              <span className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1 mb-2">
                <Clock className="h-3.5 w-3.5 text-primary" /> Preferred time windows
              </span>
              <Chips items={Array.from(new Set(profile.preferred_time_windows.map(formatTimeWindow)))} />
            </div>

            {profile.preferred_session_types.length > 0 && (
              <div>
                <SectionLabel>Preferred session types</SectionLabel>
                <Chips items={profile.preferred_session_types} />
              </div>
            )}

            {profile.skills.length > 0 && (
              <div>
                <SectionLabel>Skills</SectionLabel>
                <div className="flex flex-wrap gap-1">
                  {profile.skills.map((s: string) => (
                    <Badge key={s} variant="secondary">{s}</Badge>
                  ))}
                </div>
              </div>
            )}

            {profile.languages.length > 0 && (
              <div>
                <SectionLabel>Languages</SectionLabel>
                <Chips items={profile.languages} />
              </div>
            )}

            {(profile.bio || profile.goals) && <Separator />}

            {profile.bio && (
              <div>
                <SectionLabel>About</SectionLabel>
                <p className="whitespace-pre-wrap text-slate-800 dark:text-slate-200">{profile.bio}</p>
              </div>
            )}

            {profile.goals && (
              <div>
                <SectionLabel>Goals</SectionLabel>
                <p className="whitespace-pre-wrap text-slate-800 dark:text-slate-200">{profile.goals}</p>
              </div>
            )}

            {profile.interests && profile.interests.length > 0 && (
              <div>
                <SectionLabel>Interests</SectionLabel>
                <div className="flex flex-wrap gap-1">
                  {profile.interests.map((interest: string) => (
                    <Badge key={interest} variant="secondary">{interest}</Badge>
                  ))}
                </div>
              </div>
            )}

            {profile.preferred_industries.length > 0 && (
              <div>
                <SectionLabel>Preferred industries</SectionLabel>
                <Chips items={profile.preferred_industries} />
              </div>
            )}

            {profile.preferred_mentor_areas && profile.preferred_mentor_areas.length > 0 && (
              <div>
                <SectionLabel>Preferred mentor areas</SectionLabel>
                <div className="flex flex-wrap gap-1">
                  {profile.preferred_mentor_areas.map((area: string) => (
                    <Badge key={area} variant="outline">{area}</Badge>
                  ))}
                </div>
              </div>
            )}

            {profile.preferred_mentor_qualities.length > 0 && (
              <div>
                <SectionLabel>Preferred mentor qualities</SectionLabel>
                <Chips items={profile.preferred_mentor_qualities} />
              </div>
            )}

            {/* Education */}
            {(profile.education_level || profile.education_details || profile.organization_unit || profile.academic_details) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground font-medium">
                    <GraduationCap className="h-3.5 w-3.5 text-primary" /> Education
                  </div>

                  {profile.education_details && (
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-0.5">
                      {profile.education_details.degree && (
                        <p className="font-medium text-sm">
                          {profile.education_details.degree}
                          {profile.education_details.field_of_study && ` in ${profile.education_details.field_of_study}`}
                        </p>
                      )}
                      {profile.education_details.school && (
                        <p className="text-sm text-muted-foreground">{profile.education_details.school}</p>
                      )}
                      {(profile.education_details.start_year || profile.education_details.end_year) && (
                        <p className="text-xs text-muted-foreground">
                          {profile.education_details.start_year ?? "?"} – {profile.education_details.end_year ?? "Present"}
                        </p>
                      )}
                    </div>
                  )}

                  {profile.education_level && (
                    <div>
                      <SectionLabel>Education level</SectionLabel>
                      <span className="text-slate-800 dark:text-slate-200">{profile.education_level}</span>
                    </div>
                  )}

                  {profile.organization_unit && (
                    <div>
                      <SectionLabel>Team / Department</SectionLabel>
                      <span className="text-slate-800 dark:text-slate-200">{profile.organization_unit}</span>
                    </div>
                  )}

                  {profile.academic_details && (
                    <div>
                      <SectionLabel>Academic details</SectionLabel>
                      <span className="text-slate-800 dark:text-slate-200">{profile.academic_details}</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Work Experience */}
            {profile.work_experience && Array.isArray(profile.work_experience) && profile.work_experience.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground font-medium">
                    <Briefcase className="h-3.5 w-3.5 text-primary" /> Work experience
                  </div>
                  {(profile.work_experience as { company?: string; position?: string; start_date?: string; end_date?: string; description?: string }[]).map((exp, i) => (
                    <div key={i} className="rounded-lg border bg-muted/20 p-3 space-y-0.5">
                      {exp.position && (
                        <p className="font-medium text-sm">{exp.position}</p>
                      )}
                      {exp.company && (
                        <p className="text-sm text-muted-foreground">{exp.company}</p>
                      )}
                      {(exp.start_date || exp.end_date) && (
                        <p className="text-xs text-muted-foreground">
                          {exp.start_date ?? "?"} – {exp.end_date ?? "Present"}
                        </p>
                      )}
                      {exp.description && (
                        <p className="text-xs text-muted-foreground mt-1">{exp.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Links */}
            {(profile.github_url || profile.portfolio_url || profile.linkedin_url || profile.resume_url || profile.instagram_url) && (
              <>
                <Separator />
                <div className="flex flex-wrap gap-2">
                  {profile.linkedin_url && (
                    <a
                      href={profile.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <Linkedin className="h-3.5 w-3.5" />
                      LinkedIn
                    </a>
                  )}
                  {profile.github_url && (
                    <a
                      href={profile.github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                    >
                      <Github className="h-3.5 w-3.5" />
                      GitHub
                    </a>
                  )}
                  {profile.portfolio_url && (
                    <a
                      href={profile.portfolio_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border hover:bg-muted transition-colors"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      Portfolio
                    </a>
                  )}
                  {profile.instagram_url && (
                    <a
                      href={profile.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border hover:bg-muted transition-colors"
                    >
                      <Instagram className="h-3.5 w-3.5" />
                      Instagram
                    </a>
                  )}
                  {profile.resume_url && (
                    <a
                      href={profile.resume_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border hover:bg-muted transition-colors"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Resume
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

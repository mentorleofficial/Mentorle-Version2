import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import AvatarUploader from "@/features/mentor-profile/components/AvatarUploader";
import ChipInput from "@/features/mentee-onboarding/components/ChipInput";
import {
  upsertMenteeProfile,
  uploadMenteeAvatar,
  uploadMenteeResume,
} from "@/features/mentee-onboarding/api";
import {
  useMenteeProfile,
  useInvalidateMenteeProfile,
} from "@/features/mentee-onboarding/hooks/useMenteeProfileStatus";
import {
  SKILLS, LANGUAGES, INDUSTRIES, SESSION_TYPES, TIME_WINDOWS,
  MENTOR_QUALITIES, STATUSES, EDUCATION_LEVELS, TIMEZONES,
  formatTimeWindow,
} from "@/features/mentee-onboarding/profileOptions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import {
  Loader2, UserCircle, Target, Link as LinkIcon, Github, Globe,
  Save, Check, Briefcase, GraduationCap, Trash2, Plus,
  Instagram, MapPin, Settings2, Sparkles, User, Edit3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PhoneInput } from "@/components/ui/phone-input";
import ResumeUploadCard from "@/components/profile/ResumeUploadCard";
import { useBranding } from "@/contexts/BrandingContext";

// ─── Moved outside component so they don't remount on each render ───

const SectionCard = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "rounded-xl border border-border bg-card p-6 shadow-sm",
      className
    )}
  >
    {children}
  </div>
);

const FieldLabel = ({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) => (
  <Label
    htmlFor={htmlFor}
    className="text-[13px] font-semibold text-foreground/80"
  >
    {children}
  </Label>
);

type WorkEntry = {
  company: string;
  position: string;
  start_date: string;
  end_date: string;
  description: string;
};

type EducationDetails = {
  degree: string;
  field_of_study: string;
  school: string;
  start_year: string;
  end_year: string;
};

// ────────────────────────────────────────────────────────────────────

const MenteeProfile = () => {
  const { user, profile, refreshProfile } = useAuth();
  const branding = useBranding();
  const { toast } = useToast();
  const invalidate = useInvalidateMenteeProfile();
  const { data, isLoading } = useMenteeProfile(user?.id);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);

  // Original fields
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [orgUnit, setOrgUnit] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [goals, setGoals] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [academicDetails, setAcademicDetails] = useState("");
  const [github, setGithub] = useState("");
  const [portfolio, setPortfolio] = useState("");

  // New fields
  const [phone, setPhone] = useState("");
  const [currentStatus, setCurrentStatus] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [location, setLocation] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [skills, setSkills] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [educationDetails, setEducationDetails] = useState<EducationDetails>({
    degree: "", field_of_study: "", school: "", start_year: "", end_year: "",
  });
  const [workExperience, setWorkExperience] = useState<WorkEntry[]>([]);
  const [preferredIndustries, setPreferredIndustries] = useState<string[]>([]);
  const [preferredSessionTypes, setPreferredSessionTypes] = useState<string[]>([]);
  const [preferredTimeWindows, setPreferredTimeWindows] = useState<string[]>([]);
  const [preferredMentorQualities, setPreferredMentorQualities] = useState<string[]>([]);
  const [instagram, setInstagram] = useState("");
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);

  const [originalData, setOriginalData] = useState<any>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!data || hydrated) return;
    const d = data as any;
    const initial = {
      fullName: data.full_name || "",
      avatarUrl: data.avatar_url,
      headline: d.headline || "",
      bio: d.bio || "",
      orgUnit: d.organization_unit || "",
      linkedin: d.linkedin_url || "",
      goals: d.goals || "",
      interests: d.interests || [],
      areas: d.preferred_mentor_areas || [],
      academicDetails: d.academic_details ?? "",
      github: d.github_url ?? "",
      portfolio: d.portfolio_url ?? "",
      phone: d.phone ?? "",
      currentStatus: d.current_status ?? "",
      educationLevel: d.education_level ?? "",
      location: d.location ?? "",
      timezone: d.timezone ?? "Asia/Kolkata",
      skills: d.skills ?? [],
      languages: d.languages ?? [],
      educationDetails: d.education_details ?? { degree: "", field_of_study: "", school: "", start_year: "", end_year: "" },
      workExperience: d.work_experience ?? [],
      preferredIndustries: d.preferred_industries ?? [],
      preferredSessionTypes: d.preferred_session_types ?? [],
      preferredTimeWindows: Array.from(new Set((d.preferred_time_windows ?? []).map(formatTimeWindow))),
      preferredMentorQualities: d.preferred_mentor_qualities ?? [],
      instagram: d.instagram_url ?? "",
      resumeUrl: d.resume_url ?? null,
    };
    setFullName(initial.fullName);
    setAvatarUrl(initial.avatarUrl);
    setHeadline(initial.headline);
    setBio(initial.bio);
    setOrgUnit(initial.orgUnit);
    setLinkedin(initial.linkedin);
    setGoals(initial.goals);
    setInterests(initial.interests);
    setAreas(initial.areas);
    setAcademicDetails(initial.academicDetails);
    setGithub(initial.github);
    setPortfolio(initial.portfolio);
    setPhone(initial.phone);
    setCurrentStatus(initial.currentStatus);
    setEducationLevel(initial.educationLevel);
    setLocation(initial.location);
    setTimezone(initial.timezone);
    setSkills(initial.skills);
    setLanguages(initial.languages);
    setEducationDetails(initial.educationDetails);
    setWorkExperience(initial.workExperience);
    setPreferredIndustries(initial.preferredIndustries);
    setPreferredSessionTypes(initial.preferredSessionTypes);
    setPreferredTimeWindows(initial.preferredTimeWindows);
    setPreferredMentorQualities(initial.preferredMentorQualities);
    setInstagram(initial.instagram);
    setResumeUrl(initial.resumeUrl);
    setOriginalData(initial);
    setHydrated(true);
  }, [data, hydrated]);

  const hasChanges = useMemo(() => {
    if (!originalData) return false;
    return (
      fullName !== originalData.fullName ||
      headline !== originalData.headline ||
      bio !== originalData.bio ||
      orgUnit !== originalData.orgUnit ||
      linkedin !== originalData.linkedin ||
      goals !== originalData.goals ||
      academicDetails !== originalData.academicDetails ||
      github !== originalData.github ||
      portfolio !== originalData.portfolio ||
      phone !== originalData.phone ||
      currentStatus !== originalData.currentStatus ||
      educationLevel !== originalData.educationLevel ||
      location !== originalData.location ||
      timezone !== originalData.timezone ||
      instagram !== originalData.instagram ||
      JSON.stringify(interests) !== JSON.stringify(originalData.interests) ||
      JSON.stringify(areas) !== JSON.stringify(originalData.areas) ||
      JSON.stringify(skills) !== JSON.stringify(originalData.skills) ||
      JSON.stringify(languages) !== JSON.stringify(originalData.languages) ||
      JSON.stringify(educationDetails) !== JSON.stringify(originalData.educationDetails) ||
      JSON.stringify(workExperience) !== JSON.stringify(originalData.workExperience) ||
      JSON.stringify(preferredIndustries) !== JSON.stringify(originalData.preferredIndustries) ||
      JSON.stringify(preferredSessionTypes) !== JSON.stringify(originalData.preferredSessionTypes) ||
      JSON.stringify(preferredTimeWindows) !== JSON.stringify(originalData.preferredTimeWindows) ||
      JSON.stringify(preferredMentorQualities) !== JSON.stringify(originalData.preferredMentorQualities)
    );
  }, [originalData, fullName, headline, bio, orgUnit, linkedin, goals, interests, areas,
    academicDetails, github, portfolio, phone, currentStatus, educationLevel, location,
    timezone, skills, languages, educationDetails, workExperience, preferredIndustries,
    preferredSessionTypes, preferredTimeWindows, preferredMentorQualities, instagram]);

  const completeness = useMemo(() => {
    const fields = [
      fullName, headline, bio, orgUnit, goals, academicDetails, linkedin,
      currentStatus, location,
      interests.length > 0 ? "x" : "",
      areas.length > 0 ? "x" : "",
      skills.length > 0 ? "x" : "",
    ];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }, [fullName, headline, bio, orgUnit, goals, academicDetails, linkedin,
    currentStatus, location, interests, areas, skills]);

  const loading = isLoading && !hydrated;

  const initials = (fullName || profile?.email || "U")
    .split(" ")
    .map((s) => s.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const firstName = fullName.trim().split(" ")[0] ?? "";

  const addProtocol = (url: string) => {
    if (!url) return "";
    let clean = url.trim().replace(/\/+$/, "");
    if (clean && !/^https?:\/\//i.test(clean)) clean = `https://${clean}`;
    return clean;
  };

  const handleAvatar = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const url = await uploadMenteeAvatar(user.id, file);
      await upsertMenteeProfile(user.id, { avatar_url: url });
      setAvatarUrl(url);
      await refreshProfile();
      toast({ title: "Profile photo updated" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Upload failed", description: e?.message });
    } finally {
      setUploading(false);
    }
  };

  const handleResumeUpload = async (file: File) => {
    if (!file || !user) return;
    setUploadingResume(true);
    try {
      const url = await uploadMenteeResume(user.id, file);
      await upsertMenteeProfile(user.id, { resume_url: url } as any);
      setResumeUrl(url);
      toast({ title: "Resume uploaded" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Upload failed", description: e?.message });
    } finally {
      setUploadingResume(false);
    }
  };

  const handleRemoveResume = async () => {
    if (!user) return;
    try {
      await upsertMenteeProfile(user.id, { resume_url: null } as any);
      setResumeUrl(null);
      toast({ title: "Resume removed" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed", description: e?.message });
    }
  };

  const addWorkEntry = () =>
    setWorkExperience((prev) => [...prev, { company: "", position: "", start_date: "", end_date: "", description: "" }]);
  const removeWorkEntry = (i: number) =>
    setWorkExperience((prev) => prev.filter((_, idx) => idx !== i));
  const updateWorkEntry = (i: number, field: keyof WorkEntry, value: string) =>
    setWorkExperience((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)));

  const toggleCheckbox = (
    list: string[],
    setList: (v: string[]) => void,
    value: string
  ) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const handleSave = async () => {
    if (!user || !hasChanges) return;
    const cleanLinkedin = addProtocol(linkedin);
    const cleanGithub = addProtocol(github);
    const cleanPortfolio = addProtocol(portfolio);
    const cleanInstagram = addProtocol(instagram);

    if (cleanLinkedin && !/linkedin\.com\/(in|pub)\//i.test(cleanLinkedin)) {
      toast({ variant: "destructive", title: "Invalid LinkedIn", description: "Must be a linkedin.com/in/… URL" });
      return;
    }
    if (cleanGithub && !/github\.com\//i.test(cleanGithub)) {
      toast({ variant: "destructive", title: "Invalid GitHub", description: "Must be a github.com/… URL" });
      return;
    }
    if (cleanPortfolio) {
      try { new URL(cleanPortfolio); } catch {
        toast({ variant: "destructive", title: "Invalid URL", description: "Portfolio must be a valid URL" });
        return;
      }
    }

    setSaving(true);
    try {
      await upsertMenteeProfile(user.id, {
        full_name: fullName.trim(),
        headline: headline.trim(),
        bio: bio.trim(),
        organization_unit: orgUnit.trim(),
        linkedin_url: cleanLinkedin,
        goals: goals.trim(),
        interests,
        preferred_mentor_areas: areas,
        academic_details: academicDetails.trim(),
        github_url: cleanGithub,
        portfolio_url: cleanPortfolio,
        phone: phone.trim() || null,
        current_status: currentStatus || null,
        education_level: educationLevel || null,
        location: location.trim() || null,
        timezone: timezone || null,
        skills,
        languages,
        education_details: educationDetails,
        work_experience: workExperience,
        preferred_industries: preferredIndustries,
        preferred_session_types: preferredSessionTypes,
        preferred_time_windows: preferredTimeWindows,
        preferred_mentor_qualities: preferredMentorQualities,
        instagram_url: cleanInstagram || null,
      } as any);
      await refreshProfile();
      invalidate(user.id);
      setOriginalData({
        ...originalData,
        fullName: fullName.trim(),
        headline: headline.trim(),
        bio: bio.trim(),
        orgUnit: orgUnit.trim(),
        linkedin: cleanLinkedin,
        goals: goals.trim(),
        interests,
        areas,
        academicDetails: academicDetails.trim(),
        github: cleanGithub,
        portfolio: cleanPortfolio,
        phone: phone.trim(),
        currentStatus,
        educationLevel,
        location: location.trim(),
        timezone,
        skills,
        languages,
        educationDetails,
        workExperience,
        preferredIndustries,
        preferredSessionTypes,
        preferredTimeWindows,
        preferredMentorQualities,
        instagram: cleanInstagram,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast({ title: "Profile saved" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to save", description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-40">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mb-6 space-y-6">

        {/* Header */}
        {completeness < 100 && (
          <div className="bg-gradient-to-tr from-primary to-accent text-white rounded-lg p-6 shadow-md">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 bg-white/10 p-2.5 rounded-full">
                <User className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-2">Welcome to {branding.app_name}! 🎉</h2>
                <p className="text-white/90 text-sm mb-4 font-semibold">
                  Let's complete your profile to get started. This helps us match you with the right mentors
                  and personalize your experience.
                </p>
                <div className="flex items-center gap-2 text-xs text-white/80">
                  <Edit3 className="w-4 h-4" />
                  <span>Fill in the details below to complete your profile</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 lg:gap-6">

          {/* Left column */}
          <div className="space-y-6">

            {/* Photo & Basics */}
            <SectionCard>
              <div className="flex items-center gap-2 mb-1">
                <UserCircle className="h-4 w-4 text-primary" />
                <h2 className="text-[15px] font-semibold">Photo & basics</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-6">
                How others see you in the mentor directory
              </p>

              <div className="flex justify-center mb-6">
                <AvatarUploader
                  url={avatarUrl}
                  fallback={initials}
                  uploading={uploading}
                  onSelect={handleAvatar}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="fullName">Full name</FieldLabel>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Alex Rivera"
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="orgUnit">Team / department</FieldLabel>
                  <Input
                    id="orgUnit"
                    value={orgUnit}
                    onChange={(e) => setOrgUnit(e.target.value)}
                    placeholder="Growth Engineering"
                  />
                </div>
              </div>

              <div className="space-y-1.5 mb-4">
                <FieldLabel htmlFor="headline">Headline</FieldLabel>
                <Input
                  id="headline"
                  value={headline}
                  maxLength={160}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Aspiring product engineer passionate about AI tools"
                />
                <p className="text-[11px] text-muted-foreground text-right">
                  {headline.length}/160
                </p>
              </div>

              <div className="space-y-1.5">
                <FieldLabel htmlFor="bio">About me</FieldLabel>
                <Textarea
                  id="bio"
                  rows={4}
                  value={bio}
                  maxLength={600}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Share your background, journey, and what you're looking for…"
                  className="resize-none"
                />
                <p className="text-[11px] text-muted-foreground text-right">
                  {bio.length}/600
                </p>
              </div>
            </SectionCard>

            {/* Contact & Status */}
            <SectionCard>
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="h-4 w-4 text-primary" />
                <h2 className="text-[15px] font-semibold">Contact & status</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-6">
                Your current situation and location
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="phone">Phone number</FieldLabel>
                  <PhoneInput
                    value={phone}
                    onChange={setPhone}
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Current status</FieldLabel>
                  <Select value={currentStatus} onValueChange={setCurrentStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status…" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="location">Location</FieldLabel>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Bangalore, India"
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Timezone</FieldLabel>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select timezone…" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </SectionCard>

            {/* Education */}
            <SectionCard>
              <div className="flex items-center gap-2 mb-1">
                <GraduationCap className="h-4 w-4 text-primary" />
                <h2 className="text-[15px] font-semibold">Education</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-6">
                Your academic background
              </p>

              <div className="space-y-1.5 mb-4">
                <FieldLabel>Education level</FieldLabel>
                <Select value={educationLevel} onValueChange={setEducationLevel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select level…" />
                  </SelectTrigger>
                  <SelectContent>
                    {EDUCATION_LEVELS.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 mb-4">
                <FieldLabel htmlFor="academic">Academic / professional background</FieldLabel>
                <Input
                  id="academic"
                  value={academicDetails}
                  onChange={(e) => setAcademicDetails(e.target.value)}
                  placeholder="BS Computer Science @ Stanford University, Class of 2027"
                />
              </div>

              <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
                <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Latest degree details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="edu-degree">Degree</FieldLabel>
                    <Input
                      id="edu-degree"
                      value={educationDetails.degree}
                      onChange={(e) => setEducationDetails((p) => ({ ...p, degree: e.target.value }))}
                      placeholder="B.Tech / BSc / MBA…"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="edu-field">Field of study</FieldLabel>
                    <Input
                      id="edu-field"
                      value={educationDetails.field_of_study}
                      onChange={(e) => setEducationDetails((p) => ({ ...p, field_of_study: e.target.value }))}
                      placeholder="Computer Science"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <FieldLabel htmlFor="edu-school">School / university</FieldLabel>
                    <Input
                      id="edu-school"
                      value={educationDetails.school}
                      onChange={(e) => setEducationDetails((p) => ({ ...p, school: e.target.value }))}
                      placeholder="IIT Bombay"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>Start year</FieldLabel>
                    {(() => {
                      const CURRENT_YEAR = new Date().getFullYear();
                      const YEARS = Array.from({ length: CURRENT_YEAR + 10 - 1950 + 1 }, (_, i) => CURRENT_YEAR + 10 - i);
                      return (
                        <Select
                          value={educationDetails.start_year || ""}
                          onValueChange={(v) => setEducationDetails((p) => ({ ...p, start_year: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select year" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[200px]">
                            {YEARS.map((y) => (
                              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      );
                    })()}
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>End year</FieldLabel>
                    {(() => {
                      const CURRENT_YEAR = new Date().getFullYear();
                      const startY = parseInt(educationDetails.start_year, 10) || 1950;
                      const YEARS = Array.from({ length: CURRENT_YEAR + 10 - startY + 1 }, (_, i) => CURRENT_YEAR + 10 - i).filter(y => y >= startY);
                      const isPresent = educationDetails.end_year === "present";
                      return (
                        <>
                          <Select
                            value={isPresent ? "" : (educationDetails.end_year || "")}
                            onValueChange={(v) => setEducationDetails((p) => ({ ...p, end_year: v }))}
                            disabled={isPresent}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select year" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px]">
                              {YEARS.map((y) => (
                                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer mt-1">
                            <Checkbox
                              checked={isPresent}
                              onCheckedChange={(c) =>
                                setEducationDetails((p) => ({ ...p, end_year: c ? "present" : String(new Date().getFullYear()) }))
                              }
                            />
                            Present
                          </label>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Work Experience */}
            <SectionCard>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" />
                  <h2 className="text-[15px] font-semibold">Work experience</h2>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addWorkEntry} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mb-6">
                Your professional experience
              </p>

              {workExperience.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No experience added yet. Click "Add" to start.
                </p>
              )}

              <div className="space-y-4">
                {workExperience.map((entry, i) => (
                  <div key={i} className="border rounded-lg p-4 space-y-3 bg-muted/20 relative">
                    <button
                      type="button"
                      onClick={() => removeWorkEntry(i)}
                      className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-6">
                      <div className="space-y-1.5">
                        <FieldLabel>Company / organization</FieldLabel>
                        <Input
                          value={entry.company}
                          onChange={(e) => updateWorkEntry(i, "company", e.target.value)}
                          placeholder="Acme Corp"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <FieldLabel>Position / role</FieldLabel>
                        <Input
                          value={entry.position}
                          onChange={(e) => updateWorkEntry(i, "position", e.target.value)}
                          placeholder="Software Engineer"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <FieldLabel>Start date</FieldLabel>
                        <MonthYearPicker
                          value={entry.start_date}
                          onChange={(val) => updateWorkEntry(i, "start_date", val)}
                          placeholder="Select start date"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <FieldLabel>End date</FieldLabel>
                        <MonthYearPicker
                          value={entry.end_date}
                          disabled={!entry.end_date}
                          onChange={(val) => updateWorkEntry(i, "end_date", val)}
                          placeholder="Select end date"
                        />
                        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer mt-1">
                          <Checkbox
                            checked={!entry.end_date}
                            onCheckedChange={(c) =>
                              updateWorkEntry(i, "end_date", c ? "" : entry.start_date)
                            }
                          />
                          I currently work here
                        </label>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>Description</FieldLabel>
                      <Textarea
                        rows={2}
                        value={entry.description}
                        onChange={(e) => updateWorkEntry(i, "description", e.target.value)}
                        placeholder="What did you do there?"
                        className="resize-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Skills & Languages */}
            <SectionCard>
              <div className="flex items-center gap-2 mb-1">
                <Settings2 className="h-4 w-4 text-primary" />
                <h2 className="text-[15px] font-semibold">Skills & languages</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-6">
                Highlight what you know and what languages you speak
              </p>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <FieldLabel>Skills</FieldLabel>
                  <ChipInput
                    value={skills}
                    onChange={setSkills}
                    placeholder="Add skill…"
                    suggestions={SKILLS}
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Languages</FieldLabel>
                  <ChipInput
                    value={languages}
                    onChange={setLanguages}
                    placeholder="Add language…"
                    suggestions={LANGUAGES}
                  />
                </div>
              </div>
            </SectionCard>

            {/* Goals & Interests */}
            <SectionCard>
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-primary" />
                <h2 className="text-[15px] font-semibold">Goals & interests</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-6">
                Help us match you with the most relevant mentors
              </p>

              <div className="space-y-1.5 mb-4">
                <FieldLabel htmlFor="goals">Goals</FieldLabel>
                <Textarea
                  id="goals"
                  rows={4}
                  value={goals}
                  maxLength={800}
                  onChange={(e) => setGoals(e.target.value)}
                  placeholder="What are you hoping to achieve? Career growth, skill development…"
                  className="resize-none"
                />
                <p className="text-[11px] text-muted-foreground text-right">
                  {goals.length}/800
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-4">
                <div className="space-y-1.5">
                  <FieldLabel>Interests</FieldLabel>
                  <ChipInput
                    value={interests}
                    onChange={setInterests}
                    placeholder="Add interest…"
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Preferred mentor areas</FieldLabel>
                  <ChipInput
                    value={areas}
                    onChange={setAreas}
                    placeholder="Add area…"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <FieldLabel>Preferred industries</FieldLabel>
                <ChipInput
                  value={preferredIndustries}
                  onChange={setPreferredIndustries}
                  placeholder="Add industry…"
                  suggestions={INDUSTRIES}
                />
              </div>
            </SectionCard>

            {/* Mentorship Preferences */}
            <SectionCard>
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-primary" />
                <h2 className="text-[15px] font-semibold">Mentorship preferences</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-6">
                Tell mentors how you learn best
              </p>

              <div className="space-y-6">
                <div>
                  <FieldLabel>Preferred session types</FieldLabel>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SESSION_TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleCheckbox(preferredSessionTypes, setPreferredSessionTypes, t)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs transition-colors",
                          preferredSessionTypes.includes(t)
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card hover:border-primary/50"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <FieldLabel>Preferred time windows</FieldLabel>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {TIME_WINDOWS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleCheckbox(preferredTimeWindows, setPreferredTimeWindows, t)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs transition-colors",
                          preferredTimeWindows.includes(t)
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card hover:border-primary/50"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <FieldLabel>Preferred mentor qualities</FieldLabel>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {MENTOR_QUALITIES.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => toggleCheckbox(preferredMentorQualities, setPreferredMentorQualities, q)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs transition-colors",
                          preferredMentorQualities.includes(q)
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card hover:border-primary/50"
                        )}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Social Links */}
            <SectionCard>
              <div className="flex items-center gap-2 mb-1">
                <LinkIcon className="h-4 w-4 text-primary" />
                <h2 className="text-[15px] font-semibold">Social links</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-6">
                Your online presence
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="linkedin">
                    <span className="flex items-center gap-1.5">
                      <LinkIcon className="h-3.5 w-3.5" /> LinkedIn
                    </span>
                  </FieldLabel>
                  <Input
                    id="linkedin"
                    value={linkedin}
                    onChange={(e) => setLinkedin(e.target.value)}
                    placeholder="linkedin.com/in/…"
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="github">
                    <span className="flex items-center gap-1.5">
                      <Github className="h-3.5 w-3.5" /> GitHub
                    </span>
                  </FieldLabel>
                  <Input
                    id="github"
                    value={github}
                    onChange={(e) => setGithub(e.target.value)}
                    placeholder="github.com/…"
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="portfolio">
                    <span className="flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5" /> Portfolio
                    </span>
                  </FieldLabel>
                  <Input
                    id="portfolio"
                    value={portfolio}
                    onChange={(e) => setPortfolio(e.target.value)}
                    placeholder="yoursite.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="instagram">
                    <span className="flex items-center gap-1.5">
                      <Instagram className="h-3.5 w-3.5" /> Instagram
                    </span>
                  </FieldLabel>
                  <Input
                    id="instagram"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    placeholder="instagram.com/…"
                  />
                </div>
              </div>
            </SectionCard>

            {/* Resume */}
            <ResumeUploadCard
              hasResume={!!resumeUrl}
              viewHref={resumeUrl}
              uploading={uploadingResume}
              onSelectFile={handleResumeUpload}
              onRemove={handleRemoveResume}
              maxSizeMb={10}
            />

          </div>

          {/* Sidebar */}
          <div className="lg:sticky lg:top-6 space-y-4 self-start">
            <SectionCard>
              <h2 className="text-[15px] font-semibold mb-1">Profile preview</h2>
              <p className="text-xs text-muted-foreground mb-4">
                How mentors will see you
              </p>

              <div className="mb-5">
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>Completeness</span>
                  <span>{completeness}%</span>
                </div>
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-foreground/70 transition-all duration-300"
                    style={{ width: `${completeness}%` }}
                  />
                </div>
              </div>

              <Separator className="mb-5" />

              <div className="flex flex-col items-center text-center">
                <div className="mb-3 scale-90">
                  <AvatarUploader
                    url={avatarUrl}
                    fallback={initials}
                    uploading={uploading}
                    onSelect={handleAvatar}
                  />
                </div>
                <p className="font-medium text-[15px]">{fullName || "Your name"}</p>
                {headline && (
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                    {headline}
                  </p>
                )}
                {currentStatus && (
                  <span className="mt-2 text-xs rounded-full border px-2 py-0.5 text-muted-foreground">
                    {currentStatus}
                  </span>
                )}
                {location && (
                  <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {location}
                  </p>
                )}
              </div>

              {skills.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-2 uppercase tracking-wide">Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {skills.slice(0, 6).map((s) => (
                        <span key={s} className="text-xs rounded-full bg-muted px-2 py-0.5">{s}</span>
                      ))}
                      {skills.length > 6 && (
                        <span className="text-xs text-muted-foreground">+{skills.length - 6}</span>
                      )}
                    </div>
                  </div>
                </>
              )}
            </SectionCard>
          </div>

        </div>
      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-0 z-20 border-t bg-background/95 backdrop-blur shadow-lg -mx-3 -mb-3 sm:-mx-4 sm:-mb-4 md:-mx-6 md:-mb-6 px-3 sm:px-4 md:px-6 py-3 mt-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            {hasChanges ? (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                Unsaved changes
              </>
            ) : saved ? (
              <>
                <Check className="h-4 w-4 text-primary" />
                Profile saved
              </>
            ) : (
              "Your profile"
            )}
          </p>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="w-full sm:w-auto min-w-[140px] gap-2"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default MenteeProfile;

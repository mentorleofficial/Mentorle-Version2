import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  Sparkles,
  Briefcase,
  GraduationCap,
  Link2,
  CheckCircle2,
  Loader2,
  Mail,
  Phone,
  Building2,
  Linkedin,
  Globe,
} from "lucide-react";
import {
  mentorProfileSchema,
  type MentorProfileFormValues,
  type ExperienceValue,
  useMentorProfile,
  useUpdateMentorProfile,
  uploadAvatar,
  uploadResume,
} from "@/features/mentor-profile";
import ExpertiseInput from "@/features/mentor-profile/components/ExpertiseInput";
import ExperienceList from "@/features/mentor-profile/components/ExperienceList";
import QualificationsList from "@/features/mentor-profile/components/QualificationsList";
import ResumeUploadCard from "@/components/profile/ResumeUploadCard";
import { getResumeSignedUrl } from "@/features/mentor-profile/api/mentorProfile";
import AvatarUploader from "@/features/mentor-profile/components/AvatarUploader";
import { calculateCompleteness } from "@/features/mentor-profile/utils/completeness";
import ProfileCompletionChecklist from "@/features/mentor-profile/components/ProfileCompletionChecklist";

const SECTIONS = [
  { id: "about", label: "About", icon: User },
  { id: "expertise", label: "Expertise", icon: Sparkles },
  { id: "experience", label: "Experience", icon: Briefcase },
  { id: "education", label: "Education", icon: GraduationCap },
  { id: "links", label: "Links & Resume", icon: Link2 },
] as const;

const initialsOf = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "M";

const MentorProfile = () => {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const userId = user?.id;
  const { data, isLoading } = useMentorProfile(userId);
  const update = useUpdateMentorProfile(userId ?? "");

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [pendingResume, setPendingResume] = useState<File | null>(null);
  const [resumePath, setResumePath] = useState<string>("");
  const [activeSection, setActiveSection] = useState<string>("about");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [viewingResume, setViewingResume] = useState(false);

  const handleViewResume = async () => {
    if (!resumePath) return;
    setViewingResume(true);
    try {
      const url = await getResumeSignedUrl(resumePath);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Error signing resume URL:", err);
    } finally {
      setViewingResume(false);
    }
  };

  const form = useForm<MentorProfileFormValues>({
    resolver: zodResolver(mentorProfileSchema),
    mode: "onBlur",
    defaultValues: {
      full_name: "",
      phone: "",
      headline: "",
      bio: "",
      current_organization: "",
      current_role: "",
      professional_status: "",
      years_experience: 0,
      linkedin_url: "",
      portfolio_url: "",
      expertise: [],
      qualifications: [],
      experiences: [],
    },
  });

  // hydrate
  useEffect(() => {
    if (!data) return;
    form.reset({
      full_name: data.full_name,
      phone: data.phone,
      headline: data.headline,
      bio: data.bio,
      current_organization: data.current_organization,
      current_role: data.current_role,
      professional_status: data.professional_status || "",
      years_experience: data.years_experience,
      linkedin_url: data.linkedin_url,
      portfolio_url: data.portfolio_url,
      expertise: data.expertise,
      qualifications: data.qualifications,
      experiences: data.experiences,
    });
    setAvatarUrl(data.avatar_url);
    setResumePath(data.resume_url);
  }, [data, form]);

  const watched = form.watch();

  const status = form.watch("professional_status");
  useEffect(() => {
    if (!status) return;
    const orgRequired = ["Employed", "Entrepreneur", "Faculty / Academician", "Research Scholar", "Retired Professional", "Student / Higher Education"].includes(status);
    const orgOptional = ["Self-Employed / Consultant", "Career Break", "Other"].includes(status);
    const showOrg = orgRequired || orgOptional;
    const roleRequired = ["Employed", "Self-Employed / Consultant", "Entrepreneur", "Faculty / Academician", "Research Scholar", "Retired Professional", "Student / Higher Education", "Other"].includes(status);

    if (!showOrg) form.setValue("current_organization", "");
    if (!roleRequired) form.setValue("current_role", "");
  }, [status, form]);

  const watchedRole = form.watch("current_role");
  const watchedOrg = form.watch("current_organization");
  const watchedExperiences = form.watch("experiences");

  // Sync Current Role/Org to Experiences
  useEffect(() => {
    const currentExperiences = form.getValues("experiences") || [];
    const currentRole = form.getValues("current_role") || "";
    const currentOrg = form.getValues("current_organization") || "";

    const presentIndex = currentExperiences.findIndex((exp) => !exp.end_date);
    const roleChanged = currentRole !== (presentIndex !== -1 ? currentExperiences[presentIndex].title : "");
    const orgChanged = currentOrg !== (presentIndex !== -1 ? currentExperiences[presentIndex].company : "");

    if (roleChanged || orgChanged) {
      if (presentIndex !== -1) {
        const updated = [...currentExperiences];
        updated[presentIndex] = {
          ...updated[presentIndex],
          title: currentRole,
          company: currentOrg,
        };
        form.setValue("experiences", updated, { shouldDirty: true, shouldValidate: true });
      } else if (currentRole || currentOrg) {
        const newExp: ExperienceValue = {
          title: currentRole,
          company: currentOrg,
          location: "",
          start_date: new Date().toISOString().substring(0, 7), // YYYY-MM
          end_date: "",
          description: "",
        };
        form.setValue("experiences", [...currentExperiences, newExp], { shouldDirty: true, shouldValidate: true });
      }
    }
  }, [watchedRole, watchedOrg]);

  // Sync Experiences to Current Role/Org
  useEffect(() => {
    const currentExperiences = form.getValues("experiences") || [];
    const currentRole = form.getValues("current_role") || "";
    const currentOrg = form.getValues("current_organization") || "";

    const presentIndex = currentExperiences.findIndex((exp) => !exp.end_date);

    if (presentIndex !== -1) {
      const presentExp = currentExperiences[presentIndex];
      const roleDiff = currentRole !== presentExp.title;
      const orgDiff = currentOrg !== presentExp.company;

      if (roleDiff || orgDiff) {
        if (roleDiff) form.setValue("current_role", presentExp.title, { shouldDirty: true, shouldValidate: true });
        if (orgDiff) form.setValue("current_organization", presentExp.company, { shouldDirty: true, shouldValidate: true });
      }
    } else {
      if (currentRole || currentOrg) {
        form.setValue("current_role", "", { shouldDirty: true, shouldValidate: true });
        form.setValue("current_organization", "", { shouldDirty: true, shouldValidate: true });
      }
    }
  }, [watchedExperiences]);

  // Profile completeness
  const completeness = useMemo(() => {
    if (!watched) return 0;
    const { percentage } = calculateCompleteness({
      ...watched,
      email: data?.email,
      resume_url: resumePath || (pendingResume ? "pending" : ""),
      avatar_url: avatarUrl || (pendingAvatar ? "pending" : ""),
      has_offerings: data?.has_offerings,
    });
    return percentage;
  }, [watched, data?.email, resumePath, pendingResume, avatarUrl, pendingAvatar, data?.has_offerings]);

  // Section scroll spy
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveSection(e.target.id);
        });
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [isLoading]);

  const onAvatarSelect = async (f: File) => {
    if (!userId) return;
    setPendingAvatar(f);
    setUploadingAvatar(true);
    try {
      const url = await uploadAvatar(userId, f);
      setAvatarUrl(url);
      toast({ title: "Photo updated", description: "Save changes to confirm." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload failed", description: err.message });
      setPendingAvatar(null);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const onSubmit = async (values: MentorProfileFormValues) => {
    if (!userId) return;
    try {
      let newResumePath = resumePath;
      if (pendingResume) {
        newResumePath = await uploadResume(userId, pendingResume);
      }
      await update.mutateAsync({
        ...values,
        avatar_url: avatarUrl,
        resume_url: newResumePath,
      });
      setResumePath(newResumePath);
      setPendingResume(null);
      setPendingAvatar(null);
      toast({ title: "Profile saved", description: "Your changes are live." });
      await refreshProfile();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Save failed", description: err.message });
    }
  };

  const dirty = form.formState.isDirty || !!pendingResume || !!pendingAvatar;

  if (isLoading || !data) {
    return (
      <AppLayout>
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-7xl mx-auto pb-6">
        {/* Banner header */}
        <div className="relative overflow-hidden rounded-xl border bg-card">
          <div className="h-32 bg-gradient-to-br from-primary via-primary/80 to-primary/40" />
          <div className="px-6 pb-6 -mt-12">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <AvatarUploader
                  url={avatarUrl}
                  fallback={initialsOf(watched.full_name || data.full_name)}
                  uploading={uploadingAvatar}
                  onSelect={onAvatarSelect}
                />
                <div className="flex-1 min-w-0 sm:pb-1">
                  <h1 className="text-2xl font-bold truncate">{watched.full_name || "Your name"}</h1>
                  <p className="text-sm text-muted-foreground truncate">
                    {watched.headline || "Add a headline so mentees know what you do"}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                    {watched.current_role && watched.current_organization && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> {watched.current_role} at {watched.current_organization}
                      </span>
                    )}
                    <Badge variant={data.is_active ? "default" : "secondary"} className="text-[10px]">
                      {data.is_active ? "● Active mentor" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              </div>
              {data.is_active && userId && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const handle = (data as any)?.slug || userId;
                      const url = `${window.location.origin}/mentors/${handle}`;
                      await navigator.clipboard.writeText(url);
                      toast({ title: "Link copied", description: "Your public profile URL is on your clipboard." });
                    }}
                  >
                    Copy public link
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={async () => {
                      const handle = (data as any)?.slug || userId;
                      const url = `${window.location.origin}/mentors/${handle}`;
                      const caption = `Excited to share my mentor profile on ${document.title.split(" ")[0] || "Mentorle"}! 🚀\n\nIf you'd like guidance, let's connect.\n\nCheck out my profile: ${url}`;
                      try {
                        await navigator.clipboard.writeText(caption);
                        toast({ title: "Caption copied", description: "Paste it on LinkedIn if it doesn't appear automatically." });
                      } catch { /* clipboard blocked */ }
                      window.open(
                        `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(caption)}`,
                        "_blank",
                        "noopener,noreferrer,width=720,height=720"
                      );
                    }}
                    className="bg-[#0A66C2] hover:bg-[#0A66C2]/90 text-white"
                  >
                    Share on LinkedIn
                  </Button>
                </div>
              )}
            </div>
            <div className="mt-5 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">Profile completeness</span>
                <span className="text-muted-foreground">{completeness}%</span>
              </div>
              <Progress value={completeness} className="h-1.5" />
            </div>
          </div>
        </div>

        {/* Missing requirements checklist */}
        {completeness < 100 && (
          <div className="mt-6">
            <ProfileCompletionChecklist
              profileData={{
                ...watched,
                email: data?.email,
                resume_url: resumePath || (pendingResume ? "pending" : ""),
                avatar_url: avatarUrl || (pendingAvatar ? "pending" : ""),
                has_offerings: data?.has_offerings,
              }}
            />
          </div>
        )}

        {/* Sticky section nav */}
        <nav className="sticky top-0 z-10 -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 py-2 bg-background/90 backdrop-blur border-b mt-6 mb-6">
          <div className="flex gap-1 overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const active = activeSection === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className={`flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs sm:text-sm whitespace-nowrap transition-colors ${
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  {s.label}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="space-y-6">
          {/* About */}
          <Card id="about" className="scroll-mt-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" /> About you
              </CardTitle>
              <CardDescription>Basic contact info and how you describe yourself.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Full name *</Label>
                  <Input {...form.register("full_name")} placeholder="Jane Doe" />
                  {form.formState.errors.full_name && (
                    <p className="text-xs text-destructive">{form.formState.errors.full_name.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" /> Email
                  </Label>
                  <Input value={data.email} disabled className="bg-muted/40" />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" /> Contact number *
                  </Label>
                  <Input
                    type="tel"
                    placeholder="+1 555 123 4567"
                    {...form.register("phone")}
                    onInput={(e) => {
                      const el = e.currentTarget;
                      const cleaned = el.value.replace(/[^0-9+\-\s().]/g, "");
                      if (cleaned !== el.value) el.value = cleaned;
                    }}
                  />
                  {form.formState.errors.phone && (
                    <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Years of experience *</Label>
                  <Input type="number" min={0} max={60} {...form.register("years_experience")} />
                  {form.formState.errors.years_experience && (
                    <p className="text-xs text-destructive">{form.formState.errors.years_experience.message}</p>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Professional Status *</Label>
                  <Controller
                    control={form.control}
                    name="professional_status"
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Employed">Employed</SelectItem>
                          <SelectItem value="Self-Employed / Consultant">Self-Employed / Consultant</SelectItem>
                          <SelectItem value="Entrepreneur">Entrepreneur</SelectItem>
                          <SelectItem value="Faculty / Academician">Faculty / Academician</SelectItem>
                          <SelectItem value="Research Scholar">Research Scholar</SelectItem>
                          <SelectItem value="Retired Professional">Retired Professional</SelectItem>
                          <SelectItem value="Student / Higher Education">Student / Higher Education</SelectItem>
                          <SelectItem value="Career Break">Career Break</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {form.formState.errors.professional_status && (
                    <p className="text-xs text-destructive">{form.formState.errors.professional_status.message}</p>
                  )}
                </div>

                {status && (
                  <div className="grid gap-4 sm:grid-cols-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    {(() => {
                      const orgRequired = ["Employed", "Entrepreneur", "Faculty / Academician", "Research Scholar", "Retired Professional", "Student / Higher Education"].includes(status);
                      const orgOptional = ["Self-Employed / Consultant", "Career Break", "Other"].includes(status);
                      const showOrg = orgRequired || orgOptional;
                      
                      const roleRequired = ["Employed", "Self-Employed / Consultant", "Entrepreneur", "Faculty / Academician", "Research Scholar", "Retired Professional", "Student / Higher Education", "Other"].includes(status);

                      const getFieldLabels = (s: string) => {
                        switch (s) {
                          case "Employed":
                            return { org: "Current Company / Organization", role: "Current Designation / Role" };
                          case "Self-Employed / Consultant":
                            return { org: "Practice / Business Name (Optional)", role: "Designation / Role" };
                          case "Entrepreneur":
                            return { org: "Venture / Company Name", role: "Role / Title" };
                          case "Faculty / Academician":
                            return { org: "Institution Name", role: "Designation" };
                          case "Research Scholar":
                            return { org: "Institution / University Name", role: "Field of Research" };
                          case "Retired Professional":
                            return { org: "Last Organization", role: "Last Designation" };
                          case "Student / Higher Education":
                            return { org: "Institution Name", role: "Degree / Program" };
                          case "Career Break":
                            return { org: "Last Organization (Optional)", role: "Last Designation (Optional)" };
                          case "Other":
                          default:
                            return { org: "Organization / Affiliation (Optional)", role: "Designation / Description" };
                        }
                      };

                      return (
                        <>
                          {showOrg && (
                            <div className="space-y-1.5">
                              <Label>
                                {getFieldLabels(status).org}{" "}
                                {orgRequired && <span className="text-destructive">*</span>}
                              </Label>
                              <Input
                                placeholder="e.g. Acme Corp"
                                {...form.register("current_organization")}
                              />
                              {form.formState.errors.current_organization && (
                                <p className="text-xs text-destructive">
                                  {form.formState.errors.current_organization.message}
                                </p>
                              )}
                            </div>
                          )}
                          {roleRequired && (
                            <div className="space-y-1.5">
                              <Label>
                                {getFieldLabels(status).role}{" "}
                                <span className="text-destructive">*</span>
                              </Label>
                              <Input
                                placeholder="e.g. Lead Engineer"
                                {...form.register("current_role")}
                              />
                              {form.formState.errors.current_role && (
                                <p className="text-xs text-destructive">{form.formState.errors.current_role.message}</p>
                              )}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Headline</Label>
                <Input
                  {...form.register("headline")}
                  placeholder="e.g. Helping early-stage PMs ship their first product"
                  maxLength={160}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {watched.headline?.length ?? 0}/160
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Bio *</Label>
                <Textarea
                  rows={5}
                  {...form.register("bio")}
                  placeholder="Tell mentees about your background, what you can help with, and your approach…"
                />
                <div className="flex justify-between text-xs">
                  <span className={form.formState.errors.bio ? "text-destructive" : "text-muted-foreground"}>
                    {form.formState.errors.bio?.message ?? "Min 50 characters"}
                  </span>
                  <span className="text-muted-foreground">{watched.bio?.length ?? 0}/2000</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Expertise */}
          <Card id="expertise" className="scroll-mt-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" /> Expertise areas *
              </CardTitle>
              <CardDescription>
                Add the topics you mentor on. Press Tab, Enter, or comma after each.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Controller
                control={form.control}
                name="expertise"
                render={({ field, fieldState }) => (
                  <ExpertiseInput
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </CardContent>
          </Card>

          {/* Experience */}
          <Card id="experience" className="scroll-mt-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" /> Experience
              </CardTitle>
              <CardDescription>Your work history, most recent first.</CardDescription>
            </CardHeader>
            <CardContent>
              <Controller
                control={form.control}
                name="experiences"
                render={({ field }) => <ExperienceList value={field.value} onChange={field.onChange} />}
              />
            </CardContent>
          </Card>

          {/* Education */}
          <Card id="education" className="scroll-mt-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" /> Qualifications
              </CardTitle>
              <CardDescription>Education, degrees, and certifications.</CardDescription>
            </CardHeader>
            <CardContent>
              <Controller
                control={form.control}
                name="qualifications"
                render={({ field }) => <QualificationsList value={field.value} onChange={field.onChange} />}
              />
            </CardContent>
          </Card>

          {/* Links & Resume */}
          <Card id="links" className="scroll-mt-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-primary" /> Links & Resume
              </CardTitle>
              <CardDescription>Where mentees can learn more about you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Linkedin className="h-3.5 w-3.5" /> LinkedIn profile *
                  </Label>
                  <Input
                    type="text"
                    placeholder="https://linkedin.com/in/…"
                    {...form.register("linkedin_url")}
                  />
                  {form.formState.errors.linkedin_url && (
                    <p className="text-xs text-destructive">{form.formState.errors.linkedin_url.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5" /> Portfolio / website
                  </Label>
                  <Input type="text" placeholder="https://…" {...form.register("portfolio_url")} />
                  {form.formState.errors.portfolio_url && (
                    <p className="text-xs text-destructive">{form.formState.errors.portfolio_url.message}</p>
                  )}
                </div>
              </div>

              <ResumeUploadCard
                hasResume={!!resumePath}
                onView={handleViewResume}
                viewing={viewingResume}
                pendingFileName={pendingResume?.name ?? null}
                onClearPending={() => setPendingResume(null)}
                onSelectFile={setPendingResume}
                onRemove={() => setResumePath("")}
                maxSizeMb={5}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sticky save bar */}
        {dirty && (
          <div className="sticky bottom-0 z-20 border-t bg-background/95 backdrop-blur shadow-lg -mx-3 -mb-3 sm:-mx-4 sm:-mb-4 md:-mx-6 md:-mb-6 px-3 sm:px-4 md:px-6 py-3 mt-6">
            <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                You have unsaved changes
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    if (data) {
                      form.reset();
                      setPendingResume(null);
                      setPendingAvatar(null);
                      setAvatarUrl(data.avatar_url);
                      setResumePath(data.resume_url);
                    }
                  }}
                  disabled={update.isPending}
                >
                  Discard
                </Button>
                <Button type="submit" disabled={update.isPending}>
                  {update.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Save changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </form>
    </AppLayout>
  );
};

export default MentorProfile;

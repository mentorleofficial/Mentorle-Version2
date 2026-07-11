import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  fetchMenteeProfile,
  upsertMenteeProfile,
  uploadMenteeAvatar,
} from "@/features/mentee-onboarding/api";
import {
  emptyOnboarding,
  menteeOnboardingSchema,
  type MenteeOnboardingValues,
} from "@/features/mentee-onboarding/schema";
import { useInvalidateMenteeProfile } from "@/features/mentee-onboarding/hooks/useMenteeProfileStatus";
import OnboardingShell from "@/features/mentee-onboarding/components/OnboardingShell";
import ChipInput from "@/features/mentee-onboarding/components/ChipInput";
import AvatarUploader from "@/features/mentor-profile/components/AvatarUploader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

const STEP_TITLES = [
  { title: "Welcome 👋", subtitle: "Let's set up your profile so mentors get to know you." },
  { title: "About you", subtitle: "A short headline and bio help mentors understand your context." },
  { title: "Your goals", subtitle: "What do you want to achieve through mentorship?" },
  { title: "Interests & skills", subtitle: "Add at least 3 — these help us match you with the right mentors." },
  { title: "Who do you want to learn from?", subtitle: "Pick the areas you want guidance in." },
  { title: "Review & finish", subtitle: "Looks good? You can edit any of this later from your profile." },
] as const;

const INTEREST_SUGGESTIONS = [
  "Product Management", "Design", "Engineering", "Data", "AI/ML",
  "Marketing", "Sales", "Leadership", "Career Growth", "Public Speaking",
];
const AREA_SUGGESTIONS = [
  "Career advice", "Interview prep", "Technical skills", "Leadership",
  "Startup / Entrepreneurship", "Product thinking", "Networking",
];

const MenteeOnboarding = () => {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const invalidate = useInvalidateMenteeProfile();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [values, setValues] = useState<MenteeOnboardingValues>(emptyOnboarding);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchMenteeProfile(user.id)
      .then((data) => {
        if (cancelled) return;
        if (data.onboarded_at) {
          navigate("/dashboard", { replace: true });
          return;
        }
        setAvatarUrl(data.avatar_url);
        setValues({
          full_name: data.full_name || profile?.full_name || "",
          headline: data.headline,
          bio: data.bio,
          organization_unit: data.organization_unit,
          linkedin_url: data.linkedin_url,
          goals: data.goals,
          interests: data.interests,
          preferred_mentor_areas: data.preferred_mentor_areas,
          academic_details: data.academic_details,
          github_url: data.github_url,
          portfolio_url: data.portfolio_url,
        });
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user, profile?.full_name, navigate]);

  const set = <K extends keyof MenteeOnboardingValues>(key: K, val: MenteeOnboardingValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: val }));

  const stepError = useMemo(() => {
    switch (step) {
      case 0:
        if (!values.full_name.trim() || values.full_name.trim().length < 2) return "Please enter your full name";
        return null;
      case 1:
        if (values.headline.length > 160) return "Headline too long";
        if (values.bio.length > 600) return "Bio too long";
        return null;
      case 2:
        if (values.goals.trim().length < 20) return "Tell mentors a bit more (at least 20 characters)";
        return null;
      case 3:
        if (values.interests.length < 3) return "Add at least 3 interests";
        return null;
      case 4:
        if (values.preferred_mentor_areas.length < 1) return "Pick at least one area";
        if (values.linkedin_url) {
          let cleanL = values.linkedin_url.trim().replace(/\/+$/, "");
          if (!/^https?:\/\//i.test(cleanL)) {
            cleanL = `https://${cleanL}`;
          }
          const ok = /linkedin\.com\/(in|pub)\//i.test(cleanL);
          if (!ok) return "Must be a linkedin.com/in/… URL";
        }
        if (values.github_url) {
          let cleanG = values.github_url.trim().replace(/\/+$/, "");
          if (!/^https?:\/\//i.test(cleanG)) {
            cleanG = `https://${cleanG}`;
          }
          const ok = /github\.com\//i.test(cleanG);
          if (!ok) return "Must be a github.com/… URL";
        }
        if (values.portfolio_url) {
          let cleanP = values.portfolio_url.trim().replace(/\/+$/, "");
          if (!/^https?:\/\//i.test(cleanP)) {
            cleanP = `https://${cleanP}`;
          }
          try {
            new URL(cleanP);
          } catch {
            return "Must be a valid portfolio URL";
          }
        }
        return null;
      default:
        return null;
    }
  }, [step, values]);

  const handleAvatarSelect = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const url = await uploadMenteeAvatar(user.id, file);
      await upsertMenteeProfile(user.id, { avatar_url: url });
      setAvatarUrl(url);
      await refreshProfile();
      toast({ title: "Photo updated" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Upload failed", description: e?.message });
    } finally {
      setUploading(false);
    }
  };

  const persistDraft = async () => {
    if (!user) return;
    let cleanLinkedin = values.linkedin_url.trim();
    if (cleanLinkedin) {
      cleanLinkedin = cleanLinkedin.replace(/\/+$/, "");
      if (!/^https?:\/\//i.test(cleanLinkedin)) {
        cleanLinkedin = `https://${cleanLinkedin}`;
      }
    }
    await upsertMenteeProfile(user.id, {
      full_name: values.full_name,
      headline: values.headline,
      bio: values.bio,
      organization_unit: values.organization_unit,
      linkedin_url: cleanLinkedin,
      goals: values.goals,
      interests: values.interests,
      preferred_mentor_areas: values.preferred_mentor_areas,
      academic_details: values.academic_details,
      github_url: values.github_url,
      portfolio_url: values.portfolio_url,
    });
  };

  const handleNext = async () => {
    if (stepError) {
      toast({ variant: "destructive", title: stepError });
      return;
    }
    setSaving(true);
    try {
      if (step === STEP_TITLES.length - 1) {
        const parsed = menteeOnboardingSchema.safeParse(values);
        if (!parsed.success) {
          const first = parsed.error.issues[0]?.message ?? "Please review the form";
          toast({ variant: "destructive", title: first });
          setSaving(false);
          return;
        }
        await upsertMenteeProfile(
          user!.id,
          { ...parsed.data },
          { markOnboarded: true }
        );
        await refreshProfile();
        invalidate(user!.id);
        toast({ title: "You're all set!", description: "Welcome aboard 🎉" });
        navigate("/mentors", { replace: true });
        return;
      }
      await persistDraft();
      setStep((s) => s + 1);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not save", description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveExit = async () => {
    setSaving(true);
    try {
      await persistDraft();
      toast({ title: "Draft saved", description: "Pick up where you left off any time." });
      navigate("/dashboard", { replace: true });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not save", description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const meta = STEP_TITLES[step];
  const isLast = step === STEP_TITLES.length - 1;
  const initials =
    (values.full_name || profile?.full_name || profile?.email || "U")
      .split(" ")
      .map((s) => s.charAt(0))
      .slice(0, 2)
      .join("")
      .toUpperCase();

  return (
    <OnboardingShell
      step={step}
      totalSteps={STEP_TITLES.length}
      title={meta.title}
      subtitle={meta.subtitle}
      onBack={step > 0 ? () => setStep((s) => s - 1) : undefined}
      onNext={handleNext}
      nextLabel={isLast ? "Finish & explore mentors" : "Continue"}
      nextDisabled={!!stepError}
      loading={saving}
      onSaveExit={handleSaveExit}
    >
      {step === 0 && (
        <div className="space-y-6">
          <div className="flex justify-center">
            <AvatarUploader
              url={avatarUrl}
              fallback={initials}
              uploading={uploading}
              onSelect={handleAvatarSelect}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              value={values.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              placeholder="Jane Doe"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Your email <span className="font-medium">{profile?.email}</span> is taken from your sign-in.
          </p>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="headline">Headline <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="headline"
              value={values.headline}
              maxLength={160}
              onChange={(e) => set("headline", e.target.value)}
              placeholder="e.g. Junior PM exploring AI products"
            />
            <p className="text-xs text-muted-foreground text-right">{values.headline.length}/160</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">About you <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              id="bio"
              rows={4}
              value={values.bio}
              maxLength={600}
              onChange={(e) => set("bio", e.target.value)}
              placeholder="A couple of sentences about your background…"
            />
            <p className="text-xs text-muted-foreground text-right">{values.bio.length}/600</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="org">Team / department <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="org"
              value={values.organization_unit}
              onChange={(e) => set("organization_unit", e.target.value)}
              placeholder="e.g. Engineering – Platform"
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="goals">What do you want to achieve?</Label>
            <Textarea
              id="goals"
              rows={4}
              value={values.goals}
              maxLength={800}
              onChange={(e) => set("goals", e.target.value)}
              placeholder="e.g. Transition into a product role within 12 months, get feedback on my portfolio, prepare for senior interviews…"
            />
            <p className="text-xs text-muted-foreground text-right">{values.goals.length}/800</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="academic_details">Academic details <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="academic_details"
              value={values.academic_details}
              onChange={(e) => set("academic_details", e.target.value)}
              placeholder="e.g. BS Computer Science @ Stanford University, Class of 2027"
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-2">
          <Label>Your interests & skills</Label>
          <ChipInput
            value={values.interests}
            onChange={(v) => set("interests", v)}
            placeholder="Type an interest and press Enter"
            suggestions={INTEREST_SUGGESTIONS}
          />
          <p className="text-xs text-muted-foreground">Add at least 3.</p>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Areas you want guidance in</Label>
            <ChipInput
              value={values.preferred_mentor_areas}
              onChange={(v) => set("preferred_mentor_areas", v)}
              placeholder="Type an area and press Enter"
              suggestions={AREA_SUGGESTIONS}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="linkedin">LinkedIn URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="linkedin"
              value={values.linkedin_url}
              onChange={(e) => set("linkedin_url", e.target.value)}
              onBlur={(e) => {
                let cleanL = e.target.value.trim().replace(/\/+$/, "");
                if (cleanL && !/^https?:\/\//i.test(cleanL)) {
                  cleanL = `https://${cleanL}`;
                }
                set("linkedin_url", cleanL);
              }}
              placeholder="https://www.linkedin.com/in/your-handle"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="github">GitHub Profile <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="github"
              value={values.github_url}
              onChange={(e) => set("github_url", e.target.value)}
              onBlur={(e) => {
                let cleanG = e.target.value.trim().replace(/\/+$/, "");
                if (cleanG && !/^https?:\/\//i.test(cleanG)) {
                  cleanG = `https://${cleanG}`;
                }
                set("github_url", cleanG);
              }}
              placeholder="https://github.com/your-username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="portfolio">Portfolio URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="portfolio"
              value={values.portfolio_url}
              onChange={(e) => set("portfolio_url", e.target.value)}
              onBlur={(e) => {
                let cleanP = e.target.value.trim().replace(/\/+$/, "");
                if (cleanP && !/^https?:\/\//i.test(cleanP)) {
                  cleanP = `https://${cleanP}`;
                }
                set("portfolio_url", cleanP);
              }}
              placeholder="https://your-portfolio.com"
            />
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-5 text-sm">
          <ReviewRow label="Name" value={values.full_name} />
          {values.headline && <ReviewRow label="Headline" value={values.headline} />}
          {values.organization_unit && <ReviewRow label="Team" value={values.organization_unit} />}
          {values.bio && <ReviewRow label="About" value={values.bio} multiline />}
          <ReviewRow label="Goals" value={values.goals} multiline />
          {values.academic_details && <ReviewRow label="Academic details" value={values.academic_details} />}
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Interests</p>
            <div className="flex flex-wrap gap-1">
              {values.interests.map((i) => <Badge key={i} variant="secondary">{i}</Badge>)}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Preferred mentor areas</p>
            <div className="flex flex-wrap gap-1">
              {values.preferred_mentor_areas.map((i) => <Badge key={i}>{i}</Badge>)}
            </div>
          </div>
          {values.linkedin_url && <ReviewRow label="LinkedIn" value={values.linkedin_url} />}
          {values.github_url && <ReviewRow label="GitHub" value={values.github_url} />}
          {values.portfolio_url && <ReviewRow label="Portfolio" value={values.portfolio_url} />}
        </div>
      )}
    </OnboardingShell>
  );
};

const ReviewRow = ({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) => (
  <div>
    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
    <p className={multiline ? "whitespace-pre-wrap" : ""}>{value}</p>
  </div>
);

export default MenteeOnboarding;
